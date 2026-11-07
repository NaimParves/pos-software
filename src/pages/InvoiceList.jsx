import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, Printer, Trash2, Search, Truck, Pencil, Undo2, PackageCheck } from 'lucide-react'
import { PageHeader, Card, Field, Input, Select, Button, Modal, Badge } from '../components/ui'
import DataTable from '../components/DataTable'
import InvoicePrint from '../components/InvoicePrint'
import { DeliveryButton } from '../components/Delivery'
import { db, useCollection } from '../store/db'
import { useCan } from '../store/permissions'
import { displayDate, inRange, money } from '../utils/format'

// stockSign: how the document moved stock when saved (deleting reverses it)
// editPath: string or (doc) => string. returnPath: the action column shows a
// Return button (to that return page) instead of View. receivePath: P/O list,
// shows Order Receive (opens the purchase page filled from the P/O) instead of Print.
export default function InvoiceList({ title, collection, partyLabel = 'Customer', partyTypes = ['customer', 'retailer'], stockSign = 0, challan = false, delivery = false, editPath = '', returnPath = '', returnLabel = 'Return', receivePath = '' }) {
  const nav = useNavigate()
  const allow = useCan()
  const docs = useCollection(collection)
  const contacts = useCollection('contacts').filter((c) => partyTypes.includes(c.type))
  const [f, setF] = useState({ from: '', to: '', type: '', memo: '', walkName: '', walkPhone: '', status: '', contactId: '' })
  const [applied, setApplied] = useState(f)
  const [view, setView] = useState(null)

  const rows = docs
    .filter((d) => inRange(d.date, applied.from, applied.to))
    .filter((d) => !applied.memo || d.number.toLowerCase().includes(applied.memo.toLowerCase()))
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

  const columns = [
    { key: 'sl', label: 'SL', render: (_, i) => i + 1, sortable: false },
    ...(delivery ? [{
      key: 'delivered', label: 'Delivery Confirm', sortable: false, render: (d) => <DeliveryButton doc={d} collection={collection} />,
    }] : []),
    { key: 'date', label: 'Date', render: (d) => displayDate(d.date) },
    { key: 'number', label: 'Invoice#' },
    { key: 'contactName', label: partyLabel },
    ...(challan ? [{ key: 'items', label: 'Items', render: (d) => d.items.length, sortable: false }] : [
      { key: 'invoiceAmount', label: 'Total Payable', align: 'right', render: (d) => money(d.invoiceAmount) },
      { key: 'paid', label: 'Given', align: 'right', render: (d) => money(d.paid) },
      { key: 'due', label: 'Due', align: 'right', render: (d) => money(d.due) },
    ]),
    ...(receivePath ? [{
      key: 'received', label: 'Status', render: (d) => (d.received ? <Badge>Received {d.receivedPurchaseNumber}</Badge> : <Badge color="warning">Ordered</Badge>),
    }] : []),
    {
      key: 'action', label: 'Action', render: (d) => (
        <div className="flex gap-1">
          {returnPath
            ? <Button color="info" className="!px-2 !py-1" title={returnLabel} onClick={() => nav(`${returnPath}?source=${d.id}`)}><Undo2 size={14} /> <span className="text-[12px]">{returnLabel}</span></Button>
            : <Button color="info" className="!px-2 !py-1" title="View" onClick={() => setView({ doc: d, challan })}><Eye size={14} /></Button>}
          {receivePath
            ? <Button color="success" className="!px-2 !py-1" title={d.received ? `Already received as ${d.receivedPurchaseNumber}` : 'Order Receive'} disabled={!!d.received} onClick={() => nav(`${receivePath}?fromPO=${d.id}`)}><PackageCheck size={14} /> <span className="text-[12px]">Order Receive</span></Button>
            : <Button color="success" className="!px-2 !py-1" title={challan ? 'Print challan' : 'Print invoice'} onClick={() => setView({ doc: d, challan })}><Printer size={14} /></Button>}
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

  const totals = rows.reduce((a, d) => ({ amt: a.amt + d.invoiceAmount, paid: a.paid + d.paid, due: a.due + d.due }), { amt: 0, paid: 0, due: 0 })

  return (
    <>
      <PageHeader title={title} />
      <Card>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Field label="From Date"><Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
          <Field label="To Date"><Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
          <Field label={`${partyLabel} Type`}><Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} placeholder="All" options={[{ value: 'walkin', label: 'Walk-In' }, { value: 'registered', label: 'Registered' }]} /></Field>
          <Field label="Memo Number"><Input value={f.memo} onChange={(e) => setF({ ...f, memo: e.target.value })} /></Field>
          <Field label={`Walk-In ${partyLabel} Name`}><Input value={f.walkName} onChange={(e) => setF({ ...f, walkName: e.target.value })} /></Field>
          <Field label={`Walk-In ${partyLabel} Phone`}><Input value={f.walkPhone} onChange={(e) => setF({ ...f, walkPhone: e.target.value })} /></Field>
          <Field label="Status"><Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} placeholder="All" options={[{ value: 'paid', label: 'Paid' }, { value: 'due', label: 'Due' }]} /></Field>
          <div className="flex items-end gap-1">
            <Field label={`Registered ${partyLabel}`} className="flex-1">
              <Select value={f.contactId} onChange={(e) => setF({ ...f, contactId: e.target.value })} placeholder="All" options={contacts.map((c) => ({ value: c.id, label: c.name }))} />
            </Field>
            <Button className="!px-6 !py-2" onClick={() => setApplied(f)}><Search size={15} /></Button>
          </div>
        </div>
        <DataTable
          columns={columns}
          rows={rows}
          footer={!challan && rows.length > 0 && (
            <tr className="border-t">
              <td colSpan={delivery ? 5 : 4} className="px-3 py-2 text-right">Total</td>
              <td className="px-3 py-2 text-right">{money(totals.amt)}</td>
              <td className="px-3 py-2 text-right">{money(totals.paid)}</td>
              <td className="px-3 py-2 text-right">{money(totals.due)}</td>
              {receivePath && <td />}
              <td />
            </tr>
          )}
        />
      </Card>
      <Modal open={!!view} onClose={() => setView(null)} title={view && `${view.challan ? 'Challan' : 'Invoice'} ${view.doc.number}`} wide>
        {view && <InvoicePrint doc={view.doc} challan={view.challan} />}
      </Modal>
    </>
  )
}
