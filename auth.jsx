// --- Auth store (localStorage-backed) ---
// Seed users. Manager (admin) can add/reset passwords.
const AUTH_KEY = 'nla_users_v3';
const SESSION_KEY = 'nla_session_v1';
const RESET_KEY = 'nla_resets_v1';

const SEED_USERS = [
  { id: 'admin', username: 'admin', password: 'admin123', name: 'Sanil', role: 'Studio Director', type: 'manager', initials: 'SN', tz: 'Asia/Dubai', tzLabel: 'UAE' },
  { id: 'sanil', username: 'sanil', password: 'welcome123', name: 'Sanil', role: 'Studio Manager', type: 'manager', initials: 'SN', tz: 'Asia/Dubai', tzLabel: 'UAE' },
  { id: 'adithya', username: 'adithya', password: 'welcome123', name: 'Adithya', role: 'Studio Manager', type: 'manager', initials: 'AD', tz: 'Asia/Kolkata', tzLabel: 'IST' },
  { id: 'afsal', username: 'afsal', password: 'welcome123', name: 'Afsal Badrudeen', role: 'BIM Architect', type: 'employee', initials: 'AB', tz: 'Asia/Dubai', tzLabel: 'UAE' },
  { id: 'sandra', username: 'sandra', password: 'welcome123', name: 'Sandra', role: 'BIM Architect', type: 'employee', initials: 'SA', tz: 'Asia/Dubai', tzLabel: 'UAE' },
  { id: 'rivin', username: 'rivin', password: 'welcome123', name: 'Rivin Wilson', role: 'BIM Engineer', type: 'employee', initials: 'RW', tz: 'Asia/Kolkata', tzLabel: 'IST' },
  { id: 'mehnas', username: 'mehnas', password: 'welcome123', name: 'Mehnas N Manzoor', role: 'BIM Engineer', type: 'employee', initials: 'MM', tz: 'Asia/Dubai', tzLabel: 'UAE' },
  { id: 'elbin', username: 'elbin', password: 'welcome123', name: 'Elbin Paulose', role: 'BIM Engineer', type: 'employee', initials: 'EP', tz: 'Asia/Kolkata', tzLabel: 'IST' },
];

const Auth = {
  getUsers() {
    try {
      const raw = localStorage.getItem(AUTH_KEY);
      if (!raw) {
        localStorage.setItem(AUTH_KEY, JSON.stringify(SEED_USERS));
        return SEED_USERS;
      }
      return JSON.parse(raw);
    } catch { return SEED_USERS; }
  },
  saveUsers(users) { localStorage.setItem(AUTH_KEY, JSON.stringify(users)); },
  getSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; }
  },
  setSession(user) { localStorage.setItem(SESSION_KEY, JSON.stringify(user)); },
  clearSession() { localStorage.removeItem(SESSION_KEY); },
  login(username, password) {
    const u = Auth.getUsers().find(x => x.username.toLowerCase() === username.toLowerCase());
    if (!u) return { ok: false, error: 'No account found with that username.' };
    if (u.password !== password) return { ok: false, error: 'Incorrect password.' };
    Auth.setSession(u);
    // Sync profile to Supabase in background
    if (window.SupaProfiles) window.SupaProfiles.upsert(u);
    return { ok: true, user: u };
  },
  addUser(u) {
    const users = Auth.getUsers();
    if (users.find(x => x.username.toLowerCase() === u.username.toLowerCase())) {
      return { ok: false, error: 'Username already exists.' };
    }
    const id = u.username.toLowerCase().replace(/[^a-z0-9]/g, '');
    const initials = u.name.split(/\s+/).map(s => s[0]).join('').slice(0,2).toUpperCase();
    const newUser = { ...u, id, initials };
    users.push(newUser);
    Auth.saveUsers(users);
    // Sync to Supabase immediately
    if (window.SupaProfiles) {
      window.SupaProfiles.upsert({
        id, username: u.username, name: u.name,
        role: u.role || '', type: u.type || 'employee',
        initials, tz: u.tz || 'Asia/Dubai', tzLabel: u.tzLabel || 'UAE',
      });
      // Also sync password
      if (window.SupaPasswords && u.password) {
        window.SupaPasswords.update(id, u.password);
      }
    }
    return { ok: true };
  },
  updatePassword(id, newPassword) {
    const users = Auth.getUsers();
    const u = users.find(x => x.id === id);
    if (!u) return { ok: false };
    u.password = newPassword;
    Auth.saveUsers(users);
    // Sync to Supabase — profiles table password column
    if (window.sb) {
      window.sb.from('profiles').update({ password: newPassword }).eq('id', id).then(({ error }) => {
        if (error) console.warn('Supabase updatePassword error:', error.message);
        else console.log('Password synced to Supabase for:', id);
      });
    }
    return { ok: true };
  },
  removeUser(id) {
    const users = Auth.getUsers().filter(x => x.id !== id);
    Auth.saveUsers(users);
    // Remove from Supabase
    if (window.sb) {
      window.sb.from('profiles').delete().eq('id', id).then(({ error }) => {
        if (error) console.warn('Supabase removeUser error:', error.message);
      });
    }
  },
  updateUser(id, patch) {
    const users = Auth.getUsers();
    const u = users.find(x => x.id === id);
    if (!u) return { ok: false };
    Object.assign(u, patch);
    // Keep tzLabel in sync with tz when tz changes
    if (patch.tz && !patch.tzLabel) {
      u.tzLabel = patch.tz === 'Asia/Dubai' ? 'UAE'
                : patch.tz === 'Asia/Kolkata' ? 'IST'
                : patch.tz === 'Europe/London' ? 'UK'
                : patch.tz === 'America/New_York' ? 'EST'
                : u.tzLabel || 'UAE';
    }
    Auth.saveUsers(users);
    return { ok: true };
  },
  // Password reset requests (forgot password flow)
  getResets() {
    try { return JSON.parse(localStorage.getItem(RESET_KEY)) || []; } catch { return []; }
  },
  addReset(username) {
    const resets = Auth.getResets();
    resets.push({ id: `r${Date.now()}`, username, at: new Date().toISOString(), status: 'pending' });
    localStorage.setItem(RESET_KEY, JSON.stringify(resets));
  },
  clearReset(id) {
    const resets = Auth.getResets().filter(r => r.id !== id);
    localStorage.setItem(RESET_KEY, JSON.stringify(resets));
  },
};

window.Auth = Auth;

// --- Login screen ---
function LoginScreen({ onLogin }) {
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');
  const [forgot, setForgot] = React.useState(false);

  const submit = (e) => {
    e.preventDefault();
    const r = Auth.login(username.trim(), password);
    if (!r.ok) { setError(r.error); setSuccess(''); return; }
    onLogin(r.user);
  };

  const sendReset = async (e) => {
    e.preventDefault();
    if (!username.trim()) { setError('Enter your username first.'); return; }

    // Check username exists
    const u = Auth.getUsers().find(x => x.username.toLowerCase() === username.trim().toLowerCase());
    if (!u) { setError('No account found with that username.'); return; }

    Auth.addReset(username.trim());

    // Notify manager via EmailJS (browser-based, no server needed)
    try {
      const EMAILJS_SERVICE  = window.NLA_EMAILJS_SERVICE  || '';
      const EMAILJS_TEMPLATE = window.NLA_EMAILJS_TEMPLATE || '';
      const EMAILJS_KEY      = window.NLA_EMAILJS_KEY      || '';
      if (EMAILJS_SERVICE && EMAILJS_TEMPLATE && EMAILJS_KEY) {
        await window.emailjs.send(EMAILJS_SERVICE, EMAILJS_TEMPLATE, {
          to_email:      'sanil@naturelandscapearchitects.com',
          to_name:       'Sanil',
          employee_name: u.name,
          username:      u.username,
          request_time:  new Date().toLocaleString('en-GB', { timeZone: 'Asia/Dubai', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' UAE',
          dashboard_url: 'https://nla-timesheet-5jc7.vercel.app',
        }, EMAILJS_KEY);
      }
    } catch(err) {
      console.warn('Email notification failed:', err);
    }

    setSuccess('Reset request sent. Sanil will be notified and will share your new password shortly.');
    setError('');
    setForgot(false);
  };

  return (
    <div className="login-shell">
      <div className="login-panel">
        <div className="login-card">
          <div className="brand">
            <img src="assets/nature-logo.png" alt="Nature Landscape Architects" />
          </div>
          <h1>{forgot ? 'Reset your password' : 'Sign in'}</h1>
          <p className="sub">
            {forgot
              ? 'Enter your username and we will ask admin to issue a new password.'
              : 'Welcome back. Sign in to log your hours.'}
          </p>

          {error && <div className="login-error">{error}</div>}
          {success && <div className="login-success">{success}</div>}

          <form onSubmit={forgot ? sendReset : submit}>
            <div className="field">
              <label htmlFor="u">Username</label>
              <input
                id="u"
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                autoComplete="username"
                placeholder="Username"
              />
            </div>
            {!forgot && (
              <div className="field">
                <div className="field-row">
                  <label htmlFor="p">Password</label>
                  <a className="hint-link" onClick={(e) => { e.preventDefault(); setForgot(true); setError(''); setSuccess(''); }}>
                    Forgot password?
                  </a>
                </div>
                <input
                  id="p"
                  type="password"
                  className="input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="Enter password"
                />
              </div>
            )}
            <button className="login-btn" disabled={!username || (!forgot && !password)}>
              {forgot ? 'Send reset request' : 'Sign in'}
            </button>
            {forgot && (
              <button
                type="button"
                className="btn"
                style={{width: '100%', marginTop: 8, justifyContent: 'center'}}
                onClick={() => { setForgot(false); setError(''); setSuccess(''); }}
              >Back to sign in</button>
            )}
          </form>


        </div>
      </div>

      <div className="login-hero">
        <div>
          <div className="hero-kicker">Timesheet · BIM Studio</div>
          <h2>Effortless Work Logging</h2>
          <p>
            Built to work quietly alongside you, capturing your design time without
            distractions or manual input. A seamless, unobtrusive experience that keeps
            your workflow uninterrupted while ensuring your efforts are consistently reflected.
          </p>
        </div>
        <div className="login-hero-footer">
          © 2026 Nature Landscape Architects · Internal tool
        </div>
      </div>
    </div>
  );
}

window.LoginScreen = LoginScreen;

// --- Change Password Modal -------------------------------------
function ChangePasswordModal({ user, open, onClose }) {
  const [current, setCurrent] = React.useState('');
  const [newPw, setNewPw] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [showCurrent, setShowCurrent] = React.useState(false);
  const [showNew, setShowNew] = React.useState(false);

  React.useEffect(() => {
    if (open) { setCurrent(''); setNewPw(''); setConfirm(''); setError(''); setSuccess(''); }
  }, [open]);

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!current) { setError('Enter your current password.'); return; }
    if (newPw.length < 6) { setError('New password must be at least 6 characters.'); return; }
    if (newPw !== confirm) { setError('New passwords do not match.'); return; }
    if (current === newPw) { setError('New password must be different from current.'); return; }

    setLoading(true);
    // Verify current password
    const u = Auth.getUsers().find(x => x.id === user.id);
    if (!u || u.password !== current) {
      setError('Current password is incorrect.');
      setLoading(false);
      return;
    }
    // Update locally + Supabase
    Auth.updatePassword(user.id, newPw);
    // Update session
    const updated = { ...u, password: newPw };
    Auth.setSession(updated);
    setSuccess('Password changed successfully!');
    setLoading(false);
    setCurrent(''); setNewPw(''); setConfirm('');
    setTimeout(onClose, 1500);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{maxWidth: 420}}>
        <div style={{padding: '22px 28px 12px', borderBottom: '1px solid var(--border)'}}>
          <div style={{display: 'flex', gap: 12, alignItems: 'center'}}>
            <div style={{
              width: 38, height: 38, borderRadius: 9,
              background: 'rgba(16,35,71,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--brand-navy)',
            }}>
              <Icon name="eye" size={18}/>
            </div>
            <div>
              <h3 style={{margin: 0, fontSize: 15}}>Change password</h3>
              <p style={{margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)'}}>
                {user.name} · {user.username}
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={submit} style={{padding: '20px 28px 24px'}}>
          {error && <div className="auth-error" style={{marginBottom: 12}}>{error}</div>}
          {success && <div className="login-success" style={{marginBottom: 12}}>{success}</div>}

          <div className="field" style={{marginBottom: 12}}>
            <label>Current password</label>
            <div style={{position: 'relative'}}>
              <input
                type={showCurrent ? 'text' : 'password'}
                className="input"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                placeholder="Your current password"
                autoFocus
              />
              <button type="button" onClick={() => setShowCurrent(!showCurrent)}
                style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',
                  background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',fontSize:11}}>
                {showCurrent ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <div className="field" style={{marginBottom: 12}}>
            <label>New password</label>
            <div style={{position: 'relative'}}>
              <input
                type={showNew ? 'text' : 'password'}
                className="input"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="Min. 6 characters"
              />
              <button type="button" onClick={() => setShowNew(!showNew)}
                style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',
                  background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',fontSize:11}}>
                {showNew ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <div className="field" style={{marginBottom: 16}}>
            <label>Confirm new password</label>
            <input
              type="password"
              className="input"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat new password"
            />
          </div>

          <div style={{display: 'flex', gap: 8, justifyContent: 'flex-end'}}>
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || !current || !newPw || !confirm}
            >
              {loading ? 'Saving…' : 'Change password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

window.ChangePasswordModal = ChangePasswordModal;
