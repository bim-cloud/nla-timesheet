const Icon = window.Icon;
const { useState, useEffect, useMemo } = React;

function Sidebar({ view, activeNav, setActiveNav, user, onSettings, onNotifications }) {
  const employeeNav = [
    { id: 'dashboard',  label: 'Dashboard',    icon: 'home' },
    { id: 'timesheet',  label: 'My Timesheet', icon: 'clock' },
    { id: 'projects',   label: 'Projects',     icon: 'briefcase' },
    { id: 'leave',      label: 'Leave',        icon: 'calendar' },
  ];
  const managerNav = [
    { id: 'overview', label: 'Team Overview', icon: 'home' },
    { id: 'activity', label: 'Activity Monitor', icon: 'pulse' },
    { id: 'approvals', label: 'Approvals', icon: 'check', count: 3 },
    { id: 'projects', label: 'Projects', icon: 'briefcase' },
    { id: 'reports', label: 'Reports', icon: 'chart' },
    { id: 'users', label: 'Users & Access', icon: 'users' },
  ];
  const nav = view === 'employee' ? employeeNav : managerNav;

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <img src="assets/nature-logo.png" alt="Nature Landscape Architects" />
      </div>

      <div className="sidebar-section-label">
        {view === 'employee' ? 'Workspace' : 'Management'}
      </div>

      {nav.map(n => (
        <button
          key={n.id}
          className={`nav-item ${activeNav === n.id ? 'active' : ''}`}
          onClick={() => setActiveNav(n.id)}
        >
          <Icon name={n.icon} />
          {n.label}
          {n.count && <span className="nav-count">{n.count}</span>}
        </button>
      ))}

      <div className="sidebar-section-label">Account</div>
      <button className="nav-item" onClick={() => onNotifications && onNotifications()}>
        <Icon name="bell" /> Notifications
      </button>
      <button className="nav-item" onClick={() => onSettings && onSettings()}>
        <Icon name="settings" /> Settings
      </button>

      <div className="sidebar-user">
        <div className="avatar">{user?.initials || ' '}</div>
        <div>
          <div className="who">{user?.name || ''}</div>
          <div className="role">{user?.role || ''}</div>
        </div>
      </div>
    </aside>
  );
}

function Topbar({ view, setView, title, subtitle, actions, canSwitchView, user }) {
  const [now, setNow] = React.useState(new Date());
  React.useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const tz = user?.tz || 'Asia/Dubai';
  const tzLabel = user?.tzLabel || 'UAE';
  const timeStr = now.toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
  const dateStr = now.toLocaleDateString('en-GB', { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short' });
  return (
    <div className="topbar">
      <div>
        <h1>{title}</h1>
        <div className="subtitle">{subtitle}</div>
      </div>
      <div className="spacer" />
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
        padding: '4px 14px', borderRight: '1px solid var(--border)', marginRight: 4,
      }}>
        <div style={{fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums'}}>
          {timeStr} <span style={{fontSize: 10.5, color: 'var(--text-muted)', marginLeft: 4, fontWeight: 500}}>{tzLabel}</span>
        </div>
        <div style={{fontSize: 11, color: 'var(--text-muted)', marginTop: 1}}>{dateStr}</div>
      </div>
      {canSwitchView && setView && (
        <div className="view-switch">
          <button className={view === 'employee' ? 'on' : ''} onClick={() => setView('employee')}>Employee</button>
          <button className={view === 'manager' ? 'on' : ''} onClick={() => setView('manager')}>Manager</button>
        </div>
      )}
      {actions}
    </div>
  );
}

window.Sidebar = Sidebar;
window.Topbar = Topbar;
