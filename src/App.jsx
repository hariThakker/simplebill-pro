import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import Inventory from './pages/Inventory';
import QuickSale from './pages/QuickSale';
import BillHistory from './pages/BillHistory';
import Settings from './pages/Settings';
import Auth from './pages/Auth';
import Staff from './pages/Staff';
import Expenses from './pages/Expenses';
import { connectPrinter, autoReconnect, isPrinterConnected } from './utils/printer';

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'system');
  const [isConnected, setIsConnected] = useState(false);
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(localStorage.getItem('selectedGroupId') || '');
  const hasHistory = !!localStorage.getItem('lastPrinterId');

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  function applyTheme(t) {
    let target = t;
    if (t === 'system') target = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', target);
    document.body.setAttribute('data-theme', target);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    const themeHandler = () => setTheme(localStorage.getItem('theme') || 'system');
    window.addEventListener('themeChanged', themeHandler);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('themeChanged', themeHandler);
    };
  }, []);

  useEffect(() => {
    if (session) {
      fetchGroups();
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
      return () => {
        clearInterval(inv);
        clearInterval(dayChecker);
        window.removeEventListener('groupsUpdated', fetchGroups);
      };
    }
  }, [session]);

  const fetchGroups = async () => {
    const { data } = await supabase.from('groups').select('*').order('name');
    if (data) {
      setGroups(data);
      if (!selectedGroup && data.length > 0) changeGroup(data[0].id);
    }
  };

  const changeGroup = (id) => {
    setSelectedGroup(id);
    localStorage.setItem('selectedGroupId', id);
    window.dispatchEvent(new Event('groupChanged'));
  };

  const handleConn = async () => {
    if (!isConnected && hasHistory) { if (!(await autoReconnect())) connectPrinter(); }
    else connectPrinter();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  if (!session) return <Auth />;

  const isOwner = session.user?.user_metadata?.role === 'owner';

  return (
    <div className="v2-layout">
      {/* Premium Header */}
      <header style={{ padding: '16px 20px', background: 'var(--card)', borderBottom: '1px solid var(--border)', sticky: 'top', zIndex: 900 }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text)' }}>SimpleBill <span style={{color: 'var(--accent)'}}>Pro</span></h1>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '2px' }}>
              <select value={selectedGroup} onChange={(e) => changeGroup(e.target.value)} style={{ border: 'none', background: 'var(--bg)', padding: '4px 10px', borderRadius: '10px', fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', cursor: 'pointer' }}>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: isConnected ? 'var(--success)' : 'var(--danger)' }} />
                <span style={{ fontSize: '9px', fontWeight: 800, color: isConnected ? 'var(--success)' : 'var(--danger)', textTransform: 'uppercase' }}>{isConnected ? 'Online' : 'Offline'}</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', items: 'center', gap: '8px' }}>
            <button onClick={handleConn} className="btn" style={{ background: isConnected ? 'rgba(var(--success-raw), 0.1)' : 'var(--primary)', color: isConnected ? 'var(--success)' : 'white', fontSize: '12px', borderRadius: '12px', padding: '8px 14px' }}>
              {isConnected ? 'Printer Ready' : 'Connect'}
            </button>
            <button onClick={handleLogout} className="btn btn-ghost" style={{ fontSize: '12px', padding: '8px 12px' }}>
              🚪
            </button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '16px 20px 100px 20px' }}>
        <Routes>
          <Route path="/" element={<Dashboard user={session.user} />} />
          <Route path="/pos" element={<QuickSale />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/history" element={<BillHistory />} />
          <Route path="/expenses" element={<Expenses />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/staff" element={<Staff />} />
        </Routes>
      </main>

      {/* Modern Navigation */}
      <nav className="mobile-nav">
        <Link to="/" className={`nav-btn ${location.pathname === '/' ? 'active' : ''}`}><span>📊</span><span>Dash</span></Link>
        <Link to="/pos" className={`nav-btn ${location.pathname === '/pos' ? 'active' : ''}`}><span>⚡</span><span>POS</span></Link>
        <Link to="/inventory" className={`nav-btn ${location.pathname === '/inventory' ? 'active' : ''}`}><span>📦</span><span>Stock</span></Link>
        <Link to="/history" className={`nav-btn ${location.pathname === '/history' ? 'active' : ''}`}><span>📜</span><span>History</span></Link>
        <Link to="/expenses" className={`nav-btn ${location.pathname === '/expenses' ? 'active' : ''}`}><span>💸</span><span>Costs</span></Link>
        {isOwner && <Link to="/staff" className={`nav-btn ${location.pathname === '/staff' ? 'active' : ''}`}><span>👥</span><span>Team</span></Link>}
        <Link to="/settings" className={`nav-btn ${location.pathname === '/settings' ? 'active' : ''}`}><span>⚙️</span><span>Setup</span></Link>
      </nav>
    </div>
  );
}


function Dashboard({ user }) {
  const [stats, setStats] = useState({ t: 0, c: 0, o: 0, n: 0, e: 0 });
  const [chartData, setChartData] = useState([]);
  const [lowStockItems, setLowStockItems] = useState([]);

  const load = async () => {
    const gid = localStorage.getItem('selectedGroupId');
    if (!gid) return;
    
    const today = new Date(); today.setHours(0,0,0,0);
    const last7Days = new Date(); last7Days.setDate(today.getDate() - 6);
    last7Days.setHours(0,0,0,0);

    const { data } = await supabase.from('bills')
      .select('*')
      .eq('group_id', gid)
      .gte('created_at', last7Days.toISOString());

    if (data) {
      // Current day stats
      let t=0, c=0, o=0, n=0;
      const todayIso = today.toISOString().split('T')[0];
      
      // Weekly aggregation for graph
      const dailyMap = {};
      for (let i = 0; i < 7; i++) {
        const d = new Date(); d.setDate(today.getDate() - i);
        dailyMap[d.toISOString().split('T')[0]] = { cash: 0, online: 0, date: d.toLocaleDateString('en-IN', { weekday: 'short' }) };
      }

      data.forEach(b => { 
        const bDate = b.created_at.split('T')[0];
        const amt = Number(b.total_amount);
        
        if (bDate === todayIso) {
          t += amt;
          if (b.payment_mode === 'cash') c += amt; else o += amt;
          n++;
        }

        if (dailyMap[bDate]) {
          if (b.payment_mode === 'cash') dailyMap[bDate].cash += amt;
          else dailyMap[bDate].online += amt;
        }
      });

      // Fetch Expenses
      let e = 0;
      const { data: expData, error: expError } = await supabase.from('expenses')
        .select('amount, created_at')
        .eq('group_id', gid)
        .gte('created_at', last7Days.toISOString());
      
      if (expData && !expError) {
        expData.forEach(exp => {
           if (exp.created_at.split('T')[0] === todayIso) {
             e += Number(exp.amount);
           }
        });
      }

      // Fetch Low Stock
      const { data: invData } = await supabase.from('inventory')
        .select('name, stock')
        .eq('group_id', gid)
        .lte('stock', 5)
        .order('stock', { ascending: true });
      if (invData) setLowStockItems(invData);

      setStats({ t, c, o, n, e });
      setChartData(Object.values(dailyMap).reverse());
    }
  };

  useEffect(() => {
    load();
    const sub = supabase.channel('realtime').on('postgres_changes', { event: '*', schema: 'public', table: 'bills' }, load).subscribe();
    window.addEventListener('groupChanged', load);
    return () => { supabase.removeChannel(sub); window.removeEventListener('groupChanged', load); };
  }, []);

  const maxVal = Math.max(...chartData.map(d => d.cash + d.online), 1);

  return (
    <div className="page-transition">
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '28px', fontWeight: 900 }}>Hello, {user.user_metadata?.full_name?.split(' ')[0] || 'User'}!</h2>
        <p style={{ color: 'var(--text-dim)', fontWeight: 500 }}>Here's what's happening today.</p>
      </div>
      
      <div className="card" style={{ background: 'var(--primary)', color: 'white', marginBottom: '20px', padding: '24px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ opacity: 0.8, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>Daily Gross Revenue</div>
        <div style={{ fontSize: '40px', fontWeight: 900, margin: '4px 0' }}>₹{stats.t.toLocaleString()}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
          <div style={{ padding: '4px 10px', background: 'rgba(255,255,255,0.1)', borderRadius: '20px', fontSize: '11px', fontWeight: 600 }}>{stats.n} Transactions</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
        <div className="card" style={{ padding: '20px', background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
          <div style={{ color: 'var(--success)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Net Profit Today</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--success)' }}>₹{(stats.t - stats.e).toLocaleString()}</div>
        </div>
        <div className="card" style={{ padding: '20px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
          <div style={{ color: 'var(--danger)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Expenses Today</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--danger)' }}>₹{stats.e.toLocaleString()}</div>
        </div>
      </div>

      {lowStockItems.length > 0 && (
        <div className="card" style={{ padding: '20px', marginBottom: '24px', border: '1px solid rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <span style={{ fontSize: '18px' }}>⚠️</span>
            <h3 style={{ fontSize: '15px', color: 'var(--danger)' }}>Low Stock Alerts</h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {lowStockItems.slice(0, 6).map((item, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', background: 'var(--bg)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <span style={{ fontWeight: 600 }}>{item.name}</span>
                <span style={{ color: item.stock === 0 ? 'var(--danger)' : 'var(--accent)', fontWeight: 800 }}>{item.stock} left</span>
              </div>
            ))}
          </div>
          {lowStockItems.length > 6 && <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '12px', textAlign: 'center' }}>+ {lowStockItems.length - 6} more items low on stock</div>}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ color: 'var(--text-dim)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Cash In</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--success)' }}>₹{stats.c.toLocaleString()}</div>
        </div>
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ color: 'var(--text-dim)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Online In</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--accent)' }}>₹{stats.o.toLocaleString()}</div>
        </div>
      </div>

      <div className="card" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '16px', marginBottom: '20px' }}>Sales Trend (Last 7 Days)</h3>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '150px', gap: '8px' }}>
          {chartData.map((d, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column-reverse', height: '120px' }}>
                <div style={{ 
                  width: '100%', 
                  height: `${(d.cash / maxVal) * 100}%`, 
                  background: 'var(--success)', 
                  borderRadius: '4px',
                  opacity: 0.8
                }} />
                <div style={{ 
                  width: '100%', 
                  height: `${(d.online / maxVal) * 100}%`, 
                  background: 'var(--accent)', 
                  borderRadius: '4px',
                  marginBottom: '2px',
                  opacity: 0.8
                }} />
              </div>
              <span style={{ fontSize: '10px', color: 'var(--text-dim)', fontWeight: 700 }}>{d.date}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '16px', marginTop: '20px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
             <div style={{ width: '10px', height: '10px', background: 'var(--success)', borderRadius: '3px' }} />
             <span style={{ fontSize: '11px', fontWeight: 600 }}>Cash</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
             <div style={{ width: '10px', height: '10px', background: 'var(--accent)', borderRadius: '3px' }} />
             <span style={{ fontSize: '11px', fontWeight: 600 }}>Online</span>
          </div>
        </div>
      </div>
    </div>
  );
}

