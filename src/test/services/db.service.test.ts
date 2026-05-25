import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('electron', () => ({
  app: { isPackaged: false, getPath: vi.fn(() => '/tmp/preppy-test') },
}))

// Use a factory to create a shared in-memory mock DB state per test
const mockDb = {
  pragma: vi.fn(),
  exec: vi.fn(),
  prepare: vi.fn(),
}

vi.mock('better-sqlite3', () => ({
  default: vi.fn(() => mockDb),
}))

vi.mock('../../main/logger', () => ({
  logInfo: vi.fn(), logWarn: vi.fn(), logError: vi.fn(), logDebug: vi.fn(),
}))

describe('db.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset the singleton so each test gets a fresh mock
    vi.resetModules()
  })

  it('initializes WAL mode on first getDb() call', async () => {
    const { getDb } = await import('../../main/services/db.service')
    mockDb.prepare.mockReturnValue({ all: vi.fn(() => []), run: vi.fn(), get: vi.fn() })
    getDb()
    expect(mockDb.pragma).toHaveBeenCalledWith('journal_mode = WAL')
  })

  it('getSensors() queries the sensors table', async () => {
    const allMock = vi.fn(() => [{ mac: 'AA:BB', temperature: 38.0, humidity: 65, battery: 80, last_update: '' }])
    mockDb.prepare.mockReturnValue({ all: allMock, run: vi.fn(), get: vi.fn() })

    const { getSensors } = await import('../../main/services/db.service')
    const result = getSensors()

    expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('SELECT * FROM sensors'))
    expect(result).toHaveLength(1)
    expect(result[0].mac).toBe('AA:BB')
  })

  it('insertLog() prepares and runs an insert statement', async () => {
    const runMock = vi.fn()
    mockDb.prepare.mockReturnValue({ all: vi.fn(), run: runMock, get: vi.fn() })

    const { insertLog } = await import('../../main/services/db.service')
    insertLog({ mac: 'AA:BB', time: '2026-01-01T00:00:00Z', temperature: 38.1, humidity: 65.0, battery: 80 })

    expect(runMock).toHaveBeenCalledWith(expect.objectContaining({ mac: 'AA:BB', temperature: 38.1 }))
  })

  it('getPrintJobs() returns rows from print_jobs table', async () => {
    const jobs = [{ id: 1, template: 'IX', duration_hrs: 4, qty: 5, printed_at: '', success: 1, error_msg: null }]
    mockDb.prepare.mockReturnValue({ all: vi.fn(() => jobs), run: vi.fn(), get: vi.fn() })

    const { getPrintJobs } = await import('../../main/services/db.service')
    const result = getPrintJobs()

    expect(result).toHaveLength(1)
    expect(result[0].template).toBe('IX')
  })

  it('getWifi() returns null when no row exists', async () => {
    mockDb.prepare.mockReturnValue({ all: vi.fn(), run: vi.fn(), get: vi.fn(() => undefined) })

    const { getWifi } = await import('../../main/services/db.service')
    expect(getWifi()).toBeNull()
  })

  it('upsertWifi() runs an upsert statement', async () => {
    const runMock = vi.fn()
    mockDb.prepare.mockReturnValue({ all: vi.fn(), run: runMock, get: vi.fn() })

    const { upsertWifi } = await import('../../main/services/db.service')
    upsertWifi('MySSID', 'MyPass123')

    expect(runMock).toHaveBeenCalledWith('MySSID', 'MyPass123')
  })
})
