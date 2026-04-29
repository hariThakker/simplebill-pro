import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export default function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ description: '', amount: '' });
  const [dbError, setDbError] = useState(false);

  useEffect(() => {
    fetchExpenses();
    window.addEventListener('groupChanged', fetchExpenses);
    return () => window.removeEventListener('groupChanged', fetchExpenses);
  }, []);

  async function fetchExpenses() {
    const groupId = localStorage.getItem('selectedGroupId');
    if (!groupId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });

    if (error) {
      setDbError(true);
      setLoading(false);
      return;
    }
    setDbError(false);
    setExpenses(data || []);
    setLoading(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const groupId = localStorage.getItem('selectedGroupId');
    if (!groupId) { alert('Select a group first'); return; }

    const { error } = await supabase.from('expenses').insert([{
      group_id: groupId, description: formData.description, amount: Number(formData.amount)
    }]);

    if (!error) {
      setFormData({ description: '', amount: '' });
      setShowForm(false);
      fetchExpenses();
      window.dispatchEvent(new Event('groupChanged')); // update dashboard
    } else {
      alert("Error saving expense: " + error.message);
    }
  }

  async function deleteExpense(id) {
    if (!confirm('Are you sure you want to delete this expense?')) return;
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (!error) {
      fetchExpenses();
      window.dispatchEvent(new Event('groupChanged')); // update dashboard
    }
  }

  return (
    <div className="page-transition">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '28px', fontWeight: 900 }}>Expenses</h2>
          <p style={{ color: 'var(--text-dim)' }}>Track daily costs to calculate net profit</p>
        </div>
        {!dbError && (
          <button onClick={() => setShowForm(!showForm)} className={`btn ${showForm ? 'btn-ghost' : 'btn-danger'}`} style={{ borderRadius: '14px', background: !showForm ? 'var(--danger)' : undefined, color: !showForm ? 'white' : undefined }}>
            {showForm ? 'Cancel' : '+ Add Expense'}
          </button>
        )}
      </div>

      {dbError && (
        <div className="card" style={{ padding: '24px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid var(--danger)', textAlign: 'center' }}>
          <h3 style={{ color: 'var(--danger)', marginBottom: '12px' }}>Database Setup Required</h3>
          <p style={{ color: 'var(--text-dim)', fontSize: '14px', marginBottom: '16px' }}>To use the Expense tracking feature, please run this SQL command in your Supabase SQL Editor:</p>
          <pre style={{ background: 'var(--bg)', padding: '16px', borderRadius: '12px', fontSize: '12px', color: 'var(--text)', textAlign: 'left', overflowX: 'auto' }}>
            {`CREATE TABLE expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);`}
          </pre>
        </div>
      )}

      {showForm && !dbError && (
        <form onSubmit={handleSubmit} className="card" style={{ marginBottom: '32px', animation: 'slideIn 0.3s ease' }}>
          <h3 style={{ marginBottom: '20px', fontSize: '18px' }}>Log New Expense</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-dim)', marginBottom: '6px', display: 'block' }}>DESCRIPTION</label>
              <input required className="input-v2" placeholder="e.g. Rent, Electricity, Supplies" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-dim)', marginBottom: '6px', display: 'block' }}>AMOUNT (₹)</label>
              <input required type="number" className="input-v2" placeholder="0.00" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} />
            </div>
          </div>
          <button type="submit" className="btn" style={{ background: 'var(--danger)', color: 'white', width: '100%', marginTop: '24px', height: '52px', borderRadius: '12px', fontSize: '16px' }}>Log Expense</button>
        </form>
      )}

      {!dbError && loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-dim)' }}>Loading Expenses...</div>
      ) : !dbError && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
          {expenses.map(exp => (
            <div key={exp.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '44px', height: '44px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>💸</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '16px' }}>{exp.description}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-dim)', fontWeight: 600 }}>{new Date(exp.created_at).toLocaleDateString()}</div>
                </div>
              </div>
              <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                <div style={{ fontWeight: 800, color: 'var(--danger)', fontSize: '20px' }}>-₹{exp.amount}</div>
                <button onClick={() => deleteExpense(exp.id)} className="btn btn-ghost" style={{ fontSize: '11px', padding: '4px 8px', color: 'var(--text-dim)' }}>Remove</button>
              </div>
            </div>
          ))}
          {expenses.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 20px', background: 'rgba(0,0,0,0.02)', borderRadius: '24px', border: '2px dashed var(--border)' }}>
              <div style={{ fontSize: '40px', marginBottom: '16px' }}>📉</div>
              <p style={{ fontWeight: 700, color: 'var(--text-dim)' }}>No expenses logged yet.</p>
              <p style={{ fontSize: '13px', color: 'var(--text-light)' }}>Track your costs to see net profit.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
