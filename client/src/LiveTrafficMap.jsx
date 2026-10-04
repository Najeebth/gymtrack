import React, { useState, useEffect, useRef } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'https://gymtrack-prdf.onrender.com';

// All available API endpoints on this server
const ENDPOINTS = [
  {
    method: 'GET',
    path: '/api/health',
    description: 'Server health check — uptime, memory, DB status',
    body: null,
  },
  {
    method: 'GET',
    path: '/api/workouts',
    description: 'Fetch all workout entries from PostgreSQL',
    body: null,
  },
  {
    method: 'POST',
    path: '/api/workouts',
    description: 'Create a new workout entry in PostgreSQL',
    body: {
      date: new Date().toISOString().split('T')[0],
      muscleGroup: 'Chest',
      exercise: 'Test Bench Press',
      sets: 3,
      reps: 10,
      weightKg: 80,
      notes: 'From Request Map tester'
    },
  },
  {
    method: 'GET',
    path: '/api/traffic',
    description: 'Last 50 HTTP requests logged by the telemetry middleware',
    body: null,
  },
  {
    method: 'GET',
    path: '/api/traces/list',
    description: 'All request traces currently in memory',
    body: null,
  },
];

const METHOD_COLORS = {
  GET:    { bg: '#0369a1', text: '#e0f2fe' },
  POST:   { bg: '#166534', text: '#dcfce7' },
  DELETE: { bg: '#991b1b', text: '#fee2e2' },
};

function Mermaid({ chart }) {
  const container = useRef(null);

  useEffect(() => {
    function render() {
      if (!window.mermaid) return;
      window.mermaid.initialize({ startOnLoad: false, theme: 'dark' });
      const id = `mermaid-${Date.now()}`;
      window.mermaid.render(id, chart)
        .then(({ svg }) => {
          if (container.current) container.current.innerHTML = svg;
        })
        .catch(err => {
          if (container.current) container.current.innerHTML = `<p style="color:#f87171;font-size:0.8rem;">Chart error: ${err.message}</p>`;
        });
    }

    if (!window.mermaid) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js';
      script.onload = render;
      document.body.appendChild(script);
    } else {
      render();
    }
  }, [chart]);

  return <div ref={container} className="overflow-auto" />;
}

function TraceDetail({ traceId }) {
  const [trace, setTrace] = useState(null);

  useEffect(() => {
    if (!traceId) return;
    setTrace(null);

    const es = new EventSource(`${API_BASE}/api/traces/stream/${traceId}`);
    es.onmessage = (e) => setTrace(JSON.parse(e.data));
    es.onerror = () => es.close();

    return () => es.close();
  }, [traceId]);

  if (!trace) return <p style={{ color: '#94a3b8', padding: 24 }}>Waiting for trace data…</p>;

  const fmt = (n) => typeof n === 'number' ? n.toFixed(2) : '-';
  const sanitize = (str) => str.replace(/"/g, "'").replace(/[<>{}|]/g, '');

  const stepLines = trace.steps.map((s, i) => {
    const cpu = s.cpuEnd && s.cpuStart ? (s.cpuEnd.user - s.cpuStart.user).toLocaleString() : '?';
    const ram = s.memEnd && s.memStart ? ((s.memEnd.rss - s.memStart.rss) >> 10).toLocaleString() : '?';
    const dur = s.durationMs ? fmt(s.durationMs) + ' ms' : '...';
    const label = `${i + 1}. ${sanitize(s.name)}<br/>Duration: ${dur}<br/>CPU: ${cpu} us<br/>RAM: ${ram} KB`;
    return `    step${i}["${label}"]`;
  }).join('\n');

  const arrowLines = trace.steps.map((_, i) =>
    `    ${i === 0 ? 'start' : `step${i - 1}`} --> step${i}`
  ).join('\n');

  const chart = [
    'flowchart TD',
    '    start(["Request received"])',
    stepLines,
    arrowLines,
    `    step${trace.steps.length - 1} --> finish(["Response sent"])`,
  ].join('\n');

  return (
    <div style={{ padding: 20 }}>
      <p style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#64748b', marginBottom: 16 }}>
        Trace ID: {trace.id}
      </p>

      {/* Mermaid flowchart */}
      <div style={{ background: '#0f172a', borderRadius: 10, padding: 16, marginBottom: 20, border: '1px solid #1e293b' }}>
        <Mermaid chart={chart} />
      </div>

      {/* Step table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', color: '#cbd5e1' }}>
        <thead>
          <tr style={{ background: '#1e293b', borderBottom: '1px solid #334155' }}>
            <th style={{ padding: '8px 12px', textAlign: 'left' }}>Step</th>
            <th style={{ padding: '8px 12px', textAlign: 'right' }}>Duration</th>
            <th style={{ padding: '8px 12px', textAlign: 'right' }}>CPU Δ (µs)</th>
            <th style={{ padding: '8px 12px', textAlign: 'right' }}>RAM Δ (KB)</th>
          </tr>
        </thead>
        <tbody>
          {trace.steps.map((s, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #1e293b' }}>
              <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>{s.name}</td>
              <td style={{ padding: '8px 12px', textAlign: 'right', color: s.durationMs > 100 ? '#fbbf24' : '#4ade80' }}>
                {s.durationMs ? fmt(s.durationMs) + ' ms' : '-'}
              </td>
              <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                {s.cpuEnd && s.cpuStart ? (s.cpuEnd.user - s.cpuStart.user).toLocaleString() : '-'}
              </td>
              <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                {s.memEnd && s.memStart ? ((s.memEnd.rss - s.memStart.rss) >> 10).toLocaleString() : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function LiveTrafficMap() {
  const [activeTraceId, setActiveTraceId] = useState(null);
  const [callResult, setCallResult]       = useState(null); // { status, body }
  const [calling, setCalling]             = useState(false);

  const callEndpoint = async (endpoint) => {
    setCalling(true);
    setCallResult(null);
    setActiveTraceId(null);

    try {
      const options = {
        method: endpoint.method,
        headers: { 'Content-Type': 'application/json' },
      };
      if (endpoint.body) options.body = JSON.stringify(endpoint.body);

      const res = await fetch(`${API_BASE}${endpoint.path}`, options);
      const traceId = res.headers.get('X-Trace-Id');
      const body = await res.json();

      setCallResult({ status: res.status, body });
      if (traceId) setActiveTraceId(traceId);
    } catch (err) {
      setCallResult({ status: 'Error', body: { error: err.message } });
    } finally {
      setCalling(false);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: 600, border: '1px solid #1e293b', borderRadius: 12, overflow: 'hidden', background: '#0a0f1e' }}>

      {/* LEFT — Endpoint list */}
      <div style={{ width: 280, borderRight: '1px solid #1e293b', overflowY: 'auto', background: '#0f172a' }}>
        <div style={{ padding: '14px 16px', background: '#1e293b', borderBottom: '1px solid #334155' }}>
          <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f1f5f9', margin: 0 }}>
            🛰 API Endpoints
          </h2>
          <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 4, marginBottom: 0 }}>
            Click an endpoint to call it live
          </p>
        </div>

        {ENDPOINTS.map((ep, i) => {
          const colors = METHOD_COLORS[ep.method] || { bg: '#334155', text: '#f1f5f9' };
          return (
            <button
              key={i}
              onClick={() => callEndpoint(ep)}
              disabled={calling}
              style={{
                width: '100%',
                textAlign: 'left',
                background: 'transparent',
                border: 'none',
                borderBottom: '1px solid #1e293b',
                padding: '12px 16px',
                cursor: calling ? 'not-allowed' : 'pointer',
                opacity: calling ? 0.5 : 1,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{
                  fontSize: '0.65rem', fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                  background: colors.bg, color: colors.text, fontFamily: 'monospace'
                }}>
                  {ep.method}
                </span>
                <span style={{ fontSize: '0.8rem', fontFamily: 'monospace', color: '#94a3b8' }}>
                  {ep.path}
                </span>
              </div>
              <p style={{ fontSize: '0.72rem', color: '#475569', margin: 0, lineHeight: 1.4 }}>
                {ep.description}
              </p>
            </button>
          );
        })}
      </div>

      {/* RIGHT — Trace + response */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {calling && (
          <div style={{ padding: 24, color: '#94a3b8', fontFamily: 'monospace', fontSize: '0.85rem' }}>
            ⏳ Calling API…
          </div>
        )}

        {!calling && !activeTraceId && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#334155', fontSize: '0.9rem', textAlign: 'center', padding: 32 }}>
            ← Pick an endpoint to fire a live request and see its execution trace
          </div>
        )}

        {callResult && (
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e293b', background: '#0f172a' }}>
            <span style={{
              fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4, marginRight: 8,
              background: callResult.status < 400 ? '#166534' : '#991b1b',
              color: callResult.status < 400 ? '#dcfce7' : '#fee2e2'
            }}>
              {callResult.status}
            </span>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Response preview</span>
            <pre style={{
              marginTop: 10, fontSize: '0.75rem', color: '#94a3b8',
              background: '#020617', padding: 12, borderRadius: 8,
              maxHeight: 150, overflow: 'auto', fontFamily: 'monospace'
            }}>
              {JSON.stringify(callResult.body, null, 2)}
            </pre>
          </div>
        )}

        {activeTraceId && <TraceDetail traceId={activeTraceId} />}
      </div>
    </div>
  );
}
