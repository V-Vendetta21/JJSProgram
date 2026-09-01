import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { SAMPLE_CHARACTER_CODE } from '../test/fixtures'
import { useProjectStore } from '../project/store'
import { AppShell } from './AppShell'

describe('Moveset Studio import workflow', () => {
  beforeEach(() => useProjectStore.getState().reset())

  it('decodes a pasted character code and opens its slots in the explorer', async () => {
    const user = userEvent.setup()
    render(<AppShell />)

    await user.click(screen.getByRole('button', { name: /import jjs code/i }))
    fireEvent.change(screen.getByLabelText(/paste jjs character code/i), { target: { value: SAMPLE_CHARACTER_CODE } })
    await user.click(screen.getByRole('button', { name: /^decode & open$/i }))

    const explorer = await screen.findByLabelText('Moveset explorer')
    expect(within(explorer).getByText('Attack')).toBeInTheDocument()
    expect(within(explorer).getByText('Quick Swap')).toBeInTheDocument()
    expect(within(explorer).getByText(/3 slots/i)).toBeInTheDocument()
  })
})
