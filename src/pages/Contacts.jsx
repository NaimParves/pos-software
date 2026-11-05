import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { MoreHorizontal, User } from 'lucide-react'
import { PageHeader, Card, Field, Input, Button } from '../components/ui'
import DataTable from '../components/DataTable'
import { db, useCollection } from '../store/db'

const LABEL = { customer: 'Customer', retailer: 'Retailer', supplier: 'Supplier', employee: 'Employee', reference: 'Reference' }
const blank = { name: '', organization: '', address: '', phone: '', altPhone: '', nid: '', openingBalance: '', designation: '', salary: '', image: '' }

export default function Contacts() {
  const { type } = useParams()
  const label = LABEL[type] || 'Contact'
  const all = useCollection('contacts')
  const rows = all.filter((c) => c.type === type)
  const [f, setF] = useState(blank)
  const [editId, setEditId] = useState(null)
  const [menu, setMenu] = useState(null)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const save = async () => {
    if (!f.name.trim()) { alert('Name is required.'); return }
    const rec = { ...f, type, openingBalance: Number(f.openingBalance) || 0, salary: Number(f.salary) || 0 }
    const ok = editId ? await db.update('contacts', editId, rec) : await db.insert('contacts', rec) // server assigns the ID code
    if (!ok) return
    setF(blank); setEditId(null)
  }

  const onImage = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const r = new FileReader()
    r.onload = () => setF((x) => ({ ...x, image: r.result }))
    r.readAsDataURL(file)
  }

  const columns = [
    { key: 'sl', label: 'SL', render: (_, i) => i + 1, sortable: false },
    { key: 'image', label: 'Image', sortable: false, render: (c) => c.image ? <img src={c.image} alt="" className="w-8 h-8 rounded object-cover" /> : <span className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center text-gray-400"><User size={16} /></span> },
    { key: 'code', label: 'ID' },
    { key: 'name', label: 'Name' },
    { key: 'type', label: 'Type', render: () => label },
    { key: 'address', label: 'Address' },
    { key: 'phone', label: 'Phone' },
    { key: 'altPhone', label: 'Alternative Phone' },
    {
      key: 'action', label: 'Action', render: (c) => (
        <div className="relative">
          <button onClick={() => setMenu(menu === c.id ? null : c.id)} className="px-2 text-gray-600"><MoreHorizontal size={16} /></button>
          {menu === c.id && (
            <div className="absolute right-0 z-20 bg-white border rounded shadow w-24 text-[13px]" onMouseLeave={() => setMenu(null)}>
              <button className="block w-full text-left px-3 py-1.5 hover:bg-gray-50" onClick={() => { setF({ ...blank, ...c }); setEditId(c.id); setMenu(null) }}>Edit</button>
              <button className="block w-full text-left px-3 py-1.5 hover:bg-gray-50 text-danger" onClick={() => { if (confirm(`Delete ${c.name}?`)) db.remove('contacts', c.id); setMenu(null) }}>Delete</button>
            </div>
          )}
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader title={label} trail={['Registers', `Add ${label}`]} />
      <Card>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Field label="Name" required><Input placeholder="Enter Name" value={f.name} onChange={set('name')} /></Field>
          <Field label="Organization Name"><Input placeholder="Enter Organization Name" value={f.organization} onChange={set('organization')} /></Field>
          <Field label="Address"><Input placeholder="Enter Address" value={f.address} onChange={set('address')} /></Field>
          <Field label="Mobile Number"><Input placeholder="Enter Phone Number" value={f.phone} onChange={set('phone')} /></Field>
          <Field label="Alternative Phone"><Input placeholder="Enter Alternative Phone" value={f.altPhone} onChange={set('altPhone')} /></Field>
          <Field label="NID Number"><Input placeholder="Enter NID Number" value={f.nid} onChange={set('nid')} /></Field>
          {type === 'employee' ? <>
            <Field label="Designation"><Input placeholder="Designation" value={f.designation} onChange={set('designation')} /></Field>
            <Field label="Monthly Salary"><Input type="number" placeholder="Salary" value={f.salary} onChange={set('salary')} /></Field>
          </> : (
            <Field label="Opening Balance"><Input type="number" placeholder="Enter Opening Balance" value={f.openingBalance} onChange={set('openingBalance')} /></Field>
          )}
          <Field label="Image"><input type="file" accept="image/*" onChange={onImage} className="text-[12px] mt-1" /></Field>
        </div>
        <div className="flex gap-1 mt-4">
          <Button onClick={save}>{editId ? 'Update' : 'Save'}</Button>
          <Button color="secondary" onClick={() => { setF(blank); setEditId(null) }}>Close</Button>
        </div>
      </Card>
      <Card title="All Contacts">
        <DataTable columns={columns} rows={rows} />
      </Card>
    </>
  )
}
