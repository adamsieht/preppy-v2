export const IPC = {
  PRINTER_PRINT:      'printer:print',
  PRINTER_PREVIEW:    'printer:preview',
  PRINTER_HISTORY:    'printer:history',
  PRINTER_SCAN:           'printer:scan',
  PRINTER_SET_DEVICE:     'printer:set-device',
  PRINTER_TEST:           'printer:test',
  PRINTER_SET_LABEL_HOME: 'printer:set-label-home',
  SENSOR_UPDATE: 'sensor:update',
  SENSOR_LIST: 'sensor:list',
  WIFI_SAVE: 'wifi:save',
  WIFI_GET: 'wifi:get',
  WIFI_SCAN: 'wifi:scan',
  CONFIG_GET: 'config:get',
  LOGS_TAIL: 'logs:tail',
  REPORT_PRINTS: 'report:prints',
  REPORT_POPULARITY: 'report:popularity',
  REPORT_TEMPS: 'report:temps',
  DEBUG_INFO: 'debug:info',
  DEBUG_SEND_ZPL: 'debug:send-zpl',
} as const

export type IpcChannel = typeof IPC[keyof typeof IPC]
