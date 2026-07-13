import { describe, it, expect } from 'vitest'
import { cosine, nearest, analogy, embedText, type WordVectors } from '../embeddings'

// A hand-built 2-D "embedding space" with a known geometry, so the assertions test the
// helper *logic* (not GloVe). The real bundled vectors' quality — king−man+woman≈queen,
// dog→cat, semantic retrieval — is validated offline when word-vectors.json is generated.
//   man=(1,0) woman=(0,1) king=(1,2) queen=(0,3): king − man + woman = (0,3) = queen.
const wv: WordVectors = {
  dims: 2,
  vectors: {
    man: [1, 0],
    woman: [0, 1],
    king: [1, 2],
    queen: [0, 3],
    dog: [5, 5],
    cat: [5, 4.9],
    rock: [-5, -5],
  },
}

describe('embeddings helpers', () => {
  it('cosine: identical → 1, opposite → −1, orthogonal → 0', () => {
    expect(cosine([1, 0], [1, 0])).toBeCloseTo(1)
    expect(cosine([1, 0], [-1, 0])).toBeCloseTo(-1)
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0)
  })

  it('nearest returns the closest words by cosine, excluding the query', () => {
    const near = nearest(wv, 'dog', 3).map((n) => n.word)
    expect(near[0]).toBe('cat') // near-parallel direction
    expect(near).not.toContain('dog')
    expect(near).not.toContain('rock') // opposite direction ranks last
  })

  it('analogy solves a − b + c via the constructed geometry', () => {
    // king − man + woman = queen
    expect(analogy(wv, 'king', 'man', 'woman')[0].word).toBe('queen')
  })

  it('analogy returns nothing when a term is out of vocabulary', () => {
    expect(analogy(wv, 'king', 'man', 'unknownword')).toHaveLength(0)
  })

  it('embedText drops stopwords + OOV words and reports both', () => {
    const e = embedText(wv, 'the king and a xyzzy')
    expect(e.used).toEqual(['king'])
    expect(e.used).not.toContain('the') // stopword
    expect(e.skipped).toContain('xyzzy') // out of vocabulary
    expect(e.vec).not.toBeNull()
  })

  it('embedText unit-normalizes before averaging (large-norm words do not dominate)', () => {
    // dog=(5,5) has a big norm; king=(1,2) small. A naive average would lean toward dog's
    // direction; unit-normalizing first gives each equal weight, so the result bisects them.
    const v = embedText(wv, 'dog king').vec as number[]
    const dirDog = cosine(v, [1, 1]) // dog's unit direction
    const dirKing = cosine(v, [1, 2]) // king's unit direction
    expect(Math.abs(dirDog - dirKing)).toBeLessThan(0.15) // roughly balanced, not dog-dominated
  })

  it('embedText returns null when no known content words remain', () => {
    expect(embedText(wv, 'the and a of').vec).toBeNull()
  })
})
