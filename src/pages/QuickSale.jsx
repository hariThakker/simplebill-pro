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
    const { data } = await supabase
      .from('inventory')
      .select('*')
      .eq('group_id', groupId);
    setItems(data || []);
    setLoading(false);
  }

  function addToBill(product) {
    const existing = billItems.find(i => i.id === product.id);
    if (existing) {
      setBillItems(billItems.map(i => i.id === product.id ? {...i, qty: i.qty + 1} : i));
    } else {
      setBillItems([...billItems, { ...product, qty: 1 }]);
    }
  }

  function updateQty(id, delta) {
    setBillItems(billItems.map(i => {
      if (i.id === id) {
        const newQty = i.qty + delta;
        return newQty > 0 ? { ...i, qty: newQty } : null;
      }
      return i;
    }).filter(Boolean));
  }

  async function handleCheckout(paymentMode) {
    if (billItems.length === 0) return;
    
    // Calculate total
    const total = billItems.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;
    const groupId = localStorage.getItem('selectedGroupId');
    
    const { error } = await supabase.from('bills').insert([{
      group_id: groupId,
      invoice_number: invoiceNumber,
      total_amount: total,
      payment_mode: paymentMode,
      items: billItems
    }]);

    if (!error) {
      // Fetch settings to include in print
      const { data: business } = await supabase
        .from('settings')
        .select('*')
        .eq('group_id', groupId)
        .maybeSingle();

      const printedBill = generateBillContent(invoiceNumber, billItems, total, paymentMode, business || {});
      sendToPrinter(printedBill).then(sentOk => {
         if(!sentOk) fallbackNativePrint(printedBill);
      });
      setBillItems([]);
    } else {
      console.error(error);
      alert("Error saving bill");
    }
  }

  const subtotal = billItems.reduce((sum, item) => sum + (item.price * item.qty), 0);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '20px', height: '100%', padding: '20px' }}>
      
      {/* PRODUCTS GRID */}
      <div>
        <h2 style={{ marginBottom: '20px' }}>Select Products</h2>
        {loading ? <p>Loading...</p> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '15px' }}>
            {items.map(product => (
              <div 
                key={product.id} 
                onClick={() => addToBill(product)}
                style={{ background: 'white', padding: '15px', borderRadius: '10px', border: '2px solid #e2e8f0', cursor: 'pointer', textAlign: 'center' }}
              >
                <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '10px' }}>{product.name}</div>
                <div style={{ color: '#2563eb', fontWeight: 'bold' }}>₹{product.price}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CURRENT BILL */}
      <div style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ marginBottom: '15px' }}>Current Bill</h3>
        
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {billItems.length === 0 ? <p style={{ color: '#64748b', fontSize: '14px' }}>No items added</p> : null}
          {billItems.map(item => (
            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', padding: '10px', background: '#f8fafc', borderRadius: '8px' }}>
              <div style={{ flex: 1, fontSize: '14px', fontWeight: 'bold' }}>{item.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button onClick={() => updateQty(item.id, -1)} style={{ padding: '2px 8px', background: 'white', color: 'black', border: '1px solid #e2e8f0' }}>-</button>
                <span style={{ fontSize: '14px' }}>{item.qty}</span>
                <button onClick={() => updateQty(item.id, 1)} style={{ padding: '2px 8px', background: 'white', color: 'black', border: '1px solid #e2e8f0' }}>+</button>
              </div>
            </div>
          ))}
        </div>

        <div style={{ borderTop: '2px solid #e2e8f0', paddingTop: '15px', marginTop: '15px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: 'bold', marginBottom: '20px' }}>
            <span>Total:</span>
            <span style={{ color: '#2563eb' }}>₹{subtotal.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => handleCheckout('cash')} style={{ flex: 1, background: '#10b981' }}>Pay Cash</button>
            <button onClick={() => handleCheckout('online')} style={{ flex: 1, background: '#f59e0b' }}>Pay Online</button>
          </div>
        </div>

      </div>
    </div>
  );
}
