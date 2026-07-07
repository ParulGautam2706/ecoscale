import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

export default function RegionChart({ dashboard }) {
  if (!dashboard) return null;

  const data = Object.entries(dashboard.by_region)
    .map(([code, v]) => ({
      region: code,
      label: v.region_label,
      cost: v.cost,
      co2: v.co2,
    }))
    .sort((a, b) => b.cost - a.cost);

  return (
    <div className="panel">
      <div className="panel-header">
        <h3>Cost &amp; carbon by region</h3>
        <span className="panel-sub">USD spend vs kg CO₂ emitted, per region</span>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e2a3a" vertical={false} />
          <XAxis dataKey="region" tick={{ fill: '#8b9bb0', fontSize: 11 }} axisLine={{ stroke: '#2a3a4d' }} tickLine={false} />
          <YAxis tick={{ fill: '#8b9bb0', fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: '#111a29', border: '1px solid #2a3a4d', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: '#e8f0f7' }}
            formatter={(value, name) => name === 'cost' ? [`$${value}`, 'Monthly cost'] : [`${value} kg`, 'CO₂']}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: '#8b9bb0' }} />
          <Bar dataKey="cost" fill="#00d9ff" radius={[4, 4, 0, 0]} name="cost" />
          <Bar dataKey="co2" fill="#ff7a45" radius={[4, 4, 0, 0]} name="co2" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
