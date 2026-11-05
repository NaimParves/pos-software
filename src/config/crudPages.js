import { PAYMENT_METHODS } from './shop'

const status = { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive'], default: 'Active', placeholder: undefined }
const master = (title, collection, extra = []) => ({
  title, collection, listTitle: `All ${title.replace(/^Add /, '')}`,
  fields: [{ key: 'name', label: 'Name', required: true }, ...extra, status],
})
const contactSel = (types, label = 'Contact', key = 'contactId') => ({
  key, label, type: 'combo', required: true,
  from: { collection: 'contacts', filter: (c) => types.includes(c.type), value: 'id', label: (c) => `${c.name} - ${c.phone}` },
  render: undefined,
})
const contactName = (key = 'contactId') => (r, s) => ({ ...r, contactName: s.contacts.find((c) => c.id === r[key])?.name || '' })
const method = { key: 'method', label: 'Paid Through', type: 'select', options: PAYMENT_METHODS, required: true }
const employee = { key: 'employeeId', label: 'Employee', type: 'combo', required: true, from: { collection: 'contacts', filter: (c) => c.type === 'employee', value: 'id', label: 'name' }, hideInList: true }
const empName = (r, s) => ({ ...r, employeeName: s.contacts.find((c) => c.id === r.employeeId)?.name || '' })
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

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
      { key: 'head', label: 'Account Head', type: 'combo', required: true, from: { collection: 'accountHeads', filter: (a) => a.type === 'Expense' } },
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
      { key: 'head', label: 'Account Head', type: 'combo', required: true, from: { collection: 'accountHeads', filter: (a) => a.type === 'Income' } },
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
  '/payments/receive': {
    title: 'Receive From Customer', collection: 'payments', number: 'RCV', dateKey: 'date', defaults: { type: 'receive' }, filter: (p) => p.type === 'receive',
    transform: contactName(),
    columns: [{ key: 'date', label: 'Date', type: 'date' }, { key: 'contactName', label: 'Customer' }, { key: 'method', label: 'Through' }, { key: 'amount', label: 'Amount', type: 'number', money: true }, { key: 'note', label: 'Note' }],
    fields: [
      { key: 'date', label: 'Date', type: 'date', default: 'today', required: true },
      contactSel(['customer', 'retailer'], 'Customer'),
      { key: 'amount', label: 'Amount', type: 'number', required: true },
      { ...method, label: 'Received Through', default: 'Cash' },
      { key: 'info', label: 'Account Information' },
      { key: 'note', label: 'Note' },
    ],
  },
  '/payments/pay': {
    title: 'Pay To Supplier', collection: 'payments', number: 'PAY', dateKey: 'date', defaults: { type: 'pay' }, filter: (p) => p.type === 'pay',
    transform: contactName(),
    columns: [{ key: 'date', label: 'Date', type: 'date' }, { key: 'contactName', label: 'Supplier' }, { key: 'method', label: 'Through' }, { key: 'amount', label: 'Amount', type: 'number', money: true }, { key: 'note', label: 'Note' }],
    fields: [
      { key: 'date', label: 'Date', type: 'date', default: 'today', required: true },
      contactSel(['supplier'], 'Supplier'),
      { key: 'amount', label: 'Amount', type: 'number', required: true },
      { ...method, default: 'Cash' },
      { key: 'info', label: 'Account Information' },
      { key: 'note', label: 'Note' },
    ],
  },
  '/settlements/customer': {
    title: 'Customer Settlement', collection: 'settlements', number: 'CS', dateKey: 'date', defaults: { kind: 'customer' }, filter: (p) => p.kind === 'customer',
    transform: contactName(), help: 'A settlement writes off (discounts) part of a customer\'s due without receiving cash.',
    columns: [{ key: 'date', label: 'Date', type: 'date' }, { key: 'contactName', label: 'Customer' }, { key: 'amount', label: 'Amount', type: 'number', money: true }, { key: 'note', label: 'Note' }],
    fields: [
      { key: 'date', label: 'Date', type: 'date', default: 'today', required: true },
      contactSel(['customer', 'retailer'], 'Customer'),
      { key: 'amount', label: 'Settlement Amount', type: 'number', required: true },
      { key: 'note', label: 'Note' },
    ],
  },
  '/settlements/supplier': {
    title: 'Supplier Settlement', collection: 'settlements', number: 'SS', dateKey: 'date', defaults: { kind: 'supplier' }, filter: (p) => p.kind === 'supplier',
    transform: contactName(),
    columns: [{ key: 'date', label: 'Date', type: 'date' }, { key: 'contactName', label: 'Supplier' }, { key: 'amount', label: 'Amount', type: 'number', money: true }, { key: 'note', label: 'Note' }],
    fields: [
      { key: 'date', label: 'Date', type: 'date', default: 'today', required: true },
      contactSel(['supplier'], 'Supplier'),
      { key: 'amount', label: 'Settlement Amount', type: 'number', required: true },
      { key: 'note', label: 'Note' },
    ],
  },
  '/accounts/chart-of-accounts': {
    title: 'Chart of Accounts', collection: 'accountHeads', listTitle: 'Account Heads',
    fields: [{ key: 'name', label: 'Account Head', required: true }, { key: 'type', label: 'Type', type: 'select', options: ['Expense', 'Income', 'Asset', 'Liability'], required: true }],
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
    fields: [{ key: 'name', label: 'Branch Name', required: true }, { key: 'address', label: 'Address' }, { key: 'phone', label: 'Phone' }],
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

  '/attendance/manual-attendance': {
    title: 'Manual Attendance', collection: 'attendance', dateKey: 'date', transform: empName,
    columns: [{ key: 'date', label: 'Date', type: 'date' }, { key: 'employeeName', label: 'Employee' }, { key: 'status', label: 'Status' }, { key: 'inTime', label: 'In' }, { key: 'outTime', label: 'Out' }],
    fields: [
      { key: 'date', label: 'Date', type: 'date', default: 'today', required: true }, employee,
      { key: 'status', label: 'Status', type: 'select', options: ['Present', 'Absent', 'Late', 'Leave'], default: 'Present', required: true },
      { key: 'inTime', label: 'In Time', type: 'time' }, { key: 'outTime', label: 'Out Time', type: 'time' },
    ],
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
  '/payroll/process-monthly-salary': {
    title: 'List of Salary Sheet', collection: 'salarySheets', listOnly: true,
    fields: [{ key: 'month', label: 'Month' }, { key: 'year', label: 'Year' }, { key: 'employeeName', label: 'Employee' }, { key: 'amount', label: 'Net Salary', type: 'number', money: true }],
  },
  '/payroll/process-monthly-salary/create': {
    title: 'Process Salary Sheet', collection: 'salarySheets', formOnly: true,
    transform: (r, s) => { const e = s.contacts.find((c) => c.id === r.employeeId); return { ...r, employeeName: e?.name, amount: r.amount || e?.salary || 0 } },
    help: 'Leave Net Salary empty to use the salary saved on the employee.',
    fields: [
      employee, { key: 'month', label: 'Month', type: 'select', options: MONTHS, required: true, default: MONTHS[new Date().getMonth()] },
      { key: 'year', label: 'Year', type: 'number', default: new Date().getFullYear(), required: true },
      { key: 'amount', label: 'Net Salary', type: 'number' },
    ],
  },
  '/payroll/pay-slip': {
    title: 'Pay Slip', collection: 'paySlips', formOnly: true, number: 'SLIP', transform: empName,
    fields: [
      { key: 'date', label: 'Date', type: 'date', default: 'today', required: true }, employee,
      { key: 'month', label: 'Month', type: 'select', options: MONTHS, required: true },
      { key: 'amount', label: 'Paid Amount', type: 'number', required: true }, { ...method, default: 'Cash' },
    ],
  },
  '/payroll/pay-slip/all-pay-slips': {
    title: 'List of Pay Slip', collection: 'paySlips', listOnly: true, number: 'SLIP',
    fields: [{ key: 'date', label: 'Date', type: 'date' }, { key: 'employeeName', label: 'Employee' }, { key: 'month', label: 'Month' }, { key: 'amount', label: 'Amount', type: 'number', money: true }, { key: 'method', label: 'Through' }],
  },
}
