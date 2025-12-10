import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { AdbService, UiNode } from './adbClient.js';

const adbService = new AdbService();
const DEFAULT_TIMEOUT_MS = 8000;

function log(msg: string, extra?: unknown) {
  const time = new Date().toISOString();
  if (extra !== undefined) {
    console.error(`[mcp-adb] ${time} ${msg}`, extra);
  } else {
    console.error(`[mcp-adb] ${time} ${msg}`);
  }
}

async function withTimeout<T>(promise: Promise<T>, ms = DEFAULT_TIMEOUT_MS): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms),
    ),
  ]);
}

function parseBounds(bounds?: string): { x: number; y: number } | null {
  if (!bounds) return null;
  const match = bounds.match(/\[(\d+),(\d+)]\[(\d+),(\d+)]/);
  if (!match) return null;
  const [, x1, y1, x2, y2] = match.map(Number) as number[];
  return { x: Math.floor((x1 + x2) / 2), y: Math.floor((y1 + y2) / 2) };
}

function findNode(node: UiNode, text?: string, contentDesc?: string): UiNode | null {
  const matchesText = text && node.text?.toLowerCase() === text.toLowerCase();
  const matchesDesc =
    contentDesc && node.contentDesc?.toLowerCase() === contentDesc.toLowerCase();
  if (matchesText || matchesDesc) return node;
  for (const child of node.children ?? []) {
    const found = findNode(child, text, contentDesc);
    if (found) return found;
  }
  return null;
}

const server = new McpServer({
  name: 'android-mcp',
  version: '0.2.0',
});

const optionalSerial = z.string().optional();

server.registerTool(
  'selectDevice',
  {
    description: 'Set default device by serial',
    inputSchema: z.object({ serial: z.string() }),
  },
  async ({ serial }) => {
    adbService.setDefaultDevice(serial);
    return { content: [{ type: 'text', text: `selected=${serial ?? 'none'}` }] };
  },
);

server.registerTool(
  'keyEvent',
  {
    description: 'Send key event (e.g., 3=HOME)',
    inputSchema: z.object({ keyCode: z.number(), serial: optionalSerial }),
  },
  async ({ keyCode, serial }) => {
    await withTimeout(adbService.sendKeyEvent(Number(keyCode), serial));
    return { content: [{ type: 'text', text: 'ok' }] };
  },
);

server.registerTool(
  'tap',
  {
    description: 'Tap coordinates',
    inputSchema: z.object({ x: z.number(), y: z.number(), serial: optionalSerial }),
  },
  async ({ x, y, serial }) => {
    await withTimeout(adbService.tap(Number(x), Number(y), serial));
    return { content: [{ type: 'text', text: 'ok' }] };
  },
);

server.registerTool(
  'text',
  {
    description: 'Input text via adb input',
    inputSchema: z.object({ text: z.string(), serial: optionalSerial }),
  },
  async ({ text, serial }) => {
    await withTimeout(adbService.inputText(String(text ?? ''), serial));
    return { content: [{ type: 'text', text: 'ok' }] };
  },
);

server.registerTool(
  'startActivity',
  {
    description: 'Start activity via component',
    inputSchema: z.object({ component: z.string(), serial: optionalSerial }),
  },
  async ({ component, serial }) => {
    await withTimeout(
      adbService.startActivity(
        { component: String(component ?? ''), wait: true },
        serial,
      ),
    );
    return { content: [{ type: 'text', text: 'ok' }] };
  },
);

server.registerTool(
  'screenshot',
  {
    description: 'Capture PNG screenshot',
    inputSchema: z.object({ serial: optionalSerial }),
  },
  async ({ serial }) => {
    const png = await adbService.takeScreenshot(serial);
    return {
      content: [
        {
          type: 'image',
          data: png.toString('base64'),
          mimeType: 'image/png',
        },
      ],
    };
  },
);

server.registerTool(
  'uiDump',
  {
    description: 'Dump UI tree via uiautomator',
    inputSchema: z.object({ serial: optionalSerial }),
  },
  async ({ serial }) => {
    const tree = await withTimeout(adbService.uiDump(serial));
    return { content: [{ type: 'text', text: JSON.stringify(tree) }] };
  },
);

server.registerTool(
  'findAndTap',
  {
    description: 'Find node by text/contentDesc and tap center',
    inputSchema: z
      .object({
        text: z.string().optional(),
        contentDesc: z.string().optional(),
        serial: optionalSerial,
      })
      .refine((v) => !!(v.text || v.contentDesc), {
        message: 'Either text or contentDesc is required',
        path: ['text'],
      }),
  },
  async ({ text, contentDesc, serial }) => {
    const tree = await withTimeout(adbService.uiDump(serial));
    const node = findNode(tree, text, contentDesc);
    if (!node) throw new Error('No matching node found');
    const center = parseBounds(node.bounds);
    if (!center) throw new Error('Node bounds missing; cannot tap');
    await withTimeout(adbService.tap(center.x, center.y, serial));
    return { content: [{ type: 'text', text: JSON.stringify({ ok: true, tapped: center }) }] };
  },
);

server.registerTool(
  'listDevicesDetailed',
  {
    description: 'List attached devices with model/manufacturer/sdk',
    inputSchema: z.object({}),
  },
  async () => {
    const devices = await adbService.listDevices();
    const details = await Promise.all(
      devices.map(async (d: { id: string; type: string }) => {
        try {
          const info = await withTimeout(adbService.getDeviceInfo(d.id));
          return { ...info, type: d.type };
        } catch (err) {
          return { serial: d.id, type: d.type, error: err instanceof Error ? err.message : String(err) };
        }
      }),
    );
    return { content: [{ type: 'text', text: JSON.stringify(details) }] };
  },
);

async function main() {
  log('server start');
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log('server connected');
}

await main();

