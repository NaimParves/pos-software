import {
  Home, ShoppingBasket, Undo2, Briefcase, ClipboardList, PackageX, CircleDollarSign,
  Mail, CalendarCheck, Wallet, LayoutGrid, Wrench,
} from 'lucide-react'

// Sidebar navigation. Items with `children` are collapsible groups.
export const MENU = [
  { label: 'Dashboard', icon: Home, path: '/home' },
  {
    label: 'Sales', icon: ShoppingBasket, children: [
      { label: 'Daily Sales', path: '/invoices' },
      { label: 'List of Sales', path: '/invoices/all-sales' },
      { label: 'List of Challans', path: '/invoices/all-challan-list' },
      { label: 'Sales Return', path: '/salesreturn' },
    ],
  },
  {
    label: 'Direct Return', icon: Undo2, children: [
      { label: 'New Return', path: '/salesreturn/direct-return/create' },
      { label: 'List of Return', path: '/salesreturn/direct-return' },
    ],
  },
  {
    label: 'Purchase', icon: Briefcase, children: [
      { label: 'Purchase Item', path: '/bills' },
      { label: 'List of Purchase', path: '/bills/all-bills' },
      { label: 'Purchase Return', path: '/purchasereturn' },
    ],
  },
  {
    label: 'Purchase Orders', icon: ClipboardList, children: [
      { label: 'Create P/O', path: '/purchaseorders' },
      { label: 'List of P/O', path: '/purchaseorders/all-purchase-orders' },
    ],
  },
  {
    label: 'Damages', icon: PackageX, children: [
      { label: 'All Damages', path: '/damages' },
      { label: 'New Damage Entry', path: '/damages/create' },
    ],
  },
  {
    label: 'Accounts', icon: CircleDollarSign, children: [
      { label: 'Expenses', path: '/expenses' },
      { label: 'Incomes', path: '/incomes' },
      { label: 'Balance Transfer', path: '/balancetransfer' },
      { label: 'Receive From Customer', path: '/payments/receive' },
      { label: 'Pay To Supplier', path: '/payments/pay' },
      { label: 'Customer Settlement', path: '/settlements/customer' },
      { label: 'Supplier Settlement', path: '/settlements/supplier' },
    ],
  },
  {
    label: 'Messaging', icon: Mail, children: [
      { label: 'Send Message', path: '/messages/send-index' },
      { label: 'Due Customer', path: '/messages/due-customer' },
    ],
  },
  {
    label: 'Attendance', icon: CalendarCheck, children: [
      { label: 'Manual Attendance', path: '/attendance/manual-attendance' },
      { label: 'Add Leave Application', path: '/attendance/leave-application/create' },
      { label: 'Leave Application List', path: '/attendance/leave-application' },
    ],
  },
  {
    label: 'Payroll', icon: Wallet, children: [
      { label: 'List of Salary Sheet', path: '/payroll/process-monthly-salary' },
      { label: 'Process Salary Sheet', path: '/payroll/process-monthly-salary/create' },
      { label: 'Pay Slip', path: '/payroll/pay-slip' },
      { label: 'List of Pay Slip', path: '/payroll/pay-slip/all-pay-slips' },
    ],
  },
  {
    label: 'Reports', icon: LayoutGrid, children: [
      {
        label: 'Sales', children: [
          { label: 'Statement of Sales', path: '/reports/sales-statement' },
          { label: 'Sales Summary', path: '/reports/sales-summary' },
        ],
      },
      {
        label: 'Purchase', children: [
          { label: 'Statement of Pur.', path: '/reports/purchase-statement' },
          { label: 'Purchase Summary', path: '/reports/purchase-summary' },
        ],
      },
      {
        label: 'Accounts', children: [
          { label: 'List of Expense', path: '/reports/expense' },
          { label: 'List of Income', path: '/reports/income' },
          { label: 'Cash Book', path: '/reports/cash-book' },
          { label: 'Bank Book', path: '/reports/bank-book' },
        ],
      },
      {
        label: 'MIS', children: [
          { label: 'Daily Report', path: '/reports/daily-report' },
          { label: 'Current Balance', path: '/reports/current-balance' },
          { label: 'Stock Status', path: '/reports/stock' },
          { label: 'Stock Status Details', path: '/reports/stock-status-details' },
          { label: 'Product With Image', path: '/reports/stock-with-image' },
          { label: 'Customer Ledger', path: '/reports/due-customer' },
          { label: 'Supplier Ledger', path: '/reports/due-supplier' },
        ],
      },
      {
        label: 'Basic Report', children: [
          { label: 'List of Items', path: '/reports/item-list' },
          { label: 'Emergency Purchase', path: '/reports/emergency-item-list' },
          { label: 'Item Wise Supplier', path: '/reports/product-suppliers' },
          { label: 'Item Wise Customer', path: '/reports/product-customers' },
          { label: 'Buyer List', path: '/reports/register/customer' },
          { label: 'Retailer List', path: '/reports/register/retailer' },
          { label: 'Supplier List', path: '/reports/register/supplier' },
        ],
      },
    ],
  },
  {
    label: 'Basic Settings', icon: Wrench, children: [
      {
        label: 'Product', children: [
          { label: 'Add Product', path: '/products' },
          { label: 'Add Size', path: '/sizes' },
          { label: 'Add Categories', path: '/product-categories' },
          { label: 'Brand/Manufacturer', path: '/brands' },
          { label: 'Add Grades', path: '/grades' },
          { label: 'Add Unit Measure', path: '/units' },
          { label: 'Product Variations', path: '/products/variations' },
          { label: 'Print Barcode', path: '/products/barcode-print' },
          { label: 'Bulk Opening Stock', path: '/products/add-opening-stock' },
        ],
      },
      {
        label: 'Registers', children: [
          { label: 'Add Customer', path: '/contacts/customer' },
          { label: 'Add Retailer', path: '/contacts/retailer' },
          { label: 'Add Supplier', path: '/contacts/supplier' },
          { label: 'Add Employee', path: '/contacts/employee' },
          { label: 'Add Reference', path: '/contacts/reference' },
        ],
      },
      {
        label: 'Accounts', children: [
          { label: 'Chart of Accounts', path: '/accounts/chart-of-accounts' },
        ],
      },
      {
        label: 'Messaging', children: [
          { label: 'Create Text Message', path: '/messages' },
          { label: 'Phone Book', path: '/messages/phone-book' },
        ],
      },
      {
        label: 'Security System', children: [
          { label: 'Add Branch', path: '/branch' },
          { label: 'Add User', path: '/users' },
          { label: 'List of User', path: '/users/all-users' },
          { label: 'Set Permission', path: '/accesslevel/set-access' },
        ],
      },
      {
        label: 'Payroll Settings', children: [
          { label: 'List of Grades', path: '/payroll/salary-grades' },
          { label: 'List of Statements', path: '/payroll/salary-statements' },
          { label: 'List of Holidays', path: '/attendance/holiday-calender' },
          { label: 'List of Shift', path: '/attendance/shifts' },
        ],
      },
    ],
  },
]

// Flatten the tree to look up a page title from a path (used for breadcrumbs).
export function findMenuTrail(path, items = MENU, trail = []) {
  for (const item of items) {
    const next = [...trail, item.label]
    if (item.path === path) return next
    if (item.children) {
      const found = findMenuTrail(path, item.children, next)
      if (found) return found
    }
  }
  return null
}
