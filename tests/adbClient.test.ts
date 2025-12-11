import assert from 'node:assert';
import { AdbService } from '../src/adbClient.js';

const service = new AdbService();
const client: any = (service as any).client;
const device = client.getDevice('dummy-serial');

assert.strictEqual(typeof device.shell, 'function', 'device client should expose shell()');
assert.strictEqual(typeof device.screencap, 'function', 'device client should expose screencap()');
