import log from 'electron-log/main'
import path from 'path'
import { app } from 'electron'

log.transports.file.level = 'debug'
log.transports.file.maxSize = 10 * 1024 * 1024
log.transports.file.archiveLog = true
log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}'
log.transports.file.resolvePathFn = () =>
  path.join(app.getPath('userData'), 'logs', `preppy-${new Date().toISOString().slice(0, 10)}.log`)

log.transports.console.level = process.env.NODE_ENV === 'development' ? 'debug' : false

export const logInfo = (...params: unknown[]): void => log.info(...params)
export const logWarn = (...params: unknown[]): void => log.warn(...params)
export const logError = (...params: unknown[]): void => log.error(...params)
export const logDebug = (...params: unknown[]): void => log.debug(...params)

export default log
