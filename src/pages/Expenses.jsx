import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';
import {
  ExpensesIcon,
  PlusIcon,
  Trash2Icon,
  ClockIcon,
  RefreshCwIcon,
  BanknoteIcon,
  XIcon,
  AlertTriangleIcon
} from '../components/Icons';
import ConfirmModal from '../components/ConfirmModal';
import { SkeletonList } from '../components/Skeleton';
import { useToast } from '../components/Toast';

export default function Expenses() {
  const toast = useToast();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ description: '', amount: '', category: 'General' });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Delete modal state
  const [expenseToDelete, setExpenseToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const categories = ['General', 'Inventory Stock', 'Utilities & Bills', 'Packaging & Supplies', 'Staff & Meals', 'Rent & Store Maintenance'];

  const fetchExpenses = useCallback(async () => {
    const groupId = localStorage.getItem('selectedGroupId');
    if (!groupId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load expenses: ' + error.message);
    } else {
      setExpenses(data || []);
      setLastUpdated(new Date());
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchExpenses();
    window.addEventListener('groupChanged', fetchExpenses);
    return () => window.removeEventListener('groupChanged', fetchExpenses);
  }, [fetchExpenses]);

  const validate = () => {
    const errors = {};
    if (!formData.description.trim()) errors.description = 'Description is required';
    if (!formData.amount || Number(formData.amount) <= 0) errors.amount = 'Amount must be greater than 0';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;

    const groupId = localStorage.getItem('selectedGroupId');
    if (!groupId) {
      toast.warning('Please select a store branch first');
      return;
    }

    setSubmitting(true);
    try {
      const descFormatted = formData.category && formData.category !== 'General'
        ? `[${formData.category}] ${formData.description.trim()}`
        : formData.description.trim();

      const { error } = await supabase.from('expenses').insert([
        {
          group_id: groupId,
          description: descFormatted,
          amount: Number(formData.amount)
        }
      ]);

      if (error) throw error;

      toast.success(`Expense of ₹${Number(formData.amount).toLocaleString()} logged`);
      setFormData({ description: '', amount: '', category: 'General' });
      setShowForm(false);
      fetchExpenses();
      window.dispatchEvent(new Event('groupChanged'));
    } catch (err) {
      toast.error('Failed to save expense: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const handleConfirmDelete = async () => {
    if (!expenseToDelete) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('expenses').delete().eq('id', expenseToDelete.id);
      if (error) throw error;
      setExpenses(expenses.filter((e) => e.id !== expenseToDelete.id));
      toast.success('Expense record deleted');
      setExpenseToDelete(null);
      window.dispatchEvent(new Event('groupChanged'));
    } catch (err) {
      toast.error('Failed to delete expense: ' + err.message);
    } finally {
      setDeleting(false);
    }
  };

  // Calculate today's and all-time total expenses
  const todayYMD = new Date().toDateString();
  const todayTotal = expenses.reduce((sum, item) => {
    const itemDate = new Date(item.created_at).toDateString();
    return itemDate === todayYMD ? sum + Number(item.amount) : sum;
  }, 0);

  const grandTotal = expenses.reduce((sum, item) => sum + Number(item.amount), 0);

  return (
    <div className="page-transition">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '26px', fontWeight: 800 }}>Expense Tracking</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px' }}>
            Record operational overheads, vendor purchases, and petty cash
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
            onClick={fetchExpenses}
            disabled={loading}
            className="btn btn-ghost btn-sm"
            title="Refresh logs"
          >
            <RefreshCwIcon size={14} />
          </button>
          <button
            type="button"
            onClick={() => {
              setShowForm(!showForm);
              setFormErrors({});
            }}
            className={`btn ${showForm ? 'btn-secondary' : 'btn-primary'}`}
          >
            {showForm ? <XIcon size={16} /> : <PlusIcon size={16} />}
            <span>{showForm ? 'Cancel' : 'Log Expense'}</span>
          </button>
        </div>
      </div>

      {/* Expense Summary Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="card" style={{ padding: '20px', borderLeft: '4px solid var(--danger)' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-dim)' }}>
            Today's Outflow
          </span>
          <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--danger)', marginTop: '4px', fontVariantNumeric: 'tabular-nums' }}>
            ₹{todayTotal.toLocaleString()}
          </div>
        </div>

        <div className="card" style={{ padding: '20px', borderLeft: '4px solid var(--primary)' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-dim)' }}>
            Total Recorded Outflow
          </span>
          <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text)', marginTop: '4px', fontVariantNumeric: 'tabular-nums' }}>
            ₹{grandTotal.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Add Expense Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="card page-transition" style={{ marginBottom: '28px', borderLeft: '4px solid var(--primary)' }}>
          <h3 style={{ fontSize: '17px', fontWeight: 800, marginBottom: '20px' }}>
            Record New Store Expense
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Category</label>
                <select
                  className="input-v2"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Amount (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className={`input-v2 ${formErrors.amount ? 'error' : ''}`}
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) => {
                    setFormData({ ...formData, amount: e.target.value });
                    if (formErrors.amount) setFormErrors({ ...formErrors, amount: null });
                  }}
                />
                {formErrors.amount && (
                  <div className="form-error-msg">
                    <AlertTriangleIcon size={13} /> {formErrors.amount}
                  </div>
                )}
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Description / Remarks</label>
              <input
                type="text"
                className={`input-v2 ${formErrors.description ? 'error' : ''}`}
                placeholder="e.g. Milk & Coffee Bean Restock Invoice #441"
                value={formData.description}
                onChange={(e) => {
                  setFormData({ ...formData, description: e.target.value });
                  if (formErrors.description) setFormErrors({ ...formErrors, description: null });
                }}
              />
              {formErrors.description && (
                <div className="form-error-msg">
                  <AlertTriangleIcon size={13} /> {formErrors.description}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="btn btn-primary"
              >
                {submitting ? 'Recording...' : 'Record Expense'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Expenses List */}
      {loading ? (
        <SkeletonList count={4} />
      ) : expenses.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px', border: '2px dashed var(--border)' }}>
          <BanknoteIcon size={40} style={{ color: 'var(--text-dim)', margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '4px' }}>
            No expenses recorded yet
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-dim)', marginBottom: '16px' }}>
            Log store overheads to keep track of true net profit.
          </p>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="btn btn-primary"
          >
            <PlusIcon size={16} />
            <span>Record First Expense</span>
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {expenses.map((exp) => (
            <div
              key={exp.id}
              className="card"
              style={{
                padding: '16px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--danger-subtle)',
                    color: 'var(--danger)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <ExpensesIcon size={18} />
                </div>

                <div>
                  <h4 style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--text)' }}>
                    {exp.description}
                  </h4>
                  <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '2px' }}>
                    {new Date(exp.created_at).toLocaleString([], {
                      dateStyle: 'medium',
                      timeStyle: 'short'
                    })}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ fontSize: '17px', fontWeight: 800, color: 'var(--danger)', fontVariantNumeric: 'tabular-nums' }}>
                  ₹{Number(exp.amount).toLocaleString()}
                </div>

                <button
                  type="button"
                  onClick={() => setExpenseToDelete(exp)}
                  className="btn btn-danger btn-icon"
                  style={{ width: '32px', height: '32px', background: 'var(--danger-subtle)', color: 'var(--danger)', borderColor: 'var(--danger-border)' }}
                  title="Delete expense"
                  aria-label={`Delete expense ${exp.description}`}
                >
                  <Trash2Icon size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirmation Modal for Deleting Expense */}
      <ConfirmModal
        isOpen={!!expenseToDelete}
        title="Delete Expense Record?"
        message={`Are you sure you want to permanently delete the expense of ₹${expenseToDelete?.amount} (${expenseToDelete?.description})?`}
        confirmText="Yes, Delete Record"
        cancelText="Cancel"
        isDestructive={true}
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setExpenseToDelete(null)}
      />
    </div>
  );
}
