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
    gst_number: '',
    custom_message: '',
    printer_mode: 'ble' // 'ble' or 'digital'
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
        gst_number: data.gst_number || '',
        custom_message: data.custom_message || '',
        printer_mode: data.printer_mode || 'ble'
      });
      // Save printer mode to local storage for quick access in POS
      localStorage.setItem('printerMode', data.printer_mode || 'ble');
    } else {
      setFormData({ business_name: '', location: '', phone: '', gst_number: '', custom_message: '', printer_mode: 'ble' });
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
      localStorage.setItem('printerMode', formData.printer_mode);
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
                <div key={g.id} style={{ background: 'var(--bg)', color: 'var(--text)', padding: '6px 14px', border: '1px solid var(--border)', borderRadius: '10px', fontSize: '14px', fontWeight: 600 }}>
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
          <h2 style={{ fontSize: '28px', fontWeight: 900 }}>Configuration</h2>
          <p style={{ color: 'var(--text-dim)' }}>Setup your billing experience.</p>
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

          <div>
            <label style={{ display: 'block', fontWeight: 700, fontSize: '13px', color: 'var(--text-dim)', marginBottom: '8px' }}>BILL FOOTER MESSAGE</label>
            <textarea 
              className="input-v2"
              style={{ minHeight: '80px', resize: 'vertical' }}
              value={formData.custom_message}
              onChange={e => setFormData({...formData, custom_message: e.target.value})}
              placeholder="e.g. Thank you for shopping! Visit again."
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 700, fontSize: '13px', color: 'var(--text-dim)', marginBottom: '8px' }}>PRINTER CONNECTION</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <button 
                type="button"
                className="btn"
                style={{ 
                  background: formData.printer_mode === 'ble' ? 'var(--accent)' : 'var(--bg)',
                  color: formData.printer_mode === 'ble' ? 'white' : 'var(--text-dim)',
                  border: formData.printer_mode === 'ble' ? 'none' : '1px solid var(--border)',
                  borderRadius: '12px'
                }}
                onClick={() => setFormData({...formData, printer_mode: 'ble'})}
              >
                Bluetooth (BLE)
              </button>
              <button 
                type="button"
                className="btn"
                style={{ 
                  background: formData.printer_mode === 'digital' ? 'var(--accent)' : 'var(--bg)',
                  color: formData.printer_mode === 'digital' ? 'white' : 'var(--text-dim)',
                  border: formData.printer_mode === 'digital' ? 'none' : '1px solid var(--border)',
                  borderRadius: '12px'
                }}
                onClick={() => setFormData({...formData, printer_mode: 'digital'})}
              >
                Digital Only
              </button>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '8px' }}>
              {formData.printer_mode === 'ble' ? 'Bills will be sent directly to your connected thermal printer.' : 'A digital receipt will be shown on screen for you to share.'}
            </p>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="btn"
            style={{ padding: '16px', background: saved ? 'var(--success)' : 'var(--primary)', color: 'white', borderRadius: '12px', fontSize: '15px', marginTop: '12px' }}
          >
            {loading ? 'Saving...' : saved ? 'Settings Updated! ✅' : 'Save Configuration'}
          </button>
        </form>
      </section>

      {/* Appearance Section */}
      <section>
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 900 }}>Appearance</h2>
          <p style={{ color: 'var(--text-dim)' }}>Personalize your interface.</p>
        </div>

        <div className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          {['system', 'light', 'dark'].map(t => (
            <button 
               key={t}
               onClick={() => {
                 localStorage.setItem('theme', t);
                 window.dispatchEvent(new Event('themeChanged'));
               }}
               style={{ 
                 padding: '16px 8px', 
                 borderRadius: '16px', 
                 border: '2px solid ' + (localStorage.getItem('theme') === t ? 'var(--accent)' : 'transparent'),
                 background: localStorage.getItem('theme') === t ? 'rgba(var(--accent-raw), 0.1)' : 'var(--bg)',
                 color: localStorage.getItem('theme') === t ? 'var(--accent)' : 'var(--text-dim)',
                 fontWeight: 800,
                 textTransform: 'capitalize',
                 cursor: 'pointer',
                 display: 'flex',
                 flexDirection: 'column',
                 alignItems: 'center',
                 gap: '8px'
               }}
            >
              <span style={{ fontSize: '20px' }}>{t === 'light' ? '☀️' : t === 'dark' ? '🌙' : '🌓'}</span>
              <span style={{ fontSize: '12px' }}>{t}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

