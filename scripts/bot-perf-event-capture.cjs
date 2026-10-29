// Test-only observation of the public simulation boundary. Instrument the bundle,
// never production sources; preserve arguments, results and generator scheduling.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const hook = '__botPerfRuleResult';
exports.hook = hook;
exports.eventCapturePlugin = root => {
  const entry = path.join(root, 'src/server-entry/index.ts');
  const source = fs.readFileSync(entry, 'utf8');
  const ast = ts.createSourceFile(entry, source, ts.ScriptTarget.Latest, true);
  const names = [];
  for (const statement of ast.statements) {
    if (!ts.isExportDeclaration(statement) || statement.isTypeOnly || !statement.exportClause || !ts.isNamedExports(statement.exportClause)) continue;
    for (const element of statement.exportClause.elements) if (!element.isTypeOnly) names.push(element.name.text);
  }
  return { name: 'observe-rule-results', setup(build) {
    build.onResolve({ filter: /^perf:original-server-entry$/ }, () => ({ path: entry, namespace: 'perf-original' }));
    build.onLoad({ filter: /.*/, namespace: 'perf-original' }, () => ({ contents: source, loader: 'ts', resolveDir: path.dirname(entry) }));
    build.onLoad({ filter: /[/\\]src[/\\]server-entry[/\\]index\.ts$/ }, () => ({ loader: 'js', resolveDir: path.dirname(entry), contents:
      `import * as raw from 'perf:original-server-entry';\n` + names.map(name =>
        `export const ${name} = ${/^[a-z]/.test(name) ? `typeof raw.${name} === 'function' ? (...args) => { const result = raw.${name}(...args); globalThis.${hook}?.(result); return result; } : ` : ''}raw.${name};`).join('\n') }));
  } };
};
