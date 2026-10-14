/** Vite exposes fixture files as immutable source text; each test parses its own graph. */
declare module '*.json?raw' {
  const source: string;
  export default source;
}
