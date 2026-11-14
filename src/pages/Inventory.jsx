import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';
import {
  PackageIcon,
  SearchIcon,
  PlusIcon,
  EditIcon,
  Trash2Icon,
  CheckCircle2Icon,
  AlertTriangleIcon,
  ClockIcon,
  RefreshCwIcon,
  XIcon
} from '../components/Icons';
import ConfirmModal from '../components/ConfirmModal';
import { SkeletonList } from '../components/Skeleton';
import { useToast } from '../components/Toast';

export default function Inventory() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', price: '', stock: '' });
  const [formErrors, setFormErrors] = useState({});
  const [formSuccess, setFormSuccess] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  // Delete modal state
  const [itemToDelete, setItemToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchInventory = useCallback(async () => {
    const groupId = localStorage.getItem('selectedGroupId');
    if (!groupId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load inventory: ' + error.message);
    } else {
      setItems(data || []);
      setLastUpdated(new Date());
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchInventory();
    window.addEventListener('groupChanged', fetchInventory);
    return () => window.removeEventListener('groupChanged', fetchInventory);
  }, [fetchInventory]);

  const validate = () => {
    const errors = {};
    if (!formData.name.trim()) errors.name = 'Product name is required';
    if (!formData.price || Number(formData.price) <= 0) errors.price = 'Price must be greater than 0';
    if (formData.stock === '' || Number(formData.stock) < 0) errors.stock = 'Stock must be 0 or more';
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
    setFormSuccess(null);

    try {
      if (editingId) {
        const { error } = await supabase
          .from('inventory')
          .update({
            name: formData.name.trim(),
            price: Number(formData.price),
            stock: Number(formData.stock)
          })
          .eq('id', editingId);

        if (error) throw error;
        toast.success(`Updated "${formData.name.trim()}"`);
      } else {
        const { error } = await supabase.from('inventory').insert([
          {
            group_id: groupId,
            name: formData.name.trim(),
            price: Number(formData.price),
            stock: Number(formData.stock)
          }
        ]);

        if (error) throw error;
        toast.success(`Added "${formData.name.trim()}" to stock`);
      }

      setFormData({ name: '', price: '', stock: '' });
      setEditingId(null);
      setShowForm(false);
      fetchInventory();
    } catch (err) {
      toast.error('Failed to save item: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('inventory').delete().eq('id', itemToDelete.id);
      if (error) throw error;
      setItems(items.filter((i) => i.id !== itemToDelete.id));
      toast.success(`Deleted "${itemToDelete.name}"`);
      setItemToDelete(null);
    } catch (err) {
      toast.error('Failed to delete item: ' + err.message);
    } finally {
      setDeleting(false);
    }
  };

  const handleEditItem = (item) => {
    setFormData({ name: item.name, price: item.price, stock: item.stock });
    setFormErrors({});
    setEditingId(item.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleQuickStock = async (item, delta) => {
    const newStock = Math.max(0, item.stock + delta);
    const { error } = await supabase.from('inventory').update({ stock: newStock }).eq('id', item.id);
    if (!error) {
      setItems(items.map((i) => (i.id === item.id ? { ...i, stock: newStock } : i)));
    }
  };

  // Filtered list
  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  return (
    <div className="page-transition">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '26px', fontWeight: 800 }}>Stock & Inventory</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px' }}>
            Manage products, pricing, and live catalog availability
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
            onClick={fetchInventory}
            disabled={loading}
            className="btn btn-ghost btn-sm"
            title="Refresh stock"
          >
            <RefreshCwIcon size={14} />
          </button>
          <button
            type="button"
            onClick={() => {
              if (showForm) {
                setEditingId(null);
                setFormData({ name: '', price: '', stock: '' });
                setFormErrors({});
              }
              setShowForm(!showForm);
            }}
            className={`btn ${showForm ? 'btn-secondary' : 'btn-primary'}`}
          >
            {showForm ? <XIcon size={16} /> : <PlusIcon size={16} />}
            <span>{showForm ? 'Cancel' : 'Add Product'}</span>
          </button>
        </div>
      </div>

      {/* Product Form with validation and feedback states */}
      {showForm && (
        <form onSubmit={handleSubmit} className="card page-transition" style={{ marginBottom: '28px', borderLeft: '4px solid var(--primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '17px', fontWeight: 800 }}>
              {editingId ? 'Edit Product Details' : 'Add New Product to Catalog'}
            </h3>
            <span style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
              {editingId ? 'Updating' : 'New Entry'}
            </span>
          </div>

          {formSuccess && (
            <div className="form-success-banner">
              <CheckCircle2Icon size={16} />
              <span>{formSuccess}</span>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Product Name</label>
              <input
                type="text"
                className={`input-v2 ${formErrors.name ? 'error' : ''}`}
                placeholder="e.g. Masala Chai (Large)"
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value });
                  if (formErrors.name) setFormErrors({ ...formErrors, name: null });
                }}
              />
              {formErrors.name && (
                <div className="form-error-msg">
                  <AlertTriangleIcon size={13} /> {formErrors.name}
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Price (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className={`input-v2 ${formErrors.price ? 'error' : ''}`}
                  placeholder="0.00"
                  value={formData.price}
                  onChange={(e) => {
                    setFormData({ ...formData, price: e.target.value });
                    if (formErrors.price) setFormErrors({ ...formErrors, price: null });
                  }}
                />
                {formErrors.price && (
                  <div className="form-error-msg">
                    <AlertTriangleIcon size={13} /> {formErrors.price}
                  </div>
                )}
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Initial Stock Quantity</label>
                <input
                  type="number"
                  min="0"
                  className={`input-v2 ${formErrors.stock ? 'error' : ''}`}
                  placeholder="0"
                  value={formData.stock}
                  onChange={(e) => {
                    setFormData({ ...formData, stock: e.target.value });
                    if (formErrors.stock) setFormErrors({ ...formErrors, stock: null });
                  }}
                />
                {formErrors.stock && (
                  <div className="form-error-msg">
                    <AlertTriangleIcon size={13} /> {formErrors.stock}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                }}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="btn btn-primary"
              >
                {submitting ? 'Saving...' : editingId ? 'Update Product' : 'Save Product'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Filter and Search Bar */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
            <SearchIcon size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
            <input
              type="text"
              placeholder="Search products in stock..."
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

          <div style={{ fontSize: '12.5px', color: 'var(--text-dim)', fontVariantNumeric: 'tabular-nums' }}>
            Total Catalog: <strong>{items.length}</strong> items &bull; Available: <strong>{filteredItems.length}</strong>
          </div>
        </div>
      </div>

      {/* Products Table / Cards */}
      {loading ? (
        <SkeletonList count={4} />
      ) : filteredItems.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px', border: '2px dashed var(--border)' }}>
          <PackageIcon size={40} style={{ color: 'var(--text-dim)', margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '4px' }}>
            {searchQuery ? `No items found matching "${searchQuery}"` : 'No products in inventory yet'}
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-dim)', marginBottom: '16px' }}>
            {searchQuery ? 'Try another keyword or clear the search.' : 'Add your first item using the button above.'}
          </p>
          {!searchQuery && (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="btn btn-primary"
            >
              <PlusIcon size={16} />
              <span>Add First Product</span>
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredItems.map((item) => {
            const isOutOfStock = item.stock <= 0;
            const isLowStock = item.stock > 0 && item.stock <= 5;

            return (
              <div
                key={item.id}
                className="card"
                style={{
                  padding: '16px 20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '14px',
                  borderLeft: isOutOfStock
                    ? '4px solid var(--danger)'
                    : isLowStock
                    ? '4px solid var(--warning)'
                    : '4px solid var(--border)'
                }}
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
                    <PackageIcon size={20} />
                  </div>

                  <div>
                    <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>
                      {item.name}
                    </h4>
                    <div style={{ fontSize: '13.5px', color: 'var(--primary)', fontWeight: 800, marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>
                      ₹{item.price}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  {/* Stock Stepper & Status Badge */}
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
                        onClick={() => handleQuickStock(item, -1)}
                        style={{ width: '26px', height: '26px', border: 'none', background: 'var(--card)', color: 'var(--text)', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        title="Reduce 1 unit"
                        aria-label={`Reduce stock of ${item.name}`}
                      >
                        -
                      </button>
                      <span style={{ width: '36px', textAlign: 'center', fontWeight: 800, fontSize: '13px', fontVariantNumeric: 'tabular-nums' }}>
                        {item.stock}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleQuickStock(item, 1)}
                        style={{ width: '26px', height: '26px', border: 'none', background: 'var(--card)', color: 'var(--text)', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        title="Add 1 unit"
                        aria-label={`Add stock of ${item.name}`}
                      >
                        +
                      </button>
                    </div>

                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '3px 10px',
                        borderRadius: 'var(--radius-full)',
                        textTransform: 'uppercase',
                        background: isOutOfStock
                          ? 'var(--danger-subtle)'
                          : isLowStock
                          ? 'var(--warning-subtle)'
                          : 'var(--success-subtle)',
                        color: isOutOfStock
                          ? 'var(--danger)'
                          : isLowStock
                          ? 'var(--warning)'
                          : 'var(--success)'
                      }}
                    >
                      {isOutOfStock ? 'Out of stock' : isLowStock ? 'Low stock' : 'In stock'}
                    </span>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => handleEditItem(item)}
                      className="btn btn-secondary btn-icon"
                      style={{ width: '34px', height: '34px' }}
                      title="Edit item"
                      aria-label={`Edit ${item.name}`}
                    >
                      <EditIcon size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setItemToDelete(item)}
                      className="btn btn-danger btn-icon"
                      style={{ width: '34px', height: '34px', background: 'var(--danger-subtle)', color: 'var(--danger)', borderColor: 'var(--danger-border)' }}
                      title="Delete item"
                      aria-label={`Delete ${item.name}`}
                    >
                      <Trash2Icon size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation Modal for Deleting Item */}
      <ConfirmModal
        isOpen={!!itemToDelete}
        title="Delete Inventory Item?"
        message={`Are you sure you want to permanently delete "${itemToDelete?.name}"? It will no longer appear in POS.`}
        confirmText="Yes, Delete Product"
        cancelText="Cancel"
        isDestructive={true}
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setItemToDelete(null)}
      />
    </div>
  );
}
