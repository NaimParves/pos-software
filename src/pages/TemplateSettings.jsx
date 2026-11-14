import { useState } from 'react'
import { Check, Upload, X } from 'lucide-react'
import { PageHeader, Card, Field, Input, Textarea, Button } from '../components/ui'
import InvoicePrint from '../components/InvoicePrint'
import VoucherPrint from '../components/VoucherPrint'
import { toast } from '../components/Toast'
import { db, useCollection } from '../store/db'
import { useShop } from '../store/shop'
import { useUser } from '../store/auth'
import { TEMPLATE_CATEGORIES, DESIGNS, blankTemplate, DEFAULT_COLOR } from '../config/templates'
import { today } from '../utils/format'

const VOUCHER_KINDS = ['receive', 'pay', 'customerSettlement', 'supplierSettlement']
const SAMPLE_DOC = {
  number: 'S-0001', date: today(), contactName: 'Sample Customer', phone: '01700000000', address: 'Main Road', challanNo: '',
  items: [
    { productId: '', name: 'Sample Tiles', code: 'ST-101', size: '12 X 24', grade: 'A Grade', kind: 'Tiles', qty: 64, cart: 4, pcs: 0, rate: 55, total: 3520 },
    { productId: '', name: 'Wash Basin', code: 'WB-01', kind: 'General', qty: 1, cart: 1, pcs: 0, rate: 2300, total: 2300 },
  ],
  subTotal: 5820, discount: 20, laborCost: 40, invoiceAmount: 5840, previousDue: 0, paid: 5000, due: 840, note: '',
}
const SAMPLE_VOUCHER = { number: 'RCV-0001', date: today(), contactName: 'Sample Customer', phone: '01700000000', address: 'Main Road', amount: 5000, discount: 0, method: 'Cash', note: 'Due collection' }
const TITLES = { sale: 'Invoice', salesReturn: 'Sales Return', directReturn: 'Direct Return', purchase: 'Purchase', receive: 'Money Receipt', pay: 'Payment Voucher', customerSettlement: 'Customer Settlement', supplierSettlement: 'Supplier Settlement' }

function readImage(file, done) {
  if (!file) return
  if (file.size > 1.5 * 1024 * 1024) { alert('Please pick an image smaller than 1.5 MB.'); return }
  const r = new FileReader()
  r.onload = () => done(r.result)
  r.readAsDataURL(file)
}

// Renders a document at A4 width and scales it down to fit a card
function Preview({ kind, template, scale = 0.3, height = 330 }) {
  const voucher = VOUCHER_KINDS.includes(kind)
  return (
    <div className="overflow-hidden bg-white border rounded relative pointer-events-none select-none" style={{ height }} aria-hidden="true">
      <div style={{ width: 794, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        {voucher
          ? <VoucherPrint rec={SAMPLE_VOUCHER} kind={kind} template={template} title={TITLES[kind]} hideButton />
          : <InvoicePrint doc={SAMPLE_DOC} kind={kind} template={template} title={TITLES[kind]} hideButton />}
      </div>
    </div>
  )
}

export default function TemplateSettings() {
  const user = useUser()
  const isAdmin = ['Super Admin', 'Admin'].includes(user?.role)
  const record = useCollection('templateSettings')[0] || null
  const saved = record || { categories: {}, header: {}, useForAll: false }
  const [tab, setTab] = useState('sale')
  const [draft, setDraft] = useState(() => ({ ...blankTemplate(), ...(saved.categories?.[tab] || {}) }))
  const [header, setHeader] = useState(() => ({ ...(saved.header || {}) }))
  const [useForAll, setUseForAll] = useState(!!saved.useForAll && saved.allKind === tab)
  const shop = useShop()

  const open = (key) => {
    setTab(key)
    if (key !== 'header') {
      setDraft({ ...blankTemplate(), ...(saved.categories?.[key] || {}) })
      setUseForAll(!!saved.useForAll && saved.allKind === key)
    }
  }
  const write = async (patch) => {
    if (!isAdmin) { toast.error('Only an admin can change templates.'); return null }
    const next = { categories: saved.categories || {}, header: saved.header || {}, useForAll: !!saved.useForAll, allKind: saved.allKind || '', ...patch }
    return record ? db.update('templateSettings', record.id, next) : db.insert('templateSettings', next)
  }
  const saveCategory = async () => {
    // ticking "use for all" here makes this category's design the one for every document;
    // unticking it on the category that set it turns it off again
    const allPatch = useForAll ? { useForAll: true, allKind: tab } : saved.allKind === tab ? { useForAll: false, allKind: '' } : {}
    const ok = await write({ categories: { ...(saved.categories || {}), [tab]: draft }, ...allPatch })
    if (ok) toast.success(useForAll ? 'Saved. This design is now used for every document.' : 'Template saved.')
  }
  const saveHeader = async () => {
    const ok = await write({ header })
    if (ok) toast.success('Report header saved. It shows on every report and document.')
  }
  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }))
  const cat = TEMPLATE_CATEGORIES.find((c) => c.key === tab)
  const activeKey = saved.categories?.[tab]?.design || 'classic'

  return (
    <>
      <PageHeader title="Template Settings" />
      {!isAdmin && <p className="text-[13px] text-warning mb-3">You can look at the templates, but only an admin can change them.</p>}
      {saved.useForAll && (
        <p className="text-[13px] bg-info/10 text-info rounded px-3 py-2 mb-3">
          &quot;Use for all&quot; is on: every document uses the {TEMPLATE_CATEGORIES.find((c) => c.key === saved.allKind)?.label || 'Invoice Template'} design.
        </p>
      )}
      <div className="flex flex-wrap gap-1 border-b mb-4">
        {[...TEMPLATE_CATEGORIES, { key: 'header', label: 'Global Report Header' }].map((c) => (
          <button key={c.key} onClick={() => open(c.key)}
            className={`px-3 py-2 text-[13px] -mb-px border-b-2 ${tab === c.key ? 'border-primary text-primary font-medium' : 'border-transparent text-gray-600 hover:text-gray-800'}`}>
            {c.label}
          </button>
        ))}
      </div>

      {tab === 'header' ? (
        <Card title="Global Report Header">
          <p className="text-[12px] text-gray-500 mb-4">
            Shown at the top of every report (MIS, ledgers, books) and every document. Leave a box empty to use the branch details from Basic Settings › Add Branch.
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Organization Name"><Input value={header.name || ''} placeholder={shop.name} onChange={(e) => setHeader({ ...header, name: e.target.value })} /></Field>
            <Field label="Mobile Number(s)"><Input value={header.mobile || ''} placeholder="01711-000000, 01911-000000" onChange={(e) => setHeader({ ...header, mobile: e.target.value })} /></Field>
            <Field label="Address" className="md:col-span-2"><Input value={header.address || ''} placeholder={shop.address} onChange={(e) => setHeader({ ...header, address: e.target.value })} /></Field>
            <Field label="Email"><Input value={header.email || ''} onChange={(e) => setHeader({ ...header, email: e.target.value })} /></Field>
            <Field label="Website"><Input value={header.website || ''} onChange={(e) => setHeader({ ...header, website: e.target.value })} /></Field>
            <Field label="Dealer Information" className="md:col-span-2"><Input value={header.dealer || ''} placeholder="e.g. Authorised dealer of …" onChange={(e) => setHeader({ ...header, dealer: e.target.value })} /></Field>
            <div className="md:col-span-2 flex flex-wrap items-center gap-3">
              {header.logo && <img src={header.logo} alt="Logo" className="h-14 border rounded p-1" />}
              <label className="inline-flex items-center gap-2 cursor-pointer bg-primary text-white rounded px-3 py-[7px] text-[13px]">
                <Upload size={14} /> Upload Logo
                <input type="file" accept="image/*" className="hidden" onChange={(e) => readImage(e.target.files?.[0], (v) => setHeader((h) => ({ ...h, logo: v })))} />
              </label>
              {header.logo && <Button color="secondary" onClick={() => setHeader({ ...header, logo: '' })}><X size={14} /> Remove logo</Button>}
            </div>
          </div>
          <div className="flex gap-2 mt-5"><Button onClick={saveHeader} disabled={!isAdmin}>Save</Button></div>
        </Card>
      ) : (
        <>
          <Card title={`Select ${cat.label}`} actions={<span className="text-[12px] text-gray-500">Active: {DESIGNS.find((d) => d.key === activeKey)?.name}</span>}>
            <p className="text-[12px] text-gray-500 -mt-2 mb-4">{cat.hint}</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {DESIGNS.map((d) => (
                <button key={d.key} type="button" onClick={() => set('design', d.key)}
                  className={`text-left rounded border-2 p-2 transition ${draft.design === d.key ? 'border-primary shadow' : 'border-transparent hover:border-gray-300'}`}>
                  <Preview kind={tab} template={{ ...draft, design: d.key }} />
                  <p className="font-semibold text-[13px] mt-2 flex items-center gap-1.5">
                    {draft.design === d.key && <Check size={14} className="text-primary" />}{d.name}
                    {activeKey === d.key && <span className="ml-auto text-[11px] font-normal text-success">in use</span>}
                  </p>
                  <p className="text-[12px] text-gray-500">{d.features}</p>
                </button>
              ))}
            </div>
          </Card>

          <div className="grid lg:grid-cols-[1fr_1.2fr] gap-4">
            <Card title="Customize">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Field label="Colour"><input type="color" value={draft.color || DEFAULT_COLOR} onChange={(e) => set('color', e.target.value)} className="h-9 w-16 border rounded cursor-pointer" /></Field>
                  <div className="flex gap-1 pt-6">
                    {['#ec6a1f', '#5b73e8', '#34c38f', '#f46a6a', '#343a40', '#8e44ad'].map((c) => (
                      <button key={c} type="button" title={c} onClick={() => set('color', c)} className="w-6 h-6 rounded-full border" style={{ background: c }} />
                    ))}
                  </div>
                </div>
                <Field label="Document Title (empty = default)"><Input value={draft.title} placeholder={TITLES[tab]} onChange={(e) => set('title', e.target.value)} /></Field>
                <Field label="Header Line (dealer info, slogan…)"><Input value={draft.headerNote} onChange={(e) => set('headerNote', e.target.value)} /></Field>
                <Field label="Footer Note"><Textarea rows={2} value={draft.footerNote} onChange={(e) => set('footerNote', e.target.value)} /></Field>
                <div className="flex flex-wrap items-center gap-3">
                  {draft.banner && <img src={draft.banner} alt="Banner" className="h-12 border rounded" />}
                  <label className="inline-flex items-center gap-2 cursor-pointer bg-primary text-white rounded px-3 py-[7px] text-[13px]">
                    <Upload size={14} /> Upload Banner
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => readImage(e.target.files?.[0], (v) => set('banner', v))} />
                  </label>
                  {draft.banner && <Button color="secondary" onClick={() => set('banner', '')}><X size={14} /> Remove</Button>}
                </div>
                {!VOUCHER_KINDS.includes(tab) && (
                  <div className="flex flex-wrap gap-4 text-[13px]">
                    <label className="flex items-center gap-2"><input type="checkbox" checked={draft.showTerms !== false} onChange={(e) => set('showTerms', e.target.checked)} /> Show terms</label>
                    <label className="flex items-center gap-2"><input type="checkbox" checked={draft.showDealers !== false} onChange={(e) => set('showDealers', e.target.checked)} /> Show dealer logos</label>
                  </div>
                )}
                <label className="flex items-center gap-2 text-[13px] font-medium pt-2 border-t">
                  <input type="checkbox" checked={useForAll} onChange={(e) => setUseForAll(e.target.checked)} /> Use this design for all categories
                </label>
                <div className="flex gap-2 pt-1">
                  <Button onClick={saveCategory} disabled={!isAdmin}>Save</Button>
                  <Button color="secondary" onClick={() => setDraft(blankTemplate())}>Reset to default</Button>
                </div>
              </div>
            </Card>
            <Card title="Live Preview">
              <Preview kind={tab} template={draft} scale={0.62} height={680} />
            </Card>
          </div>
        </>
      )}
    </>
  )
}
