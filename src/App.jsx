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
import { connectPrinter, autoReconnect, isPrinterConnected, sendToPrinter, generateBillContent, printFormattedReceipt, printOrderToken } from './utils/printer';

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
  RefreshCwIcon,
  ArrowUpRightIcon,
  DownloadIcon,
  SearchIcon,
  PlusIcon,
  Building2Icon
} from './components/Icons';
import ScrollProgressBar from './components/ScrollProgressBar';
import BackToTop from './components/BackToTop';
import SkipToContent from './components/SkipToContent';
import CookieBanner from './components/CookieBanner';
import FloatingContact from './components/FloatingContact';
import MobileMenu from './components/MobileMenu';
import ThemeToggle from './components/ThemeToggle';
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

      {/* Main Content Column with Unified Top Navigation */}
      <div className="app-main-area">
        {/* Sticky Header with Unified Navigation (Mobile & Desktop) */}
        <header className="app-header">
          <div className="header-container">
            {/* Header Left: Brand & Branch Dropdown */}
            <div className="header-left">
              <Link to="/" className="brand-wrapper" title="SimpleBill Pro POS">
                <div className="brand-logo-badge">SB</div>
                <div className="brand-text-wrap">
                  <h1 className="brand-title">
                    SimpleBill <span>Pro</span>
                  </h1>
                </div>
              </Link>

              {/* Branch Selector Pill Dropdown */}
              <div className="header-branch-select-wrap">
                <Building2Icon size={13} className="header-branch-icon" />
                <select
                  value={selectedGroup}
                  onChange={(e) => handleGroupSelect(e.target.value)}
                  className="header-branch-select"
                  aria-label="Select active store branch"
                >
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
                <ChevronDownIcon size={12} className="header-branch-arrow" />
              </div>
            </div>

            {/* Header Center: V14 Pill Navigation Tabs */}
            <div className="v14-header-nav-wrap">
              <nav className="v14-pill-nav" aria-label="Main Navigation">
                <Link to="/" className={`v14-pill-tab ${location.pathname === '/' ? 'active' : ''}`}>
                  Overview
                </Link>
                <Link to="/pos" className={`v14-pill-tab ${location.pathname === '/pos' ? 'active' : ''}`}>
                  <span className="nav-label-long">Point of Sale</span>
                  <span className="nav-label-short">POS</span>
                </Link>
                <Link to="/inventory" className={`v14-pill-tab ${location.pathname === '/inventory' ? 'active' : ''}`}>
                  Inventory
                </Link>
                <Link to="/history" className={`v14-pill-tab ${location.pathname === '/history' ? 'active' : ''}`}>
                  Activity
                </Link>
                <Link to="/expenses" className={`v14-pill-tab ${location.pathname === '/expenses' ? 'active' : ''}`}>
                  Expenses
                </Link>
                {isOwner && (
                  <Link to="/staff" className={`v14-pill-tab ${location.pathname === '/staff' ? 'active' : ''}`}>
                    Team
                  </Link>
                )}
                <Link to="/settings" className={`v14-pill-tab ${location.pathname === '/settings' ? 'active' : ''}`}>
                  Manage
                </Link>
              </nav>
            </div>

            {/* Header Right: Search, Printer, Theme, User Chip */}
            <div className="header-right">
              {/* Quick Search Input */}
              <div className="v14-header-search">
                <SearchIcon size={13} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
                <input
                  type="text"
                  placeholder="Search catalog... ⌘K"
                  className="v14-search-input"
                  onFocus={() => navigate('/pos')}
                  aria-label="Search catalog or invoices"
                />
              </div>

              {/* Printer Status Pill */}
              <button
                type="button"
                onClick={handleConn}
                className={`printer-status-pill ${isConnected ? 'online' : 'offline'}`}
                title={isConnected ? 'Thermal Printer Connected' : 'Click to connect thermal printer'}
              >
                <span className={`status-dot ${isConnected ? 'online' : 'offline'}`} />
                <PrinterIcon size={13} />
                <span className="printer-status-text">{isConnected ? 'Printer Ready' : 'Connect Printer'}</span>
              </button>

              {/* Header Theme Toggle */}
              <div className="header-theme-toggle-wrap">
                <ThemeToggle theme={theme} onChange={handleThemeChange} />
              </div>

              {/* User Profile Chip */}
              <div className="header-user-chip">
                <div className="header-user-avatar">
                  {session.user?.user_metadata?.full_name?.charAt(0)?.toUpperCase() || session.user?.email?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <div className="header-user-info">
                  <span className="header-user-name">
                    {session.user?.user_metadata?.full_name?.split(' ')[0] || session.user?.email?.split('@')[0] || 'User'}
                  </span>
                  <span className="header-user-badge">
                    {isOwner ? 'Owner' : 'Staff'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="header-logout-btn"
                  title="Sign Out"
                  aria-label="Sign Out"
                >
                  <LogOutIcon size={14} />
                </button>
              </div>

              {/* Mobile Menu Trigger Button (Small screens) */}
              <button
                type="button"
                className="btn btn-secondary btn-icon mobile-menu-trigger"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open navigation menu"
              >
                <MenuIcon size={18} />
              </button>
            </div>
          </div>
        </header>

        {/* Main Content Viewport */}
        <main id="main-content" className="app-main-content">
          <Routes>
            <Route path="/" element={<Dashboard user={session.user} currentGroup={currentGroupObj} businessSettings={businessSettings} />} />
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

      {/* Help & Info Widget - Only visible on Manage (/settings) */}
      {location.pathname === '/settings' && (
        <FloatingContact currentGroup={currentGroupObj} businessSettings={businessSettings} />
      )}

      {/* Back to top smooth scroll */}
      <BackToTop />

      {/* Simple Cookie & Local Storage Banner */}
      <CookieBanner />
    </div>
  );
}

function Dashboard({ user, currentGroup, businessSettings }) {
  const toast = useToast();
  const [stats, setStats] = useState({ t: 0, c: 0, o: 0, n: 0, e: 0 });
  const [chartData, setChartData] = useState([]);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [recentBills, setRecentBills] = useState([]);
  const [activityFilter, setActivityFilter] = useState('all');
  const [activitySearch, setActivitySearch] = useState('');
  const [chartView, setChartView] = useState('volume'); // 'volume' | 'split'
  const [selectedBillModal, setSelectedBillModal] = useState(null);
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

      // Fetch Recent Bills for live activity log
      const { data: billsList } = await supabase
        .from('bills')
        .select('*')
        .eq('group_id', gid)
        .order('created_at', { ascending: false })
        .limit(10);

      if (billsList) setRecentBills(billsList);

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
  const dailyTarget = Number(businessSettings?.daily_target) || 50000;
  const targetPct = dailyTarget > 0 ? Math.min(100, Math.round((stats.t / dailyTarget) * 100)) : 0;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'Store Owner';

  const handleExportCSV = () => {
    if (recentBills.length === 0) {
      toast.info('No activity logs available to export');
      return;
    }
    const headers = 'Invoice ID,Date,Time,Payment Mode,Total Amount\n';
    const rows = recentBills
      .map((b) => `${b.id?.slice(0, 8)},${new Date(b.created_at).toLocaleDateString()},${new Date(b.created_at).toLocaleTimeString()},${b.payment_mode},${b.total_amount}`)
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales_report_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Sales logs exported to CSV');
  };

  const printBillReceipt = async (bill) => {
    try {
      const items = Array.isArray(bill.items) ? bill.items : [];
      const gid = localStorage.getItem('selectedGroupId');
      const localLogo = (gid ? localStorage.getItem(`receiptLogo_${gid}`) : null) || localStorage.getItem('receiptLogo') || '';
      const effectiveLogo = (localLogo && localLogo.startsWith('data:')) ? localLogo : (businessSettings?.logo_url || localLogo || '');

      if (isPrinterConnected()) {
        const content = generateBillContent(
          bill.id?.slice(0, 8) || '0000',
          items,
          Number(bill.total_amount),
          bill.payment_mode || 'cash',
          businessSettings || {}
        );
        await sendToPrinter(content);
        toast.success('Dispatched to thermal printer');
      } else {
        printFormattedReceipt({
          invoiceNumber: bill.id?.slice(0, 8) || '0000',
          items,
          total: Number(bill.total_amount),
          paymentMode: bill.payment_mode || 'cash',
          business: businessSettings || {},
          date: bill.created_at,
          logoUrl: effectiveLogo
        });
        toast.info('Opened print preview with logo');
      }
    } catch (err) {
      toast.error('Print failed: ' + err.message);
    }
  };

  const printBillToken = async (bill) => {
    try {
      const items = Array.isArray(bill.items) ? bill.items : [];
      const gid = localStorage.getItem('selectedGroupId');
      const localLogo = (gid ? localStorage.getItem(`receiptLogo_${gid}`) : null) || localStorage.getItem('receiptLogo') || '';
      const effectiveLogo = (localLogo && localLogo.startsWith('data:')) ? localLogo : (businessSettings?.logo_url || localLogo || '');

      printOrderToken({
        tokenNumber: bill.token_number || String(bill.id || '1').slice(-2).padStart(2, '0'),
        invoiceNumber: bill.id?.slice(0, 8) || '0000',
        items,
        business: { ...(businessSettings || {}), logo_url: effectiveLogo },
        date: bill.created_at
      });
      toast.info('Pickup token slip dispatched');
    } catch (err) {
      toast.error('Token print failed: ' + err.message);
    }
  };

  const filteredBills = recentBills.filter((b) => {
    if (activityFilter === 'cash' && b.payment_mode !== 'cash') return false;
    if (activityFilter === 'online' && b.payment_mode === 'cash') return false;
    if (activitySearch.trim()) {
      const q = activitySearch.toLowerCase();
      const idMatch = b.id?.toLowerCase().includes(q);
      const amtMatch = String(b.total_amount).includes(q);
      return idMatch || amtMatch;
    }
    return true;
  });

  return (
    <div className="page-transition v14-dashboard-container">
      {/* V14 Greeting Bar */}
      <div className="v14-greeting-bar">
        <div>
          <div className="v14-greeting-sub">
            {greeting}, {firstName}
          </div>
          <h2 className="v14-greeting-title">
            Store Performance for {currentGroup?.name || 'Main Branch'}
          </h2>
          <p className="v14-greeting-desc">
            Real-time retail register, daily margins, and live transaction stream
          </p>
        </div>

        {/* Action Controls */}
        <div className="v14-greeting-actions">
          {lastUpdated && (
            <div className="v14-timestamp-pill">
              <ClockIcon size={12} />
              <span>Live: {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
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
            <span>Sync</span>
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            className="btn btn-secondary btn-sm"
            title="Export sales logs to CSV"
          >
            <DownloadIcon size={13} />
            <span>Export CSV</span>
          </button>
          <Link to="/pos" className="btn btn-primary btn-sm">
            <PlusIcon size={14} />
            <span>New Sale (POS)</span>
          </Link>
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
          {/* V14 3-Column Top Grid */}
          <div className="v14-dashboard-grid">
            {/* Column 1: Hero Gross Sales Card */}
            <div className="v14-hero-card">
              <div>
                <div className="v14-hero-header">
                  <span className="v14-card-eyebrow">Today's Gross Sales</span>
                  <span className="v14-growth-pill">
                    <TrendingUpIcon size={12} />
                    <span>Active</span>
                  </span>
                </div>
                <div className="v14-hero-amount tabular-nums">
                  ₹{stats.t.toLocaleString()}
                </div>
                <div className="v14-hero-sub-stats">
                  <span className="v14-sub-stat-pill">
                    <strong>{stats.n}</strong> {stats.n === 1 ? 'Bill' : 'Bills today'}
                  </span>
                  <span className="v14-sub-stat-text">
                    Avg ticket: ₹{stats.n > 0 ? Math.round(stats.t / stats.n).toLocaleString() : 0}
                  </span>
                </div>
              </div>

              <div className="v14-hero-bottom">
                <div className="v14-target-progress">
                  <div className="v14-target-label">
                    <span>Daily Sales Target</span>
                    <strong>{targetPct}%</strong>
                  </div>
                  <div className="v14-progress-track">
                    <div
                      className="v14-progress-fill"
                      style={{ width: `${targetPct}%` }}
                    />
                  </div>
                  <div className="v14-target-footer">
                    <span>₹{stats.t.toLocaleString()} of ₹{dailyTarget.toLocaleString()}</span>
                  </div>
                </div>

                <div className="v14-hero-actions">
                  <Link to="/pos" className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: 'center' }}>
                    <PlusIcon size={13} /> Quick Bill
                  </Link>
                  <Link to="/history" className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: 'center' }}>
                    Sales Logs
                  </Link>
                </div>
              </div>
            </div>

            {/* Column 2: 4 Metric Cards in 2x2 Grid */}
            <div className="v14-stat-grid">
              {/* Card 1: Total Gross Income */}
              <div className="v14-stat-card">
                <div className="v14-stat-top">
                  <span className="v14-stat-label">Total Income</span>
                  <div className="v14-stat-icon-box primary">
                    <TrendingUpIcon size={14} />
                  </div>
                </div>
                <div>
                  <div className="v14-stat-value tabular-nums">
                    ₹{stats.t.toLocaleString()}
                  </div>
                  <div className="v14-stat-sub">
                    <span className="v14-dot online" /> {stats.n} registered bills
                  </div>
                </div>
              </div>

              {/* Card 2: Operating Expenses */}
              <div className="v14-stat-card">
                <div className="v14-stat-top">
                  <span className="v14-stat-label">Store Expenses</span>
                  <div className="v14-stat-icon-box danger">
                    <BanknoteIcon size={14} />
                  </div>
                </div>
                <div>
                  <div className="v14-stat-value tabular-nums" style={{ color: 'var(--danger)' }}>
                    ₹{stats.e.toLocaleString()}
                  </div>
                  <div className="v14-stat-sub">
                    Today's recorded costs
                  </div>
                </div>
              </div>

              {/* Card 3: Net Profit Margin */}
              <div className="v14-stat-card">
                <div className="v14-stat-top">
                  <span className="v14-stat-label">Net Profit</span>
                  <div className="v14-stat-icon-box success">
                    <ArrowUpRightIcon size={14} />
                  </div>
                </div>
                <div>
                  <div className="v14-stat-value tabular-nums" style={{ color: 'var(--success)' }}>
                    ₹{netProfit.toLocaleString()}
                  </div>
                  <div className="v14-stat-sub">
                    Gross revenue minus costs
                  </div>
                </div>
              </div>

              {/* Card 4: Ticket Average */}
              <div className="v14-stat-card">
                <div className="v14-stat-top">
                  <span className="v14-stat-label">Avg Basket</span>
                  <div className="v14-stat-icon-box info">
                    <POSIcon size={14} />
                  </div>
                </div>
                <div>
                  <div className="v14-stat-value tabular-nums">
                    ₹{stats.n > 0 ? Math.round(stats.t / stats.n).toLocaleString() : 0}
                  </div>
                  <div className="v14-stat-sub">
                    Average revenue per customer
                  </div>
                </div>
              </div>
            </div>

            {/* Column 3: Total Income & Sales Volume Bar Chart */}
            <div className="v14-chart-card">
              <div className="v14-chart-header">
                <div>
                  <h3 className="v14-chart-title">Sales Volume</h3>
                  <span className="v14-chart-subtitle">Last 7 Days Activity</span>
                </div>
                <div className="v14-chart-tabs">
                  <button
                    type="button"
                    onClick={() => setChartView('volume')}
                    className={`v14-chart-tab-btn ${chartView === 'volume' ? 'active' : ''}`}
                  >
                    Volume
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartView('split')}
                    className={`v14-chart-tab-btn ${chartView === 'split' ? 'active' : ''}`}
                  >
                    Split
                  </button>
                </div>
              </div>

              {/* Bar Chart Body */}
              <div className="v14-chart-body">
                {chartData.map((d, i) => {
                  const dayTotal = d.cash + d.online;
                  const totalHeightPct = Math.max(10, (dayTotal / maxVal) * 100);
                  const cashHeightPct = dayTotal > 0 ? (d.cash / dayTotal) * 100 : 0;
                  const onlineHeightPct = dayTotal > 0 ? (d.online / dayTotal) * 100 : 0;

                  return (
                    <div key={i} className="v14-bar-col">
                      <div className="v14-bar-val tabular-nums">
                        {dayTotal > 0 ? `₹${dayTotal}` : '—'}
                      </div>
                      <div className="v14-bar-track">
                        {chartView === 'volume' ? (
                          <div
                            className="v14-bar-fill"
                            style={{ height: `${totalHeightPct}%` }}
                            title={`${d.date}: ₹${dayTotal}`}
                          />
                        ) : (
                          <div
                            className="v14-bar-fill-split"
                            style={{ height: `${totalHeightPct}%` }}
                          >
                            <div
                              className="v14-bar-cash"
                              style={{ height: `${cashHeightPct}%` }}
                              title={`Cash: ₹${d.cash}`}
                            />
                            <div
                              className="v14-bar-online"
                              style={{ height: `${onlineHeightPct}%` }}
                              title={`Online: ₹${d.online}`}
                            />
                          </div>
                        )}
                      </div>
                      <span className="v14-bar-date">{d.date}</span>
                    </div>
                  );
                })}
              </div>

              {/* Chart Legend */}
              <div className="v14-chart-legend">
                <div className="v14-legend-item">
                  <span className="v14-legend-dot cash" />
                  <span>Cash: ₹{stats.c.toLocaleString()}</span>
                </div>
                <div className="v14-legend-item">
                  <span className="v14-legend-dot online" />
                  <span>Online / UPI: ₹{stats.o.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Low Stock Warning Banner (if any) */}
          {lowStockItems.length > 0 && (
            <div className="v14-low-stock-alert">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangleIcon size={17} style={{ color: 'var(--warning)', flexShrink: 0 }} />
                <strong style={{ fontSize: '13px', color: 'var(--text)' }}>
                  Low Stock Attention: {lowStockItems.length} items require replenishment
                </strong>
              </div>
              <div className="v14-low-stock-chips">
                {lowStockItems.slice(0, 4).map((item, idx) => (
                  <span key={idx} className="v14-stock-chip">
                    {item.name}: <strong>{item.stock} left</strong>
                  </span>
                ))}
                <Link to="/inventory" className="v14-stock-link">
                  Manage Stock &rarr;
                </Link>
              </div>
            </div>
          )}

          {/* V14 Recent Activities Table Panel */}
          <div className="v14-activity-panel">
            <div className="v14-activity-header">
              <div>
                <h3 className="v14-activity-title">Recent Store Activities</h3>
                <span className="v14-activity-sub">Live register sales, settled invoices & timestamps</span>
              </div>

              <div className="v14-activity-tools">
                <div className="v14-activity-filters">
                  <button
                    type="button"
                    onClick={() => setActivityFilter('all')}
                    className={`v14-filter-pill ${activityFilter === 'all' ? 'active' : ''}`}
                  >
                    All ({recentBills.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivityFilter('cash')}
                    className={`v14-filter-pill ${activityFilter === 'cash' ? 'active' : ''}`}
                  >
                    Cash
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivityFilter('online')}
                    className={`v14-filter-pill ${activityFilter === 'online' ? 'active' : ''}`}
                  >
                    Online / UPI
                  </button>
                </div>

                <div className="v14-activity-search-wrap">
                  <SearchIcon size={13} style={{ color: 'var(--text-dim)' }} />
                  <input
                    type="text"
                    placeholder="Search invoice or amt..."
                    value={activitySearch}
                    onChange={(e) => setActivitySearch(e.target.value)}
                    className="v14-activity-search-input"
                    aria-label="Filter recent transactions"
                  />
                </div>
              </div>
            </div>

            {/* Activities Rows */}
            {filteredBills.length === 0 ? (
              <div className="v14-empty-activities">
                <p>No recent transactions match this filter.</p>
              </div>
            ) : (
              <div className="v14-activities-list">
                {filteredBills.map((bill) => {
                  const billDate = new Date(bill.created_at);
                  const formattedTime = billDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  const isCash = bill.payment_mode === 'cash';

                  return (
                    <div key={bill.id} className="v14-activity-row">
                      <div className="v14-activity-left">
                        <div className="v14-activity-icon">
                          <POSIcon size={16} />
                        </div>
                        <div>
                          <div className="v14-activity-title-text">
                            Invoice #{bill.id?.slice(0, 8)}
                          </div>
                          <div className="v14-activity-meta">
                            <span>{formattedTime}</span> &bull; <span>Walk-in Customer</span>
                          </div>
                        </div>
                      </div>

                      <div className="v14-activity-center">
                        <span className={`v14-payment-pill ${isCash ? 'cash' : 'online'}`}>
                          {isCash ? 'Cash' : 'Online / UPI'}
                        </span>
                      </div>

                      <div className="v14-activity-right">
                        <div className="v14-activity-amount tabular-nums">
                          +₹{Number(bill.total_amount).toLocaleString()}
                        </div>
                        <span className="v14-status-badge completed">
                          Settled
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedBillModal(bill)}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '4px 10px', fontSize: '11px' }}
                          title="View & Print Receipt"
                        >
                          Receipt
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Receipt Modal */}
          {selectedBillModal && (
            <div className="modal-backdrop" onClick={() => setSelectedBillModal(null)}>
              <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px', width: '92%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 800 }}>Invoice #{selectedBillModal.id?.slice(0, 8)}</h3>
                  <button
                    type="button"
                    onClick={() => setSelectedBillModal(null)}
                    className="btn btn-ghost btn-icon"
                    style={{ width: '30px', height: '30px' }}
                    aria-label="Close receipt modal"
                  >
                    ✕
                  </button>
                </div>

                <div style={{ background: '#ffffff', color: '#111808', padding: '16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontFamily: 'var(--font-mono)', fontSize: '12px', marginBottom: '16px' }}>
                  {(businessSettings?.logo_url || localStorage.getItem('receiptLogo')) && (
                    <img
                      src={businessSettings?.logo_url || localStorage.getItem('receiptLogo')}
                      alt="Store Logo"
                      style={{ maxHeight: '46px', maxWidth: '150px', margin: '0 auto 8px', display: 'block', objectFit: 'contain' }}
                    />
                  )}
                  <div style={{ textAlign: 'center', fontWeight: 800, fontSize: '14px', marginBottom: '4px' }}>
                    {businessSettings?.business_name || currentGroup?.name || 'SimpleBill Pro Store'}
                  </div>
                  <div style={{ textAlign: 'center', color: '#666', fontSize: '10.5px', marginBottom: '10px' }}>
                    Date: {new Date(selectedBillModal.created_at).toLocaleString()}
                  </div>
                  <div style={{ borderTop: '1px dashed #ccc', margin: '8px 0' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginBottom: '6px' }}>
                    <span>Payment Mode</span>
                    <span style={{ textTransform: 'uppercase' }}>{selectedBillModal.payment_mode}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '15px', borderTop: '1px solid #111', paddingTop: '6px' }}>
                    <span>Total Amount</span>
                    <span>₹{Number(selectedBillModal.total_amount).toLocaleString()}</span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => printBillReceipt(selectedBillModal)}
                    className="btn btn-primary"
                    style={{ justifyContent: 'center' }}
                  >
                    <PrinterIcon size={14} /> Receipt
                  </button>
                  <button
                    type="button"
                    onClick={() => printBillToken(selectedBillModal)}
                    className="btn btn-secondary"
                    style={{ justifyContent: 'center' }}
                    title="Print Counter / Food Token"
                  >
                    <span>🎫 Token</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedBillModal(null)}
                    className="btn btn-secondary"
                    style={{ justifyContent: 'center' }}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
