import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Printer, Send } from 'lucide-react'
import { PageHeader, Card, Field, Input, Select, Textarea, Button } from '../components/ui'
import Combo from '../components/Combo'
import DataTable from '../components/DataTable'
import { db, useDb, contactBalance } from '../store/db'
import { SHOP } from '../config/shop'
import { MENU } from '../config/menu'
import { ACTION_PAGES, PERMISSION_ROLES, can, permissionKey } from '../config/permissions'
import { useCan } from '../store/permissions'
import { money, round2, today, displayDate } from '../utils/format'

// Simple Code-39 style barcode drawn as SVG bars (visual only)
function Bars({ value }) {
  const bits = [...String(value)].flatMap((ch) => {
    const c = ch.charCodeAt(0)
    return [1, (c >> 0) & 1, 0, (c >> 1) & 1, 1, (c >> 2) & 1, 0, (c >> 3) & 1, 1, 0]
  })
  return (
    <svg viewBox={`0 0 ${bits.length * 2} 40`} className="w-full h-10" preserveAspectRatio="none">
      {bits.map((b, i) => b ? <rect key={i} x={i * 2} width={i % 3 === 0 ? 2 : 1.2} height="40" fill="#000" /> : null)}
    </svg>
  )
}

export function BarcodePrint() {
  const s = useDb()
  const [pid, setPid] = useState('')
  const [count, setCount] = useState(12)
  const [showPrice, setShowPrice] = useState(true)
  const [labels, setLabels] = useState([])
  const add = () => {
    const p = s.products.find((x) => x.id === pid)
    if (!p) return
    setLabels((l) => [...l, ...Array(Number(count) || 1).fill(p)])
  }
  return (
    <>
      <PageHeader title="Print Barcode" />
      <Card>
        <div className="flex flex-wrap gap-3 items-end print:hidden">
          <Field label="Product"><Combo className="w-72" value={pid} onChange={setPid} placeholder="--Select Product--" options={s.products.map((p) => ({ value: p.id, label: `${p.code} - ${p.name}` }))} /></Field>
          <Field label="Number of labels"><Input type="number" className="!w-32" value={count} onChange={(e) => setCount(e.target.value)} /></Field>
          <label className="flex items-center gap-2 text-[13px] pb-2"><input type="checkbox" checked={showPrice} onChange={(e) => setShowPrice(e.target.checked)} /> Show price</label>
          <Button onClick={add}>Add</Button>
          <Button color="success" onClick={() => window.print()} disabled={!labels.length}><Printer size={15} /> Print</Button>
          <Button color="secondary" onClick={() => setLabels([])}>Clear</Button>
        </div>
        <div className="print-area grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mt-5">
          {labels.map((p, i) => (
            <div key={i} className="border border-dashed border-gray-400 p-2 text-center text-[11px]">
              <p className="font-semibold">{SHOP.name}</p>
              <p className="truncate">{p.name}</p>
              <Bars value={p.code} />
              <p className="tracking-widest">{p.code}</p>
              {showPrice && <p className="font-semibold">Price: {money(p.sellPrice)}</p>}
            </div>
          ))}
          {!labels.length && <p className="text-gray-400 text-[13px] col-span-full">Pick a product and click Add to build the label sheet.</p>}
        </div>
      </Card>
    </>
  )
}

export function OpeningStock() {
  const s = useDb()
  const [qty, setQty] = useState({})
  const allow = useCan()
  const save = async () => {
    if (!allow.edit) { alert('Your role is not allowed to change stock here.'); return }
    const changes = Object.entries(qty).filter(([, v]) => v !== '')
    const results = await Promise.all(changes.map(([id, v]) => db.update('products', id, { stock: Number(v) })))
    setQty({})
    if (results.every(Boolean)) alert('Opening stock saved.')
  }
  return (
    <>
      <PageHeader title="Bulk Opening Stock" />
      <Card>
        <DataTable rows={s.products} pageSizes={[50, 100, 250]} columns={[
          { key: 'code', label: 'Code' }, { key: 'name', label: 'Name' }, { key: 'size', label: 'Size' },
          { key: 'stock', label: 'Current Stock', align: 'right', render: (p) => round2(p.stock) },
          { key: 'new', label: 'Opening Stock', sortable: false, render: (p) => <Input type="number" className="!w-32" value={qty[p.id] ?? ''} onChange={(e) => setQty({ ...qty, [p.id]: e.target.value })} /> },
        ]} />
        {allow.edit
          ? <Button className="mt-4" onClick={save}>Save Opening Stock</Button>
          : <p className="text-[13px] text-gray-500 mt-4">Your role is not allowed to change stock here.</p>}
      </Card>
    </>
  )
}

export function SendMessage({ dueOnly }) {
  const s = useDb()
  const recipients = s.contacts
    .filter((c) => c.phone && ['customer', 'retailer', 'supplier', 'employee'].includes(c.type))
    .map((c) => ({ ...c, balance: contactBalance(c, s) }))
    .filter((c) => !dueOnly || (c.type !== 'supplier' && c.balance > 0))
  const [picked, setPicked] = useState({})
  const [body, setBody] = useState(dueOnly ? `Dear customer, your due amount is {due} ${SHOP.currency}. Please pay soon. - ${SHOP.name}` : '')
  const send = () => {
    const to = recipients.filter((r) => picked[r.id])
    if (!to.length || !body.trim()) { alert('Pick at least one recipient and write a message.'); return }
    to.forEach((r) => db.insert('sentMessages', { date: today(), phone: r.phone, name: r.name, body: body.replace('{due}', money(r.balance)) }))
    setPicked({})
    alert(`${to.length} message(s) queued. Connect an SMS gateway in the backend to deliver them.`)
  }
  return (
    <>
      <PageHeader title={dueOnly ? 'Due Customer' : 'Send Message'} />
      <Card>
        <div className="grid lg:grid-cols-2 gap-5">
          <div>
            <Field label="Template">
              <Select placeholder="--Select Template--" options={s.messages.map((m) => ({ value: m.body, label: m.title }))} onChange={(e) => e.target.value && setBody(e.target.value)} />
            </Field>
            <Field label="Message" className="mt-3"><Textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} /></Field>
            <p className="text-[12px] text-gray-500 mt-1">{body.length} characters{dueOnly && ' · {due} is replaced by each customer\'s due'}</p>
            <Button className="mt-3" onClick={send}><Send size={14} /> Send</Button>
          </div>
          <div>
            <div className="flex justify-between text-[13px] mb-2">
              <b>Recipients</b>
              <button className="text-primary" onClick={() => setPicked(Object.fromEntries(recipients.map((r) => [r.id, true])))}>Select all</button>
            </div>
            <div className="border rounded max-h-72 overflow-y-auto text-[13px]">
              {recipients.map((r) => (
                <label key={r.id} className="flex items-center gap-2 px-3 py-2 border-b last:border-0">
                  <input type="checkbox" checked={!!picked[r.id]} onChange={(e) => setPicked({ ...picked, [r.id]: e.target.checked })} />
                  <span className="flex-1">{r.name} <span className="text-gray-400">({r.phone})</span></span>
                  {dueOnly && <span className="text-danger">{money(r.balance)}</span>}
                </label>
              ))}
              {!recipients.length && <p className="p-3 text-gray-400">No recipients.</p>}
            </div>
          </div>
        </div>
      </Card>
      <Card title="Sent Messages">
        <DataTable rows={s.sentMessages.slice().reverse()} columns={[
          { key: 'date', label: 'Date', render: (r) => displayDate(r.date) }, { key: 'name', label: 'Name' }, { key: 'phone', label: 'Phone' }, { key: 'body', label: 'Message' },
        ]} />
      </Card>
    </>
  )
}

export function SetPermission() {
  const s = useDb()
  const [role, setRole] = useState('Manager')
  const perms = s.permissions?.[0]?.map || {}
  const key = (label) => `${role}:${label}`
  const saveMap = (next) => {
    if (s.permissions?.[0]) db.update('permissions', s.permissions[0].id, { map: next })
    else db.insert('permissions', { map: next })
  }
  const toggle = (label) => saveMap({ ...perms, [key(label)]: !perms[key(label)] })

  // Edit / Delete per page
  const allowed = (action, path) => can(perms, role, action, path)
  const usable = (action, p) => !(action === 'edit' ? p.noEdit : p.noDelete)
  const setAction = (action, path, value) => saveMap({ ...perms, [permissionKey(role, action, path)]: value })
  const setAll = (action, value) => saveMap({
    ...perms,
    ...Object.fromEntries(ACTION_PAGES.filter((p) => usable(action, p)).map((p) => [permissionKey(role, action, p.path), value])),
  })
  const allOn = (action) => ACTION_PAGES.filter((p) => usable(action, p)).every((p) => allowed(action, p.path))
  const groups = [...new Set(ACTION_PAGES.map((p) => p.group))]

  return (
    <>
      <PageHeader title="Set Permission" />
      <Card>
        <Field label="Role" className="max-w-xs mb-5"><Select value={role} onChange={(e) => setRole(e.target.value)} options={PERMISSION_ROLES} /></Field>

        <h5 className="text-[14px] font-semibold text-gray-700 mb-1">Edit &amp; Delete</h5>
        <p className="text-[12px] text-gray-500 mb-3">
          Tick what the <b>{role}</b> role may edit or delete. Unticked buttons are hidden, and the server refuses the change.
          Super Admin can always edit and delete.
        </p>
        <div className="overflow-x-auto mb-8">
          <table className="w-full min-w-[480px] text-[13px] border">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-3 py-2">Menu / Page</th>
                {['edit', 'delete'].map((a) => (
                  <th key={a} className="px-3 py-2 w-28">
                    <label className="inline-flex items-center gap-2 capitalize">
                      <input type="checkbox" checked={allOn(a)} onChange={(e) => setAll(a, e.target.checked)} /> {a}
                    </label>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => [
                <tr key={g} className="bg-[#f2f2f5]"><td colSpan={3} className="px-3 py-1.5 font-semibold">{g}</td></tr>,
                ...ACTION_PAGES.filter((p) => p.group === g).map((p) => (
                  <tr key={p.path} className="border-t">
                    <td className="px-3 py-1.5 pl-6 text-gray-600">{p.label}</td>
                    {['edit', 'delete'].map((a) => (
                      <td key={a} className="px-3 py-1.5 text-center">
                        {usable(a, p)
                          ? <input type="checkbox" aria-label={`${a} ${p.label}`} checked={allowed(a, p.path)} onChange={(e) => setAction(a, p.path, e.target.checked)} />
                          : <span className="text-gray-300">–</span>}
                      </td>
                    ))}
                  </tr>
                )),
              ])}
            </tbody>
          </table>
        </div>

        <h5 className="text-[14px] font-semibold text-gray-700 mb-3">Menu access</h5>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 text-[13px]">
          {MENU.map((m) => (
            <div key={m.label} className="border rounded p-3">
              <label className="flex items-center gap-2 font-semibold mb-2">
                <input type="checkbox" checked={!!perms[key(m.label)]} onChange={() => toggle(m.label)} /> {m.label}
              </label>
              {(m.children || []).flatMap((c) => c.children || [c]).map((c) => (
                <label key={c.label + c.path} className="flex items-center gap-2 pl-5 py-0.5 text-gray-600">
                  <input type="checkbox" checked={!!perms[key(c.path)]} onChange={() => toggle(c.path)} /> {c.label}
                </label>
              ))}
            </div>
          ))}
        </div>
        <p className="text-[12px] text-gray-500 mt-4">Menu access ticks are saved but do not hide menus yet. Edit &amp; Delete ticks above take effect right away.</p>
      </Card>
    </>
  )
}

export function NotFound() {
  return (
    <div className="text-center py-24">
      <p className="text-5xl font-light text-gray-400">404</p>
      <p className="text-gray-500 mt-2">Page not found</p>
      <Link to="/home" className="text-primary text-sm mt-4 inline-block">Back to Dashboard</Link>
    </div>
  )
}
