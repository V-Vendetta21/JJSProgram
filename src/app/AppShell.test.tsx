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

  it('generates, previews, inserts, and opens a real move timeline', async () => {
    const user = userEvent.setup()
    render(<AppShell />)

    await user.click(screen.getByRole('button', { name: /generate move/i }))
    await user.type(screen.getByLabelText(/describe your move/i), 'Make a fast dash punch that launches the enemy upward, then lets me continue the combo.')
    await user.click(screen.getByRole('button', { name: /^generate$/i }))

    expect(await screen.findByRole('heading', { name: 'Generated Dash Punch' })).toBeInTheDocument()
    expect(screen.getByText(/structure/i).parentElement).toHaveTextContent(/pass/i)
    await user.click(screen.getByRole('button', { name: /insert move/i }))

    expect(useProjectStore.getState().slots[0].NAME).toBe('Generated Dash Punch')
    expect(screen.getAllByText('Generated Dash Punch').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('HITBOX').length).toBeGreaterThan(0)
  })

  it('runs the Singularity Hattrick acceptance prompt through the visible editor flow', async () => {
    const user = userEvent.setup()
    render(<AppShell />)
    await user.click(screen.getByRole('button', { name: /generate move/i }))
    fireEvent.change(screen.getByLabelText(/describe your move/i), { target: { value: `Create a move called Singularity Hattrick.
The player launches upward and charges a small black-hole projectile.
After a short delay, they strike the projectile forward.
When it reaches the attack point, create a large impact hitbox.
The move should be slow, highly telegraphed, and powerful.
If possible, use a separate hit-success branch for the impact sequence.
Make it suitable as a base moveset finisher rather than an ultimate.` } })
    await user.click(screen.getByRole('button', { name: /^generate$/i }))

    expect(await screen.findByRole('heading', { name: 'Singularity Hattrick' })).toBeInTheDocument()
    expect(screen.getAllByText('branches')[0].parentElement).toHaveTextContent('1 branches')
    await user.click(screen.getByRole('button', { name: /insert move/i }))

    const state = useProjectStore.getState()
    const line = Array.isArray(state.data[0].Line) ? state.data[0].Line : []
    expect(state.slots[0].NAME).toBe('Singularity Hattrick')
    expect(Object.keys(state.data[0].Branch ?? {})).toHaveLength(1)
    expect(line.some((node) => Boolean(node) && typeof node === 'object' && 'K_NAME' in node && node.K_NAME === 'VELO')).toBe(true)
    expect(line.some((node) => Boolean(node) && typeof node === 'object' && 'K_NAME' in node && node.K_NAME === 'HITBOX')).toBe(true)
    expect(screen.getByText(/AI-generated draft/i)).toBeInTheDocument()
  })
})
