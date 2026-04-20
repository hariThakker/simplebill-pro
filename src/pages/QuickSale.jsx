import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { generateBillContent, sendToPrinter, fallbackNativePrint } from '../utils/printer';

export default function QuickSale() {
  const [items, setItems] = useState([]);
  const [billItems, setBillItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCart, setShowCart] = useState(false);

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

  const updateQty = (id, delta) => {
    setBillItems(billItems.map(i => {
      if (i.id === id) {
        const newQty = Math.max(0, i.qty + delta);
        return newQty === 0 ? null : { ...i, qty: newQty };
      }
      return i;
    }).filter(Boolean));
  };

  const [lastBill, setLastBill] = useState(null);

  async function handleCheckout(paymentMode) {
    if (billItems.length === 0) return;
    const totalAmount = billItems.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;
    const groupId = localStorage.getItem('selectedGroupId');
    const printerMode = localStorage.getItem('printerMode') || 'ble';
    
    const { error } = await supabase.from('bills').insert([{
      group_id: groupId, invoice_number: invoiceNumber, total_amount: totalAmount, payment_mode: paymentMode, items: billItems
    }]);

    if (!error) {
      const { data: business } = await supabase.from('settings').select('*').eq('group_id', groupId).maybeSingle();
      const printedBill = generateBillContent(invoiceNumber, billItems, totalAmount, paymentMode, business || {});
      
      if (printerMode === 'ble') {
        sendToPrinter(printedBill).then(sentOk => { if(!sentOk) fallbackNativePrint(printedBill); });
        finishCheckout();
      } else {
        setLastBill({ content: printedBill, invoiceNumber });
      }
    } else {
      alert("Error saving bill: " + error.message);
    }
  }

  const finishCheckout = () => {
    setBillItems([]);
    setShowCart(false);
    setLastBill(null);
  };

  const totalAmount = billItems.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const totalQty = billItems.reduce((sum, item) => sum + item.qty, 0);

  const CartContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '20px' }}>Current Bill</h3>
        <span style={{ background: 'rgba(var(--accent-raw), 0.1)', color: 'var(--accent)', padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 700 }}>{totalQty} Items</span>
      </div>
      
      <div style={{ flex: 1, overflowY: 'auto', marginBottom: '20px' }}>
        {billItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-light)' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🛒</div>
            <p style={{ fontWeight: 600 }}>Your cart is empty</p>
          </div>
        ) : (
          billItems.map(item => (
            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '15px' }}>{item.name}</div>
                <div style={{ fontSize: '13px', color: 'var(--text-dim)' }}>₹{item.price} each</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', background: '#f1f5f9', borderRadius: '10px', padding: '4px' }}>
                  <button onClick={() => updateQty(item.id, -1)} style={{ width: '28px', height: '28px', border: 'none', background: 'white', borderRadius: '8px', cursor: 'pointer', fontWeight: 800 }}>-</button>
                  <span style={{ width: '32px', textAlign: 'center', fontWeight: 700 }}>{item.qty}</span>
                  <button onClick={() => updateQty(item.id, 1)} style={{ width: '28px', height: '28px', border: 'none', background: 'white', borderRadius: '8px', cursor: 'pointer', fontWeight: 800 }}>+</button>
                </div>
                <div style={{ fontWeight: 800, width: '60px', textAlign: 'right' }}>₹{item.qty * item.price}</div>
              </div>
            </div>
          ))
        )}
      </div>
      
      <div style={{ borderTop: '2px dashed var(--border)', paddingTop: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '22px', fontWeight: 800, marginBottom: '24px' }}>
          <span>Total</span>
          <span style={{ color: 'var(--accent)' }}>₹{totalAmount.toLocaleString()}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <button onClick={() => handleCheckout('cash')} className="btn btn-success" style={{ height: '56px', borderRadius: '16px' }}>
            <span>💵</span> Cash
          </button>
          <button onClick={() => handleCheckout('online')} className="btn btn-accent" style={{ height: '56px', borderRadius: '16px' }}>
            <span>📱</span> Online
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="page-transition">
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '28px', fontWeight: 900 }}>Quick POS</h2>
        <p style={{ color: 'var(--text-dim)' }}>Tap products to create an invoice</p>
      </div>

      <div className="pos-layout-v2">
        {/* Products Grid */}
        <section>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>Loading inventory...</div>
          ) : (
            <div className="pos-grid">
              {items.map(item => (
                <div key={item.id} onClick={() => addToBill(item)} className="product-card">
                  <div style={{ width: '48px', height: '48px', background: '#f1f5f9', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', margin: '0 auto 12px' }}>📦</div>
                  <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '4px' }}>{item.name}</div>
                  <div style={{ fontWeight: 800, color: 'var(--accent)' }}>₹{item.price}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Desktop Sidebar Cart */}
        <aside className="desktop-cart card" style={{ display: 'none', height: 'calc(100vh - 180px)', sticky: 'top', top: '100px' }}>
          <CartContent />
        </aside>
      </div>

      {/* Floating Cart Button for Mobile */}
      {billItems.length > 0 && !showCart && (
        <button 
          onClick={() => setShowCart(true)} 
          className="btn btn-primary" 
          style={{ position: 'fixed', bottom: '100px', left: '20px', right: '20px', height: '60px', borderRadius: '20px', boxShadow: '0 10px 25px rgba(var(--primary-raw), 0.3)', zIndex: 900, animation: 'slideUp 0.3s ease' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', padding: '0 8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ background: 'white', color: 'var(--primary)', width: '28px', height: '28px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '14px' }}>{totalQty}</span>
              <span style={{ fontWeight: 700 }}>Review Bill</span>
            </div>
            <span style={{ fontSize: '18px', fontWeight: 800 }}>₹{totalAmount.toLocaleString()}</span>
          </div>
        </button>
      )}

      {/* Mobile Cart Drawer */}
      {showCart && (
        <>
          <div className="cart-drawer-overlay" onClick={() => setShowCart(false)} />
          <div className="cart-drawer">
            <div style={{ width: '40px', height: '4px', background: '#e2e8f0', borderRadius: '2px', margin: '0 auto 16px' }} />
            <CartContent />
          </div>
        </>
      )}

      {/* Digital Receipt Modal */}
      {lastBill && (
        <div className="cart-drawer-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="card page-transition" style={{ maxWidth: '400px', width: '100%', padding: '24px', position: 'relative' }}>
             <button onClick={finishCheckout} style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>✕</button>
             <div style={{ textAlign: 'center', marginBottom: '20px' }}>
               <div style={{ width: '60px', height: '60px', background: 'rgba(var(--success-raw), 0.1)', color: 'var(--success)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', margin: '0 auto 16px' }}>✓</div>
               <h3 style={{ fontSize: '20px' }}>Bill Generated!</h3>
               <p style={{ color: 'var(--text-dim)', fontSize: '14px' }}>#{lastBill.invoiceNumber}</p>
             </div>
             
             <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', marginBottom: '24px', maxHeight: '300px', overflowY: 'auto' }}>
               <pre style={{ margin: 0, fontSize: '11px', fontFamily: 'monospace', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>
                 {lastBill.content}
               </pre>
             </div>

             <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
               <button onClick={() => {
                 const text = encodeURIComponent(lastBill.content);
                 window.open(`https://wa.me/?text=${text}`, '_blank');
               }} className="btn btn-success" style={{ width: '100%', borderRadius: '14px' }}>
                 Share on WhatsApp
               </button>
               <button onClick={finishCheckout} className="btn btn-ghost" style={{ width: '100%' }}>
                 Done & Close
               </button>
             </div>
          </div>
        </div>
      )}

      <style>{`
        @media (min-width: 1024px) {
          .pos-layout-v2 { display: grid; grid-template-columns: 1fr 380px; gap: 32px; }
          .desktop-cart { display: block !important; }
          .btn-primary[style*="fixed"] { display: none !important; }
        }
      `}</style>
    </div>
  );
}
