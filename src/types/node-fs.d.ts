// Minimal ambient declaration for the one node API the data tests use.
//
// `tsconfig.app.json` covers all of `src`, including `__tests__`, and the project has no
// `@types/node` — it is a browser app, and adding node's full type surface to the app config to
// satisfy a test would be the wrong trade. The alternative, importing the model JSON directly,
// makes TypeScript infer a structural type for a megabyte of weights on every typecheck.
//
// So: declare exactly what is used. `src/data/__tests__/calibration.test.ts` reads the shipped
// model files to verify the cached sweeps still match them.
declare module 'node:fs' {
  export function readFileSync(path: string, encoding: 'utf8'): string
}
