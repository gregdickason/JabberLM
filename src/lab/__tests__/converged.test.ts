import { describe, it, expect } from 'vitest'
import { ConvergenceGate } from '../converged'

describe('ConvergenceGate — threshold mode', () => {
  it('needs at least `window` checkpoints before it can converge', () => {
    const g = new ConvergenceGate({ window: 5, threshold: 90 })
    for (const y of [95, 96, 97, 98]) g.record('a', y) // only 4
    expect(g.converged()).toBe(false)
  })

  it('converges when the last window are all ≥ the bar', () => {
    const g = new ConvergenceGate({ window: 5, threshold: 90 })
    for (const y of [40, 70, 91, 92, 93, 94, 95]) g.record('a', y)
    expect(g.converged()).toBe(true)
  })

  it('does not converge if any of the last window dips below the bar', () => {
    const g = new ConvergenceGate({ window: 5, threshold: 90 })
    for (const y of [91, 92, 88, 94, 95]) g.record('a', y) // the 88 is inside the window
    expect(g.converged()).toBe(false)
  })

  it('requires ALL gate curves to have converged', () => {
    const g = new ConvergenceGate({ window: 5, threshold: 90 })
    for (const y of [91, 92, 93, 94, 95]) g.record('a', y) // a converged
    for (const y of [80, 80, 80, 80, 80]) g.record('b', y) // b well below the bar
    expect(g.converged()).toBe(false)
    for (const y of [91, 92, 93, 94, 95]) g.record('b', y) // b's last 5 now all ≥90
    expect(g.converged()).toBe(true)
  })

  it('reset() clears history', () => {
    const g = new ConvergenceGate({ window: 3, threshold: 90 })
    for (const y of [95, 96, 97]) g.record('a', y)
    expect(g.converged()).toBe(true)
    g.reset()
    expect(g.converged()).toBe(false)
  })
})

describe('ConvergenceGate — plateau mode', () => {
  it('does not fire while the metric is still climbing', () => {
    const g = new ConvergenceGate({ mode: 'plateau', window: 5, epsilon: 3 })
    for (const y of [10, 30, 55, 70, 82]) g.record('a', y) // spread 72 > 3
    expect(g.converged()).toBe(false)
  })

  it('fires once the recent window is flat within epsilon — even below 90', () => {
    const g = new ConvergenceGate({ mode: 'plateau', window: 5, epsilon: 3 })
    for (const y of [10, 40, 70, 78, 79, 80, 78, 79]) g.record('a', y) // last 5: [78,79,80,78,79] spread 2
    expect(g.converged()).toBe(true)
  })
})
