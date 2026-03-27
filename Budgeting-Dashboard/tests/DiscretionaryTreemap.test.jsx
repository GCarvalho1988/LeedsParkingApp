// tests/DiscretionaryTreemap.test.jsx
import { render } from '@testing-library/react'
import { describe, it } from 'vitest'
import DiscretionaryTreemap from '../src/components/DiscretionaryTreemap'

const SAMPLE_DATA = [
  { name: 'Groceries', size: 450 },
  { name: 'Eating out', size: 230 },
  { name: 'Clothing & shoes', size: 180 },
]

describe('DiscretionaryTreemap', () => {
  it('renders without crashing with valid data', () => {
    render(<DiscretionaryTreemap data={SAMPLE_DATA} />)
  })

  it('renders without crashing with empty data', () => {
    render(<DiscretionaryTreemap data={[]} />)
  })
})
