import { describe, expect, it } from 'vitest'
import { computeClientAmountDueNow } from './dealPaymentTotals'
import type { Deal } from '@/types'

function amt(over: Partial<Deal>): Deal {
  return {
    gross_amount: 1000,
    deposit_paid_amount: 0,
    balance_paid_amount: 0,
    deposit_due_amount: null,
    pricing_snapshot: null,
    ...over,
  } as Deal
}

describe('computeClientAmountDueNow', () => {
  it('returns deposit remainder when deposit not satisfied', () => {
    const d = amt({ gross_amount: 1000, deposit_due_amount: 300, deposit_paid_amount: 100 })
    expect(computeClientAmountDueNow(d)).toBe(200)
  })

  it('caps deposit remainder by remaining client balance', () => {
    const d = amt({
      gross_amount: 500,
      deposit_due_amount: 300,
      deposit_paid_amount: 0,
      balance_paid_amount: 250,
    })
    expect(computeClientAmountDueNow(d)).toBe(250)
  })

  it('returns full remaining balance when deposit satisfied', () => {
    const d = amt({
      gross_amount: 1000,
      deposit_due_amount: 300,
      deposit_paid_amount: 300,
      balance_paid_amount: 0,
    })
    expect(computeClientAmountDueNow(d)).toBe(700)
  })

  it('returns zero when nothing left', () => {
    const d = amt({
      gross_amount: 1000,
      deposit_paid_amount: 500,
      balance_paid_amount: 500,
    })
    expect(computeClientAmountDueNow(d)).toBe(0)
  })
})
