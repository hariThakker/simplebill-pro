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
      if (!selectedGroup && data.length > 0) {
        changeGroup(data[0].id);
      }
    }
  }

  function changeGroup(id) {
    setSelectedGroup(id);
    localStorage.setItem('selectedGroupId', id);
    window.dispatchEvent(new Event('groupChanged'));
  }

  async function createGroup() {
    const name = prompt('Enter New Group Name:');
    if (name) {
      const { data, error } = await supabase.from('groups').insert([{ name }]).select();
      if (!error && data) {
        setGroups([...groups, data[0]]);
        changeGroup(data[0].id);
      }
    }
  }

  return (
    <div className="dashboard">
      <div className="sidebar">
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: '18px', color: 'var(--primary)', marginBottom: '15px' }}>SimpleBill Pro</h2>
          <select 
            value={selectedGroup} 
            onChange={(e) => changeGroup(e.target.value)}
            style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)' }}
          >
            <option value="">Select Group</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <button 
            onClick={createGroup}
            style={{ width: '100%', marginTop: '10px', fontSize: '12px', background: 'transparent', color: 'var(--primary)', border: '1px solid var(--primary)' }}
          >
            + New Group
          </button>
        </div>
        <div className="nav-section" style={{ padding: '20px' }}>
          <div className="nav-title">MAIN</div>
          <Link to="/" className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}>📊 Dashboard</Link>
          <Link to="/pos" className={`nav-link ${location.pathname === '/pos' ? 'active' : ''}`}>🛍️ Quick Sale</Link>
          <Link to="/inventory" className={`nav-link ${location.pathname === '/inventory' ? 'active' : ''}`}>📦 Inventory</Link>
          <Link to="/history" className={`nav-link ${location.pathname === '/history' ? 'active' : ''}`}>📜 Bill History</Link>
          <div className="nav-title" style={{marginTop: '20px'}}>TOOLS</div>
          <Link to="/settings" className={`nav-link ${location.pathname === '/settings' ? 'active' : ''}`}>⚙️ Business Setup</Link>
          <button className="nav-link" onClick={handleConnection}>
            {(!isConnected && hasHistory) ? '⚡ Reconnect' : '🖨️ Connect Printer'} 
            <span style={{ fontSize: '10px', marginLeft: '5px', color: isConnected ? '#10b981' : '#ef4444' }}>
              {isConnected ? '(Connected ✅)' : '(Disconnected ❌)'}
            </span>
          </button>
        </div>
      </div>
      <div className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard selectedGroup={selectedGroup} />} />
          <Route path="/pos" element={<QuickSale />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/history" element={<BillHistory />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </div>
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
    
    // Subscribe to realtime changes!
    const channel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bills' }, fetchTodayStats)
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('groupChanged', fetchTodayStats);
    };
  }, [selectedGroup]);

  async function fetchTodayStats() {
    const groupId = localStorage.getItem('selectedGroupId');
    if (!groupId) return;

    const today = new Date();
    today.setHours(0,0,0,0);
    
    const { data: bills, error } = await supabase
      .from('bills')
      .select('*')
      .eq('group_id', groupId)
      .gte('created_at', today.toISOString());
      
    if (error) console.error(error);
    if (!bills) return;
    
    let t = 0, c = 0, o = 0;
    bills.forEach(b => {
      t += Number(b.total_amount);
      if (b.payment_mode.toLowerCase() === 'cash') c += Number(b.total_amount);
      else o += Number(b.total_amount);
    });
    
    setRevenue(t);
    setCash(c);
    setOnline(o);
    setInvoices(bills.length);
  }

  return (
    <div style={{padding: '20px'}}>
      <h2 style={{marginBottom: '20px'}}>Live Cloud Dashboard</h2>
      <div className="metrics-grid" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px'}}>
        <div style={{background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.1)'}}>
          <div style={{color: '#64748b', fontSize: '13px', fontWeight: 600}}>TOTAL REVENUE TODAY</div>
          <div style={{fontSize: '28px', fontWeight: 700, color: '#2563eb'}}>₹{revenue.toFixed(2)}</div>
          <div style={{fontSize: '12px', color: '#10b981'}}>{invoices} Configured Invoices via Supabase</div>
        </div>
        <div style={{background: 'white', padding: '20px', borderRadius: '12px', borderLeft: '4px solid #10b981', boxShadow: '0 1px 3px rgba(0,0,0,0.1)'}}>
          <div style={{color: '#64748b', fontSize: '13px', fontWeight: 600}}>CASH COLLECTIONS</div>
          <div style={{fontSize: '28px', fontWeight: 700, color: '#10b981'}}>₹{cash.toFixed(2)}</div>
        </div>
        <div style={{background: 'white', padding: '20px', borderRadius: '12px', borderLeft: '4px solid #f59e0b', boxShadow: '0 1px 3px rgba(0,0,0,0.1)'}}>
          <div style={{color: '#64748b', fontSize: '13px', fontWeight: 600}}>ONLINE PAYMENTS</div>
          <div style={{fontSize: '28px', fontWeight: 700, color: '#f59e0b'}}>₹{online.toFixed(2)}</div>
        </div>
      </div>
    </div>
  );
}
