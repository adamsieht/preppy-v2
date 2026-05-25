import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Container, Row, Col, Button, Tab, Tabs,
  Badge, Alert, Form, Table, Spinner,
} from 'react-bootstrap'
import { useSelector, useDispatch } from 'react-redux'
import type { RootState } from '../../store'
import { setVerboseErrors } from '../../store/slices/devSettings.slice'

interface HardwareEntry { exists: boolean; writable: boolean }
interface DebugInfo {
  app: Record<string, unknown>
  runtime: Record<string, unknown>
  hardware: Record<string, HardwareEntry>
  database: Record<string, number>
  config: unknown
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 10,
        height: 10,
        borderRadius: '50%',
        background: ok ? '#28a745' : '#dc3545',
        marginRight: 6,
      }}
    />
  )
}

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre
      style={{
        background: '#1e1e1e',
        color: '#9cdcfe',
        padding: 12,
        borderRadius: 6,
        fontSize: '0.75rem',
        overflowX: 'auto',
        maxHeight: 380,
        overflowY: 'auto',
      }}
    >
      {JSON.stringify(value, null, 2)}
    </pre>
  )
}

export default function Debug() {
  const navigate = useNavigate()
  const [info, setInfo] = useState<DebugInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [rawZpl, setRawZpl] = useState('^XA\n^FO50,50^A0N,28,28^FDHELLO WORLD^FS\n^XZ')
  const [zplStatus, setZplStatus] = useState<{ ok: boolean; msg: string } | null>(null)
  const [sendingZpl, setSendingZpl] = useState(false)
  const reduxState = useSelector((state: RootState) => state)
  const verboseErrors = useSelector((s: RootState) => s.devSettings.verboseErrors)
  const dispatch = useDispatch()

  const refresh = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      if (!window.electronAPI?.getDebugInfo) {
        throw new Error('electronAPI not available — is this running inside Electron?')
      }
      const data = await window.electronAPI.getDebugInfo()
      setInfo(data as DebugInfo)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  async function handleSendZpl() {
    setSendingZpl(true)
    setZplStatus(null)
    try {
      const result = await window.electronAPI.sendRawZpl(rawZpl)
      setZplStatus(result.success ? { ok: true, msg: 'ZPL sent.' } : { ok: false, msg: result.error ?? 'Failed' })
    } catch (err) {
      setZplStatus({ ok: false, msg: err instanceof Error ? err.message : String(err) })
    } finally {
      setSendingZpl(false)
    }
  }

  return (
    <Container fluid className="p-4">
      <div className="d-flex align-items-center mb-4">
        <Button variant="outline-secondary" size="sm" onClick={() => navigate('/')} className="me-3">
          ← Back
        </Button>
        <h4 className="mb-0">Debug</h4>
        <Badge bg="danger" className="ms-3">Internal Tool</Badge>
        <div className="ms-auto d-flex align-items-center gap-3">
          <Form.Check
            type="switch"
            id="verbose-errors-toggle"
            label="Verbose errors"
            checked={verboseErrors}
            onChange={(e) => dispatch(setVerboseErrors(e.target.checked))}
            title="Show full error messages app-wide instead of generic fallbacks"
          />
          <Button variant="outline-secondary" size="sm" onClick={refresh} disabled={loading}>
            {loading ? <Spinner size="sm" /> : 'Refresh'}
          </Button>
        </div>
      </div>

      {loading && <div className="text-center py-5"><Spinner /> Loading…</div>}

      {!loading && loadError && (
        <Alert variant="danger">
          <strong>Failed to load debug info:</strong> {loadError}
        </Alert>
      )}

      {info && (
        <Tabs defaultActiveKey="system" className="mb-3">

          {/* ── System Info ── */}
          <Tab eventKey="system" title="System">
            <Row className="g-4">
              <Col xs={12} md={6}>
                <div className="fw-semibold mb-2">App</div>
                <Table size="sm" bordered>
                  <tbody>
                    {Object.entries(info.app).map(([k, v]) => (
                      <tr key={k}>
                        <td className="text-muted" style={{ width: '40%' }}>{k}</td>
                        <td><code>{String(v)}</code></td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Col>
              <Col xs={12} md={6}>
                <div className="fw-semibold mb-2">Runtime</div>
                <Table size="sm" bordered>
                  <tbody>
                    {Object.entries(info.runtime).map(([k, v]) => (
                      <tr key={k}>
                        <td className="text-muted" style={{ width: '40%' }}>{k}</td>
                        <td><code>{String(v)}</code></td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Col>
            </Row>
          </Tab>

          {/* ── Hardware ── */}
          <Tab eventKey="hardware" title="Hardware">
            <Table bordered hover size="sm">
              <thead className="table-light">
                <tr>
                  <th>Path / Device</th>
                  <th>Exists</th>
                  <th>Writable</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(info.hardware).map(([key, val]) => (
                  <tr key={key}>
                    <td><code>{key}</code></td>
                    <td>
                      <StatusDot ok={val.exists} />
                      {val.exists ? 'Yes' : 'No'}
                    </td>
                    <td>
                      <StatusDot ok={val.writable} />
                      {val.writable ? 'Yes' : 'No'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Tab>

          {/* ── Database ── */}
          <Tab eventKey="database" title="Database">
            <Table bordered size="sm" style={{ maxWidth: 400 }}>
              <thead className="table-light">
                <tr><th>Table</th><th>Row count</th></tr>
              </thead>
              <tbody>
                {Object.entries(info.database).map(([table, count]) => (
                  <tr key={table}>
                    <td><code>{table}</code></td>
                    <td>
                      <Badge bg={count < 0 ? 'danger' : 'secondary'}>
                        {count < 0 ? 'error' : count}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Tab>

          {/* ── Config ── */}
          <Tab eventKey="config" title="Config">
            <div className="text-muted small mb-2">
              Merged config (defaults + local overrides). Edit{' '}
              <code>userData/config.local.json</code> to override.
            </div>
            <JsonBlock value={info.config} />
          </Tab>

          {/* ── Redux State ── */}
          <Tab eventKey="redux" title="Redux State">
            <div className="text-muted small mb-2">
              Live snapshot of the Redux store.
            </div>
            <JsonBlock value={reduxState} />
          </Tab>

          {/* ── Raw ZPL Sender ── */}
          <Tab eventKey="zpl" title="Raw ZPL">
            <div className="text-muted small mb-3">
              Send arbitrary ZPL directly to the printer device. No validation — use carefully.
            </div>
            {zplStatus && (
              <Alert
                variant={zplStatus.ok ? 'success' : 'danger'}
                dismissible
                onClose={() => setZplStatus(null)}
              >
                {zplStatus.msg}
              </Alert>
            )}
            <Form.Control
              as="textarea"
              rows={10}
              value={rawZpl}
              onChange={(e) => setRawZpl(e.target.value)}
              style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
              spellCheck={false}
            />
            <div className="d-flex gap-2 mt-3">
              <Button
                variant="danger"
                disabled={sendingZpl || !rawZpl.trim()}
                onClick={handleSendZpl}
              >
                {sendingZpl ? <><Spinner size="sm" className="me-1" />Sending…</> : 'Send to Printer'}
              </Button>
              <Button
                variant="outline-secondary"
                onClick={() => setRawZpl('^XA\n^FO50,50^A0N,28,28^FDHELLO WORLD^FS\n^XZ')}
              >
                Reset to sample
              </Button>
            </div>
          </Tab>

        </Tabs>
      )}
    </Container>
  )
}
