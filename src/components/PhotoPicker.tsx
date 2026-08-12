import { useEffect, useState } from 'react';
import { api, getUploadsBase, MediaItem } from '../api/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';

type Props = {
  value: string;
  onChange: (path: string) => void;
  label?: string;
};

export default function PhotoPicker({
  value,
  onChange,
  label = 'Photo',
}: Props) {
  const [open, setOpen] = useState(false);
  const [library, setLibrary] = useState<MediaItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDel, setPendingDel] = useState<MediaItem | null>(null);

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  const removeFromLibrary = async () => {
    if (!pendingDel) return;
    await api.deleteMedia(pendingDel.id);
    setPendingDel(null);
    await loadLibrary();
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-4">
        <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-md border bg-muted text-xs text-muted-foreground">
          {value ? <img src={previewSrc} alt="" className="h-full w-full object-cover" /> : 'No photo'}
        </div>
        <div className="flex flex-col gap-2">
          <Button type="button" onClick={() => setOpen(true)}>
            Choose {label.toLowerCase()}
          </Button>
          {value && (
            <Button type="button" variant="outline" onClick={() => onChange('')}>
              Clear
            </Button>
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Photo library</DialogTitle>
          </DialogHeader>
          {error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          <Tabs defaultValue="library">
            <TabsList>
              <TabsTrigger value="library">Library</TabsTrigger>
              <TabsTrigger value="upload">Upload</TabsTrigger>
            </TabsList>
            <TabsContent value="library" className="space-y-3">
              {library.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Library is empty — upload a file
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {library.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onChange(item.path)}
                      className={`group relative aspect-square overflow-hidden rounded-md border ${
                        value === item.path ? 'ring-2 ring-primary' : ''
                      }`}
                    >
                      <img
                        src={`${uploads}/${item.path}`}
                        alt={item.alt || ''}
                        className="h-full w-full object-cover"
                      />
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          setPendingDel(item);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.stopPropagation();
                            setPendingDel(item);
                          }
                        }}
                        className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"
                      >
                        ×
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </TabsContent>
            <TabsContent value="upload" className="space-y-2">
              <Label htmlFor="photo-upload">Upload image to library</Label>
              <Input
                id="photo-upload"
                type="file"
                accept="image/*"
                disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadFile(file);
                }}
              />
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingDel} onOpenChange={(o) => !o && setPendingDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove image?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes the image from the library. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={removeFromLibrary}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
