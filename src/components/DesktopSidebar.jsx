import { Link, useLocation } from 'react-router-dom';
import {
  DashboardIcon,
  POSIcon,
  InventoryIcon,
  HistoryIcon,
  ExpensesIcon,
  StaffIcon,
  SettingsIcon,
  PrinterIcon,
  LogOutIcon,
  Building2Icon,
  ChevronDownIcon
} from './Icons';
import ThemeToggle from './ThemeToggle';

export default function DesktopSidebar({
  user,
  groups,
  selectedGroup,
  onSelectGroup,
  isConnected,
  onConnectPrinter,
  onLogout,
  isOwner,
  theme,
  onThemeChange
}) {
  const location = useLocation();

  const navItems = [
    { to: '/', label: 'Dashboard', icon: DashboardIcon },
    { to: '/pos', label: 'Point of Sale', icon: POSIcon, highlight: true },
    { to: '/inventory', label: 'Inventory & Stock', icon: InventoryIcon },
    { to: '/history', label: 'Sales Logs', icon: HistoryIcon },
    { to: '/expenses', label: 'Expenses', icon: ExpensesIcon },
    ...(isOwner ? [{ to: '/staff', label: 'Team & Staff', icon: StaffIcon }] : []),
    { to: '/settings', label: 'Store Settings', icon: SettingsIcon }
  ];

  return (
    <aside className="app-sidebar desktop-sidebar" aria-label="Desktop Navigation Sidebar">
      {/* Brand Header */}
      <div className="sidebar-brand">
        <Link to="/" className="brand-wrapper">
          <div className="brand-logo-badge">SB</div>
          <div>
            <span className="brand-title">
              SimpleBill <span>Pro</span>
            </span>
            <span className="sidebar-brand-sub">Cloud Retail & POS</span>
          </div>
        </Link>
      </div>

      {/* Active Branch Selector Card */}
      <div className="sidebar-branch-card">
        <label className="sidebar-section-label">
          <Building2Icon size={13} /> Active Branch
        </label>
        <div className="branch-select-wrapper" style={{ width: '100%' }}>
          <select
            value={selectedGroup}
            onChange={(e) => onSelectGroup(e.target.value)}
            className="branch-select"
            style={{ width: '100%', borderRadius: 'var(--radius-sm)' }}
            aria-label="Active store branch"
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <ChevronDownIcon size={14} className="branch-select-arrow" />
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`sidebar-nav-link ${isActive ? 'active' : ''} ${item.highlight ? 'highlight' : ''}`}
            >
              <Icon size={18} />
              <span>{item.label}</span>
              {item.highlight && <span className="sidebar-pill">POS</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer Tools: Printer Card, Theme Switcher, User & Logout */}
      <div className="sidebar-footer">
        {/* Printer Quick Status */}
        <div className="sidebar-printer-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className={`status-dot ${isConnected ? 'online' : 'offline'}`} />
              <span style={{ fontSize: '12px', fontWeight: 700 }}>
                {isConnected ? 'Printer Ready' : 'Printer Offline'}
              </span>
            </div>
            <PrinterIcon size={15} style={{ color: isConnected ? 'var(--success)' : 'var(--text-dim)' }} />
          </div>
          <button
            type="button"
            onClick={onConnectPrinter}
            className={`btn btn-sm ${isConnected ? 'btn-secondary' : 'btn-primary'}`}
            style={{ width: '100%', padding: '6px 10px', fontSize: '11.5px' }}
          >
            {isConnected ? 'Reconnect / Check' : 'Connect Thermal Printer'}
          </button>
        </div>

        {/* Theme Switcher */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
          <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
            Theme
          </span>
          <ThemeToggle theme={theme} onChange={onThemeChange} />
        </div>

        {/* User Profile & Sign Out */}
        <div className="sidebar-user-row">
          <div className="sidebar-user-avatar">
            {user?.user_metadata?.full_name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">
              {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'}
            </span>
            <span className="sidebar-user-role">
              {isOwner ? 'Store Owner' : 'Staff Cashier'}
            </span>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="btn btn-ghost btn-icon"
            style={{ width: '32px', height: '32px' }}
            title="Sign out of SimpleBill Pro"
            aria-label="Sign out"
          >
            <LogOutIcon size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
