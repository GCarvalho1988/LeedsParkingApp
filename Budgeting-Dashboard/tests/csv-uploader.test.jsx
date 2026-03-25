import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock supabase before importing the component
vi.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'tok' } } }),
    },
  },
}))

// Mock useAuth
vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' }, role: 'admin' }),
}))

// Mock papaparse as a dynamic import
vi.mock('papaparse', () => ({
  default: {
    parse: vi.fn(),
  },
}))

import CsvUploader from '../src/components/CsvUploader'
import { supabase } from '../src/lib/supabase'
import Papa from 'papaparse'

function renderUploader(props = {}) {
  return render(<CsvUploader onSuccess={props.onSuccess ?? vi.fn()} />)
}

describe('CsvUploader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    supabase.auth.getSession.mockResolvedValue({ data: { session: { access_token: 'tok' } } })
  })

  it('renders upload drop zone when stage is idle', () => {
    renderUploader()
    expect(screen.getByText('Upload CSV')).toBeInTheDocument()
    expect(screen.getByText(/Drag & drop a LifeStages CSV/)).toBeInTheDocument()
  })

  it('parses ALL CAPS CSV columns (CATEGORY, DATE) and sets period via slice(0,7)', async () => {
    Papa.parse.mockReturnValue({
      data: [
        { DATE: '2024-03-15', CATEGORY: 'Food', AMOUNT: '10.00' },
        { DATE: '2024-03-20', CATEGORY: 'Transport', AMOUNT: '5.50' },
        { DATE: '2024-03-22', CATEGORY: 'Food', AMOUNT: '8.00' },
      ],
    })

    renderUploader()

    const csvContent = 'DATE,CATEGORY,AMOUNT\n2024-03-15,Food,10.00\n2024-03-20,Transport,5.50\n2024-03-22,Food,8.00'
    const file = new File([csvContent], 'march-2024.csv', { type: 'text/csv' })
    Object.defineProperty(file, 'text', {
      value: () => Promise.resolve(csvContent),
    })

    const input = document.querySelector('input[type="file"]')
    await userEvent.upload(input, file)

    await waitFor(() => {
      expect(screen.getByText('2024-03')).toBeInTheDocument()
    })
  })

  it('shows preview with correct period, rowCount, and categories after file parsing', async () => {
    Papa.parse.mockReturnValue({
      data: [
        { DATE: '2024-05-01', CATEGORY: 'Groceries', AMOUNT: '50.00' },
        { DATE: '2024-05-10', CATEGORY: 'Rent', AMOUNT: '900.00' },
        { DATE: '2024-05-15', CATEGORY: 'Groceries', AMOUNT: '35.00' },
      ],
    })

    renderUploader()

    const csvContent = 'DATE,CATEGORY,AMOUNT\n2024-05-01,Groceries,50.00'
    const file = new File([csvContent], 'may-2024.csv', { type: 'text/csv' })
    Object.defineProperty(file, 'text', {
      value: () => Promise.resolve(csvContent),
    })

    const input = document.querySelector('input[type="file"]')
    await userEvent.upload(input, file)

    await waitFor(() => {
      expect(screen.getByText('Preview: may-2024.csv')).toBeInTheDocument()
      expect(screen.getByText('2024-05')).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument()
      expect(screen.getByText(/Groceries/)).toBeInTheDocument()
      expect(screen.getByText(/Rent/)).toBeInTheDocument()
    })
  })

  it('shows conflict UI when server returns 409', async () => {
    Papa.parse.mockReturnValue({
      data: [{ DATE: '2024-06-01', CATEGORY: 'Food', AMOUNT: '20.00' }],
    })

    vi.spyOn(global, 'fetch').mockResolvedValue({
      status: 409,
      ok: false,
      json: async () => ({ period: '2024-06', error: 'Period already exists' }),
    })

    renderUploader()

    const csvContent = 'DATE,CATEGORY,AMOUNT\n2024-06-01,Food,20.00'
    const file = new File([csvContent], 'june-2024.csv', { type: 'text/csv' })
    Object.defineProperty(file, 'text', {
      value: () => Promise.resolve(csvContent),
    })

    const input = document.querySelector('input[type="file"]')
    await userEvent.upload(input, file)

    await waitFor(() => screen.getByText('Import'))
    await userEvent.click(screen.getByText('Import'))

    await waitFor(() => {
      expect(screen.getByText('Period already imported')).toBeInTheDocument()
      expect(screen.getByText(/already exists/)).toBeInTheDocument()
      expect(screen.getByText('Overwrite')).toBeInTheDocument()
    })
  })

  it('shows error UI when server returns non-ok response', async () => {
    Papa.parse.mockReturnValue({
      data: [{ DATE: '2024-07-01', CATEGORY: 'Bills', AMOUNT: '100.00' }],
    })

    vi.spyOn(global, 'fetch').mockResolvedValue({
      status: 500,
      ok: false,
      json: async () => ({ error: 'Internal server error' }),
    })

    renderUploader()

    const csvContent = 'DATE,CATEGORY,AMOUNT\n2024-07-01,Bills,100.00'
    const file = new File([csvContent], 'july-2024.csv', { type: 'text/csv' })
    Object.defineProperty(file, 'text', {
      value: () => Promise.resolve(csvContent),
    })

    const input = document.querySelector('input[type="file"]')
    await userEvent.upload(input, file)

    await waitFor(() => screen.getByText('Import'))
    await userEvent.click(screen.getByText('Import'))

    await waitFor(() => {
      expect(screen.getByText('Internal server error')).toBeInTheDocument()
      expect(screen.getByText('Try again')).toBeInTheDocument()
    })
  })
})
