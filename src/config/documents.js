// Invoice-like documents, shared by the Node server (server/) and the
// browser-only demo (src/store/demoServer.js). Plain JavaScript only.

// Number prefix and how saving moves stock: 1 = in, -1 = out, 0 = none,
// 'direction' = the document says (Product Stock In/Out: direction 'in' | 'out').
export const DOCUMENTS = {
  sales: { prefix: 'S', stock: -1 },
  purchases: { prefix: 'P', stock: 1 },
  salesReturns: { prefix: 'SR', stock: 1 },
  purchaseReturns: { prefix: 'PR', stock: -1 },
  purchaseOrders: { prefix: 'PO', stock: 0 },
  damages: { prefix: 'D', stock: -1 },
  quotations: { prefix: 'QT', stock: 0 },
  stockAdjustments: { prefix: 'ADJ', stock: 'direction' },
}

export const stockSign = (cfg, doc) => (cfg.stock === 'direction' ? (doc?.direction === 'out' ? -1 : 1) : cfg.stock || 0)

const r2 = (v) => Math.round(v * 100) / 100

// A purchase order's receive status, worked out from every purchase made from it.
// Each purchase line may carry poIndex (which P/O line it receives).
export function purchaseOrderStatus(po, purchases) {
  const got = po.items.map(() => 0)
  purchases.forEach((p) => p.items.forEach((it) => {
    const i = Number.isInteger(it.poIndex) ? it.poIndex : po.items.findIndex((x) => x.productId === it.productId)
    if (i >= 0 && i < got.length) got[i] += Number(it.qty) || 0
  }))
  const full = po.items.filter((it, i) => got[i] + 0.005 >= Number(it.qty)).length
  const any = got.some((g) => g > 0)
  const status = !purchases.length || !any ? 'Pending' : full === po.items.length ? 'Received' : 'Partial'
  return {
    receiveStatus: status,
    received: status === 'Received',
    receivedQty: got.map(r2),
    receivedPurchaseIds: purchases.map((p) => p.id),
    receivedPurchaseNumber: purchases.map((p) => p.number).join(', '),
    receivedAmount: r2(purchases.reduce((a, p) => a + (Number(p.invoiceAmount) || 0), 0)),
    receivedPaid: r2(purchases.reduce((a, p) => a + (Number(p.paid) || 0), 0)),
  }
}

// A quotation is converted once a sale was made from it ("Convert To Sale")
export function quotationStatus(q, sales) {
  return {
    converted: sales.length > 0,
    convertedSaleId: sales[0]?.id || '',
    convertedSaleNumber: sales.map((x) => x.number).join(', '),
  }
}

// After a purchase or sale is saved, edited or deleted, refresh the P/O or
// quotation it came from. db: { all(col), get(col, id), update(col, id, patch) }.
// Returns the updated records as { purchaseOrders: [...], quotations: [...] }.
export function refreshLinks(col, docs, db) {
  const out = { purchaseOrders: [], quotations: [] }
  const link = { purchases: ['purchaseOrderId', 'purchaseOrders', purchaseOrderStatus], sales: ['quotationId', 'quotations', quotationStatus] }[col]
  if (!link) return out
  const [field, target, status] = link
  const ids = [...new Set(docs.filter(Boolean).map((d) => d[field]).filter(Boolean))]
  for (const id of ids) {
    const src = db.get(target, id)
    if (!src) continue
    const made = db.all(col).filter((d) => d[field] === id)
    out[target].push(db.update(target, id, status(src, made)))
  }
  return out
}

// Checks before a purchase/sale is made from a P/O/quotation. Returns an error message or ''.
export function checkLink(col, body, db) {
  if (col === 'purchases' && body.purchaseOrderId) {
    const po = db.get('purchaseOrders', body.purchaseOrderId)
    if (!po) return 'That purchase order no longer exists'
    if (purchaseOrderStatus(po, db.all('purchases').filter((p) => p.purchaseOrderId === po.id)).receiveStatus === 'Received') {
      return `${po.number} has already been received in full`
    }
  }
  if (col === 'sales' && body.quotationId) {
    const q = db.get('quotations', body.quotationId)
    if (!q) return 'That quotation no longer exists'
    if (db.all('sales').some((x) => x.quotationId === q.id)) return `${q.number} was already converted to a sale`
  }
  return ''
}
