/**
 * Printer worker thread — sends raw ZPL bytes to a Windows print queue by calling
 * the Win32 spooler API (winspool.drv) directly via koffi FFI.
 *
 * Why a worker thread?
 *   - The FFI calls are synchronous and *could* block if the spooler is wedged.
 *     Running them here keeps the Electron main thread (and the UI) responsive no
 *     matter what the printer does.
 *   - GetLastError is thread-local. Reading it synchronously, on the same thread,
 *     immediately after a failing call gives us reliable Win32 error codes — which
 *     would be impossible to do correctly with per-call async FFI on a thread pool.
 *
 * This replaces the old approach of spawning powershell.exe and compiling C# with
 * Add-Type on every print (~300-500ms each). The spooler behaviour is identical:
 * RAW datatype straight through to a Generic / Text Only queue, no driver render.
 *
 * The worker is long-lived: the parent posts { id, printerName, data } messages and
 * receives { id, ok, error? } replies. koffi and the DLLs load once, on startup.
 */
import { parentPort } from 'worker_threads'
// koffi is a CommonJS native addon; default import works with esModuleInterop.
import koffi from 'koffi'

if (!parentPort) {
  throw new Error('printerWorker must be run as a worker thread')
}

const port = parentPort

// --- Win32 spooler bindings --------------------------------------------------
// Loaded eagerly: if this throws, the worker emits an 'error' the parent handles.
const winspool = koffi.load('winspool.drv')
const kernel32 = koffi.load('kernel32.dll')

const GetLastError = kernel32.func('uint32 __stdcall GetLastError()')

// DOC_INFO_1 (ANSI). pOutputFile stays null; pDatatype 'RAW' bypasses rendering.
koffi.struct('DOC_INFO_1A', {
  pDocName:    'str',
  pOutputFile: 'str',
  pDatatype:   'str',
})

// HANDLE is an opaque pointer (void *). koffi returns/accepts it as an external value.
const OpenPrinterA     = winspool.func('bool __stdcall OpenPrinterA(str pPrinterName, _Out_ void **phPrinter, void *pDefault)')
const StartDocPrinterA = winspool.func('int  __stdcall StartDocPrinterA(void *hPrinter, uint32 Level, DOC_INFO_1A *pDocInfo)')
const StartPagePrinter = winspool.func('bool __stdcall StartPagePrinter(void *hPrinter)')
const WritePrinter     = winspool.func('bool __stdcall WritePrinter(void *hPrinter, void *pBuf, uint32 cbBuf, _Out_ uint32 *pcWritten)')
const EndPagePrinter   = winspool.func('bool __stdcall EndPagePrinter(void *hPrinter)')
const EndDocPrinter    = winspool.func('bool __stdcall EndDocPrinter(void *hPrinter)')
const ClosePrinter     = winspool.func('bool __stdcall ClosePrinter(void *hPrinter)')

interface SendResult { ok: boolean; error?: string }

function sendRaw(printerName: string, bytes: Buffer): SendResult {
  const hOut: [unknown] = [null]
  if (!OpenPrinterA(printerName, hOut, null)) {
    return { ok: false, error: `OpenPrinter failed for "${printerName}" (Win32 error ${GetLastError()}). Is the print queue installed?` }
  }
  const handle = hOut[0]

  try {
    const doc = { pDocName: 'Preppy ZPL', pOutputFile: null, pDatatype: 'RAW' }
    if (StartDocPrinterA(handle, 1, doc) === 0) {
      return { ok: false, error: `StartDocPrinter failed (Win32 error ${GetLastError()}). The queue may not allow RAW data.` }
    }
    if (!StartPagePrinter(handle)) {
      return { ok: false, error: `StartPagePrinter failed (Win32 error ${GetLastError()})` }
    }

    const written: [number] = [0]
    if (!WritePrinter(handle, bytes, bytes.length, written)) {
      return { ok: false, error: `WritePrinter failed (Win32 error ${GetLastError()})` }
    }
    if (written[0] !== bytes.length) {
      return { ok: false, error: `WritePrinter only wrote ${written[0]} of ${bytes.length} bytes` }
    }

    EndPagePrinter(handle)
    EndDocPrinter(handle)
    return { ok: true }
  } finally {
    // Always release the handle, even on a mid-job failure, so no job is left open.
    ClosePrinter(handle)
  }
}

interface PrintMessage { id: number; printerName: string; data: string }

port.on('message', (msg: PrintMessage) => {
  let result: SendResult
  try {
    // ZPL is ASCII; utf-8 preserves the original byte stream the old path produced.
    result = sendRaw(msg.printerName, Buffer.from(msg.data, 'utf-8'))
  } catch (err) {
    result = { ok: false, error: String(err) }
  }
  port.postMessage({ id: msg.id, ...result })
})
