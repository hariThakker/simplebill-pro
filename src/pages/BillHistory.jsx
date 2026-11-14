import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';
import { printFormattedReceipt } from '../utils/printer';
import {
  HistoryIcon,
  SearchIcon,
  DownloadIcon,
  RefreshCwIcon,
  PrinterIcon,
  Trash2Icon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClockIcon,
  CreditCardIcon,
  BanknoteIcon,
  XIcon
} from '../components/Icons';
import CopyButton from '../components/CopyButton';
import ConfirmModal from '../components/ConfirmModal';
import { SkeletonList, SkeletonCard } from '../components/Skeleton';
import { useToast } from '../components/Toast';

export default function BillHistory() {
  const toast = useToast();
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedBill, setExpandedBill] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('all'); // 'all', 'cash', 'online'
  const [lastUpdated, setLastUpdated] = useState(null);

  // Confirm delete modal state
  const [billToDelete, setBillToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchHistory = useCallback(async () => {
    const groupId = localStorage.getItem('selectedGroupId');
    if (!groupId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('bills')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load logs: ' + error.message);
    } else {
      setBills(data || []);
      setLastUpdated(new Date());
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchHistory();
    window.addEventListener('groupChanged', fetchHistory);
    return () => window.removeEventListener('groupChanged', fetchHistory);
  }, [fetchHistory]);

  const exportCSV = () => {
    if (bills.length === 0) {
      toast.warning('No records available to export');
      return;
    }

    const headers = ['Date', 'Time', 'Invoice Number', 'Payment Mode', 'Total Amount (INR)', 'Items'];
    const rows = bills.map((b) => {
      const d = new Date(b.created_at);
      const itemsStr = b.items?.map((i) => `${i.name} (x${i.qty})`).join('; ') || '';
      return [
        d.toLocaleDateString(),
        d.toLocaleTimeString(),
        b.invoice_number,
        b.payment_mode.toUpperCase(),
        b.total_amount,
        `"${itemsStr}"`
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `sales_report_${new Date().toLocaleDateString().replace(/\//g, '-')}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Sales report exported as CSV');
  };

  const handleConfirmDelete = async () => {
    if (!billToDelete) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('bills').delete().eq('id', billToDelete.id);
      if (error) throw error;
      setBills(bills.filter((b) => b.id !== billToDelete.id));
      toast.success(`Invoice #${billToDelete.invoice_number} voided`);
      setBillToDelete(null);
    } catch (err) {
      toast.error('Could not void bill: ' + err.message);
    } finally {
      setDeleting(false);
    }
  };

  // Filter bills
  const filteredBills = bills.filter((b) => {
    const matchesSearch =
      b.invoice_number?.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
      b.items?.some((item) => item.name?.toLowerCase().includes(searchQuery.toLowerCase().trim()));
    const matchesMode = filterMode === 'all' || b.payment_mode === filterMode;
    return matchesSearch && matchesMode;
  });

  const totalFilteredSales = filteredBills.reduce((acc, b) => acc + Number(b.total_amount || 0), 0);

  return (
    <div className="page-transition">
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '26px', fontWeight: 800 }}>Sales Logs</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px' }}>
            Historical audit log of generated invoices
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {lastUpdated && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--text-dim)', background: 'var(--card-subtle)', padding: '5px 10px', borderRadius: 'var(--radius-full)', border: '1px solid var(--border)' }}>
              <ClockIcon size={12} />
              <span>Synced {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          )}
          <button
            type="button"
            onClick={exportCSV}
            className="btn btn-secondary btn-sm"
            title="Download CSV report"
          >
            <DownloadIcon size={14} />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={fetchHistory}
            disabled={loading}
            className="btn btn-ghost btn-sm"
            title="Refresh logs"
          >
            <RefreshCwIcon size={14} />
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
            <SearchIcon size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
            <input
              type="text"
              placeholder="Search by invoice # or product..."
              className="input-v2"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '34px', height: '38px', fontSize: '13px' }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}
              >
                <XIcon size={14} />
              </button>
            )}
          </div>

          {/* Mode Pill Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>Mode:</span>
            {['all', 'cash', 'online'].map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setFilterMode(mode)}
                style={{
                  padding: '4px 12px',
                  borderRadius: 'var(--radius-full)',
                  border: '1px solid',
                  borderColor: filterMode === mode ? 'var(--primary)' : 'var(--border)',
                  background: filterMode === mode ? 'var(--primary-subtle)' : 'var(--card-subtle)',
                  color: filterMode === mode ? 'var(--primary)' : 'var(--text-secondary)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textTransform: 'capitalize'
                }}
              >
                {mode}
              </button>
            ))}
          </div>

          <div style={{ fontSize: '12.5px', color: 'var(--text-dim)', fontVariantNumeric: 'tabular-nums' }}>
            Showing <strong>{filteredBills.length}</strong> bills &bull; Total: <strong>₹{totalFilteredSales.toLocaleString()}</strong>
          </div>
        </div>
      </div>

      {/* Logs List */}
      {loading ? (
        <SkeletonList count={4} />
      ) : filteredBills.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px', border: '2px dashed var(--border)' }}>
          <HistoryIcon size={40} style={{ color: 'var(--text-dim)', margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '4px' }}>
            {searchQuery || filterMode !== 'all' ? 'No matching sales records' : 'No sales logs recorded yet'}
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-dim)' }}>
            {searchQuery || filterMode !== 'all'
              ? 'Try resetting the filter or search query.'
              : 'Invoices created in POS will automatically appear here.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {filteredBills.map((bill) => {
            const isExpanded = expandedBill === bill.id;
            const isCash = bill.payment_mode === 'cash';

            return (
              <div
                key={bill.id}
                className="card"
                style={{
                  padding: '18px 20px',
                  borderColor: isExpanded ? 'var(--primary-border)' : 'var(--border)'
                }}
              >
                <div
                  style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}
                  onClick={() => setExpandedBill(isExpanded ? null : bill.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--card-subtle)',
                        border: '1px solid var(--border)',
                        color: 'var(--primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <HistoryIcon size={20} />
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 800, fontSize: '15px', color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>
                          #{bill.invoice_number}
                        </span>
                        <CopyButton text={bill.invoice_number} size={12} />
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '2px' }}>
                        {new Date(bill.created_at).toLocaleString([], {
                          dateStyle: 'medium',
                          timeStyle: 'short'
                        })}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, fontSize: '18px', color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                        ₹{Number(bill.total_amount).toLocaleString()}
                      </div>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '10.5px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-full)',
                          textTransform: 'uppercase',
                          background: isCash ? 'var(--success-subtle)' : 'var(--primary-subtle)',
                          color: isCash ? 'var(--success)' : 'var(--primary)'
                        }}
                      >
                        {isCash ? <BanknoteIcon size={11} /> : <CreditCardIcon size={11} />}
                        {bill.payment_mode}
                      </span>
                    </div>

                    <div style={{ color: 'var(--text-dim)' }}>
                      {isExpanded ? <ChevronDownIcon size={18} /> : <ChevronRightIcon size={18} />}
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid var(--border)', marginTop: '14px', paddingTop: '14px', animation: 'fadeIn 0.25s ease' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-dim)' }}>
                        Items Purchased ({bill.items?.length || 0})
                      </span>
                      <button
                        type="button"
                        onClick={async () => {
                          const gid = localStorage.getItem('selectedGroupId');
                          const { data: business } = await supabase.from('settings').select('*').eq('group_id', gid).maybeSingle();
                          const localLogo = (gid ? localStorage.getItem(`receiptLogo_${gid}`) : null) || localStorage.getItem('receiptLogo') || '';
                          const logo = business?.logo_url || localLogo || '';

                          printFormattedReceipt({
                            invoiceNumber: bill.invoice_number || bill.id?.slice(0, 8),
                            items: bill.items || [],
                            total: Number(bill.total_amount),
                            paymentMode: bill.payment_mode || 'cash',
                            business: business || {},
                            date: bill.created_at,
                            logoUrl: logo
                          });
                        }}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '4px 10px', fontSize: '11px' }}
                      >
                        <PrinterIcon size={12} />
                        <span>Print Receipt</span>
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
                      {bill.items?.map((item, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: 'var(--card-subtle)',
                            padding: '8px 12px',
                            borderRadius: 'var(--radius-xs)',
                            fontSize: '13px'
                          }}
                        >
                          <div>
                            <span style={{ fontWeight: 600, color: 'var(--text)' }}>{item.name}</span>
                            <span style={{ color: 'var(--text-dim)', fontSize: '11.5px', marginLeft: '8px' }}>
                              {item.qty} &times; ₹{item.price}
                            </span>
                          </div>
                          <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                            ₹{item.qty * item.price}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
                      <button
                        type="button"
                        onClick={() => setBillToDelete(bill)}
                        className="btn btn-danger btn-sm"
                        style={{ background: 'var(--danger-subtle)', color: 'var(--danger)', border: '1px solid var(--danger-border)' }}
                      >
                        <Trash2Icon size={13} />
                        <span>Void Invoice</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation Modal for Voiding Bill */}
      <ConfirmModal
        isOpen={!!billToDelete}
        title="Void this Invoice?"
        message={`Are you sure you want to permanently void invoice #${billToDelete?.invoice_number}? This transaction log will be deleted.`}
        confirmText="Yes, Void Invoice"
        cancelText="Cancel"
        isDestructive={true}
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setBillToDelete(null)}
      />
    </div>
  );
}
