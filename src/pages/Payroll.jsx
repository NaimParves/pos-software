import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle, BadgeCheck, CheckCircle2, Download, Eye, HandCoins, Pencil, Plus, Printer, Receipt, Save, Search, Send, Trash2, User, Users, Wallet,
} from 'lucide-react'
import { PageHeader, Card, Field, Input, Select, Button, Modal, Badge } from '../components/ui'
import Combo from '../components/Combo'
import DataTable from '../components/DataTable'
import VoucherPrint from '../components/VoucherPrint'
import { StatCard, taka } from '../components/StatCard'
import { toast } from '../components/Toast'
import { db, useDb } from '../store/db'
import { useCan } from '../store/permissions'
import { useShop } from '../store/shop'
import { PAYMENT_METHODS } from '../config/shop'
import {
  advancesOf, carryFrom, gross, monthLabel, netOf, payState, sheetRowFor, sheetStatus, sheetTotals, thisMonth,
} from '../store/payroll'
import { displayDate, inRange, money, num, round2, today } from '../utils/format'
import { amountInWords } from '../utils/words'

const employeesOf = (s) => s.contacts.filter((c) => c.type === 'employee')
const empLabel = (e) => `${e.code ? `${e.code} - ` : ''}${e.name}${e.designation ? ` (${e.designation})` : ''}`
const STATUS_TONE = { Paid: 'success', Partial: 'info', Unpaid: 'warning', 'Over-Advanced': 'danger', Approved: 'success', Draft: 'warning', 'Pending Approval': 'info', 'No Sheet': 'warning' }
const StatusBadge = ({ status }) => <Badge color={STATUS_TONE[status] || 'warning'}>{status}</Badge>
const downloadCsv = (name, rows) => {
  const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv' }))
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

// ---------- Attendance / Manual Attendance ----------
// Pick a date and a staff category: every employee is listed with a status
// (Present / Absent / Late / Leave) and in/out times. Below, look up one
// employee's (or everyone's) attendance for a date range.
export function ManualAttendance() {
  const s = useDb()
  const allow = useCan()
  const employees = employeesOf(s)
  const categories = [...new Set(employees.map((e) => e.designation).filter(Boolean))]
  const [date, setDate] = useState(today())
  const [category, setCategory] = useState('')
  const [edits, setEdits] = useState({})
  const [saving, setSaving] = useState(false)
  const list = employees.filter((e) => !category || e.designation === category)
  const recordOf = (e) => s.attendance.find((a) => a.employeeId === e.id && a.date === date)
  const val = (e, k) => edits[e.id]?.[k] ?? recordOf(e)?.[k] ?? ''
  const change = (e, k, v) => setEdits((x) => ({ ...x, [e.id]: { ...x[e.id], [k]: v } }))
  const markAll = (status) => setEdits((x) => Object.fromEntries(list.map((e) => [e.id, { ...x[e.id], status }])))

  const save = async () => {
    const changed = list.filter((e) => edits[e.id])
    if (!changed.length) { toast.error('Nothing changed.'); return }
    if (changed.some((e) => recordOf(e)) && !allow.edit) { toast.error('Your role is not allowed to change saved attendance.'); return }
    setSaving(true)
    await Promise.all(changed.map((e) => {
      const rec = { date, employeeId: e.id, employeeName: e.name, status: val(e, 'status') || 'Present', inTime: val(e, 'inTime'), outTime: val(e, 'outTime') }
      const old = recordOf(e)
      return old ? db.update('attendance', old.id, rec) : db.insert('attendance', rec)
    }))
    setSaving(false)
    setEdits({})
    toast.success(`Attendance saved for ${changed.length} employee(s).`)
  }

  return (
    <>
      <PageHeader title="Manual Attendance" />
      <Card>
        <div className="flex flex-wrap gap-3 items-end mb-4">
          <Field label="Date *"><Input type="date" value={date} onChange={(e) => { setDate(e.target.value); setEdits({}) }} /></Field>
          <Field label="Employee Category">
            <Select className="!w-56" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="All Employees" options={categories} />
          </Field>
          <div className="flex-1" />
          <Button color="success" onClick={() => markAll('Present')}>Mark all Present</Button>
          <Button onClick={save} disabled={saving}><Save size={14} /> Save Attendance</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-[13px] border">
            <thead className="bg-gray-50">
              <tr>{['SL', 'Image', 'ID', 'Name', 'Phone', 'Status', 'In Time', 'Out Time'].map((h) => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr>
            </thead>
            <tbody>
              {list.map((e, i) => {
                const st = val(e, 'status')
                return (
                  <tr key={e.id} className={`border-t ${edits[e.id] ? 'bg-warning/5' : ''}`}>
                    <td className="px-3 py-1.5">{i + 1}</td>
                    <td className="px-3 py-1.5">{e.image ? <img src={e.image} alt="" className="w-8 h-8 rounded-full object-cover" /> : <span className="w-8 h-8 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center"><User size={15} /></span>}</td>
                    <td className="px-3 py-1.5">{e.code}</td>
                    <td className="px-3 py-1.5">{e.name}<div className="text-[11px] text-gray-500">{e.designation}</div></td>
                    <td className="px-3 py-1.5">{e.phone}</td>
                    <td className="px-3 py-1.5 w-36">
                      <Select value={st} onChange={(x) => change(e, 'status', x.target.value)} placeholder="— Select —" options={['Present', 'Absent', 'Late', 'Leave']}
                        className={st === 'Absent' ? '!text-danger' : st === 'Late' ? '!text-[#b07d24]' : st === 'Leave' ? '!text-info' : st === 'Present' ? '!text-success' : ''} />
                    </td>
                    <td className="px-3 py-1.5 w-32"><Input type="time" value={val(e, 'inTime')} onChange={(x) => change(e, 'inTime', x.target.value)} /></td>
                    <td className="px-3 py-1.5 w-32"><Input type="time" value={val(e, 'outTime')} onChange={(x) => change(e, 'outTime', x.target.value)} /></td>
                  </tr>
                )
              })}
              {!list.length && <tr><td colSpan={8} className="px-3 py-4 text-center text-gray-500">No employees. Add them on Basic Settings › Registers › Add Employee.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
      <AttendanceHistory />
    </>
  )
}

function AttendanceHistory() {
  const s = useDb()
  const employees = employeesOf(s)
  const [f, setF] = useState({ employeeId: '', from: today().slice(0, 8) + '01', to: today() })
  const [a, setA] = useState(f)
  const rows = s.attendance
    .filter((x) => (!a.employeeId || x.employeeId === a.employeeId) && inRange(x.date, a.from, a.to))
    .map((x) => ({ ...x, code: employees.find((e) => e.id === x.employeeId)?.code || '' }))
    .sort((x, y) => y.date.localeCompare(x.date))
  const count = (st) => rows.filter((x) => x.status === st).length
  return (
    <Card title="Attendance Search">
      <div className="flex flex-wrap gap-3 items-end mb-4">
        <Field label="Employee">
          <Combo className="w-64" value={f.employeeId} onChange={(v) => setF({ ...f, employeeId: v })} placeholder="All" options={[{ value: '', label: 'All' }, ...employees.map((e) => ({ value: e.id, label: empLabel(e) }))]} />
        </Field>
        <Field label="From"><Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
        <Field label="To"><Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
        <Button onClick={() => setA(f)}><Search size={15} /> Search</Button>
      </div>
      <div className="flex flex-wrap gap-2 mb-3 text-[12px]">
        <Badge>Present {count('Present')}</Badge><Badge color="danger">Absent {count('Absent')}</Badge><Badge color="warning">Late {count('Late')}</Badge><Badge color="info">Leave {count('Leave')}</Badge>
      </div>
      <DataTable rows={rows} columns={[
        { key: 'date', label: 'Date', render: (r) => displayDate(r.date) }, { key: 'code', label: 'ID' }, { key: 'employeeName', label: 'Name' },
        { key: 'status', label: 'Status', render: (r) => <Badge color={{ Present: 'success', Absent: 'danger', Late: 'warning', Leave: 'info' }[r.status]}>{r.status}</Badge> },
        { key: 'inTime', label: 'In Time' }, { key: 'outTime', label: 'Out Time' },
      ]} />
    </Card>
  )
}

// ---------- Payroll / Process Salary Sheet ----------
const EDIT_COLS = [['basic', 'Basic'], ['commission', 'Commission / Bonus'], ['allowance', 'Allowances'], ['overtime', 'Overtime'], ['deduction', 'Deductions'], ['carry', 'Carry Fwd']]

function newRow(s, e, period) {
  const absent = s.attendance.filter((a) => a.employeeId === e.id && a.status === 'Absent' && a.date.startsWith(period)).length
  const basic = num(e.salary)
  return {
    employeeId: e.id, code: e.code || '', name: e.name, designation: e.designation || '', branch: e.branch || '',
    basic, commission: 0, allowance: 0, overtime: 0, deduction: round2((basic / 30) * absent), carry: carryFrom(s, e.id, period), absent,
  }
}

export function ProcessSalarySheet() {
  const [params] = useSearchParams()
  const id = params.get('edit') || ''
  return <SheetEditor key={id || 'new'} id={id} />
}

function SheetEditor({ id }) {
  const s = useDb()
  const nav = useNavigate()
  const allow = useCan('/payroll/process-monthly-salary')
  const employees = employeesOf(s)
  const branches = s.branches.map((b) => b.name)
  const roles = [...new Set(employees.map((e) => e.designation).filter(Boolean))]
  const existing = id ? s.salarySheets.find((x) => x.id === id) : null
  const [period, setPeriod] = useState(existing?.period || thisMonth())
  const [branch, setBranch] = useState(existing?.branch || '')
  const [role, setRole] = useState(existing?.role || '')
  const [rows, setRows] = useState(() => (Array.isArray(existing?.rows) ? existing.rows.map((r) => ({ ...r })) : []))
  const [saving, setSaving] = useState(false)
  const [history, setHistory] = useState(null) // employee whose advances are shown
  const [quick, setQuick] = useState(null) // employee getting a partial payment
  const status = existing ? sheetStatus(s, existing) : 'Draft'
  const locked = ['Approved', 'Paid'].includes(status)

  const load = () => {
    const pick = employees.filter((e) => (!branch || e.branch === branch) && (!role || e.designation === role))
    if (!pick.length) { toast.error('No employees match. Add employees (with salary) on Registers › Add Employee.'); return }
    const clash = s.salarySheets.find((x) => x.id !== id && x.period === period && Array.isArray(x.rows) && x.rows.some((r) => pick.some((e) => e.id === r.employeeId)))
    if (clash && !confirm(`${clash.number} already has some of these employees for ${monthLabel(period)}. Make another sheet anyway?`)) return
    setRows(pick.map((e) => newRow(s, e, period)))
  }
  const setCell = (i, k, v) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: v } : r)))
  const live = rows.map((r) => ({ r, st: payState(s, r.employeeId, period, { ...r, ...Object.fromEntries(EDIT_COLS.map(([k]) => [k, num(r[k])])) }) }))
  const over = live.filter(({ st }) => st.status === 'Over-Advanced')
  const sum = (f) => round2(live.reduce((a, x) => a + f(x), 0))

  const save = async (nextStatus) => {
    if (!rows.length) { toast.error('Load the employees first.'); return }
    if (existing && !allow.edit) { toast.error('Your role is not allowed to edit salary sheets.'); return }
    if (nextStatus === 'Approved' && !confirm(`Approve the ${monthLabel(period)} salary sheet? It is locked after approval.`)) return
    setSaving(true)
    const body = {
      period, branch, role, status: nextStatus,
      rows: rows.map((r) => ({ ...r, ...Object.fromEntries(EDIT_COLS.map(([k]) => [k, num(r[k])])) })),
      ...(nextStatus === 'Approved' ? { approvedAt: new Date().toISOString() } : {}),
    }
    const rec = existing ? await db.update('salarySheets', existing.id, body) : await db.insert('salarySheets', body, { number: 'SAL' })
    setSaving(false)
    if (!rec) return
    toast.success(`${rec.number} saved as ${nextStatus}.`)
    if (!existing) nav(`/payroll/process-monthly-salary/create?edit=${rec.id}`, { replace: true })
  }

  const inp = 'w-24 border border-gray-300 rounded px-1.5 py-1 text-right text-[13px] focus:outline-none focus:border-primary disabled:bg-gray-50'
  return (
    <>
      <PageHeader title="Process Salary Sheet" />
      <Card>
        <div className="flex flex-wrap gap-3 items-end">
          <Field label="Month & Year *"><Input type="month" value={period} disabled={!!existing} onChange={(e) => { setPeriod(e.target.value); setRows([]) }} /></Field>
          <Field label="Showroom / Branch"><Select className="!w-48" value={branch} disabled={!!existing} onChange={(e) => setBranch(e.target.value)} placeholder="All" options={branches} /></Field>
          <Field label="Staff Category / Role"><Select className="!w-48" value={role} disabled={!!existing} onChange={(e) => setRole(e.target.value)} placeholder="All" options={roles} /></Field>
          {!existing && <Button onClick={load}><Users size={15} /> Load Employees</Button>}
          <div className="flex-1" />
          {existing && <span className="text-[13px]">{existing.number} · <StatusBadge status={status} /></span>}
        </div>
      </Card>

      {over.length > 0 && (
        <div className="mb-4 rounded border border-danger/40 bg-danger/5 px-4 py-3 text-[13px] text-danger flex gap-2">
          <AlertTriangle size={18} className="shrink-0" />
          <div>
            <b>Over-advance:</b> {over.map(({ r, st }) => `${r.name} took ${money(st.excess)} more than this month's pay`).join('; ')}.
            The extra is carried forward and taken off next month&apos;s sheet (Carry Fwd).
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <Card title={`Salary Sheet — ${monthLabel(period)}`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1300px] text-[13px]">
              <thead className="bg-gray-50">
                <tr className="text-left">
                  <th className="px-2 py-2">ID</th><th className="px-2 py-2">Employee</th>
                  {EDIT_COLS.map(([, l]) => <th key={l} className="px-2 py-2 text-right">{l}</th>)}
                  <th className="px-2 py-2 text-right">Net Entitlement</th><th className="px-2 py-2 text-center">Payout Count</th>
                  <th className="px-2 py-2 text-right">Total Taken</th><th className="px-2 py-2 text-right">Remaining Payable</th><th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {live.map(({ r, st }, i) => (
                  <tr key={r.employeeId} className={`border-t ${st.status === 'Over-Advanced' ? 'bg-danger/5' : ''}`}>
                    <td className="px-2 py-1.5">{r.code}</td>
                    <td className="px-2 py-1.5">{r.name}<div className="text-[11px] text-gray-500">{r.designation}{r.absent ? ` · absent ${r.absent} day(s)` : ''}</div></td>
                    {EDIT_COLS.map(([k]) => (
                      <td key={k} className="px-2 py-1.5 text-right"><input type="number" className={inp} disabled={locked} value={r[k]} onChange={(e) => setCell(i, k, e.target.value)} /></td>
                    ))}
                    <td className="px-2 py-1.5 text-right font-semibold">{money(st.net)}</td>
                    <td className="px-2 py-1.5 text-center">
                      <button className="text-primary underline disabled:no-underline disabled:text-gray-400" disabled={!st.takenCount} onClick={() => setHistory(r)}>{st.takenCount} time(s)</button>
                    </td>
                    <td className="px-2 py-1.5 text-right">{money(st.taken)}</td>
                    <td className={`px-2 py-1.5 text-right font-semibold ${st.remaining < 0 ? 'text-danger' : ''}`}>
                      {money(st.remaining)}{st.remaining < 0 && <div><Badge color="danger">Over-Advance</Badge></div>}
                    </td>
                    <td className="px-2 py-1.5">
                      <Button color="success" className="!px-2 !py-1" title="Add a partial payment / advance" onClick={() => setQuick(r)}><Plus size={13} /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 font-semibold">
                <tr className="border-t">
                  <td colSpan={2} className="px-2 py-2 text-right">Total ({rows.length})</td>
                  {EDIT_COLS.map(([k]) => <td key={k} className="px-2 py-2 text-right">{money(sum(({ r }) => num(r[k])))}</td>)}
                  <td className="px-2 py-2 text-right">{money(sum(({ st }) => st.net))}</td>
                  <td className="px-2 py-2 text-center">{sum(({ st }) => st.takenCount)}</td>
                  <td className="px-2 py-2 text-right">{money(sum(({ st }) => st.taken))}</td>
                  <td className="px-2 py-2 text-right">{money(sum(({ st }) => st.remaining))}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="text-[12px] text-gray-500 mt-2">
            Net Entitlement = Basic + Commission/Bonus + Allowances + Overtime − Deductions − Carry Fwd. Deductions start at one day&apos;s basic for each Absent day;
            Carry Fwd is last month&apos;s over-advance. Remaining Payable = Net Entitlement − Total Taken.
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            {!locked && <Button color="secondary" disabled={saving} onClick={() => save('Draft')}><Save size={14} /> Save Draft</Button>}
            {!locked && <Button color="info" disabled={saving} onClick={() => save('Pending Approval')}><Send size={14} /> Submit for Approval</Button>}
            {!locked && <Button color="success" disabled={saving} onClick={() => save('Approved')}><BadgeCheck size={14} /> Approve / Generate</Button>}
            {locked && <span className="text-[13px] text-success flex items-center gap-1"><CheckCircle2 size={15} /> Approved — the sheet is locked. Pay the balance from Pay Slip.</span>}
            <Button color="secondary" onClick={() => nav('/payroll/process-monthly-salary')}>Close</Button>
          </div>
        </Card>
      )}

      <Modal open={!!history} onClose={() => setHistory(null)} title={history && `Payouts — ${history.name}, ${monthLabel(period)}`} wide>
        {history && <AdvanceHistory advances={advancesOf(s, history.employeeId, period)} payments={[]} />}
      </Modal>
      <Modal open={!!quick} onClose={() => setQuick(null)} title={quick && `Partial payment — ${quick.name}`}>
        {quick && <AdvanceForm fixedEmployeeId={quick.employeeId} fixedPeriod={period} onSaved={() => setQuick(null)} compact />}
      </Modal>
    </>
  )
}

function AdvanceHistory({ advances, payments }) {
  const all = [...advances.map((a) => ({ ...a, kind: 'Advance / Partial' })), ...payments.map((p) => ({ ...p, kind: 'Salary payment' }))].sort((a, b) => a.date.localeCompare(b.date))
  const cell = 'border border-gray-300 px-2 py-1'
  return (
    <table className="w-full border-collapse text-[13px]">
      <thead className="bg-gray-50"><tr>{['SL', 'Date', 'Ref#', 'Type', 'Through', 'Note', 'Amount'].map((h) => <th key={h} className={`${cell} text-left`}>{h}</th>)}</tr></thead>
      <tbody>
        {all.map((a, i) => (
          <tr key={a.id}><td className={cell}>{i + 1}</td><td className={cell}>{displayDate(a.date)}</td><td className={cell}>{a.number}</td><td className={cell}>{a.kind}</td><td className={cell}>{a.method}</td><td className={cell}>{a.note}</td><td className={`${cell} text-right`}>{money(a.amount)}</td></tr>
        ))}
        {!all.length && <tr><td colSpan={7} className={`${cell} text-center text-gray-500 py-3`}>Nothing taken this month.</td></tr>}
      </tbody>
      {all.length > 0 && <tfoot className="font-semibold bg-gray-50"><tr><td colSpan={6} className={`${cell} text-right`}>Total</td><td className={`${cell} text-right`}>{money(all.reduce((x, a) => x + num(a.amount), 0))}</td></tr></tfoot>}
    </table>
  )
}

// ---------- Payroll / List of Salary Sheet ----------
export function SalarySheetList() {
  const s = useDb()
  const nav = useNavigate()
  const allow = useCan()
  const [f, setF] = useState({ period: '', branch: '', status: '' })
  const [a, setA] = useState(f)
  const [print, setPrint] = useState(null)
  const rows = s.salarySheets
    .map((x) => ({ ...x, shown: sheetStatus(s, x), t: sheetTotals(s, x) }))
    .filter((x) => (!a.period || x.period === a.period) && (!a.branch || x.branch === a.branch) && (!a.status || x.shown === a.status))
    .slice().reverse()
  const approve = (x) => confirm(`Approve ${x.number}? It is locked after approval.`) && db.update('salarySheets', x.id, { status: 'Approved', approvedAt: new Date().toISOString() })
  const exportCsv = (x) => downloadCsv(`${x.number}-${x.period}.csv`, [
    ['ID', 'Employee', 'Designation', 'Basic', 'Commission/Bonus', 'Allowances', 'Overtime', 'Deductions', 'Carry Fwd', 'Net Entitlement', 'Payout Count', 'Total Taken', 'Remaining Payable', 'Paid', 'Due', 'Status'],
    ...x.rows.map((r) => { const st = payState(s, r.employeeId, x.period, r); return [r.code, r.name, r.designation, r.basic, r.commission, r.allowance, r.overtime, r.deduction, r.carry, st.net, st.takenCount, st.taken, st.remaining, st.paid, st.due, st.status] }),
  ])
  const columns = [
    { key: 'number', label: 'Sheet ID' },
    { key: 'period', label: 'Month / Year', render: (x) => monthLabel(x.period) || `${x.month || ''} ${x.year || ''}` },
    { key: 'branch', label: 'Showroom / Branch', render: (x) => x.branch || 'All' },
    { key: 'employees', label: 'Employees', align: 'right', render: (x) => (Array.isArray(x.rows) ? x.t.employees : x.employeeName || '') },
    { key: 'gross', label: 'Total Gross', align: 'right', render: (x) => money(Array.isArray(x.rows) ? x.t.gross : x.amount) },
    { key: 'taken', label: 'Total Advance', align: 'right', render: (x) => money(x.t.taken) },
    { key: 'remaining', label: 'Net Remaining Payable', align: 'right', render: (x) => money(x.t.remaining) },
    { key: 'shown', label: 'Status', render: (x) => <StatusBadge status={x.shown} /> },
    { key: 'alert', label: 'Alert', sortable: false, render: (x) => (x.t.over ? <span className="text-danger flex items-center gap-1" title="Advance more than pay"><AlertTriangle size={14} /> {x.t.over}</span> : '') },
    {
      key: 'action', label: 'Action', render: (x) => (
        <div className="flex gap-1">
          {Array.isArray(x.rows) && <Button color="info" className="!px-2 !py-1" title="View" onClick={() => nav(`/payroll/process-monthly-salary/create?edit=${x.id}`)}><Eye size={13} /></Button>}
          {Array.isArray(x.rows) && ['Draft', 'Pending Approval'].includes(x.shown) && allow.edit && <Button color="success" className="!px-2 !py-1" title="Approve" onClick={() => approve(x)}><BadgeCheck size={13} /></Button>}
          {Array.isArray(x.rows) && <Button color="secondary" className="!px-2 !py-1" title="Print" onClick={() => setPrint(x)}><Printer size={13} /></Button>}
          {Array.isArray(x.rows) && <Button color="secondary" className="!px-2 !py-1" title="Export to Excel (CSV)" onClick={() => exportCsv(x)}><Download size={13} /></Button>}
          {(x.shown === 'Draft' || !Array.isArray(x.rows)) && allow.delete && <Button color="danger" className="!px-2 !py-1" title="Delete (drafts only)" onClick={() => confirm(`Delete ${x.number || 'this sheet'}?`) && db.remove('salarySheets', x.id)}><Trash2 size={13} /></Button>}
        </div>
      ),
    },
  ]
  return (
    <>
      <PageHeader title="List of Salary Sheet" />
      <Card>
        <div className="flex flex-wrap gap-3 items-end mb-4">
          <Field label="Month & Year"><Input type="month" value={f.period} onChange={(e) => setF({ ...f, period: e.target.value })} /></Field>
          <Field label="Showroom / Branch"><Select className="!w-48" value={f.branch} onChange={(e) => setF({ ...f, branch: e.target.value })} placeholder="All" options={s.branches.map((b) => b.name)} /></Field>
          <Field label="Status"><Select className="!w-44" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} placeholder="All" options={['Draft', 'Pending Approval', 'Approved', 'Paid']} /></Field>
          <Button onClick={() => setA(f)}><Search size={15} /> Search</Button>
          <div className="flex-1" />
          <Button color="success" onClick={() => nav('/payroll/process-monthly-salary/create')}><Plus size={14} /> Process Salary Sheet</Button>
        </div>
        <DataTable columns={columns} rows={rows} />
      </Card>
      <Modal open={!!print} onClose={() => setPrint(null)} title={print && `${print.number} — ${monthLabel(print.period)}`} wide="xl">
        {print && <SheetPrint sheet={print} />}
      </Modal>
    </>
  )
}

function SheetPrint({ sheet }) {
  const s = useDb()
  const shop = useShop()
  const cell = 'border border-gray-400 px-1.5 py-1'
  const t = sheetTotals(s, sheet)
  return (
    <div>
      <div className="flex justify-end mb-3 print:hidden"><Button onClick={() => window.print()}><Printer size={15} /> Print</Button></div>
      <div className="print-area text-[11px] text-gray-800">
        <div className="text-center mb-2">
          <p className="font-semibold text-[15px]">{shop.name}</p><p>{shop.address}</p>
          <p className="font-semibold text-[13px] mt-1">Salary Sheet — {monthLabel(sheet.period)} ({sheet.number}){sheet.branch ? ` · ${sheet.branch}` : ''}</p>
        </div>
        <table className="w-full border-collapse">
          <thead className="bg-gray-100"><tr>{['ID', 'Employee', 'Basic', 'Comm./Bonus', 'Allow.', 'Overtime', 'Deduct.', 'Carry', 'Net', 'Taken', 'Remaining', 'Paid', 'Due', 'Status', 'Signature'].map((h) => <th key={h} className={cell}>{h}</th>)}</tr></thead>
          <tbody>
            {sheet.rows.map((r) => {
              const st = payState(s, r.employeeId, sheet.period, r)
              return (
                <tr key={r.employeeId}>
                  <td className={cell}>{r.code}</td><td className={cell}>{r.name}<br /><span className="text-gray-500">{r.designation}</span></td>
                  {['basic', 'commission', 'allowance', 'overtime', 'deduction', 'carry'].map((k) => <td key={k} className={`${cell} text-right`}>{round2(r[k])}</td>)}
                  <td className={`${cell} text-right font-semibold`}>{round2(st.net)}</td><td className={`${cell} text-right`}>{round2(st.taken)}</td>
                  <td className={`${cell} text-right`}>{round2(st.remaining)}</td><td className={`${cell} text-right`}>{round2(st.paid)}</td>
                  <td className={`${cell} text-right font-semibold`}>{round2(st.due)}</td><td className={cell}>{st.status}</td><td className={`${cell} w-20`} />
                </tr>
              )
            })}
          </tbody>
          <tfoot className="font-semibold bg-gray-50"><tr><td colSpan={8} className={`${cell} text-right`}>Total</td><td className={`${cell} text-right`}>{money(t.net)}</td><td className={`${cell} text-right`}>{money(t.taken)}</td><td className={`${cell} text-right`}>{money(t.remaining)}</td><td className={cell} /><td className={`${cell} text-right`}>{money(t.due)}</td><td colSpan={2} className={cell} /></tr></tfoot>
        </table>
        <div className="flex justify-between mt-16 text-[12px] font-semibold"><span className="border-t border-gray-700 px-6 pt-1">Prepared By</span><span className="border-t border-gray-700 px-6 pt-1">Approved By</span></div>
      </div>
    </div>
  )
}

// ---------- Payroll / Pay Slip ----------
export function PaySlip() {
  const s = useDb()
  const [params, setParams] = useSearchParams()
  const employees = employeesOf(s)
  const period = params.get('period') || thisMonth()
  const employeeId = params.get('employee') || ''
  const choose = (patch) => setParams({ period, employee: employeeId, ...patch }, { replace: true })
  return (
    <>
      <PageHeader title="Pay Slip" />
      <Card className="print:hidden">
        <div className="flex flex-wrap gap-3 items-end">
          <Field label="Month & Year"><Input type="month" value={period} onChange={(e) => choose({ period: e.target.value })} /></Field>
          <Field label="Employee (name or ID)">
            <Combo className="w-72" value={employeeId} onChange={(v) => choose({ employee: v })} placeholder="--Select Employee--" options={employees.map((e) => ({ value: e.id, label: empLabel(e) }))} />
          </Field>
        </div>
      </Card>
      {employeeId && <SlipView key={`${employeeId}-${period}`} employeeId={employeeId} period={period} />}
    </>
  )
}

function SlipView({ employeeId, period }) {
  const s = useDb()
  const shop = useShop()
  const emp = s.contacts.find((c) => c.id === employeeId)
  const found = sheetRowFor(s, employeeId, period)
  const row = found?.row
  const st = payState(s, employeeId, period, row)
  const [payOpen, setPayOpen] = useState(false)
  if (!emp) return null
  const cell = 'border border-gray-400 px-2 py-1'
  return (
    <>
      {!row && <p className="text-[13px] text-warning mb-3">No salary sheet has {emp.name} for {monthLabel(period)} yet. Process the sheet first; advances taken so far are listed below.</p>}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4 print:hidden">
        <StatCard label="Net Entitlement" value={st.net} icon={Wallet} tone="indigo" caption={row ? `Sheet ${found.sheet.number}` : 'No sheet'} />
        <StatCard label="Total Taken" value={st.taken} icon={HandCoins} tone="sky" caption={`${st.takenCount} payout(s) during the month`} />
        <StatCard label="Paid at Month End" value={st.paid} icon={Receipt} tone="green" caption={`${st.payments.length} payment(s)`} />
        <StatCard label={st.excess ? 'Excess / Over-Advance' : 'Remaining Payable'} value={st.excess || Math.max(0, st.due)} icon={st.excess ? AlertTriangle : Wallet} tone={st.excess ? 'red' : st.due > 0 ? 'amber' : 'green'} caption={st.status} />
      </div>
      <Card>
        <div className="flex flex-wrap justify-end gap-2 mb-3 print:hidden">
          {row && st.due > 0.005 && <Button color="success" onClick={() => setPayOpen(true)}><HandCoins size={14} /> Pay Now / Pay Remaining Balance</Button>}
          <Button onClick={() => window.print()}><Printer size={14} /> Print Pay Slip</Button>
          <Button color="secondary" onClick={() => window.print()} title="Choose “Save as PDF” in the print window"><Download size={14} /> Download PDF</Button>
        </div>
        <div className="print-area invoice-a4 mx-auto text-[13px] text-gray-800">
          <div className="text-center border-b-2 border-gray-700 pb-2">
            <p className="font-bold text-[20px]">{shop.name}</p>
            <p className="text-[12px]">{shop.address}</p><p className="text-[12px]">{shop.phone}</p>
            <p className="mt-1 inline-block border border-gray-700 px-4 text-[12px] font-semibold uppercase tracking-wider">Pay Slip — {monthLabel(period)}</p>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 mt-3 text-[12px]">
            <p><b>Pay Slip No :</b> {row ? `${found.sheet.number}/${emp.code || emp.name}` : '—'}</p><p className="text-right"><b>Print Date :</b> {displayDate(today())}</p>
            <p><b>Employee :</b> {emp.name}</p><p className="text-right"><b>ID :</b> {emp.code}</p>
            <p><b>Designation :</b> {emp.designation || '—'}</p><p className="text-right"><b>Branch :</b> {emp.branch || found?.sheet.branch || '—'}</p>
          </div>
          {row && (
            <div className="grid grid-cols-2 gap-4 mt-3">
              <table className="w-full border-collapse">
                <thead><tr><th colSpan={2} className={`${cell} bg-gray-100 text-left`}>Earnings</th></tr></thead>
                <tbody>
                  {[['Basic Salary', row.basic], ['Commission / Bonus', row.commission], ['Allowances', row.allowance], ['Overtime', row.overtime]].map(([l, v]) => <tr key={l}><td className={cell}>{l}</td><td className={`${cell} text-right`}>{money(v)}</td></tr>)}
                  <tr className="font-semibold"><td className={cell}>Gross</td><td className={`${cell} text-right`}>{money(gross(row))}</td></tr>
                </tbody>
              </table>
              <table className="w-full border-collapse">
                <thead><tr><th colSpan={2} className={`${cell} bg-gray-100 text-left`}>Deductions</th></tr></thead>
                <tbody>
                  <tr><td className={cell}>Absent / Late / Other{row.absent ? ` (${row.absent} absent)` : ''}</td><td className={`${cell} text-right`}>{money(row.deduction)}</td></tr>
                  <tr><td className={cell}>Carried forward (last month&apos;s over-advance)</td><td className={`${cell} text-right`}>{money(row.carry)}</td></tr>
                  <tr className="font-semibold"><td className={cell}>Total Deductions</td><td className={`${cell} text-right`}>{money(num(row.deduction) + num(row.carry))}</td></tr>
                  <tr className="font-bold bg-gray-50"><td className={cell}>Net Entitlement</td><td className={`${cell} text-right`}>{money(st.net)}</td></tr>
                </tbody>
              </table>
            </div>
          )}
          <p className="font-semibold mt-4 mb-1">Payout / Advance History</p>
          <AdvanceHistory advances={st.advances} payments={st.payments} />
          <table className="w-full border-collapse mt-3">
            <tbody>
              <tr><td className={cell}>Net Entitlement</td><td className={`${cell} text-right`}>{money(st.net)}</td></tr>
              <tr><td className={cell}>Taken during the month ({st.takenCount} time(s))</td><td className={`${cell} text-right`}>{money(st.taken)}</td></tr>
              <tr><td className={cell}>Paid at month end</td><td className={`${cell} text-right`}>{money(st.paid)}</td></tr>
              <tr className={`font-bold ${st.excess ? 'text-danger' : ''}`}>
                <td className={cell}>{st.excess ? 'Excess / Over-Advance (carried to next month)' : 'Remaining Payable'}</td>
                <td className={`${cell} text-right`}>{money(st.excess || Math.max(0, st.due))}</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-2 text-[12px]"><b>In Words:</b> {amountInWords(st.excess || Math.max(0, st.due), shop.currencyWord)}</p>
          <div className="flex justify-between mt-20 text-[12px] font-semibold"><span className="border-t border-gray-700 px-6 pt-1">Employee Signature</span><span className="border-t border-gray-700 px-6 pt-1">For-{shop.name}</span></div>
        </div>
      </Card>
      <Modal open={payOpen} onClose={() => setPayOpen(false)} title={`Pay ${emp.name} — ${monthLabel(period)}`}>
        {payOpen && <SettleForm employee={emp} period={period} due={st.due} sheetId={found?.sheet.id} onDone={() => setPayOpen(false)} />}
      </Modal>
    </>
  )
}

// Pays (part of) what is left at month end; recorded as a pay slip payment (cash book: Salary)
function SettleForm({ employee, period, due, sheetId, onDone }) {
  const [f, setF] = useState({ date: today(), amount: String(round2(due)), method: 'Cash', note: '' })
  const [saving, setSaving] = useState(false)
  const pay = async () => {
    const amt = round2(num(f.amount))
    if (!(amt > 0)) { toast.error('Enter the amount.'); return }
    if (amt > due + 0.005 && !confirm(`That is ${money(amt - due)} more than the remaining ${money(due)}. Pay anyway?`)) return
    setSaving(true)
    const rec = await db.insert('paySlips', { date: f.date, employeeId: employee.id, employeeName: employee.name, period, month: monthLabel(period), sheetId, amount: amt, method: f.method, note: f.note }, { number: 'SLIP' })
    setSaving(false)
    if (!rec) return
    toast.success(`${rec.number}: paid ${money(amt)} to ${employee.name}.`)
    onDone()
  }
  return (
    <div className="space-y-3">
      <p className="text-[13px]">Remaining payable: <b>{taka(due)}</b></p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date"><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="Amount *"><Input type="number" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
        <Field label="Paid Through"><Select value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })} options={PAYMENT_METHODS} /></Field>
        <Field label="Note"><Input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
      </div>
      <div className="flex gap-2"><Button disabled={saving} onClick={pay}>Pay</Button><Button color="secondary" onClick={onDone}>Cancel</Button></div>
    </div>
  )
}

// ---------- Payroll / List of Pay Slip ----------
export function PaySlipList() {
  const s = useDb()
  const nav = useNavigate()
  const [f, setF] = useState({ period: thisMonth(), branch: '', employeeId: '', status: '' })
  const [a, setA] = useState(f)
  const [settle, setSettle] = useState(null)
  const employees = employeesOf(s)
  // one row per employee and month, from the deciding sheet
  const rows = useMemo(() => {
    const seen = new Set()
    const out = []
    s.salarySheets.filter((x) => Array.isArray(x.rows) && (!a.period || x.period === a.period)).forEach((sheet) => {
      sheet.rows.forEach((r) => {
        const k = `${r.employeeId}|${sheet.period}`
        if (seen.has(k)) return
        const found = sheetRowFor(s, r.employeeId, sheet.period)
        if (!found) return
        seen.add(k)
        const st = payState(s, r.employeeId, sheet.period, found.row)
        const emp = employees.find((e) => e.id === r.employeeId)
        out.push({ id: k, employeeId: r.employeeId, period: sheet.period, sheet: found.sheet, slipNo: `${found.sheet.number}/${r.code || r.name}`, name: r.name, code: r.code, branch: emp?.branch || found.sheet.branch || '', ...st })
      })
    })
    return out.filter((x) => (!a.branch || x.branch === a.branch) && (!a.employeeId || x.employeeId === a.employeeId) && (!a.status || x.status === a.status))
  }, [s, a, employees])
  const columns = [
    { key: 'slipNo', label: 'Slip No.' },
    { key: 'name', label: 'Employee', render: (x) => <>{x.name}<div className="text-[11px] text-gray-500">ID {x.code}</div></> },
    { key: 'period', label: 'Pay Month', render: (x) => monthLabel(x.period) },
    { key: 'net', label: 'Monthly Entitlement', align: 'right', render: (x) => money(x.net) },
    { key: 'taken', label: 'Taken (count)', align: 'right', render: (x) => <>{money(x.taken)} <span className="text-gray-500">({x.takenCount})</span></> },
    { key: 'remaining', label: 'Remaining Payable', align: 'right', render: (x) => money(x.remaining) },
    { key: 'paid', label: 'Paid Amount', align: 'right', render: (x) => money(x.paid) },
    { key: 'due', label: 'Due Balance', align: 'right', render: (x) => <span className={x.due < 0 ? 'text-danger' : ''}>{money(x.due)}</span> },
    { key: 'status', label: 'Status', render: (x) => <StatusBadge status={x.status} /> },
    {
      key: 'action', label: 'Action', render: (x) => (
        <div className="flex gap-1">
          <Button color="info" className="!px-2 !py-1" title="View Slip" onClick={() => nav(`/payroll/pay-slip?period=${x.period}&employee=${x.employeeId}`)}><Eye size={13} /></Button>
          {x.due > 0.005 && <Button color="success" className="!px-2 !py-1" title="Pay / Settle Due" onClick={() => setSettle(x)}><HandCoins size={13} /></Button>}
          <Button color="secondary" className="!px-2 !py-1" title="Print" onClick={() => nav(`/payroll/pay-slip?period=${x.period}&employee=${x.employeeId}`)}><Printer size={13} /></Button>
        </div>
      ),
    },
  ]
  const tot = (k) => money(rows.reduce((x, r) => x + num(r[k]), 0))
  return (
    <>
      <PageHeader title="List of Pay Slip" />
      <Card>
        <div className="flex flex-wrap gap-3 items-end mb-4">
          <Field label="Month & Year"><Input type="month" value={f.period} onChange={(e) => setF({ ...f, period: e.target.value })} /></Field>
          <Field label="Showroom / Branch"><Select className="!w-44" value={f.branch} onChange={(e) => setF({ ...f, branch: e.target.value })} placeholder="All" options={s.branches.map((b) => b.name)} /></Field>
          <Field label="Employee"><Combo className="w-60" value={f.employeeId} onChange={(v) => setF({ ...f, employeeId: v })} placeholder="All" options={[{ value: '', label: 'All' }, ...employees.map((e) => ({ value: e.id, label: empLabel(e) }))]} /></Field>
          <Field label="Payment Status"><Select className="!w-44" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} placeholder="All" options={['Paid', 'Partial', 'Unpaid', 'Over-Advanced']} /></Field>
          <Button onClick={() => setA(f)}><Search size={15} /> Search</Button>
        </div>
        <DataTable columns={columns} rows={rows}
          footer={rows.length > 0 && (
            <tr className="border-t"><td colSpan={3} className="px-3 py-2 text-right">Total</td>
              <td className="px-3 py-2 text-right">{tot('net')}</td><td className="px-3 py-2 text-right">{tot('taken')}</td><td className="px-3 py-2 text-right">{tot('remaining')}</td>
              <td className="px-3 py-2 text-right">{tot('paid')}</td><td className="px-3 py-2 text-right">{tot('due')}</td><td /><td /></tr>
          )} />
        <p className="text-[12px] text-gray-500 mt-2">Rows come from processed salary sheets. Older pay slips entered before this update still appear in the Cash Book.</p>
      </Card>
      <Modal open={!!settle} onClose={() => setSettle(null)} title={settle && `Pay ${settle.name} — ${monthLabel(settle.period)}`}>
        {settle && <SettleForm employee={{ id: settle.employeeId, name: settle.name }} period={settle.period} due={settle.due} sheetId={settle.sheet.id} onDone={() => setSettle(null)} />}
      </Modal>
    </>
  )
}

// ---------- Payroll / Employee Advance / Partial Pay ----------
function AdvanceForm({ fixedEmployeeId, fixedPeriod, onSaved, compact, editing, onCancel }) {
  const s = useDb()
  const employees = employeesOf(s)
  const blank = { employeeId: fixedEmployeeId || '', date: today(), period: fixedPeriod || thisMonth(), amount: '', method: 'Cash', info: '', note: '' }
  const [f, setF] = useState(editing ? { ...blank, ...editing } : blank)
  const [saving, setSaving] = useState(false)
  const emp = employees.find((e) => e.id === f.employeeId)
  const found = emp ? sheetRowFor(s, emp.id, f.period) : null
  const others = advancesOf(s, f.employeeId, f.period).filter((x) => x.id !== editing?.id)
  const takenBefore = round2(others.reduce((a, x) => a + num(x.amount), 0))
  const limit = found ? netOf(found.row) : num(emp?.salary)
  const after = round2(takenBefore + num(f.amount))
  const over = emp && after > limit + 0.005
  const save = async () => {
    if (!emp) { toast.error('Select an employee.'); return }
    if (!(num(f.amount) > 0)) { toast.error('Enter the amount.'); return }
    if (over && !confirm(`${emp.name} will have taken ${money(after)} this month, ${money(after - limit)} more than ${found ? 'the net pay' : 'the basic salary'} (${money(limit)}). Save anyway?`)) return
    setSaving(true)
    const body = { employeeId: emp.id, employeeName: emp.name, date: f.date, period: f.period, amount: round2(num(f.amount)), method: f.method, info: f.info, note: f.note }
    const rec = editing ? await db.update('salaryAdvances', editing.id, body) : await db.insert('salaryAdvances', body, { number: 'EA' })
    setSaving(false)
    if (!rec) return
    toast.success(`${rec.number}: ${money(body.amount)} to ${emp.name}${over ? ' — over-advance!' : ''}.`)
    if (onSaved) onSaved(rec)
    if (!editing) setF({ ...blank, employeeId: fixedEmployeeId || '', period: f.period })
  }
  return (
    <div className="space-y-3">
      <div className={`grid gap-3 ${compact ? 'grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-4'}`}>
        {!fixedEmployeeId && (
          <Field label="Employee (name / ID) *" className={compact ? 'col-span-2' : 'lg:col-span-2'}>
            <Combo value={f.employeeId} onChange={(v) => setF({ ...f, employeeId: v })} placeholder="--Select Employee--" options={employees.map((e) => ({ value: e.id, label: empLabel(e) }))} />
          </Field>
        )}
        <Field label="Date *"><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value, period: fixedPeriod || e.target.value.slice(0, 7) })} /></Field>
        <Field label="Salary Month"><Input type="month" value={f.period} disabled={!!fixedPeriod} onChange={(e) => setF({ ...f, period: e.target.value })} /></Field>
        <Field label="Amount *"><Input type="number" min="0" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
        <Field label="Paid Through"><Select value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })} options={PAYMENT_METHODS} /></Field>
        <Field label="Account Info"><Input value={f.info} onChange={(e) => setF({ ...f, info: e.target.value })} /></Field>
        <Field label="Note / Reason"><Input placeholder="e.g. 1st installment, mid-month need" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
      </div>
      {emp && (
        <div className={`rounded px-3 py-2 text-[13px] ${over ? 'bg-danger/10 text-danger' : 'bg-gray-50 text-gray-700'}`}>
          {over && <AlertTriangle size={14} className="inline mr-1 -mt-0.5" />}
          {monthLabel(f.period)}: taken so far <b>{money(takenBefore)}</b> ({others.length} time(s)); with this <b>{money(after)}</b> of {found ? 'net pay' : 'basic salary'} <b>{money(limit)}</b>
          {over ? ` — ${money(after - limit)} over!` : ` — ${money(limit - after)} left.`}
        </div>
      )}
      <div className="flex gap-2">
        <Button disabled={saving} onClick={save}>{editing ? 'Update' : 'Save'}</Button>
        {onCancel && <Button color="secondary" onClick={onCancel}>Cancel</Button>}
      </div>
    </div>
  )
}

export function EmployeeAdvance() {
  const s = useDb()
  const allow = useCan()
  const employees = employeesOf(s)
  const [f, setF] = useState({ period: thisMonth(), employeeId: '', from: '', to: '' })
  const [a, setA] = useState(f)
  const [editing, setEditing] = useState(null)
  const [print, setPrint] = useState(null)
  const rows = (s.salaryAdvances || [])
    .filter((x) => (!a.period || x.period === a.period) && (!a.employeeId || x.employeeId === a.employeeId) && inRange(x.date, a.from, a.to))
    .slice().sort((x, y) => y.date.localeCompare(x.date))
  const withEmp = (x) => { const e = employees.find((c) => c.id === x.employeeId); return { ...x, contactName: x.employeeName, phone: e?.phone, address: e?.designation } }
  const columns = [
    { key: 'date', label: 'Date', render: (x) => displayDate(x.date) },
    { key: 'number', label: 'Ref#' },
    { key: 'employeeName', label: 'Employee' },
    { key: 'period', label: 'Salary Month', render: (x) => monthLabel(x.period) },
    { key: 'method', label: 'Through' },
    { key: 'note', label: 'Note' },
    { key: 'amount', label: 'Amount', align: 'right', render: (x) => money(x.amount) },
    {
      key: 'action', label: 'Action', render: (x) => (
        <div className="flex gap-1">
          <Button color="success" className="!px-2 !py-1" title="Print" onClick={() => setPrint(withEmp(x))}><Printer size={13} /></Button>
          {allow.edit && <Button color="info" className="!px-2 !py-1" title="Edit" onClick={() => setEditing(x)}><Pencil size={13} /></Button>}
          {allow.delete && <Button color="danger" className="!px-2 !py-1" title="Delete" onClick={() => confirm(`Delete ${x.number}?`) && db.remove('salaryAdvances', x.id)}><Trash2 size={13} /></Button>}
        </div>
      ),
    },
  ]
  const byEmp = Object.values(rows.reduce((m, x) => { const k = x.employeeId; m[k] = m[k] || { name: x.employeeName, n: 0, total: 0 }; m[k].n += 1; m[k].total += num(x.amount); return m }, {}))
  return (
    <>
      <PageHeader title="Employee Advance / Partial Pay" />
      <Card title="Give Advance / Partial Pay">
        <AdvanceForm />
      </Card>
      <Card title="Advance & Partial Payment List">
        <div className="flex flex-wrap gap-3 items-end mb-4">
          <Field label="Salary Month"><Input type="month" value={f.period} onChange={(e) => setF({ ...f, period: e.target.value })} /></Field>
          <Field label="Employee"><Combo className="w-60" value={f.employeeId} onChange={(v) => setF({ ...f, employeeId: v })} placeholder="All" options={[{ value: '', label: 'All' }, ...employees.map((e) => ({ value: e.id, label: empLabel(e) }))]} /></Field>
          <Field label="From"><Input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
          <Field label="To"><Input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Field>
          <Button onClick={() => setA(f)}><Search size={15} /> Search</Button>
        </div>
        {byEmp.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3 text-[12px]">
            {byEmp.map((x) => <span key={x.name} className="rounded bg-gray-100 px-2 py-1">{x.name}: <b>{x.n}</b> time(s), <b>{money(x.total)}</b></span>)}
          </div>
        )}
        <DataTable columns={columns} rows={rows}
          footer={rows.length > 0 && <tr className="border-t"><td colSpan={6} className="px-3 py-2 text-right">Total</td><td className="px-3 py-2 text-right">{money(rows.reduce((x, r) => x + num(r.amount), 0))}</td><td /></tr>} />
      </Card>
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing && `Edit ${editing.number}`} wide>
        {editing && <AdvanceForm editing={editing} onSaved={() => setEditing(null)} onCancel={() => setEditing(null)} />}
      </Modal>
      <Modal open={!!print} onClose={() => setPrint(null)} title="Advance Voucher" wide>
        {print && <VoucherPrint rec={print} kind="pay" title="Salary Advance Voucher" partyLabel="Paid To" />}
      </Modal>
    </>
  )
}
