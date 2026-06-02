import { Database } from 'node-sqlite3-wasm'
import path from 'path'
import { app } from 'electron'

export interface Sensor {
  mac: string
  last_update: string
  temperature: number
  humidity: number
  battery: number
}

export interface SensorLog {
  mac: string
  time: string
  temperature: number
  humidity: number
  battery: number
}

export interface PrintJob {
  id?: number
  template: string
  duration_hrs: number
  qty: number
  printed_at: string
  success: number
  error_msg: string | null
}

export interface Alert {
  id?: number
  variant: string
  icon: string
  msg: string
  priority: number
  created_at: string
}

export interface WifiCredentials {
  ssid: string
  pass: string
}

let _db: Database | null = null

export function getDb(): Database {
  if (_db) return _db
  const dbPath = path.join(app.getPath('userData'), 'preppy.db')
  _db = new Database(dbPath)
  _db.exec('PRAGMA journal_mode = WAL')
  initSchema(_db)
  return _db
}

function initSchema(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sensors (
      mac TEXT PRIMARY KEY,
      last_update TEXT NOT NULL,
      temperature REAL NOT NULL,
      humidity REAL NOT NULL,
      battery REAL NOT NULL
    );
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mac TEXT NOT NULL,
      time TEXT NOT NULL,
      temperature REAL NOT NULL,
      humidity REAL NOT NULL,
      battery REAL NOT NULL
    );
    CREATE TABLE IF NOT EXISTS print_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template TEXT NOT NULL,
      duration_hrs REAL NOT NULL,
      qty INTEGER NOT NULL,
      printed_at TEXT NOT NULL,
      success INTEGER NOT NULL,
      error_msg TEXT
    );
    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      variant TEXT NOT NULL,
      icon TEXT NOT NULL,
      msg TEXT NOT NULL,
      priority INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS wifi (
      id INTEGER PRIMARY KEY,
      ssid TEXT NOT NULL,
      pass TEXT NOT NULL
    );
  `)
}

export function getSensors(): Sensor[] {
  return getDb().all('SELECT * FROM sensors') as Sensor[]
}

export function upsertSensor(sensor: Sensor): void {
  getDb().run(
    `INSERT INTO sensors (mac, last_update, temperature, humidity, battery)
     VALUES (@mac, @last_update, @temperature, @humidity, @battery)
     ON CONFLICT(mac) DO UPDATE SET
       last_update = excluded.last_update,
       temperature = excluded.temperature,
       humidity = excluded.humidity,
       battery = excluded.battery`,
    { '@mac': sensor.mac, '@last_update': sensor.last_update, '@temperature': sensor.temperature, '@humidity': sensor.humidity, '@battery': sensor.battery }
  )
}

export function insertLog(log: SensorLog): void {
  getDb().run(
    `INSERT INTO logs (mac, time, temperature, humidity, battery)
     VALUES (@mac, @time, @temperature, @humidity, @battery)`,
    { '@mac': log.mac, '@time': log.time, '@temperature': log.temperature, '@humidity': log.humidity, '@battery': log.battery }
  )
}

export function getLogs(mac: string, limit = 200): SensorLog[] {
  return getDb().all(
    'SELECT * FROM logs WHERE mac = @mac ORDER BY time DESC LIMIT @limit',
    { '@mac': mac, '@limit': limit }
  ) as SensorLog[]
}

export function getAllLogs(limit = 200): SensorLog[] {
  return getDb().all(
    'SELECT * FROM logs ORDER BY time DESC LIMIT @limit',
    { '@limit': limit }
  ) as SensorLog[]
}

export function insertPrintJob(job: Omit<PrintJob, 'id'>): void {
  getDb().run(
    `INSERT INTO print_jobs (template, duration_hrs, qty, printed_at, success, error_msg)
     VALUES (@template, @duration_hrs, @qty, @printed_at, @success, @error_msg)`,
    { '@template': job.template, '@duration_hrs': job.duration_hrs, '@qty': job.qty, '@printed_at': job.printed_at, '@success': job.success, '@error_msg': job.error_msg }
  )
}

export function getPrintJobs(limit = 50, offset = 0): PrintJob[] {
  return getDb().all(
    'SELECT * FROM print_jobs ORDER BY printed_at DESC LIMIT @limit OFFSET @offset',
    { '@limit': limit, '@offset': offset }
  ) as PrintJob[]
}

export function getAlerts(): Alert[] {
  return getDb().all(
    'SELECT * FROM alerts ORDER BY priority ASC, created_at DESC'
  ) as Alert[]
}

export function getWifi(): WifiCredentials | null {
  return (getDb().get('SELECT ssid, pass FROM wifi WHERE id = 1') as WifiCredentials) ?? null
}

export function upsertWifi(ssid: string, pass: string): void {
  getDb().run(
    `INSERT INTO wifi (id, ssid, pass) VALUES (1, @ssid, @pass)
     ON CONFLICT(id) DO UPDATE SET ssid = excluded.ssid, pass = excluded.pass`,
    { '@ssid': ssid, '@pass': pass }
  )
}
