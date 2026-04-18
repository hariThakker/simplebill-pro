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
    const { data, error } = await supabase
      .from('bills')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });
      
    if (error) console.error(error);
    else setBills(data || []);
    setLoading(false);
  }

  async function deleteBill(id) {
    if (!confirm('Are you sure you want to delete this bill from cloud?')) return;
    const { error } = await supabase.from('bills').delete().eq('id', id);
    if (!error) setBills(bills.filter(b => b.id !== id));
    else alert('Error deleting: ' + error.message);
  }

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h2>Bill History</h2>
        <button onClick={fetchHistory} style={{ background: '#64748b' }}>Refresh</button>
      </div>

      {loading ? <p>Loading history...</p> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <thead>
              <tr style={{ background: '#f1f5f9', textAlign: 'left' }}>
                <th style={{ padding: '12px' }}>Date</th>
                <th style={{ padding: '12px' }}>Invoice #</th>
                <th style={{ padding: '12px' }}>Mode</th>
                <th style={{ padding: '12px' }}>Total</th>
                <th style={{ padding: '12px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {bills.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>No bills found in cloud.</td>
                </tr>
              ) : null}
              {bills.map(bill => (
                <tr key={bill.id} style={{ borderTop: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '12px', fontSize: '14px' }}>
                    {new Date(bill.created_at).toLocaleDateString()} {new Date(bill.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td style={{ padding: '12px', fontSize: '14px', fontWeight: 'bold' }}>{bill.invoice_number}</td>
                  <td style={{ padding: '12px' }}>
                    <span style={{ 
                      padding: '4px 8px', 
                      borderRadius: '4px', 
                      fontSize: '11px', 
                      fontWeight: 'bold',
                      textTransform: 'uppercase',
                      background: bill.payment_mode.toLowerCase() === 'cash' ? '#dcfce7' : '#fef3c7',
                      color: bill.payment_mode.toLowerCase() === 'cash' ? '#166534' : '#92400e'
                    }}>
                      {bill.payment_mode}
                    </span>
                  </td>
                  <td style={{ padding: '12px', fontWeight: 'bold' }}>₹{Number(bill.total_amount).toFixed(2)}</td>
                  <td style={{ padding: '12px' }}>
                    <button 
                      onClick={() => deleteBill(bill.id)}
                      style={{ padding: '5px 10px', background: '#ef4444', fontSize: '12px' }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
