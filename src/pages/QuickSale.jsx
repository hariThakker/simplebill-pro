import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import {
  generateBillContent,
  sendToPrinter,
  printFormattedReceipt,
  printOrderToken,
  printBothReceiptAndToken,
  getNextTokenNumber
} from '../utils/printer';
import html2canvas from 'html2canvas';
import {
  SearchIcon,
  ShoppingCartIcon,
  PlusIcon,
  MinusIcon,
  Trash2Icon,
  SparklesIcon,
  XIcon,
  PrinterIcon,
  Share2Icon,
  CheckCircle2Icon,
  PackageIcon,
  CreditCardIcon,
  BanknoteIcon
} from '../components/Icons';
import CopyButton from '../components/CopyButton';
import { SkeletonProductCard } from '../components/Skeleton';
import { useToast } from '../components/Toast';

export default function QuickSale() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [billItems, setBillItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCart, setShowCart] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [discountPercentage, setDiscountPercentage] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [lastBill, setLastBill] = useState(null);
  const [orderType, setOrderType] = useState('Takeaway / Pickup');
  const [modalSlipView, setModalSlipView] = useState('bill'); // 'bill' | 'token'

  // Wheel states
  const [showWheel, setShowWheel] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [wheelRotation, setWheelRotation] = useState(0);

  const receiptRef = useRef(null);

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
      .eq('group_id', groupId)
      .order('name');
    setItems(data || []);
    setLoading(false);
  }

  const addToBill = (item) => {
    if (item.stock <= 0) {
      toast.warning(`${item.name} is out of stock`);
      return;
    }
    const existing = billItems.find((i) => i.id === item.id);
    if (existing) {
      if (existing.qty >= item.stock) {
        toast.warning(`Only ${item.stock} units available in stock`);
        return;
      }
      setBillItems(billItems.map((i) => (i.id === item.id ? { ...i, qty: i.qty + 1 } : i)));
    } else {
      setBillItems([...billItems, { ...item, qty: 1 }]);
    }
  };

  const updateQty = (id, delta) => {
    const targetItem = items.find((i) => i.id === id);
    setBillItems(
      billItems
        .map((i) => {
          if (i.id === id) {
            const newQty = i.qty + delta;
            if (delta > 0 && targetItem && newQty > targetItem.stock) {
              toast.warning(`Maximum available stock reached (${targetItem.stock})`);
              return i;
            }
            return newQty <= 0 ? null : { ...i, qty: newQty };
          }
          return i;
        })
        .filter(Boolean)
    );
  };

  const removeItem = (id) => {
    setBillItems(billItems.filter((i) => i.id !== id));
  };

  const rawTotalAmount = billItems.reduce((sum, item) => sum + item.price * item.qty, 0);
  const calculatedDiscount = rawTotalAmount * (discountPercentage / 100) + Number(discountAmount || 0);
  const finalDiscountValue = Math.min(rawTotalAmount, Math.max(0, calculatedDiscount));
  const totalAmount = Math.max(0, rawTotalAmount - finalDiscountValue);
  const totalQty = billItems.reduce((sum, item) => sum + item.qty, 0);

  async function handleCheckout(paymentMode) {
    if (billItems.length === 0 || isCheckingOut) return;
    setIsCheckingOut(true);

    try {
      const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;
      const groupId = localStorage.getItem('selectedGroupId');
      const printerMode = localStorage.getItem('printerMode') || 'ble';

      const { error } = await supabase.from('bills').insert([
        {
          group_id: groupId,
          invoice_number: invoiceNumber,
          total_amount: totalAmount,
          payment_mode: paymentMode,
          items: billItems
        }
      ]);

      if (error) throw error;

      // Decrement inventory stock
      await Promise.all(
        billItems.map(async (item) => {
          const { data: currentItem } = await supabase
            .from('inventory')
            .select('stock')
            .eq('id', item.id)
            .single();
          if (currentItem) {
            await supabase
              .from('inventory')
              .update({ stock: Math.max(0, currentItem.stock - item.qty) })
              .eq('id', item.id);
          }
        })
      );

      window.dispatchEvent(new Event('groupChanged'));

      const { data: business } = await supabase
        .from('settings')
        .select('*')
        .eq('group_id', groupId)
        .maybeSingle();

      const storedLocalLogo = (groupId ? localStorage.getItem(`receiptLogo_${groupId}`) : null) || localStorage.getItem('receiptLogo') || '';
      const effectiveLogo =
        (storedLocalLogo && storedLocalLogo.startsWith('data:'))
          ? storedLocalLogo
          : (business?.logo_url || storedLocalLogo || '');

      const printedBill = generateBillContent(
        invoiceNumber,
        billItems,
        totalAmount,
        paymentMode,
        business || {}
      );

      const tokenNumber = getNextTokenNumber(groupId);
      const autoPrintToken = localStorage.getItem('autoPrintToken') === 'true';

      const billSnapshot = {
        content: printedBill,
        invoiceNumber,
        tokenNumber,
        orderType,
        billItems: [...billItems],
        finalAmount: totalAmount,
        paymentMode,
        business: { ...(business || {}), logo_url: effectiveLogo },
        subtotal: rawTotalAmount,
        discount: finalDiscountValue,
        logoUrl: effectiveLogo
      };

      if (printerMode === 'ble') {
        sendToPrinter(printedBill).then((sentOk) => {
          if (!sentOk) {
            if (autoPrintToken) {
              printBothReceiptAndToken(
                {
                  invoiceNumber,
                  items: billItems,
                  total: totalAmount,
                  paymentMode,
                  business: { ...(business || {}), logo_url: effectiveLogo },
                  subtotal: rawTotalAmount,
                  discount: finalDiscountValue,
                  logoUrl: effectiveLogo
                },
                {
                  tokenNumber,
                  invoiceNumber,
                  items: billItems,
                  orderType,
                  business: { ...(business || {}), logo_url: effectiveLogo },
                  logoUrl: effectiveLogo
                }
              );
            } else {
              printFormattedReceipt({
                invoiceNumber,
                items: billItems,
                total: totalAmount,
                paymentMode,
                business: { ...(business || {}), logo_url: effectiveLogo },
                subtotal: rawTotalAmount,
                discount: finalDiscountValue,
                logoUrl: effectiveLogo
              });
            }
          }
        });
        toast.success(`Invoice #${invoiceNumber} • Token #${tokenNumber} recorded`);
        setLastBill(billSnapshot);
      } else {
        setLastBill(billSnapshot);
        toast.success(`Invoice #${invoiceNumber} • Token #${tokenNumber} ready`);
      }
    } catch (err) {
      toast.error('Checkout failed: ' + err.message);
    } finally {
      setIsCheckingOut(false);
    }
  }

  const finishCheckout = () => {
    setBillItems([]);
    setShowCart(false);
    setLastBill(null);
    setModalSlipView('bill');
    setDiscountPercentage(0);
    setDiscountAmount(0);
  };

  const spinWheel = () => {
    if (spinning) return;
    setSpinning(true);
    const rates = (localStorage.getItem('discountRates') || '0,5,10,15,20,25').split(',').map(Number);
    const numSlices = rates.length;
    const sliceAngle = 360 / numSlices;

    const randomIndex = Math.floor(Math.random() * numSlices);
    const targetDiscount = rates[randomIndex];

    const extraSpins = 5;
    const targetRotation = extraSpins * 360 + (360 - randomIndex * sliceAngle) - sliceAngle / 2;

    setWheelRotation((prev) => prev + targetRotation);

    setTimeout(() => {
      setDiscountPercentage(targetDiscount);
      setSpinning(false);
      toast.success(`Won ${targetDiscount}% promotional discount!`);
      setTimeout(() => setShowWheel(false), 1400);
    }, 4000);
  };

  // Filtered products
  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  const renderCart = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', paddingBottom: '14px', borderBottom: '1px solid var(--border)' }}>
        <div>
          <h3 style={{ fontSize: '18px', fontWeight: 800 }}>Current Bill</h3>
          <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Quick invoice creation</span>
        </div>
        <span
          style={{
            background: 'var(--primary-subtle)',
            color: 'var(--primary)',
            padding: '4px 10px',
            borderRadius: 'var(--radius-full)',
            fontSize: '11.5px',
            fontWeight: 700
          }}
        >
          {totalQty} {totalQty === 1 ? 'item' : 'items'}
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', marginBottom: '16px', paddingRight: '4px' }}>
        {billItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-light)' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--card-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', color: 'var(--text-dim)' }}>
              <ShoppingCartIcon size={24} />
            </div>
            <p style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-secondary)' }}>Cart is empty</p>
            <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '4px' }}>Select products from the catalog to add items</p>
          </div>
        ) : (
          billItems.map((item) => (
            <div
              key={item.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 0',
                borderBottom: '1px solid var(--border-subtle)',
                gap: '8px'
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.name}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-dim)', fontVariantNumeric: 'tabular-nums' }}>
                  ₹{item.price} each
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: 'var(--card-subtle)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-xs)',
                    padding: '2px'
                  }}
                >
                  <button
                    type="button"
                    onClick={() => updateQty(item.id, -1)}
                    style={{ width: '26px', height: '26px', border: 'none', background: 'var(--card)', color: 'var(--text)', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    aria-label={`Decrease quantity of ${item.name}`}
                  >
                    <MinusIcon size={12} />
                  </button>
                  <span style={{ width: '28px', textAlign: 'center', fontWeight: 700, fontSize: '12.5px', fontVariantNumeric: 'tabular-nums' }}>
                    {item.qty}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateQty(item.id, 1)}
                    style={{ width: '26px', height: '26px', border: 'none', background: 'var(--card)', color: 'var(--text)', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    aria-label={`Increase quantity of ${item.name}`}
                  >
                    <PlusIcon size={12} />
                  </button>
                </div>

                <div style={{ fontWeight: 800, width: '58px', textAlign: 'right', fontSize: '13.5px', color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                  ₹{item.qty * item.price}
                </div>

                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '4px' }}
                  title="Remove from cart"
                  aria-label={`Remove ${item.name}`}
                >
                  <Trash2Icon size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Cart Summary & Discount controls */}
      <div style={{ borderTop: '2px dashed var(--border)', paddingTop: '16px' }}>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
          <input
            type="number"
            placeholder="Flat Discount (₹)"
            className="input-v2"
            style={{ flex: 1, padding: '8px 12px', fontSize: '13px' }}
            value={discountAmount || ''}
            onChange={(e) => setDiscountAmount(e.target.value === '' ? 0 : Number(e.target.value))}
            min="0"
          />
          <button
            type="button"
            onClick={() => setShowWheel(true)}
            className="btn btn-secondary btn-sm"
            style={{ border: '1px solid var(--accent-amber)', color: 'var(--accent-amber)' }}
            title="Spin Promotional Discount Wheel"
          >
            <SparklesIcon size={14} />
            <span>Spin Wheel</span>
          </button>
        </div>

        {finalDiscountValue > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12.5px', fontWeight: 600, color: 'var(--success)', marginBottom: '8px' }}>
            <span>
              Discount Applied {discountPercentage > 0 ? `(${discountPercentage}%)` : ''}
              <button
                type="button"
                onClick={() => {
                  setDiscountPercentage(0);
                  setDiscountAmount(0);
                }}
                style={{ marginLeft: '8px', background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '11px', fontWeight: 700 }}
              >
                Clear
              </button>
            </span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>-₹{finalDiscountValue.toLocaleString()}</span>
          </div>
        )}

        {/* Order Type Toggle (Takeaway / Dine-in) */}
        <div style={{ display: 'flex', background: 'var(--card-subtle)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xs)', padding: '2px', marginBottom: '14px', gap: '3px' }}>
          <button
            type="button"
            onClick={() => setOrderType('Takeaway / Pickup')}
            style={{
              flex: 1,
              padding: '6px 8px',
              fontSize: '11px',
              fontWeight: 700,
              borderRadius: 'var(--radius-xs)',
              border: 'none',
              cursor: 'pointer',
              background: orderType === 'Takeaway / Pickup' ? 'var(--primary)' : 'transparent',
              color: orderType === 'Takeaway / Pickup' ? '#ffffff' : 'var(--text-dim)',
              transition: 'all 0.15s ease'
            }}
          >
            🥡 Takeaway (Token)
          </button>
          <button
            type="button"
            onClick={() => setOrderType('Dine-in')}
            style={{
              flex: 1,
              padding: '6px 8px',
              fontSize: '11px',
              fontWeight: 700,
              borderRadius: 'var(--radius-xs)',
              border: 'none',
              cursor: 'pointer',
              background: orderType === 'Dine-in' ? 'var(--primary)' : 'transparent',
              color: orderType === 'Dine-in' ? '#ffffff' : 'var(--text-dim)',
              transition: 'all 0.15s ease'
            }}
          >
            🍽️ Dine-in
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '20px', fontWeight: 800, marginBottom: '16px' }}>
          <span>Net Payable</span>
          <span style={{ color: 'var(--primary)', fontFamily: 'var(--font-display)', fontVariantNumeric: 'tabular-nums' }}>
            ₹{totalAmount.toLocaleString()}
          </span>
        </div>

        {/* Payment Buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <button
            type="button"
            disabled={billItems.length === 0 || isCheckingOut}
            onClick={() => handleCheckout('cash')}
            className="btn btn-secondary"
            style={{ height: '48px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--card-subtle)' }}
          >
            <BanknoteIcon size={18} style={{ color: 'var(--success)' }} />
            <span>Cash</span>
          </button>
          <button
            type="button"
            disabled={billItems.length === 0 || isCheckingOut}
            onClick={() => handleCheckout('online')}
            className="btn btn-primary"
            style={{ height: '48px', borderRadius: 'var(--radius-sm)' }}
          >
            <CreditCardIcon size={18} />
            <span>Online / UPI</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="page-transition">
      {/* Header & Product Search */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '26px', fontWeight: 800 }}>Point of Sale</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px' }}>
            Tap products to add items to invoice
          </p>
        </div>

        {/* Search Bar */}
        <div style={{ position: 'relative', width: '100%', maxWidth: '320px' }}>
          <SearchIcon size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)', pointerEvents: 'none' }} />
          <input
            type="text"
            className="input-v2"
            placeholder="Search catalog..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '36px', height: '42px', fontSize: '13.5px' }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '2px' }}
              aria-label="Clear search"
            >
              <XIcon size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="pos-layout-v2">
        {/* Products Grid */}
        <section>
          {loading ? (
            <div className="pos-grid">
              {Array.from({ length: 8 }).map((_, i) => (
                <SkeletonProductCard key={i} />
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '60px 20px', border: '2px dashed var(--border)' }}>
              <PackageIcon size={36} style={{ color: 'var(--text-dim)', margin: '0 auto 12px' }} />
              <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '4px' }}>
                {searchQuery ? `No items matching "${searchQuery}"` : 'No inventory available'}
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-dim)' }}>
                {searchQuery ? 'Try another search term or clear the filter.' : 'Go to Inventory to add products.'}
              </p>
            </div>
          ) : (
            <div className="pos-grid">
              {filteredItems.map((item) => {
                const isOutOfStock = item.stock <= 0;
                return (
                  <div
                    key={item.id}
                    onClick={() => !isOutOfStock && addToBill(item)}
                    className={`product-card ${isOutOfStock ? 'out-of-stock' : ''}`}
                    style={{ opacity: isOutOfStock ? 0.55 : 1, cursor: isOutOfStock ? 'not-allowed' : 'pointer' }}
                  >
                    <div className="product-icon-wrap">
                      <PackageIcon size={22} />
                    </div>
                    <div className="product-name">{item.name}</div>
                    <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                      <span className="product-price tabular-nums">₹{item.price}</span>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          color: isOutOfStock ? 'var(--danger)' : item.stock <= 5 ? 'var(--warning)' : 'var(--text-dim)'
                        }}
                      >
                        {isOutOfStock ? 'Out' : `${item.stock} left`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Desktop Sticky Sidebar Cart */}
        <aside className="desktop-cart card" style={{ display: 'none', height: 'calc(100vh - 160px)', position: 'sticky', top: '90px' }}>
          {renderCart()}
        </aside>
      </div>

      {/* Floating Cart Review Button for Mobile (Only on screens < 1024px) */}
      {billItems.length > 0 && !showCart && (
        <button
          type="button"
          onClick={() => setShowCart(true)}
          className="btn btn-primary pos-mobile-cart-btn"
          aria-label={`Review cart: ${totalQty} items totaling ₹${totalAmount}`}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="pos-mobile-cart-badge">
              {totalQty}
            </span>
            <span style={{ fontWeight: 700 }}>Review Cart</span>
          </div>
          <span style={{ fontSize: '16px', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
            ₹{totalAmount.toLocaleString()}
          </span>
        </button>
      )}

      {/* Mobile Cart Bottom Drawer */}
      {showCart && (
        <>
          <div className="cart-drawer-overlay" onClick={() => setShowCart(false)} />
          <div className="cart-drawer">
            <div style={{ width: '40px', height: '4px', background: 'var(--border)', borderRadius: '2px', margin: '0 auto 16px' }} />
            {renderCart()}
          </div>
        </>
      )}

      {/* Promotional Discount Wheel Modal */}
      {showWheel && (
        <div className="modal-backdrop" onClick={() => !spinning && setShowWheel(false)}>
          <div
            className="modal-container page-transition"
            style={{ maxWidth: '400px', textAlign: 'center' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="modal-close-btn"
              onClick={() => !spinning && setShowWheel(false)}
              disabled={spinning}
              aria-label="Close discount wheel"
            >
              <XIcon size={18} />
            </button>

            <span className="floating-contact-badge">Loyalty Reward</span>
            <h3 style={{ fontSize: '20px', fontWeight: 800, marginTop: '4px', marginBottom: '4px' }}>
              Promotional Discount Wheel
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12.5px', marginBottom: '24px' }}>
              Spin to unlock special customer savings
            </p>

            <div style={{ position: 'relative', width: '220px', height: '220px', margin: '0 auto 24px' }}>
              <div
                style={{
                  position: 'absolute',
                  top: '-14px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '0',
                  height: '0',
                  borderLeft: '12px solid transparent',
                  borderRight: '12px solid transparent',
                  borderTop: '20px solid var(--primary)',
                  zIndex: 10
                }}
              />
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  border: '6px solid var(--border)',
                  transition: 'transform 4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                  transform: `rotate(${wheelRotation}deg)`,
                  background:
                    'conic-gradient(' +
                    (localStorage.getItem('discountRates') || '0,5,10,15,20,25')
                      .split(',')
                      .map(
                        (r, i, arr) =>
                          `hsl(${i * (360 / arr.length) + 15}, 80%, 55%) ${i * (360 / arr.length)}deg ${(i + 1) * (360 / arr.length)}deg`
                      )
                      .join(', ') +
                    ')'
                }}
              >
                {(localStorage.getItem('discountRates') || '0,5,10,15,20,25')
                  .split(',')
                  .map((r, i, arr) => (
                    <div
                      key={i}
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        width: '50%',
                        transformOrigin: '0% 50%',
                        transform: `translateY(-50%) rotate(${i * (360 / arr.length) + 180 / arr.length}deg)`,
                        textAlign: 'right',
                        paddingRight: '16px',
                        color: 'white',
                        fontWeight: 900,
                        fontSize: '15px',
                        textShadow: '1px 1px 2px rgba(0,0,0,0.6)'
                      }}
                    >
                      {r}%
                    </div>
                  ))}
              </div>
            </div>

            <button
              type="button"
              onClick={spinWheel}
              disabled={spinning}
              className="btn btn-primary"
              style={{ width: '100%', height: '48px', fontSize: '15px' }}
            >
              {spinning ? 'Spinning...' : 'SPIN REWARD WHEEL'}
            </button>
          </div>
        </div>
      )}

      {/* Printable Receipt Modal */}
      {lastBill && (
        <div className="modal-backdrop" onClick={finishCheckout}>
          <div
            className="modal-container page-transition"
            style={{ maxWidth: '440px', maxHeight: '92vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="modal-close-btn"
              onClick={finishCheckout}
              aria-label="Close receipt"
            >
              <XIcon size={18} />
            </button>

            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <div
                style={{
                  width: '52px',
                  height: '52px',
                  background: 'var(--success-subtle)',
                  color: 'var(--success)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px'
                }}
              >
                <CheckCircle2Icon size={28} />
              </div>
              <h3 style={{ fontSize: '19px', fontWeight: 800 }}>Payment Complete!</h3>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '4px' }}>
                <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                  Invoice: #{lastBill.invoiceNumber}
                </span>
                <span style={{ background: 'var(--primary)', color: '#ffffff', fontSize: '11px', fontWeight: 800, padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>
                  Token #{lastBill.tokenNumber}
                </span>
                <CopyButton text={lastBill.invoiceNumber} size={13} />
              </div>
            </div>

            {/* Slip View Switcher: Customer Bill vs Food Counter Token */}
            <div style={{ display: 'flex', background: 'var(--card-subtle)', border: '1px solid var(--border)', borderRadius: 'var(--radius-full)', padding: '3px', marginBottom: '16px', gap: '4px' }}>
              <button
                type="button"
                onClick={() => setModalSlipView('bill')}
                style={{
                  flex: 1,
                  padding: '7px 12px',
                  fontSize: '12px',
                  fontWeight: 700,
                  borderRadius: 'var(--radius-full)',
                  border: 'none',
                  cursor: 'pointer',
                  background: modalSlipView === 'bill' ? 'var(--primary)' : 'transparent',
                  color: modalSlipView === 'bill' ? '#ffffff' : 'var(--text-dim)',
                  transition: 'all 0.15s ease'
                }}
              >
                📄 Customer Bill
              </button>
              <button
                type="button"
                onClick={() => setModalSlipView('token')}
                style={{
                  flex: 1,
                  padding: '7px 12px',
                  fontSize: '12px',
                  fontWeight: 700,
                  borderRadius: 'var(--radius-full)',
                  border: 'none',
                  cursor: 'pointer',
                  background: modalSlipView === 'token' ? 'var(--primary)' : 'transparent',
                  color: modalSlipView === 'token' ? '#ffffff' : 'var(--text-dim)',
                  transition: 'all 0.15s ease'
                }}
              >
                🎫 Counter Token (#{lastBill.tokenNumber})
              </button>
            </div>

            {/* Printable Thermal Receipt Slip Container */}
            <div
              ref={receiptRef}
              className="printable-receipt"
              style={{
                background: '#ffffff',
                color: '#1a1a1a',
                padding: '20px',
                borderRadius: 'var(--radius-sm)',
                marginBottom: '20px',
                border: '1px solid #e5e5e5',
                fontSize: '12px',
                fontFamily: 'var(--font-mono)'
              }}
            >
              {modalSlipView === 'bill' ? (
                <>
                  <div style={{ textAlign: 'center', marginBottom: '14px' }}>
                    {lastBill.logoUrl && (
                      <img
                        src={lastBill.logoUrl}
                        alt="Logo"
                        style={{ maxHeight: '48px', maxWidth: '160px', margin: '0 auto 8px', display: 'block', objectFit: 'contain' }}
                      />
                    )}
                    <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#000000' }}>
                      {lastBill.business.business_name || 'SIMPLEBILL PRO'}
                    </h4>
                    {lastBill.business.location && (
                      <div style={{ color: '#555', marginTop: '2px', fontSize: '11px' }}>
                        {lastBill.business.location}
                      </div>
                    )}
                    {lastBill.business.phone && (
                      <div style={{ color: '#555', fontSize: '11px' }}>Tel: {lastBill.business.phone}</div>
                    )}
                    {lastBill.business.gst_number && (
                      <div style={{ color: '#555', fontSize: '11px' }}>GST: {lastBill.business.gst_number}</div>
                    )}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      borderTop: '1px dashed #bbb',
                      borderBottom: '1px dashed #bbb',
                      padding: '6px 0',
                      marginBottom: '12px',
                      fontSize: '11px'
                    }}
                  >
                    <div>
                      <div>Inv: #{lastBill.invoiceNumber}</div>
                      <div>Date: {new Date().toLocaleDateString('en-IN')}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div>Mode: {lastBill.paymentMode.toUpperCase()}</div>
                      <div>Time: {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                  </div>

                  <table style={{ width: '100%', marginBottom: '12px', borderCollapse: 'collapse', fontSize: '11.5px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #eee' }}>
                        <th style={{ textAlign: 'left', paddingBottom: '4px' }}>Item</th>
                        <th style={{ textAlign: 'center', paddingBottom: '4px' }}>Qty</th>
                        <th style={{ textAlign: 'right', paddingBottom: '4px' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lastBill.billItems.map((item, idx) => (
                        <tr key={idx}>
                          <td style={{ padding: '4px 0' }}>{item.name}</td>
                          <td style={{ textAlign: 'center', padding: '4px 0' }}>{item.qty}</td>
                          <td style={{ textAlign: 'right', padding: '4px 0' }}>
                            ₹{(item.price * item.qty).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div style={{ borderTop: '1px dashed #bbb', paddingTop: '8px', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span>Subtotal</span>
                      <span>₹{lastBill.subtotal.toFixed(2)}</span>
                    </div>
                    {lastBill.discount > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', color: '#b91c1c' }}>
                        <span>Discount</span>
                        <span>-₹{lastBill.discount.toFixed(2)}</span>
                      </div>
                    )}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontWeight: 800,
                        fontSize: '15px',
                        marginTop: '6px',
                        borderTop: '1px solid #eee',
                        paddingTop: '6px',
                        color: '#000000'
                      }}
                    >
                      <span>Total Amount</span>
                      <span>₹{lastBill.finalAmount.toFixed(2)}</span>
                    </div>
                  </div>

                  {lastBill.business.custom_message && (
                    <div style={{ textAlign: 'center', color: '#555', fontStyle: 'italic', borderTop: '1px dashed #bbb', paddingTop: '8px', fontSize: '10.5px' }}>
                      {lastBill.business.custom_message}
                    </div>
                  )}
                </>
              ) : (
                /* Food Counter Token View */
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontWeight: 800, fontSize: '13px', textTransform: 'uppercase', marginBottom: '2px' }}>
                    {lastBill.business.business_name || 'FOOD COUNTER'}
                  </div>
                  <div style={{ fontSize: '10.5px', color: '#666', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    Food Counter Pickup Token
                  </div>
                  <div style={{ fontSize: '42px', fontWeight: 900, margin: '8px 0', letterSpacing: '-1px', color: '#000' }}>
                    #{lastBill.tokenNumber}
                  </div>
                  <div style={{ display: 'inline-block', border: '1.5px solid #000', padding: '2px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', marginBottom: '12px' }}>
                    {lastBill.orderType}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '6px 0', fontSize: '11px', marginBottom: '12px', textAlign: 'left' }}>
                    <div>
                      <div>Inv: #{lastBill.invoiceNumber}</div>
                      <div>Date: {new Date().toLocaleDateString('en-IN')}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div>Time: {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
                      <div>Total Items: {lastBill.billItems.reduce((acc, i) => acc + i.qty, 0)}</div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'left', marginBottom: '12px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', borderBottom: '1px solid #000', paddingBottom: '4px', marginBottom: '6px' }}>
                      Items to Handover:
                    </div>
                    {lastBill.billItems.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0', borderBottom: '1px dotted #ccc', fontSize: '13px' }}>
                        <span style={{ width: '13px', height: '13px', border: '1.5px solid #000', borderRadius: '2px', display: 'inline-block', flexShrink: 0 }}></span>
                        <strong style={{ fontSize: '14px', minWidth: '24px' }}>{item.qty}x</strong>
                        <span style={{ fontWeight: 700 }}>{item.name}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ borderTop: '2px dashed #000', paddingTop: '10px', fontSize: '11px', fontWeight: 700, color: '#333' }}>
                    Please show this token at counter for food collection
                  </div>
                </div>
              )}
            </div>

            {/* Receipt Modal Action Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* Primary 1-Click: Print Both */}
              <button
                type="button"
                onClick={() => {
                  const effectiveLogo =
                    lastBill.logoUrl ||
                    (lastBill.business?.logo_url) ||
                    localStorage.getItem('receiptLogo') ||
                    '';

                  printBothReceiptAndToken(
                    {
                      invoiceNumber: lastBill.invoiceNumber,
                      items: lastBill.billItems,
                      total: lastBill.finalAmount,
                      paymentMode: lastBill.paymentMode,
                      business: lastBill.business,
                      subtotal: lastBill.subtotal,
                      discount: lastBill.discount,
                      logoUrl: effectiveLogo
                    },
                    {
                      tokenNumber: lastBill.tokenNumber,
                      invoiceNumber: lastBill.invoiceNumber,
                      items: lastBill.billItems,
                      orderType: lastBill.orderType,
                      business: lastBill.business,
                      logoUrl: effectiveLogo
                    }
                  );
                  toast.success('Dispatched Customer Bill & Food Token');
                }}
                className="btn btn-primary"
                style={{ height: '44px', fontWeight: 800, fontSize: '13.5px', justifyContent: 'center' }}
                title="Print Customer Receipt and Counter Token in a single thermal ticket"
              >
                <PrinterIcon size={16} />
                <span>⚡ Print Both (Bill + Token)</span>
              </button>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => {
                    const effectiveLogo =
                      lastBill.logoUrl ||
                      (lastBill.business?.logo_url) ||
                      localStorage.getItem('receiptLogo') ||
                      '';

                    printFormattedReceipt({
                      invoiceNumber: lastBill.invoiceNumber,
                      items: lastBill.billItems,
                      total: lastBill.finalAmount,
                      paymentMode: lastBill.paymentMode,
                      business: lastBill.business,
                      subtotal: lastBill.subtotal,
                      discount: lastBill.discount,
                      logoUrl: effectiveLogo
                    });
                  }}
                  className="btn btn-secondary"
                  title="Print Customer Bill Only"
                >
                  <PrinterIcon size={14} />
                  <span>Print Bill</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const effectiveLogo =
                      lastBill.logoUrl ||
                      (lastBill.business?.logo_url) ||
                      localStorage.getItem('receiptLogo') ||
                      '';

                    printOrderToken({
                      tokenNumber: lastBill.tokenNumber,
                      invoiceNumber: lastBill.invoiceNumber,
                      items: lastBill.billItems,
                      orderType: lastBill.orderType,
                      business: lastBill.business,
                      logoUrl: effectiveLogo
                    });
                  }}
                  className="btn btn-secondary"
                  title="Print Counter Token Slip"
                >
                  <span>🎫 Print Token</span>
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button
                  type="button"
                  onClick={async () => {
                    if (!receiptRef.current) return;
                    try {
                      const canvas = await html2canvas(receiptRef.current, { scale: 2, useCORS: true });
                      canvas.toBlob(async (blob) => {
                        if (!blob) return;
                        const file = new File([blob], `${modalSlipView === 'token' ? 'token' : 'receipt'}_${lastBill.invoiceNumber}.png`, { type: 'image/png' });
                        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                          await navigator.share({
                            title: modalSlipView === 'token' ? 'Order Token' : 'Receipt',
                            text: modalSlipView === 'token' ? `Token #${lastBill.tokenNumber}` : `Receipt for invoice #${lastBill.invoiceNumber}`,
                            files: [file]
                          });
                        } else {
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = file.name;
                          a.click();
                          URL.revokeObjectURL(url);
                          toast.success('Image downloaded');
                        }
                      }, 'image/png');
                    } catch (err) {
                      toast.error('Share failed: ' + err.message);
                    }
                  }}
                  className="btn btn-secondary"
                >
                  <Share2Icon size={14} />
                  <span>Share {modalSlipView === 'token' ? 'Token' : 'Bill'} PNG</span>
                </button>

                <button
                  type="button"
                  onClick={finishCheckout}
                  className="btn btn-secondary"
                >
                  <span>Done (Next Sale)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media (min-width: 1024px) {
          .pos-layout-v2 { display: grid; grid-template-columns: 1fr 360px; gap: 28px; }
          .desktop-cart { display: block !important; }
        }
      `}</style>
    </div>
  );
}
