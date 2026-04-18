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
    const inv = setInterval(() => setIsConnected(isPrinterConnected()), 2000);
    window.addEventListener('groupsUpdated', fetchGroups);
    return () => {
      clearInterval(inv);
      window.removeEventListener('groupsUpdated', fetchGroups);
    };
  }, []);

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

  const handleConn = async () => {
    if (!isConnected && hasHistory) { if (!(await autoReconnect())) connectPrinter(); }
    else connectPrinter();
  };

  return (
    <div className="v2-layout">
      {/* Premium Header */}
      <header style={{ padding: '24px 20px', background: 'white', borderBottom: '1px solid var(--border)', sticky: 'top', zIndex: 900 }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px' }}>SimpleBill <span style={{color: 'var(--accent)'}}>Pro</span></h1>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
              <select value={selectedGroup} onChange={(e) => changeGroup(e.target.value)} style={{ border: 'none', background: '#f1f5f9', padding: '4px 10px', borderRadius: '10px', fontSize: '12px', fontWeight: 700, color: 'var(--text-dim)', cursor: 'pointer' }}>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: isConnected ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', padding: '4px 8px', borderRadius: '10px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: isConnected ? 'var(--success)' : 'var(--danger)' }} />
                <span style={{ fontSize: '10px', fontWeight: 800, color: isConnected ? 'var(--success)' : 'var(--danger)', textTransform: 'uppercase' }}>{isConnected ? 'Online' : 'Offline'}</span>
              </div>
            </div>
          </div>
          <button onClick={handleConn} className="btn" style={{ background: 'var(--primary)', color: 'white', fontSize: '13px', borderRadius: '14px', padding: '10px 18px' }}>
            {isConnected ? 'Connected' : 'Connect Printer'}
          </button>
        </div>
      </header>

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 20px 100px 20px' }}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/pos" element={<QuickSale />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/history" element={<BillHistory />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>

      {/* Modern Navigation */}
      <nav className="mobile-nav">
        <Link to="/" className={`nav-btn ${location.pathname === '/' ? 'active' : ''}`}><span>📊</span><span>Dash</span></Link>
        <Link to="/pos" className={`nav-btn ${location.pathname === '/pos' ? 'active' : ''}`}><span>⚡</span><span>POS</span></Link>
        <Link to="/inventory" className={`nav-btn ${location.pathname === '/inventory' ? 'active' : ''}`}><span>📦</span><span>Stock</span></Link>
        <Link to="/history" className={`nav-btn ${location.pathname === '/history' ? 'active' : ''}`}><span>📜</span><span>Logs</span></Link>
        <Link to="/settings" className={`nav-btn ${location.pathname === '/settings' ? 'active' : ''}`}><span>⚙️</span><span>Setup</span></Link>
      </nav>
    </div>
  );
}

function Dashboard() {
  const [stats, setStats] = useState({ t: 0, c: 0, o: 0, n: 0 });

  const load = async () => {
    const gid = localStorage.getItem('selectedGroupId');
    if (!gid) return;
    const start = new Date(); start.setHours(0,0,0,0);
    const { data } = await supabase.from('bills').select('*').eq('group_id', gid).gte('created_at', start.toISOString());
    if (data) {
      let t=0, c=0, o=0;
      data.forEach(b => { 
        t += Number(b.total_amount);
        if (b.payment_mode === 'cash') c += Number(b.total_amount); else o += Number(b.total_amount);
      });
      setStats({ t, c, o, n: data.length });
    }
  };

  useEffect(() => {
    load();
    const sub = supabase.channel('realtime').on('postgres_changes', { event: '*', schema: 'public', table: 'bills' }, load).subscribe();
    window.addEventListener('groupChanged', load);
    return () => { supabase.removeChannel(sub); window.removeEventListener('groupChanged', load); };
  }, []);

  return (
    <div className="page-transition">
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '32px', fontWeight: 900, letterSpacing: '-0.5px' }}>Day Overview</h2>
        <p style={{ color: 'var(--text-dim)', fontWeight: 500 }}>Real-time sales tracking</p>
      </div>
      
      <div className="card" style={{ background: 'var(--primary)', color: 'white', marginBottom: '20px', padding: '32px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-20px', right: '-20px', fontSize: '100px', opacity: 0.1 }}>💰</div>
        <div style={{ opacity: 0.8, fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>Daily Revenue</div>
        <div style={{ fontSize: '48px', fontWeight: 900, margin: '8px 0' }}>₹{stats.t.toLocaleString()}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
          <div style={{ padding: '4px 10px', background: 'rgba(255,255,255,0.1)', borderRadius: '20px', fontSize: '12px', fontWeight: 600 }}>{stats.n} Transactions Today</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>💵</div>
            <div style={{ color: 'var(--text-dim)', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase' }}>Cash</div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--success)' }}>₹{stats.c.toLocaleString()}</div>
        </div>
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>📱</div>
            <div style={{ color: 'var(--text-dim)', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase' }}>Online</div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--accent)' }}>₹{stats.o.toLocaleString()}</div>
        </div>
      </div>
    </div>
  );
}
