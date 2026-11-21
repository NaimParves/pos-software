import { useState } from 'react'
import { HandCoins, Landmark, Pencil, Plus, Printer, Receipt, Search, Trash2, Wallet } from 'lucide-react'
import { StatCard, PersonCard } from '../components/StatCard'
import { PageHeader, Card, Field, Input, Select, Button, Modal } from '../components/ui'
import VoucherPrint from '../components/VoucherPrint'
import { QuickContact } from './InvoiceForm'
import Combo from '../components/Combo'
import DataTable from '../components/DataTable'
import { toast } from '../components/Toast'
import { db, useDb, contactSummary, loanSummary } from '../store/db'
import { useCan } from '../store/permissions'
import { PAYMENT_METHODS, SHOP } from '../config/shop'
import { displayDate, inRange, money, num, round2, today } from '../utils/format'

// Receive From Customer, Pay To Supplier, Advance from Customer, Advance to
// Supplier, Customer / Supplier Settlement, Loan Collection and Loan Payment.
// The contact list only shows who this page is for (dues to collect, dues to
// pay, advances to settle, loans to repay). Picking a contact shows a mini
// dashboard. `voucher` is the Template Settings category used to print.
const MODES = {
  receive: {
    title: 'Receive From Customer', collection: 'payments', number: 'RCV', types: ['customer', 'retailer'],
    match: (r) => r.type === 'receive' && !r.advance, defaults: { type: 'receive' }, party: 'Customer', typeLabel: 'SR/Customer Payments',
    listType: 'Receive From Customer', wants: (b) => b > 0, discount: true, voucher: 'receive', voucherTitle: 'Money Receipt', partyWord: 'Received From',
    cards: ['Total Receivables', 'Total Received', 'Balance'], empty: 'No customer has a due right now.',
  },
  pay: {
    title: 'Pay To Supplier', collection: 'payments', number: 'PAY', types: ['supplier'],
    match: (r) => r.type === 'pay' && !r.advance, defaults: { type: 'pay' }, party: 'Supplier', typeLabel: 'Supplier Payments',
    listType: 'Pay To Supplier', wants: (b) => b > 0, discount: true, voucher: 'pay', voucherTitle: 'Payment Voucher', partyWord: 'Paid To',
    cards: ['Total Payable', 'Total Paid', 'Balance'], empty: 'No supplier is owed money right now.',
  },
  customerSettlement: {
    title: 'Customer Settlement', collection: 'settlements', number: 'CS', types: ['customer', 'retailer'],
    match: (r) => r.kind === 'customer', defaults: { kind: 'customer', refund: true }, party: 'Customer', typeLabel: 'Customer',
    listType: 'Customer Settlement', wants: (b) => b < 0, settlement: true, voucher: 'customerSettlement', voucherTitle: 'Customer Settlement', partyWord: 'Paid To',
    cards: ['Total Receivables', 'Total Deposited', 'Advance to Settle'], empty: 'No customer has an advance (deposit) right now.',
  },
  supplierSettlement: {
    title: 'Supplier Settlement', collection: 'settlements', number: 'SS', types: ['supplier'],
    match: (r) => r.kind === 'supplier', defaults: { kind: 'supplier', refund: true }, party: 'Supplier', typeLabel: 'Supplier',
    listType: 'Supplier Settlement', wants: (b) => b < 0, settlement: true, voucher: 'supplierSettlement', voucherTitle: 'Supplier Settlement', partyWord: 'Received From',
    cards: ['Total Payable', 'Total Paid', 'Advance to Settle'], empty: 'No supplier holds an advance from the shop right now.',
  },
  advanceCustomer: {
    title: 'Advance from Customer', collection: 'payments', number: 'ADV', types: ['customer', 'retailer'],
    match: (r) => r.type === 'receive' && r.advance, defaults: { type: 'receive', advance: true }, party: 'Customer', typeLabel: 'Customer Advance',
    listType: 'Advance from Customer', wants: () => true, advance: true, voucher: 'receive', voucherTitle: 'Advance Receipt', partyWord: 'Received From',
    cards: ['Total Receivables', 'Total Received', 'Balance'], empty: 'Add customers on Basic Settings › Registers › Add Customer.',
  },
  advanceSupplier: {
    title: 'Advance to Supplier', collection: 'payments', number: 'ADS', types: ['supplier'],
    match: (r) => r.type === 'pay' && r.advance, defaults: { type: 'pay', advance: true }, party: 'Supplier', typeLabel: 'Supplier Advance',
    listType: 'Advance to Supplier', wants: () => true, advance: true, voucher: 'pay', voucherTitle: 'Advance Payment Voucher', partyWord: 'Paid To',
    cards: ['Total Payable', 'Total Paid', 'Balance'], empty: 'Add suppliers on Basic Settings › Registers › Add Supplier.',
  },
  loanCollection: {
    title: 'Loan Collection', collection: 'loans', number: 'LC', types: ['lender'], loan: true,
    match: (r) => r.type === 'collect', defaults: { type: 'collect' }, party: 'Lender', typeLabel: 'Loan Collection',
    listType: 'Loan Collection', wants: () => true, advance: true, voucher: 'receive', voucherTitle: 'Loan Collection Receipt', partyWord: 'Collected From',
    methodLabel: 'Collection To', dateLabel: 'Collection Date',
    cards: ['Total Loan Taken', 'Total Paid', 'Balance / Due'], empty: 'Add lenders with the + button or on Basic Settings › Registers › Add Lender.',
  },
  loanPayment: {
    title: 'Loan Payment', collection: 'loans', number: 'LP', types: ['lender'], loan: true,
    match: (r) => r.type === 'pay', defaults: { type: 'pay' }, party: 'Lender', typeLabel: 'Loan Payment',
    listType: 'Loan Payment', wants: (b) => b > 0, voucher: 'pay', voucherTitle: 'Loan Payment Voucher', partyWord: 'Paid To',
    methodLabel: 'Paid From', dateLabel: 'Payment Date',
    cards: ['Total Loan Taken', 'Total Paid', 'Balance / Due'], empty: 'No loan is waiting to be repaid.',
  },
}

const blank = () => ({ date: today(), contactId: '', amount: '', discount: '', method: 'Cash', info: '', note: '', sms: false })

export default function AccountsPayment({ mode }) {
  const m = MODES[mode]
  const s = useDb()
  const allow = useCan()
  const [f, setF] = useState(blank)
  const [editId, setEditId] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState({ from: '', to: '', contactId: '', number: '' })
  const [applied, setApplied] = useState(filter)
  const [printRec, setPrintRec] = useState(null)
  const [quickAdd, setQuickAdd] = useState(false)
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }))
  const summaryOf = m.loan ? loanSummary : contactSummary

  const records = s[m.collection].filter(m.match)
  const editing = editId ? records.find((r) => r.id === editId) : null
  // Balances leave out the record being edited, so the form shows the state before it
  const sNow = editing ? { ...s, [m.collection]: s[m.collection].filter((r) => r.id !== editing.id) } : s
  const contacts = s.contacts.filter((c) => m.types.includes(c.type))
  const withBal = contacts.map((c) => ({ c, sum: summaryOf(c, sNow) }))
  const listed = withBal.filter(({ c, sum }) => m.wants(sum.balance) || c.id === editing?.contactId || c.id === f.contactId)
  const contact = contacts.find((c) => c.id === f.contactId)
  const sum = contact ? summaryOf(contact, sNow) : null
  const due = sum ? (m.settlement ? -sum.balance : sum.balance) : 0 // what this page can clear
  const amt = round2(num(f.amount))
  const disc = m.discount ? round2(num(f.discount)) : 0
  // a loan collection or an advance adds to what is owed the other way
  const after = m.loan && m.advance ? round2(due + amt) : round2(due - amt - disc)

  const reset = () => { setF(blank()); setEditId(null); setError('') }

  const save = async (print) => {
    if (!f.contactId) { setError(`Select a ${m.party.toLowerCase()}.`); return }
    if (!(amt > 0) && !(disc > 0)) { setError('Enter an amount.'); return }
    if (amt < 0 || disc < 0) { setError('Amounts cannot be negative.'); return }
    if (m.settlement && amt > due + 0.005) { setError(`Only ${money(due)} advance is left to settle.`); return }
    if (m.discount && disc > due + 0.005) { setError(`Discount cannot be more than the balance (${money(due)}).`); return }
    if (m.loan && !m.advance && amt > due + 0.005) { setError(`Only ${money(due)} of this loan is left to repay.`); return }
    if (!m.settlement && !m.advance && !m.loan && after < -0.005 && !confirm(`This is ${money(-after)} more than the balance. Keep the extra as an advance?`)) return
    setSaving(true)
    const row = {
      ...m.defaults,
      ...(editing && m.settlement ? { refund: !!editing.refund } : {}), // an old write-off stays a write-off
      date: f.date, contactId: f.contactId, contactName: contact.name, amount: amt,
      method: f.method, info: f.info, note: f.note, sms: f.sms,
      previousDue: round2(due), dueAfter: after,
      ...(m.discount ? { discount: disc } : {}),
    }
    const rec = editing ? await db.update(m.collection, editing.id, row) : await db.insert(m.collection, row, { number: m.number })
    setSaving(false)
    if (!rec) return
    if (f.sms && contact.phone) {
      const verb = {
        receive: 'Received', pay: 'Paid', customerSettlement: 'Returned your advance of', supplierSettlement: 'Received back advance of',
        advanceCustomer: 'Received advance of', advanceSupplier: 'Paid advance of', loanCollection: 'Received loan of', loanPayment: 'Repaid loan of',
      }[mode]
      const body = `Dear ${contact.name}, ${verb} ${money(amt)} ${SHOP.currency}${disc ? ` (discount ${money(disc)})` : ''}. Balance: ${money(Math.abs(after))}. - ${SHOP.name}`
      db.insert('sentMessages', { date: today(), phone: contact.phone, name: contact.name, body })
    }
    toast.success(`${m.title} ${rec.number || ''} ${editing ? 'updated' : 'saved'}.`)
    if (print) setPrintRec({ ...rec, phone: contact.phone, address: contact.address })
    reset()
  }

  const startEdit = (r) => {
    setF({ ...blank(), ...r, amount: r.amount, discount: r.discount || '', sms: false })
    setEditId(r.id); setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const rows = records
    .filter((r) => inRange(r.date, applied.from, applied.to))
    .filter((r) => !applied.contactId || r.contactId === applied.contactId)
    .filter((r) => !applied.number || String(r.number || '').toLowerCase().includes(applied.number.toLowerCase()))
    .slice().reverse()

  const columns = [
    { key: 'sl', label: 'SL', render: (_, i) => i + 1, sortable: false },
    { key: 'date', label: 'Date', render: (r) => displayDate(r.date) },
    { key: 'number', label: m.settlement ? 'Settlement#' : 'Payment#' },
    { key: 'contactName', label: 'Contact' },
    { key: 'type', label: 'Type', render: (r) => (m.settlement && !r.refund ? 'Write-off (old)' : m.listType), sortable: false },
    { key: 'method', label: 'Paid Through' },
    { key: 'note', label: 'Note' },
    ...(m.discount ? [{ key: 'discount', label: 'Discount', align: 'right', render: (r) => (num(r.discount) ? money(r.discount) : '') }] : []),
    { key: 'amount', label: 'Amount', align: 'right', render: (r) => money(r.amount) },
    ...[{
      key: 'action', label: 'Action', render: (r) => (
        <div className="flex gap-1">
          <Button color="success" className="!px-2 !py-1" title="Print" onClick={() => setPrintRec(withContact(r))}><Printer size={13} /></Button>
          {allow.edit && <Button color="info" className="!px-2 !py-1" title="Edit" onClick={() => startEdit(r)}><Pencil size={13} /></Button>}
          {allow.delete && <Button color="danger" className="!px-2 !py-1" title="Delete" onClick={() => confirm(`Delete ${r.number || 'this record'}?`) && db.remove(m.collection, r.id)}><Trash2 size={13} /></Button>}
        </div>
      ),
    }],
  ]
  // Receipts show the due before and after the payment. Older records did not
  // store it, so it is worked out from today's balance without this record.
  const withContact = (r) => {
    const c = s.contacts.find((x) => x.id === r.contactId)
    let { previousDue, dueAfter } = r
    if (previousDue === undefined && c) {
      const without = { ...s, [m.collection]: s[m.collection].filter((x) => x.id !== r.id) }
      const bal = summaryOf(c, without).balance
      previousDue = round2(m.settlement ? -bal : bal)
      dueAfter = round2(m.loan && m.advance ? previousDue + num(r.amount) : previousDue - num(r.amount) - num(r.discount))
    }
    return { ...r, phone: c?.phone || '', address: c?.address || '', previousDue, dueAfter }
  }
  const totals = { amount: rows.reduce((a, r) => a + num(r.amount), 0), discount: rows.reduce((a, r) => a + num(r.discount), 0) }

  return (
    <>
      <PageHeader title={m.title} />
      <div className="grid lg:grid-cols-[1fr_2fr] gap-4 mb-4">
        <Card className="!mb-0">
          <div className="space-y-4">
            <Field label={m.settlement ? 'Contact Type *' : 'Payment Type *'}><Input value={m.typeLabel} readOnly className="!bg-gray-50" /></Field>
            <Field label={m.loan ? `${m.defaults.type === 'pay' ? 'Paid To' : 'Collection From'} *` : 'Search Contact *'}>
              <div className="flex gap-1">
                <Combo className="flex-1" value={f.contactId} onChange={(v) => { set('contactId', v); setError('') }} placeholder="--Select Contact--"
                  options={listed.map(({ c, sum: b }) => ({ value: c.id, label: `${c.name}${c.phone ? ` | ${c.phone}` : ''} | ${money(Math.abs(b.balance))}${b.balance < 0 && !m.loan ? ' (advance)' : ''}` }))} />
                {m.loan && <Button title="Add lender" className="!px-3" onClick={() => setQuickAdd(true)}><Plus size={15} /></Button>}
              </div>
            </Field>
            {!listed.length && <p className="text-[12px] text-gray-500">{m.empty}</p>}
          </div>
        </Card>
        <Card className="!mb-0">
          <div className="grid sm:grid-cols-3 gap-4">
            <Field label={`${m.dateLabel || `${m.settlement ? 'Settlement' : 'Payment'} Date`} *`}><Input type="date" value={f.date} onChange={(e) => set('date', e.target.value)} /></Field>
            <Field label="Amount *"><Input type="number" min="0" value={f.amount} onChange={(e) => set('amount', e.target.value)} /></Field>
            {m.discount
              ? <Field label="Discount"><Input type="number" min="0" placeholder="0" value={f.discount} onChange={(e) => set('discount', e.target.value)} /></Field>
              : <Field label="Account Information"><Input value={f.info} onChange={(e) => set('info', e.target.value)} /></Field>}
            <Field label={m.methodLabel || 'Paid Through'}><Select value={f.method} onChange={(e) => set('method', e.target.value)} options={PAYMENT_METHODS} /></Field>
            <Field label="Note" className="sm:col-span-2"><Input value={f.note} onChange={(e) => set('note', e.target.value)} /></Field>
          </div>
          {error && <p className="text-danger text-[13px] mt-3">{error}</p>}
          <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t">
            <label className="flex items-center gap-2 text-[13px] font-medium mr-2">Send SMS <input type="checkbox" checked={f.sms} onChange={(e) => set('sms', e.target.checked)} /></label>
            <Button onClick={() => save(false)} disabled={saving}>{editing ? 'Update' : m.settlement ? 'Make Settlement' : m.loan ? 'Save' : 'Make Payment'}</Button>
            <Button color="success" onClick={() => save(true)} disabled={saving}><Printer size={14} /> {editing ? 'Update' : 'Save'} &amp; Print</Button>
            <Button color="secondary" onClick={reset}>Close</Button>
            {editing && <span className="text-warning text-[13px] font-medium ml-2">Editing {editing.number}</span>}
          </div>
        </Card>
      </div>

      {/* mini dashboard */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <PersonCard person={contact} badge={m.loan ? 'Active Lender' : null}
          emptyText={listed.length ? `No ${m.party.toLowerCase()} selected — pick one above to see the figures.` : m.empty} />
        {m.cards.map((label, i) => {
          const v = !sum ? 0 : i === 0 ? sum.billed : i === 1 ? sum.received : m.settlement ? -sum.balance : sum.balance
          const tone = i === 0 ? 'indigo' : i === 1 ? 'green' : v > 0 ? (m.settlement ? 'amber' : 'red') : v < 0 ? 'green' : 'amber'
          const Icon = [m.loan ? Landmark : Receipt, HandCoins, Wallet][i]
          const caption = i === 0 ? (m.loan ? 'Principal amount' : m.types.includes('supplier') ? 'Purchases + opening' : 'Sales + opening')
            : i === 1 ? (m.loan ? 'Repaid so far' : 'Payments, returns, discounts')
              : v < 0 && !m.loan ? 'Advance held' : m.loan ? 'Remaining payable' : 'Remaining'
          // the last card can fill the Amount box with the outstanding figure
          const canFill = i === 2 && contact && !m.advance && Math.abs(v) > 0
          return (
            <StatCard key={label} label={label} value={Math.abs(v)} tone={tone} icon={Icon} caption={caption}
              action={canFill && <button type="button" className="text-[11px] font-medium text-primary underline mt-1" onClick={() => set('amount', String(round2(Math.abs(v))))}>Auto-Fill {m.settlement ? 'Advance' : 'Due'}</button>} />
          )
        })}
      </div>
      {contact && (amt > 0 || disc > 0) && (
        <p className="text-[13px] text-gray-600 -mt-3 mb-6">
          After this {m.settlement ? 'settlement' : 'payment'}: {after >= 0
            ? <>balance <b>{money(after)}</b></>
            : <>advance <b>{money(-after)}</b></>}
        </p>
      )}

      <Card title={m.settlement ? 'Settlement List' : 'Payment List'}>
        <div className="flex flex-wrap gap-3 items-end mb-4">
          <Field label="From"><Input type="date" value={filter.from} onChange={(e) => setFilter({ ...filter, from: e.target.value })} /></Field>
          <Field label="To"><Input type="date" value={filter.to} onChange={(e) => setFilter({ ...filter, to: e.target.value })} /></Field>
          <Field label={m.party}>
            <Combo className="w-56" value={filter.contactId} onChange={(v) => setFilter({ ...filter, contactId: v })} placeholder="All"
              options={[{ value: '', label: 'All' }, ...contacts.map((c) => ({ value: c.id, label: c.name }))]} />
          </Field>
          <Field label={m.settlement ? 'Settlement#' : 'Payment#'}><Input className="!w-36" value={filter.number} onChange={(e) => setFilter({ ...filter, number: e.target.value })} /></Field>
          <Button onClick={() => setApplied(filter)} title="Search"><Search size={15} /></Button>
        </div>
        <DataTable columns={columns} rows={rows}
          footer={rows.length > 0 && (
            <tr className="border-t">
              <td colSpan={7} className="px-3 py-2 text-right">Total</td>
              {m.discount && <td className="px-3 py-2 text-right">{money(totals.discount)}</td>}
              <td className="px-3 py-2 text-right">{money(totals.amount)}</td>
              <td />
            </tr>
          )} />
      </Card>
      <Modal open={!!printRec} onClose={() => setPrintRec(null)} title={m.voucherTitle} wide>
        {printRec && <VoucherPrint rec={printRec} kind={m.voucher} title={m.voucherTitle} partyLabel={m.partyWord} />}
      </Modal>
      <QuickContact open={quickAdd} type={m.types[0]} onClose={() => setQuickAdd(false)} onSaved={(c) => { set('contactId', c.id); setQuickAdd(false) }} />
    </>
  )
}
