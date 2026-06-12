import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import dayjs from 'dayjs'
import { getConfig, resourcePath } from './config.service'
import { insertPrintJob } from './db.service'
import { logInfo, logWarn, logError, logDebug } from '../logger'

export type LabelTemplate = 'IX' | 'OX' | 'UX'

export interface PrintArgs {
  template: LabelTemplate
  durationHrs: number
  qty: number
  expiryIso?: string
}

export interface PrintResult {
  success: boolean
  simulated?: boolean
  simulatedPath?: string
  error?: string
}

function injectLabelHome(zpl: string, x: number, y: number): string {
  // Insert ^LH immediately after ^XA so it applies to the whole label
  return zpl.replace(/(\^XA\r?\n?)/, `$1^LH${x},${y}\n`)
}

function fillTemplate(raw: string, durationHrs: number, expiryIso?: string): string {
  const now    = dayjs()
  const expiry = expiryIso ? dayjs(expiryIso) : now.add(durationHrs, 'hour')
  return raw
    .replace(/\{\{DATE\}\}/g, now.format('MM/DD/YY'))
    .replace(/\{\{TIME\}\}/g, now.format('hh:mm A'))
    .replace(/\{\{EXPIRY_DATE\}\}/g, expiry.format('MM/DD/YY'))
    .replace(/\{\{EXPIRY_TIME\}\}/g, expiry.format('hh:mm A'))
    .replace(/\{\{DURATION\}\}/g, String(durationHrs))
}

export interface PreviewResult {
  success: boolean
  zpl?: string
  fields?: {
    template: LabelTemplate
    durationHrs: number
    printDate: string
    printTime: string
    expiryDate: string
    expiryTime: string
  }
  error?: string
}

export function preview(args: Omit<PrintArgs, 'qty'>): PreviewResult {
  const config = getConfig()
  const templatePath = resourcePath(config.printer.zplTemplateDir, `${args.template}.zpl`)

  let raw: string
  try {
    raw = fs.readFileSync(templatePath, 'utf-8')
  } catch (err) {
    return { success: false, error: `Failed to read ZPL template: ${String(err)}` }
  }

  const now    = dayjs()
  const expiry = args.expiryIso ? dayjs(args.expiryIso) : now.add(args.durationHrs, 'hour')
  const zpl = injectLabelHome(
    fillTemplate(raw, args.durationHrs, args.expiryIso),
    config.printer.labelhomeX ?? 0,
    config.printer.labelhomeY ?? 0,
  )

  return {
    success: true,
    zpl,
    fields: {
      template: args.template,
      durationHrs: args.durationHrs,
      printDate: now.format('MM/DD/YY'),
      printTime: now.format('hh:mm A'),
      expiryDate: expiry.format('MM/DD/YY'),
      expiryTime: expiry.format('hh:mm A'),
    },
  }
}

export function print(args: PrintArgs): PrintResult {
  const config = getConfig()
  const templatePath = resourcePath(config.printer.zplTemplateDir, `${args.template}.zpl`)

  let raw: string
  try {
    raw = fs.readFileSync(templatePath, 'utf-8')
  } catch (err) {
    const error = `Failed to read ZPL template ${templatePath}: ${String(err)}`
    logError(error)
    insertPrintJob({
      template: args.template,
      duration_hrs: args.durationHrs,
      qty: args.qty,
      printed_at: dayjs().toISOString(),
      success: 0,
      error_msg: error,
    })
    return { success: false, error }
  }

  const filled = injectLabelHome(
    fillTemplate(raw, args.durationHrs, args.expiryIso),
    config.printer.labelhomeX ?? 0,
    config.printer.labelhomeY ?? 0,
  )

  const deviceExists = fs.existsSync(config.printer.device)
  const simulating = config.printer.simulate || !deviceExists

  if (simulating && !config.printer.simulate) {
    logWarn(`Printer device ${config.printer.device} not found — falling back to simulate mode`)
  }

  const simDir = path.join(process.cwd(), 'simulated-labels')
  if (simulating) fs.mkdirSync(simDir, { recursive: true })

  const timestamp = dayjs().format('YYYY-MM-DD_HH-mm-ss')
  let lastSimPath = ''

  logInfo(`${simulating ? '[SIMULATE] ' : ''}Printing ${args.qty}x ${args.template} label (${args.durationHrs}h)`)

  for (let i = 0; i < args.qty; i++) {
    try {
      if (simulating) {
        const outPath = path.join(simDir, `${timestamp}_${args.template}_${i + 1}of${args.qty}.zpl`)
        fs.writeFileSync(outPath, filled)
        lastSimPath = outPath
        logDebug(`[SIMULATE] Label ${i + 1}/${args.qty} written to ${outPath}`)
      } else {
        fs.writeFileSync(config.printer.device, filled)
        logDebug(`Label ${i + 1}/${args.qty} sent to ${config.printer.device}`)
      }
    } catch (err) {
      const error = `Failed to write label ${i + 1}: ${String(err)}`
      logError(error)
      insertPrintJob({
        template: args.template,
        duration_hrs: args.durationHrs,
        qty: args.qty,
        printed_at: dayjs().toISOString(),
        success: 0,
        error_msg: error,
      })
      return { success: false, error }
    }
  }

  insertPrintJob({
    template: args.template,
    duration_hrs: args.durationHrs,
    qty: args.qty,
    printed_at: dayjs().toISOString(),
    success: 1,
    error_msg: null,
  })

  logInfo(`${simulating ? '[SIMULATE] ' : ''}Print job complete: ${args.qty}x ${args.template}`)
  return { success: true, simulated: simulating, simulatedPath: lastSimPath || undefined }
}

export interface PrintRawArgs {
  zpl: string
  qty: number
}

/**
 * Print a pre-generated ZPL document (used by static presets). Applies the
 * configured label-home offset and honours simulate mode, but does NOT run
 * fillTemplate (the ZPL is already complete) and does NOT log to the print-job
 * history (static jobs carry no template/duration).
 */
export function printRaw(args: PrintRawArgs): PrintResult {
  const config = getConfig()
  const filled = injectLabelHome(
    args.zpl,
    config.printer.labelhomeX ?? 0,
    config.printer.labelhomeY ?? 0,
  )

  const deviceExists = fs.existsSync(config.printer.device)
  const simulating = config.printer.simulate || !deviceExists
  if (simulating && !config.printer.simulate) {
    logWarn(`Printer device ${config.printer.device} not found — falling back to simulate mode`)
  }

  const simDir = path.join(process.cwd(), 'simulated-labels')
  if (simulating) fs.mkdirSync(simDir, { recursive: true })

  const timestamp = dayjs().format('YYYY-MM-DD_HH-mm-ss')
  let lastSimPath = ''

  logInfo(`${simulating ? '[SIMULATE] ' : ''}Printing ${args.qty}x static label`)

  for (let i = 0; i < args.qty; i++) {
    try {
      if (simulating) {
        const outPath = path.join(simDir, `${timestamp}_STATIC_${i + 1}of${args.qty}.zpl`)
        fs.writeFileSync(outPath, filled)
        lastSimPath = outPath
        logDebug(`[SIMULATE] Static label ${i + 1}/${args.qty} written to ${outPath}`)
      } else {
        fs.writeFileSync(config.printer.device, filled)
        logDebug(`Static label ${i + 1}/${args.qty} sent to ${config.printer.device}`)
      }
    } catch (err) {
      const error = `Failed to write static label ${i + 1}: ${String(err)}`
      logError(error)
      return { success: false, error }
    }
  }

  logInfo(`${simulating ? '[SIMULATE] ' : ''}Static print job complete: ${args.qty}x`)
  return { success: true, simulated: simulating, simulatedPath: lastSimPath || undefined }
}
