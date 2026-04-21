function TeamOverviewTable() {
  const empById = (id) => window.DATA.EMPLOYEES.find(e => e.id === id);
  const projById = (id) => window.DATA.PROJECTS.find(p => p.id === id);

  const statusBadge = (s) => {
    if (s === 'working') return <span className="badge success"><span className="dot"/>Working</span>;
    if (s === 'break') return <span className="badge warning"><span className="dot"/>On break</span>;
    if (s === 'leave') return <span className="badge"><span className="dot"/>On leave</span>;
    return <span className="badge">Off</span>;
  };

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h3 className="card-title">Team — today</h3>
          <div className="card-sub">Live status · Monday, April 20</div>
        </div>
        <div style={{display: 'flex', gap: 6}}>
          <button className="btn btn-sm"><Icon name="filter" size={14}/> All teams</button>
          <button className="btn btn-sm"><Icon name="download" size={14}/> Export</button>
        </div>
      </div>

      <div style={{overflowX: 'auto'}}>
        <table className="team-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Status</th>
              <th>Current project</th>
              <th className="num">Clocked in</th>
              <th className="num">Today</th>
              <th>Week progress</th>
              <th className="num">Week hrs</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {window.DATA.TEAM_TODAY.map(row => {
              const e = empById(row.emp);
              const p = projById(row.currentProject);
              const pct = Math.min(100, (row.weekHours / row.weekTarget) * 100);
              const over = row.weekHours > row.weekTarget;
              return (
                <tr key={row.emp}>
                  <td>
                    <div className="team-cell-emp">
                      <div className="avatar">{e.initials}</div>
                      <div>
                        <div className="name">{e.name}</div>
                        <div className="role">{e.role}</div>
                      </div>
                    </div>
                  </td>
                  <td>{statusBadge(row.status)}</td>
                  <td style={{color: 'var(--text-muted)'}}>{p?.name || '—'}</td>
                  <td className="num" style={{fontFamily: 'var(--font-mono)'}}>{row.clockedIn}</td>
                  <td className="num">{row.hoursToday.toFixed(2)}</td>
                  <td>
                    <div className={`util-bar ${over ? 'over' : ''}`}>
                      <span style={{width: `${pct}%`}}/>
                    </div>
                  </td>
                  <td className="num">{row.weekHours.toFixed(1)} / {row.weekTarget}</td>
                  <td><button className="btn btn-ghost btn-sm"><Icon name="more" size={14}/></button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ManagerStats() {
  const stats = [
    { label: 'On shift now', value: '4', unit: 'of 5', delta: '1 on leave today', deltaClass: '' },
    { label: 'Team hrs today', value: '25.75', unit: 'hrs', delta: 'Target 40', deltaClass: '' },
    { label: 'Hrs this week', value: '155.5', unit: '/ 200', delta: '77.8% utilization', deltaClass: 'up' },
    { label: 'Pending approvals', value: '3', unit: '', delta: '2 timesheets · 1 leave', deltaClass: '' },
  ];
  return (
    <div className="stats-row">
      {stats.map(s => (
        <div key={s.label} className="card stat">
          <div className="stat-label">{s.label}</div>
          <div className="stat-value">{s.value}<span className="unit">{s.unit}</span></div>
          <div className={`stat-delta ${s.deltaClass}`}>{s.delta}</div>
        </div>
      ))}
    </div>
  );
}

function Approvals() {
  const [items, setItems] = React.useState(window.DATA.APPROVALS);
  const empById = (id) => window.DATA.EMPLOYEES.find(e => e.id === id);
  const act = (id) => setItems(items.filter(i => i.id !== id));

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h3 className="card-title">Pending approvals</h3>
          <div className="card-sub">{items.length} awaiting review</div>
        </div>
        <button className="btn btn-sm">View all</button>
      </div>

      {items.length === 0 ? (
        <div className="empty">✓ All caught up.</div>
      ) : items.map(item => {
        const e = empById(item.emp);
        return (
          <div key={item.id} className="request">
            <div className="avatar">{e.initials}</div>
            <div className="req-body">
              <p className="req-title">
                {e.name} · <span style={{fontWeight: 400, color: 'var(--text-muted)'}}>
                  {item.type === 'leave' ? 'Leave request' : 'Timesheet'}
                </span>
              </p>
              <p className="req-sub">{item.label}</p>
              <p className="req-sub" style={{fontSize: 11.5, marginTop: 2}}>{item.sub}</p>
            </div>
            <div className="req-actions">
              <button className="btn btn-sm" onClick={() => act(item.id)}><Icon name="x" size={14}/></button>
              <button className="btn btn-sm btn-primary" onClick={() => act(item.id)}><Icon name="check" size={14}/> Approve</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ProjectHours() {
  const projById = (id) => window.DATA.PROJECTS.find(p => p.id === id);
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h3 className="card-title">Project hours · this week</h3>
          <div className="card-sub">Actual vs. budgeted</div>
        </div>
        <button className="btn btn-sm"><Icon name="download" size={14}/> CSV</button>
      </div>
      {window.DATA.PROJECT_TOTALS.map(pt => {
        const p = projById(pt.id);
        const pct = Math.min(100, (pt.hours / pt.budget) * 100);
        const over = pt.hours > pt.budget;
        return (
          <div key={pt.id} className="project-item">
            <div>
              <div className="pname">{p.name}</div>
              <div className="pmeta">{p.code} · {p.client} · {pt.team} {pt.team === 1 ? 'person' : 'people'}</div>
            </div>
            <div className={`util-bar ${over ? 'over' : ''}`} style={{width: '100%'}}>
              <span style={{width: `${pct}%`}}/>
            </div>
            <div className="phours">{pt.hours.toFixed(1)} / {pt.budget}</div>
          </div>
        );
      })}
    </div>
  );
}

function WeekTotalsBars() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const values = window.DATA.WEEK_DAILY_TOTALS;
  const max = 50;
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h3 className="card-title">Team hours this week</h3>
          <div className="card-sub">Daily totals across all projects</div>
        </div>
      </div>
      <div className="day-bars" style={{height: 120}}>
        {days.map((d, i) => (
          <div key={d} className="day-bar">
            <div className="bar" style={{height: '100%', position: 'relative'}}>
              <div className="fill" style={{height: `${(values[i]/max)*100}%`}}/>
              <div style={{
                position: 'absolute', top: -18, left: 0, right: 0, textAlign: 'center',
                fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)',
              }}>{values[i]}h</div>
            </div>
            <div className="label">{d}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const APP_META = {
  revit:   { name: 'Revit',          color: '#3fb6e6', badge: 'R' },
  acad:    { name: 'AutoCAD',        color: '#e8554e', badge: 'A' },
  sketch:  { name: 'SketchUp',       color: '#f9a03f', badge: 'S' },
  teams:   { name: 'Teams',          color: '#6c7dd5', badge: 'T' },
  outlook: { name: 'Outlook',        color: '#4a90d9', badge: 'O' },
  pdf:     { name: 'PDF / Bluebeam', color: '#9a6fe0', badge: 'P' },
};

function AppUsageDonut({ slices, total, studioUtil }) {
  const [hovered, setHovered] = React.useState(null);
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => { const t = setTimeout(() => setMounted(true), 30); return () => clearTimeout(t); }, []);

  const cx = 75, cy = 75, R = 62, r = 40;
  let cumAngle = -Math.PI / 2;
  const arcs = slices.map((s, i) => {
    const frac = s.value / total;
    const start = cumAngle;
    const end = cumAngle + frac * Math.PI * 2;
    cumAngle = end;
    const midAngle = (start + end) / 2;
    const large = frac > 0.5 ? 1 : 0;
    const x1 = cx + R * Math.cos(start), y1 = cy + R * Math.sin(start);
    const x2 = cx + R * Math.cos(end),   y2 = cy + R * Math.sin(end);
    const x3 = cx + r * Math.cos(end),   y3 = cy + r * Math.sin(end);
    const x4 = cx + r * Math.cos(start), y4 = cy + r * Math.sin(start);
    const d = `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${r} ${r} 0 ${large} 0 ${x4} ${y4} Z`;
    // Offset for hover "pop-out"
    const ox = Math.cos(midAngle) * 4;
    const oy = Math.sin(midAngle) * 4;
    return { ...s, d, frac, ox, oy, i };
  });

  const active = hovered ? arcs.find(a => a.k === hovered) : null;
  const centerVal = active ? `${(active.frac * 100).toFixed(0)}%` : `${Math.round(studioUtil)}%`;
  const centerLbl = active ? active.label : 'utilization';

  return (
    <div className="au-donut" onMouseLeave={() => setHovered(null)}>
      <svg viewBox="0 0 150 150" className={`au-donut-svg ${mounted ? 'mounted' : ''}`}>
        <defs>
          <filter id="au-donut-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodOpacity="0.18"/>
          </filter>
        </defs>
        <circle cx={cx} cy={cy} r={R} fill="#f4f6fa"/>
        {arcs.map(a => (
          <path
            key={a.k}
            d={a.d}
            fill={a.color}
            className="au-donut-slice"
            style={{
              transform: hovered === a.k ? `translate(${a.ox}px, ${a.oy}px)` : 'translate(0,0)',
              filter: hovered && hovered !== a.k ? 'saturate(0.3) opacity(0.55)' : (hovered === a.k ? 'url(#au-donut-shadow)' : 'none'),
              transitionDelay: `${a.i * 45}ms`,
            }}
            onMouseEnter={() => setHovered(a.k)}
          />
        ))}
        <circle cx={cx} cy={cy} r={r - 1} fill="#fff" pointerEvents="none"/>
        <text x={cx} y={cy - 2} textAnchor="middle" className="au-donut-v" pointerEvents="none">{centerVal}</text>
        <text x={cx} y={cy + 14} textAnchor="middle" className="au-donut-l" pointerEvents="none">{centerLbl}</text>
      </svg>
    </div>
  );
}

function AppUsageBreakdown() {
  const [range, setRange] = React.useState('today');
  const [sortBy, setSortBy] = React.useState('billable'); // 'billable' | 'name' | 'util'

  const multiplier = range === 'today' ? 1 : range === 'week' ? 5 : 22;

  const rowsBase = [
    { emp: 'afsal',   apps: { revit: 4.21, acad: 1.20, sketch: 0.54, teams: 0.41, outlook: 0.27, pdf: 0.12 }, other: 0.70, target: 8 },
    { emp: 'sandra',  apps: { revit: 5.05, acad: 0.55, sketch: 0.85, teams: 0.35, outlook: 0.20, pdf: 0.10 }, other: 0.45, target: 8 },
    { emp: 'rivin',   apps: { revit: 2.10, acad: 3.10, sketch: 0.10, teams: 0.20, outlook: 0.35, pdf: 0.45 }, other: 0.55, target: 8 },
    { emp: 'mehnas',  apps: { revit: 5.40, acad: 1.15, sketch: 0.10, teams: 0.30, outlook: 0.25, pdf: 0.20 }, other: 0.30, target: 8 },
    { emp: 'elbin',   apps: { revit: 3.20, acad: 1.10, sketch: 0.55, teams: 0.35, outlook: 0.40, pdf: 0.20 }, other: 0.85, target: 8 },
  ];

  const rows = rowsBase.map(r => {
    const apps = {};
    Object.keys(r.apps).forEach(k => { apps[k] = +(r.apps[k] * multiplier).toFixed(2); });
    const other = +(r.other * multiplier).toFixed(2);
    const billable = Object.values(apps).reduce((s, x) => s + x, 0);
    const total = billable + other;
    const util = total > 0 ? Math.min(100, (billable / (r.target * multiplier)) * 100) : 0;
    return { ...r, apps, other, billable, total, util };
  });

  const sortedRows = [...rows].sort((a, b) => {
    if (sortBy === 'billable') return b.billable - a.billable;
    if (sortBy === 'util') return b.util - a.util;
    return 0;
  });

  // Studio totals by app
  const appTotals = Object.keys(APP_META).map(k => ({
    k,
    hours: rows.reduce((s, r) => s + (r.apps[k] || 0), 0),
  })).sort((a, b) => b.hours - a.hours);
  const appTotalSum = appTotals.reduce((s, a) => s + a.hours, 0);
  const studioOther = rows.reduce((s, r) => s + r.other, 0);
  const studioTotal = appTotalSum + studioOther;

  const empById = (id) => window.DATA.EMPLOYEES.find(e => e.id === id);
  const fmt = (h) => {
    if (h === 0) return '—';
    const hh = Math.floor(h);
    const mm = Math.round((h - hh) * 60);
    return `${hh}h ${String(mm).padStart(2, '0')}m`;
  };
  const fmtDec = (h) => h.toFixed(1);

  const rangeLabel = range === 'today' ? 'today' : range === 'week' ? 'this week' : 'this month';
  const studioTarget = rows.length * 8 * multiplier;
  const studioUtil = Math.min(100, (appTotalSum / studioTarget) * 100);
  const topApp = appTotals[0];
  const topEmp = [...rows].sort((a, b) => b.util - a.util)[0];
  const topEmpObj = empById(topEmp.emp);

  const donutSlices = [
    ...appTotals.map(a => ({
      k: a.k, label: APP_META[a.k].name, value: a.hours, color: APP_META[a.k].color,
    })),
    { k: 'other', label: 'Other (not billed)', value: studioOther, color: '#c4cbd6' },
  ];

  return (
    <>
      {/* Stats strip — matches Activity Monitor pattern */}
      <div className="stats-row" style={{marginTop: 6}}>
        <div className="card stat">
          <div className="stat-label">Studio billable · {rangeLabel}</div>
          <div className="stat-value">{fmtDec(appTotalSum)}<span className="unit">hrs</span></div>
          <div className="stat-delta">of {fmtDec(studioTarget)}h target · {fmtDec(studioOther)}h not billed</div>
        </div>
        <div className="card stat">
          <div className="stat-label">Avg. utilization</div>
          <div className="stat-value" style={{color: studioUtil >= 85 ? '#1d8a4a' : studioUtil >= 70 ? '#a87220' : '#a52822'}}>
            {Math.round(studioUtil)}<span className="unit">%</span>
          </div>
          <div className="stat-delta">across {rows.length} employees</div>
        </div>
        <div className="card stat">
          <div className="stat-label">Top application</div>
          <div className="stat-value" style={{fontSize: 22}}>
            <span className={`bb-dot bb-${topApp.k}`} style={{marginRight: 8, width: 12, height: 12}}/>
            {APP_META[topApp.k].name}
          </div>
          <div className="stat-delta">{fmtDec(topApp.hours)}h · {Math.round((topApp.hours / studioTotal) * 100)}% of tracked</div>
        </div>
        <div className="card stat">
          <div className="stat-label">Highest utilization</div>
          <div className="stat-value" style={{fontSize: 22}}>{topEmpObj.name.split(' ')[0]}</div>
          <div className="stat-delta">{Math.round(topEmp.util)}% · {fmtDec(topEmp.billable)}h billable</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header" style={{display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap'}}>
          <div>
            <h3 className="card-title">Time breakdown by application</h3>
            <div className="card-sub">Desktop agent · focus time only (app active + mouse/keyboard within 2 min)</div>
          </div>
          <div style={{flex: 1}}/>
          <div className="am-filters">
            {[['today','Today'],['week','This week'],['month','This month']].map(([k,l]) => (
              <button key={k} className={`am-filter ${range === k ? 'on' : ''}`} onClick={() => setRange(k)}>{l}</button>
            ))}
          </div>
          <button className="btn btn-sm"><Icon name="download" size={14}/> Export</button>
        </div>

        {/* Donut + legend split */}
        <div className="au-split">
          <AppUsageDonut slices={donutSlices} total={studioTotal} studioUtil={studioUtil}/>
          <div className="au-split-legend">
            <div className="au-split-title">Studio time mix · {rangeLabel}</div>
            <div className="au-split-rows">
              {donutSlices.map(s => {
                const pct = (s.value / studioTotal) * 100;
                return (
                  <div key={s.k} className="au-split-row">
                    <span className="bb-dot" style={{background: s.color}}/>
                    <span className="au-split-name">{s.label}</span>
                    <div className="au-split-bar"><div style={{width: `${pct}%`, background: s.color}}/></div>
                    <span className="au-split-hrs">{fmt(s.value)}</span>
                    <span className="au-split-pct">{pct.toFixed(1)}%</span>
                  </div>
                );
              })}
            </div>
            <div className="au-split-foot">
              Hover any slice to isolate it · totals update live when you change the range
            </div>
          </div>
        </div>

        {/* Per-employee list — same row shape as Activity Monitor */}
        <div className="am-list">
          <div className="am-row am-row-head">
            <div>
              <button className="tb-sort" onClick={() => setSortBy('name')}>Employee</button>
            </div>
            <div className="am-now-label" style={{marginBottom: 0}}>Top apps</div>
            <div className="am-now-label" style={{marginBottom: 0}}>Distribution</div>
            <div style={{textAlign: 'right'}}>
              <button className={`tb-sort ${sortBy === 'billable' ? 'on' : ''}`} onClick={() => setSortBy('billable')}>
                Billable {sortBy === 'billable' ? '↓' : ''}
              </button>
            </div>
            <div style={{textAlign: 'right'}}>
              <button className={`tb-sort ${sortBy === 'util' ? 'on' : ''}`} onClick={() => setSortBy('util')}>
                Util {sortBy === 'util' ? '↓' : ''}
              </button>
            </div>
          </div>
          {sortedRows.map(r => {
            const e = empById(r.emp);
            // Top 3 apps by hours
            const topApps = Object.keys(r.apps)
              .map(k => ({ k, h: r.apps[k] }))
              .filter(a => a.h > 0)
              .sort((a, b) => b.h - a.h)
              .slice(0, 3);
            return (
              <div key={r.emp} className="am-row am-row-static">
                <div className="am-who">
                  <div className="avatar sm">{e.initials}</div>
                  <div style={{minWidth: 0}}>
                    <div className="am-name">{e.name}</div>
                    <div className="am-sub">{e.role}</div>
                  </div>
                </div>
                <div className="am-now">
                  <div className="au-chips">
                    {topApps.map(a => (
                      <span key={a.k} className="au-chip" title={`${APP_META[a.k].name} · ${fmt(a.h)}`}>
                        <i className={`bb-dot bb-${a.k}`}/>
                        {APP_META[a.k].name}
                        <span className="au-chip-h">{fmt(a.h)}</span>
                      </span>
                    ))}
                  </div>
                </div>
                <div className="am-bar-col">
                  <div className="au-bar">
                    {Object.keys(APP_META).map(k => (
                      r.apps[k] > 0 && <div
                        key={k}
                        className={`au-seg bb-${k}`}
                        style={{width: `${(r.apps[k] / r.total) * 100}%`}}
                        title={`${APP_META[k].name} · ${fmt(r.apps[k])}`}
                      />
                    ))}
                    {r.other > 0 && <div className="au-seg bb-other" style={{width: `${(r.other / r.total) * 100}%`}} title={`Other · ${fmt(r.other)}`}/>}
                  </div>
                  <div className="am-totals">
                    <span className="am-billable">{fmtDec(r.billable)}h billable</span>
                    <span className="am-other">· {fmtDec(r.other)}h other</span>
                  </div>
                </div>
                <div style={{textAlign: 'right', fontVariantNumeric: 'tabular-nums'}}>
                  <div className="am-util-val">{fmtDec(r.billable)}<span style={{fontSize: 12, color: 'var(--text-muted)', fontWeight: 500}}>h</span></div>
                  <div className="am-util-label">of {fmtDec(r.target * multiplier)}h</div>
                </div>
                <div style={{textAlign: 'right'}}>
                  <div className={`tb-util-pill ${r.util >= 85 ? 'good' : r.util >= 70 ? 'ok' : 'low'}`}>
                    {Math.round(r.util)}%
                  </div>
                </div>
              </div>
            );
          })}
          <div className="am-row am-row-foot">
            <div className="am-foot-label">Studio total</div>
            <div className="am-foot-apps">
              {appTotals.slice(0, 3).map(a => (
                <span key={a.k} className="au-chip">
                  <i className={`bb-dot bb-${a.k}`}/>{APP_META[a.k].name}<span className="au-chip-h">{fmtDec(a.hours)}h</span>
                </span>
              ))}
            </div>
            <div/>
            <div style={{textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600}}>{fmtDec(appTotalSum)}h</div>
            <div style={{textAlign: 'right'}}>
              <div className={`tb-util-pill ${studioUtil >= 85 ? 'good' : studioUtil >= 70 ? 'ok' : 'low'}`}>
                {Math.round(studioUtil)}%
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function ManagerView({ activeNav }) {
  if (activeNav === 'users') {
    return (
      <div className="content">
        <div className="section-title" style={{marginTop: 0}}>
          <h2>Users &amp; access</h2>
          <span className="hint">Add accounts, reset passwords, manage roles</span>
        </div>
        <window.UsersAdmin />
      </div>
    );
  }
  if (activeNav === 'activity') {
    return <window.ActivityMonitor />;
  }
  return (
    <div className="content">
      <div className="section-title" style={{marginTop: 0}}>
        <h2>Studio snapshot</h2>
        <span className="hint">Monday, April 20, 2026 · Week 16</span>
      </div>
      <ManagerStats />

      <TeamOverviewTable />

      <div className="section-title">
        <h2>Projects &amp; approvals</h2>
        <span className="hint">This week · all active projects</span>
      </div>
      <div className="col-8-4">
        <ProjectHours />
        <div className="col-stack">
          <Approvals />
          <WeekTotalsBars />
        </div>
      </div>

      <AppUsageBreakdown />
    </div>
  );
}

window.ManagerView = ManagerView;
