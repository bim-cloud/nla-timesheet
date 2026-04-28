const Icon = window.Icon;
// -- Team Timesheet Overview ------------------------------------
// Shows weekly/monthly hours per employee with navigation

function TeamOverviewTable() {
  const [view, setView] = React.useState('week');           // 'week' | 'month'
  const [weekOffset, setWeekOffset] = React.useState(0);   // 0 = this week, -1 = last week etc
  const [monthOffset, setMonthOffset] = React.useState(0); // 0 = this month
  const [teamData, setTeamData] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [expandedRow, setExpandedRow] = React.useState(null);

  // -- Date helpers ---------------------------------------------
  const getWeekDates = (offset) => {
    const d = new Date();
    const day = d.getDay();
    d.setDate(d.getDate() - day + (day === 0 ? -6 : 1) + offset * 7);
    const mon = d.toISOString().split('T')[0];
    const fri = new Date(d); fri.setDate(d.getDate() + 4);
    return { from: mon, to: fri.toISOString().split('T')[0], days: 5 };
  };

  const getMonthDates = (offset) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + offset);
    const from = d.toISOString().split('T')[0];
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return { from, to: last.toISOString().split('T')[0], days: last.getDate() };
  };

  const getRange = () => view === 'week' ? getWeekDates(weekOffset) : getMonthDates(monthOffset);

  const fmtRangeLabel = () => {
    const { from, to } = getRange();
    const s = new Date(from + 'T00:00:00');
    const e = new Date(to + 'T00:00:00');
    if (view === 'week') {
      const isThisWeek = weekOffset === 0;
      const prefix = isThisWeek ? 'This week   ' : weekOffset === -1 ? 'Last week   ' : '';
      return prefix + s.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + '   ' +
             e.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } else {
      return s.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    }
  };

  // -- Data loading ---------------------------------------------
  const load = React.useCallback(async () => {
    setLoading(true);
    const { from, to } = getRange();
    const today = new Date().toISOString().split('T')[0];
    try {
      const [periodEntries, todayEntries, profiles] = await Promise.all([
        window.SupaEntries.teamSummary(from, to),
        window.SupaEntries.teamForDay(today),
        window.SupaProfiles.getAll(),
      ]);

      const todayByUser = {};
      todayEntries.forEach(e => {
        todayByUser[e.user_id] = (todayByUser[e.user_id] || 0) + parseFloat(e.hours);
      });

      const employees = profiles.filter(p => p.user_type === 'employee');

      const rows = employees.map(emp => {
        const empEntries = periodEntries.filter(e => e.user_id === emp.id);
        const totalHours = empEntries.reduce((s, e) => s + parseFloat(e.hours), 0);
        const byDate = {};
        empEntries.forEach(e => {
          byDate[e.date] = (byDate[e.date] || 0) + parseFloat(e.hours);
        });
        const submittedCount = empEntries.filter(e => e.status === 'submitted').length;
        const approvedCount  = empEntries.filter(e => e.status === 'approved').length;
        const lastProject = empEntries.length > 0 ? (empEntries[empEntries.length-1].project_name || empEntries[empEntries.length-1].project_id) : ' ';
        const target = view === 'week' ? 45 : 45 * 4;
        const util = target > 0 ? Math.round((totalHours / target) * 100) : 0;

        return {
          id: emp.id, name: emp.name, role: emp.role,
          initials: emp.initials,
          totalHours, byDate, target, util,
          hoursToday: todayByUser[emp.id] || 0,
          submittedCount, approvedCount,
          lastProject,
          daysActive: Object.keys(byDate).length,
        };
      });

      setTeamData(rows.sort((a,b) => b.totalHours - a.totalHours));
    } catch(e) { console.error('TeamOverview load error:', e); }
    setLoading(false);
  }, [view, weekOffset, monthOffset]);

  React.useEffect(() => { load(); }, [load]);

  const totalStudioHours = teamData.reduce((s, r) => s + r.totalHours, 0);
  const activeCount = teamData.filter(r => r.totalHours > 0).length;
  const projById = (id) => (window.DATA.PROJECTS || []).find(p => p.id === id);

  const utilColor = (u) => u >= 100 ? '#1d8a4a' : u >= 75 ? '#a87220' : u > 0 ? '#a52822' : 'var(--text-muted)';

  return (
    <div className="card">
      {/* -- Header ------------------------------------------- */}
      <div className="card-header" style={{flexWrap:'wrap',gap:10}}>
        <div>
          <h3 className="card-title">Team timesheet   {fmtRangeLabel()}</h3>
          <div className="card-sub">
            {loading ? 'Loading ' : `${activeCount} of ${teamData.length} employees logged hours   ${totalStudioHours.toFixed(1)}h total`}
          </div>
        </div>
        <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
          {/* View toggle */}
          <div style={{display:'flex',background:'var(--surface-muted)',borderRadius:7,padding:2,gap:2}}>
            {[['week','Week'],['month','Month']].map(([id,label]) => (
              <button key={id} onClick={() => { setView(id); setWeekOffset(0); setMonthOffset(0); }}
                style={{padding:'4px 12px',borderRadius:5,border:'none',cursor:'pointer',fontSize:12,
                  background: view===id ? 'white' : 'transparent',
                  fontWeight: view===id ? 600 : 400,
                  color: view===id ? 'var(--text)' : 'var(--text-muted)',
                  boxShadow: view===id ? '0 0 0 0.5px var(--border)' : 'none',
                }}>
                {label}
              </button>
            ))}
          </div>
          {/* Navigation */}
          <button className="btn btn-sm" onClick={() => view==='week' ? setWeekOffset(w=>w-1) : setMonthOffset(m=>m-1)}> </button>
          <button className="btn btn-sm"
            style={{fontSize:11}}
            onClick={() => view==='week' ? setWeekOffset(0) : setMonthOffset(0)}>
            {view==='week' ? 'This week' : 'This month'}
          </button>
          <button className="btn btn-sm"
            disabled={(view==='week'&&weekOffset>=0)||(view==='month'&&monthOffset>=0)}
            onClick={() => view==='week' ? setWeekOffset(w=>w+1) : setMonthOffset(m=>m+1)}> </button>
          {/* Export */}
          <button className="btn btn-sm" onClick={() => window.exportTeamExcel && window.exportTeamExcel()}
            style={{display:'flex',alignItems:'center',gap:4}}>
            <Icon name="download" size={12}/> Excel
          </button>
          <button className="btn btn-sm" onClick={() => window.exportTeamPDF && window.exportTeamPDF()}
            style={{display:'flex',alignItems:'center',gap:4,color:'#102347',borderColor:'#102347'}}>
            <Icon name="download" size={12}/> PDF
          </button>
          <button className="btn btn-sm" onClick={load} title="Refresh"><Icon name="refresh" size={13}/></button>
        </div>
      </div>

      {/* -- Summary stats strip ------------------------------- */}
      {!loading && teamData.length > 0 && (
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:0,borderBottom:'1px solid var(--border)'}}>
          {[
            ['Studio total', totalStudioHours.toFixed(1)+'h', 'Period hours logged'],
            ['Active staff', activeCount+' / '+teamData.length, 'Logged at least 1 entry'],
            ['Avg per person', teamData.length>0?(totalStudioHours/teamData.length).toFixed(1)+'h':' ', 'Studio average'],
            ['Avg utilization', teamData.length>0?Math.round(teamData.reduce((s,r)=>s+r.util,0)/teamData.length)+'%':' ', 'vs target'],
          ].map(([lbl,val,sub])=>(
            <div key={lbl} style={{padding:'12px 20px',borderRight:'1px solid var(--border)'}}>
              <div style={{fontSize:11,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.06em'}}>{lbl}</div>
              <div style={{fontSize:20,fontWeight:700,color:'var(--text)',fontFamily:'var(--font-mono)',margin:'3px 0 2px'}}>{val}</div>
              <div style={{fontSize:11,color:'var(--text-faint)'}}>{sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* -- Employee rows ------------------------------------- */}
      {loading ? (
        <div style={{padding:'32px',textAlign:'center',color:'var(--text-muted)',fontSize:13}}>Loading team data </div>
      ) : teamData.length === 0 ? (
        <div style={{padding:'32px',textAlign:'center',color:'var(--text-muted)',fontSize:13}}>
          No employee profiles found. Employees need to log in at least once to appear here.
        </div>
      ) : (
        <div style={{overflowX:'auto'}}>
          <table className="team-table">
            <thead>
              <tr>
                <th style={{width:220}}>Employee</th>
                <th>Last project</th>
                <th className="num" style={{width:80}}>Today</th>
                <th className="num" style={{width:100}}>{view==='week'?'Week hrs':'Month hrs'}</th>
                <th style={{width:140}}>Progress</th>
                <th className="num" style={{width:70}}>Util %</th>
                <th style={{width:90}}>Status</th>
                <th style={{width:40}}></th>
              </tr>
            </thead>
            <tbody>
              {teamData.map(row => {
                const pct = Math.min(100, row.util);
                const isExpanded = expandedRow === row.id;
                return (
                  <React.Fragment key={row.id}>
                    <tr style={{cursor:'pointer'}} onClick={() => setExpandedRow(isExpanded ? null : row.id)}>
                      <td>
                        <div className="team-cell-emp">
                          <div className="avatar">{row.initials}</div>
                          <div>
                            <div className="name">{row.name}</div>
                            <div className="role">{row.role}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{color:'var(--text-muted)',fontSize:12}}>{row.lastProject}</td>
                      <td className="num" style={{fontWeight: row.hoursToday>0?600:400, color: row.hoursToday>0?'var(--accent)':'var(--text-muted)'}}>
                        {row.hoursToday > 0 ? row.hoursToday.toFixed(1)+'h' : ' '}
                      </td>
                      <td className="num" style={{fontWeight:600}}>{row.totalHours > 0 ? row.totalHours.toFixed(1)+'h' : ' '}</td>
                      <td>
                        <div className="util-bar" style={{height:6}}>
                          <span style={{width:`${pct}%`, background: utilColor(row.util), borderRadius:3}}/>
                        </div>
                        <div style={{fontSize:10,color:'var(--text-faint)',marginTop:2}}>{row.totalHours.toFixed(1)} / {row.target}h</div>
                      </td>
                      <td className="num" style={{fontWeight:700, color: utilColor(row.util)}}>{row.util}%</td>
                      <td>
                        {row.approvedCount > 0 ? (
                          <span className="badge success" style={{fontSize:10}}>Approved</span>
                        ) : row.submittedCount > 0 ? (
                          <span className="badge warning" style={{fontSize:10}}>Pending</span>
                        ) : row.totalHours > 0 ? (
                          <span className="badge" style={{fontSize:10}}>Draft</span>
                        ) : (
                          <span className="badge" style={{fontSize:10,color:'var(--text-faint)'}}>No entries</span>
                        )}
                      </td>
                      <td style={{textAlign:'center',color:'var(--text-muted)'}}>
                        {isExpanded ? ' ' : ' '}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={8} style={{padding:0,background:'var(--surface-muted)'}}>
                          <TeamEmployeeBreakdown employee={row} range={getRange()} view={view} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{background:'rgba(16,35,71,0.04)'}}>
                <td colSpan={2} style={{padding:'10px 12px',fontWeight:600,fontSize:13}}>Studio Total</td>
                <td className="num" style={{fontWeight:600}}>{teamData.reduce((s,r)=>s+r.hoursToday,0).toFixed(1)}h</td>
                <td className="num" style={{fontWeight:700,color:'var(--brand-navy)'}}>{totalStudioHours.toFixed(1)}h</td>
                <td colSpan={4}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

// -- Per-employee expanded breakdown ----------------------------
function TeamEmployeeBreakdown({ employee, range, view }) {
  const [entries, setEntries] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    window.SupaEntries.teamSummary(range.from, range.to)
      .then(all => {
        const mine = all.filter(e => e.user_id === employee.id);
        setEntries(mine);
        setLoading(false);
      }).catch(() => setLoading(false));
  }, [employee.id, range.from, range.to]);

  if (loading) return <div style={{padding:'16px 24px',fontSize:13,color:'var(--text-muted)'}}>Loading </div>;
  if (entries.length === 0) return <div style={{padding:'16px 24px',fontSize:13,color:'var(--text-muted)'}}>No entries in this period.</div>;

  // Group by date
  const byDate = {};
  entries.forEach(e => {
    if (!byDate[e.date]) byDate[e.date] = { hours: 0, projects: {} };
    byDate[e.date].hours += parseFloat(e.hours);
    const pk = e.project_name || e.project_id || ' ';
    byDate[e.date].projects[pk] = (byDate[e.date].projects[pk] || 0) + parseFloat(e.hours);
  });

  // Group by project
  const byProject = {};
  entries.forEach(e => {
    const pk = e.project_name || e.project_id || ' ';
    byProject[pk] = (byProject[pk] || 0) + parseFloat(e.hours);
  });

  const sortedDates = Object.keys(byDate).sort();
  const fmtDay = (d) => new Date(d+'T00:00:00').toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});

  return (
    <div style={{padding:'16px 24px 20px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
      {/* Daily breakdown */}
      <div>
        <div style={{fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--text-muted)',marginBottom:8}}>
          Daily hours
        </div>
        <table style={{width:'100%',fontSize:12,borderCollapse:'collapse'}}>
          <thead>
            <tr>
              <th style={{textAlign:'left',padding:'4px 8px',color:'var(--text-faint)',fontWeight:500}}>Date</th>
              <th style={{textAlign:'right',padding:'4px 8px',color:'var(--text-faint)',fontWeight:500}}>Hours</th>
              <th style={{textAlign:'left',padding:'4px 8px',color:'var(--text-faint)',fontWeight:500}}>Projects</th>
            </tr>
          </thead>
          <tbody>
            {sortedDates.map(date => (
              <tr key={date} style={{borderTop:'1px solid var(--border)'}}>
                <td style={{padding:'5px 8px',color:'var(--text)'}}>{fmtDay(date)}</td>
                <td style={{padding:'5px 8px',textAlign:'right',fontWeight:600,color:'var(--accent)',fontFamily:'var(--font-mono)'}}>{byDate[date].hours.toFixed(1)}h</td>
                <td style={{padding:'5px 8px',color:'var(--text-muted)',fontSize:11}}>
                  {Object.entries(byDate[date].projects).map(([p,h])=>`${p} (${h.toFixed(1)}h)`).join(', ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Project breakdown */}
      <div>
        <div style={{fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--text-muted)',marginBottom:8}}>
          By project
        </div>
        {Object.entries(byProject).sort(([,a],[,b])=>b-a).map(([proj,hrs]) => {
          const total = employee.totalHours || 1;
          const pct = (hrs/total)*100;
          return (
            <div key={proj} style={{marginBottom:8}}>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:3}}>
                <span style={{color:'var(--text)'}}>{proj}</span>
                <span style={{fontWeight:600,color:'var(--accent)',fontFamily:'var(--font-mono)'}}>{hrs.toFixed(1)}h   {pct.toFixed(0)}%</span>
              </div>
              <div style={{height:5,background:'var(--border)',borderRadius:3,overflow:'hidden'}}>
                <div style={{width:`${pct}%`,height:'100%',background:'#102347',borderRadius:3}}/>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


function ManagerStats() {
  const [stats, setStats] = React.useState({
    activeToday: ' ', totalToday: ' ', weekHrs: ' ', util: ' ', empCount: 0, pendingApprovals: ' ',
  });

  React.useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const getMonday = () => {
      const d = new Date(); const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      d.setDate(diff); return d.toISOString().split('T')[0];
    };
    Promise.all([
      window.SupaEntries.teamForDay(today),
      window.SupaEntries.teamSummary(getMonday(), today),
      window.SupaProfiles.getAll(),
    ]).then(([todayRows, weekRows, profiles]) => {
      const employees = profiles.filter(p => p.user_type === 'employee');
      const activeUsers = new Set(todayRows.map(e => e.user_id)).size;
      const todayHrs = todayRows.reduce((s, e) => s + parseFloat(e.hours), 0);
      const weekHrs = weekRows.reduce((s, e) => s + parseFloat(e.hours), 0);
      const weekTarget = employees.length * 45;
      const util = weekTarget > 0 ? Math.round((weekHrs / weekTarget) * 100) : 0;
      window.SupaEntries.getPendingSubmissions().then(pending => {
        const groups = new Set(pending.map(e => e.user_id + e.date?.slice(0,7)));
        setStats({
          activeToday: String(activeUsers),
          totalToday: todayHrs.toFixed(1),
          weekHrs: weekHrs.toFixed(1),
          util: util + '%',
          empCount: employees.length,
          pendingApprovals: String(groups.size),
        });
      }).catch(() => {
        setStats({
          activeToday: String(activeUsers),
          totalToday: todayHrs.toFixed(1),
          weekHrs: weekHrs.toFixed(1),
          util: util + '%',
          empCount: employees.length,
          pendingApprovals: '0',
        });
      });
    }).catch(() => {});
  }, []);

  const rows = [
    { label: 'Active today',    value: stats.activeToday, unit: `of ${stats.empCount}`, delta: 'Logged entries today',   deltaClass: '' },
    { label: 'Team hrs today',  value: stats.totalToday,  unit: 'hrs',                  delta: `${stats.empCount * 8}h target`, deltaClass: '' },
    { label: 'Hrs this week',   value: stats.weekHrs,     unit: 'hrs',                  delta: `${stats.util} utilization`,    deltaClass: 'up' },
    { label: 'Pending approvals', value: stats.pendingApprovals, unit: '', delta: 'Submitted timesheets', deltaClass: stats.pendingApprovals !== '0' ? 'up' : '' },
  ];
  return (
    <div className="stats-row">
      {rows.map(s => (
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
  const [submissions, setSubmissions] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [acting, setActing] = React.useState(null);
  const [reviewing, setReviewing] = React.useState(null);

  const load = () => {
    window.SupaEntries.getPendingSubmissions().then(rows => {
      // Group by user_id + week (monday date)
      const grouped = {};
      rows.forEach(e => {
        const d = new Date(e.date + 'T00:00:00');
        const day = d.getDay();
        const monday = new Date(d);
        monday.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
        const key = `${e.user_id}__${monday.toISOString().split('T')[0]}`;
        if (!grouped[key]) {
          grouped[key] = {
            key,
            userId: e.user_id,
            monday: monday.toISOString().split('T')[0],
            profile: e.profiles,
            hours: 0,
            entries: [],
            submittedAt: e.created_at,
          };
        }
        grouped[key].hours += parseFloat(e.hours);
        grouped[key].entries.push(e.id);
        if (e.created_at > grouped[key].submittedAt) grouped[key].submittedAt = e.created_at;
      });
      setSubmissions(Object.values(grouped));
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  React.useEffect(() => { load(); }, []);

  const fmtWeek = (monday) => {
    const d = new Date(monday + 'T00:00:00');
    const fri = new Date(d); fri.setDate(d.getDate() + 4);
    return `Week of ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}   ${fri.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
  };

  const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  const approve = async (sub) => {
    setActing(sub.key + '_approve');
    const weekLabel = fmtWeek(sub.monday);
    await window.SupaEntries.approveSubmission(sub.entries, sub.userId, weekLabel);
    load();
    setActing(null);
  };

  const reject = async (sub) => {
    setActing(sub.key + '_reject');
    const weekLabel = fmtWeek(sub.monday);
    await window.SupaEntries.rejectSubmission(sub.entries, sub.userId, weekLabel);
    load();
    setActing(null);
  };

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h3 className="card-title">Pending approvals</h3>
          <div className="card-sub">
            {loading ? 'Loading ' : `${submissions.length} awaiting review`}
          </div>
        </div>
        <button className="btn btn-sm" onClick={load}><Icon name="refresh" size={14}/></button>
      </div>

      {loading ? (
        <div className="empty" style={{padding: '20px', color: 'var(--text-muted)', fontSize: 13}}>Loading </div>
      ) : submissions.length === 0 ? (
        <div className="empty" style={{padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13}}>
            All caught up   no pending timesheets.
        </div>
      ) : submissions.map(sub => {
        const p = sub.profile;
        const initials = p?.initials || (p?.name || '?').split(' ').map(s => s[0]).join('').slice(0,2).toUpperCase();
        return (
          <div key={sub.key} className="request">
            <div className="avatar">{initials}</div>
            <div className="req-body">
              <p className="req-title">
                {p?.name || sub.userId}   <span style={{fontWeight: 400, color: 'var(--text-muted)'}}>Timesheet</span>
              </p>
              <p className="req-sub">{fmtWeek(sub.monday)}   {sub.hours.toFixed(1)} hrs total</p>
              <p className="req-sub" style={{fontSize: 11.5, marginTop: 2, color: 'var(--text-faint)'}}>
                Submitted {fmtDate(sub.submittedAt)}
              </p>
            </div>
            <div className="req-actions">
              <button className="btn btn-sm" disabled={!!acting}
                onClick={() => setReviewing(sub)}>
                <Icon name="eye" size={14}/> Review
              </button>
              <button
                className="btn btn-sm"
                disabled={!!acting}
                onClick={() => reject(sub)}
                style={{color: 'var(--red, #c0392b)'}}
              >
                {acting === sub.key + '_reject' ? ' ' : <><Icon name="x" size={14}/> Reject</>}
              </button>
              <button
                className="btn btn-sm btn-primary"
                disabled={!!acting}
                onClick={() => approve(sub)}
              >
                {acting === sub.key + '_approve' ? ' ' : <><Icon name="check" size={14}/> Approve</>}
              </button>
            </div>
          </div>
        );
      })}
    {reviewing && (
      <ReviewModal
        sub={reviewing}
        onClose={() => setReviewing(null)}
        onApprove={() => approve(reviewing)}
        onReject={() => reject(reviewing)}
      />
    )}
    </div>
  );
}

// -- Timesheet Review Modal -------------------------------------
function ReviewModal({ sub, onClose, onApprove, onReject }) {
  const [entries, setEntries] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [comment, setComment] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  React.useEffect(() => {
    if (!sub) return;
    // Load all entries for this employee's week
    const today = new Date().toISOString().split('T')[0];
    const friday = new Date(sub.monday + 'T00:00:00');
    friday.setDate(friday.getDate() + 4);
    const fridayStr = friday.toISOString().split('T')[0];
    window.SupaEntries.teamSummary(sub.monday, fridayStr).then(all => {
      setEntries(all.filter(e => e.user_id === sub.userId));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [sub?.key]);

  if (!sub) return null;
  const p = sub.profile;
  const initials = p?.initials || (p?.name||'?')[0].toUpperCase();

  const fmtDay = (d) => new Date(d+'T00:00:00').toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});

  // Group by date
  const byDate = {};
  entries.forEach(e => {
    if (!byDate[e.date]) byDate[e.date] = [];
    byDate[e.date].push(e);
  });

  const total = entries.reduce((s,e) => s+parseFloat(e.hours), 0);

  const sendComment = async () => {
    if (!comment.trim()) return;
    setSending(true);
    // Save comment as notification to employee
    if (window.SupaNotifications) {
      await window.SupaNotifications.create(
        sub.userId, 'info',
        'Manager comment on your timesheet',
        comment.trim()
      );
    }
    setSent(true);
    setSending(false);
    setComment('');
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={e=>e.stopPropagation()} style={{maxWidth:560,maxHeight:'85vh',display:'flex',flexDirection:'column'}}>
        {/* Header */}
        <div style={{padding:'18px 24px 14px',borderBottom:'1px solid var(--border)',flexShrink:0}}>
          <div style={{display:'flex',alignItems:'center',gap:12,justifyContent:'space-between'}}>
            <div style={{display:'flex',alignItems:'center',gap:12}}>
              <div className="avatar">{initials}</div>
              <div>
                <h3 style={{margin:0,fontSize:15}}>{p?.name || sub.userId}</h3>
                <div style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>
                  Week of {new Date(sub.monday+'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}
                  {'   '}{total.toFixed(1)}h total
                </div>
              </div>
            </div>
            <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',fontSize:20,color:'var(--text-muted)'}}> </button>
          </div>
        </div>

        {/* Daily breakdown */}
        <div style={{overflowY:'auto',flex:1,padding:'16px 24px'}}>
          {loading ? (
            <div style={{textAlign:'center',color:'var(--text-muted)',fontSize:13,padding:'20px'}}>Loading entries </div>
          ) : Object.keys(byDate).sort().map(date => (
            <div key={date} style={{marginBottom:16}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                <span style={{fontSize:12,fontWeight:600,color:'var(--text)'}}>{fmtDay(date)}</span>
                <span style={{fontSize:12,fontWeight:700,color:'var(--accent)',fontFamily:'var(--font-mono)'}}>
                  {byDate[date].reduce((s,e)=>s+parseFloat(e.hours),0).toFixed(1)}h
                </span>
              </div>
              {byDate[date].map(e => (
                <div key={e.id} style={{display:'flex',justifyContent:'space-between',padding:'6px 10px',
                  background:'var(--surface-muted)',borderRadius:6,marginBottom:4,fontSize:12}}>
                  <div>
                    <span style={{fontWeight:500,color:'var(--text)'}}>{e.project_name||e.project_id}</span>
                    {e.title && e.title !== 'Weekly timesheet   '+e.project_name && (
                      <span style={{color:'var(--text-muted)',marginLeft:6}}>  {e.title}</span>
                    )}
                  </div>
                  <span style={{fontFamily:'var(--font-mono)',fontWeight:600,color:'var(--text)'}}>{parseFloat(e.hours).toFixed(1)}h</span>
                </div>
              ))}
            </div>
          ))}

          {/* Comment box */}
          <div style={{borderTop:'1px solid var(--border)',paddingTop:16,marginTop:8}}>
            <label style={{fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--text-muted)',display:'block',marginBottom:6}}>
              Send comment to employee
            </label>
            {sent && <div style={{fontSize:12,color:'#1d8a4a',marginBottom:8}}>  Comment sent as notification</div>}
            <textarea
              value={comment}
              onChange={e=>setComment(e.target.value)}
              placeholder="e.g. Please split project hours more accurately "
              style={{width:'100%',height:70,border:'1px solid var(--border)',borderRadius:7,padding:'8px 10px',
                fontFamily:'var(--font-sans)',fontSize:13,resize:'vertical',outline:'none',
                background:'var(--surface)',color:'var(--text)'}}
            />
            <button className="btn btn-sm" onClick={sendComment} disabled={!comment.trim()||sending}
              style={{marginTop:6}}>
              {sending ? 'Sending ' : 'Send comment'}
            </button>
          </div>
        </div>

        {/* Actions */}
        <div style={{padding:'14px 24px',borderTop:'1px solid var(--border)',display:'flex',gap:8,justifyContent:'flex-end',flexShrink:0}}>
          <button className="btn" onClick={onClose}>Close</button>
          <button className="btn btn-sm" onClick={() => { onReject(); onClose(); }}
            style={{color:'var(--red,#c0392b)'}}>
            <Icon name="x" size={13}/> Reject
          </button>
          <button className="btn btn-sm btn-primary" onClick={() => { onApprove(); onClose(); }}>
            <Icon name="check" size={13}/> Approve
          </button>
        </div>
      </div>
    </div>
  );
}

function ProjectHours() {
  const [totals, setTotals] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [view, setView] = React.useState('week');
  const [offset, setOffset] = React.useState(0);
  const projById = (id) => window.DATA.PROJECTS.find(p => p.id === id);

  const getRange = React.useCallback(() => {
    if (view === 'week') {
      const d = new Date(); const day = d.getDay();
      d.setDate(d.getDate() - day + (day === 0 ? -6 : 1) + offset * 7);
      const from = d.toISOString().split('T')[0];
      const fri = new Date(d); fri.setDate(d.getDate() + 4);
      return { from, to: fri.toISOString().split('T')[0] };
    } else {
      const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + offset);
      const from = d.toISOString().split('T')[0];
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      return { from, to: last.toISOString().split('T')[0] };
    }
  }, [view, offset]);

  const fmtRangeLabel = () => {
    const { from, to } = getRange();
    const s = new Date(from + 'T00:00:00');
    if (view === 'week') {
      const e = new Date(to + 'T00:00:00');
      return s.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + '   ' + e.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    return s.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  };

  React.useEffect(() => {
    setLoading(true);
    const { from, to } = getRange();
    window.SupaEntries.teamSummary(from, to).then(rows => {
      const byProject = {};
      rows.forEach(e => {
        if (!byProject[e.project_id]) byProject[e.project_id] = { hours: 0, users: new Set() };
        byProject[e.project_id].hours += parseFloat(e.hours);
        byProject[e.project_id].users.add(e.user_id);
      });
      const result = Object.entries(byProject)
        .map(([id, d]) => ({ id, hours: d.hours, team: d.users.size }))
        .sort((a, b) => b.hours - a.hours);
      setTotals(result);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [view, offset]);

  return (
    <div className="card">
      <div className="card-header" style={{flexWrap:'wrap',gap:6}}>
        <div>
          <h3 className="card-title">Project hours   {fmtRangeLabel()}</h3>
          <div className="card-sub">{loading ? 'Loading ' : `${totals.length} active projects`}</div>
        </div>
        <div style={{display:'flex',gap:4,alignItems:'center'}}>
          <div style={{display:'flex',background:'var(--surface-muted)',borderRadius:7,padding:2,gap:2}}>
            {[['week','Week'],['month','Month']].map(([id,lbl]) => (
              <button key={id} onClick={() => { setView(id); setOffset(0); }}
                style={{padding:'3px 10px',borderRadius:5,border:'none',cursor:'pointer',fontSize:11,
                  background: view===id?'white':'transparent', fontWeight: view===id?600:400,
                  color: view===id?'var(--text)':'var(--text-muted)',
                  boxShadow: view===id?'0 0 0 0.5px var(--border)':'none'
                }}>{lbl}</button>
            ))}
          </div>
          <button className="btn btn-sm" onClick={() => setOffset(o=>o-1)}> </button>
          <button className="btn btn-sm" style={{fontSize:11}} onClick={() => setOffset(0)}>
            {view==='week'?'This week':'This month'}
          </button>
          <button className="btn btn-sm" disabled={offset>=0} onClick={() => setOffset(o=>o+1)}> </button>
        </div>
      </div>
      {loading ? (
        <div style={{padding: '16px', color: 'var(--text-muted)', fontSize: 13}}>Loading </div>
      ) : totals.length === 0 ? (
        <div style={{padding: '16px', color: 'var(--text-muted)', fontSize: 13}}>No hours logged this period.</div>
      ) : totals.map(pt => {
        const p = projById(pt.id);
        const budget = p ? 80 : 40;
        const pct = Math.min(100, (pt.hours / budget) * 100);
        const over = pt.hours > budget;
        return (
          <div key={pt.id} className="project-item">
            <div>
              <div className="pname">{p?.name || pt.id}</div>
              <div className="pmeta">{p?.code || pt.id}   {p?.client || ''}   {pt.team} {pt.team === 1 ? 'person' : 'people'}</div>
            </div>
            <div className={`util-bar ${over ? 'over' : ''}`} style={{width: '100%'}}>
              <span style={{width: `${pct}%`}}/>
            </div>
            <div className="phours">{pt.hours.toFixed(1)}h</div>
          </div>
        );
      })}
    </div>
  );
}

function WeekTotalsBars() {
  const [values, setValues] = React.useState([0,0,0,0,0]);
  const [dates, setDates] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [weekOffset, setWeekOffset] = React.useState(0);
  const DAY_LABELS = ['Mon','Tue','Wed','Thu','Fri'];

  const getWeekDates = React.useCallback((offset) => {
    const d = new Date(); const day = d.getDay();
    d.setDate(d.getDate() - day + (day === 0 ? -6 : 1) + offset * 7);
    return Array.from({length: 5}, (_, i) => {
      const x = new Date(d); x.setDate(d.getDate() + i);
      return x.toISOString().split('T')[0];
    });
  }, []);

  const fmtWeekLabel = (dates) => {
    const s = new Date(dates[0] + 'T00:00:00');
    const e = new Date(dates[4] + 'T00:00:00');
    return s.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + '   ' +
           e.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  React.useEffect(() => {
    const weekDates = getWeekDates(weekOffset);
    setDates(weekDates);
    setLoading(true);
    window.SupaEntries.teamSummary(weekDates[0], weekDates[4]).then(rows => {
      const byDay = [0,0,0,0,0];
      rows.forEach(e => {
        const idx = weekDates.indexOf(e.date);
        if (idx >= 0) byDay[idx] += parseFloat(e.hours);
      });
      setValues(byDay);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [weekOffset]);

  const max = Math.max(...values, 10);
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="card">
      <div className="card-header" style={{flexWrap:'wrap',gap:6}}>
        <div>
          <h3 className="card-title">Team hours   {dates.length ? fmtWeekLabel(dates) : ' '}</h3>
          <div className="card-sub">Daily totals   all employees</div>
        </div>
        <div style={{display:'flex',gap:4}}>
          <button className="btn btn-sm" onClick={() => setWeekOffset(w=>w-1)}> </button>
          <button className="btn btn-sm" style={{fontSize:11}} onClick={() => setWeekOffset(0)} disabled={weekOffset===0}>
            This week
          </button>
          <button className="btn btn-sm" disabled={weekOffset>=0} onClick={() => setWeekOffset(w=>w+1)}> </button>
        </div>
      </div>
      <div className="day-bars" style={{height: 120}}>
        {DAY_LABELS.map((d, i) => {
          const isToday = dates[i] === today && weekOffset === 0;
          return (
            <div key={d} className="day-bar">
              <div className="bar" style={{height: '100%', position: 'relative'}}>
                <div className="fill" style={{
                  height: loading ? '0%' : `${(values[i]/max)*100}%`,
                  background: isToday ? 'var(--accent)' : undefined,
                  transition: 'height 0.4s ease',
                }}/>
                <div style={{
                  position: 'absolute', top: -18, left: 0, right: 0, textAlign: 'center',
                  fontSize: 10.5, fontFamily: 'var(--font-mono)',
                  color: isToday ? 'var(--accent)' : 'var(--text-muted)',
                  fontWeight: isToday ? 600 : 400,
                }}>{values[i] > 0 ? values[i].toFixed(1) + 'h' : ' '}</div>
              </div>
              <div className="label" style={{fontWeight: isToday ? 600 : 400}}>{d}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


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
    if (h === 0) return ' ';
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
      {/* Stats strip   matches Activity Monitor pattern */}
      <div className="stats-row" style={{marginTop: 6}}>
        <div className="card stat">
          <div className="stat-label">Studio billable   {rangeLabel}</div>
          <div className="stat-value">{fmtDec(appTotalSum)}<span className="unit">hrs</span></div>
          <div className="stat-delta">of {fmtDec(studioTarget)}h target   {fmtDec(studioOther)}h not billed</div>
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
          <div className="stat-delta">{fmtDec(topApp.hours)}h   {Math.round((topApp.hours / studioTotal) * 100)}% of tracked</div>
        </div>
        <div className="card stat">
          <div className="stat-label">Highest utilization</div>
          <div className="stat-value" style={{fontSize: 22}}>{topEmpObj.name.split(' ')[0]}</div>
          <div className="stat-delta">{Math.round(topEmp.util)}%   {fmtDec(topEmp.billable)}h billable</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header" style={{display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap'}}>
          <div>
            <h3 className="card-title">Time breakdown by application</h3>
            <div className="card-sub">Desktop agent   focus time only (app active + mouse/keyboard within 2 min)</div>
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
            <div className="au-split-title">Studio time mix   {rangeLabel}</div>
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
              Hover any slice to isolate it   totals update live when you change the range
            </div>
          </div>
        </div>

        {/* Per-employee list   same row shape as Activity Monitor */}
        <div className="am-list">
          <div className="am-row am-row-head">
            <div>
              <button className="tb-sort" onClick={() => setSortBy('name')}>Employee</button>
            </div>
            <div className="am-now-label" style={{marginBottom: 0}}>Top apps</div>
            <div className="am-now-label" style={{marginBottom: 0}}>Distribution</div>
            <div style={{textAlign: 'right'}}>
              <button className={`tb-sort ${sortBy === 'billable' ? 'on' : ''}`} onClick={() => setSortBy('billable')}>
                Billable {sortBy === 'billable' ? ' ' : ''}
              </button>
            </div>
            <div style={{textAlign: 'right'}}>
              <button className={`tb-sort ${sortBy === 'util' ? 'on' : ''}`} onClick={() => setSortBy('util')}>
                Util {sortBy === 'util' ? ' ' : ''}
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
                      <span key={a.k} className="au-chip" title={`${APP_META[a.k].name}   ${fmt(a.h)}`}>
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
                        title={`${APP_META[k].name}   ${fmt(r.apps[k])}`}
                      />
                    ))}
                    {r.other > 0 && <div className="au-seg bb-other" style={{width: `${(r.other / r.total) * 100}%`}} title={`Other   ${fmt(r.other)}`}/>}
                  </div>
                  <div className="am-totals">
                    <span className="am-billable">{fmtDec(r.billable)}h billable</span>
                    <span className="am-other">  {fmtDec(r.other)}h other</span>
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
  const nav = activeNav || 'overview';
  const todayStr = new Date().toLocaleDateString('en-GB', {weekday:'long',day:'numeric',month:'long',year:'numeric'});
  const weekNum = Math.ceil((new Date() - new Date(new Date().getFullYear(),0,1)) / 604800000);

  return (
    <div className="content">

      {/* -- Overview (default) ------------------------------- */}
      {(nav === 'overview' || nav === 'dashboard') && (
        <>
          <div className="section-title" style={{marginTop:0}}>
            <h2>Studio snapshot</h2>
            <span className="hint">{todayStr}   Week {weekNum}</span>
          </div>
          <ManagerStats />
          <TeamOverviewTable />
          <div className="section-title">
            <h2>Projects & approvals</h2>
            <span className="hint">This week   all active projects</span>
          </div>
          <div className="col-8-4">
            <ProjectHours />
            <div className="col-stack">
              <Approvals />
              <WeekTotalsBars />
            </div>
          </div>
          <AppUsageBreakdown />
        </>
      )}

      {/* -- Approvals ---------------------------------------- */}
      {nav === 'approvals' && (
        <>
          <div className="section-title" style={{marginTop:0}}>
            <h2>Pending approvals</h2>
            <span className="hint">Review and approve submitted timesheets</span>
          </div>
          <Approvals />
        </>
      )}

      {/* -- Projects ----------------------------------------- */}
      {nav === 'projects' && (
        <>
          <div className="section-title" style={{marginTop:0}}>
            <h2>Projects</h2>
            <span className="hint">Hours by project this week</span>
          </div>
          <ProjectHours />
          <div className="section-title">
            <h2>Weekly team hours</h2>
            <span className="hint">Daily breakdown across the studio</span>
          </div>
          <WeekTotalsBars />
        </>
      )}

      {/* -- Reports ------------------------------------------ */}
      {nav === 'reports' && (
        <>
          <div className="section-title" style={{marginTop:0}}>
            <h2>Reports</h2>
            <span className="hint">Export team timesheets for payroll</span>
          </div>
          <div className="card" style={{padding:'24px 28px'}}>
            <div className="card-header" style={{marginBottom:20}}>
              <div>
                <h3 className="card-title">Team timesheet export</h3>
                <div className="card-sub">Download this week's team data as Excel or PDF</div>
              </div>
            </div>
            <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
              <button
                className="btn btn-primary"
                style={{display:'flex',alignItems:'center',gap:8,padding:'10px 20px'}}
                onClick={() => window.exportTeamExcel && window.exportTeamExcel()}>
                <Icon name="download" size={15}/> Export Team Excel
              </button>
              <button
                className="btn"
                style={{display:'flex',alignItems:'center',gap:8,padding:'10px 20px',color:'#102347',borderColor:'#102347'}}
                onClick={() => window.exportTeamPDF && window.exportTeamPDF()}>
                <Icon name="download" size={15}/> Export Team PDF
              </button>
            </div>
            <div style={{marginTop:24,paddingTop:20,borderTop:'1px solid var(--border)'}}>
              <div className="card-sub" style={{marginBottom:12}}>Team summary   this week</div>
              <ManagerStats />
            </div>
          </div>
        </>
      )}

      {/* -- Activity ----------------------------------------- */}
      {nav === 'activity' && {window.ActivityMonitor && React.createElement(window.ActivityMonitor)}}

      {/* -- Users -------------------------------------------- */}
      {nav === 'users' && (
        <>
          <div className="section-title" style={{marginTop:0}}>
            <h2>Users & access</h2>
            <span className="hint">Add accounts, reset passwords, manage roles</span>
          </div>
          {window.UsersAdmin && React.createElement(window.UsersAdmin)}
        </>
      )}

    </div>
  );
}

window.ManagerView = ManagerView;
