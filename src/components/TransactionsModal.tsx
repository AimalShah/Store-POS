import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import SalesView from '../pages/SalesView';
import { Settings, User } from '../api/client';

type Props = {
  open?: boolean;
  embedded?: boolean;
  onClose: () => void;
  users?: User[];
  symbol: string;
  settings: Settings | null;
};

export default function TransactionsModal({
  open = true,
  embedded = false,
  onClose,
  symbol,
  settings,
}: Props) {
  if (embedded) {
    return <SalesView symbol={symbol} settings={settings} onClose={onClose} />;
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sales & Transactions</DialogTitle>
        </DialogHeader>
        <SalesView symbol={symbol} settings={settings} onClose={onClose} />
      </DialogContent>
    </Dialog>
  );
}
