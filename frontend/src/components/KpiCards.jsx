export default function KpiCards({ dashboard }) {
  if (!dashboard) return null;

  const {
    total_monthly_cost_usd,
    total_monthly_kg_co2,
    total_monthly_kwh,
    resource_count,
    potential_monthly_savings_usd,
    potential_monthly_co2_savings_kg,
  } = dashboard;

  return (
    <div className="kpi-grid">
      <div className="kpi-card">
        <span className="kpi-eyebrow">Monthly spend</span>
        <span className="kpi-value cyan">${total_monthly_cost_usd.toLocaleString()}</span>
        <span className="kpi-sub">{resource_count} tracked resources</span>
      </div>

      <div className="kpi-card">
        <span className="kpi-eyebrow">
          <span className="pulse-dot" /> Carbon output
        </span>
        <span className="kpi-value carbon">{total_monthly_kg_co2.toLocaleString()} kg CO₂</span>
        <span className="kpi-sub">{total_monthly_kwh.toLocaleString()} kWh drawn this month</span>
      </div>

      <div className="kpi-card highlight">
        <span className="kpi-eyebrow">Recoverable / mo</span>
        <span className="kpi-value clean">${potential_monthly_savings_usd.toLocaleString()}</span>
        <span className="kpi-sub">+ {potential_monthly_co2_savings_kg.toLocaleString()} kg CO₂ avoidable</span>
      </div>
    </div>
  );
}
