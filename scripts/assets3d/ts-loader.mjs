// Node loader: TypeScript's JS compiler only; no esbuild/tsx subprocess or disk cache.
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
export async function resolve(specifier, context, next) {
    try {
        return await next(specifier, context);
    }
    catch (error) {
        if (specifier.startsWith('.') && context.parentURL?.endsWith('.ts')) {
            return next(`${specifier}.ts`, context);
        }
        throw error;
    }
}
export async function load(url, context, next) {
    if (!url.endsWith('.ts'))
        return next(url, context);
    const source = ts.transpileModule(await readFile(new URL(url), 'utf8'), {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }, fileName: url,
    }).outputText;
    return { format: 'module', shortCircuit: true, source };
}
