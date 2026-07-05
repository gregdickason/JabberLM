import { describe, it, expect } from 'vitest'
import {
  TOOLS,
  TOOL_NAMES,
  buildHarnessCorpus,
  callLine,
  instructionLine,
  parseToolCall,
  harnessTrainVecs,
  harnessHeldOut,
} from '../harnessTasks'

describe('harnessTasks', () => {
  it('tools compute the correct results', () => {
    expect(TOOLS.sort([6, 9, 2])).toBe('2 6 9')
    expect(TOOLS.max([6, 9, 2])).toBe('9')
    expect(TOOLS.reverse([6, 9, 2])).toBe('2 9 6')
    expect(TOOLS.sum([6, 9, 2])).toBe('17')
  })

  it('builds a deterministic corpus containing all four tools', () => {
    const a = buildHarnessCorpus(3000)
    const b = buildHarnessCorpus(3000)
    expect(a).toBe(b) // deterministic
    for (const t of TOOL_NAMES) expect(a.includes(`${t}(`)).toBe(true)
  })

  it('line format round-trips through the parser', () => {
    const line = instructionLine('add up {n}', 'sum', [6, 9, 2]) // "add up 6 9 2 => sum(6 9 2) = 17"
    expect(line).toContain('=> sum(6 9 2) = 17')
    const p = parseToolCall(callLine('sum', [6, 9, 2]))
    expect(p).toEqual({ tool: 'sum', args: [6, 9, 2] })
  })

  it('parser rejects malformed / unknown calls (robustness)', () => {
    expect('error' in parseToolCall('nonsense')).toBe(true)
    expect('error' in parseToolCall('mox(6 9 2)')).toBe(true) // unknown tool
    expect('error' in parseToolCall('sum()')).toBe(true) // no args
    expect('error' in parseToolCall('sort(6 9')).toBe(true) // no closing paren
    expect(parseToolCall('the answer is max(4 1 7) ok')).toEqual({ tool: 'max', args: [4, 1, 7] })
  })

  it('held-out numbers are disjoint from training numbers', () => {
    const train = new Set(harnessTrainVecs().map((v) => v.join(',')))
    const held = harnessHeldOut()
    expect(held.length).toBeGreaterThan(100)
    expect(held.every((v) => !train.has(v.join(',')))).toBe(true)
  })
})
