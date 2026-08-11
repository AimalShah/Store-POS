import { useEffect, useState } from 'react';
import { api, getUploadsBase, MediaItem } from '../api/client';
import Modal from './Modal';

type Props = {
  value: string;
  onChange: (path: string) => void;
  label?: string;
};

type Tab = 'library' | 'upload';

export default function PhotoPicker({
  value,
  onChange,
  label = 'Photo',
}: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('library');
  const [library, setLibrary] = useState<MediaItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploads = getUploadsBase();
  const previewSrc = value ? `${uploads}/${value}` : '';

  const loadLibrary = async () => {
    const items = await api.getMediaLibrary();
    setLibrary(items);
  };

  useEffect(() => {
    if (!open) return;
    setError(null);
    loadLibrary().catch((err) => setError(err.message));
  }, [open]);

  const uploadFile = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const item = await api.uploadMedia(file);
      await loadLibrary();
      onChange(item.path);
      setTab('library');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  const removeFromLibrary = async (id: number) => {
    if (!confirm('Remove this image from the library?')) return;
    await api.deleteMedia(id);
    await loadLibrary();
  };

  return (
    <div className="field">
      <label>{label}</label>
      <div className="photo-picker-row">
        <div className={`photo-preview ${value ? '' : 'empty'}`}>
          {value ? <img src={previewSrc} alt="" /> : <span>No photo</span>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
            Choose {label.toLowerCase()}
          </button>
          {value && (
            <button type="button" className="btn" onClick={() => onChange('')}>
              Clear
            </button>
          )}
        </div>
      </div>

      <Modal
        title="Photo library"
        open={open}
        onClose={() => setOpen(false)}
        wide
        footer={
          <button type="button" className="btn" onClick={() => setOpen(false)}>
            Done
          </button>
        }
      >
        <div className="chips" style={{ padding: 0, border: 0, marginBottom: '0.85rem' }}>
          <button
            type="button"
            className={`chip ${tab === 'library' ? 'active' : ''}`}
            onClick={() => setTab('library')}
          >
            Library
          </button>
          <button
            type="button"
            className={`chip ${tab === 'upload' ? 'active' : ''}`}
            onClick={() => setTab('upload')}
          >
            Upload
          </button>
        </div>

        {error && <div className="error">{error}</div>}

        {tab === 'library' && (
          <div className="media-grid">
            {library.map((item) => (
              <div
                key={item.id}
                className={`media-tile ${value === item.path ? 'selected' : ''}`}
                onClick={() => onChange(item.path)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') onChange(item.path);
                }}
                role="button"
                tabIndex={0}
              >
                <img src={`${uploads}/${item.path}`} alt={item.alt || ''} />
                <span>Upload</span>
                <button
                  type="button"
                  className="media-del"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFromLibrary(item.id);
                  }}
                >
                  ×
                </button>
              </div>
            ))}
            {!library.length && (
              <div className="empty">Library is empty — upload a file</div>
            )}
          </div>
        )}

        {tab === 'upload' && (
          <div className="field">
            <label>Upload image to library</label>
            <input
              type="file"
              accept="image/*"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadFile(file);
              }}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
