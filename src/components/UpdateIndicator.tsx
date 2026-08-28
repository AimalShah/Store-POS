import { useEffect, useState } from 'react';
import { Download, RefreshCw, Loader2 } from 'lucide-react';
import { useLocale } from '../i18n/LocaleContext';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { getPosBridge } from '../bridge';
import type { UpdaterState } from '../vite-env';

export function UpdateIndicator() {
  const { t } = useLocale();
  const [state, setState] = useState<UpdaterState>({ status: 'idle', version: null, error: null });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const bridge = getPosBridge();
    let active = true;
    bridge.updater.getState().then((s) => {
      if (active) setState(s);
    });
    bridge.updater.onState((s) => {
      if (active) setState(s);
    });
    return () => {
      active = false;
    };
  }, []);

  const showButton = state.status === 'available' || state.status === 'downloaded';
  if (!showButton) return null;

  const downloaded = state.status === 'downloaded';

  const primary = async () => {
    const bridge = getPosBridge();
    setBusy(true);
    try {
      if (downloaded) {
        await bridge.updater.restart();
      } else {
        await bridge.updater.download();
        setDialogOpen(true);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="icon-sm"
        className="text-blue-600 hover:text-blue-700"
        title={
          downloaded
            ? t('update.readyTitle', { version: state.version ?? '' })
            : t('update.availableTitle', { version: state.version ?? '' })
        }
        onClick={() => setDialogOpen(true)}
      >
        <Download className="size-4" />
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('update.available')}</DialogTitle>
            <DialogDescription>
              {t('update.desc', { version: state.version ?? '' })}
            </DialogDescription>
          </DialogHeader>

          {state.status === 'downloading' && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {t('update.downloading')}
            </div>
          )}
          {downloaded && (
            <p className="text-sm text-muted-foreground">
              {t('update.downloaded')}
            </p>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t('update.later')}
            </Button>
            <Button onClick={primary} disabled={busy}>
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : downloaded ? (
                <RefreshCw className="size-4" />
              ) : (
                <Download className="size-4" />
              )}
              {downloaded ? t('update.restartNow') : t('update.download')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
