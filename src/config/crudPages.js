import { PAYMENT_METHODS } from './shop.js'
import { PAPER_SIZES } from './templates.js'

const status = { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive'], default: 'Active', placeholder: undefined }
const master = (title, collection, extra = []) => ({
  title, collection, listTitle: `All ${title.replace(/^Add /, '')}`,
  fields: [{ key: 'name', label: 'Name', required: true }, ...extra, status],
})
// Chart of Accounts: parent -> account types
export const ACCOUNT_TYPES = {
  Asset: ['Current Asset', 'Non-Current Asset', 'Fixed Asset', 'Cash & Cash Equivalent'],
  Liability: ['Current Liability', 'Non-Current Liability', "Owner's Equity"],
  Income: ['General Income', 'Sales Related Income', 'Others Income'],
  Expense: ['General Expense', 'Purchase Related Expense', 'Others Expense'],
}
const ACCOUNT_PARENT = Object.fromEntries(Object.entries(ACCOUNT_TYPES).flatMap(([parent, subs]) => subs.map((x) => [x, parent])))
const ACCOUNT_TYPE_OPTIONS = Object.entries(ACCOUNT_TYPES).flatMap(([parent, subs]) => subs.map((x) => ({ value: x, label: `${parent} › ${x}` })))
const activeHead = (type) => (a) => a.type === type && a.status !== 'Inactive'

const method = { key: 'method', label: 'Paid Through', type: 'select', options: PAYMENT_METHODS, required: true }
const employee = { key: 'employeeId', label: 'Employee', type: 'combo', required: true, from: { collection: 'contacts', filter: (c) => c.type === 'employee', value: 'id', label: 'name' }, hideInList: true }
const empName = (r, s) => ({ ...r, employeeName: s.contacts.find((c) => c.id === r.employeeId)?.name || '' })

// path -> page config
export const CRUD_PAGES = {
  '/sizes': master('Add Size', 'sizes'),
  '/product-categories': master('Add Categories', 'categories'),
  '/brands': master('Brand/Manufacturer', 'brands', [{ key: 'country', label: 'Country' }]),
  '/grades': master('Add Grades', 'grades'),
  '/units': master('Add Unit Measure', 'units', [{ key: 'short', label: 'Short Name' }]),
  '/products/variations': master('Product Variations', 'variations', [{ key: 'values', label: 'Values (comma separated)', span: 2 }]),

  '/expenses': {
    title: 'Expenses', collection: 'expenses', number: 'EXP', dateKey: 'date', listTitle: 'Expense List',
    fields: [
      { key: 'date', label: 'Expense Date', type: 'date', default: 'today', required: true },
      { key: 'contact', label: 'Paid/Expense To', type: 'combo', from: { collection: 'contacts' } },
      { key: 'head', label: 'Account Head', type: 'combo', required: true, from: { collection: 'accountHeads', filter: activeHead('Expense') } },
      { key: 'amount', label: 'Amount', type: 'number', required: true, money: true },
      { ...method, default: 'Cash' },
      { key: 'info', label: 'Account Information' },
      { key: 'note', label: 'Note' },
    ],
  },
  '/incomes': {
    title: 'Incomes', collection: 'incomes', number: 'INC', dateKey: 'date', listTitle: 'Income List',
    fields: [
      { key: 'date', label: 'Income Date', type: 'date', default: 'today', required: true },
      { key: 'contact', label: 'Received From', type: 'combo', from: { collection: 'contacts' } },
      { key: 'head', label: 'Account Head', type: 'combo', required: true, from: { collection: 'accountHeads', filter: activeHead('Income') } },
      { key: 'amount', label: 'Amount', type: 'number', required: true, money: true },
      { ...method, label: 'Received Through', default: 'Cash' },
      { key: 'info', label: 'Account Information' },
      { key: 'note', label: 'Note' },
    ],
  },
  '/balancetransfer': {
    title: 'Balance Transfer', collection: 'transfers', number: 'BT', dateKey: 'date',
    fields: [
      { key: 'date', label: 'Date', type: 'date', default: 'today', required: true },
      { key: 'fromAcc', label: 'From Account', type: 'select', options: PAYMENT_METHODS, required: true },
      { key: 'toAcc', label: 'To Account', type: 'select', options: PAYMENT_METHODS, required: true },
      { key: 'amount', label: 'Amount', type: 'number', required: true, money: true },
      { key: 'note', label: 'Note', span: 2 },
    ],
  },
  '/accounts/chart-of-accounts': {
    title: 'Chart of Accounts', collection: 'accountHeads', listTitle: 'All Chart of Account',
    help: 'Pick the account type; its parent (Asset, Liability, Income or Expense) is set from it. Expense and Income heads show up on the Expenses and Incomes pages; inactive heads are hidden there.',
    fields: [
      { key: 'name', label: 'Account Name', required: true, placeholder: 'Enter Account Name' },
      { key: 'description', label: 'Description', placeholder: 'Enter Description' },
      { key: 'subType', label: 'Account Type', type: 'select', required: true, placeholder: '--Select Account Type--', options: ACCOUNT_TYPE_OPTIONS },
      status,
    ],
    transform: (r) => ({ ...r, type: ACCOUNT_PARENT[r.subType] || r.type }),
    columns: [
      { key: 'name', label: 'Account Name' },
      { key: 'type', label: 'Parent Account', render: (r) => ({ Asset: 'Assets', Liability: 'Liability', Income: 'Income', Expense: 'Expense' }[r.type] || r.type || '') },
      { key: 'subType', label: 'Account Type' },
      { key: 'description', label: 'Description' },
      { key: 'status', label: 'Status', render: (r) => r.status || 'Active' },
    ],
  },

  '/messages': {
    title: 'Create Text Message', collection: 'messages', listTitle: 'Message Templates',
    fields: [{ key: 'title', label: 'Title', required: true }, { key: 'body', label: 'Message', type: 'textarea', required: true, span: 4 }],
    columns: [{ key: 'title', label: 'Title' }, { key: 'body', label: 'Message' }],
  },
  '/messages/phone-book': {
    title: 'Phone Book', collection: 'phoneBook',
    fields: [{ key: 'name', label: 'Name', required: true }, { key: 'phone', label: 'Phone', required: true }, { key: 'group', label: 'Group' }],
  },

  '/branch': {
    title: 'Add Branch', collection: 'branches', listTitle: 'All Branches',
    help: 'Once Organization Name is filled in, the branch details (organization name, address, contact number, email, website and logo) are printed at the top of every report and document (Template Settings › Global Report Header can override them). Labour Cost/Cartoon is used for "Auto Labor Cost" on sales; Printer Type sets the paper size for printing.',
    fields: [
      { key: 'name', label: 'Branch Name', required: true },
      { key: 'organization', label: 'Organization Name' },
      { key: 'address', label: 'Address', span: 2 },
      { key: 'phone', label: 'Contact Number' },
      { key: 'email', label: 'Email' },
      { key: 'website', label: 'Website' },
      { key: 'paperSize', label: 'Printer Type', type: 'select', options: PAPER_SIZES.map(({ value, label }) => ({ value, label })), default: 'A4', placeholder: undefined },
      { key: 'laborPerCarton', label: 'Labour Cost/Cartoon', type: 'number', default: 10 },
      { key: 'logo', label: 'Logo', type: 'image', hideInList: true },
    ],
    columns: [
      { key: 'name', label: 'Branch Name' }, { key: 'address', label: 'Address' }, { key: 'phone', label: 'Contact Number' },
      { key: 'logo', label: 'Logo', type: 'image' },
    ],
  },
  '/users': {
    title: 'Add User', collection: 'users', listTitle: 'Users',
    help: 'Users sign in with their phone number and password. Leave the password empty when editing to keep the current one. Inactive users cannot sign in.',
    fields: [
      { key: 'name', label: 'Full Name', required: true },
      { key: 'phone', label: 'Phone (login)', required: true },
      { key: 'password', label: 'Password', type: 'password', requiredOnCreate: true, hideInList: true, placeholder: 'Password' },
      { key: 'role', label: 'Role', type: 'select', options: ['Super Admin', 'Admin', 'Manager', 'Salesman'], required: true },
      { key: 'branch', label: 'Branch', type: 'select', from: { collection: 'branches' } },
      status,
    ],
  },
  '/users/all-users': {
    title: 'List of User', collection: 'users', listOnly: true, listTitle: 'All Users',
    fields: [{ key: 'name', label: 'Name' }, { key: 'phone', label: 'Phone' }, { key: 'role', label: 'Role' }, { key: 'branch', label: 'Branch' }, { key: 'status', label: 'Status' }],
  },

  '/attendance/leave-application/create': {
    title: 'Add Leave Application', collection: 'leaves', formOnly: true, transform: empName, defaults: { approval: 'Pending' },
    fields: [
      employee,
      { key: 'leaveType', label: 'Leave Type', type: 'select', options: ['Casual', 'Sick', 'Annual', 'Unpaid'], required: true },
      { key: 'from', label: 'From', type: 'date', required: true }, { key: 'to', label: 'To', type: 'date', required: true },
      { key: 'reason', label: 'Reason', type: 'textarea', span: 4 },
    ],
  },
  '/attendance/leave-application': {
    title: 'Leave Application List', collection: 'leaves', listOnly: true,
    fields: [{ key: 'employeeName', label: 'Employee' }, { key: 'leaveType', label: 'Type' }, { key: 'from', label: 'From', type: 'date' }, { key: 'to', label: 'To', type: 'date' }, { key: 'approval', label: 'Approval' }],
  },
  '/attendance/holiday-calender': {
    title: 'Holiday Calendar', collection: 'holidays',
    fields: [{ key: 'name', label: 'Holiday', required: true }, { key: 'from', label: 'From', type: 'date', required: true }, { key: 'to', label: 'To', type: 'date' }],
  },
  '/attendance/shifts': {
    title: 'Shift', collection: 'shifts',
    fields: [{ key: 'name', label: 'Shift Name', required: true }, { key: 'start', label: 'Start', type: 'time', required: true }, { key: 'end', label: 'End', type: 'time', required: true }],
  },

  '/payroll/salary-grades': {
    title: 'Salary Grades', collection: 'salaryGrades',
    fields: [{ key: 'name', label: 'Grade', required: true }, { key: 'basic', label: 'Basic', type: 'number', money: true }, { key: 'house', label: 'House Rent', type: 'number', money: true }, { key: 'medical', label: 'Medical', type: 'number', money: true }],
  },
  '/payroll/salary-statements': {
    title: 'Salary Statements', collection: 'salaryStatements', transform: empName,
    columns: [{ key: 'employeeName', label: 'Employee' }, { key: 'grade', label: 'Grade' }, { key: 'gross', label: 'Gross', type: 'number', money: true }],
    fields: [employee, { key: 'grade', label: 'Grade', type: 'select', from: { collection: 'salaryGrades' } }, { key: 'gross', label: 'Gross Salary', type: 'number', required: true }],
  },
}
