// frontend/tests/App.test.tsx
import { render, screen } from '@testing-library/react'
import { App } from '../src/App'

describe('App', () => {
  it('TaskFlow 제목을 보여준다', () => {
    render(<App />)

    expect(screen.getByRole('heading', { level: 1, name: 'TaskFlow' })).toBeInTheDocument()
  })
})
