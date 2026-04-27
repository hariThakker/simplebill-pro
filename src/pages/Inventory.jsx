import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', price: '', stock: '' });
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    fetchInventory();
    window.addEventListener('groupChanged', fetchInventory);
    return () => window.removeEventListener('groupChanged', fetchInventory);
  }, []);

  async function fetchInventory() {
    const groupId = localStorage.getItem('selectedGroupId');
    if (!groupId) return;
    setLoading(true);
    const { data } = await supabase.from('inventory').select('*').eq('group_id', groupId).order('created_at', { ascending: false });
    setItems(data || []);
    setLoading(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const groupId = localStorage.getItem('selectedGroupId');
    if (!groupId) { alert('Select a group first'); return; }

    let error;
    if (editingId) {
      const { error: err } = await supabase.from('inventory').update({
        name: formData.name, price: Number(formData.price), stock: Number(formData.stock)
      }).eq('id', editingId);
      error = err;
    } else {
      const { error: err } = await supabase.from('inventory').insert([{
        group_id: groupId, ...formData, price: Number(formData.price), stock: Number(formData.stock)
      }]);
      error = err;
    }

    if (!error) {
      setFormData({ name: '', price: '', stock: '' });
      setEditingId(null);
      setShowForm(false);
      fetchInventory();
    } else {
      alert("Error saving item: " + error.message);
    }
  }

  async function handleDeleteItem(id) {
    if (!confirm('Are you sure you want to delete this item?')) return;
    const { error } = await supabase.from('inventory').delete().eq('id', id);
    if (!error) fetchInventory();
    else alert('Error deleting item: ' + error.message);
  }

  function handleEditItem(item) {
    setFormData({ name: item.name, price: item.price, stock: item.stock });
    setEditingId(item.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div className="page-transition">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '28px', fontWeight: 900 }}>Inventory</h2>
          <p style={{ color: 'var(--text-dim)' }}>Manage your cloud products</p>
        </div>
        <button onClick={() => {
          if (showForm) { setEditingId(null); setFormData({ name: '', price: '', stock: '' }); }
          setShowForm(!showForm);
        }} className={`btn ${showForm ? 'btn-ghost' : 'btn-primary'}`} style={{ borderRadius: '14px' }}>
          {showForm ? 'Cancel' : '+ Add Item'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card" style={{ marginBottom: '32px', animation: 'slideIn 0.3s ease' }}>
          <h3 style={{ marginBottom: '20px', fontSize: '18px' }}>Product Details</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-dim)', marginBottom: '6px', display: 'block' }}>PRODUCT NAME</label>
              <input required className="input-v2" placeholder="e.g. Filter Coffee" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-dim)', marginBottom: '6px', display: 'block' }}>PRICE (₹)</label>
                <input required type="number" className="input-v2" placeholder="0.00" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-dim)', marginBottom: '6px', display: 'block' }}>INITIAL STOCK</label>
                <input required type="number" className="input-v2" placeholder="0" value={formData.stock} onChange={e => setFormData({...formData, stock: e.target.value})} />
              </div>
            </div>
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '24px', height: '52px', borderRadius: '12px' }}>{editingId ? 'Update Item' : 'Save to Cloud'}</button>
        </form>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-dim)' }}>Loading Stock...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
          {items.map(item => (
            <div key={item.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '44px', height: '44px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>📦</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '16px' }}>{item.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-dim)', fontWeight: 600 }}>STOCK: {item.stock} units</div>
                </div>
              </div>
              <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                <div style={{ fontWeight: 800, color: 'var(--accent)', fontSize: '20px' }}>₹{item.price}</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => handleEditItem(item)} className="btn btn-ghost" style={{ fontSize: '12px', padding: '4px 8px' }}>Edit</button>
                  <button onClick={() => handleDeleteItem(item.id)} className="btn btn-ghost" style={{ fontSize: '12px', padding: '4px 8px', color: 'var(--danger)' }}>Delete</button>
                </div>
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 20px', background: 'rgba(0,0,0,0.02)', borderRadius: '24px', border: '2px dashed var(--border)' }}>
              <div style={{ fontSize: '40px', marginBottom: '16px' }}>📭</div>
              <p style={{ fontWeight: 700, color: 'var(--text-dim)' }}>No items found in this group.</p>
              <p style={{ fontSize: '13px', color: 'var(--text-light)' }}>Start by adding your first product above.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
