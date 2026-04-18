import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export default function BillHistory() {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
    window.addEventListener('groupChanged', fetchHistory);
    return () => window.removeEventListener('groupChanged', fetchHistory);
  }, []);

  async function fetchHistory() {
    const groupId = localStorage.getItem('selectedGroupId');
    if (!groupId) return;
    setLoading(true);
    const { data } = await supabase.from('bills').select('*').eq('group_id', groupId).order('created_at', { ascending: false });
    setBills(data || []);
    setLoading(false);
  }

  async function deleteBill(id) {
    if (!confirm('Permanently delete this bill?')) return;
    const { error } = await supabase.from('bills').delete().eq('id', id);
    if (!error) setBills(bills.filter(b => b.id !== id));
  }

  return (
    <div className="page-transition">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 800 }}>History</h2>
          <p style={{ color: 'var(--text-light)' }}>View and manage past bills</p>
        </div>
        <button onClick={fetchHistory} style={{ padding: '8px 16px', background: 'var(--primary-light)', color: 'var(--primary)' }}>Refresh</button>
      </div>

      {loading ? <p>Loading...</p> : (
        <div>
          {bills.map(bill => (
            <div key={bill.id} className="card" style={{ marginBottom: '12px', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '16px' }}>#{bill.invoice_number}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-light)' }}>{new Date(bill.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 800, fontSize: '18px', color: 'var(--primary)' }}>₹{bill.total_amount.toLocaleString()}</div>
                  <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '4px', background: bill.payment_mode === 'cash' ? '#dcfce7' : '#fef3c7', color: bill.payment_mode === 'cash' ? '#166534' : '#92400e', fontWeight: 700, textTransform: 'uppercase' }}>{bill.payment_mode}</span>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                <div style={{ fontSize: '13px', color: 'var(--text-light)' }}>{bill.items?.length || 0} items</div>
                <button onClick={() => deleteBill(bill.id)} style={{ padding: '6px 12px', background: 'white', border: '1px solid var(--danger)', color: 'var(--danger)', fontSize: '12px' }}>Delete</button>
              </div>
            </div>
          ))}
          {bills.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-light)', padding: '40px' }}>No history found.</p>}
        </div>
      )}
    </div>
  );
}
