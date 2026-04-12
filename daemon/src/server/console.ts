/**
 * JetDesk Web Console — Single-page management dashboard.
 *
 * Rendered as a single HTML template string with embedded CSS & JS.
 * React 18 + Babel standalone loaded from CDN — zero build tooling required.
 */

import os from 'os';
import { getLocalIp } from '../security/tls.js';
import { config } from '../config/index.js';

export function renderConsole(): string {
  const hostname = os.hostname();
  const ip       = getLocalIp();
  const httpPort = config.get('httpPort');
  const wsPort   = config.get('wsPort');
  const version  = config.get('daemonVersion');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>JetDesk Console — ${hostname}</title>
  <meta name="description" content="JetDesk daemon management console">

  <!-- React 18 + Babel standalone (JSX in-browser) -->
  <script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" crossorigin></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js" crossorigin></script>

  <style>
    /* ── Reset ──────────────────────────────────────────────── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    /* ── Tokens ─────────────────────────────────────────────── */
    :root {
      --bg:           #171717;
      --bg-deep:      #0f0f0f;
      --surface:      #1c1c1c;
      --border-sub:   #242424;
      --border:       #2e2e2e;
      --border-hi:    #363636;
      --border-max:   #393939;
      --text:         #fafafa;
      --text-2:       #b4b4b4;
      --text-3:       #898989;
      --text-dim:     #4d4d4d;
      --green:        #3ecf8e;
      --green-link:   #00c573;
      --green-border: rgba(62,207,142,0.3);
      --green-dim:    rgba(62,207,142,0.08);
      --red:          #e5484d;
      --red-dim:      rgba(229,72,77,0.12);
      --yellow:       #f5a623;
      --radius-sm:    6px;
      --radius-md:    8px;
      --radius-lg:    12px;
      --radius-xl:    16px;
      --radius-pill:  9999px;
      --mono:         'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
    }

    /* ── Base ───────────────────────────────────────────────── */
    html { font-size: 16px; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
      min-height: 100vh;
      -webkit-font-smoothing: antialiased;
    }
    a { color: var(--green-link); text-decoration: none; }
    a:hover { text-decoration: underline; }

    /* ── Layout ─────────────────────────────────────────────── */
    .sidebar {
      width: 240px; min-height: 100vh;
      background: var(--bg-deep);
      border-right: 1px solid var(--border);
      display: flex; flex-direction: column;
      position: fixed; top: 0; left: 0; bottom: 0; z-index: 10;
    }
    .main { margin-left: 240px; min-height: 100vh; padding: 40px 48px; }
    .main-inner { max-width: 960px; }

    /* ── Sidebar ────────────────────────────────────────────── */
    .sidebar-brand { padding: 24px 20px 20px; border-bottom: 1px solid var(--border); }
    .sidebar-brand h1 {
      font-size: 18px; font-weight: 500; color: var(--text);
      display: flex; align-items: center; gap: 10px; line-height: 1;
    }
    .brand-dot {
      width: 10px; height: 10px; border-radius: 50%;
      background: var(--green); box-shadow: 0 0 8px rgba(62,207,142,0.4);
      flex-shrink: 0; display: inline-block;
    }
    .sidebar-meta { font-size: 12px; color: var(--text-3); margin-top: 6px; font-family: var(--mono); letter-spacing: 0.3px; }
    .sidebar-nav { padding: 12px 8px; flex: 1; display: flex; flex-direction: column; gap: 2px; }
    .nav-item {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 12px; border-radius: var(--radius-sm);
      color: var(--text-3); font-size: 14px; font-weight: 400;
      cursor: pointer; transition: all 0.15s;
      border: 1px solid transparent; user-select: none;
    }
    .nav-item:hover { background: var(--surface); color: var(--text-2); }
    .nav-item.active { background: var(--surface); border-color: var(--border); color: var(--text); font-weight: 500; }
    .nav-item svg { width: 16px; height: 16px; opacity: 0.6; flex-shrink: 0; }
    .nav-item.active svg { opacity: 1; }
    .sidebar-footer {
      padding: 16px 20px; border-top: 1px solid var(--border);
      font-size: 12px; color: var(--text-dim); font-family: var(--mono);
      letter-spacing: 1.2px; text-transform: uppercase;
    }

    /* ── Page header ────────────────────────────────────────── */
    .page-header { margin-bottom: 32px; }
    .page-header h2 { font-size: 24px; font-weight: 400; letter-spacing: -0.16px; color: var(--text); line-height: 1.33; }
    .page-header p  { color: var(--text-3); font-size: 14px; margin-top: 4px; }

    /* ── Stat grid ──────────────────────────────────────────── */
    .stat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px,1fr)); gap: 12px; margin-bottom: 32px; }
    .stat-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 20px; }
    .stat-label { font-size: 12px; color: var(--text-3); text-transform: uppercase; letter-spacing: 1.2px; font-family: var(--mono); margin-bottom: 8px; }
    .stat-value { font-size: 24px; font-weight: 400; color: var(--text); line-height: 1; }
    .stat-value.green { color: var(--green); }
    .stat-value.mono  { font-family: var(--mono); font-size: 18px; }

    /* ── Code label ─────────────────────────────────────────── */
    .code-label { font-family: var(--mono); font-size: 12px; letter-spacing: 1.2px; text-transform: uppercase; color: var(--text-3); margin-bottom: 12px; }

    /* ── Table ──────────────────────────────────────────────── */
    .table-wrap { border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; }
    table { width: 100%; border-collapse: collapse; }
    thead th {
      background: var(--bg-deep); font-size: 12px; font-weight: 500; color: var(--text-3);
      text-transform: uppercase; letter-spacing: 1.2px; font-family: var(--mono);
      padding: 12px 16px; text-align: left; border-bottom: 1px solid var(--border);
    }
    tbody td { padding: 14px 16px; font-size: 14px; color: var(--text-2); border-bottom: 1px solid var(--border-sub); }
    tbody tr:last-child td { border-bottom: none; }
    tbody tr:hover { background: var(--surface); }
    .td-mono { font-family: var(--mono); font-size: 13px; color: var(--text-3); }
    .empty-cell { text-align: center; padding: 48px 24px; color: var(--text-dim); font-size: 14px; }

    /* ── Buttons ────────────────────────────────────────────── */
    .btn {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 8px 24px; font-size: 14px; font-weight: 500;
      border: 1px solid var(--border-hi); border-radius: var(--radius-pill);
      background: var(--bg-deep); color: var(--text);
      cursor: pointer; transition: all 0.15s; line-height: 1.14; font-family: inherit;
    }
    .btn:hover { border-color: var(--border-max); background: var(--surface); }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-primary { background: var(--green); color: var(--bg-deep); border-color: var(--green); }
    .btn-primary:hover { background: var(--green-link); border-color: var(--green-link); }
    .btn-danger  { color: var(--red); border-color: rgba(229,72,77,0.3); }
    .btn-danger:hover  { background: var(--red-dim); border-color: var(--red); }
    .btn-sm { padding: 6px 14px; font-size: 13px; }

    /* ── Badge ──────────────────────────────────────────────── */
    .badge { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: var(--radius-pill); font-size: 12px; font-weight: 500; }
    .badge-green { background: var(--green-dim); border: 1px solid var(--green-border); color: var(--green); }
    .badge-dot   { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }

    /* ── QR / pairing ───────────────────────────────────────── */
    .qr-container { display: flex; gap: 40px; align-items: flex-start; flex-wrap: wrap; }
    .qr-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-xl); padding: 32px; text-align: center; min-width: 280px; }
    .qr-card img { border-radius: var(--radius-md); background: #fff; padding: 12px; margin-bottom: 20px; display: block; }
    .pin-display {
      font-size: 36px; font-weight: 400; letter-spacing: 0.3em; color: var(--green);
      background: var(--green-dim); border: 1px solid var(--green-border); border-radius: var(--radius-md);
      padding: 12px 24px; display: inline-block; margin-bottom: 12px; font-family: var(--mono);
    }
    .pin-timer  { font-size: 14px; margin-top: 8px; }
    .qr-instructions h3 { font-size: 18px; font-weight: 400; color: var(--text); margin-bottom: 16px; }
    .step-list  { list-style: none; padding: 0; }
    .step-list li { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 16px; font-size: 14px; color: var(--text-2); line-height: 1.5; }
    .step-num { display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 50%; background: var(--surface); border: 1px solid var(--border); font-size: 12px; font-weight: 500; color: var(--text-3); flex-shrink: 0; margin-top: 1px; }

    /* ── Settings ───────────────────────────────────────────── */
    .settings-grid { display: grid; gap: 20px; max-width: 520px; }
    .form-group { display: flex; flex-direction: column; gap: 6px; }
    .form-group label { font-size: 14px; font-weight: 500; color: var(--text-2); }
    .form-hint { font-size: 12px; color: var(--text-dim); }
    .form-input {
      background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm);
      padding: 10px 14px; font-size: 14px; color: var(--text); outline: none;
      transition: border-color 0.15s; font-family: inherit; width: 100%;
    }
    .form-input:focus { border-color: var(--green-border); }
    .form-input[type="number"] { font-family: var(--mono); width: 120px; }
    select.form-input {
      cursor: pointer; appearance: none; padding-right: 32px;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%23898989' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10z'/%3E%3C/svg%3E");
      background-repeat: no-repeat; background-position: right 12px center;
    }
    .toggle-row { display: flex; align-items: center; justify-content: space-between; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 16px; }
    .toggle-switch { width: 44px; height: 24px; border-radius: 12px; background: var(--border-hi); position: relative; cursor: pointer; transition: background 0.2s; border: none; outline: none; flex-shrink: 0; }
    .toggle-switch.on { background: var(--green); }
    .toggle-switch::after { content: ''; position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: var(--text); transition: transform 0.2s; }
    .toggle-switch.on::after { transform: translateX(20px); }
    .settings-saved { font-size: 13px; color: var(--green); opacity: 0; transition: opacity 0.3s; }
    .settings-saved.show { opacity: 1; }

    /* ── Logs ───────────────────────────────────────────────── */
    .log-container { background: var(--bg-deep); border: 1px solid var(--border); border-radius: var(--radius-lg); max-height: 560px; overflow-y: auto; font-family: var(--mono); font-size: 13px; line-height: 1.6; }
    .log-entry { padding: 4px 16px; border-bottom: 1px solid var(--border-sub); display: flex; gap: 12px; }
    .log-entry:last-child { border-bottom: none; }
    .log-ts    { color: var(--text-dim); flex-shrink: 0; width: 80px; }
    .log-level { flex-shrink: 0; width: 48px; font-weight: 500; }
    .log-level.info  { color: var(--green); }
    .log-level.warn  { color: var(--yellow); }
    .log-level.error { color: var(--red); }
    .log-msg   { color: var(--text-2); word-break: break-all; }
    .log-toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    .log-count  { font-size: 13px; color: var(--text-dim); }

    /* ── Toast ──────────────────────────────────────────────── */
    .toast { position: fixed; bottom: 24px; right: 24px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 12px 20px; font-size: 14px; color: var(--text-2); z-index: 100; opacity: 0; transform: translateY(8px); transition: all 0.3s; pointer-events: none; }
    .toast.show { opacity: 1; transform: translateY(0); }

    /* ── Responsive ─────────────────────────────────────────── */
    @media (max-width: 768px) {
      .sidebar { width: 200px; }
      .main { margin-left: 200px; padding: 24px 20px; }
      .stat-grid { grid-template-columns: 1fr 1fr; }
    }
    @media (max-width: 600px) {
      .sidebar { display: none; }
      .main { margin-left: 0; }
    }
  </style>
</head>
<body>
  <div id="root"></div>

  <!-- Server-injected runtime config -->
  <script>
    window.__DL__ = {
      hostname: ${JSON.stringify(hostname)},
      ip:       ${JSON.stringify(ip)},
      httpPort: ${JSON.stringify(httpPort)},
      wsPort:   ${JSON.stringify(wsPort)},
      version:  ${JSON.stringify(version)},
    };
  </script>

  <!-- ── App (Babel transpiles JSX in-browser) ──────────────── -->
  <script type="text/babel" data-presets="react">
    const { useState, useEffect, useRef, useCallback } = React;

    // ── Helpers ────────────────────────────────────────────────────────────
    function fmtUptime(ms) {
      const s = Math.floor(ms / 1000);
      if (s < 60)  return s + 's';
      const m = Math.floor(s / 60);
      if (m < 60)  return m + 'm ' + (s % 60) + 's';
      const h = Math.floor(m / 60);
      if (h < 24)  return h + 'h ' + (m % 60) + 'm';
      return Math.floor(h / 24) + 'd ' + (h % 24) + 'h';
    }
    function fmtAgo(ts) {
      if (!ts) return '—';
      const d = Date.now() - ts;
      if (d < 60000)    return 'just now';
      if (d < 3600000)  return Math.floor(d / 60000) + 'm ago';
      if (d < 86400000) return Math.floor(d / 3600000) + 'h ago';
      return Math.floor(d / 86400000) + 'd ago';
    }
    function fmtDate(ts) {
      if (!ts) return '—';
      return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    }
    function truncId(id) {
      if (!id || id.length <= 16) return id || '—';
      return id.slice(0, 8) + '…' + id.slice(-6);
    }
    async function api(path, opts = {}) {
      try {
        const res = await fetch('/api' + path, { headers: { 'Content-Type': 'application/json' }, ...opts });
        return await res.json();
      } catch { return null; }
    }

    // ── Shared primitives ─────────────────────────────────────────────────

    function PageHeader({ title, sub }) {
      return (
        <div className="page-header">
          <h2>{title}</h2>
          <p>{sub}</p>
        </div>
      );
    }

    function StatCard({ label, value, mono, green }) {
      return (
        <div className="stat-card">
          <div className="stat-label">{label}</div>
          <div className={\`stat-value\${green ? ' green' : ''}\${mono ? ' mono' : ''}\`}>{value}</div>
        </div>
      );
    }

    function Badge({ children }) {
      return (
        <span className="badge badge-green">
          <span className="badge-dot" />
          {children}
        </span>
      );
    }

    function Btn({ children, onClick, primary, danger, sm, disabled }) {
      const cls = ['btn', primary && 'btn-primary', danger && 'btn-danger', sm && 'btn-sm'].filter(Boolean).join(' ');
      return <button className={cls} onClick={onClick} disabled={disabled}>{children}</button>;
    }

    function EmptyRow({ cols, msg }) {
      return <tr><td colSpan={cols} className="empty-cell">{msg}</td></tr>;
    }

    function Toggle({ on, onToggle }) {
      return <button className={\`toggle-switch\${on ? ' on' : ''}\`} onClick={onToggle} />;
    }

    // ── Dashboard ─────────────────────────────────────────────────────────

    function DashboardPage() {
      const [status, setStatus] = useState(null);
      const [conns,  setConns]  = useState([]);

      const refresh = useCallback(async () => {
        const s = await api('/status');
        if (s) setStatus(s);
        const c = await api('/connections');
        setConns(c?.connections ?? []);
      }, []);

      useEffect(() => {
        refresh();
        const t = setInterval(refresh, 5000);
        return () => clearInterval(t);
      }, [refresh]);

      return (
        <>
          <PageHeader title="Dashboard" sub="Real-time daemon status overview" />

          <div className="stat-grid">
            <StatCard label="Status"             value="● Running"                       green />
            <StatCard label="Hostname"           value={status?.hostname   ?? window.__DL__.hostname} />
            <StatCard label="Local IP"           value={status?.localIp    ?? window.__DL__.ip}       mono />
            <StatCard label="Uptime"             value={status ? fmtUptime(status.uptime ?? 0) : '—'} />
            <StatCard label="Paired Devices"     value={status?.pairedDevices    ?? '—'} />
            <StatCard label="Active Connections" value={status?.activeConnections ?? '—'} />
            <StatCard label="TLS Port"           value={window.__DL__.wsPort}   mono />
            <StatCard label="HTTPS Port"         value={window.__DL__.httpPort} mono />
          </div>

          <div className="code-label">Active Connections</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Device</th><th>Remote IP</th><th>Auth State</th><th>Connected</th>
                </tr>
              </thead>
              <tbody>
                {conns.length === 0
                  ? <EmptyRow cols={4} msg="No active connections" />
                  : conns.map((c, i) => (
                    <tr key={i}>
                      <td>{c.deviceName || 'Unknown'}</td>
                      <td className="td-mono">{c.remoteIp}</td>
                      <td><Badge>{c.authState}</Badge></td>
                      <td>{fmtAgo(c.connectedAt)}</td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </>
      );
    }

    // ── Devices ───────────────────────────────────────────────────────────

    function DevicesPage({ onToast }) {
      const [devices, setDevices] = useState([]);

      const refresh = useCallback(async () => {
        const d = await api('/devices');
        setDevices(d?.devices ?? []);
      }, []);

      useEffect(() => { refresh(); }, [refresh]);

      async function remove(id) {
        if (!confirm('Remove this device? It will need to be re-paired.')) return;
        await api('/devices/' + encodeURIComponent(id), { method: 'DELETE' });
        onToast('Device removed');
        refresh();
      }

      return (
        <>
          <PageHeader title="Paired Devices" sub="Manage devices authorized to control this PC" />
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Device Name</th><th>Device ID</th><th>Paired</th><th>Last Seen</th><th style={{ width: 80 }}></th>
                </tr>
              </thead>
              <tbody>
                {devices.length === 0
                  ? <EmptyRow cols={5} msg="No paired devices. Go to Pairing to add one." />
                  : devices.map((d, i) => (
                    <tr key={i}>
                      <td style={{ color: 'var(--text)' }}>{d.deviceName || 'Unknown'}</td>
                      <td className="td-mono">{truncId(d.deviceId)}</td>
                      <td>{fmtDate(d.pairedAt)}</td>
                      <td>{fmtAgo(d.lastSeen)}</td>
                      <td><Btn sm danger onClick={() => remove(d.deviceId)}>Remove</Btn></td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </>
      );
    }

    // ── Pairing ───────────────────────────────────────────────────────────

    function PairingPage({ onToast }) {
      const [qrData,   setQrData]   = useState(null);
      const [loading,  setLoading]  = useState(false);
      const [secs,     setSecs]     = useState(0);
      const timerRef = useRef(null);

      async function generate() {
        setLoading(true);
        const data = await api('/pair/generate');
        setLoading(false);
        if (!data?.qr) { onToast('Failed to generate QR code'); return; }
        setQrData(data);
        clearInterval(timerRef.current);
        setSecs(300);
        timerRef.current = setInterval(() => {
          setSecs(s => { if (s <= 1) { clearInterval(timerRef.current); return 0; } return s - 1; });
        }, 1000);
      }

      useEffect(() => () => clearInterval(timerRef.current), []);

      const mm = Math.floor(secs / 60);
      const ss = String(secs % 60).padStart(2, '0');

      return (
        <>
          <PageHeader title="Pair New Device" sub="Scan the QR code with the JetDesk mobile app" />
          <div className="qr-container">

            <div className="qr-card">
              {qrData ? (
                <>
                  <img src={qrData.qr} width={220} height={220} alt="QR Code" />
                  <div className="pin-display">{qrData.pin.split('').join(' ')}</div>
                  <div className="pin-timer" style={{ color: secs === 0 ? 'var(--text-3)' : 'var(--red)' }}>
                    {secs === 0 ? 'Expired — click Regenerate' : \`Expires in \${mm}:\${ss}\`}
                  </div>
                </>
              ) : (
                <div style={{ color: 'var(--text-3)', padding: '40px 0' }}>
                  Click "Generate QR" to start
                </div>
              )}
            </div>

            <div className="qr-instructions">
              <h3>How to pair</h3>
              <ol className="step-list">
                {[
                  <span>Click <strong style={{ color: 'var(--green)' }}>Generate QR Code</strong> below</span>,
                  <span>Open the <strong>JetDesk</strong> app on your phone</span>,
                  <span>Tap <strong>Scan QR Code</strong> on the home screen</span>,
                  <span>Point your phone camera at the QR code</span>,
                  <span>If prompted, enter the <strong>6-digit PIN</strong> shown below the QR code</span>,
                ].map((step, i) => (
                  <li key={i}>
                    <span className="step-num">{i + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>
              <Btn primary onClick={generate} disabled={loading}>
                {loading ? 'Generating…' : qrData ? 'Regenerate QR Code' : 'Generate QR Code'}
              </Btn>
            </div>
          </div>
        </>
      );
    }

    // ── Settings ──────────────────────────────────────────────────────────

    function SettingsPage({ onToast }) {
      const [cfg,   setCfg]   = useState({ fps: 15, quality: 60, scale: 0.5, logLevel: 'info', shellCmds: '', autostart: false, allowCustom: true });
      const [saved, setSaved] = useState(false);

      useEffect(() => {
        api('/config').then(d => {
          if (!d) return;
          setCfg({
            fps:       d.screenCaptureFps      ?? 15,
            quality:   d.screenCaptureQuality  ?? 60,
            scale:     d.screenCaptureScale    ?? 0.5,
            logLevel:  d.logLevel              ?? 'info',
            shellCmds: (d.allowedShellCommands ?? []).join('\\n'),
            autostart: d.autoStartOnBoot       ?? false,
            allowCustom: d.allowCustomShellCommands ?? true,
          });
        });
      }, []);

      const set = key => e => setCfg(p => ({ ...p, [key]: e.target.value }));

      async function save() {
        await api('/config', {
          method: 'PATCH',
          body: JSON.stringify({
            screenCaptureFps:      parseInt(cfg.fps)     || 15,
            screenCaptureQuality:  parseInt(cfg.quality) || 60,
            screenCaptureScale:    parseFloat(cfg.scale) || 0.5,
            logLevel:              cfg.logLevel,
            autoStartOnBoot:       cfg.autostart,
            allowCustomShellCommands: cfg.allowCustom,
            allowedShellCommands:  cfg.shellCmds.split('\\n').map(l => l.trim()).filter(Boolean),
          }),
        });
        setSaved(true);
        onToast('Settings saved');
        setTimeout(() => setSaved(false), 2000);
      }

      return (
        <>
          <PageHeader title="Settings" sub="Configuration for screen capture and daemon behavior" />
          <div className="settings-grid">

            <div className="form-group">
              <label>Screen Capture FPS</label>
              <input type="number" className="form-input" value={cfg.fps} min={1} max={30} onChange={set('fps')} />
              <span className="form-hint">Frames per second for screen streaming (1–30)</span>
            </div>

            <div className="form-group">
              <label>Screen Capture Quality</label>
              <input type="number" className="form-input" value={cfg.quality} min={10} max={100} onChange={set('quality')} />
              <span className="form-hint">JPEG quality for screen capture (10–100)</span>
            </div>

            <div className="form-group">
              <label>Screen Capture Scale</label>
              <input type="number" className="form-input" value={cfg.scale} min={0.1} max={1.0} step={0.1} onChange={set('scale')} />
              <span className="form-hint">Resolution scale factor (0.1–1.0)</span>
            </div>

            <div className="form-group">
              <label>Log Level</label>
              <select className="form-input" value={cfg.logLevel} onChange={set('logLevel')}>
                {['debug', 'info', 'warn', 'error'].map(v => (
                  <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Allowed Terminal Commands</label>
              <textarea
                className="form-input"
                rows={4}
                style={{ fontFamily: 'var(--mono)', resize: 'vertical' }}
                value={cfg.shellCmds}
                onChange={set('shellCmds')}
              />
              <span className="form-hint">
                One command per line. If "Allow Custom Commands" is disabled, only these exact commands can be executed. Otherwise, they appear as "Quick Commands".
              </span>
            </div>

            <div className="toggle-row">
              <div>
                <div style={{ fontSize: 14, color: 'var(--text-2)' }}>Auto-start on Windows login</div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>
                  Start JetDesk daemon automatically when you sign in
                </div>
              </div>
              <Toggle on={cfg.autostart} onToggle={() => setCfg(p => ({ ...p, autostart: !p.autostart }))} />
            </div>

            <div className="toggle-row">
              <div>
                <div style={{ fontSize: 14, color: 'var(--text-2)' }}>Allow Custom Commands</div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>
                  Allow executing any terminal command, not just the allowlist.
                </div>
              </div>
              <Toggle on={cfg.allowCustom} onToggle={() => setCfg(p => ({ ...p, allowCustom: !p.allowCustom }))} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
              <Btn primary onClick={save}>Save Settings</Btn>
              <span className={\`settings-saved\${saved ? ' show' : ''}\`}>✓ Saved</span>
            </div>

          </div>
        </>
      );
    }

    // ── Logs ──────────────────────────────────────────────────────────────

    function LogsPage() {
      const [logs, setLogs] = useState([]);
      const containerRef = useRef(null);

      const refresh = useCallback(async () => {
        const d = await api('/logs');
        if (d?.logs) {
          setLogs(d.logs);
          setTimeout(() => {
            if (containerRef.current)
              containerRef.current.scrollTop = containerRef.current.scrollHeight;
          }, 50);
        }
      }, []);

      useEffect(() => { refresh(); }, [refresh]);

      const levelColor = { info: 'var(--green)', warn: 'var(--yellow)', error: 'var(--red)' };

      return (
        <>
          <PageHeader title="Logs" sub="Recent daemon output" />
          <div className="log-toolbar">
            <span className="log-count">{logs.length} entries</span>
            <Btn sm onClick={refresh}>Refresh</Btn>
          </div>
          <div className="log-container" ref={containerRef}>
            {logs.length === 0
              ? <div className="empty-cell">No logs yet</div>
              : logs.map((l, i) => {
                  const ts = new Date(l.ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                  return (
                    <div key={i} className="log-entry">
                      <span className="log-ts">{ts}</span>
                      <span className={\`log-level \${l.level}\`}>{l.level}</span>
                      <span className="log-msg">{l.message}</span>
                    </div>
                  );
                })
            }
          </div>
        </>
      );
    }

    // ── Nav icons ─────────────────────────────────────────────────────────

    const ICONS = {
      dashboard: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <rect x={3}  y={3}  width={7} height={7} rx={1}/>
          <rect x={14} y={3}  width={7} height={7} rx={1}/>
          <rect x={3}  y={14} width={7} height={7} rx={1}/>
          <rect x={14} y={14} width={7} height={7} rx={1}/>
        </svg>
      ),
      devices: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <rect x={2} y={3} width={20} height={14} rx={2}/>
          <line x1={8} y1={21} x2={16} y2={21}/>
          <line x1={12} y1={17} x2={12} y2={21}/>
        </svg>
      ),
      pairing: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <rect x={3} y={3} width={18} height={18} rx={2}/>
          <path d="M7 7h3v3H7zM14 7h3v3h-3zM7 14h3v3H7z"/>
          <rect x={14} y={14} width={3} height={3} fill="currentColor" opacity={0.5}/>
        </svg>
      ),
      settings: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <circle cx={12} cy={12} r={3}/>
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
        </svg>
      ),
      logs: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
      ),
    };

    const PAGES = [
      { id: 'dashboard', label: 'Dashboard' },
      { id: 'devices',   label: 'Devices'   },
      { id: 'pairing',   label: 'Pairing'   },
      { id: 'settings',  label: 'Settings'  },
      { id: 'logs',      label: 'Logs'      },
    ];

    // ── App root ──────────────────────────────────────────────────────────

    function App() {
      const [page,  setPage]  = useState('dashboard');
      const [toast, setToast] = useState({ msg: '', show: false });
      const toastTimer = useRef(null);

      function showToast(msg) {
        clearTimeout(toastTimer.current);
        setToast({ msg, show: true });
        toastTimer.current = setTimeout(() => setToast(t => ({ ...t, show: false })), 2500);
      }

      const { hostname, version } = window.__DL__;

      return (
        <>
          {/* Sidebar */}
          <aside className="sidebar">
            <div className="sidebar-brand">
              <h1><span className="brand-dot" />JetDesk</h1>
              <div className="sidebar-meta">{hostname}</div>
            </div>
            <nav className="sidebar-nav">
              {PAGES.map(p => (
                <div
                  key={p.id}
                  className={\`nav-item\${page === p.id ? ' active' : ''}\`}
                  onClick={() => setPage(p.id)}
                >
                  {ICONS[p.id]}
                  {p.label}
                </div>
              ))}
            </nav>
            <div className="sidebar-footer">v{version}</div>
          </aside>

          {/* Main */}
          <div className="main">
            <div className="main-inner">
              {page === 'dashboard' && <DashboardPage />}
              {page === 'devices'   && <DevicesPage   onToast={showToast} />}
              {page === 'pairing'   && <PairingPage   onToast={showToast} />}
              {page === 'settings'  && <SettingsPage  onToast={showToast} />}
              {page === 'logs'      && <LogsPage />}
            </div>
          </div>

          {/* Toast */}
          <div className={\`toast\${toast.show ? ' show' : ''}\`}>{toast.msg}</div>
        </>
      );
    }

    // ── Mount ─────────────────────────────────────────────────────────────
    ReactDOM.createRoot(document.getElementById('root')).render(<App />);
  </script>
</body>
</html>`;
}