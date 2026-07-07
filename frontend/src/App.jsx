import { useEffect, useState } from 'react';
import { api } from './api';
import Header from './components/Header';
import KpiCards from './components/KpiCards';
import RegionChart from './components/RegionChart';
import ResourceTable from './components/ResourceTable';
import RecommendationsPanel from './components/RecommendationsPanel';
import SimulationPanel from './components/SimulationPanel';

export default function App() {
  const [apiOk, setApiOk] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [resources, setResources] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [selectedResource, setSelectedResource] = useState(null);
  const [pendingSim, setPendingSim] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      await api.health();
      setApiOk(true);
      const [d, r, rec] = await Promise.all([
        api.dashboard(),
        api.resources(),
        api.recommendations(),
      ]);
      setDashboard(d);
      setResources(r);
      setRecommendations(rec);
      setError(null);
    } catch (e) {
      setApiOk(false);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleSimulateFromRec(resourceId, action) {
    const res = resources.find(r => r.id === resourceId);
    if (res) setSelectedResource(res);
    setPendingSim({ resourceId, action });
  }

  return (
    <div className="app-shell">
      <Header apiOk={apiOk} />

      {loading && <div className="loading-state">Loading fleet data…</div>}

      {error && (
        <div className="error-banner">
          Couldn't reach the backend at <code>/api</code> — is the Flask server running on port 5000?
          <br />
          <span className="dim">{error}</span>
        </div>
      )}

      {!loading && !error && (
        <main className="main-grid">
          <KpiCards dashboard={dashboard} />

          <div className="two-col">
            <RegionChart dashboard={dashboard} />
            <SimulationPanel
              selectedResource={selectedResource}
              pendingSim={pendingSim}
              onConsumePending={() => setPendingSim(null)}
            />
          </div>

          <div className="two-col wide-left">
            <ResourceTable
              resources={resources}
              onSelect={setSelectedResource}
              selectedId={selectedResource?.id}
            />
            <RecommendationsPanel
              recommendations={recommendations}
              onSimulate={handleSimulateFromRec}
            />
          </div>
        </main>
      )}

      <footer className="app-footer">
        EcoScale · mock fleet data for demo purposes · built with Flask + scikit-learn + React
      </footer>
    </div>
  );
}
