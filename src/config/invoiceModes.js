// One invoice screen serves several documents. Each mode says which
// collection it saves to, who the other party is and how stock moves.
export const INVOICE_MODES = {
  sale: {
    title: 'Sales', collection: 'sales', prefix: 'S', party: ['customer', 'retailer'], walkIn: 'Walk-In Customer',
    stock: -1, payments: true, labor: true, reference: true, listPath: '/invoices/all-sales',
  },
  purchase: {
    title: 'Purchase', collection: 'purchases', prefix: 'P', party: ['supplier'], walkIn: 'Walk-In Supplier',
    stock: 1, payments: true, listPath: '/bills/all-bills', priceKey: 'purchasePrice',
  },
  salesReturn: {
    title: 'Sales Return', collection: 'salesReturns', prefix: 'SR', party: ['customer', 'retailer'], walkIn: 'Walk-In Customer',
    stock: 1, payments: true, source: 'sales', listPath: '/salesreturn/direct-return',
  },
  directReturn: {
    title: 'Direct Return', collection: 'salesReturns', prefix: 'SR', party: ['customer', 'retailer'], walkIn: 'Walk-In Customer',
    stock: 1, payments: true, listPath: '/salesreturn/direct-return',
  },
  purchaseReturn: {
    title: 'Purchase Return', collection: 'purchaseReturns', prefix: 'PR', party: ['supplier'], walkIn: 'Walk-In Supplier',
    stock: -1, payments: true, source: 'purchases', listPath: '/bills/all-bills', priceKey: 'purchasePrice',
  },
  purchaseOrder: {
    title: 'Create Purchase Order', collection: 'purchaseOrders', prefix: 'PO', party: ['supplier'], walkIn: 'Walk-In Supplier',
    stock: 0, payments: false, listPath: '/purchaseorders/all-purchase-orders', priceKey: 'purchasePrice',
  },
  damage: {
    title: 'New Damage Entry', collection: 'damages', prefix: 'D', party: null,
    stock: -1, payments: false, listPath: '/damages', priceKey: 'purchasePrice',
  },
}

// Labour cost per cartoon used when "Auto Labor Cost" is ticked on a sale.
export const LABOR_PER_CARTOON = 10

// Round invoice totals to whole Taka (4221.34 -> 4221), as on the shop's printed invoices.
export const ROUND_TOTAL = true
