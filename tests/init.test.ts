import assert from 'node:assert';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

type JsonRpcResponse = { jsonrpc: '2.0'; id: number; result?: any; error?: any };

function encodeRequest(id: number, method: string, params: Record<string, unknown> = {}) {
  return JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n';
}

function createLineParser(onMessage: (msg: JsonRpcResponse) => void) {
  let buffer = '';
  return (chunk: Buffer) => {
    buffer += chunk.toString();
    while (true) {
      const newlineIndex = buffer.indexOf('\n');
      if (newlineIndex === -1) break;
      const line = buffer.slice(0, newlineIndex).trimEnd();
      buffer = buffer.slice(newlineIndex + 1);
      if (!line) continue;
      const parsed = JSON.parse(line) as JsonRpcResponse;
      onMessage(parsed);
    }
  };
}

async function runTest() {
  const proc = spawn('npx', ['--yes', 'tsx', './src/server.ts'], {
    cwd: new URL('..', import.meta.url).pathname,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const messages: JsonRpcResponse[] = [];
  const rawStdout: string[] = [];
  const parseStdout = createLineParser((msg) => messages.push(msg));
  proc.stdout.on('data', (chunk) => {
    rawStdout.push(chunk.toString());
    parseStdout(chunk);
  });

  const stderr: string[] = [];
  proc.stderr.on('data', (d) => stderr.push(d.toString()));

  await delay(1000);
  proc.stdin.write(
    encodeRequest(1, 'initialize', {
      protocolVersion: '2024-11-05',
      clientInfo: { name: 'test-client', version: '0.0.1' },
      capabilities: {},
    }),
  );
  proc.stdin.write(encodeRequest(2, 'tools/list'));

  const deadline = Date.now() + 5000;
  while (messages.length < 2 && Date.now() < deadline) {
    await delay(50);
  }

  proc.kill();

  if (messages.length < 2) {
    throw new Error(
      `Timed out waiting for responses. stderr=${stderr.join(
        '',
      )} stdout=${rawStdout.join('')}`,
    );
  }

  const init = messages.find((m) => m.id === 1);
  assert(init?.result?.serverInfo?.name === 'android-mcp', 'serverInfo missing or wrong');

  const tools = messages.find((m) => m.id === 2);
  if (!Array.isArray(tools?.result?.tools)) {
    throw new Error(`tools/list did not return an array: ${JSON.stringify(tools)}`);
  }
  assert((tools.result.tools as unknown[]).length > 0, 'no tools returned');
}

await runTest();

