import { useEffect } from 'react';
import { useAppData } from '../context/AppDataContext';

export default function TrafficPage() {
  const { trafficLogs, fetchTraffic } = useAppData();

  useEffect(() => {
    fetchTraffic();
    const interval = setInterval(fetchTraffic, 2500);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div className="bg-white p-4 rounded-xl border border-brand-border mb-4">
        <h2 className="text-base font-semibold text-brand-orange mb-1.5">How User Traffic Works Under the Hood</h2>
        <p className="text-sm text-brand-muted leading-relaxed">
          Every time you tap a button or load a page, the client browser emits an HTTP request through CORS
          middleware and route handlers to the Express server. The table below intercepts and inspects every live
          hit in real time.
        </p>
      </div>

      <div className="overflow-x-auto bg-white rounded-xl border border-brand-border">
        <table className="w-full border-collapse text-sm text-left">
          <thead>
            <tr className="bg-slate-50 border-b border-brand-border text-brand-muted">
              <th className="px-3 py-2.5">Method</th>
              <th className="px-3 py-2.5">Endpoint</th>
              <th className="px-3 py-2.5">Status</th>
              <th className="px-3 py-2.5">HTTP Latency</th>
              <th className="px-3 py-2.5">PostgreSQL Query</th>
              <th className="px-3 py-2.5">Time</th>
            </tr>
          </thead>
          <tbody>
            {trafficLogs.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center p-5 text-brand-muted">
                  No recent traffic logged. Perform actions on the workouts tab!
                </td>
              </tr>
            ) : (
              trafficLogs.map((log) => (
                <tr key={log.id} className="border-b border-brand-border">
                  <td className="px-3 py-2">
                    <span
                      className={`font-bold ${
                        log.method === 'POST'
                          ? 'text-emerald-400'
                          : log.method === 'DELETE'
                          ? 'text-red-400'
                          : 'text-brand-orange'
                      }`}
                    >
                      {log.method}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono">{log.url}</td>
                  <td className="px-3 py-2">
                    <span className={`font-semibold ${log.status < 400 ? 'text-green-400' : 'text-red-400'}`}>
                      {log.status}
                    </span>
                  </td>
                  <td className={`px-3 py-2 ${log.httpDurationMs > 50 ? 'text-amber-400' : 'text-slate-400'}`}>
                    {log.httpDurationMs} ms
                  </td>
                  <td className="px-3 py-2">
                    {log.dbQuery ? (
                      <div className="flex items-center gap-1.5">
                        <span className="bg-brand-navy text-sky-100 px-1.5 py-0.5 rounded text-xs font-bold">
                          {log.dbQuery.durationMs}ms
                        </span>
                        <span className="font-mono text-xs text-slate-300 max-w-[220px] overflow-hidden text-ellipsis whitespace-nowrap">
                          {log.dbQuery.query}
                        </span>
                      </div>
                    ) : (
                      <span className="text-brand-muted text-xs">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-brand-muted">{log.timestamp.split('T')[1].slice(0, 8)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
