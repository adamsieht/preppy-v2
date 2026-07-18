import type { ElectronAPI } from '../preload'

// The preload script exposes the IPC bridge as window.electronAPI
// (contextBridge.exposeInMainWorld). This augmentation is what lets every
// renderer file use it with full types.
declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
