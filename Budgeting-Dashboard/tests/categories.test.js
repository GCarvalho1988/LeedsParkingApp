// tests/categories.test.js
import { describe, it, expect } from 'vitest'
import { BILLS_CATEGORIES, TRANSIENT_CATEGORIES, bucketCategory } from '../src/lib/categories.js'

describe('BILLS_CATEGORIES', () => {
  it('contains Mortgage', () => expect(BILLS_CATEGORIES.has('Mortgage')).toBe(true))
  it('contains 0% Credit Card Repayment', () => expect(BILLS_CATEGORIES.has('0% Credit Card Repayment')).toBe(true))
  it('contains Child & dependent expenses', () => expect(BILLS_CATEGORIES.has('Child & dependent expenses')).toBe(true))
  it('contains House Cleaning', () => expect(BILLS_CATEGORIES.has('House Cleaning')).toBe(true))
  it('does not contain Groceries', () => expect(BILLS_CATEGORIES.has('Groceries')).toBe(false))
})

describe('TRANSIENT_CATEGORIES', () => {
  it('contains Credit card payments', () => expect(TRANSIENT_CATEGORIES.has('Credit card payments')).toBe(true))
  it('contains Dulce Personal Purchases', () => expect(TRANSIENT_CATEGORIES.has('Dulce Personal Purchases')).toBe(true))
  it('contains Transfers', () => expect(TRANSIENT_CATEGORIES.has('Transfers')).toBe(true))
  it('does not contain Groceries', () => expect(TRANSIENT_CATEGORIES.has('Groceries')).toBe(false))
})

describe('bucketCategory', () => {
  it('returns bills for Mortgage', () => expect(bucketCategory('Mortgage')).toBe('bills'))
  it('returns bills for 0% Credit Card Repayment', () => expect(bucketCategory('0% Credit Card Repayment')).toBe('bills'))
  it('returns bills for Child & dependent expenses', () => expect(bucketCategory('Child & dependent expenses')).toBe('bills'))
  it('returns transient for Credit card payments', () => expect(bucketCategory('Credit card payments')).toBe('transient'))
  it('returns transient for Transfers', () => expect(bucketCategory('Transfers')).toBe('transient'))
  it('returns transient for Dulce Personal Purchases', () => expect(bucketCategory('Dulce Personal Purchases')).toBe('transient'))
  it('returns discretionary for Groceries', () => expect(bucketCategory('Groceries')).toBe('discretionary'))
  it('returns discretionary for unknown category', () => expect(bucketCategory('Something new')).toBe('discretionary'))
})
