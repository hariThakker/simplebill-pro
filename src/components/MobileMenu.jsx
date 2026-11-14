import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  XIcon,
  DashboardIcon,
  POSIcon,
  InventoryIcon,
  HistoryIcon,
  ExpensesIcon,
  StaffIcon,
  SettingsIcon,
  PrinterIcon,
  LogOutIcon,
  Building2Icon
} from './Icons';
import ThemeToggle from './ThemeToggle';

export default function MobileMenu({
  isOpen,
  onClose,
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

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const navItems = [
    { to: '/', label: 'Dashboard', icon: DashboardIcon },
    { to: '/pos', label: 'Point of Sale', icon: POSIcon, highlight: true },
    { to: '/inventory', label: 'Stock & Inventory', icon: InventoryIcon },
    { to: '/history', label: 'Sales Logs & Receipts', icon: HistoryIcon },
    { to: '/expenses', label: 'Expense Tracking', icon: ExpensesIcon },
    ...(isOwner ? [{ to: '/staff', label: 'Staff & Team', icon: StaffIcon }] : []),
    { to: '/settings', label: 'Store Settings', icon: SettingsIcon }
  ];

  return (
    <div className="mobile-drawer-backdrop" onClick={onClose}>
      <aside
        className="mobile-drawer"
        role="dialog"
        aria-label="Navigation Menu"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mobile-drawer-header">
          <div className="mobile-drawer-brand">
            <span className="brand-badge">PRO</span>
            <div>
              <span className="brand-name">SimpleBill</span>
              <span className="brand-tagline">POS & Inventory</span>
            </div>
          </div>
          <button
            type="button"
            className="mobile-drawer-close"
            onClick={onClose}
            aria-label="Close navigation menu"
          >
            <XIcon size={20} />
          </button>
        </div>

        {/* Branch Selector */}
        <div className="mobile-drawer-branch-section">
          <label className="mobile-section-label">
            <Building2Icon size={14} /> Active Store Branch
          </label>
          <select
            value={selectedGroup}
            onChange={(e) => {
              onSelectGroup(e.target.value);
            }}
            className="mobile-branch-select"
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>

        {/* Navigation Links */}
        <nav className="mobile-drawer-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={onClose}
                className={`mobile-drawer-link ${isActive ? 'active' : ''} ${item.highlight ? 'highlight' : ''}`}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Printer & Theme Controls */}
        <div className="mobile-drawer-footer">
          <div className="mobile-printer-row">
            <div className="printer-status-indicator">
              <span className={`status-dot ${isConnected ? 'online' : 'offline'}`} />
              <span className="status-text">
                {isConnected ? 'Printer Connected' : 'Printer Offline'}
              </span>
            </div>
            <button
              type="button"
              onClick={onConnectPrinter}
              className={`btn btn-sm ${isConnected ? 'btn-secondary' : 'btn-primary'}`}
            >
              <PrinterIcon size={14} />
              <span>{isConnected ? 'Ready' : 'Connect'}</span>
            </button>
          </div>

          <div className="mobile-theme-card">
            <div className="mobile-theme-header">
              <span className="mobile-section-label" style={{ marginBottom: 0 }}>Appearance</span>
              <span className="sidebar-theme-badge">
                {theme === 'system' ? 'System' : theme === 'dark' ? 'Dark' : 'Light'}
              </span>
            </div>
            <ThemeToggle theme={theme} onChange={onThemeChange} fullWidth={true} />
          </div>

          <button
            type="button"
            onClick={() => {
              onClose();
              onLogout();
            }}
            className="btn btn-secondary mobile-logout-btn"
          >
            <LogOutIcon size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </div>
  );
}
