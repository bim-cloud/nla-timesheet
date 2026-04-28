// --- Activity / idle detection hook ---
// Mimics Autodesk Revit/AutoCAD time-tracking behavior:
// - tracks mouse move, click, key, wheel, scroll
// - after IDLE_THRESHOLD of inactivity, marks session idle and pauses the "active" counter
// - "total" counter keeps running (wall clock) while clocked in
// - returns { active, idle, totalElapsed, activeElapsed, idleSeconds, lastActivityAt }

function useActivityTracker({ enabled, idleThresholdSec = 120 }) {
  const [active, setActive] = React.useState(true);
  const [lastActivityAt, setLastActivityAt] = React.useState(Date.now());
  const [totalElapsed, setTotalElapsed] = React.useState(0);
  const [activeElapsed, setActiveElapsed] = React.useState(0);
  const lastTick = React.useRef(Date.now());
  const lastAct = React.useRef(Date.now());

  React.useEffect(() => {
    if (!enabled) return;
    const bump = () => {
      lastAct.current = Date.now();
      setLastActivityAt(Date.now());
      setActive(true);
    };
    const evs = ['mousemove', 'mousedown', 'keydown', 'wheel', 'scroll', 'touchstart'];
    evs.forEach(e => window.addEventListener(e, bump, { passive: true }));
    return () => evs.forEach(e => window.removeEventListener(e, bump));
  }, [enabled]);

  React.useEffect(() => {
    if (!enabled) return;
    lastTick.current = Date.now();
    lastAct.current = Date.now();
    const t = setInterval(() => {
      const now = Date.now();
      const dt = (now - lastTick.current) / 1000;
      lastTick.current = now;
      const sinceAct = (now - lastAct.current) / 1000;
      const isIdle = sinceAct >= idleThresholdSec;
      setActive(!isIdle);
      setTotalElapsed(e => e + dt);
      if (!isIdle) setActiveElapsed(e => e + dt);
    }, 1000);
    return () => clearInterval(t);
  }, [enabled, idleThresholdSec]);

  const idleSeconds = Math.max(0, (Date.now() - lastActivityAt) / 1000);
  return { active, idle: !active, totalElapsed, activeElapsed, idleSeconds };
}

window.useActivityTracker = useActivityTracker;

// --- User menu (topbar dropdown) ---
function UserMenu({ user, onLogout, onSwitchView }) {
  const [open, setOpen] = React.useState(false);
  const [changePwOpen, setChangePwOpen] = React.useState(false);
  const ref = React.useRef();
  React.useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  return (
    <>
      <div className="user-menu" ref={ref}>
        <button className="user-menu-trigger" onClick={() => setOpen(!open)}>
          <div className="avatar">{user.initials}</div>
          <div className="name">{user.name.split(' ')[0]}</div>
          <Icon name="chevronR" size={14}/>
        </button>
        {open && (
          <div className="user-menu-pop">
            <div className="who-block">
              <div className="n">{user.name}</div>
              <div className="e">{user.role}   @{user.username}</div>
            </div>
            <button onClick={() => { setOpen(false); setChangePwOpen(true); }}>
              <Icon name="eye" size={14}/> Change password
            </button>
            <button className="danger" onClick={() => { setOpen(false); onLogout(); }}>
              <Icon name="x" size={14}/> Sign out
            </button>
          </div>
        )}
      </div>
      <window.ChangePasswordModal
        user={user}
        open={changePwOpen}
        onClose={() => setChangePwOpen(false)}
      />
    </>
  );
}

window.UserMenu = UserMenu;

// --- Idle resume modal ---
function IdleModal({ idleFor, onResume, onDiscard }) {
  const mins = Math.floor(idleFor / 60);
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="modal-header">
          <h3>You've been idle for {mins} min</h3>
          <p>Your timer paused automatically, just like Revit's idle detection. Keep the idle time or discard it?</p>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onDiscard}>Discard idle time</button>
          <button className="btn btn-primary" onClick={onResume}>Keep &amp; resume</button>
        </div>
      </div>
    </div>
  );
}

window.IdleModal = IdleModal;

// Role presets + timezone presets   shared by the admin UI
const ROLE_PRESETS = [
  'Studio Director', 'Studio Manager', 'Project Manager',
  'BIM Architect', 'BIM Engineer', 'BIM Modeler',
  'Draughtsman', 'QA / QC', 'Intern',
];
const TZ_PRESETS = [
  { tz: 'Asia/Dubai',      tzLabel: 'UAE', title: 'UAE (GMT+4)' },
  { tz: 'Asia/Kolkata',    tzLabel: 'IST', title: 'India (GMT+5:30)' },
  { tz: 'Europe/London',   tzLabel: 'UK',  title: 'United Kingdom (GMT+0/+1)' },
  { tz: 'America/New_York',tzLabel: 'EST', title: 'US East (GMT-5/-4)' },
  { tz: 'Asia/Singapore',  tzLabel: 'SG',  title: 'Singapore (GMT+8)' },
];

// --- Users admin panel (manager) ---
function UsersAdmin() {
  const [users, setUsers] = React.useState(Auth.getUsers());
  const [resets, setResets] = React.useState(Auth.getResets());
  const [adding, setAdding] = React.useState(false);
  const [draft, setDraft] = React.useState({ username: '', name: '', role: 'BIM Engineer', type: 'employee', password: 'welcome123', tz: 'Asia/Dubai', tzLabel: 'UAE' });
  const [resetFor, setResetFor] = React.useState(null);
  const [newPw, setNewPw] = React.useState('');
  const [revealed, setRevealed] = React.useState({}); // id -> bool
  const [revealAll, setRevealAll] = React.useState(false);
  const [deleteFor, setDeleteFor] = React.useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = React.useState('');

  const session = Auth.getSession();
  const selfId = session?.id;

  const refresh = () => { setUsers(Auth.getUsers()); setResets(Auth.getResets()); };
  const [syncing, setSyncing] = React.useState(false);
  const [syncMsg, setSyncMsg] = React.useState('');

  const syncAllToSupabase = async () => {
    setSyncing(true);
    setSyncMsg('Syncing...');
    const allUsers = Auth.getUsers();
    let count = 0;
    for (const u of allUsers) {
      try {
        await window.SupaProfiles.upsert({
          id: u.id, username: u.username, name: u.name,
          role: u.role || '', type: u.type || 'employee',
          initials: u.initials || u.name.split(' ').map(s=>s[0]).join('').slice(0,2).toUpperCase(),
          tz: u.tz || 'Asia/Dubai', tzLabel: u.tzLabel || 'UAE',
        });
        // Sync password too
        if (u.password && window.sb) {
          await window.sb.from('profiles').update({ password: u.password }).eq('id', u.id);
        }
        count++;
      } catch(e) { console.warn('Sync error for', u.username, e); }
    }
    setSyncMsg(`Synced ${count}/${allUsers.length} users to Supabase`);
    setSyncing(false);
    setTimeout(() => setSyncMsg(''), 4000);
  };

  const toggleReveal = (id) => setRevealed(r => ({ ...r, [id]: !r[id] }));

  const patchUser = (id, patch) => {
    Auth.updateUser(id, patch);
    refresh();
  };

  const confirmDelete = () => {
    if (deleteConfirmText.trim().toLowerCase() !== deleteFor.username.toLowerCase()) return;
    Auth.removeUser(deleteFor.id);
    setDeleteFor(null);
    setDeleteConfirmText('');
    refresh();
  };

  const save = () => {
    const r = Auth.addUser(draft);
    if (!r.ok) { alert(r.error); return; }
    setAdding(false);
    setDraft({ username: '', name: '', role: 'BIM Engineer', type: 'employee', password: 'welcome123', tz: 'Asia/Dubai', tzLabel: 'UAE' });
    refresh();
  };

  const doReset = () => {
    if (!newPw || newPw.length < 6) { alert('Password must be at least 6 characters.'); return; }
    Auth.updatePassword(resetFor.id, newPw);
    // clear any pending reset requests for this user
    Auth.getResets().filter(r => r.username === resetFor.username).forEach(r => Auth.clearReset(r.id));
    setResetFor(null);
    setNewPw('');
    refresh();
    alert(`Password for ${resetFor.name} was reset. Please share the new password privately.`);
  };

  return (
    <>
      {resets.length > 0 && (
        <div className="card" style={{marginBottom: 18}}>
          <div className="card-header">
            <div>
              <h3 className="card-title">Password reset requests</h3>
              <div className="card-sub">{resets.length} pending   click "Reset password" to issue a new one</div>
            </div>
          </div>
          {resets.map(r => {
            const u = users.find(x => x.username.toLowerCase() === r.username.toLowerCase());
            return (
              <div key={r.id} className="request">
                <div className="avatar">{u?.initials || '?'}</div>
                <div className="req-body">
                  <p className="req-title">{u?.name || r.username} requested a password reset</p>
                  <p className="req-sub">@{r.username}   {new Date(r.at).toLocaleString()}</p>
                </div>
                <div className="req-actions">
                  <button className="btn btn-sm" onClick={() => { Auth.clearReset(r.id); refresh(); }}>Dismiss</button>
                  <button className="btn btn-sm btn-primary" onClick={() => u && setResetFor(u)}>Reset password</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">User accounts</h3>
            <div className="card-sub">{users.length} users   manage logins, roles, timezones & passwords</div>
          </div>
          <div style={{display: 'flex', gap: 8, alignItems: 'center'}}>
            <button
              className="btn btn-sm"
              onClick={() => setRevealAll(v => !v)}
              title={revealAll ? 'Hide all passwords' : 'Reveal all passwords'}
            >
              <Icon name={revealAll ? 'eyeOff' : 'eye'} size={14}/>
              {revealAll ? 'Hide passwords' : 'Show passwords'}
            </button>
            <button className="btn btn-sm" onClick={syncAllToSupabase} disabled={syncing}
              style={{fontSize:12,color:'#1d8a4a',borderColor:'#1d8a4a'}}
              title="Fix missing users in Supabase">
              {syncing ? 'Syncing...' : 'Sync   Supabase'}
            </button>
            {syncMsg && <span style={{fontSize:11,color:'#1d8a4a'}}>{syncMsg}</span>}
            <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}><Icon name="plus" size={14}/> Add user</button>
          </div>
        </div>

        <div style={{overflowX: 'auto'}}>
          <table className="users-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Username</th>
                <th>Role</th>
                <th>Access</th>
                <th>Timezone</th>
                <th style={{minWidth: 180}}>Password</th>
                <th style={{width: 150, textAlign: 'right'}}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const isSelf = u.id === selfId;
                const show = revealAll || revealed[u.id];
                return (
                  <tr key={u.id}>
                    <td>
                      <div className="team-cell-emp">
                        <div className="avatar">{u.initials}</div>
                        <div>
                          <div className="name">{u.name}{isSelf && <span className="badge" style={{marginLeft: 8, fontSize: 10}}>You</span>}</div>
                        </div>
                      </div>
                    </td>
                    <td><code>{u.username}</code></td>
                    <td>
                      <select
                        className="select select-inline"
                        value={ROLE_PRESETS.includes(u.role) ? u.role : '__custom__'}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === '__custom__') {
                            const r = prompt('Custom role title', u.role);
                            if (r && r.trim()) patchUser(u.id, { role: r.trim() });
                          } else {
                            patchUser(u.id, { role: v });
                          }
                        }}
                      >
                        {ROLE_PRESETS.map(r => <option key={r} value={r}>{r}</option>)}
                        {!ROLE_PRESETS.includes(u.role) && <option value={u.role}>{u.role}</option>}
                        <option value="__custom__">Custom </option>
                      </select>
                    </td>
                    <td>
                      <select
                        className="select select-inline"
                        value={u.type}
                        disabled={isSelf}
                        title={isSelf ? "You can't change your own access level" : 'Change access level'}
                        onChange={(e) => patchUser(u.id, { type: e.target.value })}
                      >
                        <option value="employee">Employee</option>
                        <option value="manager">Admin / Manager</option>
                      </select>
                    </td>
                    <td>
                      <select
                        className="select select-inline"
                        value={u.tz || 'Asia/Dubai'}
                        onChange={(e) => {
                          const preset = TZ_PRESETS.find(p => p.tz === e.target.value);
                          patchUser(u.id, { tz: e.target.value, tzLabel: preset?.tzLabel || u.tzLabel });
                        }}
                      >
                        {TZ_PRESETS.map(p => <option key={p.tz} value={p.tz}>{p.tzLabel}   {p.title}</option>)}
                      </select>
                    </td>
                    <td>
                      <div className="pw-cell">
                        <code className={`pw-dots ${show ? 'shown' : ''}`}>
                          {show ? u.password : '        '}
                        </code>
                        <button
                          className="btn-icon"
                          onClick={() => toggleReveal(u.id)}
                          title={show ? 'Hide password' : 'Show password'}
                        >
                          <Icon name={show ? 'eyeOff' : 'eye'} size={14}/>
                        </button>
                        <button
                          className="btn-icon"
                          onClick={() => { navigator.clipboard?.writeText(u.password); }}
                          title="Copy password"
                        >
                          <Icon name="copy" size={14}/>
                        </button>
                      </div>
                    </td>
                    <td style={{textAlign: 'right', whiteSpace: 'nowrap'}}>
                      <button className="btn btn-sm" onClick={() => setResetFor(u)} title="Issue a new password">
                        <Icon name="key" size={13}/> Reset
                      </button>
                      <button
                        className="btn btn-sm btn-danger-ghost"
                        style={{marginLeft: 6}}
                        onClick={() => setDeleteFor(u)}
                        disabled={isSelf}
                        title={isSelf ? "You can't delete your own account" : 'Delete user'}
                      >
                        <Icon name="trash" size={13}/>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {adding && (
        <div className="modal-backdrop" onClick={() => setAdding(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add user</h3>
              <p>Create a login for a new team member.</p>
            </div>
            <div className="modal-body">
              <div className="field">
                <label>Full name</label>
                <input className="input" value={draft.name} onChange={(e) => setDraft({...draft, name: e.target.value})} placeholder="e.g. Maya Joseph" />
              </div>
              <div className="field">
                <label>Username (for login)</label>
                <input className="input" value={draft.username} onChange={(e) => setDraft({...draft, username: e.target.value.toLowerCase()})} placeholder="e.g. maya" />
              </div>
              <div className="field">
                <label>Role</label>
                <select
                  className="select"
                  value={ROLE_PRESETS.includes(draft.role) ? draft.role : '__custom__'}
                  onChange={(e) => {
                    if (e.target.value === '__custom__') {
                      const r = prompt('Custom role title', draft.role || 'BIM Engineer');
                      if (r && r.trim()) setDraft({...draft, role: r.trim()});
                    } else {
                      setDraft({...draft, role: e.target.value});
                    }
                  }}
                >
                  {ROLE_PRESETS.map(r => <option key={r} value={r}>{r}</option>)}
                  {!ROLE_PRESETS.includes(draft.role) && draft.role && <option value={draft.role}>{draft.role}</option>}
                  <option value="__custom__">Custom </option>
                </select>
              </div>
              <div className="field">
                <label>Access level</label>
                <select className="select" value={draft.type} onChange={(e) => setDraft({...draft, type: e.target.value})}>
                  <option value="employee">Employee</option>
                  <option value="manager">Admin / Manager</option>
                </select>
              </div>
              <div className="field">
                <label>Timezone</label>
                <select className="select" value={draft.tz || 'Asia/Dubai'} onChange={(e) => {
                  const preset = TZ_PRESETS.find(p => p.tz === e.target.value);
                  setDraft({...draft, tz: e.target.value, tzLabel: preset?.tzLabel || 'UAE'});
                }}>
                  {TZ_PRESETS.map(p => <option key={p.tz} value={p.tz}>{p.tzLabel}   {p.title}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Initial password</label>
                <input className="input" value={draft.password} onChange={(e) => setDraft({...draft, password: e.target.value})} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setAdding(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save} disabled={!draft.name || !draft.username || !draft.password}>Create user</button>
            </div>
          </div>
        </div>
      )}

      {resetFor && (
        <div className="modal-backdrop" onClick={() => setResetFor(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Reset password for {resetFor.name}</h3>
              <p>Enter a new password. Share it privately with the user; they can change it after they log in.</p>
            </div>
            <div className="modal-body">
              <div className="field">
                <label>New password</label>
                <input className="input" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="min 6 characters" autoFocus />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => { setResetFor(null); setNewPw(''); }}>Cancel</button>
              <button className="btn btn-primary" onClick={doReset}>Reset password</button>
            </div>
          </div>
        </div>
      )}
      {deleteFor && (
        <div className="modal-backdrop" onClick={() => { setDeleteFor(null); setDeleteConfirmText(''); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{color: 'var(--danger)'}}>Delete {deleteFor.name}?</h3>
              <p>
                This permanently removes the account, their login, and ongoing access.
                Their historical timesheets remain for the record.
              </p>
            </div>
            <div className="modal-body">
              <div className="delete-summary">
                <div className="avatar lg">{deleteFor.initials}</div>
                <div>
                  <div style={{fontWeight: 600}}>{deleteFor.name}</div>
                  <div style={{color: 'var(--text-muted)', fontSize: 12.5}}>
                    @{deleteFor.username}   {deleteFor.role}   {deleteFor.tzLabel}
                  </div>
                </div>
              </div>
              <div className="field" style={{marginTop: 14}}>
                <label>Type the username <code>{deleteFor.username}</code> to confirm</label>
                <input
                  className="input"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder={deleteFor.username}
                  autoFocus
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => { setDeleteFor(null); setDeleteConfirmText(''); }}>Cancel</button>
              <button
                className="btn btn-danger"
                onClick={confirmDelete}
                disabled={deleteConfirmText.trim().toLowerCase() !== deleteFor.username.toLowerCase()}
              >
                <Icon name="trash" size={14}/> Delete user
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


// -- Notifications Panel ----------------------------------------
function NotificationsPanel({ user, open, onClose }) {
  const [notifs, setNotifs] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!open || !user?.id) return;
    setLoading(true);
    window.SupaNotifications.getForUser(user.id).then(data => {
      setNotifs(data);
      setLoading(false);
      // Mark all as read after opening
      window.SupaNotifications.markRead(user.id);
    }).catch(() => setLoading(false));
  }, [open, user?.id]);

  if (!open) return null;

  const icon = (type) => {
    if (type === 'approved') return { bg: 'rgba(29,138,74,0.12)', color: '#1d8a4a', symbol: ' ' };
    if (type === 'rejected') return { bg: 'rgba(165,40,34,0.10)', color: '#a52822', symbol: ' ' };
    return { bg: 'rgba(16,35,71,0.08)', color: '#102347', symbol: ' ' };
  };

  const fmtDate = (iso) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMin = Math.round((now - d) / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffH = Math.round(diffMin / 60);
    if (diffH < 24) return `${diffH}h ago`;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{maxWidth: 400, marginTop: 60, marginRight: 20, marginLeft: 'auto'}}>
        <div style={{padding: '18px 24px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
          <h3 style={{margin: 0, fontSize: 15}}>Notifications</h3>
          <button onClick={onClose} style={{background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-muted)', lineHeight: 1}}>&times;</button>
        </div>

        <div style={{maxHeight: 420, overflowY: 'auto'}}>
          {loading ? (
            <div style={{padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13}}>Loading </div>
          ) : notifs.length === 0 ? (
            <div style={{padding: '40px 24px', textAlign: 'center'}}>
              <div style={{fontSize: 32, marginBottom: 10}}> </div>
              <p style={{margin: 0, color: 'var(--text-muted)', fontSize: 13}}>No notifications yet.</p>
              <p style={{margin: '4px 0 0', color: 'var(--text-faint)', fontSize: 12}}>You will be notified when timesheets are approved or rejected.</p>
            </div>
          ) : notifs.map(n => {
            const ic = icon(n.type);
            return (
              <div key={n.id} style={{
                display: 'flex', gap: 12, padding: '14px 24px',
                borderBottom: '1px solid var(--border)',
                background: n.read ? 'transparent' : 'rgba(16,35,71,0.03)',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                  background: ic.bg, color: ic.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, fontWeight: 700,
                }}>{ic.symbol}</div>
                <div style={{flex: 1, minWidth: 0}}>
                  <div style={{fontSize: 13, fontWeight: n.read ? 400 : 600, color: 'var(--text)'}}>{n.title}</div>
                  {n.message && <div style={{fontSize: 12, color: 'var(--text-muted)', marginTop: 2}}>{n.message}</div>}
                  <div style={{fontSize: 11, color: 'var(--text-faint)', marginTop: 4}}>{fmtDate(n.created_at)}</div>
                </div>
                {!n.read && <div style={{width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, marginTop: 4}}/>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

window.NotificationsPanel = NotificationsPanel;

// -- Settings Modal ---------------------------------------------
function SettingsModal({ user, open, onClose }) {
  const [tab, setTab] = React.useState('profile');
  const [changePwOpen, setChangePwOpen] = React.useState(false);
  const [tz, setTz] = React.useState(user?.tz || 'Asia/Dubai');
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    if (open) { setTab('profile'); setSaved(false); }
  }, [open]);

  if (!open) return null;

  const TZ_OPTIONS = [
    { tz: 'Asia/Dubai',    label: 'UAE (GST +4)' },
    { tz: 'Asia/Kolkata',  label: 'India (IST +5:30)' },
    { tz: 'Europe/London', label: 'UK (GMT/BST)' },
    { tz: 'America/New_York', label: 'US East (EST/EDT)' },
  ];

  const saveProfile = () => {
    Auth.updateUser(user.id, { tz, tzLabel: TZ_OPTIONS.find(t => t.tz === tz)?.label?.split(' ')[0] || 'UAE' });
    const updated = Auth.getUsers().find(u => u.id === user.id);
    if (updated) Auth.setSession(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <>
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{maxWidth: 460}}>
          <div style={{padding: '20px 28px 0', borderBottom: '1px solid var(--border)'}}>
            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16}}>
              <h3 style={{margin: 0, fontSize: 15}}>Settings</h3>
              <button onClick={onClose} style={{background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-muted)', lineHeight: 1}}>&times;</button>
            </div>
            <div style={{display: 'flex', gap: 0}}>
              {[['profile','Profile'],['security','Security']].map(([id, label]) => (
                <button key={id} onClick={() => setTab(id)} style={{
                  padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: tab === id ? 600 : 400,
                  color: tab === id ? 'var(--accent)' : 'var(--text-muted)',
                  borderBottom: tab === id ? '2px solid var(--accent)' : '2px solid transparent',
                  marginBottom: -1,
                }}>{label}</button>
              ))}
            </div>
          </div>

          <div style={{padding: '24px 28px'}}>
            {tab === 'profile' && (
              <>
                {/* User info (read-only) */}
                <div style={{display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, padding: '14px 16px', background: 'var(--surface-muted)', borderRadius: 9}}>
                  <div style={{width: 44, height: 44, borderRadius: 10, background: 'rgba(16,35,71,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15, color: 'var(--brand-navy)'}}>
                    {user.initials}
                  </div>
                  <div>
                    <div style={{fontWeight: 600, fontSize: 14}}>{user.name}</div>
                    <div style={{fontSize: 12, color: 'var(--text-muted)'}}>{user.role}   @{user.username}</div>
                  </div>
                </div>

                {/* Timezone */}
                <div className="field" style={{marginBottom: 16}}>
                  <label>Timezone</label>
                  <select className="input select" value={tz} onChange={(e) => setTz(e.target.value)}>
                    {TZ_OPTIONS.map(t => (
                      <option key={t.tz} value={t.tz}>{t.label}</option>
                    ))}
                  </select>
                </div>

                {saved && <div className="login-success" style={{marginBottom: 12}}>Settings saved!</div>}

                <div style={{display: 'flex', gap: 8, justifyContent: 'flex-end'}}>
                  <button className="btn" onClick={onClose}>Cancel</button>
                  <button className="btn btn-primary" onClick={saveProfile}>Save changes</button>
                </div>
              </>
            )}

            {tab === 'security' && (
              <>
                <div style={{marginBottom: 20}}>
                  <div style={{fontSize: 14, fontWeight: 600, marginBottom: 4}}>Password</div>
                  <div style={{fontSize: 13, color: 'var(--text-muted)', marginBottom: 12}}>
                    Change your login password. You will need your current password.
                  </div>
                  <button className="btn btn-primary" onClick={() => { onClose(); setChangePwOpen(true); }}>
                    Change password
                  </button>
                </div>

                <div style={{borderTop: '1px solid var(--border)', paddingTop: 20}}>
                  <div style={{fontSize: 14, fontWeight: 600, marginBottom: 4}}>Session</div>
                  <div style={{fontSize: 13, color: 'var(--text-muted)', marginBottom: 12}}>
                    Signed in as <strong>{user.username}</strong>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <window.ChangePasswordModal
        user={user}
        open={changePwOpen}
        onClose={() => setChangePwOpen(false)}
      />
    </>
  );
}

window.SettingsModal = SettingsModal;
