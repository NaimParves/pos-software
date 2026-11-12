import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import InvoiceForm from './pages/InvoiceForm'
import InvoiceList from './pages/InvoiceList'
import ReturnForm from './pages/ReturnForm'
import AccountsPayment from './pages/Accounts'
import Products from './pages/Products'
import Contacts from './pages/Contacts'
import CrudPage from './pages/CrudPage'
import * as R from './pages/Reports'
import { BarcodePrint, OpeningStock, SendMessage, DueCustomer, SetPermission, NotFound } from './pages/Misc'
import { CRUD_PAGES } from './config/crudPages'
import { useEffect } from 'react'
import { useUser } from './store/auth'
import { clearState, loadState, useLoadStatus } from './store/db'

// Signed in -> load the data from the server once, then show the app.
function RequireAuth({ children }) {
  const user = useUser()
  const loc = useLocation()
  const status = useLoadStatus()

  const needsLoad = !!user && !status.loaded && !status.loading && !status.error
  useEffect(() => { if (!user) clearState() }, [user])
  useEffect(() => { if (needsLoad) loadState() }, [needsLoad])

  if (!user) return <Navigate to="/login" state={{ from: loc }} replace />
  if (status.error) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-3 text-sm text-gray-600">
        <p>{status.error}</p>
        <button className="bg-primary text-white rounded px-4 py-2" onClick={() => loadState()}>Try again</button>
      </div>
    )
  }
  if (!status.loaded) return <div className="h-screen flex items-center justify-center text-sm text-gray-500">Loading…</div>
  return children
}

// `key` forces a fresh component when moving between pages that share a component
const page = (path, el) => <Route key={path} path={path} element={<KeyBy path={path}>{el}</KeyBy>} />
const KeyBy = ({ path, children }) => <div key={path}>{children}</div>

function ContactsRoute() {
  const { type } = useParams()
  return <Contacts key={type} />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<Navigate to="/home" replace />} />
        {page('/home', <Dashboard />)}

        {/* Sales */}
        {page('/invoices', <InvoiceForm mode="sale" />)}
        {page('/invoices/all-sales', <InvoiceList title="All Sales" collection="sales" stockSign={-1} delivery editPath="/invoices" returnPath="/salesreturn" returnLabel="Sales Return" />)}
        {page('/invoices/all-challan-list', <InvoiceList title="List of Challans" collection="sales" challan delivery />)}
        {page('/salesreturn', <ReturnForm mode="salesReturn" />)}
        {page('/salesreturn/direct-return/create', <ReturnForm mode="directReturn" />)}
        {page('/salesreturn/direct-return', <InvoiceList title="List of Return" collection="salesReturns" stockSign={1} editPath={(d) => (d.sourceId ? '/salesreturn' : '/salesreturn/direct-return/create')} />)}

        {/* Purchase */}
        {page('/bills', <InvoiceForm mode="purchase" />)}
        {page('/bills/all-bills', <InvoiceList title="All Purchase" collection="purchases" partyLabel="Supplier" partyTypes={['supplier']} stockSign={1} editPath="/bills" returnPath="/purchasereturn" returnLabel="Purchase Return" />)}
        {page('/purchasereturn', <ReturnForm mode="purchaseReturn" />)}
        {page('/purchaseorders', <InvoiceForm mode="purchaseOrder" />)}
        {page('/purchaseorders/all-purchase-orders', <InvoiceList title="List of P/O" collection="purchaseOrders" partyLabel="Supplier" partyTypes={['supplier']} editPath="/purchaseorders" receivePath="/bills" />)}

        {/* Damages */}
        {page('/damages', <InvoiceList title="All Damages" collection="damages" partyLabel="Note" partyTypes={[]} stockSign={-1} editPath="/damages/create" />)}
        {page('/damages/create', <InvoiceForm mode="damage" />)}

        {/* Products & registers */}
        {page('/products', <Products />)}
        {page('/products/barcode-print', <BarcodePrint />)}
        {page('/products/add-opening-stock', <OpeningStock />)}
        <Route path="/contacts/:type" element={<ContactsRoute />} />

        {/* Accounts: payments and settlements */}
        {page('/payments/receive', <AccountsPayment mode="receive" />)}
        {page('/payments/pay', <AccountsPayment mode="pay" />)}
        {page('/settlements/customer', <AccountsPayment mode="customerSettlement" />)}
        {page('/settlements/supplier', <AccountsPayment mode="supplierSettlement" />)}

        {/* Messaging & security */}
        {page('/messages/send-index', <SendMessage />)}
        {page('/messages/due-customer', <DueCustomer />)}
        {page('/accesslevel/set-access', <SetPermission />)}

        {/* Reports */}
        {page('/reports/sales-statement', <R.StatementReport collection="sales" title="Statement of Sales" />)}
        {page('/reports/sales-summary', <R.SummaryReport collection="sales" title="Sales Summary" />)}
        {page('/reports/purchase-statement', <R.StatementReport collection="purchases" title="Statement of Purchase" party="Supplier" />)}
        {page('/reports/purchase-summary', <R.SummaryReport collection="purchases" title="Purchase Summary" />)}
        {page('/reports/expense', <R.AccountListReport collection="expenses" title="List of Expense" />)}
        {page('/reports/income', <R.AccountListReport collection="incomes" title="List of Income" />)}
        {page('/reports/cash-book', <R.BookReport />)}
        {page('/reports/bank-book', <R.BookReport bank />)}
        {page('/reports/daily-report', <R.DailyReport />)}
        {page('/reports/current-balance', <R.CurrentBalance />)}
        {page('/reports/stock', <R.StockReport variant="status" />)}
        {page('/reports/stock-status-details', <R.StockReport variant="details" />)}
        {page('/reports/stock-with-image', <R.StockWithImage />)}
        {page('/reports/due-customer', <R.LedgerReport />)}
        {page('/reports/due-supplier', <R.LedgerReport supplier />)}
        {page('/reports/item-list', <R.StockReport variant="items" />)}
        {page('/reports/emergency-item-list', <R.StockReport variant="emergency" />)}
        {page('/reports/product-suppliers', <R.ItemWiseReport supplier />)}
        {page('/reports/product-customers', <R.ItemWiseReport />)}
        {page('/reports/register/customer', <R.RegisterList type="customer" />)}
        {page('/reports/register/retailer', <R.RegisterList type="retailer" />)}
        {page('/reports/register/supplier', <R.RegisterList type="supplier" />)}

        {/* Config-driven form + list pages */}
        {Object.entries(CRUD_PAGES).map(([path, config]) => page(path, <CrudPage config={config} />))}

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
