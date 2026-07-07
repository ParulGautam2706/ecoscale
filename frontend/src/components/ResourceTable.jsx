import { useMemo, useState } from 'react';

const TIER_COLORS = {
  idle: 'var(--accent-danger)',
  underused: 'var(--accent-carbon)',
  optimal: 'var(--accent-clean)',
  overused: 'var(--accent-cyan)',
};

export default function ResourceTable({ resources, onSelect, selectedId }) {
  const [tierFilter, setTierFilter] = useState('all');
  const [sortKey, setSortKey] = useState('monthly_cost_usd');

  const filtered = useMemo(() => {
    let rows = resources;
    if (tierFilter !== 'all') rows = rows.filter(r => r.utilization_tier === tierFilter);
    return [...rows].sort((a, b) => b[sortKey] - a[sortKey]);
  }, [resources, tierFilter, sortKey]);

  return (
    <div className="panel">
      <div className="panel-header row">
        <div>
          <h3>Resource inventory</h3>
          <span className="panel-sub">{filtered.length} of {resources.length} resources</span>
        </div>
        <div className="filter-row">
          <select value={tierFilter} onChange={e => setTierFilter(e.target.value)}>
            <option value="all">All tiers</option>
            <option value="idle">Idle</option>
            <option value="underused">Underused</option>
            <option value="optimal">Optimal</option>
            <option value="overused">Overused</option>
          </select>
          <select value={sortKey} onChange={e => setSortKey(e.target.value)}>
            <option value="monthly_cost_usd">Sort: cost</option>
            <option value="monthly_kg_co2">Sort: CO₂</option>
            <option value="cpu_util_pct">Sort: CPU %</option>
          </select>
        </div>
      </div>

      <div className="table-scroll">
        <table className="res-table">
          <thead>
            <tr>
              <th>Resource</th>
              <th>Type</th>
              <th>Region</th>
              <th>CPU</th>
              <th>Mem</th>
              <th>Tier</th>
              <th>$/mo</th>
              <th>kg CO₂/mo</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr
                key={r.id}
                className={r.id === selectedId ? 'selected' : ''}
                onClick={() => onSelect(r)}
              >
                <td className="mono-name">{r.name}</td>
                <td>{r.instance_type}</td>
                <td>{r.region}</td>
                <td>{r.cpu_util_pct}%</td>
                <td>{r.mem_util_pct}%</td>
                <td>
                  <span className="tier-badge" style={{ color: TIER_COLORS[r.utilization_tier], borderColor: TIER_COLORS[r.utilization_tier] }}>
                    {r.utilization_tier}
                  </span>
                </td>
                <td>${r.monthly_cost_usd}</td>
                <td>{r.monthly_kg_co2}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
