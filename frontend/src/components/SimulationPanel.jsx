import { useState, useEffect } from 'react';
import { api } from '../api';

const ACTIONS = [
  { value: 'stop', label: 'Stop / decommission' },
  { value: 'downsize', label: 'Downsize instance' },
  { value: 'move_to_greenest', label: 'Move to greenest region' },
];

export default function SimulationPanel({ selectedResource, pendingSim, onConsumePending }) {
  const [action, setAction] = useState('stop');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // if a recommendation card asked us to simulate something, run it
  useEffect(() => {
    if (pendingSim) {
      runSim(pendingSim.resourceId, pendingSim.action);
      onConsumePending();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSim]);

  async function runSim(resourceId, act) {
    setLoading(true);
    setError(null);
    try {
      const res = await api.simulate(resourceId, act);
      setResult(res);
      setAction(act);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <h3>What-if simulator</h3>
        <span className="panel-sub">
          {selectedResource ? `Selected: ${selectedResource.name}` : 'Select a resource from the table, or click Simulate on a recommendation'}
        </span>
      </div>

      {selectedResource && (
        <div className="sim-controls">
          <select value={action} onChange={e => setAction(e.target.value)}>
            {ACTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
          <button className="primary-btn" disabled={loading} onClick={() => runSim(selectedResource.id, action)}>
            {loading ? 'Running…' : 'Run simulation'}
          </button>
        </div>
      )}

      {error && <div className="error-state">{error}</div>}

      {result && (
        <div className="sim-result">
          <div className="sim-col">
            <span className="sim-label">Before</span>
            <span className="sim-metric">${result.before.monthly_cost_usd}/mo</span>
            <span className="sim-metric dim">{result.before.monthly_kg_co2} kg CO₂</span>
            <span className="sim-tag">{result.before.instance_type} · {result.before.region}</span>
          </div>
          <div className="sim-arrow">→</div>
          <div className="sim-col">
            <span className="sim-label">After</span>
            <span className="sim-metric clean">${result.after.monthly_cost_usd}/mo</span>
            <span className="sim-metric dim">{result.after.monthly_kg_co2} kg CO₂</span>
            <span className="sim-tag">{result.after.instance_type} · {result.after.region}</span>
          </div>
          <div className="sim-savings">
            <div>Save <strong className="clean">${result.savings_usd}</strong>/mo</div>
            <div>Avoid <strong className="carbon">{result.savings_kg_co2} kg</strong> CO₂/mo</div>
          </div>
        </div>
      )}

      {!selectedResource && !result && (
        <div className="empty-state">No resource selected yet.</div>
      )}
    </div>
  );
}
