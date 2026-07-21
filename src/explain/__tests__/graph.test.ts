import { describe, it, expect } from 'vitest'
import { answer, TRIPLES } from '../graph'

// The knowledge-graph coda earns its place by answering RELATIONAL / multi-hop questions
// via traversal — the thing flat chunk-retrieval can't do precisely. Lock the answers +
// the exact paths walked (the viz highlights these).
describe('knowledge-graph traversal', () => {
  it('1-hop aggregation: which animals live in the forest?', () => {
    const r = answer('animals')
    expect(r.answer.sort()).toEqual(['lion', 'wolf'])
    expect(r.path.every((t) => t.r === 'lives_in' && t.o === 'forest')).toBe(true)
  })

  it("2-hop chain: what does the prince's father rule?", () => {
    const r = answer('father-rules')
    expect(r.answer).toEqual(['kingdom'])
    expect(r.path).toEqual([
      { s: 'prince', r: 'child_of', o: 'king' },
      { s: 'king', r: 'rules', o: 'kingdom' },
    ])
  })

  it("2-hop chain: where does the king's heir live?", () => {
    const r = answer('heir-lives')
    expect(r.answer).toEqual(['castle'])
    expect(r.path).toEqual([
      { s: 'king', r: 'heir', o: 'prince' },
      { s: 'prince', r: 'lives_in', o: 'castle' },
    ])
  })

  it('every path edge is a real triple in the graph', () => {
    const has = (t: { s: string; r: string; o: string }) =>
      TRIPLES.some((x) => x.s === t.s && x.r === t.r && x.o === t.o)
    for (const id of ['animals', 'father-rules', 'heir-lives']) {
      for (const e of answer(id).path) expect(has(e)).toBe(true)
    }
  })
})
