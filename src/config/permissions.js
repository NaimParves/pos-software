import { CRUD_PAGES } from './crudPages.js'

// Edit / Delete permission per role, set on Basic Settings > Security System >
// Set Permission. Used by the pages (to show or hide the buttons) and by the
// server (to refuse the change), so it must stay plain JavaScript.

// Roles that can be configured. Super Admin can always do everything.
export const PERMISSION_ROLES = ['Admin', 'Manager', 'Salesman']

const CONTACT_PAGES = [
  ['customer', 'Add Customer'], ['retailer', 'Add Retailer'], ['supplier', 'Add Supplier'],
  ['employee', 'Add Employee'], ['reference', 'Add Reference'],
]
// Users and branches are admin-only anyway, so they are not listed here.
const ADMIN_ONLY = ['users', 'branches', 'permissions']

// Every page whose list has Edit and/or Delete buttons, and the records it changes.
// match(record) narrows a shared collection to the records that page shows.
export const ACTION_PAGES = [
  { group: 'Sales', path: '/invoices/all-sales', label: 'List of Sales', collection: 'sales' },
  { group: 'Sales', path: '/invoices/all-challan-list', label: 'List of Challans', collection: 'sales', noEdit: true },
  { group: 'Direct Return', path: '/salesreturn/direct-return', label: 'List of Return', collection: 'salesReturns' },
  { group: 'Purchase', path: '/bills/all-bills', label: 'List of Purchase', collection: 'purchases' },
  { group: 'Purchase Orders', path: '/purchaseorders/all-purchase-orders', label: 'List of P/O', collection: 'purchaseOrders' },
  { group: 'Damages', path: '/damages', label: 'All Damages', collection: 'damages' },
  { group: 'Product', path: '/products', label: 'Add Product', collection: 'products' },
  { group: 'Product', path: '/products/add-opening-stock', label: 'Bulk Opening Stock', collection: 'products', noDelete: true },
  { group: 'Accounts', path: '/payments/receive', label: 'Receive From Customer', collection: 'payments', match: (r) => r.type === 'receive' },
  { group: 'Accounts', path: '/payments/pay', label: 'Pay To Supplier', collection: 'payments', match: (r) => r.type === 'pay' },
  { group: 'Accounts', path: '/settlements/customer', label: 'Customer Settlement', collection: 'settlements', match: (r) => r.kind === 'customer' },
  { group: 'Accounts', path: '/settlements/supplier', label: 'Supplier Settlement', collection: 'settlements', match: (r) => r.kind === 'supplier' },
  ...CONTACT_PAGES.map(([type, label]) => ({
    group: 'Registers', path: `/contacts/${type}`, label, collection: 'contacts', match: (r) => r.type === type,
  })),
  ...Object.entries(CRUD_PAGES)
    .filter(([, c]) => !c.formOnly && !c.listOnly && !ADMIN_ONLY.includes(c.collection))
    .map(([path, c]) => ({ group: 'Other pages', path, label: c.title, collection: c.collection, match: c.filter, noEdit: !!c.noEdit })),
]

const key = (role, action, path) => `${role}:${action}:${path}`

// action: 'edit' | 'delete'. A box nobody has ticked or unticked yet
// counts as allowed for Admin and not allowed for the other roles.
export function can(map, role, action, path) {
  if (role === 'Super Admin') return true
  const page = ACTION_PAGES.find((p) => p.path === path)
  if (page && ((action === 'edit' && page.noEdit) || (action === 'delete' && page.noDelete))) return false
  const v = map?.[key(role, action, path)]
  return v === undefined ? role === 'Admin' : !!v
}

export const permissionKey = key

// Server side: may this role edit/delete this record of this collection?
// Allowed when at least one page that shows the record allows it.
export function canChangeRecord(map, role, action, collection, record) {
  if (role === 'Super Admin') return true
  const pages = ACTION_PAGES.filter((p) => p.collection === collection && (!p.match || !record || p.match(record)))
  if (!pages.length) return true // not controlled from Set Permission
  return pages.some((p) => can(map, role, action, p.path))
}

// Delivery ticks are not an edit of the invoice: anyone may change them.
export const DELIVERY_FIELDS = ['delivered', 'deliveredLines']
