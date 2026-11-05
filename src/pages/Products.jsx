import { useState } from 'react'
import { MoreHorizontal, Plus } from 'lucide-react'
import { PageHeader, Card, Field, Input, Select, Button, Badge, Modal } from '../components/ui'
import Combo from '../components/Combo'
import DataTable from '../components/DataTable'
import { toast } from '../components/Toast'
import { db, useCollection } from '../store/db'
import { money, round2 } from '../utils/format'

const blank = {
  kind: 'Tiles', category: '', brand: '', grade: '', code: '', name: '', size: '', pcsPerCart: '',
  purchasePrice: '', sellPrice: '', productType: 'Single', stock: '', alertQty: '', status: 'Active', image: '',
}

export default function Products() {
  const products = useCollection('products')
  const [editing, setEditing] = useState(null) // product being edited, or null for a new one
  const [formKey, setFormKey] = useState(0)
  const [menu, setMenu] = useState(null)

  const done = () => { setEditing(null); setFormKey((k) => k + 1) }
  const edit = (p) => { setEditing(p); setFormKey((k) => k + 1); setMenu(null); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  const columns = [
    { key: 'sl', label: 'SL', render: (_, i) => i + 1, sortable: false },
    { key: 'code', label: 'Code' },
    { key: 'grade', label: 'Grade' },
    { key: 'name', label: 'Name' },
    { key: 'size', label: 'Size' },
    { key: 'pcsPerCart', label: 'PCS/Cart' },
    { key: 'category', label: 'Category' },
    { key: 'brand', label: 'Brand' },
    { key: 'purchasePrice', label: 'P/Price' },
    { key: 'sellPrice', label: 'S/Price' },
    { key: 'stock', label: 'Stock', render: (p) => round2(p.stock) },
    { key: 'status', label: 'Status', render: (p) => <Badge color={p.status === 'Active' ? 'success' : 'danger'}>{p.status}</Badge> },
    {
      key: 'action', label: 'Action', render: (p) => (
        <div className="relative">
          <button onClick={() => setMenu(menu === p.id ? null : p.id)} className="px-2 text-gray-600"><MoreHorizontal size={16} /></button>
          {menu === p.id && (
            <div className="absolute right-0 z-20 bg-white border rounded shadow w-28 text-[13px]" onMouseLeave={() => setMenu(null)}>
              <button className="block w-full text-left px-3 py-1.5 hover:bg-gray-50" onClick={() => edit(p)}>Edit</button>
              <button className="block w-full text-left px-3 py-1.5 hover:bg-gray-50" onClick={() => { db.update('products', p.id, { status: p.status === 'Active' ? 'Inactive' : 'Active' }); setMenu(null) }}>
                {p.status === 'Active' ? 'Deactivate' : 'Activate'}
              </button>
              <button className="block w-full text-left px-3 py-1.5 hover:bg-gray-50 text-danger" onClick={() => { if (confirm('Delete this product?')) db.remove('products', p.id); setMenu(null) }}>Delete</button>
            </div>
          )}
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader title={editing ? 'Edit Product' : 'Create Product'} trail={['Products', editing ? 'Edit Product' : 'Create Product']} />
      <Card>
        <ProductForm key={formKey} product={editing} onSaved={done} onCancel={done} />
      </Card>

      <Card title="All Products">
        <DataTable columns={columns} rows={products} />
        <p className="text-[12px] text-gray-500 mt-2">Stock value at purchase price: {money(products.reduce((a, p) => a + Number(p.stock) * Number(p.purchasePrice), 0))}</p>
      </Card>
    </>
  )
}

// The product create/edit form. Used on the Products page and in the
// "Add Product" pop-up on the invoice screens. onSaved receives the saved product.
export function ProductForm({ product = null, onSaved, onCancel, compact = false }) {
  const products = useCollection('products')
  const categories = useCollection('categories')
  const brands = useCollection('brands')
  const grades = useCollection('grades')
  const sizes = useCollection('sizes')
  const [f, setF] = useState(product ? { ...blank, ...product } : blank)
  const [quick, setQuick] = useState(null) // which master list to quick-add to
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e?.target ? e.target.value : e })

  const save = async () => {
    const isTiles = f.kind === 'Tiles'
    if (!f.category || !f.name || (isTiles && (!f.size || !f.pcsPerCart)) || f.purchasePrice === '' || f.sellPrice === '') {
      setError('Please fill in all required (*) fields.'); return
    }
    if (saving) return
    const { id, createdAt, ...fields } = f
    const rec = {
      ...fields, pcsPerCart: Number(f.pcsPerCart) || 1, purchasePrice: Number(f.purchasePrice), sellPrice: Number(f.sellPrice),
      stock: Number(f.stock) || 0, alertQty: Number(f.alertQty) || 0, code: f.code || `P-${String(products.length + 1).padStart(4, '0')}`,
    }
    setSaving(true)
    const saved = product ? await db.update('products', product.id, rec) : await db.insert('products', rec)
    setSaving(false)
    if (!saved) return
    toast.success(`Product "${saved.name}" ${product ? 'updated' : 'saved'} successfully.`)
    setF(blank); setError('')
    onSaved?.(saved)
  }

  const onImage = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const r = new FileReader()
    r.onload = () => setF((x) => ({ ...x, image: r.result }))
    r.readAsDataURL(file)
  }

  const opts = (list) => list.filter((x) => x.status !== 'Inactive').map((x) => ({ value: x.name, label: x.name }))
  const PlusBtn = ({ list }) => <Button className="!px-4" onClick={() => setQuick(list)}><Plus size={16} /></Button>

  return (
    <>
      <div className={`grid gap-4 ${compact ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-4'}`}>
        <Field label="Product"><Select value={f.kind} onChange={set('kind')} options={['Tiles', 'General']} /></Field>
        <Field label="Category" required><div className="flex gap-1"><Combo className="flex-1" value={f.category} onChange={set('category')} placeholder="--Select Category--" options={opts(categories)} /><PlusBtn list="categories" /></div></Field>
        <Field label="Brand"><div className="flex gap-1"><Combo className="flex-1" value={f.brand} onChange={set('brand')} placeholder="--Select Brand--" options={opts(brands)} /><PlusBtn list="brands" /></div></Field>
        <Field label="Grade"><Combo value={f.grade} onChange={set('grade')} placeholder="--Select Grade--" options={opts(grades)} /></Field>
        <Field label="Product Code"><Input value={f.code} onChange={set('code')} /></Field>
        <Field label="Product Name" required><Input placeholder="Product Name" value={f.name} onChange={set('name')} /></Field>
        {f.kind === 'Tiles' && <>
          <Field label="Size" required><div className="flex gap-1"><Combo className="flex-1" value={f.size} onChange={set('size')} placeholder="--Select Size--" options={opts(sizes)} /><PlusBtn list="sizes" /></div></Field>
          <Field label="Pcs/Cartoon" required><Input type="number" placeholder="PCS Per Cartoon" value={f.pcsPerCart} onChange={set('pcsPerCart')} /></Field>
        </>}
        <Field label="Purchase Price" required><Input type="number" placeholder="Purchase Price" value={f.purchasePrice} onChange={set('purchasePrice')} /></Field>
        <Field label="Sell Price" required><Input type="number" placeholder="Sell Price" value={f.sellPrice} onChange={set('sellPrice')} /></Field>
        <Field label="Product Type"><Select value={f.productType} onChange={set('productType')} options={['Single', 'Variable']} /></Field>
        <Field label={`Stock Quantity${f.kind === 'Tiles' ? ' (SFT)' : ''}`}><Input type="number" placeholder="Stock Quantity" value={f.stock} onChange={set('stock')} /></Field>
        <Field label="Alert Quantity"><Input type="number" placeholder="Alert Quantity" value={f.alertQty} onChange={set('alertQty')} /></Field>
        <Field label="Status"><Select value={f.status} onChange={set('status')} options={['Active', 'Inactive']} /></Field>
        <Field label="Image">
          <div className="flex items-center gap-2">
            <input type="file" accept="image/*" onChange={onImage} className="text-[12px]" />
            {f.image && <img src={f.image} alt="" className="w-9 h-9 object-cover rounded border" />}
          </div>
        </Field>
      </div>
      {error && <p className="text-danger text-[13px] mt-3">{error}</p>}
      <div className="flex gap-1 mt-4">
        <Button disabled={saving} onClick={save}>{product ? 'Update' : 'Save'}</Button>
        <Button color="secondary" onClick={() => { setF(blank); setError(''); onCancel?.() }}>Close</Button>
      </div>

      <QuickMaster list={quick} onClose={() => setQuick(null)} onSaved={(name) => { setF((x) => ({ ...x, [{ categories: 'category', brands: 'brand', sizes: 'size' }[quick]]: name })); setQuick(null) }} />
    </>
  )
}

function QuickMaster({ list, onClose, onSaved }) {
  const [name, setName] = useState('')
  const label = { categories: 'Category', brands: 'Brand', sizes: 'Size (e.g. 12 X 24)' }[list]
  return (
    <Modal open={!!list} onClose={onClose} title={`Add ${label}`}>
      <Field label="Name" required><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <div className="flex gap-1 mt-4">
        <Button onClick={async () => { if (!name.trim()) return; if (await db.insert(list, { name: name.trim(), status: 'Active' })) { onSaved(name.trim()); setName('') } }}>Save</Button>
        <Button color="secondary" onClick={onClose}>Close</Button>
      </div>
    </Modal>
  )
}
