import { useEffect, useState } from 'react';
import { api, Customer } from '../api/client';

export default function CustomersView({
  customers,
  onChanged,
}: {
  customers: Customer[];
  onChanged: () => Promise<void>;
}) {
  const [list, setList] = useState(customers);
  const [form, setForm] = useState({
    id: '',
    name: '',
    phone: '',
    email: '',
    address: '',
  });

  useEffect(() => setList(customers), [customers]);

  const save = async () => {
    if (!form.name.trim()) return;
    if (form.id) {
      await api.updateCustomer({
        _id: form.id,
        id: Number(form.id),
        name: form.name,
        phone: form.phone,
        email: form.email,
        address: form.address,
      });
    } else {
      await api.saveCustomer({
        name: form.name,
        phone: form.phone,
        email: form.email,
        address: form.address,
      });
    }
    setForm({ id: '', name: '', phone: '', email: '', address: '' });
    await onChanged();
  };

  const remove = async (id: number) => {
    if (!confirm('Delete customer?')) return;
    await api.deleteCustomer(id);
    await onChanged();
  };

  return (
    <div className="page-grid">
      <div className="panel" style={{ padding: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>{form.id ? 'Edit customer' : 'New customer'}</h3>
        <div className="field">
          <label>Name</label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Phone</label>
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Email</label>
          <input
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Address</label>
          <textarea
            rows={3}
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </div>
        <button type="button" className="btn btn-primary" onClick={save}>
          {form.id ? 'Update' : 'Add'} customer
        </button>
      </div>
      <div className="panel" style={{ padding: '1rem' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.phone}</td>
                <td>
                  <button
                    type="button"
                    className="btn"
                    onClick={() =>
                      setForm({
                        id: String(c.id),
                        name: c.name,
                        phone: c.phone,
                        email: c.email,
                        address: c.address,
                      })
                    }
                  >
                    Edit
                  </button>{' '}
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => remove(c.id)}
                  >
                    Del
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
