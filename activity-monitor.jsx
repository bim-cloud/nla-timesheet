// Manager   Activity Monitor tab
// Real data from Supabase entries table.
// App-level tracking (Revit/AutoCAD timeline) requires the Windows Desktop Agent.

const { useState: useStateAM, useEffect: useEffectAM, useMemo: useMemoAM } = React;

const fmtH = (h) => {
  if (!h || h === 0) return '0h 00m';
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${hh}h ${String(mm).padStart(2, '0')}m`;
};

function useActivityData() {
  const [data, setData] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [lastRefresh, setLastRefresh] = React.useState(null);

  const load = async () => {
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];
    const getMonday = () => {
      const d = new Date(); const day = d.getDay();
      d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
      return d.toISOString().split('T')[0];
    };
    try {
      const [profiles, todayEntries, weekEntries] = await Promise.all([
        window.SupaProfiles.getAll(),
        window.SupaEntries.teamForDay(today),
        window.SupaEntries.teamSummary(getMonday(), today),
      ]);

      const employees = profiles.filter(p => p.user_type === 'employee');

      const rows = employees.map(emp => {
        const empToday = todayEntries.filter(e => e.user_id === emp.id);
        const empWeek  = weekEntries.filter(e => e.user_id === emp.id);

        const todayHrs = empToday.reduce((s, e) => s + parseFloat(e.hours), 0);
        const weekHrs  = empWeek.reduce((s, e) => s + parseFloat(e.hours), 0);
        const target   = 45; // 8.5h x 5 days
        const util     = target > 0 ? Math.round((weekHrs / target) * 100) : 0;

        // Last project worked on today
        const lastEntry = empToday.length > 0 ? empToday[empToday.length - 1] : null;

        // Project breakdown from today entries
        const projMap = {};
        empToday.forEach(e => {
          const k = e.project_id;
          if (!projMap[k]) projMap[k] = { name: e.project_name || k, hours: 0 };
          projMap[k].hours += parseFloat(e.hours);
        });
        const projects = Object.values(projMap).sort((a,b) => b.hours - a.hours);

        // Week daily hours   Mon to Fri
        const weekDates = Array.from({length: 5}, (_, i) => {
          const d = new Date(getMonday());
          d.setDate(d.getDate() + i);
          return d.toISOString().split('T')[0];
        });
        const weekByDay = weekDates.map(date => {
          return empWeek.filter(e => e.date === date).reduce((s,e) => s + parseFloat(e.hours), 0);
        });

        const hasEntriesToday = empToday.length > 0;
        const status = hasEntriesToday ? 'active' : 'offline';

        return {
          id:           emp.id,
          emp:          emp.id,
          name:         emp.name,
          role:         emp.role,
          initials:     emp.initials,
          status,
          todayHrs,
          weekHrs,
          util,
          target,
          projects,
          weekByDay,
          lastProject:  lastEntry?.project_name || ' ',
          entriesCount: empToday.length,
        };
      });

      setData(rows);
      setLastRefresh(new Date());
    } catch(err) {
      console.error('Activity monitor load error:', err);
    }
    setLoading(false);
  };

  useEffectAM(() => {
    load();
    const interval = setInterval(load, 60000); // refresh every 60s
    return () => clearInterval(interval);
  }, []);

  return { data, loading, lastRefresh, reload: load };
}

function ActivityMonitor() {
  const { data, loading, lastRefresh, reload } = useActivityData();
  const [selected, setSelected] = useStateAM(null);
  const [filter, setFilter] = useStateAM('all');

  const counts = useMemoAM(() => ({
    all:     data.length,
    active:  data.filter(a => a.status === 'active').length,
    offline: data.filter(a => a.status === 'offline').length,
  }), [data]);

  const totalToday = useMemoAM(() => data.reduce((s,a) => s + a.todayHrs, 0), [data]);

  const filtered = filter === 'all' ? data : data.filter(a => a.status === filter);

  const fmtRefresh = (d) => d ? d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : ' ';

  if (selected) {
    return <ActivityDetail data={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="content">
      <div className="section-title" style={{marginTop: 0}}>
        <h2>Activity Monitor</h2>
        <span className="hint">
          Real data from timesheet entries   auto-refreshes every 60s
          {lastRefresh && `   Last updated ${fmtRefresh(lastRefresh)}`}
          <button onClick={reload} style={{marginLeft:8,background:'none',border:'none',cursor:'pointer',color:'var(--accent)',fontSize:12,padding:0}}>  Refresh</button>
        </span>
      </div>

      <div className="stats-row">
        <div className="card stat">
          <div className="stat-label">Active today</div>
          <div className="stat-value">{loading ? ' ' : counts.active}<span className="unit">/ {counts.all}</span></div>
          <div className="stat-delta up">Logged entries today</div>
        </div>
        <div className="card stat">
          <div className="stat-label">Offline today</div>
          <div className="stat-value">{loading ? ' ' : counts.offline}<span className="unit">employees</span></div>
          <div className="stat-delta">No entries logged yet</div>
        </div>
        <div className="card stat">
          <div className="stat-label">Studio hours today</div>
          <div className="stat-value">{loading ? ' ' : totalToday.toFixed(1)}<span className="unit">hrs</span></div>
          <div className="stat-delta">Across {counts.all} employees</div>
        </div>
        <div className="card stat">
          <div className="stat-label">App tracking</div>
          <div className="stat-value" style={{fontSize:16,paddingTop:4}}>Pending</div>
          <div className="stat-delta">Install desktop agent</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header" style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
          <div>
            <h3 className="card-title">Employee activity   today</h3>
            <div className="card-sub">Click any row to see project breakdown and week trend</div>
          </div>
          <div style={{flex:1}}/>
          <div className="am-filters">
            {[['all','All'],['active','Active'],['offline','Offline']].map(([f,l]) => (
              <button key={f} className={`am-filter ${filter === f ? 'on' : ''}`} onClick={() => setFilter(f)}>
                {l} <span className="am-filter-count">{counts[f] ?? data.length}</span>
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{padding:'32px',textAlign:'center',color:'var(--text-muted)',fontSize:13}}>Loading activity data </div>
        ) : filtered.length === 0 ? (
          <div style={{padding:'32px',textAlign:'center',color:'var(--text-muted)',fontSize:13}}>No employees found.</div>
        ) : (
          <div className="am-list">
            {filtered.map(a => {
              const pct = Math.min(100, (a.weekHrs / a.target) * 100);
              return (
                <button key={a.id} className="am-row" onClick={() => setSelected(a)}>
                  <div className="am-who">
                    <div className={`am-status am-status-${a.status}`}><span className="dot"/></div>
                    <div className="avatar sm">{a.initials}</div>
                    <div style={{minWidth:0}}>
                      <div className="am-name">{a.name}</div>
                      <div className="am-sub">{a.role}{a.lastProject !== ' ' ? `   ${a.lastProject}` : ''}</div>
                    </div>
                  </div>
                  <div className="am-now">
                    <div className="am-now-label">Today</div>
                    <div className="am-now-val">
                      {a.status === 'active'
                        ? <span style={{color:'var(--accent)',fontWeight:600}}>{fmtH(a.todayHrs)}</span>
                        : <span className="am-offline-text">No entries yet</span>}
                    </div>
                  </div>
                  <div className="am-bar-col">
                    <div className="au-bar">
                      <div className="au-seg bb-revit" style={{width:`${pct}%`}} title={`${a.weekHrs.toFixed(1)}h this week`}/>
                    </div>
                    <div className="am-totals">
                      <span className="am-billable">{fmtH(a.weekHrs)} this week</span>
                      <span className="am-other">  target {a.target}h</span>
                    </div>
                  </div>
                  <div className="am-util">
                    <div className="am-util-val" style={{color: a.util >= 100 ? '#1d8a4a' : a.util >= 75 ? '#a87220' : '#a52822'}}>{a.util}%</div>
                    <div className="am-util-label">week util.</div>
                  </div>
                  <Icon name="chevronR" size={16}/>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}


const APP_META = {
  revit:      { name: 'Autodesk Revit',   color: '#3fb6e6', cls: 'revit' },
  acad:       { name: 'AutoCAD',          color: '#e8554e', cls: 'acad' },
  navisworks: { name: 'Navisworks',       color: '#f59e0b', cls: 'sketch' },
  civil3d:    { name: 'Civil 3D',         color: '#10b981', cls: 'teal' },
  sketchup:   { name: 'SketchUp',         color: '#f9a03f', cls: 'sketch' },
  teams:      { name: 'Teams',            color: '#6c7dd5', cls: 'teams' },
  outlook:    { name: 'Outlook',          color: '#4a90d9', cls: 'outlook' },
  pdf:        { name: 'PDF / Bluebeam',   color: '#9a6fe0', cls: 'pdf' },
  excel:      { name: 'Excel',            color: '#1d7a44', cls: 'teal' },
  word:       { name: 'Word',             color: '#1e56a0', cls: 'revit' },
  chrome:     { name: 'Chrome',           color: '#fbbc04', cls: 'sketch' },
  other:      { name: 'Other',            color: '#9ca3af', cls: 'other' },
};

function AppUsageSection({ userId }) {
  const [appData, setAppData] = useStateAM(null);
  const [loading, setLoading] = useStateAM(true);

  useEffectAM(() => {
    if (!userId) return;
    const today = new Date().toISOString().split('T')[0];
    window.SupaAppUsage.forDay(userId, today).then(agg => {
      setAppData(agg);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [userId]);

  const hasData = appData && Object.keys(appData).length > 0;
  const totalSecs = hasData ? Object.values(appData).reduce((s,v) => s+v, 0) : 0;

  const fmtSecs = (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}h ${String(m).padStart(2,'0')}m`;
  };

  return (
    <>
      <div className="section-title">
        <h2 style={{fontSize:15}}>App tracking   today</h2>
        <span className="hint">{hasData ? 'Live from desktop agent' : 'Requires Windows Desktop Agent'}</span>
      </div>
      {loading ? (
        <div className="card" style={{padding:'24px',textAlign:'center',color:'var(--text-muted)',fontSize:13}}>Loading </div>
      ) : !hasData ? (
        <div className="card" style={{padding:'32px 28px',textAlign:'center'}}>
          <div style={{width:52,height:52,borderRadius:12,background:'rgba(16,35,71,0.06)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 12px',color:'var(--brand-navy)'}}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
          </div>
          <p style={{margin:'0 0 4px',fontWeight:600,fontSize:14,color:'var(--text)'}}>Desktop agent not installed</p>
          <p style={{margin:'0 0 16px',fontSize:13,color:'var(--text-muted)',maxWidth:360,marginLeft:'auto',marginRight:'auto'}}>
            Install the NLA Windows agent on this employee's PC to track Revit, AutoCAD, Teams usage automatically.
          </p>
          <a href="/agent" target="_blank" style={{background:'var(--brand-navy)',color:'white',padding:'9px 18px',borderRadius:7,textDecoration:'none',fontSize:13,fontWeight:500}}>View setup guide  </a>
        </div>
      ) : (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Application breakdown   today</h3>
            <div className="card-sub">Focus time tracked by desktop agent   {fmtSecs(totalSecs)} total</div>
          </div>
          <table className="am-apps-table">
            <thead><tr><th>Application</th><th>Time</th><th>Share</th></tr></thead>
            <tbody>
              {Object.entries(appData)
                .sort(([,a],[,b]) => b - a)
                .map(([key, secs]) => {
                  const meta = APP_META[key] || APP_META.other;
                  const pct = totalSecs > 0 ? (secs / totalSecs * 100) : 0;
                  return (
                    <tr key={key}>
                      <td><span className={`bb-dot bb-${meta.cls}`}/>{meta.name}</td>
                      <td className="mono">{fmtSecs(secs)}</td>
                      <td>
                        <div className="am-share">
                          <div className="am-share-bar"><div className={`am-share-fill bb-${meta.cls}`} style={{width:`${pct}%`}}/></div>
                          <span>{pct.toFixed(0)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function ActivityDetail({ data, onBack }) {
  const days = ['Mon','Tue','Wed','Thu','Fri'];
  const maxDay = Math.max(...(data.weekByDay || [0]), 9);

  return (
    <div className="content">
      <button className="am-back" onClick={onBack}>
        <Icon name="chevronL" size={14}/> Back to Activity Monitor
      </button>

      <div className="am-detail-header">
        <div className="avatar lg">{data.initials}</div>
        <div style={{flex:1, minWidth:0}}>
          <h2 style={{margin:0}}>{data.name}</h2>
          <div className="am-detail-sub">{data.role}</div>
          <div className="am-detail-meta">
            <span className={`am-status-pill am-status-${data.status}`}>
              <span className="dot"/>
              {data.status === 'active' ? `Active   ${data.entriesCount} entries today` : 'No entries today'}
            </span>
          </div>
        </div>
        <div className="am-detail-metric">
          <div className="m-l">Today</div>
          <div className="m-v">{fmtH(data.todayHrs)}</div>
          <div className="m-s">{data.entriesCount} entr{data.entriesCount === 1 ? 'y' : 'ies'} logged</div>
        </div>
        <div className="am-detail-metric">
          <div className="m-l">This week</div>
          <div className="m-v">{data.weekHrs.toFixed(1)}<span style={{fontSize:14,opacity:0.6}}>/{data.target}h</span></div>
          <div className="m-s">{data.util}% utilization</div>
        </div>
      </div>

      {/* Project breakdown */}
      <div className="section-title">
        <h2 style={{fontSize:15}}>Projects   today</h2>
        <span className="hint">From logged timesheet entries</span>
      </div>
      <div className="card">
        {data.projects.length === 0 ? (
          <div style={{padding:'24px',textAlign:'center',color:'var(--text-muted)',fontSize:13}}>No entries logged today.</div>
        ) : (
          <table className="am-apps-table">
            <thead>
              <tr><th>Project</th><th>Hours</th><th>Share</th></tr>
            </thead>
            <tbody>
              {data.projects.map((p,i) => {
                const pct = data.todayHrs > 0 ? (p.hours / data.todayHrs) * 100 : 0;
                return (
                  <tr key={i}>
                    <td><span className="bb-dot bb-revit"/>{p.name}</td>
                    <td className="mono">{fmtH(p.hours)}</td>
                    <td>
                      <div className="am-share">
                        <div className="am-share-bar"><div className="am-share-fill bb-revit" style={{width:`${pct}%`}}/></div>
                        <span>{pct.toFixed(0)}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* App usage   real from desktop agent or placeholder */}
      <AppUsageSection userId={data.id} />

      {/* Week bars - real data */}
      <div className="col-7-5">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">This week</h3>
            <div className="card-sub">Daily hours logged   target 9h/day</div>
          </div>
          <div className="am-week">
            {(data.weekByDay || [0,0,0,0,0]).map((h, i) => {
              const pct = Math.min(100, (h / 9) * 100);
              const isToday = i === new Date().getDay() - 1;
              return (
                <div key={i} className="am-week-day">
                  <div className="am-week-bar-wrap">
                    <div className={`am-week-bar ${isToday ? 'today' : ''}`} style={{height:`${pct}%`}}/>
                  </div>
                  <div className="am-week-val">{h > 0 ? h.toFixed(1) : ' '}</div>
                  <div className="am-week-label">{days[i]}</div>
                </div>
              );
            })}
          </div>
          <div className="am-week-summary">
            Total: <b>{data.weekHrs.toFixed(1)}h</b> of {data.target}h target   {data.util}% utilization
          </div>
        </div>

        <div className="card stat" style={{alignSelf:'flex-start'}}>
          <div className="stat-label">Entries this week</div>
          <div className="stat-value">{data.weekByDay ? data.weekByDay.filter(h => h > 0).length : 0}<span className="unit">days active</span></div>
          <div className="stat-delta">{data.weekHrs.toFixed(1)}h / {data.target}h target</div>
        </div>
      </div>
    </div>
  );
}

window.ActivityMonitor = ActivityMonitor;
