import React from 'react';
import { getUploadsBase, Settings, Transaction, ProductComponent } from '../api/client';

type Props = {
  tx: Transaction;
  settings: Settings | null;
  symbol: string;
};

// Bill header shows only the sequence tail of INV-YYYYMMDD-NNN refs (e.g. 013).
function orderNumber(tx: Transaction): string {
  const m = String(tx.ref_number ?? '').match(/(\d+)\s*$/);
  return m ? m[1].slice(-3).padStart(3, '0') : String(tx.id ?? '');
}

export default function Invoice({ tx, settings, symbol }: Props) {
  const items = Array.isArray(tx.items) ? tx.items : [];
  const subtotal = Number(tx.subtotal ?? 0);
  const discount = Number(tx.discount ?? 0);
  const tax = Number(tx.tax ?? 0);
  const total = Number(tx.total ?? 0);
  const paid = Number(tx.paid ?? total);
  const change = Number(tx.change ?? Math.max(0, paid - total));
  const logo = settings?.img ? `${getUploadsBase()}/${settings.img}` : undefined;
  const isVoided = tx.status === 2;

  const meta: [string, string | number][] = [
    ['Date', new Date(tx.date).toLocaleString()],
    ['Cashier', tx.user || '-'],
    ['Customer', tx.customer_name || 'Walk-in'],
  ];

  const totals: Array<[string, string]> = [['Subtotal', `${symbol}${subtotal.toFixed(2)}`]];
  if (discount > 0) totals.push(['Discount', `-${symbol}${discount.toFixed(2)}`]);
  if (tax > 0) totals.push([settings?.tax || 'Tax', `${symbol}${tax.toFixed(2)}`]);
  totals.push(['TOTAL', `${symbol}${total.toFixed(2)}`]);
  if (tx.payment_breakdown && tx.payment_breakdown.length > 0) {
    for (const pb of tx.payment_breakdown) {
      totals.push([pb.method, `${symbol}${Number(pb.amount).toFixed(2)}`]);
    }
  } else {
    totals.push(['Paid', `${symbol}${paid.toFixed(2)}`]);
  }
  totals.push(['Change', `${symbol}${change.toFixed(2)}`]);

  return (
    <div className="font-mono text-sm relative">
      {isVoided && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-4xl font-extrabold text-destructive/20 rotate-[-30deg] select-none">VOIDED</div>
        </div>
      )}
      {logo ? <img className="mx-auto mb-2 h-16 w-auto object-contain" src={logo} alt="" /> : null}
      <div className="text-center text-base font-bold relative z-10">{settings?.store || 'Store POS'}</div>
      {settings?.address_one ? (
        <div className="text-center text-xs text-muted-foreground">{settings.address_one}</div>
      ) : null}
      {settings?.address_two ? (
        <div className="text-center text-xs text-muted-foreground">{settings.address_two}</div>
      ) : null}
      {settings?.contact ? (
        <div className="text-center text-xs text-muted-foreground">{settings.contact}</div>
      ) : null}

      <div className="mt-2 text-center font-semibold tracking-widest">{`ORDER #${orderNumber(tx)}`}</div>

      <div className="mt-2 space-y-0.5">
        {meta.map(([label, value]) => (
          <div key={label} className="flex justify-between">
            <span className="text-muted-foreground">{label}</span>
            <span>{value}</span>
          </div>
        ))}
      </div>

      {tx.fulfillment ? (
        <div className="mt-1 space-y-0.5">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Fulfillment</span>
            <span className="capitalize">{tx.fulfillment}</span>
          </div>
          {tx.fulfillment === 'delivery' && (
            <>
              {tx.delivery_name ? (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Name</span>
                  <span>{tx.delivery_name}</span>
                </div>
              ) : null}
              {tx.delivery_contact ? (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Contact</span>
                  <span>{tx.delivery_contact}</span>
                </div>
              ) : null}
              {tx.delivery_address ? (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Address</span>
                  <span>{tx.delivery_address}</span>
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      <div className="my-2 border-t" />

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="w-10 py-1 text-center">Qty</th>
            <th className="py-1">Item</th>
            <th className="py-1 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <React.Fragment key={i}>
              <tr>
                <td className="py-1 text-center">{item.quantity}</td>
                <td className="py-1">{item.name}</td>
                <td className="py-1 text-right">
                  {symbol}
                  {(Number(item.price) * Number(item.quantity)).toFixed(2)}
                </td>
              </tr>
              {item.components && item.components.length > 0 && (
                <React.Fragment>
                  {item.components.map((comp: ProductComponent, ci) => (
                    <tr key={ci} className="bg-muted/50">
                      <td className="py-0.5 text-center text-xs">
                        {comp.quantity * item.quantity}
                      </td>
                      <td className="py-0.5 pl-5 text-xs text-muted-foreground">
                        → {comp.name} x{comp.quantity}
                      </td>
                      <td className="py-0.5 text-right text-xs text-muted-foreground">
                        {symbol}0.00
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              )}
              {item.selectedVariants && item.selectedVariants.length > 0 && (
                <React.Fragment>
                  {item.selectedVariants.map((v, vi) => (
                    <tr key={`v-${vi}`} className="bg-muted/50">
                      <td className="py-0.5 text-center text-xs">·</td>
                      <td className="py-0.5 pl-5 text-xs text-muted-foreground">{v.name}</td>
                      <td className="py-0.5 text-right text-xs text-muted-foreground">
                        {v.priceDelta ? `+${symbol}${v.priceDelta.toFixed(2)}` : ''}
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              )}
              {item.selectedModifiers && item.selectedModifiers.length > 0 && (
                <React.Fragment>
                  {item.selectedModifiers.map((m, mi) => (
                    <tr key={`m-${mi}`} className="bg-muted/50">
                      <td className="py-0.5 text-center text-xs">·</td>
                      <td className="py-0.5 pl-5 text-xs text-muted-foreground">+ {m.name}</td>
                      <td className="py-0.5 text-right text-xs text-muted-foreground">
                        {m.priceDelta ? `+${symbol}${m.priceDelta.toFixed(2)}` : ''}
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>

      <div className="my-2 border-t" />

      <div className="space-y-0.5">
        {totals.map(([label, value], idx) => (
          <div
            key={label}
            className={`flex justify-between ${
              label === 'TOTAL' ? 'font-bold' : 'text-muted-foreground'
            }`}
          >
            <span className="capitalize">{label}</span>
            <span>{value}</span>
          </div>
        ))}
      </div>

      {settings?.footer ? (
        <>
          <div className="my-2 border-t" />
          <div className="text-center text-xs text-muted-foreground">{settings.footer}</div>
        </>
      ) : null}
    </div>
  );
}
