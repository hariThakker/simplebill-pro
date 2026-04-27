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

  const [expandedBill, setExpandedBill] = useState(null);

  async function fetchHistory() {
    const groupId = localStorage.getItem('selectedGroupId');
    if (!groupId) return;
    setLoading(true);
    const { data } = await supabase.from('bills').select('*').eq('group_id', groupId).order('created_at', { ascending: false });
    setBills(data || []);
    setLoading(false);
  }

  function exportCSV() {
    if (bills.length === 0) { alert('No records to export'); return; }
    
    const headers = ['Date', 'Time', 'Invoice Number', 'Payment Mode', 'Total Amount (INR)', 'Items'];
    const rows = bills.map(b => {
       const d = new Date(b.created_at);
       const itemsStr = b.items?.map(i => `${i.name} (x${i.qty})`).join(', ') || '';
       return [
         d.toLocaleDateString(),
         d.toLocaleTimeString(),
         b.invoice_number,
         b.payment_mode.toUpperCase(),
         b.total_amount,
         `"${itemsStr}"` // quote to escape commas
       ].join(',');
    });
    
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `sales_report_${new Date().toLocaleDateString().replace(/\//g,'-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async function deleteBill(id) {
    if (!confirm('Permanently delete this bill?')) return;
    const { error } = await supabase.from('bills').delete().eq('id', id);
    if (!error) setBills(bills.filter(b => b.id !== id));
  }

  return (
    <div className="page-transition">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h2 style={{ fontSize: '28px', fontWeight: 900 }}>Sales Logs</h2>
          <p style={{ color: 'var(--text-dim)' }}>Detailed record of cloud invoices</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={exportCSV} className="btn" style={{ fontSize: '13px', fontWeight: 700, background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', borderRadius: '12px', padding: '8px 14px' }}>
            <span>📊</span> Export CSV
          </button>
          <button onClick={fetchHistory} className="btn btn-ghost" style={{ fontSize: '13px', fontWeight: 700 }}>
            <span>🔄</span> Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-dim)' }}>Fetching Logs...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
          {bills.map(bill => (
            <div key={bill.id} className="card" style={{ padding: '24px', transition: 'all 0.3s ease' }}>
              <div 
                style={{ cursor: 'pointer' }}
                onClick={() => setExpandedBill(expandedBill === bill.id ? null : bill.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <div style={{ width: '48px', height: '48px', background: 'rgba(var(--accent-raw), 0.05)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>📜</div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '17px', color: 'var(--text)' }}>{bill.invoice_number}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-dim)', fontWeight: 600 }}>{new Date(bill.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 900, fontSize: '22px', color: 'var(--text)' }}>₹{bill.total_amount.toLocaleString()}</div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                      <span style={{ 
                        fontSize: '9px', 
                        padding: '3px 10px', 
                        borderRadius: '20px', 
                        background: bill.payment_mode === 'cash' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)', 
                        color: bill.payment_mode === 'cash' ? 'var(--success)' : 'var(--accent)', 
                        fontWeight: 800, 
                        textTransform: 'uppercase' 
                      }}>
                        {bill.payment_mode === 'cash' ? '💵 Cash' : '📱 Online'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {expandedBill === bill.id && (
                <div style={{ borderTop: '1px solid var(--border)', marginTop: '16px', paddingTop: '16px', animation: 'fadeIn 0.3s ease' }}>
                   <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', marginBottom: '12px', textTransform: 'uppercase' }}>Items in this Bill</label>
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {bill.items?.map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.02)', padding: '10px 14px', borderRadius: '10px' }}>
                           <div>
                              <div style={{ fontSize: '14px', fontWeight: 700 }}>{item.name}</div>
                              <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{item.qty} x ₹{item.price}</div>
                           </div>
                           <div style={{ fontWeight: 800 }}>₹{item.qty * item.price}</div>
                        </div>
                      ))}
                   </div>
                </div>
              )}
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', marginTop: '16px', paddingTop: '16px' }}>
                <button 
                  onClick={() => setExpandedBill(expandedBill === bill.id ? null : bill.id)}
                  style={{ background: 'none', border: 'none', color: 'var(--accent)', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
                >
                   {expandedBill === bill.id ? 'Hide Details' : `Show ${bill.items?.length || 0} Products`}
                </button>
                <button onClick={() => deleteBill(bill.id)} className="btn" style={{ padding: '6px 12px', background: 'rgba(239, 68, 68, 0.05)', color: 'var(--danger)', fontSize: '11px', fontWeight: 800, borderRadius: '8px' }}>
                  VOID BILL
                </button>
              </div>
            </div>
          ))}
          {bills.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 20px', background: 'rgba(0,0,0,0.02)', borderRadius: '24px', border: '2px dashed var(--border)' }}>
              <div style={{ fontSize: '40px', marginBottom: '16px' }}>📉</div>
              <p style={{ fontWeight: 700, color: 'var(--text-dim)' }}>No sales recorded yet.</p>
              <p style={{ fontSize: '13px', color: 'var(--text-light)' }}>Bills generated from POS will appear here.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
