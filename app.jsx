function ManagerUnlockModal({ open, onClose, onSuccess, user }) {
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  React.useEffect(() => { if (open) { setPassword(''); setError(''); } }, [open]);
  if (!open) return null;

  const submit = (e) => {
    e?.preventDefault?.();
    const res = Auth.login(user.username, password);
    if (res.ok) {
      sessionStorage.setItem('nla_mgr_unlocked', '1');
      onSuccess();
    } else {
      setError('Incorrect password. Admin access denied.');
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{maxWidth: 400}}>
        <div style={{padding: '24px 28px 8px', borderBottom: '1px solid var(--border)'}}>
          <div style={{display: 'flex', gap: 12, alignItems: 'center'}}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: 'rgba(16,35,71,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--brand-navy)'
            }}>
              <Icon name="eye" size={20} />
            </div>
            <div>
              <h3 style={{margin: 0, fontSize: 16}}>Admin access required</h3>
              <p style={{margin: '2px 0 0', fontSize: 12.5, color: 'var(--text-muted)'}}>
                Manager view shows other employees' activity
              </p>
            </div>
          </div>
        </div>
        <form onSubmit={submit} style={{padding: '20px 28px 24px'}}>
          <div className="field" style={{marginBottom: 12}}>
            <label>Confirm your password</label>
            <input
              type="password"
              className="input"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
            />
          </div>
          {error && <div className="auth-error" style={{marginBottom: 12}}>{error}</div>}
          <div style={{display: 'flex', gap: 8, justifyContent: 'flex-end'}}>
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Unlock Manager view</button>
          </div>
        </form>
      </div>
    </div>
  );
}

window.ManagerUnlockModal = ManagerUnlockModal;

function TweaksPanel({ open, brandColor, setBrandColor, features, setFeatures, view, setView, canSwitchView }) {
  if (!open) return null;
  const swatches = [
    { name: 'Navy (brand)', val: '#102347' },
    { name: 'Forest', val: '#1f5130' },
    { name: 'Charcoal', val: '#1f2937' },
    { name: 'Slate blue', val: '#2f4a7a' },
    { name: 'Terracotta', val: '#8f3a1a' },
  ];
  return (
    <div className="tweaks-panel">
      <div className="tweaks-header">
        <span>Tweaks</span>
        <Icon name="settings" size={14}/>
      </div>
      <div className="tweaks-body">
        {canSwitchView && (
          <div className="tweak-row">
            <label>View</label>
            <div className="view-switch" style={{width: '100%'}}>
              <button className={view === 'employee' ? 'on' : ''} style={{flex: 1}} onClick={() => setView('employee')}>Employee</button>
              <button className={view === 'manager' ? 'on' : ''} style={{flex: 1}} onClick={() => setView('manager')}>Manager</button>
            </div>
          </div>
        )}
        <div className="tweak-row">
          <label>Brand color</label>
          <div className="tweak-swatches">
            {swatches.map(s => (
              <div key={s.val} className={`tweak-swatch ${brandColor === s.val ? 'on' : ''}`}
                   style={{background: s.val}} title={s.name} onClick={() => setBrandColor(s.val)} />
            ))}
          </div>
        </div>
        <div className="tweak-row">
          <label>Optional features</label>
          {[
            { id: 'gps', label: 'GPS / site check-in' },
            { id: 'photos', label: 'Jobsite photo uploads' },
            { id: 'overtime', label: 'Highlight overtime' },
          ].map(f => (
            <div key={f.id} className="tweak-toggle">
              <span>{f.label}</span>
              <div className={`switch ${features[f.id] ? 'on' : ''}`}
                   onClick={() => setFeatures({...features, [f.id]: !features[f.id]})} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function greetingPrefix() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function App() {
  const [user, setUser] = React.useState(() => Auth.getSession());
  const [view, setView] = React.useState(() => localStorage.getItem('nla_view') || 'employee');
  const [activeNav, setActiveNav] = React.useState('dashboard');
  const [tweaksOpen, setTweaksOpen] = React.useState(false);
  const [brandColor, setBrandColor] = React.useState('#102347');
  const [features, setFeatures] = React.useState({ gps: false, photos: false, overtime: true });
  const [mgrUnlockOpen, setMgrUnlockOpen] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [notifOpen, setNotifOpen] = React.useState(false);
  const [mgrUnlocked, setMgrUnlocked] = React.useState(() => !!sessionStorage.getItem('nla_mgr_unlocked'));

  React.useEffect(() => { localStorage.setItem('nla_view', view); }, [view]);

  // When user logs in   managers go straight to manager view, employees stay on employee view
  React.useEffect(() => {
    if (user) {
      if (user.type === 'manager') {
        setMgrUnlocked(true);
        sessionStorage.setItem('nla_mgr_unlocked', '1');
        setView('manager');
      } else {
        setView('employee');
        setMgrUnlocked(false);
        sessionStorage.removeItem('nla_mgr_unlocked');
      }
    }
  }, [user?.id]);

  React.useEffect(() => {
    setActiveNav(view === 'employee' ? 'dashboard' : 'overview');
  }, [view]);

  React.useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--brand-navy', brandColor);
    root.style.setProperty('--accent', brandColor);
  }, [brandColor]);

  React.useEffect(() => {
    const handler = (ev) => {
      if (ev.data?.type === '__activate_edit_mode') setTweaksOpen(true);
      if (ev.data?.type === '__deactivate_edit_mode') setTweaksOpen(false);
    };
    window.addEventListener('message', handler);
    window.parent.postMessage({type: '__edit_mode_available'}, '*');
    return () => window.removeEventListener('message', handler);
  }, []);

  const persistEdit = (edits) => window.parent.postMessage({type: '__edit_mode_set_keys', edits}, '*');

  if (!user) {
    return <LoginScreen onLogin={(u) => setUser(u)} />;
  }

  const canSwitchView = user.type === 'manager';
  // non-manager users can only see employee view
  const effectiveView = canSwitchView && (view === 'manager' ? mgrUnlocked : true) ? view : 'employee';

  // Managers can switch views freely   no password re-entry needed
  const requestSetView = (v) => {
    setView(v);
    persistEdit({ view: v });
  };

  const title = `${greetingPrefix()}, ${user.name.split(' ')[0]}`;
  const todayStr = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
  const subtitle = effectiveView === 'employee'
    ? `${todayStr}   Here's your day at a glance.`
    : `${todayStr}   Here's where the studio stands today.`;

  const logout = () => { Auth.clearSession(); setUser(null); };

  return (
    <div className="app" data-screen-label={`NLA Timesheet   ${effectiveView}`}>
      <Sidebar view={effectiveView} activeNav={activeNav} setActiveNav={setActiveNav} user={user} onSettings={() => setSettingsOpen(true)} onNotifications={() => setNotifOpen(true)} />
      <div className="main">
        <Topbar
          view={effectiveView}
          setView={canSwitchView ? requestSetView : null}
          title={title}
          subtitle={subtitle}
          canSwitchView={canSwitchView}
          user={user}
          actions={
            <>
              <button className="btn"><Icon name="search" size={14}/> Search</button>
              <button className="btn"><Icon name="download" size={14}/> Export</button>
              <UserMenu user={user} onLogout={logout} />
            </>
          }
        />
        {effectiveView === 'employee'
          ? <EmployeeView featuresEnabled={features} user={user} activeNav={activeNav}/>
    : <ManagerView activeNav={activeNav} />}
      </div>

      <TweaksPanel
        open={tweaksOpen}
        brandColor={brandColor}
        setBrandColor={(c) => { setBrandColor(c); persistEdit({ brandColor: c }); }}
        features={features}
        setFeatures={(f) => { setFeatures(f); persistEdit({ features: f }); }}
        view={effectiveView}
        setView={requestSetView}
        canSwitchView={canSwitchView}
      />

      <ManagerUnlockModal
        open={mgrUnlockOpen}
        user={user}
        onClose={() => setMgrUnlockOpen(false)}
        onSuccess={() => {
          setMgrUnlocked(true);
          setMgrUnlockOpen(false);
          setView('manager');
          persistEdit({ view: 'manager' });
        }}
      />

      {/* Settings Modal + Notifications Panel */}
      {settingsOpen && window.SettingsModal && React.createElement(window.SettingsModal, {
        user, open: settingsOpen, onClose: () => setSettingsOpen(false)
      })}
      {notifOpen && window.NotificationsPanel && React.createElement(window.NotificationsPanel, {
        user, open: notifOpen, onClose: () => setNotifOpen(false)
      })}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
