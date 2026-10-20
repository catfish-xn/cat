const fs = require('node:fs');
const cp = require('node:child_process');
const ts = require('typescript');
const baseline = 'a0d42c592cbd48fb075175e5f61818dabfe1b320';
const files = cp.execFileSync('git', ['diff', '--name-only', baseline, '--', 'tests'], { encoding: 'utf8' })
  .trim().split('\n').filter(file => file.endsWith('.test.ts'));
const printer = ts.createPrinter({ removeComments: true });
function inspect(source) {
  const file = ts.createSourceFile('test.ts', source, ts.ScriptTarget.Latest, true);
  const canonical = node => {
    const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.Standard,
      printer.printNode(ts.EmitHint.Unspecified, node, file));
    const tokens = [];
    for (let kind = scanner.scan(); kind !== ts.SyntaxKind.EndOfFileToken; kind = scanner.scan())
      tokens.push([kind, scanner.getTokenText()]);
    return JSON.stringify(tokens);
  };
  function root(expression) {
    while (ts.isCallExpression(expression) || ts.isPropertyAccessExpression(expression)) expression = expression.expression;
    return ts.isIdentifier(expression) ? expression.text : undefined;
  }
  function assertions(node) {
    const found = [];
    function visit(n) {
      if (ts.isCallExpression(n) && ['expect', 'deepStrictEqual'].includes(root(n.expression))) found.push(canonical(n));
      ts.forEachChild(n, visit);
    }
    visit(node);
    return found.sort();
  }
  const cases = [];
  function visit(node) {
    if (ts.isCallExpression(node) && root(node.expression) === 'it') {
      const callback = node.arguments.find(arg => ts.isArrowFunction(arg) || ts.isFunctionExpression(arg));
      if (callback) {
        const last = node.arguments.at(-1);
        cases.push({ assertions: assertions(callback.body), timeout: ts.isNumericLiteral(last) ? last.text : 'default' });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return { assertions: assertions(file), cases };
}
const results = files.map(file => {
  const before = inspect(cp.execFileSync('git', ['show', `${baseline}:${file}`], { encoding: 'utf8' }));
  const after = inspect(fs.readFileSync(file, 'utf8'));
  if (JSON.stringify(before) !== JSON.stringify(after)) throw Error(`assertion, case or timeout mismatch: ${file}`);
  return { file, before: before.assertions.length, after: after.assertions.length,
    testCallbacks: before.cases.length, identical: true, eachCallbackAssertionsAndTimeoutIdentical: true };
});
console.log(JSON.stringify(results, null, 2));
