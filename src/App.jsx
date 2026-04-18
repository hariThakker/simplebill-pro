import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import Inventory from './pages/Inventory';
import QuickSale from './pages/QuickSale';
import BillHistory from './pages/BillHistory';
import Settings from './pages/Settings';
import { connectPrinter, autoReconnect, isPrinterConnected } from './utils/printer';

export default function App() {
  const location = useLocation();
  const [isConnected, setIsConnected] = useState(false);
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(localStorage.getItem('selectedGroupId') || '');
  const hasHistory = !!localStorage.getItem('lastPrinterId');

  useEffect(() => {
    fetchGroups();
    const interval = setInterval(() => {
      setIsConnected(isPrinterConnected());
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  async function handleConnection() {
    if (!isConnected && hasHistory) {
      const ok = await autoReconnect();
      if (!ok) connectPrinter();
    } else {
      connectPrinter();
    }
  }

  async function fetchGroups() {
    const { data } = await supabase.from('groups').select('*').order('name');
    if (data) {
      setGroups(data);
      if (!selectedGroup && data.length > 0) changeGroup(data[0].id);
    }
  }

  function changeGroup(id) {
    setSelectedGroup(id);
    localStorage.setItem('selectedGroupId', id);
    window.dispatchEvent(new Event('groupChanged'));
  }

  return (
    <div className="app-container">
      {/* Desktop Sidebar */}
      <aside className="sidebar">
        <div style={{ padding: '24px', borderBottom: '1px solid var(--border)' }}>
          <h1 style={{ fontSize: '20px', color: 'var(--primary)', marginBottom: '16px' }}>SimpleBill Pro</h1>
          <select 
            value={selectedGroup} 
            onChange={(e) => changeGroup(e.target.value)}
            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)' }}
          >
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
        
        <nav style={{ padding: '16px', flex: 1 }}>
          <Link to="/" className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}>📊 Dashboard</Link>
          <Link to="/pos" className={`nav-link ${location.pathname === '/pos' ? 'active' : ''}`}>🛍️ Quick Sale</Link>
          <Link to="/inventory" className={`nav-link ${location.pathname === '/inventory' ? 'active' : ''}`}>📦 Inventory</Link>
          <Link to="/history" className={`nav-link ${location.pathname === '/history' ? 'active' : ''}`}>📜 History</Link>
          <Link to="/settings" className={`nav-link ${location.pathname === '/settings' ? 'active' : ''}`}>⚙️ Settings</Link>
        </nav>

        <div style={{ padding: '16px', borderTop: '1px solid var(--border)' }}>
          <button onClick={handleConnection} style={{ width: '100%', padding: '12px', background: isConnected ? 'var(--success)' : 'var(--primary)', color: 'white' }}>
            {isConnected ? '✅ Connected' : hasHistory ? '⚡ Reconnect' : '🖨️ Connect'}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        {/* Mobile Header */}
        <header className="mobile-header" style={{ display: location.pathname === '/' ? 'block' : 'none', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h1 style={{ fontSize: '22px' }}>SimpleBill Pro</h1>
            <button onClick={handleConnection} style={{ padding: '8px 12px', background: isConnected ? 'var(--success)' : 'var(--primary)', color: 'white', fontSize: '12px' }}>
              {isConnected ? '✅' : '🖨️'}
            </button>
          </div>
          <select 
            value={selectedGroup} 
            onChange={(e) => changeGroup(e.target.value)}
            style={{ width: '100%', marginTop: '15px', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}
          >
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </header>

        <Routes>
          <Route path="/" element={<Dashboard selectedGroup={selectedGroup} />} />
          <Route path="/pos" element={<QuickSale />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/history" element={<BillHistory />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="bottom-nav">
        <Link to="/" className={`bottom-nav-item ${location.pathname === '/' ? 'active' : ''}`}>
          <span style={{ fontSize: '20px' }}>📊</span>
          <span>Home</span>
        </Link>
        <Link to="/pos" className={`bottom-nav-item ${location.pathname === '/pos' ? 'active' : ''}`}>
          <span style={{ fontSize: '20px' }}>🛍️</span>
          <span>POS</span>
        </Link>
        <Link to="/inventory" className={`bottom-nav-item ${location.pathname === '/inventory' ? 'active' : ''}`}>
          <span style={{ fontSize: '20px' }}>📦</span>
          <span>Stock</span>
        </Link>
        <Link to="/history" className={`bottom-nav-item ${location.pathname === '/history' ? 'active' : ''}`}>
          <span style={{ fontSize: '20px' }}>📜</span>
          <span>History</span>
        </Link>
        <Link to="/settings" className={`bottom-nav-item ${location.pathname === '/settings' ? 'active' : ''}`}>
          <span style={{ fontSize: '20px' }}>⚙️</span>
          <span>Settings</span>
        </Link>
      </nav>

      <style>{`
        @media (min-width: 1024px) {
          .mobile-header { display: none !important; }
        }
      `}</style>
    </div>
  );
}

function Dashboard({ selectedGroup }) {
  const [revenue, setRevenue] = useState(0);
  const [cash, setCash] = useState(0);
  const [online, setOnline] = useState(0);
  const [invoices, setInvoices] = useState(0);

  useEffect(() => {
    fetchTodayStats();
    window.addEventListener('groupChanged', fetchTodayStats);
    const channel = supabase.channel('db-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'bills' }, fetchTodayStats).subscribe();
    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('groupChanged', fetchTodayStats);
    };
  }, [selectedGroup]);

  async function fetchTodayStats() {
    const groupId = localStorage.getItem('selectedGroupId');
    if (!groupId) return;
    const today = new Date(); today.setHours(0,0,0,0);
    const { data: bills } = await supabase.from('bills').select('*').eq('group_id', groupId).gte('created_at', today.toISOString());
    if (!bills) return;
    let t = 0, c = 0, o = 0;
    bills.forEach(b => {
      t += Number(b.total_amount);
      if (b.payment_mode.toLowerCase() === 'cash') c += Number(b.total_amount);
      else o += Number(b.total_amount);
    });
    setRevenue(t); setCash(c); setOnline(o); setInvoices(bills.length);
  }

  return (
    <div className="page-transition">
      <h2 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '8px' }}>Dashboard</h2>
      <p style={{ color: 'var(--text-light)', marginBottom: '20px' }}>Real-time collections for today</p>
      
      <div className="metrics-grid">
        <div className="card" style={{ borderTop: '4px solid var(--primary)' }}>
          <div style={{ color: 'var(--text-light)', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase' }}>Total Revenue</div>
          <div style={{ fontSize: '32px', fontWeight: 800, marginTop: '8px' }}>₹{revenue.toLocaleString()}</div>
          <div style={{ fontSize: '13px', color: 'var(--success)', marginTop: '4px' }}>{invoices} invoices created</div>
        </div>
        <div className="card" style={{ borderTop: '4px solid var(--success)' }}>
          <div style={{ color: 'var(--text-light)', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase' }}>Cash</div>
          <div style={{ fontSize: '32px', fontWeight: 800, marginTop: '8px', color: 'var(--success)' }}>₹{cash.toLocaleString()}</div>
        </div>
        <div className="card" style={{ borderTop: '4px solid var(--warning)' }}>
          <div style={{ color: 'var(--text-light)', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase' }}>Online</div>
          <div style={{ fontSize: '32px', fontWeight: 800, marginTop: '8px', color: 'var(--warning)' }}>₹{online.toLocaleString()}</div>
        </div>
      </div>
    </div>
  );
}
