import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import ts from 'typescript';

const root = resolve(import.meta.dirname, '..');
const outputRoot = mkdtempSync(join(tmpdir(), 'wifi-mouse-tests-'));

export function transpileTestModules(sourcePaths) {
  for (const sourcePath of sourcePaths) {
    const source = readFileSync(join(root, sourcePath), 'utf8');
    const outputPath = join(outputRoot, sourcePath.replace(/\.ts$/, '.js'));
    mkdirSync(dirname(outputPath), { recursive: true });
    const output = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText;
    writeFileSync(outputPath, output);
  }
  return outputRoot;
}

export function cleanupTestModules() {
  rmSync(outputRoot, { recursive: true, force: true });
}
