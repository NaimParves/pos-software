import { useState } from 'react'
import { Pencil, Trash2, Search } from 'lucide-react'
import { PageHeader, Card, Field, Input, Select, Textarea, Button } from '../components/ui'
import Combo from '../components/Combo'
import DataTable from '../components/DataTable'
import { db, useDb } from '../store/db'
import { displayDate, inRange, money, today } from '../utils/format'

// Generic "form on top, list below" screen built from a config object:
// { title, collection, fields: [{ key, label, type, options, from, required, default, span }],
//   dateKey?, number?: prefix, listTitle?, filter?(row), defaults?, onSave?(row), formOnly?, listOnly? }
export default function CrudPage({ config }) {
  const state = useDb()
  const c = config
  const initial = () => Object.fromEntries(c.fields.map((fl) => [fl.key, fl.default === 'today' ? today() : fl.default ?? '']))
  const [f, setF] = useState(initial)
  const [editId, setEditId] = useState(null)
  const [error, setError] = useState('')
  const [range, setRange] = useState({ from: today(), to: today() })
  const [applied, setApplied] = useState(c.dateKey ? { from: '', to: '' } : null)

  const optionsFor = (fl) => {
    if (fl.options) return fl.options.map((o) => (typeof o === 'object' ? o : { value: o, label: o }))
    if (fl.from) {
      const { collection, filter, label = 'name', value = 'name' } = fl.from
      return (state[collection] || []).filter(filter || (() => true)).map((r) => ({ value: r[value], label: typeof label === 'function' ? label(r) : r[label] }))
    }
    return []
  }

  const [saving, setSaving] = useState(false)
  const save = async () => {
    const empty = (v) => v === '' || v === undefined
    const missing = c.fields.find((fl) => (fl.required || (fl.requiredOnCreate && !editId)) && empty(f[fl.key]))
    if (missing) { setError(`${missing.label} is required.`); return }
    let row = { ...c.defaults, ...f }
    c.fields.forEach((fl) => {
      if (fl.type === 'number') row[fl.key] = Number(row[fl.key]) || 0
      if (fl.type === 'password' && empty(row[fl.key])) delete row[fl.key] // keep the current password
    })
    if (c.transform) row = c.transform(row, state)
    setSaving(true)
    const ok = editId
      ? await db.update(c.collection, editId, row)
      : await db.insert(c.collection, row, { number: c.number })
    setSaving(false)
    if (!ok) return
    setF(initial()); setEditId(null); setError('')
  }

  let rows = (state[c.collection] || []).filter(c.filter || (() => true))
  if (applied && c.dateKey) rows = rows.filter((r) => inRange(r[c.dateKey], applied.from, applied.to))
  rows = rows.slice().reverse()

  const listFields = c.columns || c.fields.filter((fl) => fl.type !== 'textarea' && !fl.hideInList)
  const columns = [
    { key: 'sl', label: 'SL', render: (_, i) => i + 1, sortable: false },
    ...(c.number ? [{ key: 'number', label: 'Number' }] : []),
    ...listFields.map((fl) => ({
      key: fl.key, label: fl.label, align: fl.type === 'number' ? 'right' : undefined,
      render: fl.render || ((r) => (fl.type === 'date' ? displayDate(r[fl.key]) : fl.money ? money(r[fl.key]) : String(r[fl.key] ?? ''))),
    })),
    ...(c.listOnly ? [] : [{
      key: 'action', label: 'Action', render: (r) => (
        <div className="flex gap-1">
          {!c.noEdit && <Button color="info" className="!px-2 !py-1" onClick={() => { setF({ ...initial(), ...r, password: '' }); setEditId(r.id); window.scrollTo({ top: 0, behavior: 'smooth' }) }}><Pencil size={13} /></Button>}
          <Button color="danger" className="!px-2 !py-1" onClick={() => confirm('Delete this record?') && db.remove(c.collection, r.id)}><Trash2 size={13} /></Button>
        </div>
      ),
    }]),
  ]

  const renderInput = (fl) => {
    const v = f[fl.key] ?? ''
    const on = (val) => setF((x) => ({ ...x, [fl.key]: val }))
    if (fl.type === 'select') return <Select value={v} onChange={(e) => on(e.target.value)} placeholder={'placeholder' in fl ? fl.placeholder : `--Select ${fl.label}--`} options={optionsFor(fl)} />
    if (fl.type === 'combo') return <Combo value={v} onChange={on} placeholder={`--Select ${fl.label}--`} options={optionsFor(fl)} />
    if (fl.type === 'textarea') return <Textarea value={v} placeholder={fl.label} onChange={(e) => on(e.target.value)} />
    return <Input type={fl.type || 'text'} value={v} placeholder={fl.placeholder ?? fl.label} onChange={(e) => on(e.target.value)} />
  }

  return (
    <>
      <PageHeader title={c.title} />
      {!c.listOnly && (
        <Card>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {c.fields.map((fl) => (
              <Field key={fl.key} label={fl.label} required={fl.required} className={{ 2: 'sm:col-span-2', 4: 'sm:col-span-2 lg:col-span-4' }[fl.span] || ''}>
                {renderInput(fl)}
              </Field>
            ))}
          </div>
          {c.help && <p className="text-[12px] text-gray-500 mt-3">{c.help}</p>}
          {error && <p className="text-danger text-[13px] mt-3">{error}</p>}
          <div className="flex gap-1 mt-4">
            <Button onClick={save} disabled={saving}>{editId ? 'Update' : 'Save'}</Button>
            <Button color="secondary" onClick={() => { setF(initial()); setEditId(null); setError('') }}>Close</Button>
          </div>
        </Card>
      )}
      {!c.formOnly && (
        <>
          {c.dateKey && (
            <div className="bg-[#9e9e9e] rounded-t p-4 flex flex-wrap gap-2 items-center">
              <Input type="date" className="!w-44" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
              <Input type="date" className="!w-44" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
              <Button color="success" onClick={() => setApplied(range)}><Search size={14} /> Search</Button>
              <Button color="secondary" onClick={() => setApplied({ from: '', to: '' })}>Show All</Button>
            </div>
          )}
          <Card title={c.listTitle || `${c.title} List`}>
            <DataTable columns={columns} rows={rows} />
          </Card>
        </>
      )}
    </>
  )
}
