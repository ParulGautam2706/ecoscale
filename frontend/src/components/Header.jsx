export default function Header({ apiOk }) {
  return (
    <header className="app-header">
      <div className="brand">
        <span className="brand-mark">◈</span>
        <div>
          <h1>EcoScale</h1>
          <span className="brand-sub">AI-powered cloud cost &amp; carbon footprint optimizer</span>
        </div>
      </div>
      <div className={`status-chip ${apiOk ? 'ok' : 'down'}`}>
        <span className="status-dot" />
        {apiOk ? 'Backend connected' : 'Backend unreachable'}
      </div>
    </header>
  );
}
