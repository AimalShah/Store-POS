import { useEffect, useState } from 'react';
import { api, Settings } from '../api/client';
import PhotoPicker from '../components/PhotoPicker';

type Props = {
  settings: Settings | null;
  onSaved: () => Promise<void>;
};

export default function SettingsView({ settings, onSaved }: Props) {
  const [form, setForm] = useState({
    store: '',
    address_one: '',
    address_two: '',
    contact: '',
    tax: '',
    symbol: '$',
    percentage: '0',
    charge_tax: false,
    footer: '',
    img: '',
  });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [demoBusy, setDemoBusy] = useState(false);

  useEffect(() => {
    setForm({
      store: settings?.store || '',
      address_one: settings?.address_one || '',
      address_two: settings?.address_two || '',
      contact: settings?.contact || '',
      tax: settings?.tax || '',
      symbol: settings?.symbol || '$',
      percentage: String(settings?.percentage ?? 0),
      charge_tax: !!settings?.charge_tax,
      footer: settings?.footer || '',
      img: settings?.img || '',
    });
  }, [settings]);

  const save = async () => {
    setError(null);
    setMessage(null);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        if (k === 'charge_tax') fd.append(k, form.charge_tax ? '1' : '0');
        else fd.append(k, String(v));
      });

      await api.saveSettings(fd);

      setMessage('Settings saved.');
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    }
  };

  const seedDemo = async () => {
    setError(null);
    setMessage(null);
    setDemoBusy(true);
    try {
      const result = await api.seedDemo();
      setMessage(result.message);
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Seed failed');
    } finally {
      setDemoBusy(false);
    }
  };

  const clearDemo = async () => {
    if (
      !confirm(
        'Delete ALL products, categories, sales history, and customers (except Walk-in)? This cannot be undone.'
      )
    ) {
      return;
    }
    setError(null);
    setMessage(null);
    setDemoBusy(true);
    try {
      const result = await api.clearDemo();
      setMessage(result.message);
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Clear failed');
    } finally {
      setDemoBusy(false);
    }
  };

  return (
    <div className="panel" style={{ padding: '1.25rem', maxWidth: 880 }}>
      {error && <div className="error">{error}</div>}
      {message && <div className="notice">{message}</div>}

      <div className="page-grid">
        <div>
          <h3 style={{ marginTop: 0 }}>Store</h3>
          <div className="field">
            <label>Store name</label>
            <input
              value={form.store}
              onChange={(e) => setForm({ ...form, store: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Address</label>
            <input
              value={form.address_one}
              onChange={(e) => setForm({ ...form, address_one: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Address line 2</label>
            <input
              value={form.address_two}
              onChange={(e) => setForm({ ...form, address_two: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Contact</label>
            <input
              value={form.contact}
              onChange={(e) => setForm({ ...form, contact: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Receipt footer</label>
            <input
              value={form.footer}
              onChange={(e) => setForm({ ...form, footer: e.target.value })}
            />
          </div>
          <PhotoPicker
            label="Store logo"
            value={form.img}
            onChange={(img) => setForm({ ...form, img })}
          />
        </div>

        <div>
          <h3 style={{ marginTop: 0 }}>Till</h3>
          <div className="field">
            <label>Currency symbol</label>
            <input
              value={form.symbol}
              onChange={(e) => setForm({ ...form, symbol: e.target.value })}
            />
          </div>
          <label
            style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem' }}
          >
            <input
              type="checkbox"
              checked={form.charge_tax}
              onChange={(e) => setForm({ ...form, charge_tax: e.target.checked })}
            />
            Charge tax on sales
          </label>
          {form.charge_tax && (
            <>
              <div className="field">
                <label>Tax label</label>
                <input
                  value={form.tax}
                  onChange={(e) => setForm({ ...form, tax: e.target.value })}
                  placeholder="VAT"
                />
              </div>
              <div className="field">
                <label>Tax %</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.percentage}
                  onChange={(e) => setForm({ ...form, percentage: e.target.value })}
                />
              </div>
            </>
          )}
          <p className="muted" style={{ fontSize: '0.85rem' }}>
            This till runs fully offline on this computer.
          </p>
        </div>
      </div>

      <button type="button" className="btn btn-primary" onClick={save} style={{ marginTop: '1rem' }}>
        Save settings
      </button>

      <div style={{ marginTop: '1.75rem', paddingTop: '1.25rem', borderTop: '1px solid var(--line)' }}>
        <h3 style={{ marginTop: 0 }}>Demo data</h3>
        <p className="muted" style={{ fontSize: '0.9rem', marginTop: 0 }}>
          Seed a sample South African catalog (categories, products, customers), or wipe catalog and
          sales data for a clean slate. Staff and settings are kept.
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn" disabled={demoBusy} onClick={seedDemo}>
            Seed demo catalog
          </button>
          <button type="button" className="btn btn-danger" disabled={demoBusy} onClick={clearDemo}>
            Bulk delete catalog &amp; sales
          </button>
        </div>
      </div>
    </div>
  );
}
