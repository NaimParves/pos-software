import { Link } from 'react-router-dom'
import { Database, Users, Mail } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { PageHeader, Card } from '../components/ui'
import { useDb, contactBalance } from '../store/db'
import { today } from '../utils/format'

const sum = (arr, k) => arr.reduce((a, x) => a + Number(x[k] || 0), 0)
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function monthly(docs) {
  const year = new Date().getFullYear()
  const map = {}
  docs.filter((d) => d.date?.startsWith(String(year))).forEach((d) => {
    const m = MONTHS[+d.date.slice(5, 7) - 1]
    map[m] = (map[m] || 0) + Number(d.invoiceAmount || 0)
  })
  return MONTHS.filter((m) => map[m]).map((m) => ({ month: m, amount: Math.round(map[m]) }))
}

function Stat({ value, label, color, icon: Icon, to }) {
  return (
    <Link to={to} className={`${color} rounded shadow-sm text-white flex items-center justify-between px-3 py-3 min-h-[82px] hover:opacity-95`}>
      <Icon size={52} strokeWidth={1.5} className="opacity-30" />
      <div className="text-right">
        <div className="text-2xl font-light">{Math.round(value).toLocaleString()}</div>
        <div className="italic text-[13px] mt-1">{label}</div>
      </div>
    </Link>
  )
}

export default function Dashboard() {
  const s = useDb()
  const t = today()
  const onDay = (arr) => arr.filter((x) => x.date === t)
  const customers = s.contacts.filter((c) => c.type === 'customer' || c.type === 'retailer')
  const suppliers = s.contacts.filter((c) => c.type === 'supplier')

  const G = 'bg-[#6cbb6a]', C = 'bg-[#2bc3d6]', R = 'bg-[#ef5350]', B = 'bg-[#0b7cff]'
  const stats = [
    { label: "Today's Sales", value: sum(onDay(s.sales), 'invoiceAmount'), color: G, icon: Database, to: '/invoices/all-sales' },
    { label: "Today's Sales Return", value: sum(onDay(s.salesReturns), 'invoiceAmount'), color: C, icon: Users, to: '/salesreturn' },
    { label: "Today's Purchase", value: sum(onDay(s.purchases), 'invoiceAmount'), color: G, icon: Database, to: '/bills/all-bills' },
    { label: "Today's Purchase Return", value: sum(onDay(s.purchaseReturns), 'invoiceAmount'), color: C, icon: Users, to: '/purchasereturn' },
    { label: "Today's Expense", value: sum(onDay(s.expenses), 'amount'), color: R, icon: Database, to: '/expenses' },
    { label: 'Customer Dues', value: customers.reduce((a, c) => a + Math.max(0, contactBalance(c, s)), 0), color: C, icon: Users, to: '/reports/due-customer' },
    { label: 'Supplier Dues', value: suppliers.reduce((a, c) => a + Math.max(0, contactBalance(c, s)), 0), color: C, icon: Users, to: '/reports/due-supplier' },
    { label: 'Masking SMS Balance', value: 0, color: B, icon: Mail, to: '/messages/send-index' },
    { label: 'Total Sales', value: sum(s.sales, 'invoiceAmount'), color: G, icon: Database, to: '/reports/sales-summary' },
    { label: 'Total Purchase', value: sum(s.purchases, 'invoiceAmount'), color: G, icon: Database, to: '/reports/purchase-summary' },
    { label: 'Total Customers', value: customers.length, color: R, icon: Database, to: '/contacts/customer' },
    { label: 'Total Suppliers', value: suppliers.length, color: R, icon: Database, to: '/contacts/supplier' },
  ]

  return (
    <>
      <PageHeader title="Dashboard" trail={['Dashboards', 'Dashboard']} />
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-x-7 gap-y-2.5 mb-6">
        {stats.map((x) => <Stat key={x.label} {...x} />)}
      </div>
      <div className="grid lg:grid-cols-2 gap-5">
        <ChartCard title="Sales Summary" data={monthly(s.sales)} color="#00c9c7" />
        <ChartCard title="Purchase Summary" data={monthly(s.purchases)} color="#556ee6" />
      </div>
    </>
  )
}

function ChartCard({ title, data, color }) {
  return (
    <Card title={title}>
      <div className="h-[300px]">
        {data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-gray-400">No data for this year yet</div>
        ) : (
          <ResponsiveContainer>
            <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="0" vertical={false} stroke="#eee" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => v.toLocaleString()} />
              <Tooltip formatter={(v) => v.toLocaleString()} />
              <Bar dataKey="amount" fill={color} maxBarSize={360} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  )
}
