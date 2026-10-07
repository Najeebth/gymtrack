import { useEffect } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useAppData } from '../context/AppDataContext';

export default function HealthPage() {
  const { healthData, fetchHealth } = useAppData();

  useEffect(() => {
    fetchHealth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="bg-white p-5 rounded-xl border border-brand-border">
      <h2 className="text-lg font-semibold mb-3 flex items-center gap-1.5">
        <ShieldCheck size={20} className="text-emerald-400" /> System Health Diagnostics
      </h2>

      {healthData ? (
        <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <div className="bg-slate-50 p-3 rounded-lg">
            <div className="text-sm text-brand-muted">Status</div>
            <div className="text-lg font-bold text-emerald-400 capitalize">{healthData.status}</div>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg">
            <div className="text-sm text-brand-muted">Server Uptime</div>
            <div className="text-lg font-bold">{healthData.uptimeSeconds} seconds</div>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg">
            <div className="text-sm text-brand-muted">Node Runtime</div>
            <div className="text-lg font-bold">{healthData.nodeVersion}</div>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg">
            <div className="text-sm text-brand-muted">Memory (RSS)</div>
            <div className="text-lg font-bold">{healthData.memoryUsageMB.rss} MB</div>
          </div>
        </div>
      ) : (
        <div>Loading diagnostics...</div>
      )}
    </div>
  );
}
