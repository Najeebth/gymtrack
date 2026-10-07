import LiveTrafficMap from '../LiveTrafficMap';

export default function MapPage() {
  return (
    <div>
      <div className="bg-white p-4 rounded-xl border border-brand-border mb-4">
        <h2 className="text-base font-semibold text-violet-400 mb-1.5">🗺️ Request Lifecycle Map</h2>
        <p className="text-sm text-brand-muted leading-relaxed">
          Select any request from the list to see a live step‑by‑step map of everything that happened inside the
          server — middleware, DB query, CPU &amp; RAM usage at every stage.
        </p>
      </div>
      <LiveTrafficMap />
    </div>
  );
}
