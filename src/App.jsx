import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import Inventory from './pages/Inventory';
import QuickSale from './pages/QuickSale';
import BillHistory from './pages/BillHistory';
import Settings from './pages/Settings';
import Auth from './pages/Auth';
import Staff from './pages/Staff';
import Expenses from './pages/Expenses';
import { connectPrinter, autoReconnect, isPrinterConnected } from './utils/printer';

// Components
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
  MenuIcon,
  ChevronDownIcon,
  ClockIcon,
  AlertTriangleIcon,
  TrendingUpIcon,
  BanknoteIcon,
  CreditCardIcon,
  RefreshCwIcon
} from './components/Icons';
import ThemeToggle from './components/ThemeToggle';
import ScrollProgressBar from './components/ScrollProgressBar';
import BackToTop from './components/BackToTop';
import SkipToContent from './components/SkipToContent';
import CookieBanner from './components/CookieBanner';
import FloatingContact from './components/FloatingContact';
import MobileMenu from './components/MobileMenu';
import DesktopSidebar from './components/DesktopSidebar';
import { ToastProvider, useToast } from './components/Toast';
import { SkeletonMetric, SkeletonCard } from './components/Skeleton';

function applyTheme(t) {
  const mode = t || localStorage.getItem('theme') || 'system';
  let target = mode;
  if (mode === 'system') {
    target = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.setAttribute('data-theme', target);
  document.body.setAttribute('data-theme', target);
  if (document.documentElement.style) {
    document.documentElement.style.colorScheme = target;
  }
  localStorage.setItem('theme', mode);
}

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();

  const [session, setSession] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'system');
  const [isConnected, setIsConnected] = useState(false);
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(() => localStorage.getItem('selectedGroupId') || '');
  const [businessSettings, setBusinessSettings] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const hasHistory = !!localStorage.getItem('lastPrinterId');

  // Theme application
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Sync dynamic OS color scheme changes when theme is 'system'
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = (e) => {
      const current = localStorage.getItem('theme') || 'system';
      if (current === 'system') {
        const target = e.matches ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', target);
        document.body.setAttribute('data-theme', target);
        if (document.documentElement.style) {
          document.documentElement.style.colorScheme = target;
        }
      }
    };
    mediaQuery.addEventListener('change', handleSystemChange);
    return () => mediaQuery.removeEventListener('change', handleSystemChange);
  }, []);

  const handleThemeChange = (newTheme) => {
    localStorage.setItem('theme', newTheme);
    applyTheme(newTheme);
    setTheme(newTheme);
    window.dispatchEvent(new Event('themeChanged'));
  };

  const changeGroup = useCallback((id) => {
    setSelectedGroup(id);
    localStorage.setItem('selectedGroupId', id);
    window.dispatchEvent(new Event('groupChanged'));
  }, []);

  const fetchGroups = useCallback(async () => {
    const { data } = await supabase.from('groups').select('*').order('name');
    if (data) {
      setGroups(data);
      const currentSelected = localStorage.getItem('selectedGroupId');
      if (!currentSelected && data.length > 0) {
        changeGroup(data[0].id);
      }
    }
  }, [changeGroup]);

  const fetchBusinessSettings = useCallback(async () => {
    const gid = localStorage.getItem('selectedGroupId');
    if (!gid) return;
    const { data } = await supabase.from('settings').select('*').eq('group_id', gid).maybeSingle();
    if (data) setBusinessSettings(data);
  }, []);

  // Auth & Session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    const themeHandler = () => {
      const stored = localStorage.getItem('theme') || 'system';
      setTheme((prev) => (prev !== stored ? stored : prev));
      applyTheme(stored);
    };
    window.addEventListener('themeChanged', themeHandler);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('themeChanged', themeHandler);
    };
  }, []);

  // Fetch groups & printer poller
  useEffect(() => {
    if (session) {
      fetchGroups();
      fetchBusinessSettings();
      const inv = setInterval(() => setIsConnected(isPrinterConnected()), 2000);

      let lastDate = new Date().toDateString();
      const dayChecker = setInterval(() => {
        const current = new Date().toDateString();
        if (current !== lastDate) {
          lastDate = current;
          window.dispatchEvent(new Event('groupChanged'));
        }
      }, 60000);

      window.addEventListener('groupsUpdated', fetchGroups);
      window.addEventListener('groupChanged', fetchBusinessSettings);

      return () => {
        clearInterval(inv);
        clearInterval(dayChecker);
        window.removeEventListener('groupsUpdated', fetchGroups);
        window.removeEventListener('groupChanged', fetchBusinessSettings);
      };
    }
  }, [session, fetchGroups, fetchBusinessSettings]);

  const handleGroupSelect = (id) => {
    changeGroup(id);
    toast.info('Active branch updated');
  };

  const handleConn = async () => {
    try {
      if (!isConnected && hasHistory) {
        if (!(await autoReconnect())) await connectPrinter();
      } else {
        await connectPrinter();
      }
      setIsConnected(isPrinterConnected());
    } catch (err) {
      toast.error('Printer connection failed: ' + err.message);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.info('You have been signed out');
    navigate('/');
  };

  if (!session) return <Auth />;

  const isOwner = session.user?.user_metadata?.role === 'owner';
  const currentGroupObj = groups.find((g) => g.id === selectedGroup);

  return (
    <div className="app-shell">
      {/* Keyboard Accessibility Skip Link */}
      <SkipToContent />

      {/* Top Scroll Progress Bar */}
      <ScrollProgressBar />

      {/* Dedicated Desktop Sidebar (Fixed left on screen >= 1024px) */}
      <DesktopSidebar
        user={session.user}
        groups={groups}
        selectedGroup={selectedGroup}
        onSelectGroup={handleGroupSelect}
        isConnected={isConnected}
        onConnectPrinter={handleConn}
        onLogout={handleLogout}
        isOwner={isOwner}
        theme={theme}
        onThemeChange={handleThemeChange}
      />

      {/* Main Content Column */}
      <div className="app-main-area">
        {/* Sticky Header */}
        <header className="app-header">
          <div className="header-container">
            <div className="header-left">
              {/* Brand logo shown on mobile/tablet */}
              <Link to="/" className="brand-wrapper mobile-only-brand">
                <div className="brand-logo-badge">SB</div>
                <div>
                  <h1 className="brand-title">
                    SimpleBill <span>Pro</span>
                  </h1>
                </div>
              </Link>

              {/* Branch Selector (Mobile/Tablet) */}
              <div className="branch-select-wrapper mobile-only-branch">
                <select
                  value={selectedGroup}
                  onChange={(e) => handleGroupSelect(e.target.value)}
                  className="branch-select"
                  aria-label="Select active store branch"
                >
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
                <ChevronDownIcon size={14} className="branch-select-arrow" />
              </div>

              {/* Desktop Breadcrumb / Location Badge */}
              <div className="desktop-header-branch-pill">
                <span className="desktop-branch-label">Branch:</span>
                <strong className="desktop-branch-name">{currentGroupObj?.name || 'Main Branch'}</strong>
              </div>
            </div>

            <div className="header-right">
              {/* Printer Status Pill */}
              <button
                type="button"
                onClick={handleConn}
                className={`printer-status-pill ${isConnected ? 'online' : 'offline'}`}
                title={isConnected ? 'Thermal Printer Connected' : 'Click to connect thermal printer'}
              >
                <span className={`status-dot ${isConnected ? 'online' : 'offline'}`} />
                <PrinterIcon size={14} />
                <span>{isConnected ? 'Printer Ready' : 'Connect Printer'}</span>
              </button>

              {/* Theme Toggle (Header Desktop) */}
              <div className="desktop-header-theme">
                <ThemeToggle theme={theme} onChange={handleThemeChange} />
              </div>

              {/* Mobile Menu Trigger Button (Hidden on >=1024px) */}
              <button
                type="button"
                className="btn btn-secondary btn-icon mobile-menu-trigger"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open navigation menu"
              >
                <MenuIcon size={18} />
              </button>

              {/* Logout button (Desktop) */}
              <button
                type="button"
                onClick={handleLogout}
                className="btn btn-ghost btn-icon desktop-header-logout"
                title="Sign Out"
                aria-label="Sign Out"
              >
                <LogOutIcon size={17} />
              </button>
            </div>
          </div>
        </header>

        {/* Main Content Viewport */}
        <main id="main-content" className="app-main-content">
          <Routes>
            <Route path="/" element={<Dashboard user={session.user} currentGroup={currentGroupObj} />} />
            <Route path="/pos" element={<QuickSale />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/history" element={<BillHistory />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/staff" element={<Staff />} />
          </Routes>
        </main>
      </div>

      {/* Floating Bottom Navigation for Mobile & Tablet (<1024px) */}
      <nav className="mobile-nav" aria-label="Main Navigation">
        <Link to="/" className={`nav-btn ${location.pathname === '/' ? 'active' : ''}`} title="Dashboard">
          <DashboardIcon size={20} />
          <span>Dash</span>
        </Link>
        <Link to="/pos" className={`nav-btn ${location.pathname === '/pos' ? 'active highlight-active' : ''}`} title="Point of Sale">
          <POSIcon size={20} />
          <span>POS</span>
        </Link>
        <Link to="/inventory" className={`nav-btn ${location.pathname === '/inventory' ? 'active' : ''}`} title="Inventory">
          <InventoryIcon size={20} />
          <span>Stock</span>
        </Link>
        <Link to="/history" className={`nav-btn ${location.pathname === '/history' ? 'active' : ''}`} title="Sales Logs">
          <HistoryIcon size={20} />
          <span>Logs</span>
        </Link>
        <Link to="/expenses" className={`nav-btn ${location.pathname === '/expenses' ? 'active' : ''}`} title="Expenses">
          <ExpensesIcon size={20} />
          <span>Costs</span>
        </Link>
        {isOwner && (
          <Link to="/staff" className={`nav-btn ${location.pathname === '/staff' ? 'active' : ''}`} title="Team">
            <StaffIcon size={20} />
            <span>Team</span>
          </Link>
        )}
        <Link to="/settings" className={`nav-btn ${location.pathname === '/settings' ? 'active' : ''}`} title="Settings">
          <SettingsIcon size={20} />
          <span>Setup</span>
        </Link>
      </nav>

      {/* Slide-out Mobile Menu Drawer */}
      <MobileMenu
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        groups={groups}
        selectedGroup={selectedGroup}
        onSelectGroup={handleGroupSelect}
        isConnected={isConnected}
        onConnectPrinter={handleConn}
        onLogout={handleLogout}
        isOwner={isOwner}
        theme={theme}
        onThemeChange={handleThemeChange}
      />

      {/* Floating Contact & Support Widget */}
      <FloatingContact currentGroup={currentGroupObj} businessSettings={businessSettings} />

      {/* Back to top smooth scroll */}
      <BackToTop />

      {/* Simple Cookie & Local Storage Banner */}
      <CookieBanner />
    </div>
  );
}

function Dashboard({ user, currentGroup }) {
  const [stats, setStats] = useState({ t: 0, c: 0, o: 0, n: 0, e: 0 });
  const [chartData, setChartData] = useState([]);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const load = useCallback(async () => {
    const gid = localStorage.getItem('selectedGroupId');
    if (!gid) return;

    setLoading(true);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const last7Days = new Date();
    last7Days.setDate(today.getDate() - 6);
    last7Days.setHours(0, 0, 0, 0);

    const { data } = await supabase
      .from('bills')
      .select('*')
      .eq('group_id', gid)
      .gte('created_at', last7Days.toISOString());

    if (data) {
      const getLocalYMD = (d) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      let t = 0;
      let c = 0;
      let o = 0;
      let n = 0;
      const todayYMD = getLocalYMD(new Date());

      const dailyMap = {};
      for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        dailyMap[getLocalYMD(d)] = { cash: 0, online: 0, date: d.toLocaleDateString('en-IN', { weekday: 'short' }) };
      }

      data.forEach((b) => {
        const bDateObj = new Date(b.created_at);
        const bDate = getLocalYMD(bDateObj);
        const amt = Number(b.total_amount);

        if (bDate === todayYMD) {
          t += amt;
          if (b.payment_mode === 'cash') c += amt;
          else o += amt;
          n++;
        }

        if (dailyMap[bDate]) {
          if (b.payment_mode === 'cash') dailyMap[bDate].cash += amt;
          else dailyMap[bDate].online += amt;
        }
      });

      // Fetch Expenses
      let e = 0;
      const { data: expData } = await supabase
        .from('expenses')
        .select('amount, created_at')
        .eq('group_id', gid)
        .gte('created_at', last7Days.toISOString());

      if (expData) {
        expData.forEach((exp) => {
          const expDateObj = new Date(exp.created_at);
          if (getLocalYMD(expDateObj) === todayYMD) {
            e += Number(exp.amount);
          }
        });
      }

      // Fetch Low Stock
      const { data: invData } = await supabase
        .from('inventory')
        .select('name, stock')
        .eq('group_id', gid)
        .lte('stock', 5)
        .order('stock', { ascending: true });

      if (invData) setLowStockItems(invData);

      setStats({ t, c, o, n, e });
      setChartData(Object.values(dailyMap).reverse());
      setLastUpdated(new Date());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const sub = supabase.channel('realtime').on('postgres_changes', { event: '*', schema: 'public', table: 'bills' }, load).subscribe();
    window.addEventListener('groupChanged', load);
    return () => {
      supabase.removeChannel(sub);
      window.removeEventListener('groupChanged', load);
    };
  }, [load]);

  const maxVal = Math.max(...chartData.map((d) => d.cash + d.online), 1);
  const netProfit = stats.t - stats.e;

  return (
    <div className="page-transition">
      {/* Top Banner & Last Updated Date */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: 'clamp(22px, 3.5vw, 28px)', fontWeight: 800 }}>
            Hello, {user.user_metadata?.full_name?.split(' ')[0] || 'User'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px', marginTop: '2px' }}>
            Store overview for <strong style={{ color: 'var(--text)' }}>{currentGroup?.name || 'Selected Branch'}</strong>
          </p>
        </div>

        {/* Last Updated Timestamp & Manual Refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {lastUpdated && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--text-dim)', background: 'var(--card-subtle)', padding: '5px 10px', borderRadius: 'var(--radius-full)', border: '1px solid var(--border)' }}>
              <ClockIcon size={12} />
              <span>Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          )}
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="btn btn-secondary btn-sm"
            title="Refresh statistics"
          >
            <RefreshCwIcon size={13} className={loading ? 'skeleton-circle' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <SkeletonCard />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <SkeletonMetric />
            <SkeletonMetric />
            <SkeletonMetric />
            <SkeletonMetric />
          </div>
        </div>
      ) : (
        <>
          {/* Desert Sunset Hero Revenue Card */}
          <div className="card card-hero" style={{ marginBottom: '20px', padding: 'clamp(20px, 4vw, 32px)' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.9 }}>
              Today's Gross Sales
            </div>
            <div style={{ fontSize: 'clamp(32px, 6vw, 48px)', fontWeight: 800, margin: '6px 0', fontFamily: 'var(--font-display)', fontVariantNumeric: 'tabular-nums' }}>
              ₹{stats.t.toLocaleString()}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginTop: '10px' }}>
              <div style={{ padding: '4px 12px', background: 'rgba(255, 255, 255, 0.2)', backdropFilter: 'blur(4px)', borderRadius: 'var(--radius-full)', fontSize: '12px', fontWeight: 700 }}>
                {stats.n} {stats.n === 1 ? 'Transaction' : 'Transactions'}
              </div>
              <div style={{ fontSize: '12px', opacity: 0.9 }}>
                Average bill: ₹{stats.n > 0 ? Math.round(stats.t / stats.n).toLocaleString() : 0}
              </div>
            </div>
          </div>

          {/* Quick Metrics Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div className="card" style={{ padding: '18px 20px', borderLeft: '4px solid var(--success)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-dim)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>Net Profit</span>
                <TrendingUpIcon size={16} style={{ color: 'var(--success)' }} />
              </div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--success)', fontVariantNumeric: 'tabular-nums' }}>
                ₹{netProfit.toLocaleString()}
              </div>
            </div>

            <div className="card" style={{ padding: '18px 20px', borderLeft: '4px solid var(--danger)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-dim)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>Expenses</span>
                <BanknoteIcon size={16} style={{ color: 'var(--danger)' }} />
              </div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--danger)', fontVariantNumeric: 'tabular-nums' }}>
                ₹{stats.e.toLocaleString()}
              </div>
            </div>

            <div className="card" style={{ padding: '18px 20px', borderLeft: '4px solid var(--accent-amber)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-dim)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>Cash Collected</span>
                <BanknoteIcon size={16} style={{ color: 'var(--accent-amber)' }} />
              </div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                ₹{stats.c.toLocaleString()}
              </div>
            </div>

            <div className="card" style={{ padding: '18px 20px', borderLeft: '4px solid var(--accent-rose)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-dim)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>Online / UPI</span>
                <CreditCardIcon size={16} style={{ color: 'var(--accent-rose)' }} />
              </div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                ₹{stats.o.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Low Stock Alert */}
          {lowStockItems.length > 0 && (
            <div className="card" style={{ padding: '20px', marginBottom: '24px', borderLeft: '4px solid var(--warning)', background: 'var(--warning-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <AlertTriangleIcon size={18} style={{ color: 'var(--warning)' }} />
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--warning)' }}>
                  Low Stock Attention Required ({lowStockItems.length} items)
                </h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px' }}>
                {lowStockItems.slice(0, 6).map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: 'var(--card)',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border)',
                      fontSize: '12.5px'
                    }}
                  >
                    <span style={{ fontWeight: 600, color: 'var(--text)' }}>{item.name}</span>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-full)',
                        fontSize: '11px',
                        fontWeight: 700,
                        background: item.stock === 0 ? 'var(--danger-subtle)' : 'var(--warning-subtle)',
                        color: item.stock === 0 ? 'var(--danger)' : 'var(--warning)'
                      }}
                    >
                      {item.stock === 0 ? 'Out of stock' : `${item.stock} left`}
                    </span>
                  </div>
                ))}
              </div>
              {lowStockItems.length > 6 && (
                <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '10px', textAlign: 'center' }}>
                  + {lowStockItems.length - 6} more low stock items in inventory
                </div>
              )}
            </div>
          )}

          {/* Sales Trend Bar Chart (Last 7 Days) */}
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Sales Volume (Last 7 Days)</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '2px' }}>Comparison of cash vs online revenue</p>
              </div>
              <div style={{ display: 'flex', gap: '14px', fontSize: '11.5px', fontWeight: 600 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '10px', height: '10px', background: 'var(--accent-amber)', borderRadius: '3px' }} />
                  <span>Cash</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '10px', height: '10px', background: 'var(--accent-rose)', borderRadius: '3px' }} />
                  <span>Online</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '160px', gap: '10px', paddingBottom: '10px', borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
              {chartData.map((d, i) => {
                const dayTotal = d.cash + d.online;
                const totalHeightPct = Math.max(8, (dayTotal / maxVal) * 100);
                const cashHeightPct = dayTotal > 0 ? (d.cash / dayTotal) * 100 : 0;
                const onlineHeightPct = dayTotal > 0 ? (d.online / dayTotal) * 100 : 0;

                return (
                  <div key={i} style={{ flex: 1, minWidth: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-dim)', marginBottom: '4px' }}>
                      {dayTotal > 0 ? `₹${dayTotal}` : '—'}
                    </div>
                    <div
                      style={{
                        width: '100%',
                        maxWidth: '44px',
                        height: `${totalHeightPct}%`,
                        display: 'flex',
                        flexDirection: 'column-reverse',
                        borderRadius: '6px',
                        overflow: 'hidden',
                        background: 'var(--card-subtle)'
                      }}
                    >
                      <div
                        style={{
                          width: '100%',
                          height: `${cashHeightPct}%`,
                          background: 'var(--accent-amber)',
                          transition: 'height 0.3s ease'
                        }}
                        title={`Cash: ₹${d.cash}`}
                      />
                      <div
                        style={{
                          width: '100%',
                          height: `${onlineHeightPct}%`,
                          background: 'var(--accent-rose)',
                          transition: 'height 0.3s ease'
                        }}
                        title={`Online: ₹${d.online}`}
                      />
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600, marginTop: '8px' }}>
                      {d.date}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
