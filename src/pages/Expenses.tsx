import { useState, useMemo } from 'react'
import { Plus, Pencil, Trash2, TrendingDown } from 'lucide-react'
import { useExpenses } from '@/hooks/useExpenses'
import { useVenues } from '@/hooks/useVenues'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import type { Expense, ExpenseCategory } from '@/types'
import { EXPENSE_CATEGORY_LABELS } from '@/types'

const CATEGORY_VARIANTS: Record<ExpenseCategory, 'secondary' | 'blue' | 'warning' | 'purple' | 'success' | 'outline'> = {
  travel: 'blue',
  equipment: 'purple',
  promotion: 'warning',
  accommodation: 'secondary',
  food: 'success',
  misc: 'outline',
}

const EMPTY_FORM = {
  amount: '',
  category: 'misc' as ExpenseCategory,
  description: '',
  date: new Date().toISOString().split('T')[0],
  venue_id: '',
}

export default function Expenses() {
  const { expenses, loading, addExpense, updateExpense, deleteExpense } = useExpenses()
  const { venues } = useVenues()
  const [addOpen, setAddOpen] = useState(false)
  const [editExpense, setEditExpense] = useState<Expense | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Expense | null>(null)
  const [filterCategory, setFilterCategory] = useState<ExpenseCategory | 'all'>('all')
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const filtered = useMemo(() => {
    let list = expenses
    if (filterCategory !== 'all') list = list.filter(e => e.category === filterCategory)
    return list
  }, [expenses, filterCategory])

  const total = useMemo(() => filtered.reduce((sum, e) => sum + e.amount, 0), [filtered])

  const byCategory = useMemo(() => {
    const map: Record<string, number> = {}
    for (const e of expenses) {
      map[e.category] = (map[e.category] ?? 0) + e.amount
    }
    return map
  }, [expenses])

  const openAdd = () => {
    setForm(EMPTY_FORM)
    setEditExpense(null)
    setAddOpen(true)
  }

  const openEdit = (expense: Expense) => {
    setForm({
      amount: String(expense.amount),
      category: expense.category,
      description: expense.description ?? '',
      date: expense.date,
      venue_id: expense.venue_id ?? '',
    })
    setEditExpense(expense)
    setAddOpen(true)
  }

  const setField = <K extends keyof typeof form>(key: K, value: typeof form[K]) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const handleSave = async () => {
    if (!form.amount || isNaN(Number(form.amount))) return
    setSaving(true)
    const data = {
      amount: Number(form.amount),
      category: form.category,
      description: form.description || null,
      date: form.date,
      venue_id: form.venue_id || null,
    }
    if (editExpense) {
      await updateExpense(editExpense.id, data)
    } else {
      await addExpense(data)
    }
    setSaving(false)
    setAddOpen(false)
  }

  const fmtAmount = (n: number) =>
    n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

  return (
    <div className="space-y-4 max-w-3xl">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-white border border-neutral-200 rounded-lg p-4 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-neutral-500 font-medium">Total expenses</span>
            <TrendingDown className="h-4 w-4 text-neutral-300" />
          </div>
          <div className="text-2xl font-bold text-neutral-900">{fmtAmount(expenses.reduce((s, e) => s + e.amount, 0))}</div>
          <p className="text-xs text-neutral-400 mt-1">{expenses.length} expense{expenses.length !== 1 ? 's' : ''}</p>
        </div>

        {(Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[]).filter(c => byCategory[c]).slice(0, 4).map(cat => (
          <div key={cat} className="bg-white border border-neutral-100 rounded-lg p-3">
            <Badge variant={CATEGORY_VARIANTS[cat]} className="mb-2">{EXPENSE_CATEGORY_LABELS[cat]}</Badge>
            <div className="text-lg font-bold text-neutral-800">{fmtAmount(byCategory[cat] ?? 0)}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex gap-2 flex-wrap">
        <Select value={filterCategory} onValueChange={v => setFilterCategory(v as ExpenseCategory | 'all')}>
          <SelectTrigger className="w-[145px]">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {(Object.entries(EXPENSE_CATEGORY_LABELS) as [ExpenseCategory, string][]).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex-1" />

        {filterCategory !== 'all' && (
          <div className="flex items-center text-sm text-neutral-600 font-medium">
            Filtered total: {fmtAmount(total)}
          </div>
        )}

        <Button onClick={openAdd}>
          <Plus className="h-3.5 w-3.5" />
          Add expense
        </Button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-5 h-5 border-2 border-neutral-300 border-t-neutral-900 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-neutral-400 text-sm border-2 border-dashed border-neutral-200 rounded-lg">
          {expenses.length === 0 ? (
            <>
              <p className="font-medium text-neutral-600 mb-1">No expenses yet</p>
              <p>Log your first expense to start tracking costs.</p>
            </>
          ) : (
            <p>No expenses in this category.</p>
          )}
        </div>
      ) : (
        <div className="rounded border border-neutral-200 overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50">
                <th className="text-left px-4 py-2.5 font-medium text-neutral-500 text-xs">Date</th>
                <th className="text-left px-3 py-2.5 font-medium text-neutral-500 text-xs">Category</th>
                <th className="text-left px-3 py-2.5 font-medium text-neutral-500 text-xs hidden sm:table-cell">Description</th>
                <th className="text-left px-3 py-2.5 font-medium text-neutral-500 text-xs hidden md:table-cell">Venue</th>
                <th className="text-right px-4 py-2.5 font-medium text-neutral-500 text-xs">Amount</th>
                <th className="px-3 py-2.5 w-16" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(expense => (
                <tr key={expense.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50 transition-colors">
                  <td className="px-4 py-3 text-neutral-500 text-xs tabular-nums">{expense.date}</td>
                  <td className="px-3 py-3">
                    <Badge variant={CATEGORY_VARIANTS[expense.category]}>
                      {EXPENSE_CATEGORY_LABELS[expense.category]}
                    </Badge>
                  </td>
                  <td className="px-3 py-3 hidden sm:table-cell">
                    <span className="text-neutral-700">{expense.description ?? <span className="text-neutral-300">—</span>}</span>
                  </td>
                  <td className="px-3 py-3 hidden md:table-cell">
                    <span className="text-xs text-neutral-500">{expense.venue?.name ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-neutral-900 tabular-nums">
                    {fmtAmount(expense.amount)}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(expense)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-400 hover:text-red-600"
                        onClick={() => setConfirmDelete(expense)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-neutral-200 bg-neutral-50">
                <td colSpan={4} className="px-4 py-2.5 text-xs font-medium text-neutral-500 hidden sm:table-cell">
                  {filtered.length} expense{filtered.length !== 1 ? 's' : ''}
                </td>
                <td className="px-4 py-2.5 text-right font-bold text-neutral-900 tabular-nums">
                  {fmtAmount(total)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Add / edit dialog */}
      <Dialog open={addOpen} onOpenChange={v => !v && setAddOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editExpense ? 'Edit expense' : 'Add expense'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Amount ($) *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={e => setField('amount', e.target.value)}
                  placeholder="0.00"
                  autoFocus
                />
              </div>
              <div className="space-y-1">
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={e => setField('date', e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={v => setField('category', v as ExpenseCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(EXPENSE_CATEGORY_LABELS) as [ExpenseCategory, string][]).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Description</Label>
              <Input
                value={form.description}
                onChange={e => setField('description', e.target.value)}
                placeholder="Uber to venue, drum sticks, etc."
              />
            </div>

            <div className="space-y-1">
              <Label>Venue (optional)</Label>
              <Select value={form.venue_id} onValueChange={v => setField('venue_id', v)}>
                <SelectTrigger><SelectValue placeholder="Link to a venue" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No venue</SelectItem>
                  {venues.map(v => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.amount}>
              {saving ? 'Saving…' : editExpense ? 'Save changes' : 'Add expense'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm delete */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmDelete(null)} />
          <div className="relative bg-white rounded-lg border border-neutral-200 p-6 max-w-sm w-full shadow-xl">
            <h3 className="font-semibold text-neutral-900 mb-2">Delete expense?</h3>
            <p className="text-sm text-neutral-500 mb-4">
              {fmtAmount(confirmDelete.amount)} — {confirmDelete.description ?? EXPENSE_CATEGORY_LABELS[confirmDelete.category]} will be removed.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setConfirmDelete(null)}>Cancel</Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={async () => {
                  await deleteExpense(confirmDelete.id)
                  setConfirmDelete(null)
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
