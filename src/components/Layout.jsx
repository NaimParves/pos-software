import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  ChevronDown, Menu, Home, List, ShoppingCart, History, Briefcase, Undo2, Barcode, LogOut, User, RotateCcw, KeyRound,
} from 'lucide-react'
import { Modal, Field, Input, Button } from './ui'
import { api } from '../store/api'
import { MENU } from '../config/menu'
import { SHOP } from '../config/shop'
import { useCollection, db } from '../store/db'
import { logout, useUser } from '../store/auth'

const hasPath = (item, path) => item.path === path || (item.children || []).some((c) => hasPath(c, path))

function MenuItem({ item, depth = 0, path, onNavigate }) {
  const [open, setOpen] = useState(() => hasPath(item, path))
  useEffect(() => { if (hasPath(item, path)) setOpen(true) }, [path, item])
  const Icon = item.icon
  const pad = depth === 0 ? 'pl-5' : depth === 1 ? 'pl-11' : 'pl-14'
  const size = depth === 0 ? 'text-[13.5px]' : 'text-[13px]'

  if (!item.children) {
    return (
      <NavLink
        to={item.path}
        onClick={onNavigate}
        className={({ isActive }) =>
          `flex items-center gap-3 ${pad} pr-4 py-2 ${size} transition ${isActive ? 'text-white font-medium' : 'text-sidebar-text hover:text-white'}`
        }
      >
        {Icon && <Icon size={17} />}
        {item.label}
      </NavLink>
    )
  }
  const active = hasPath(item, path)
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center gap-3 ${pad} pr-4 py-2 ${size} transition ${active ? 'text-white' : 'text-sidebar-text hover:text-white'}`}
      >
        {Icon && <Icon size={17} />}
        <span className="flex-1 text-left">{item.label}</span>
        <ChevronDown size={14} className={`transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="pb-1">
          {item.children.map((c) => <MenuItem key={c.label + (c.path || '')} item={c} depth={depth + 1} path={path} onNavigate={onNavigate} />)}
        </div>
      )}
    </div>
  )
}

const QUICK = [
  { to: '/home', icon: Home, color: 'bg-danger', title: 'Dashboard' },
  { to: '/invoices/all-sales', icon: List, color: 'bg-info', title: 'List of Sales' },
  { to: '/invoices', icon: ShoppingCart, color: 'bg-primary', title: 'Daily Sales' },
  { to: '/salesreturn', icon: History, color: 'bg-info', title: 'Sales Return' },
  { to: '/bills', icon: Briefcase, color: 'bg-warning', title: 'Purchase' },
  { to: '/purchasereturn', icon: Undo2, color: 'bg-info', title: 'Purchase Return' },
  { to: '/products/barcode-print', icon: Barcode, color: 'bg-[#5b73e8]', title: 'Print Barcode' },
]

export default function Layout() {
  const { pathname } = useLocation()
  const nav = useNavigate()
  const user = useUser()
  const products = useCollection('products')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [pwOpen, setPwOpen] = useState(false)
  const stockOut = products.filter((p) => Number(p.stock) <= Number(p.alertQty || 0)).length

  const sidebar = (
    <aside className="w-[250px] bg-sidebar h-full overflow-y-auto print:hidden">
      <Link to="/home" className="flex justify-center py-4">
        <div className="w-12 h-12 rounded bg-white flex items-center justify-center text-primary font-bold text-lg">POS</div>
      </Link>
      <div className="px-5 pb-2 text-[11px] font-semibold uppercase tracking-wider text-[#6a7187]">Menu</div>
      <nav className="pb-8">
        {MENU.map((m) => <MenuItem key={m.label} item={m} path={pathname} onNavigate={() => setMobileOpen(false)} />)}
      </nav>
    </aside>
  )

  return (
    <div className="flex h-screen bg-page print:block print:h-auto print:bg-white">
      {/* desktop sidebar */}
      <div className={`hidden lg:block shrink-0 transition-all ${collapsed ? 'w-0 overflow-hidden' : 'w-[250px]'}`}>{sidebar}</div>
      {/* mobile sidebar */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          {sidebar}
          <div className="flex-1 bg-black/40" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-[70px] bg-white shadow-sm flex items-center gap-3 px-4 shrink-0 print:hidden">
          <button
            className="text-gray-600 p-1"
            onClick={() => (window.innerWidth < 1024 ? setMobileOpen(true) : setCollapsed((c) => !c))}
          >
            <Menu size={20} />
          </button>
          <div className="hidden md:flex gap-1">
            {QUICK.map(({ to, icon: Icon, color, title }) => (
              <Link key={to} to={to} title={title} className={`${color} text-white w-10 h-10 rounded flex items-center justify-center hover:opacity-90`}>
                <Icon size={20} />
              </Link>
            ))}
          </div>
          <div className="flex-1" />
          <Link to="/reports/emergency-item-list" className="bg-danger text-white text-[13px] font-medium rounded px-3 py-2 whitespace-nowrap">
            Stock Out : {stockOut}
          </Link>
          <div className="relative">
            <button onClick={() => setMenuOpen((o) => !o)} className="flex items-center gap-2 text-[13px] text-gray-600 px-2">
              <span className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center"><User size={16} /></span>
              <span className="hidden sm:inline">{user?.name}</span>
              <ChevronDown size={14} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded shadow-lg border text-[13px] z-30" onMouseLeave={() => setMenuOpen(false)}>
                <button className="w-full flex items-center gap-2 px-4 py-2 hover:bg-gray-50 text-gray-700" onClick={() => { setPwOpen(true); setMenuOpen(false) }}>
                  <KeyRound size={14} /> Change password
                </button>
                {['Super Admin', 'Admin'].includes(user?.role) && (
                  <button
                    className="w-full flex items-center gap-2 px-4 py-2 hover:bg-gray-50 text-gray-700"
                    onClick={() => { if (confirm('Delete ALL data on the server and load the sample data again? This cannot be undone.')) db.reset(); setMenuOpen(false) }}
                  >
                    <RotateCcw size={14} /> Reset to sample data
                  </button>
                )}
                <button className="w-full flex items-center gap-2 px-4 py-2 hover:bg-gray-50 text-danger" onClick={() => { logout(); nav('/login') }}>
                  <LogOut size={14} /> Logout
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto print:overflow-visible">
          <div className="p-4 md:p-6"><Outlet /></div>
          <footer className="bg-[#f2f2f5] text-right text-[13px] text-gray-500 px-6 py-4 print:hidden">
            ©{new Date().getFullYear()} {SHOP.name} | {SHOP.footer}
          </footer>
        </main>
      </div>
      <ChangePassword open={pwOpen} onClose={() => setPwOpen(false)} />
    </div>
  )
}

function ChangePassword({ open, onClose }) {
  const [f, setF] = useState({ current: '', next: '', confirm: '' })
  const [msg, setMsg] = useState('')
  const submit = async () => {
    if (f.next !== f.confirm) { setMsg('The new passwords do not match.'); return }
    try {
      await api('/auth/change-password', { method: 'POST', body: { current: f.current, next: f.next } })
      setF({ current: '', next: '', confirm: '' }); setMsg(''); onClose()
      alert('Password changed.')
    } catch (e) { setMsg(e.message) }
  }
  return (
    <Modal open={open} onClose={onClose} title="Change password">
      <div className="space-y-3">
        <Field label="Current password"><Input type="password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} /></Field>
        <Field label="New password (at least 6 characters)"><Input type="password" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} /></Field>
        <Field label="Confirm new password"><Input type="password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} /></Field>
        {msg && <p className="text-danger text-[13px]">{msg}</p>}
        <div className="flex gap-1"><Button onClick={submit}>Save</Button><Button color="secondary" onClick={onClose}>Close</Button></div>
      </div>
    </Modal>
  )
}
