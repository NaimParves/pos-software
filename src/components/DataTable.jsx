import { useMemo, useState } from 'react'
import { ArrowUpDown } from 'lucide-react'

// Table with "Show N entries", search, column sorting and pagination.
// columns: [{ key, label, render?(row, index), align?, sortable? }]
export default function DataTable({ columns, rows, searchable = true, pageSizes = [10, 25, 50, 100], footer, empty = 'No data available in table' }) {
  const [q, setQ] = useState('')
  const [size, setSize] = useState(pageSizes[0])
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState({ key: null, dir: 1 })

  const filtered = useMemo(() => {
    let r = rows
    if (q) {
      const s = q.toLowerCase()
      r = r.filter((row) => columns.some((c) => String(row[c.key] ?? '').toLowerCase().includes(s)))
    }
    if (sort.key) {
      r = [...r].sort((a, b) => {
        const x = a[sort.key], y = b[sort.key]
        if (typeof x === 'number' && typeof y === 'number') return (x - y) * sort.dir
        return String(x ?? '').localeCompare(String(y ?? '')) * sort.dir
      })
    }
    return r
  }, [rows, q, sort, columns])

  const pages = Math.max(1, Math.ceil(filtered.length / size))
  const current = Math.min(page, pages)
  const start = (current - 1) * size
  const visible = filtered.slice(start, start + size)

  return (
    <div>
      {searchable && (
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3 text-[13px] text-gray-600">
          <div className="flex items-center gap-2">
            Show
            <select value={size} onChange={(e) => { setSize(+e.target.value); setPage(1) }} className="border border-gray-300 rounded px-1 py-0.5">
              {pageSizes.map((s) => <option key={s}>{s}</option>)}
            </select>
            entries
          </div>
          <div className="flex items-center gap-2">
            Search:
            <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} className="border border-gray-300 rounded px-2 py-1 w-44 focus:outline-none focus:border-primary" />
          </div>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-[13px] text-gray-700 border border-gray-200">
          <thead className="bg-white">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  onClick={() => c.sortable !== false && c.key !== 'action' && setSort((s) => ({ key: c.key, dir: s.key === c.key ? -s.dir : 1 }))}
                  className={`border-b border-gray-200 px-3 py-3 font-semibold whitespace-nowrap select-none ${c.align === 'right' ? 'text-right' : 'text-left'} ${c.sortable !== false && c.key !== 'action' ? 'cursor-pointer' : ''}`}
                >
                  <span className="inline-flex items-center gap-1">
                    {c.label}
                    {c.sortable !== false && c.key !== 'action' && <ArrowUpDown size={11} className="text-gray-300" />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr><td colSpan={columns.length} className="text-center py-3 text-gray-500 border-t">{empty}</td></tr>
            )}
            {visible.map((row, i) => (
              <tr key={row.id || i} className="border-t border-gray-200 hover:bg-gray-50">
                {columns.map((c) => (
                  <td key={c.key} className={`px-3 py-2.5 ${c.align === 'right' ? 'text-right' : ''}`}>
                    {c.render ? c.render(row, start + i) : row[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {footer && <tfoot className="font-semibold bg-gray-50">{footer}</tfoot>}
        </table>
      </div>
      {searchable && (
        <div className="flex flex-wrap items-center justify-between gap-3 mt-3 text-[13px] text-gray-600">
          <span>
            Showing {filtered.length ? start + 1 : 0} to {Math.min(start + size, filtered.length)} of {filtered.length} entries
          </span>
          <div className="flex">
            <PgBtn disabled={current === 1} onClick={() => setPage(current - 1)}>Previous</PgBtn>
            {Array.from({ length: pages }, (_, i) => i + 1).slice(Math.max(0, current - 3), current + 2).map((p) => (
              <PgBtn key={p} active={p === current} onClick={() => setPage(p)}>{p}</PgBtn>
            ))}
            <PgBtn disabled={current === pages} onClick={() => setPage(current + 1)}>Next</PgBtn>
          </div>
        </div>
      )}
    </div>
  )
}

function PgBtn({ active, disabled, children, onClick }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`border border-gray-200 -ml-px px-3 py-1.5 first:rounded-l last:rounded-r ${active ? 'bg-primary text-white border-primary' : 'bg-white'} disabled:text-gray-300`}
    >
      {children}
    </button>
  )
}
