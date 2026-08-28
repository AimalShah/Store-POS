const METHOD_BY_TYPE = { 1: 'cash', 2: 'card', 3: 'mobile' };

export function cashAmount(paymentBreakdown, paymentType, total) {
  const payments = Array.isArray(paymentBreakdown) && paymentBreakdown.length > 0
    ? paymentBreakdown
    : [{ method: METHOD_BY_TYPE[paymentType] || 'cash', amount: total }];

  return payments.reduce((cash, payment) => (
    String(payment.method || '').toLowerCase() === 'cash'
      ? cash + (Number(payment.amount) || 0)
      : cash
  ), 0);
}

// This is the seam between a completed Sale and its active Drawer session.
// It deliberately does nothing when no drawer is open: the drawer guard owns
// blocking that sale flow, while this module only records cash once a Sale is
// known to have completed.
export function recordDrawerCash(db, { till, paymentBreakdown, paymentType, total }) {
  const amount = cashAmount(paymentBreakdown, paymentType, total);
  if (amount === 0) return 0;

  db.prepare(
    `UPDATE drawer_sessions
     SET running_balance = running_balance + ?
     WHERE till = ? AND status = 'open'`
  ).run(amount, till);
  return amount;
}
