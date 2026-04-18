import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', price: '', stock: '' });

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

    const { error } = await supabase.from('inventory').insert([{
      group_id: groupId, ...formData, price: Number(formData.price), stock: Number(formData.stock)
    }]);

    if (!error) {
      setFormData({ name: '', price: '', stock: '' });
      setShowForm(false);
      fetchInventory();
    }
  }

  return (
    <div className="page-transition">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 800 }}>Inventory</h2>
          <p style={{ color: 'var(--text-light)' }}>Manage your cloud products</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} style={{ padding: '10px 20px', background: 'var(--primary)', color: 'white' }}>
          {showForm ? 'Cancel' : '+ Add Item'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card" style={{ marginBottom: '24px', animation: 'fadeIn 0.3s ease' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
            <input required placeholder="Product Name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <input required type="number" placeholder="Price" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }} />
              <input required type="number" placeholder="Stock" value={formData.stock} onChange={e => setFormData({...formData, stock: e.target.value})} style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }} />
            </div>
          </div>
          <button type="submit" style={{ width: '100%', marginTop: '16px', padding: '14px', background: 'var(--primary)', color: 'white' }}>Save to Cloud</button>
        </form>
      )}

      {loading ? <p>Loading...</p> : (
        <div>
          {items.map(item => (
            <div key={item.id} className="item-card">
              <div>
                <div style={{ fontWeight: 700 }}>{item.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-light)' }}>Stock: {item.stock}</div>
              </div>
              <div style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '18px' }}>₹{item.price}</div>
            </div>
          ))}
          {items.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-light)', padding: '40px' }}>No items in this group.</p>}
        </div>
      )}
    </div>
  );
}
