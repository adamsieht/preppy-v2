import { describe, it, expect, vi, beforeEach } from 'vitest'
import dayjs from 'dayjs'

vi.mock('electron', () => ({
  app: { isPackaged: false, getPath: vi.fn(() => '/tmp/preppy-test') },
  BrowserWindow: { getAllWindows: vi.fn(() => []) },
}))

vi.mock('../../main/logger', () => ({
  logInfo: vi.fn(), logWarn: vi.fn(), logError: vi.fn(), logDebug: vi.fn(),
}))

vi.mock('../../main/services/db.service', () => ({
  insertPrintJob: vi.fn(),
}))

vi.mock('../../main/services/config.service', () => ({
  getConfig: vi.fn(() => ({
    printer: { device: '/dev/usb/lp0', zplTemplateDir: 'resources/zpl', simulate: false },
  })),
  resourcePath: vi.fn((...segments: string[]) => segments.join('/')),
}))

// fs must be mocked with a `default` key because printer.service uses `import fs from 'fs'`
vi.mock('fs', () => {
  const mock = {
    readFileSync: vi.fn(),
    existsSync: vi.fn(() => false),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
  }
  return { default: mock, ...mock }
})

import fs from 'fs'

const ZPL_TEMPLATE = `^XA
^FO50,50^FD{{DATE}} {{TIME}}^FS
^FO50,100^FDExpiry: {{EXPIRY_DATE}} {{EXPIRY_TIME}}^FS
^FO50,150^FDDuration: {{DURATION}}^FS
^XZ`

describe('printer.service — preview()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fs.readFileSync).mockReturnValue(ZPL_TEMPLATE as unknown as Buffer)
  })

  it('fills all placeholders in ZPL output', async () => {
    const { preview } = await import('../../main/services/printer.service')
    const result = preview({ template: 'IX', durationHrs: 4 })

    expect(result.success).toBe(true)
    expect(result.zpl).not.toContain('{{DATE}}')
    expect(result.zpl).not.toContain('{{TIME}}')
    expect(result.zpl).not.toContain('{{EXPIRY_DATE}}')
    expect(result.zpl).not.toContain('{{EXPIRY_TIME}}')
    expect(result.zpl).not.toContain('{{DURATION}}')
  })

  it('sets duration and template in fields', async () => {
    const { preview } = await import('../../main/services/printer.service')
    const result = preview({ template: 'OX', durationHrs: 24 })

    expect(result.fields?.durationHrs).toBe(24)
    expect(result.fields?.template).toBe('OX')
  })

  it('calculates expiry 4 hours ahead of print time', async () => {
    const { preview } = await import('../../main/services/printer.service')
    const result = preview({ template: 'IX', durationHrs: 4 })

    const expectedExpiry = dayjs().add(4, 'hour').format('MM/DD/YY')
    const dayAfter = dayjs().add(1, 'day').format('MM/DD/YY')
    expect([expectedExpiry, dayAfter]).toContain(result.fields?.expiryDate)
    expect(result.fields?.printDate).toBe(dayjs().format('MM/DD/YY'))
  })

  it('returns error when template file is missing', async () => {
    vi.mocked(fs.readFileSync).mockImplementation(() => { throw new Error('ENOENT: no such file') })

    const { preview } = await import('../../main/services/printer.service')
    const result = preview({ template: 'IX', durationHrs: 4 })

    expect(result.success).toBe(false)
    expect(result.error).toContain('Failed to read ZPL template')
  })
})

describe('printer.service — print() simulate mode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fs.readFileSync).mockReturnValue(ZPL_TEMPLATE as unknown as Buffer)
    vi.mocked(fs.existsSync).mockReturnValue(false)
  })

  it('simulates when device does not exist', async () => {
    const { print } = await import('../../main/services/printer.service')
    const result = print({ template: 'IX', durationHrs: 8, qty: 1 })

    expect(result.success).toBe(true)
    expect(result.simulated).toBe(true)
    expect(fs.writeFileSync).toHaveBeenCalled()
  })

  it('simulated file path contains template name and label count', async () => {
    const { print } = await import('../../main/services/printer.service')
    const result = print({ template: 'UX', durationHrs: 24, qty: 2 })

    expect(result.simulatedPath).toContain('UX')
    expect(result.simulatedPath).toContain('2of2')
  })

  it('returns failure when ZPL template read fails', async () => {
    vi.mocked(fs.readFileSync).mockImplementation(() => { throw new Error('File not found') })

    const { print } = await import('../../main/services/printer.service')
    const result = print({ template: 'UX', durationHrs: 24, qty: 2 })

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })
})
