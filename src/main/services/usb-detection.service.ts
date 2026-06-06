import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { getConfig } from './config.service'

export interface UsbPrinterDevice {
  path: string
  displayName: string
  manufacturer: string
  model: string
  vendorId: string
  productId: string
  connection: 'usb' | 'bluetooth' | 'network'
  isZebra: boolean
  writable: boolean
  isCurrent: boolean
}

// Vendor IDs of known label/receipt printer manufacturers
const LABEL_PRINTER_VIDS = new Set([
  '0a5f', // Zebra Technologies Corp.
  '1d90', // Citizen Systems
  '0b4d', // SATO Corporation
  '0c2e', // Honeywell / Intermec
  '1dd2', // Datamax-O'Neil
  '04b8', // Seiko Epson (label models)
  '0519', // Star Micronics
])

function canWrite(p: string): boolean {
  try { fs.accessSync(p, fs.constants.W_OK); return true }
  catch { return false }
}

function sysfsRead(filePath: string): string {
  try { return fs.readFileSync(filePath, 'utf8').trim() }
  catch { return '' }
}

// Walk up a resolved sysfs path until we reach the USB device directory
// (identified by the presence of idVendor). Handles both lp* and ttyUSB*
// hierarchy differences gracefully.
function findUsbRoot(startPath: string): string {
  let current = startPath
  for (let depth = 0; depth < 8; depth++) {
    if (sysfsRead(path.join(current, 'idVendor'))) return current
    const parent = path.dirname(current)
    if (parent === current) return ''
    current = parent
  }
  return ''
}

function readUsbInfo(sysClassPath: string) {
  const empty = { manufacturer: '', model: '', vendorId: '', productId: '' }
  try {
    const resolved = fs.realpathSync(path.join(sysClassPath, 'device'))
    const usbRoot = findUsbRoot(resolved)
    if (!usbRoot) return empty
    return {
      manufacturer: sysfsRead(path.join(usbRoot, 'manufacturer')),
      model:        sysfsRead(path.join(usbRoot, 'product')),
      vendorId:     sysfsRead(path.join(usbRoot, 'idVendor')),
      productId:    sysfsRead(path.join(usbRoot, 'idProduct')),
    }
  } catch {
    return empty
  }
}

function scanLinux(currentDevice: string): UsbPrinterDevice[] {
  const devices: UsbPrinterDevice[] = []

  // /dev/usb/lp* — kernel USB printer-class devices (always printers by definition)
  for (let i = 0; i <= 9; i++) {
    const devPath = `/dev/usb/lp${i}`
    if (!fs.existsSync(devPath)) continue

    const info = readUsbInfo(`/sys/class/usbmisc/lp${i}`)
    const isZebra = info.vendorId === '0a5f' || info.manufacturer.toLowerCase().includes('zebra')
    const displayName = info.model
      ? `${info.manufacturer} ${info.model}`.trim()
      : isZebra ? 'Zebra Label Printer' : 'USB Label Printer'

    devices.push({
      path: devPath,
      displayName,
      manufacturer: info.manufacturer,
      model:        info.model,
      vendorId:     info.vendorId,
      productId:    info.productId,
      connection:  'usb',
      isZebra,
      writable:    canWrite(devPath),
      isCurrent:   devPath === currentDevice,
    })
  }

  // /dev/ttyUSB* — USB serial devices; only include known printer vendor IDs
  for (let i = 0; i <= 9; i++) {
    const devPath = `/dev/ttyUSB${i}`
    if (!fs.existsSync(devPath)) continue

    const info = readUsbInfo(`/sys/class/tty/ttyUSB${i}`)
    const vid = info.vendorId.toLowerCase()
    const isZebra = vid === '0a5f' || info.manufacturer.toLowerCase().includes('zebra')
    const isKnownPrinter = LABEL_PRINTER_VIDS.has(vid) || isZebra
    if (!isKnownPrinter) continue   // Skip USB-serial adapters that aren't printers

    const displayName = info.model
      ? `${info.manufacturer} ${info.model}`.trim()
      : 'USB Serial Label Printer'

    devices.push({
      path: devPath,
      displayName,
      manufacturer: info.manufacturer,
      model:        info.model,
      vendorId:     info.vendorId,
      productId:    info.productId,
      connection:  'usb',
      isZebra,
      writable:    canWrite(devPath),
      isCurrent:   devPath === currentDevice,
    })
  }

  // /dev/rfcomm* — Bluetooth serial profiles (paired Zebra Bluetooth printers)
  for (let i = 0; i <= 3; i++) {
    const devPath = `/dev/rfcomm${i}`
    if (!fs.existsSync(devPath)) continue

    devices.push({
      path:        devPath,
      displayName: `Bluetooth Printer (rfcomm${i})`,
      manufacturer: '',
      model:        '',
      vendorId:     '',
      productId:    '',
      connection:  'bluetooth',
      isZebra:     false,
      writable:    canWrite(devPath),
      isCurrent:   devPath === currentDevice,
    })
  }

  return devices
}

function scanWindows(currentDevice: string): UsbPrinterDevice[] {
  const devices: UsbPrinterDevice[] = []

  // Try wmic first (available on Windows 7-10; deprecated but still present on 11)
  try {
    const csv = execSync(
      'wmic printer get Name,PortName /format:csv',
      { timeout: 6000, encoding: 'utf8' }
    )
    for (const line of csv.split(/\r?\n/).slice(2)) {
      const parts = line.trim().split(',')
      if (parts.length < 3) continue
      const name = parts[1]?.trim()
      const portName = parts[2]?.trim()
      if (!name || !portName) continue
      // Include USB ports and COM ports; skip network, XPS, PDF, etc.
      const isUsb = portName.startsWith('USB')
      const isCom = /^COM\d/i.test(portName)
      if (!isUsb && !isCom) continue

      const isZebra = name.toLowerCase().includes('zebra')
      devices.push({
        path:        portName,
        displayName: name,
        manufacturer: isZebra ? 'Zebra Technologies' : '',
        model:        name,
        vendorId:    '',
        productId:   '',
        connection:  isUsb ? 'usb' : 'usb',   // COM-over-USB is still USB
        isZebra,
        writable:    true,  // Windows doesn't easily expose write permission pre-connect
        isCurrent:   portName === currentDevice,
      })
    }
    return devices
  } catch { /* wmic failed — fall through to PowerShell */ }

  // PowerShell fallback (Windows 11+)
  try {
    const ps = `Get-Printer | Where-Object {$_.PortName -like 'USB*' -or $_.PortName -match '^COM'} | Select-Object Name,PortName | ConvertTo-Csv -NoTypeInformation`
    const out = execSync(`powershell -NoProfile -NonInteractive -Command "${ps}"`, { timeout: 8000, encoding: 'utf8' })
    for (const line of out.trim().split(/\r?\n/).slice(1)) {
      const m = line.match(/^"([^"]*?)","([^"]*?)"/)
      if (!m) continue
      const [, name, portName] = m
      if (!name || !portName) continue
      const isZebra = name.toLowerCase().includes('zebra')
      devices.push({
        path:        portName,
        displayName: name,
        manufacturer: isZebra ? 'Zebra Technologies' : '',
        model:        name,
        vendorId:    '',
        productId:   '',
        connection:  'usb',
        isZebra,
        writable:    true,
        isCurrent:   portName === currentDevice,
      })
    }
  } catch { /* PowerShell also failed — return empty */ }

  return devices
}

export function scanPrinters(): UsbPrinterDevice[] {
  const currentDevice = getConfig().printer.device
  try {
    if (process.platform === 'linux')  return scanLinux(currentDevice)
    if (process.platform === 'win32')  return scanWindows(currentDevice)
  } catch { /* Unexpected error — return empty list */ }
  return []
}

/** Write-access check only — no paper used. */
export function testPrinterDevice(devicePath: string): { success: boolean; error?: string } {
  try {
    fs.accessSync(devicePath, fs.constants.W_OK)
    return { success: true }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}
