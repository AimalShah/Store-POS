import { getUploadsBase, Settings, Transaction } from '../api/client';

type Props = {
  tx: Transaction;
  settings: Settings | null;
  symbol: string;
};

export default function Invoice({ tx, settings, symbol }: Props) {
  const items = Array.isArray(tx.items) ? tx.items : [];
  const subtotal = Number(tx.subtotal ?? 0);
  const discount = Number(tx.discount ?? 0);
  const tax = Number(tx.tax ?? 0);
  const total = Number(tx.total ?? 0);
  const paid = Number(tx.paid ?? total);
  const change = Number(tx.change ?? Math.max(0, paid - total));
  const logo = settings?.img ? `${getUploadsBase()}/${settings.img}` : undefined;

  return (
    <div className="invoice-doc">
      {logo ? <img className="invoice-logo" src={logo} alt="" /> : null}
      <div className="invoice-center invoice-store">{settings?.store || 'Store POS'}</div>
      {settings?.address_one ? <div className="invoice-center">{settings.address_one}</div> : null}
      {settings?.address_two ? <div className="invoice-center">{settings.address_two}</div> : null}
      {settings?.contact ? <div className="invoice-center">{settings.contact}</div> : null}

      <div className="invoice-title">INVOICE</div>

      <div className="invoice-meta">
        <div>
          <span>Invoice</span>
          <span className="invoice-ref">{tx.ref_number || '-'}</span>
        </div>
        <div>
          <span>Date</span>
          <span>{new Date(tx.date).toLocaleString()}</span>
        </div>
        <div>
          <span>Cashier</span>
          <span>{tx.user || '-'}</span>
        </div>
        <div>
          <span>Till</span>
          <span>{tx.till || 1}</span>
        </div>
        <div>
          <span>Customer</span>
          <span>{tx.customer_name || 'Walk-in'}</span>
        </div>
      </div>

      <div className="invoice-rule" />

      <table className="invoice-items">
        <thead>
          <tr>
            <th className="invoice-qty">Qty</th>
            <th>Item</th>
            <th className="invoice-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i}>
              <td className="invoice-qty">{item.quantity}</td>
              <td>{item.name}</td>
              <td className="invoice-right">
                {symbol}
                {(Number(item.price) * Number(item.quantity)).toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="invoice-rule" />

      <div className="invoice-totals">
        <div className="invoice-total-row">
          <span>Subtotal</span>
          <span>
            {symbol}
            {subtotal.toFixed(2)}
          </span>
        </div>
        {discount > 0 && (
          <div className="invoice-total-row">
            <span>Discount</span>
            <span>
              -{symbol}
              {discount.toFixed(2)}
            </span>
          </div>
        )}
        {tax > 0 && (
          <div className="invoice-total-row">
            <span>{settings?.tax || 'Tax'}</span>
            <span>
              {symbol}
              {tax.toFixed(2)}
            </span>
          </div>
        )}
        <div className="invoice-total-row invoice-grand">
          <span>TOTAL</span>
          <span>
            {symbol}
            {total.toFixed(2)}
          </span>
        </div>
        {tx.payment_breakdown && tx.payment_breakdown.length > 0 ? (
          tx.payment_breakdown.map((pb, idx) => (
            <div key={idx} className="invoice-total-row">
              <span className="capitalize">{pb.method}</span>
              <span>
                {symbol}
                {Number(pb.amount).toFixed(2)}
              </span>
            </div>
          ))
        ) : (
          <div className="invoice-total-row">
            <span>Paid</span>
            <span>
              {symbol}
              {paid.toFixed(2)}
            </span>
          </div>
        )}
        <div className="invoice-total-row">
          <span>Change</span>
          <span>
            {symbol}
            {change.toFixed(2)}
          </span>
        </div>
      </div>

      {settings?.footer ? (
        <div className="invoice-rule" />
      ) : null}
      {settings?.footer ? (
        <div className="invoice-center invoice-footer">{settings.footer}</div>
      ) : null}
    </div>
  );
}
