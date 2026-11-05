// Sample data so every screen has something to show.
// All names and numbers here are made up.
const d = (offset) => {
  const t = new Date()
  t.setDate(t.getDate() - offset)
  return t.toISOString().slice(0, 10)
}

export const seed = () => ({
  sizes: [
    { id: 's1', name: '8 X 12', status: 'Active' },
    { id: 's2', name: '12 X 12', status: 'Active' },
    { id: 's3', name: '12 X 24', status: 'Active' },
    { id: 's4', name: '16 X 16', status: 'Active' },
    { id: 's5', name: '24 X 24', status: 'Active' },
  ],
  categories: [
    { id: 'c1', name: 'WALL', status: 'Active' },
    { id: 'c2', name: 'FLOOR', status: 'Active' },
    { id: 'c3', name: 'SANITARY', status: 'Active' },
    { id: 'c4', name: 'PLASTIC DOOR', status: 'Active' },
  ],
  brands: [
    { id: 'b1', name: 'STAR CERAMICS', status: 'Active' },
    { id: 'b2', name: 'DELTA TILES', status: 'Active' },
    { id: 'b3', name: 'OCEAN SANITARY', status: 'Active' },
  ],
  grades: [
    { id: 'g1', name: 'A Grade', status: 'Active' },
    { id: 'g2', name: 'B Grade', status: 'Active' },
    { id: 'g3', name: 'Commercial', status: 'Active' },
  ],
  units: [
    { id: 'u1', name: 'SFT', status: 'Active' },
    { id: 'u2', name: 'PCS', status: 'Active' },
    { id: 'u3', name: 'Set', status: 'Active' },
  ],
  variations: [],
  products: [
    { id: 'p1', kind: 'Tiles', code: 'ST-101 WHT', name: '101 White Gloss', category: 'WALL', brand: 'STAR CERAMICS', grade: 'A Grade', size: '8 X 12', pcsPerCart: 25, purchasePrice: 42.5, sellPrice: 48, productType: 'Single', stock: 480, alertQty: 100, status: 'Active' },
    { id: 'p2', kind: 'Tiles', code: 'ST-102 BEG', name: '102 Beige Matt', category: 'WALL', brand: 'STAR CERAMICS', grade: 'A Grade', size: '8 X 12', pcsPerCart: 25, purchasePrice: 42.5, sellPrice: 47, productType: 'Single', stock: 65, alertQty: 100, status: 'Active' },
    { id: 'p3', kind: 'Tiles', code: 'DT-220 GRY', name: '220 Grey Stone', category: 'FLOOR', brand: 'DELTA TILES', grade: 'A Grade', size: '16 X 16', pcsPerCart: 6, purchasePrice: 55, sellPrice: 62, productType: 'Single', stock: 1200, alertQty: 200, status: 'Active' },
    { id: 'p4', kind: 'Tiles', code: 'DT-240 MRB', name: '240 Marble Look', category: 'FLOOR', brand: 'DELTA TILES', grade: 'B Grade', size: '24 X 24', pcsPerCart: 4, purchasePrice: 78, sellPrice: 90, productType: 'Single', stock: 0, alertQty: 150, status: 'Active' },
    { id: 'p5', kind: 'Tiles', code: 'DT-310 WD', name: '310 Wood Plank', category: 'FLOOR', brand: 'DELTA TILES', grade: 'A Grade', size: '12 X 24', pcsPerCart: 8, purchasePrice: 68, sellPrice: 76, productType: 'Single', stock: 640, alertQty: 100, status: 'Active' },
    { id: 'p6', kind: 'General', code: 'OS-COM-01', name: 'Commode Set Classic', category: 'SANITARY', brand: 'OCEAN SANITARY', grade: 'A Grade', size: '', pcsPerCart: 1, purchasePrice: 6500, sellPrice: 7800, productType: 'Single', stock: 12, alertQty: 3, status: 'Active' },
    { id: 'p7', kind: 'General', code: 'OS-BSN-02', name: 'Wash Basin Oval', category: 'SANITARY', brand: 'OCEAN SANITARY', grade: 'A Grade', size: '', pcsPerCart: 1, purchasePrice: 1800, sellPrice: 2300, productType: 'Single', stock: 2, alertQty: 5, status: 'Active' },
    { id: 'p8', kind: 'General', code: 'PD-30X80', name: 'PVC Door 30x80', category: 'PLASTIC DOOR', brand: 'STAR CERAMICS', grade: 'A Grade', size: '', pcsPerCart: 1, purchasePrice: 3200, sellPrice: 3900, productType: 'Single', stock: 20, alertQty: 5, status: 'Active' },
  ],
  contacts: [
    { id: 'k1', code: 1001, type: 'customer', name: 'Rahim Traders', organization: 'Rahim Traders', address: 'Main Road', phone: '01700000001', altPhone: '', nid: '', openingBalance: 5000 },
    { id: 'k2', code: 1002, type: 'customer', name: 'Karim Builders', organization: '', address: 'College Para', phone: '01700000002', altPhone: '', nid: '', openingBalance: 0 },
    { id: 'k3', code: 1003, type: 'retailer', name: 'City Tiles Corner', organization: '', address: 'Bazar Road', phone: '01700000003', altPhone: '', nid: '', openingBalance: 0 },
    { id: 'k4', code: 1004, type: 'supplier', name: 'Delta Tiles Distributor', organization: 'Delta Tiles', address: 'Dhaka', phone: '01700000004', altPhone: '', nid: '', openingBalance: 0 },
    { id: 'k5', code: 1005, type: 'employee', name: 'Sohel Rana', organization: '', address: '', phone: '01700000005', altPhone: '', nid: '', openingBalance: 0, salary: 15000, designation: 'Salesman' },
    { id: 'k6', code: 1006, type: 'reference', name: 'Mizan Mistri', organization: '', address: '', phone: '01700000006', altPhone: '', nid: '', openingBalance: 0 },
  ],
  sales: [
    mkInvoice('inv1', 'S-0001', d(40), 'k1', 'Rahim Traders', [{ productId: 'p1', name: '101 White Gloss', qty: 200, rate: 48 }], 6000),
    mkInvoice('inv2', 'S-0002', d(12), 'k2', 'Karim Builders', [{ productId: 'p3', name: '220 Grey Stone', qty: 320, rate: 62 }], 15000),
    mkInvoice('inv3', 'S-0003', d(0), '', 'Walk-In Customer', [{ productId: 'p6', name: 'Commode Set Classic', qty: 1, rate: 7800 }], 7800),
  ],
  purchases: [
    mkInvoice('pur1', 'P-0001', d(45), 'k4', 'Delta Tiles Distributor', [{ productId: 'p3', name: '220 Grey Stone', qty: 1500, rate: 55 }], 60000),
  ],
  salesReturns: [], purchaseReturns: [], directReturns: [], purchaseOrders: [], damages: [],
  expenses: [
    { id: 'e1', date: d(0), number: 'EXP-0001', contact: '', head: 'Shop Rent', amount: 12000, method: 'Cash', info: '', note: 'Monthly rent' },
  ],
  incomes: [],
  transfers: [],
  payments: [],
  settlements: [],
  accountHeads: [
    { id: 'a1', name: 'Shop Rent', type: 'Expense' },
    { id: 'a2', name: 'Electricity Bill', type: 'Expense' },
    { id: 'a3', name: 'Transport / Labour', type: 'Expense' },
    { id: 'a4', name: 'Tea & Snacks', type: 'Expense' },
    { id: 'a5', name: 'Commission Income', type: 'Income' },
    { id: 'a6', name: 'Other Income', type: 'Income' },
  ],
  branches: [{ id: 'br1', name: 'Main Branch', address: 'Main Road', phone: '' }],
  users: [{ id: 'us1', name: 'Admin', phone: 'admin', role: 'Super Admin', branch: 'Main Branch', status: 'Active' }],
  messages: [], phoneBook: [], sentMessages: [], permissions: [],
  attendance: [], leaves: [], salarySheets: [], paySlips: [],
  salaryGrades: [], salaryStatements: [], holidays: [], shifts: [],
})

function mkInvoice(id, number, date, contactId, contactName, items, paid) {
  const lines = items.map((it) => ({ ...it, discount: 0, discountType: '%', total: it.qty * it.rate }))
  const subTotal = lines.reduce((s, l) => s + l.total, 0)
  return {
    id, number, date, contactId, contactName, phone: '', address: '', items: lines,
    subTotal, vat: 0, discount: 0, laborCost: 0, invoiceAmount: subTotal,
    payments: [{ amount: paid, method: 'Cash', info: '', note: '' }],
    paid, due: subTotal - paid, delivered: true,
  }
}
