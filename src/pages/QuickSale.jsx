import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { generateBillContent, sendToPrinter, fallbackNativePrint } from '../utils/printer';

export default function QuickSale() {
  const [items, setItems] = useState([]);
  const [billItems, setBillItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInventory();
    window.addEventListener('groupChanged', fetchInventory);
    return () => window.removeEventListener('groupChanged', fetchInventory);
  }, []);

  async function fetchInventory() {
    const groupId = localStorage.getItem('selectedGroupId');
    if (!groupId) return;
    setLoading(true);
    const { data } = await supabase.from('inventory').select('*').eq('group_id', groupId);
    setItems(data || []);
    setLoading(false);
  }

  const addToBill = (item) => {
    const existing = billItems.find(i => i.id === item.id);
    if (existing) {
      setBillItems(billItems.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i));
    } else {
      setBillItems([...billItems, { ...item, qty: 1 }]);
    }
  };

  const removeFromBill = (id) => {
    setBillItems(billItems.filter(i => i.id !== id));
  };

  async function handleCheckout(paymentMode) {
    if (billItems.length === 0) return;
    const total = billItems.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;
    const groupId = localStorage.getItem('selectedGroupId');
    
    const { error } = await supabase.from('bills').insert([{
      group_id: groupId, invoice_number: invoiceNumber, total_amount: total, payment_mode: paymentMode, items: billItems
    }]);

    if (!error) {
      const { data: business } = await supabase.from('settings').select('*').eq('group_id', groupId).maybeSingle();
      const printedBill = generateBillContent(invoiceNumber, billItems, total, paymentMode, business || {});
      sendToPrinter(printedBill).then(sentOk => { if(!sentOk) fallbackNativePrint(printedBill); });
      setBillItems([]);
    } else {
      alert("Error saving bill: " + error.message);
    }
  }

  const total = billItems.reduce((sum, item) => sum + (item.price * item.qty), 0);

  return (
    <div className="page-transition" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 800 }}>Quick Sale</h2>
          <p style={{ color: 'var(--text-light)' }}>Tap products to add to bill</p>
        </div>
      </div>

      <div className="pos-layout" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
        {/* Products Column */}
        <section>
          {loading ? <p>Loading items...</p> : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '12px' }}>
              {items.map(item => (
                <div key={item.id} onClick={() => addToBill(item)} className="card" style={{ padding: '12px', textAlign: 'center', cursor: 'pointer' }}>
                  <div style={{ fontSize: '24px', marginBottom: '8px' }}>📦</div>
                  <div style={{ fontWeight: 700, fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                  <div style={{ color: var('--primary'), fontWeight: 800, marginTop: '4px' }}>₹{item.price}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Cart Column */}
        <section className="card" style={{ display: 'flex', flexDirection: 'column', maxHeight: '500px' }}>
          <h3 style={{ marginBottom: '16px' }}>Current Bill</h3>
          <div style={{ flex: 1, overflowY: 'auto', marginBottom: '16px' }}>
            {billItems.length === 0 ? <p style={{ color: 'var(--text-light)', textAlign: 'center', padding: '20px' }}>Cart is empty</p> : null}
            {billItems.map(item => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{item.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-light)' }}>{item.qty} x ₹{item.price}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ fontWeight: 700 }}>₹{item.qty * item.price}</div>
                  <button onClick={() => removeFromBill(item.id)} style={{ padding: '4px 8px', background: 'var(--primary-light)', color: 'var(--primary)', fontSize: '12px' }}>×</button>
                </div>
              </div>
            ))}
          </div>
          
          <div style={{ borderTop: '2px dashed var(--border)', paddingTop: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '20px', fontWeight: 800, marginBottom: '16px' }}>
              <span>Total</span>
              <span>₹{total.toLocaleString()}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <button onClick={() => handleCheckout('cash')} style={{ padding: '14px', background: 'var(--success)', color: 'white' }}>Pay Cash</button>
              <button onClick={() => handleCheckout('online')} style={{ padding: '14px', background: 'var(--warning)', color: 'white' }}>Pay Online</button>
            </div>
          </div>
        </section>
      </div>

      <style>{`
        @media (min-width: 1024px) {
          .pos-layout { grid-template-columns: 1fr 350px !important; }
        }
      `}</style>
    </div>
  );
}
