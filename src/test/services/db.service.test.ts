import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('electron', () => ({
  app: { isPackaged: false, getPath: vi.fn(() => '/tmp/preppy-test') },
}))

const mockDb = {
  exec: vi.fn(),
  run: vi.fn(),
  all: vi.fn(),
  get: vi.fn(),
}

vi.mock('node-sqlite3-wasm', () => ({
  Database: vi.fn(() => mockDb),
}))

vi.mock('../../main/logger', () => ({
  logInfo: vi.fn(), logWarn: vi.fn(), logError: vi.fn(), logDebug: vi.fn(),
}))

describe('db.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('initializes WAL mode on first getDb() call', async () => {
    const { getDb } = await import('../../main/services/db.service')
    getDb()
    expect(mockDb.exec).toHaveBeenCalledWith(expect.stringContaining('PRAGMA journal_mode = WAL'))
  })

  it('getSensors() queries the sensors table', async () => {
    mockDb.all.mockReturnValue([{ mac: 'AA:BB', temperature: 38.0, humidity: 65, battery: 80, last_update: '' }])
    const { getSensors } = await import('../../main/services/db.service')
    const result = getSensors()
    expect(mockDb.all).toHaveBeenCalledWith(expect.stringContaining('SELECT * FROM sensors'))
    expect(result).toHaveLength(1)
    expect(result[0].mac).toBe('AA:BB')
  })

  it('insertLog() runs an insert statement', async () => {
    const { insertLog } = await import('../../main/services/db.service')
    insertLog({ mac: 'AA:BB', time: '2026-01-01T00:00:00Z', temperature: 38.1, humidity: 65.0, battery: 80 })
    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO logs'),
      expect.objectContaining({ '@mac': 'AA:BB', '@temperature': 38.1 })
    )
  })

  it('getPrintJobs() returns rows from print_jobs table', async () => {
    const jobs = [{ id: 1, template: 'IX', duration_hrs: 4, qty: 5, printed_at: '', success: 1, error_msg: null }]
    mockDb.all.mockReturnValue(jobs)
    const { getPrintJobs } = await import('../../main/services/db.service')
    const result = getPrintJobs()
    expect(result).toHaveLength(1)
    expect(result[0].template).toBe('IX')
  })

  it('getWifi() returns null when no row exists', async () => {
    mockDb.get.mockReturnValue(undefined)
    const { getWifi } = await import('../../main/services/db.service')
    expect(getWifi()).toBeNull()
  })

  it('upsertWifi() runs an upsert statement', async () => {
    const { upsertWifi } = await import('../../main/services/db.service')
    upsertWifi('MySSID', 'MyPass123')
    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO wifi'),
      expect.objectContaining({ '@ssid': 'MySSID', '@pass': 'MyPass123' })
    )
  })
})
