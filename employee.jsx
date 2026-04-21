const { useState: useStateEmp, useEffect: useEffectEmp, useMemo: useMemoEmp } = React;

function ClockCard({ clockState, setClockState, activity, user }) {
  const [now, setNow] = useStateEmp(new Date());
  useEffectEmp(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const tz = user?.tz || 'Asia/Dubai';
  const tzLabel = user?.tzLabel || 'UAE';
  const hourNow = parseInt(now.toLocaleTimeString('en-GB', { timeZone: tz, hour: '2-digit', hour12: false }));
  const isBreak = hourNow === 13;
  const beforeWork = hourNow < 9;
  const afterWork = hourNow >= 18;

  const fmt = (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };
  const running = clockState === 'working';
  const idleSec = Math.floor(activity.idleSeconds);
  const showIdleLabel = running && activity.idle;
  return (
    <div className="clock-card">
      <div style={{position: 'relative', zIndex: 2, minWidth: 0, flex: 1}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap'}}>
          <div className="clock-label" style={{margin: 0}}>Tracking · Dubai Creek Harbor F09</div>
          <span className="activity-pill" style={{background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#c9d3e6'}}>
            {now.toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true })} {tzLabel} · Shift 9:00 AM–6:00 PM
          </span>
          {running && (
            <span className={`activity-pill ${activity.idle ? 'idle' : ''}`}>
              <span className="pulse"/>
              {activity.idle ? `Idle · ${idleSec}s` : 'Active'}
            </span>
          )}
          {isBreak && <span className="activity-pill idle"><span className="pulse"/>Break time · 1:00 PM–2:00 PM</span>}
        </div>
        <div className="clock-time">{fmt(activity.activeElapsed)}</div>
        <div className="clock-status">
          <span className={`clock-dot ${running && !activity.idle ? '' : 'off'}`} />
          {running && !activity.idle && 'Clocked in at 8:42 AM · Timer follows your activity'}
          {showIdleLabel && 'Timer paused — move mouse or press a key to resume'}
          {clockState === 'break' && 'On break — started 1:12 PM'}
          {clockState === 'stopped' && 'Not clocked in'}
        </div>
        {running && (
          <div className="activity-split">
            <div className="activity-cell">
              <div className="l">Active time</div>
              <div className="v">{fmt(activity.activeElapsed)}</div>
              <div className="sv">Counted toward timesheet</div>
            </div>
            <div className="activity-cell">
              <div className="l">Total session</div>
              <div className="v">{fmt(activity.totalElapsed)}</div>
              <div className="sv">Wall clock since clock-in</div>
            </div>
          </div>
        )}
      </div>
      <div className="clock-actions">
        {clockState === 'stopped' ? (
          <button className="clock-btn start" onClick={() => setClockState('working')}>
            <Icon name="play" /> Clock in
          </button>
        ) : (
          <>
            <button className="clock-btn stop" onClick={() => setClockState('stopped')}>
              <Icon name="pause" /> Clock out
            </button>
            <button className="clock-btn break" onClick={() => setClockState(clockState === 'break' ? 'working' : 'break')}>
              <Icon name="coffee" /> {clockState === 'break' ? 'Resume' : 'Take break'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function StatCards({ featuresEnabled }) {
  const stats = [
    { label: 'Today', value: '6.75', unit: 'hrs', delta: 'Target 8h · 9am–6pm (1h break)', deltaClass: '' },
    { label: 'This week', value: '32.5', unit: '/ 40 hrs', delta: '7.5 hrs remaining', deltaClass: '' },
    { label: 'Overtime this month', value: '4.25', unit: 'hrs', delta: 'Within policy (≤8)', deltaClass: 'up' },
    { label: 'Leave balance', value: '18', unit: 'days', delta: '2 pending request', deltaClass: '' },
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

function TodayEntries({ entries, setEntries, userId }) {
  const [draft, setDraft] = useStateEmp({ project: 'dch-f09', type: 'design', title: '', hours: '' });
  const [saving, setSaving] = useStateEmp(false);
  const total = entries.reduce((s, e) => s + e.hours, 0);

  const addEntry = async () => {
    if (!draft.title || !draft.hours) return;
    const newEntry = {
      project: draft.project,
      type: draft.type,
      title: draft.title,
      notes: '',
      hours: parseFloat(draft.hours),
    };
    setSaving(true);
    // Save to Supabase
    const saved = await window.SupaEntries.add(userId, newEntry);
    if (saved) {
      setEntries([...entries, { ...newEntry, id: saved.id }]);
    } else {
      // Fallback: save locally if Supabase fails
      setEntries([...entries, { ...newEntry, id: `e${Date.now()}` }]);
    }
    setDraft({ project: draft.project, type: draft.type, title: '', hours: '' });
    setSaving(false);
  };

  const removeEntry = async (id) => {
    setEntries(entries.filter(e => e.id !== id));
    await window.SupaEntries.remove(id);
  };

  const projById = (id) => window.DATA.PROJECTS.find(p => p.id === id);
  const typeById = (id) => window.DATA.TASK_TYPES.find(t => t.id === id);

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h3 className="card-title">Today · Monday, April 20</h3>
          <div className="card-sub">Working hours 9:00 AM–6:00 PM · Break 1:00 PM–2:00 PM · Log as you go</div>
        </div>
        <div style={{display: 'flex', gap: 6}}>
          <button className="btn btn-sm"><Icon name="filter" size={14}/> Filter</button>
        </div>
      </div>

      <div className="entries">
        {entries.map(e => {
          const p = projById(e.project);
          const t = typeById(e.type);
          return (
            <div key={e.id} className="entry-row">
              <div className="entry-icon">{p?.code?.split('-')[0]?.substring(0,2)}</div>
              <div>
                <p className="entry-title">{e.title}</p>
                {e.notes && <p className="entry-notes">{e.notes}</p>}
              </div>
              <div>
                <div className="entry-project">{p?.name}</div>
                <span className={`entry-tag ${t?.cls}`} style={{marginTop: 4, display: 'inline-block'}}>{t?.label}</span>
              </div>
              <div className="entry-hours">{e.hours.toFixed(2)}h</div>
              <div />
              <button className="entry-menu" onClick={() => removeEntry(e.id)}><Icon name="x" size={14}/></button>
            </div>
          );
        })}
      </div>

      <div className="add-entry">
        <input
          className="input"
          placeholder="What did you work on? e.g. Revit hardscape modeling"
          value={draft.title}
          onChange={(e) => setDraft({...draft, title: e.target.value})}
          onKeyDown={(e) => e.key === 'Enter' && addEntry()}
        />
        <select className="select" value={draft.project} onChange={(e) => setDraft({...draft, project: e.target.value})}>
          {window.DATA.PROJECTS.map(p => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
        </select>
        <input
          className="input"
          type="number"
          step="0.25"
          placeholder="0.00"
          value={draft.hours}
          onChange={(e) => setDraft({...draft, hours: e.target.value})}
          onKeyDown={(e) => e.key === 'Enter' && addEntry()}
          style={{textAlign: 'right', fontFamily: 'var(--font-mono)'}}
        />
        <button className="btn btn-primary" onClick={addEntry}><Icon name="plus" size={14}/> Add</button>
      </div>

      <div className="entries-footer">
        <span style={{color: 'var(--text-muted)'}}>
          {entries.length} {entries.length === 1 ? 'entry' : 'entries'} · Auto-saved
        </span>
        <span className="total">Today total: {total.toFixed(2)} hrs</span>
      </div>
    </div>
  );
}

function WeeklyGrid() {
  const days = ['Mon 14', 'Tue 15', 'Wed 16', 'Thu 17', 'Fri 18'];
  const [grid, setGrid] = useStateEmp(window.DATA.WEEK_DATA);

  const projById = (id) => window.DATA.PROJECTS.find(p => p.id === id);
  const updateCell = (ri, ci, v) => {
    const copy = grid.map(r => ({...r, hours: [...r.hours]}));
    copy[ri].hours[ci] = parseFloat(v) || 0;
    setGrid(copy);
  };

  const rowTotal = (r) => r.hours.reduce((s, x) => s + x, 0);
  const colTotal = (ci) => grid.reduce((s, r) => s + r.hours[ci], 0);
  const grand = grid.reduce((s, r) => s + rowTotal(r), 0);

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h3 className="card-title">Week of April 14 – April 18</h3>
          <div className="card-sub">Weekly timesheet · Submit to manager when complete</div>
        </div>
        <div style={{display: 'flex', gap: 6, alignItems: 'center'}}>
          <span className="badge info">Draft</span>
          <button className="btn btn-sm"><Icon name="chevronL" size={14}/></button>
          <button className="btn btn-sm">This week</button>
          <button className="btn btn-sm"><Icon name="chevronR" size={14}/></button>
          <button className="btn btn-sm btn-primary"><Icon name="send" size={14}/> Submit</button>
        </div>
      </div>

      <div style={{overflowX: 'auto'}}>
        <table className="week-grid">
          <thead>
            <tr>
              <th style={{width: '40%'}}>Project</th>
              {days.map(d => <th key={d} className="day-col">{d}</th>)}
              <th className="total-col">Total</th>
            </tr>
          </thead>
          <tbody>
            {grid.map((row, ri) => {
              const p = projById(row.project);
              return (
                <tr key={row.project}>
                  <td>
                    <div className="week-project">
                      {p.name}
                      <div className="proj-sub">{p.code} · {p.client}</div>
                    </div>
                  </td>
                  {row.hours.map((h, ci) => (
                    <td key={ci} className={`week-cell ${h > 0 ? 'has-value' : 'empty'}`}>
                      <input
                        type="number"
                        step="0.25"
                        value={h === 0 ? '' : h}
                        placeholder="—"
                        onChange={(e) => updateCell(ri, ci, e.target.value)}
                      />
                    </td>
                  ))}
                  <td className="week-total">{rowTotal(row).toFixed(2)}</td>
                </tr>
              );
            })}
            <tr className="week-total-row">
              <td><div className="week-project">Daily total</div></td>
              {days.map((_, ci) => (
                <td key={ci} className="week-total">{colTotal(ci).toFixed(2)}</td>
              ))}
              <td className="week-total">{grand.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LeaveCard() {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h3 className="card-title">Leave balance</h3>
          <div className="card-sub">2026 allowance</div>
        </div>
        <button className="btn btn-sm btn-primary"><Icon name="plus" size={14}/> Request leave</button>
      </div>
      <div className="leave-grid">
        <div className="leave-stat">
          <div className="n">18</div>
          <div className="l">Annual leave remaining</div>
        </div>
        <div className="leave-stat">
          <div className="n">6</div>
          <div className="l">Sick leave remaining</div>
        </div>
        <div className="leave-stat">
          <div className="n">2</div>
          <div className="l">Pending requests</div>
        </div>
      </div>
    </div>
  );
}

function WeekBars() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const values = [8.0, 8.25, 7.5, 8.0, 6.75];
  const max = 10;
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h3 className="card-title">Hours this week</h3>
          <div className="card-sub">Daily totals · 8h target</div>
        </div>
        <span className="badge info"><span className="dot"/>On track</span>
      </div>
      <div className="day-bars">
        {days.map((d, i) => (
          <div key={d} className="day-bar">
            <div className="bar" style={{height: '100%'}}>
              <div className="fill" style={{height: `${(values[i]/max)*100}%`}}/>
            </div>
            <div className="label">{d}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DesktopAgentBanner() {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr auto',
      gap: 18,
      padding: '18px 22px',
      background: 'linear-gradient(135deg, #102347 0%, #1a3260 100%)',
      color: '#fff',
      borderRadius: 'var(--radius-lg)',
      marginBottom: 22,
      alignItems: 'center',
    }}>
      <div style={{display: 'flex', gap: 14, alignItems: 'center'}}>
        <div style={{
          width: 44, height: 44, borderRadius: 10,
          background: 'rgba(255,255,255,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
            <rect x="3" y="4" width="18" height="12" rx="1"/>
            <path d="M8 20h8M12 16v4"/>
          </svg>
        </div>
        <div>
          <div style={{fontSize: 14, fontWeight: 600}}>
            Install the Windows desktop agent
          </div>
        </div>
      </div>
      <div style={{display: 'flex', gap: 8}}>
        <a
          href="NLA Desktop Agent.html"
          target="_blank"
          rel="noopener"
          style={{
            background: '#fff', color: '#102347',
            padding: '9px 16px', borderRadius: 8,
            fontSize: 13, fontWeight: 600,
            textDecoration: 'none',
            display: 'inline-flex', alignItems: 'center', gap: 8,
          }}
        >
          <Icon name="download" size={14}/> Download for Windows
        </a>
        <a
          href="NLA Desktop Agent.html"
          target="_blank"
          rel="noopener"
          style={{
            border: '1px solid rgba(255,255,255,0.25)', color: '#fff',
            padding: '9px 14px', borderRadius: 8,
            fontSize: 13, fontWeight: 500,
            textDecoration: 'none',
          }}
        >
          Preview agent
        </a>
      </div>
    </div>
  );
}

function EmployeeView({ featuresEnabled, user }) {
  const [clockState, setClockState] = useStateEmp('working');
  const [entries, setEntries] = useStateEmp([]);
  const [entriesLoading, setEntriesLoading] = useStateEmp(true);

  // Load today's entries from Supabase on mount
  useEffectEmp(() => {
    if (!user?.id) return;
    const today = new Date().toISOString().split('T')[0];
    window.SupaEntries.forDay(user.id, today).then(rows => {
      // Map Supabase rows to local shape
      const mapped = rows.map(r => ({
        id:      r.id,
        project: r.project_id,
        type:    r.task_type,
        title:   r.title,
        notes:   r.notes || '',
        hours:   parseFloat(r.hours),
      }));
      setEntries(mapped);
      setEntriesLoading(false);
    }).catch(() => {
      // Fallback to sample data if Supabase unreachable
      setEntries(window.DATA.TODAY_ENTRIES);
      setEntriesLoading(false);
    });
  }, [user?.id]);
  const activity = window.useActivityTracker({ enabled: clockState === 'working', idleThresholdSec: 120 });
  // seed in prior hours for realism
  const baseActive = 6.75 * 3600;
  const baseTotal = 7.1 * 3600;
  const displayActivity = {
    ...activity,
    activeElapsed: baseActive + activity.activeElapsed,
    totalElapsed: baseTotal + activity.totalElapsed,
  };

  return (
    <div className="content">
      <DesktopAgentBanner />
      <ClockCard clockState={clockState} setClockState={setClockState} activity={displayActivity} user={user} />

      <div className="section-title">
        <h2>This week</h2>
        <span className="hint">Mon, Apr 14 – Fri, Apr 18 · Week 16</span>
      </div>
      <StatCards featuresEnabled={featuresEnabled} />

      <div className="col-8-4">
        <TodayEntries entries={entries} setEntries={setEntries} userId={user?.id} />
        <WeekBars />
      </div>

      <div className="section-title">
        <h2>Weekly timesheet</h2>
        <span className="hint">Grid view · Edit hours inline</span>
      </div>
      <WeeklyGrid />

      <div className="section-title">
        <h2>Time off</h2>
      </div>
      <LeaveCard />
    </div>
  );
}

window.EmployeeView = EmployeeView;
