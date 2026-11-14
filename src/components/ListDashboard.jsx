import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CheckCircle2, Clock, FileText, Loader } from 'lucide-react'
import { deliveryState } from './Delivery'
import { displayDate, money, num, today } from '../utils/format'

// Summary cards (and a money chart) above List of Sales / Challans / Purchase /
// P/O. They count the rows the list is showing, so searching by date updates both.
const sum = (rows, f) => rows.reduce((a, r) => a + num(typeof f === 'function' ? f(r) : r[f]), 0)

function counts(kind, rows) {
  if (kind === 'sales' || kind === 'challan') {
    const st = rows.map(deliveryState)
    return [
      [kind === 'challan' ? 'Total Challan Generated' : 'Total Sales Generated', rows.length, 'primary', FileText],
      ['Delivered', st.filter((x) => x.all).length, 'success', CheckCircle2],
      [kind === 'challan' ? 'Partial Delivery' : 'Partial', st.filter((x) => x.done > 0 && !x.all).length, 'info', Loader],
      ['Pending', st.filter((x) => x.done === 0).length, 'warning', Clock],
    ]
  }
  if (kind === 'purchase') {
    return [
      ['Total Purchase Invoices', rows.length, 'primary', FileText],
      ['Fully Paid', rows.filter((d) => num(d.due) <= 0).length, 'success', CheckCircle2],
      ['Partly Paid', rows.filter((d) => num(d.paid) > 0 && num(d.due) > 0).length, 'info', Loader],
      ['Unpaid', rows.filter((d) => num(d.paid) <= 0 && num(d.due) > 0).length, 'warning', Clock],
    ]
  }
  const status = (d) => d.receiveStatus || (d.received ? 'Received' : 'Pending')
  return [
    ['Total Orders Submitted', rows.length, 'primary', FileText],
    ['Fully Received', rows.filter((d) => status(d) === 'Received').length, 'success', CheckCircle2],
    ['Partial Received', rows.filter((d) => status(d) === 'Partial').length, 'info', Loader],
    ['Pending', rows.filter((d) => status(d) === 'Pending').length, 'warning', Clock],
  ]
}

function amounts(kind, rows) {
  if (kind === 'sales') {
    return [['Total Receivable', sum(rows, 'invoiceAmount'), '#5b73e8'], ['Total Given', sum(rows, 'paid'), '#34c38f'], ['Total Due', sum(rows, 'due'), '#f46a6a']]
  }
  if (kind === 'purchase') {
    return [['Total Payable', sum(rows, 'invoiceAmount'), '#5b73e8'], ['Total Paid', sum(rows, 'paid'), '#34c38f'], ['Total Due', sum(rows, 'due'), '#f46a6a']]
  }
  if (kind === 'po') {
    const received = sum(rows, 'receivedAmount')
    const paid = sum(rows, 'receivedPaid')
    return [['Total Order Amount', sum(rows, 'invoiceAmount'), '#5b73e8'], ['Total Received Amount', received, '#50a5f1'], ['Total Paid', paid, '#34c38f'], ['Total Due', received - paid, '#f46a6a']]
  }
  return []
}

const TONE = {
  primary: 'bg-primary/10 text-primary', success: 'bg-success/10 text-success', info: 'bg-info/10 text-info', warning: 'bg-warning/15 text-[#b07d24]',
}

export default function ListDashboard({ kind, rows, from, to }) {
  const cards = counts(kind, rows)
  const money3 = amounts(kind, rows)
  const period = from && to && from === to ? (from === today() ? 'Today' : displayDate(from))
    : from || to ? `${displayDate(from) || '…'} to ${displayDate(to) || '…'}` : 'All dates'
  return (
    <div className="mb-6 print:hidden">
      <p className="text-[12px] font-semibold uppercase tracking-wide text-gray-500 mb-2">Summary · {period}</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(([label, value, tone, Icon]) => (
          <div key={label} className="bg-white rounded shadow-sm p-4 flex items-center justify-between">
            <div>
              <p className="text-[12px] text-gray-500">{label}</p>
              <p className="text-2xl font-semibold text-gray-700 mt-1">{value}</p>
            </div>
            <span className={`w-11 h-11 rounded-full flex items-center justify-center ${TONE[tone]}`}><Icon size={20} /></span>
          </div>
        ))}
      </div>
      {money3.length > 0 && (
        <div className="grid lg:grid-cols-[1fr_1.4fr] gap-4 mt-4">
          <div className="bg-white rounded shadow-sm p-4 space-y-3">
            {money3.map(([label, value, color]) => (
              <div key={label} className="flex items-center justify-between border-b last:border-0 pb-2 last:pb-0">
                <span className="flex items-center gap-2 text-[13px] text-gray-600"><span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />{label}</span>
                <span className="font-semibold text-gray-700">{money(value)}</span>
              </div>
            ))}
          </div>
          <div className="bg-white rounded shadow-sm p-4 h-[190px]" aria-label="Money chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={money3.map(([name, value, color]) => ({ name: name.replace('Total ', ''), value: Math.round(value), color }))} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} width={70} tickFormatter={(v) => v.toLocaleString('en-US')} />
                <Tooltip formatter={(v) => money(v)} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={60}>
                  {money3.map(([name, , color]) => <Cell key={name} fill={color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
