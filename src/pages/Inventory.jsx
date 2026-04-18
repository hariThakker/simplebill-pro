import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', price: '', stock: '', tax_rate: '' });

  useEffect(() => {
    fetchInventory();
    window.addEventListener('groupChanged', fetchInventory);
    return () => window.removeEventListener('groupChanged', fetchInventory);
  }, []);

  async function fetchInventory() {
    const groupId = localStorage.getItem('selectedGroupId');
    if (!groupId) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });
    if (error) console.error("Error fetching inventory:", error);
    else setItems(data || []);
    setLoading(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const groupId = localStorage.getItem('selectedGroupId');
    if (!groupId) { alert('Please select/create a group first'); return; }

    const { error } = await supabase.from('inventory').insert([{
      group_id: groupId,
      name: formData.name,
      price: Number(formData.price),
      stock: Number(formData.stock),
      tax_rate: Number(formData.tax_rate) || 0
    }]);

    if (error) {
      alert("Error saving item: " + error.message + " | Details: " + error.details);
      console.error(error);
      return;
    }
    
    setShowModal(false);
    setFormData({ name: '', price: '', stock: '', tax_rate: '' });
    fetchInventory();
  }

  async function deleteItem(id) {
    if (!confirm('Delete this product?')) return;
    await supabase.from('inventory').delete().eq('id', id);
    fetchInventory();
  }

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h2>Inventory Management</h2>
        <button onClick={() => setShowModal(true)}>+ Add Product</button>
      </div>

      {loading ? <p>Loading...</p> : (
        <div style={{ display: 'grid', gap: '10px' }}>
          {items.length === 0 ? <p style={{ color: '#64748b' }}>No products found in cloud.</p> : null}
          {items.map(item => (
            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', background: 'white', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div>
                <strong style={{ display: 'block', marginBottom: '5px' }}>{item.name}</strong>
                <span style={{ fontSize: '13px', color: '#64748b', marginRight: '15px' }}>Price: ₹{item.price}</span>
                <span style={{ fontSize: '13px', color: item.stock < 10 ? '#ef4444' : '#10b981' }}>Stock: {item.stock}</span>
              </div>
              <button 
                onClick={() => deleteItem(item.id)} 
                style={{ background: '#ef4444', padding: '5px 10px', fontSize: '12px' }}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', padding: '30px', borderRadius: '12px', width: '400px' }}>
            <h3 style={{ marginBottom: '20px' }}>Add New Product</h3>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold' }}>Name</label>
                <input required style={{ width: '100%', padding: '10px' }} value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold' }}>Price</label>
                  <input required type="number" style={{ width: '100%', padding: '10px' }} value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold' }}>Stock</label>
                  <input required type="number" style={{ width: '100%', padding: '10px' }} value={formData.stock} onChange={e => setFormData({...formData, stock: e.target.value})} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button type="submit" style={{ flex: 1 }}>Save</button>
                <button type="button" style={{ flex: 1, background: '#64748b' }} onClick={() => setShowModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
