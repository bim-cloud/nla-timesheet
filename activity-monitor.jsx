// Manager → Activity Monitor tab
// Deep per-employee tracking view: live status, today's timeline, app breakdown, trends.

const { useState: useStateAM, useMemo: useMemoAM } = React;

// Per-employee activity data (mock, but realistic)
const ACTIVITY_DATA = [
  {
    emp: 'afsal', status: 'active', currentApp: 'Revit', currentProject: 'Dubai Creek Harbor F09',
    clockIn: '8:42 AM', lastEvent: '2s ago', billableToday: 6.75, otherToday: 0.70,
    billableWeek: 34.2, targetWeek: 40, utilization: 89,
    apps: [
      { n:'Revit',    k:'revit',   h:4.21, sessions: 7, longest: '1h 42m' },
      { n:'AutoCAD',  k:'acad',    h:1.20, sessions: 3, longest: '0h 38m' },
      { n:'SketchUp', k:'sketch',  h:0.54, sessions: 2, longest: '0h 22m' },
      { n:'Teams',    k:'teams',   h:0.41, sessions: 5, longest: '0h 14m' },
      { n:'Outlook',  k:'outlook', h:0.27, sessions: 8, longest: '0h 06m' },
      { n:'PDF',      k:'pdf',     h:0.12, sessions: 3, longest: '0h 05m' },
    ],
    other: 0.70,
    // Timeline: array of {start, end, app, project} — normalized 0..1 across 9am-6pm
    timeline: [
      { start: 8.70, end: 10.05, app:'revit',   label:'Revit · DCH F09 model' },
      { start:10.05, end:10.45, app:'teams',   label:'Teams · Studio standup' },
      { start:10.45, end:12.20, app:'revit',   label:'Revit · Planting plans' },
      { start:12.20, end:13.00, app:'acad',    label:'AutoCAD · Detail drawings' },
      { start:13.00, end:14.00, app:'break',   label:'Break' },
      { start:14.00, end:14.15, app:'outlook', label:'Outlook · Client email' },
      { start:14.15, end:15.20, app:'revit',   label:'Revit · Section views' },
      { start:15.20, end:15.40, app:'sketch',  label:'SketchUp · Concept refinement' },
      { start:15.40, end:15.55, app:'idle',    label:'Idle (8 min)' },
      { start:15.55, end:16.50, app:'revit',   label:'Revit · Coordination' },
      { start:16.50, end:17.05, app:'pdf',     label:'Bluebeam · Markup review' },
      { start:17.05, end:17.42, app:'acad',    label:'AutoCAD · Detail drawings' },
    ],
    week: [6.2, 7.1, 6.8, 7.4, 6.7, 0, 0], // Mon..Sun
  },
  {
    emp: 'sandra', status: 'active', currentApp: 'Revit', currentProject: 'Al Qudra Ridge Villas',
    clockIn: '9:05 AM', lastEvent: '12s ago', billableToday: 7.10, otherToday: 0.45,
    billableWeek: 36.4, targetWeek: 40, utilization: 94,
    apps: [
      { n:'Revit',    k:'revit',   h:5.05, sessions: 6, longest: '2h 05m' },
      { n:'SketchUp', k:'sketch',  h:0.85, sessions: 3, longest: '0h 28m' },
      { n:'AutoCAD',  k:'acad',    h:0.55, sessions: 2, longest: '0h 22m' },
      { n:'Teams',    k:'teams',   h:0.35, sessions: 4, longest: '0h 12m' },
      { n:'Outlook',  k:'outlook', h:0.20, sessions: 6, longest: '0h 05m' },
      { n:'PDF',      k:'pdf',     h:0.10, sessions: 2, longest: '0h 04m' },
    ],
    other: 0.45,
    timeline: [
      { start: 9.08, end:11.15, app:'revit',  label:'Revit · Villa 4 envelope' },
      { start:11.15, end:11.45, app:'sketch', label:'SketchUp · Mass study' },
      { start:11.45, end:12.50, app:'revit',  label:'Revit · Landscape coordination' },
      { start:12.50, end:13.00, app:'teams',  label:'Teams · PM check-in' },
      { start:13.00, end:14.00, app:'break',  label:'Break' },
      { start:14.00, end:16.10, app:'revit',  label:'Revit · Sections & elevations' },
      { start:16.10, end:16.45, app:'acad',   label:'AutoCAD · Fence details' },
      { start:16.45, end:17.20, app:'sketch', label:'SketchUp · Entry canopy' },
      { start:17.20, end:17.55, app:'revit',  label:'Revit · Model cleanup' },
    ],
    week: [7.0, 7.2, 7.4, 7.3, 7.5, 0, 0],
  },
  {
    emp: 'rivin', status: 'idle', currentApp: '—', currentProject: 'Sharjah Corniche Phase 2',
    clockIn: '9:12 AM', lastEvent: '4m ago', billableToday: 6.30, otherToday: 0.55,
    billableWeek: 31.1, targetWeek: 40, utilization: 78,
    apps: [
      { n:'AutoCAD',  k:'acad',    h:3.10, sessions: 5, longest: '1h 20m' },
      { n:'Revit',    k:'revit',   h:2.10, sessions: 3, longest: '0h 58m' },
      { n:'PDF',      k:'pdf',     h:0.45, sessions: 3, longest: '0h 18m' },
      { n:'Outlook',  k:'outlook', h:0.35, sessions: 8, longest: '0h 08m' },
      { n:'Teams',    k:'teams',   h:0.20, sessions: 3, longest: '0h 06m' },
      { n:'SketchUp', k:'sketch',  h:0.10, sessions: 1, longest: '0h 06m' },
    ],
    other: 0.55,
    timeline: [
      { start: 9.20, end:10.40, app:'acad',    label:'AutoCAD · Hardscape layout' },
      { start:10.40, end:11.00, app:'teams',   label:'Teams · Team sync' },
      { start:11.00, end:12.15, app:'acad',    label:'AutoCAD · Grading plan' },
      { start:12.15, end:13.00, app:'revit',   label:'Revit · Site model' },
      { start:13.00, end:14.00, app:'break',   label:'Break' },
      { start:14.00, end:14.30, app:'pdf',     label:'Bluebeam · Shop drawing review' },
      { start:14.30, end:15.45, app:'acad',    label:'AutoCAD · Drainage details' },
      { start:15.45, end:16.20, app:'revit',   label:'Revit · Planting layout' },
      { start:16.20, end:17.00, app:'acad',    label:'AutoCAD · Sections' },
      { start:17.00, end:17.18, app:'outlook', label:'Outlook · Client correspondence' },
      { start:17.18, end:17.40, app:'idle',    label:'Idle' },
    ],
    week: [6.3, 6.5, 6.1, 6.0, 6.2, 0, 0],
  },
  {
    emp: 'mehnas', status: 'active', currentApp: 'Revit', currentProject: 'Expo Legacy Gardens',
    clockIn: '8:55 AM', lastEvent: '5s ago', billableToday: 7.40, otherToday: 0.30,
    billableWeek: 37.5, targetWeek: 40, utilization: 96,
    apps: [
      { n:'Revit',    k:'revit',   h:5.40, sessions: 5, longest: '2h 30m' },
      { n:'AutoCAD',  k:'acad',    h:1.15, sessions: 2, longest: '0h 50m' },
      { n:'Teams',    k:'teams',   h:0.30, sessions: 4, longest: '0h 10m' },
      { n:'Outlook',  k:'outlook', h:0.25, sessions: 5, longest: '0h 07m' },
      { n:'PDF',      k:'pdf',     h:0.20, sessions: 2, longest: '0h 10m' },
      { n:'SketchUp', k:'sketch',  h:0.10, sessions: 1, longest: '0h 06m' },
    ],
    other: 0.30,
    timeline: [
      { start: 8.92, end:11.45, app:'revit',  label:'Revit · Garden zone A' },
      { start:11.45, end:12.00, app:'teams',  label:'Teams · Pavilion coordination' },
      { start:12.00, end:13.00, app:'revit',  label:'Revit · Water feature model' },
      { start:13.00, end:14.00, app:'break',  label:'Break' },
      { start:14.00, end:15.10, app:'revit',  label:'Revit · Lighting schedule' },
      { start:15.10, end:16.00, app:'acad',   label:'AutoCAD · Pergola details' },
      { start:16.00, end:17.30, app:'revit',  label:'Revit · Zone B model' },
      { start:17.30, end:17.50, app:'pdf',    label:'Bluebeam · QA markup' },
    ],
    week: [7.4, 7.5, 7.3, 7.6, 7.7, 0, 0],
  },
  {
    emp: 'elbin', status: 'offline', currentApp: '—', currentProject: 'Masdar Park Extension',
    clockIn: '—', lastEvent: 'Not clocked in', billableToday: 0, otherToday: 0,
    billableWeek: 22.5, targetWeek: 40, utilization: 56,
    apps: [
      { n:'Revit',    k:'revit',   h:0, sessions: 0, longest: '—' },
      { n:'AutoCAD',  k:'acad',    h:0, sessions: 0, longest: '—' },
      { n:'SketchUp', k:'sketch',  h:0, sessions: 0, longest: '—' },
      { n:'Teams',    k:'teams',   h:0, sessions: 0, longest: '—' },
      { n:'Outlook',  k:'outlook', h:0, sessions: 0, longest: '—' },
      { n:'PDF',      k:'pdf',     h:0, sessions: 0, longest: '—' },
    ],
    other: 0,
    timeline: [],
    week: [5.8, 5.5, 5.2, 6.0, 0, 0, 0],
  },
];

const empById = (id) => window.DATA.EMPLOYEES.find(e => e.id === id);
const fmtH = (h) => {
  if (!h) return '0h 00m';
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${hh}h ${String(mm).padStart(2, '0')}m`;
};

function ActivityMonitor() {
  const [selected, setSelected] = useStateAM(null);
  const [filter, setFilter] = useStateAM('all');

  const counts = useMemoAM(() => ({
    all: ACTIVITY_DATA.length,
    active: ACTIVITY_DATA.filter(a => a.status === 'active').length,
    idle: ACTIVITY_DATA.filter(a => a.status === 'idle').length,
    offline: ACTIVITY_DATA.filter(a => a.status === 'offline').length,
  }), []);

  const filtered = filter === 'all' ? ACTIVITY_DATA : ACTIVITY_DATA.filter(a => a.status === filter);

  if (selected) {
    return <ActivityDetail data={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="content">
      <div className="section-title" style={{marginTop: 0}}>
        <h2>Activity Monitor</h2>
        <span className="hint">Live view of every employee · auto-refreshes from desktop agent</span>
      </div>

      <div className="stats-row">
        <div className="card stat">
          <div className="stat-label">Active now</div>
          <div className="stat-value">{counts.active}<span className="unit">/ {counts.all}</span></div>
          <div className="stat-delta up">Working in Autodesk apps</div>
        </div>
        <div className="card stat">
          <div className="stat-label">Idle</div>
          <div className="stat-value">{counts.idle}<span className="unit">employees</span></div>
          <div className="stat-delta">No activity 2 min+</div>
        </div>
        <div className="card stat">
          <div className="stat-label">Offline</div>
          <div className="stat-value">{counts.offline}<span className="unit">employees</span></div>
          <div className="stat-delta">Not clocked in today</div>
        </div>
        <div className="card stat">
          <div className="stat-label">Studio billable today</div>
          <div className="stat-value">{ACTIVITY_DATA.reduce((s,a) => s + a.billableToday, 0).toFixed(1)}<span className="unit">hrs</span></div>
          <div className="stat-delta">Across {counts.all} employees</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header" style={{display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap'}}>
          <div>
            <h3 className="card-title">Employee activity · today</h3>
            <div className="card-sub">Click any row to see full timeline and app breakdown</div>
          </div>
          <div style={{flex: 1}}/>
          <div className="am-filters">
            {['all', 'active', 'idle', 'offline'].map(f => (
              <button key={f} className={`am-filter ${filter === f ? 'on' : ''}`} onClick={() => setFilter(f)}>
                {f[0].toUpperCase() + f.slice(1)} <span className="am-filter-count">{counts[f]}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="am-list">
          {filtered.map(a => {
            const e = empById(a.emp);
            const billable = a.apps.reduce((s,x) => s + x.h, 0);
            const grand = billable + a.other || 1;
            return (
              <button key={a.emp} className="am-row" onClick={() => setSelected(a)}>
                <div className="am-who">
                  <div className={`am-status am-status-${a.status}`}>
                    <span className="dot"/>
                  </div>
                  <div className="avatar sm">{e.initials}</div>
                  <div style={{minWidth: 0}}>
                    <div className="am-name">{e.name}</div>
                    <div className="am-sub">{e.role} · {a.currentProject}</div>
                  </div>
                </div>
                <div className="am-now">
                  <div className="am-now-label">Now</div>
                  <div className="am-now-val">
                    {a.status === 'active' && <><span className={`bb-dot bb-${a.apps.find(x => x.n === a.currentApp)?.k || 'other'}`}/>{a.currentApp}</>}
                    {a.status === 'idle' && <span className="am-idle-text">Idle · {a.lastEvent}</span>}
                    {a.status === 'offline' && <span className="am-offline-text">Not clocked in</span>}
                  </div>
                </div>
                <div className="am-bar-col">
                  <div className="au-bar">
                    {a.apps.map(x => (
                      <div key={x.n} className={`au-seg bb-${x.k}`} style={{width: `${(x.h / grand) * 100}%`}} title={`${x.n} · ${fmtH(x.h)}`}/>
                    ))}
                    <div className="au-seg bb-other" style={{width: `${(a.other / grand) * 100}%`}} title={`Other · ${fmtH(a.other)}`}/>
                  </div>
                  <div className="am-totals">
                    <span className="am-billable">{fmtH(billable)} billable</span>
                    <span className="am-other">· {fmtH(a.other)} other</span>
                  </div>
                </div>
                <div className="am-util">
                  <div className="am-util-val">{a.utilization}%</div>
                  <div className="am-util-label">week util.</div>
                </div>
                <Icon name="chevronR" size={16} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ActivityDetail({ data, onBack }) {
  const e = empById(data.emp);
  const billable = data.apps.reduce((s,x) => s + x.h, 0);
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

  return (
    <div className="content">
      <button className="am-back" onClick={onBack}>
        <Icon name="chevronL" size={14}/> Back to Activity Monitor
      </button>

      <div className="am-detail-header">
        <div className="avatar lg">{e.initials}</div>
        <div style={{flex: 1, minWidth: 0}}>
          <h2 style={{margin: 0}}>{e.name}</h2>
          <div className="am-detail-sub">
            {e.role} · {data.currentProject}
          </div>
          <div className="am-detail-meta">
            <span className={`am-status-pill am-status-${data.status}`}>
              <span className="dot"/>
              {data.status === 'active' && `Active · ${data.currentApp}`}
              {data.status === 'idle' && `Idle · ${data.lastEvent}`}
              {data.status === 'offline' && 'Not clocked in'}
            </span>
            <span className="am-meta-sep">·</span>
            <span>Clocked in {data.clockIn}</span>
            <span className="am-meta-sep">·</span>
            <span>Last event {data.lastEvent}</span>
          </div>
        </div>
        <div className="am-detail-metric">
          <div className="m-l">Today</div>
          <div className="m-v">{fmtH(billable)}</div>
          <div className="m-s">billable · {fmtH(data.other)} other</div>
        </div>
        <div className="am-detail-metric">
          <div className="m-l">This week</div>
          <div className="m-v">{data.billableWeek}<span style={{fontSize: 14, opacity: 0.6}}>/{data.targetWeek}h</span></div>
          <div className="m-s">{data.utilization}% utilization</div>
        </div>
      </div>

      <div className="section-title">
        <h2 style={{fontSize: 15}}>Today's timeline</h2>
        <span className="hint">9:00 AM – 6:00 PM · break 1:00–2:00 PM</span>
      </div>
      <div className="card">
        <div className="am-timeline-card">
          {data.timeline.length === 0 ? (
            <div className="am-empty">No activity recorded today.</div>
          ) : (
            <>
              <div className="am-timeline-hours">
                {['9','10','11','12','1','2','3','4','5','6'].map((h, i) => (
                  <div key={i} className="am-hour-tick"><span>{h}{i < 3 ? 'AM' : (i === 3 ? 'PM' : 'PM')}</span></div>
                ))}
              </div>
              <div className="am-timeline-track">
                {data.timeline.map((b, i) => {
                  const left = ((b.start - 9) / 9) * 100;
                  const width = ((b.end - b.start) / 9) * 100;
                  const cls = b.app === 'break' ? 'am-seg-break' : b.app === 'idle' ? 'am-seg-idle' : `bb-${b.app}`;
                  return (
                    <div key={i} className={`am-timeline-block au-seg ${cls}`} style={{left: `${left}%`, width: `${width}%`}} title={b.label}>
                      <span className="am-block-label">{b.label}</span>
                    </div>
                  );
                })}
              </div>
              <div className="am-timeline-legend">
                <span><i className="bb-dot bb-revit"/>Revit</span>
                <span><i className="bb-dot bb-acad"/>AutoCAD</span>
                <span><i className="bb-dot bb-sketch"/>SketchUp</span>
                <span><i className="bb-dot bb-teams"/>Teams</span>
                <span><i className="bb-dot bb-outlook"/>Outlook</span>
                <span><i className="bb-dot bb-pdf"/>PDF / Bluebeam</span>
                <span><i className="am-legend-break"/>Break</span>
                <span><i className="am-legend-idle"/>Idle</span>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="col-7-5">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Application breakdown · today</h3>
            <div className="card-sub">Focus time, sessions, longest uninterrupted stretch</div>
          </div>
          <table className="am-apps-table">
            <thead>
              <tr>
                <th>Application</th>
                <th>Time</th>
                <th>Share</th>
                <th>Sessions</th>
                <th>Longest</th>
              </tr>
            </thead>
            <tbody>
              {data.apps.map(a => {
                const pct = billable > 0 ? (a.h / billable) * 100 : 0;
                return (
                  <tr key={a.n}>
                    <td><span className={`bb-dot bb-${a.k}`}/>{a.n}</td>
                    <td className="mono">{fmtH(a.h)}</td>
                    <td>
                      <div className="am-share">
                        <div className="am-share-bar"><div className={`am-share-fill bb-${a.k}`} style={{width: `${pct}%`}}/></div>
                        <span>{pct.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="mono">{a.sessions}</td>
                    <td className="mono">{a.longest}</td>
                  </tr>
                );
              })}
              <tr className="am-apps-other">
                <td><span className="bb-dot bb-other"/>Other / not billed</td>
                <td className="mono">{fmtH(data.other)}</td>
                <td colSpan={3} className="am-other-note">Chrome, File Explorer, browsing, etc.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">This week</h3>
            <div className="card-sub">Daily billable hours · target 8h/day</div>
          </div>
          <div className="am-week">
            {data.week.map((h, i) => {
              const pct = Math.min(100, (h / 9) * 100);
              const today = i === 0;
              return (
                <div key={i} className="am-week-day">
                  <div className="am-week-bar-wrap">
                    <div className={`am-week-bar ${today ? 'today' : ''}`} style={{height: `${pct}%`}}/>
                  </div>
                  <div className="am-week-val">{h > 0 ? h.toFixed(1) : '—'}</div>
                  <div className="am-week-label">{days[i]}</div>
                </div>
              );
            })}
          </div>
          <div className="am-week-summary">
            Total: <b>{data.billableWeek}h</b> of {data.targetWeek}h target · utilization {data.utilization}%
          </div>
        </div>
      </div>
    </div>
  );
}

window.ActivityMonitor = ActivityMonitor;
