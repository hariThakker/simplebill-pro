import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export default function Settings() {
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [groups, setGroups] = useState([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [addingGroup, setAddingGroup] = useState(false);
  
  const [formData, setFormData] = useState({
    business_name: '',
    location: '',
    phone: '',
    gst_number: ''
  });

  useEffect(() => {
    fetchSettings();
    fetchGroups();
    window.addEventListener('groupChanged', fetchSettings);
    return () => window.removeEventListener('groupChanged', fetchSettings);
  }, []);

  async function fetchGroups() {
    const { data } = await supabase.from('groups').select('*').order('name');
    if (data) setGroups(data);
  }

  async function fetchSettings() {
    const groupId = localStorage.getItem('selectedGroupId');
    if (!groupId) return;

    const { data } = await supabase
      .from('settings')
      .select('*')
      .eq('group_id', groupId)
      .maybeSingle();

    if (data) {
      setFormData({
        business_name: data.business_name || '',
        location: data.location || '',
        phone: data.phone || '',
        gst_number: data.gst_number || ''
      });
    } else {
      setFormData({ business_name: '', location: '', phone: '', gst_number: '' });
    }
  }

  async function handleAddGroup(e) {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    setAddingGroup(true);
    
    const { data, error } = await supabase.from('groups').insert([{ name: newGroupName }]).select();
    
    setAddingGroup(false);
    if (!error) {
      setNewGroupName('');
      fetchGroups();
      window.dispatchEvent(new Event('groupsUpdated'));
      alert('Group added successfully!');
    } else {
      alert('Error adding group: ' + error.message);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    setLoading(true);
    const groupId = localStorage.getItem('selectedGroupId');

    // Check if settings exist for this group
    const { data: existing } = await supabase
      .from('settings')
      .select('id')
      .eq('group_id', groupId)
      .maybeSingle();

    let error;
    if (existing) {
      const { error: err } = await supabase
        .from('settings')
        .update(formData)
        .eq('group_id', groupId);
      error = err;
    } else {
      const { error: err } = await supabase
        .from('settings')
        .insert([{ ...formData, group_id: groupId }]);
      error = err;
    }

    setLoading(false);
    if (!error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } else {
      alert('Error saving settings: ' + error.message);
    }
  }

  return (
    <div className="page-transition" style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {/* Group Management Section */}
      <section>
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 900 }}>Groups & Branches</h2>
          <p style={{ color: 'var(--text-dim)' }}>Manage your business units and locations.</p>
        </div>

        <div className="card" style={{ padding: '24px' }}>
          <form onSubmit={handleAddGroup} style={{ display: 'flex', gap: '12px' }}>
            <input 
              required
              className="input-v2"
              placeholder="New Group Name (e.g. Branch B)"
              value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)}
            />
            <button type="submit" disabled={addingGroup} className="btn btn-primary" style={{ whiteSpace: 'nowrap', borderRadius: '12px' }}>
              {addingGroup ? 'Adding...' : 'Add Group'}
            </button>
          </form>

          <div style={{ marginTop: '20px' }}>
            <label style={{ display: 'block', fontWeight: 700, fontSize: '11px', color: 'var(--text-dim)', marginBottom: '12px', textTransform: 'uppercase' }}>Available Groups</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {groups.map(g => (
                <div key={g.id} style={{ background: '#f1f5f9', padding: '6px 14px', borderRadius: '10px', fontSize: '14px', fontWeight: 600 }}>
                  {g.name}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Business Details Section */}
      <section>
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 900 }}>Receipt Config</h2>
          <p style={{ color: 'var(--text-dim)' }}>Details for the currently selected group.</p>
        </div>

        <form onSubmit={handleSave} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 700, fontSize: '13px', color: 'var(--text-dim)', marginBottom: '8px' }}>COMPANY NAME *</label>
            <input 
              required
              className="input-v2"
              value={formData.business_name}
              onChange={e => setFormData({...formData, business_name: e.target.value})}
              placeholder="e.g. My Awesome Store"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 700, fontSize: '13px', color: 'var(--text-dim)', marginBottom: '8px' }}>LOCATION / ADDRESS</label>
            <input 
              className="input-v2"
              value={formData.location}
              onChange={e => setFormData({...formData, location: e.target.value})}
              placeholder="e.g. 123 Main St, Mumbai"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 700, fontSize: '13px', color: 'var(--text-dim)', marginBottom: '8px' }}>PHONE NUMBER</label>
              <input 
                className="input-v2"
                value={formData.phone}
                onChange={e => setFormData({...formData, phone: e.target.value})}
                placeholder="+91 98765 43210"
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 700, fontSize: '13px', color: 'var(--text-dim)', marginBottom: '8px' }}>GST NUMBER</label>
              <input 
                className="input-v2"
                value={formData.gst_number}
                onChange={e => setFormData({...formData, gst_number: e.target.value})}
                placeholder="Optional"
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="btn"
            style={{ padding: '16px', background: saved ? 'var(--success)' : 'var(--primary)', color: 'white', borderRadius: '12px', fontSize: '15px' }}
          >
            {loading ? 'Saving Data...' : saved ? 'Successfully Saved! ✅' : 'Update Receipt Details'}
          </button>
        </form>
      </section>
    </div>
  );
}
