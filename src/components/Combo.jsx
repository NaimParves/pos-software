import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown } from 'lucide-react'

const LIST_HEIGHT = 290 // search box + up to 240px of options

// Searchable dropdown. options: [{ value, label }]
// The list is drawn on top of the page (portal) so a scrolling table or card
// can never cut it off, and it opens upwards when there is no room below.
export default function Combo({ value, onChange, options, placeholder = '--Select--', className = '' }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [pos, setPos] = useState(null)
  const ref = useRef(null)
  const listRef = useRef(null)
  const selected = options.find((o) => o.value === value)

  const place = () => {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    const below = window.innerHeight - r.bottom
    const up = below < LIST_HEIGHT && r.top > below
    const width = Math.max(r.width, 220)
    const left = Math.min(r.left, window.innerWidth - width - 8)
    setPos({
      left: Math.max(8, left), width, up,
      top: up ? undefined : r.bottom + 4,
      bottom: up ? window.innerHeight - r.top + 4 : undefined,
      maxList: Math.max(120, (up ? r.top : below) - 70),
    })
  }

  useLayoutEffect(() => { if (open) place() }, [open])

  useEffect(() => {
    if (!open) return
    const close = (e) => {
      if (ref.current?.contains(e.target) || listRef.current?.contains(e.target)) return
      setOpen(false)
    }
    const onMove = (e) => { if (!listRef.current?.contains(e.target)) place() }
    document.addEventListener('mousedown', close)
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', place)
    return () => {
      document.removeEventListener('mousedown', close)
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', place)
    }
  }, [open])

  const list = useMemo(() => {
    const s = q.toLowerCase()
    return s ? options.filter((o) => o.label.toLowerCase().includes(s)) : options
  }, [q, options])

  const pick = (v) => { onChange(v); setOpen(false) }

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); setQ('') }}
        className="w-full flex items-center justify-between border border-gray-300 rounded px-3 py-[7px] text-[13px] bg-white text-left focus:outline-none focus:border-primary"
      >
        <span className={`truncate ${selected ? 'text-gray-700' : 'text-gray-500'}`}>{selected ? selected.label : placeholder}</span>
        <ChevronDown size={14} className="text-gray-400 shrink-0" />
      </button>
      {open && pos && createPortal(
        <div
          ref={listRef}
          style={{ position: 'fixed', left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom }}
          className={`z-[60] bg-white border border-gray-200 rounded shadow-lg flex ${pos.up ? 'flex-col-reverse' : 'flex-col'}`}
        >
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && list.length) { e.preventDefault(); pick(list[0].value) }
              if (e.key === 'Escape') setOpen(false)
            }}
            placeholder="Search…"
            className="w-[calc(100%-12px)] m-1.5 border border-gray-300 rounded px-2 py-1 text-[13px] focus:outline-none focus:border-primary"
          />
          <ul className="overflow-y-auto text-[13px]" style={{ maxHeight: Math.min(240, pos.maxList) }}>
            {list.length === 0 && <li className="px-3 py-2 text-gray-400">No results found</li>}
            {list.map((o) => (
              <li
                key={o.value}
                onClick={() => pick(o.value)}
                className={`px-3 py-1.5 cursor-pointer hover:bg-primary hover:text-white ${o.value === value ? 'bg-gray-100' : ''}`}
              >
                {o.label}
              </li>
            ))}
          </ul>
        </div>,
        document.body,
      )}
    </div>
  )
}
