const SEVERITY_LABEL = { high: 'High impact', medium: 'Medium impact', low: 'Low impact' };
const TYPE_ICON = {
  decommission: '⏻',
  rightsize: '⇕',
  upsize_risk: '⚠',
  region_shift: '⇄',
  commitment_discount: '％',
};

export default function RecommendationsPanel({ recommendations, onSimulate }) {
  return (
    <div className="panel">
      <div className="panel-header">
        <h3>Recommendations</h3>
        <span className="panel-sub">{recommendations.length} actions found by the optimizer</span>
      </div>

      <div className="rec-list">
        {recommendations.map((rec, i) => (
          <div key={i} className={`rec-card sev-${rec.severity}`}>
            <div className="rec-top">
              <span className="rec-icon">{TYPE_ICON[rec.type] || '•'}</span>
              <div className="rec-text">
                <div className="rec-title">{rec.title}</div>
                <div className="rec-detail">{rec.detail}</div>
              </div>
            </div>
            <div className="rec-bottom">
              <span className={`sev-tag sev-${rec.severity}`}>{SEVERITY_LABEL[rec.severity]}</span>
              <div className="rec-savings">
                {rec.est_monthly_savings_usd > 0 && <span className="save-usd">${rec.est_monthly_savings_usd}/mo</span>}
                {rec.est_monthly_co2_savings_kg > 0 && <span className="save-co2">{rec.est_monthly_co2_savings_kg} kg CO₂/mo</span>}
              </div>
              {(rec.type === 'decommission' || rec.type === 'rightsize' || rec.type === 'region_shift') && (
                <button
                  className="ghost-btn"
                  onClick={() => onSimulate(rec.resource_id, rec.type === 'decommission' ? 'stop' : rec.type === 'rightsize' ? 'downsize' : 'move_to_greenest')}
                >
                  Simulate →
                </button>
              )}
            </div>
          </div>
        ))}
        {recommendations.length === 0 && <div className="empty-state">No recommendations for this filter.</div>}
      </div>
    </div>
  );
}
