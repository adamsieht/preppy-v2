import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('electron', () => ({
  app: { isPackaged: false, getPath: vi.fn(() => '/tmp/preppy-test') },
  BrowserWindow: { getAllWindows: vi.fn(() => [{ webContents: { send: vi.fn() } }]) },
}))

vi.mock('../../main/logger', () => ({
  logInfo: vi.fn(), logWarn: vi.fn(), logError: vi.fn(), logDebug: vi.fn(),
}))

const insertLogMock = vi.fn()
const upsertSensorMock = vi.fn()
vi.mock('../../main/services/db.service', () => ({
  insertLog: insertLogMock,
  upsertSensor: upsertSensorMock,
}))

vi.mock('../../main/services/config.service', () => ({
  getConfig: vi.fn(() => ({ sensor: { pollIntervalMs: 10000 } })),
}))

describe('mock-sensor.service', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    vi.resetModules()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('startMock() immediately writes readings for both sensors', async () => {
    const { startMock, stopMock } = await import('../../main/services/mock-sensor.service')
    startMock()
    stopMock()

    // 2 sensors = 2 insertLog + 2 upsertSensor calls on first tick
    expect(insertLogMock).toHaveBeenCalledTimes(2)
    expect(upsertSensorMock).toHaveBeenCalledTimes(2)
  })

  it('emitted readings have mac, temperature, humidity, battery', async () => {
    const { startMock, stopMock } = await import('../../main/services/mock-sensor.service')
    startMock()
    stopMock()

    const call = insertLogMock.mock.calls[0][0]
    expect(call).toMatchObject({
      mac: expect.stringMatching(/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/i),
      temperature: expect.any(Number),
      humidity: expect.any(Number),
      battery: expect.any(Number),
      time: expect.any(String),
    })
  })

  it('temperature stays within safe fridge range (33–41°F) over many ticks', async () => {
    const { startMock, stopMock } = await import('../../main/services/mock-sensor.service')
    startMock()
    // Advance 50 poll intervals
    vi.advanceTimersByTime(10000 * 50)
    stopMock()

    const allTemps = insertLogMock.mock.calls.map((c: unknown[]) => (c[0] as { temperature: number }).temperature)
    expect(allTemps.every((t: number) => t >= 33 && t <= 41)).toBe(true)
  })

  it('stopMock() prevents further ticks', async () => {
    const { startMock, stopMock } = await import('../../main/services/mock-sensor.service')
    startMock()
    stopMock()
    const countAfterStop = insertLogMock.mock.calls.length

    vi.advanceTimersByTime(10000 * 5)
    expect(insertLogMock.mock.calls.length).toBe(countAfterStop)
  })

  it('sends SENSOR_UPDATE IPC event to all windows', async () => {
    const { BrowserWindow } = await import('electron')
    const sendMock = vi.fn()
    ;(BrowserWindow.getAllWindows as ReturnType<typeof vi.fn>).mockReturnValue([
      { webContents: { send: sendMock } },
    ])

    const { startMock, stopMock } = await import('../../main/services/mock-sensor.service')
    startMock()
    stopMock()

    expect(sendMock).toHaveBeenCalledWith('sensor:update', expect.objectContaining({ temperature: expect.any(Number) }))
  })
})
