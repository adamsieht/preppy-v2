import { vi } from 'vitest'

export const app = {
  isPackaged: false,
  getPath: vi.fn((_key: string) => '/tmp/preppy-test'),
}

export const ipcMain = {
  handle: vi.fn(),
  on: vi.fn(),
}

export const BrowserWindow = {
  getAllWindows: vi.fn(() => []),
}

export const ipcRenderer = {
  invoke: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn(),
}

export const contextBridge = {
  exposeInMainWorld: vi.fn(),
}
