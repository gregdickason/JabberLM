// A tiny, hand-authored knowledge graph over the same toy world as the RAG demo.
// Where semantic RAG returns a whole passage and hopes the model reasons over it, a
// graph lets you WALK exact subject→relation→object edges — including multi-hop chains —
// to compose a precise answer. Honest caveat: a real KG is *built by an LLM* extracting
// entities and relations from text; a 90K char-level model can't do that, so this graph
// is authored by hand — it demonstrates the shape of structured retrieval, not the extraction.

export interface Triple {
  s: string
  r: string
  o: string
}

// Royalty + animals — kept small (10 entities) so the graph stays legible.
export const TRIPLES: Triple[] = [
  { s: 'king', r: 'rules', o: 'kingdom' },
  { s: 'king', r: 'heir', o: 'prince' },
  { s: 'prince', r: 'child_of', o: 'king' },
  { s: 'princess', r: 'child_of', o: 'king' },
  { s: 'king', r: 'lives_in', o: 'castle' },
  { s: 'prince', r: 'lives_in', o: 'castle' },
  { s: 'lion', r: 'lives_in', o: 'forest' },
  { s: 'wolf', r: 'lives_in', o: 'forest' },
  { s: 'dragon', r: 'lives_in', o: 'mountain' },
]

/** Objects reachable from `s` along relation `r` — one graph hop. */
const objectsOf = (s: string, r: string): string[] =>
  TRIPLES.filter((t) => t.s === s && t.r === r).map((t) => t.o)

export interface GraphQuery {
  id: string
  question: string
  hops: number
}
export const QUERIES: GraphQuery[] = [
  { id: 'animals', question: 'Which animals live in the forest?', hops: 1 },
  { id: 'father-rules', question: "What does the prince's father rule?", hops: 2 },
  { id: 'heir-lives', question: "Where does the king's heir live?", hops: 2 },
]

export interface GraphAnswer {
  answer: string[]
  path: Triple[] // the exact edges walked to reach the answer
}

/** Answer one seeded query by traversing the graph, returning the answer(s) and the path. */
export function answer(id: string): GraphAnswer {
  switch (id) {
    case 'animals': {
      // relational aggregation: every subject that lives in the forest
      const path = TRIPLES.filter((t) => t.r === 'lives_in' && t.o === 'forest')
      return { answer: path.map((t) => t.s), path }
    }
    case 'father-rules': {
      // 2-hop: prince → (child_of) → king → (rules) → kingdom
      const father = objectsOf('prince', 'child_of')[0]
      const ruled = objectsOf(father, 'rules')[0]
      return {
        answer: [ruled],
        path: [
          { s: 'prince', r: 'child_of', o: father },
          { s: father, r: 'rules', o: ruled },
        ],
      }
    }
    case 'heir-lives': {
      // 2-hop: king → (heir) → prince → (lives_in) → castle
      const heir = objectsOf('king', 'heir')[0]
      const home = objectsOf(heir, 'lives_in')[0]
      return {
        answer: [home],
        path: [
          { s: 'king', r: 'heir', o: heir },
          { s: heir, r: 'lives_in', o: home },
        ],
      }
    }
    default:
      return { answer: [], path: [] }
  }
}
