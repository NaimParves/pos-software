import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, Printer, Trash2, Search, Truck, Pencil, Undo2, PackageCheck, ShoppingCart, FileCheck } from 'lucide-react'
import { PageHeader, Card, Field, Input, Select, Button, Modal, Badge } from '../components/ui'
import DataTable from '../components/DataTable'
import InvoicePrint from '../components/InvoicePrint'
import ListDashboard from '../components/ListDashboard'
import { templateKindOf } from '../config/templates'
import { DeliveryButton } from '../components/Delivery'
import { db, useCollection } from '../store/db'
import { useCan } from '../store/permissions'
import { displayDate, inRange, money, num, round2, today } from '../utils/format'

const monthStart = () => today().slice(0, 8) + '01'

// stockSign: how the document moved stock when saved (deleting reverses it)
// editPath: string or (doc) => string. returnPath: the action column shows a
// Return button (to that return page) instead of View. receivePath: P/O list,
// Order Receive opens a receive screen, then the purchase page with the
// ticked lines. convertPath: quotation list, "Convert To Sale".
// dashboard: 'sales' | 'challan' | 'purchase' | 'po' shows summary cards above
// the list for the searched dates. range: 'today' | 'month' | '' (all) on open.
export default function InvoiceList({
  title, collection, partyLabel = 'Customer', partyTypes = ['customer', 'retailer'], stockSign = 0, challan = false, delivery = false,
  editPath = '', returnPath = '', returnLabel = 'Return', receivePath = '', convertPath = '', dashboard = '', range = '',
  showContact = false, challanCol = false, sourceCol = false, amountOnly = false,
}) {
  const nav = useNavigate()
  const allow = useCan()
  const docTitle = { sales: 'Invoice', salesReturns: 'Return', purchases: 'Purchase', purchaseOrders: 'Purchase Order', damages: 'Damage', quotations: 'Quotation' }[collection] || 'Invoice'
  const docs = useCollection(collection)
  const contacts = useCollection('contacts').filter((c) => partyTypes.includes(c.type))
  const start = range === 'today' ? { from: today(), to: today() } : range === 'month' ? { from: monthStart(), to: today() } : { from: '', to: '' }
  const [f, setF] = useState({ ...start, type: '', memo: '', walkName: '', walkPhone: '', status: '', contactId: '' })
  const [applied, setApplied] = useState(f)
  const [view, setView] = useState(null)
  const [receive, setReceive] = useState(null)

  const rows = docs
    .filter((d) => inRange(d.date, applied.from, applied.to))
    .filter((d) => !applied.memo || [d.number, d.challanNo].some((x) => String(x || '').toLowerCase().includes(applied.memo.toLowerCase())))
    .filter((d) => !applied.contactId || d.contactId === applied.contactId)
    .filter((d) => !applied.type || (applied.type === 'walkin' ? !d.contactId : !!d.contactId))
    .filter((d) => !applied.walkName || (d.contactName || '').toLowerCase().includes(applied.walkName.toLowerCase()))
    .filter((d) => !applied.walkPhone || (d.phone || '').includes(applied.walkPhone))
    .filter((d) => !applied.status || (applied.status === 'paid' ? d.due <= 0 : d.due > 0))
    .slice().reverse()

  const remove = (d) => {
    if (!confirm(`Delete ${d.number}?${stockSign ? ' Stock will be adjusted back.' : ''}`)) return
    db.removeDocument(collection, d.id) // the server reverses the stock change
  }

  const moneyCol = (key, label) => ({ key, label, align: 'right', render: (d) => money(d[key]), total: true })
  const columns = [
    { key: 'sl', label: 'SL', render: (_, i) => i + 1, sortable: false },
    ...(delivery ? [{
      key: 'delivered', label: 'Delivery Confirm', sortable: false, render: (d) => <DeliveryButton doc={d} collection={collection} />,
    }] : []),
    { key: 'date', label: 'Date', render: (d) => displayDate(d.date) },
    {
      key: 'number', label: `${collection === 'salesReturns' ? 'Return' : collection === 'quotations' ? 'Quotation' : 'Invoice'}#`,
      render: (d) => <button className="text-primary hover:underline" title="View" onClick={() => setView({ doc: d, challan })}>{d.number}</button>,
    },
    ...(sourceCol ? [{ key: 'sourceNumber', label: 'Invoice#' }] : []),
    ...(challanCol ? [{ key: 'challanNo', label: 'Challan No' }] : []),
    { key: 'contactName', label: partyLabel },
    ...(showContact ? [{ key: 'phone', label: 'Phone' }, { key: 'address', label: 'Address' }] : []),
    ...(challan ? [{ key: 'items', label: 'Items', render: (d) => d.items.length, sortable: false }]
      : amountOnly ? [moneyCol('invoiceAmount', collection === 'salesReturns' ? 'Return Amount' : 'Amount')]
        : [moneyCol('invoiceAmount', 'Total Payable'), moneyCol('paid', 'Given'), moneyCol('due', 'Due')]),
    ...(receivePath ? [{ key: 'receiveStatus', label: 'Status', sortable: false, render: (d) => <ReceiveBadge po={d} /> }] : []),
    ...(convertPath ? [{
      key: 'converted', label: 'Status', sortable: false,
      render: (d) => (d.converted ? <Badge>Sold {d.convertedSaleNumber}</Badge> : <Badge color="warning">Open</Badge>),
    }] : []),
    {
      key: 'action', label: 'Action', render: (d) => (
        <div className="flex gap-1">
          {returnPath
            ? <Button color="info" className="!px-2 !py-1" title={returnLabel} onClick={() => nav(`${returnPath}?source=${d.id}`)}><Undo2 size={14} /> <span className="text-[12px]">{returnLabel}</span></Button>
            : <Button color="info" className="!px-2 !py-1" title="View" onClick={() => setView({ doc: d, challan })}><Eye size={14} /></Button>}
          {receivePath ? (
            <Button color="success" className="!px-2 !py-1" title={d.receiveStatus === 'Received' ? `Received as ${d.receivedPurchaseNumber}` : 'Order Receive'}
              disabled={d.receiveStatus === 'Received'} onClick={() => setReceive(d)}>
              <PackageCheck size={14} /> <span className="text-[12px]">Order Receive</span>
            </Button>
          ) : convertPath ? (
            <Button color="success" className="!px-2 !py-1" title={d.converted ? `Converted to ${d.convertedSaleNumber}` : 'Convert To Sale'}
              disabled={!!d.converted} onClick={() => nav(`${convertPath}?fromQuote=${d.id}`)}>
              <ShoppingCart size={14} /> <span className="text-[12px]">Convert To Sale</span>
            </Button>
          ) : (
            <Button color="success" className="!px-2 !py-1" title={challan ? 'Print challan' : 'Print invoice'} onClick={() => setView({ doc: d, challan })}><Printer size={14} /></Button>
          )}
          {!challan && collection === 'sales' && (
            <Button color="warning" className="!px-2 !py-1" title="Print challan" onClick={() => setView({ doc: d, challan: true })}><Truck size={14} /></Button>
          )}
          {editPath && allow.edit && (
            <Button color="primary" className="!px-2 !py-1" title="Edit" onClick={() => nav(`${typeof editPath === 'function' ? editPath(d) : editPath}?edit=${d.id}`)}><Pencil size={14} /></Button>
          )}
          {allow.delete && <Button color="danger" className="!px-2 !py-1" title="Delete" onClick={() => remove(d)}><Trash2 size={14} /></Button>}
        </div>
      ),
    },
  ]

  // footer: "Total" before the first money column, totals under each money column
  const firstMoney = columns.findIndex((c) => c.total)
  const footer = firstMoney > 0 && rows.length > 0 && (
    <tr className="border-t">
      <td colSpan={firstMoney} className="px-3 py-2 text-right">Total</td>
      {columns.slice(firstMoney).map((c) => (
        <td key={c.key} className="px-3 py-2 text-right">{c.total ? money(rows.reduce((a, d) => a + num(d[c.key]), 0)) : ''}</td>
      ))}
    </tr>
  )

  return (
    <>
      <PageHeader title={title} />
      {dashboard && <ListDashboard kind={dashboard} rows={rows} from={applied.from} to={applied.to} />}
      <Card>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Field label="From Date"><Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
          <Field label="To Date"><Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
          <Field label={`${partyLabel} Type`}><Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} placeholder="All" options={[{ value: 'walkin', label: 'Walk-In' }, { value: 'registered', label: 'Registered' }]} /></Field>
          <Field label={challanCol ? 'Memo / Challan Number' : 'Memo Number'}><Input value={f.memo} onChange={(e) => setF({ ...f, memo: e.target.value })} /></Field>
          <Field label={`Walk-In ${partyLabel} Name`}><Input value={f.walkName} onChange={(e) => setF({ ...f, walkName: e.target.value })} /></Field>
          <Field label={`Walk-In ${partyLabel} Phone`}><Input value={f.walkPhone} onChange={(e) => setF({ ...f, walkPhone: e.target.value })} /></Field>
          <Field label="Status"><Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} placeholder="All" options={[{ value: 'paid', label: 'Paid' }, { value: 'due', label: 'Due' }]} /></Field>
          <div className="flex items-end gap-1">
            <Field label={`Registered ${partyLabel}`} className="flex-1">
              <Select value={f.contactId} onChange={(e) => setF({ ...f, contactId: e.target.value })} placeholder="All" options={contacts.map((c) => ({ value: c.id, label: c.name }))} />
            </Field>
            <Button className="!px-6 !py-2" title="Search" onClick={() => setApplied(f)}><Search size={15} /></Button>
          </div>
        </div>
        {range && (
          <p className="text-[12px] text-gray-500 -mt-3 mb-3">
            Showing {applied.from || applied.to ? `${displayDate(applied.from) || '…'} to ${displayDate(applied.to) || '…'}` : 'all dates'}.
            {(applied.from || applied.to) && <button className="text-primary ml-1" onClick={() => { const all = { ...f, from: '', to: '' }; setF(all); setApplied(all) }}>Show all dates</button>}
          </p>
        )}
        <DataTable columns={columns} rows={rows} footer={footer} />
      </Card>
      <Modal open={!!view} onClose={() => setView(null)} title={view && `${view.challan ? 'Challan' : docTitle} ${view.doc.number}`} wide>
        {view && <InvoicePrint doc={view.doc} challan={view.challan} kind={templateKindOf(collection, view.doc)} title={docTitle} />}
      </Modal>
      <Modal open={!!receive} onClose={() => setReceive(null)} title={receive && `Order Receive — ${receive.number}`} wide>
        {receive && <ReceiveScreen po={receive} onCancel={() => setReceive(null)} onConfirm={(poLines) => nav(`${receivePath}?fromPO=${receive.id}`, { state: { poLines } })} />}
      </Modal>
    </>
  )
}

// Received / Partial / Pending, styled like the Delivery Confirm column
function ReceiveBadge({ po }) {
  const status = po.receiveStatus || (po.received ? 'Received' : 'Pending')
  if (status === 'Received') return <Badge>Received {po.receivedPurchaseNumber}</Badge>
  if (status === 'Pending') return <Badge color="warning">Pending</Badge>
  const ordered = po.items.reduce((a, it) => a + num(it.qty), 0)
  const got = (po.receivedQty || []).reduce((a, q) => a + num(q), 0)
  const pct = ordered ? Math.min(100, Math.round((got * 100) / ordered)) : 0
  return (
    <span className="inline-flex flex-col gap-0.5 w-28" title={`Received in ${po.receivedPurchaseNumber}`}>
      <span className="block h-2 rounded-full bg-gray-200 overflow-hidden"><span className="block h-full rounded-full bg-info" style={{ width: `${pct}%` }} /></span>
      <span className="text-[11px] text-info">Partial {pct}%</span>
    </span>
  )
}

// Tick the lines that actually arrived and correct their quantities.
// Only those go to the purchase; the rest stays pending for a later receive.
function ReceiveScreen({ po, onCancel, onConfirm }) {
  const products = useCollection('products')
  const lines = po.items.map((it, i) => {
    const pending = round2(num(it.qty) - num(po.receivedQty?.[i]))
    return { i, it, pending, got: round2(num(po.receivedQty?.[i])) }
  })
  const [pick, setPick] = useState(() => Object.fromEntries(lines.map((l) => [l.i, { on: l.pending > 0, qty: l.pending > 0 ? l.pending : '' }])))
  const [error, setError] = useState('')
  const chosen = lines.filter((l) => pick[l.i].on && num(pick[l.i].qty) > 0)
  const confirm = () => {
    if (!chosen.length) { setError('Tick at least one product and enter the quantity that arrived.'); return }
    onConfirm(chosen.map((l) => ({ index: l.i, qty: num(pick[l.i].qty) })))
  }
  const unit = (it) => ((it.kind || products.find((p) => p.id === it.productId)?.kind) === 'Tiles' ? 'SFT' : 'PCS')
  return (
    <div>
      <p className="text-[13px] text-gray-600 mb-3">
        Supplier: <b>{po.contactName}</b> · Ordered {displayDate(po.date)}. Tick the products that reached the godown and correct the quantity if needed.
        Unticked or short quantities stay <b>pending</b> for the next receive.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-[13px] border">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 w-10" />
              <th className="px-3 py-2 text-left">Product</th>
              <th className="px-3 py-2 text-right">Ordered</th>
              <th className="px-3 py-2 text-right">Received</th>
              <th className="px-3 py-2 text-right">Pending</th>
              <th className="px-3 py-2 text-right w-36">Receive Now</th>
            </tr>
          </thead>
          <tbody>
            {lines.map(({ i, it, pending, got }) => (
              <tr key={i} className={`border-t ${pending <= 0 ? 'text-gray-400' : ''}`}>
                <td className="px-3 py-2 text-center">
                  <input type="checkbox" aria-label={`Receive ${it.name}`} disabled={pending <= 0} checked={pick[i].on}
                    onChange={(e) => setPick({ ...pick, [i]: { ...pick[i], on: e.target.checked } })} />
                </td>
                <td className="px-3 py-2">{[it.code, it.name].filter(Boolean).join(' - ')}</td>
                <td className="px-3 py-2 text-right">{round2(it.qty)} {unit(it)}</td>
                <td className="px-3 py-2 text-right">{got}</td>
                <td className="px-3 py-2 text-right">{pending > 0 ? pending : <Badge>Done</Badge>}</td>
                <td className="px-3 py-2">
                  <Input type="number" min="0" value={pick[i].qty} disabled={!pick[i].on}
                    onChange={(e) => setPick({ ...pick, [i]: { ...pick[i], qty: e.target.value } })} className="!text-right" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error && <p className="text-danger text-[13px] mt-2">{error}</p>}
      <div className="flex justify-end gap-2 mt-4">
        <Button color="secondary" onClick={onCancel}>Cancel</Button>
        <Button color="success" onClick={confirm}><FileCheck size={14} /> Confirm &amp; make purchase ({chosen.length})</Button>
      </div>
    </div>
  )
}
