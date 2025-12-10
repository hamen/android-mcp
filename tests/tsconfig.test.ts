import assert from 'node:assert';
import { spawn } from 'node:child_process';

async function runTscNoEmit() {
  const cwd = new URL('..', import.meta.url).pathname;
  const proc = spawn('npx', ['--yes', 'tsc', '-p', 'tsconfig.json', '--noEmit'], {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stdout = '';
  let stderr = '';

  return new Promise<void>((resolve, reject) => {
    proc.stdout.on('data', (d) => (stdout += d.toString()));
    proc.stderr.on('data', (d) => (stderr += d.toString()));
    proc.on('close', (code) => {
      if (code === 0) return resolve();
      reject(new Error(`tsc failed with code ${code}: ${stderr || stdout}`));
    });
    proc.on('error', reject);
  });
}

await runTscNoEmit();
assert.ok(true, 'tsc should succeed');
