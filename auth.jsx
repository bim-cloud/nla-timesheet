// ─── Auth store (localStorage-backed) ───
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
    users.push({ ...u, id, initials });
    Auth.saveUsers(users);
    return { ok: true };
  },
  updatePassword(id, newPassword) {
    const users = Auth.getUsers();
    const u = users.find(x => x.id === id);
    if (!u) return { ok: false };
    u.password = newPassword;
    Auth.saveUsers(users);
    return { ok: true };
  },
  removeUser(id) {
    const users = Auth.getUsers().filter(x => x.id !== id);
    Auth.saveUsers(users);
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

// ─── Login screen ───
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

  const sendReset = (e) => {
    e.preventDefault();
    if (!username.trim()) { setError('Enter your username first.'); return; }
    Auth.addReset(username.trim());
    setSuccess('Password reset request sent to admin. You will be notified when it is reset.');
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
                placeholder="e.g. afsal"
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
