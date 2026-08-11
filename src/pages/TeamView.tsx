import { useEffect, useState } from 'react';
import { api } from '../api/client';

type UserRow = Awaited<ReturnType<typeof api.getUsers>>[number];

export default function TeamView() {
  const [list, setList] = useState<UserRow[]>([]);
  const [form, setForm] = useState({
    id: '',
    username: '',
    password: '',
    fullname: '',
    perm_products: true,
    perm_categories: true,
    perm_transactions: true,
    perm_users: false,
    perm_settings: false,
  });
  const [error, setError] = useState<string | null>(null);

  const load = async () => setList(await api.getUsers());

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  const save = async () => {
    setError(null);
    if (!form.username.trim() || !form.fullname.trim()) {
      setError('Username and full name are required');
      return;
    }
    if (!form.id && !form.password) {
      setError('Password is required for new users');
      return;
    }
    try {
      await api.saveUser({ ...form });
      await load();
      setForm({
        id: '',
        username: '',
        password: '',
        fullname: '',
        perm_products: true,
        perm_categories: true,
        perm_transactions: true,
        perm_users: false,
        perm_settings: false,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    }
  };

  return (
    <div className="page-grid">
      <div className="panel" style={{ padding: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>{form.id ? 'Edit user' : 'New user'}</h3>
        {error && <div className="error">{error}</div>}
        <div className="field">
          <label>Username</label>
          <input
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Full name</label>
          <input
            value={form.fullname}
            onChange={(e) => setForm({ ...form, fullname: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Password {form.id ? '(blank = keep)' : ''}</label>
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </div>
        {(
          [
            ['perm_products', 'Catalog products'],
            ['perm_categories', 'Categories'],
            ['perm_transactions', 'Sales history'],
            ['perm_users', 'Team'],
            ['perm_settings', 'Settings'],
          ] as const
        ).map(([key, label]) => (
          <label
            key={key}
            style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem', alignItems: 'center' }}
          >
            <input
              type="checkbox"
              checked={form[key]}
              onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
            />
            {label}
          </label>
        ))}
        <button
          type="button"
          className="btn btn-primary"
          onClick={save}
          style={{ marginTop: '0.75rem' }}
        >
          {form.id ? 'Update' : 'Add'} user
        </button>
      </div>
      <div className="panel" style={{ padding: '1rem' }}>
        <table className="table">
          <thead>
            <tr>
              <th>User</th>
              <th>Name</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((u) => (
              <tr key={u.id}>
                <td>{u.username}</td>
                <td>{u.fullname}</td>
                <td>
                  <button
                    type="button"
                    className="btn"
                    onClick={() =>
                      setForm({
                        id: String(u.id),
                        username: u.username,
                        password: '',
                        fullname: u.fullname,
                        perm_products: !!u.perm_products,
                        perm_categories: !!u.perm_categories,
                        perm_transactions: !!u.perm_transactions,
                        perm_users: !!u.perm_users,
                        perm_settings: !!u.perm_settings,
                      })
                    }
                  >
                    Edit
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
