import adb, { StartActivityOptions } from '@devicefarmer/adbkit';
import { XMLParser } from 'fast-xml-parser';

export type UiNode = {
  text?: string;
  contentDesc?: string;
  resourceId?: string;
  class?: string;
  bounds?: string;
  children?: UiNode[];
};

type AdbDevice = { id: string; type: string };

export class AdbService {
  // Using any to stay compatible with adbkit's CJS export shape.
  private client: any;

  private defaultSerial?: string;

  constructor() {
    const adbAny = adb as any;
    const createClient = adbAny.createClient ?? adbAny.default?.createClient;
    if (typeof createClient !== 'function') {
      throw new Error('adbkit createClient not found');
    }
    this.client = createClient();
  }

  async listDevices(): Promise<AdbDevice[]> {
    return this.client.listDevices();
  }

  setDefaultDevice(serial: string | undefined): void {
    this.defaultSerial = serial;
  }

  private async resolveSerial(serial?: string): Promise<string> {
    const target = serial ?? this.defaultSerial;
    if (target) return target;
    const devices = await this.listDevices();
    if (devices.length === 1) {
      const single = devices[0];
      this.defaultSerial = single.id;
      return single.id;
    }
    throw new Error('No device selected. Provide a serial or call selectDevice when multiple devices are attached.');
  }

  async takeScreenshot(serial?: string): Promise<Buffer> {
    const { deviceClient } = await this.getDeviceClient(serial);
    try {
      const stream = await deviceClient.screencap();
      return await this.readStreamAsBuffer(stream);
    } catch {
      // Fallback to shell-based screencap for devices that lack the service
      const stream = await deviceClient.shell('screencap -p');
      return await this.readStreamAsBuffer(stream);
    }
  }

  async sendKeyEvent(keyCode: number, serial?: string): Promise<void> {
    const { deviceClient } = await this.getDeviceClient(serial);
    await deviceClient.shell(`input keyevent ${keyCode}`);
  }

  async tap(x: number, y: number, serial?: string): Promise<void> {
    const { deviceClient } = await this.getDeviceClient(serial);
    await deviceClient.shell(`input tap ${x} ${y}`);
  }

  async inputText(text: string, serial?: string): Promise<void> {
    const { deviceClient } = await this.getDeviceClient(serial);
    const escaped = text.replace(/ /g, '%s');
    await deviceClient.shell(`input text "${escaped}"`);
  }

  async startActivity(
    options: Omit<StartActivityOptions, 'component'> & { component: string },
    serial?: string,
  ): Promise<void> {
    const { deviceClient } = await this.getDeviceClient(serial);
    await deviceClient.startActivity(options);
  }

  async uiDump(serial?: string): Promise<UiNode> {
    const { deviceClient } = await this.getDeviceClient(serial);
    const dumpCommand =
      'uiautomator dump /sdcard/uidump.xml && cat /sdcard/uidump.xml && rm /sdcard/uidump.xml';
    const stream = await deviceClient.shell(dumpCommand);
    const xml = await this.readStreamAsString(stream);
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
      parseAttributeValue: false,
    });
    const parsed = parser.parse(xml);
    return this.normalizeUiTree(parsed?.hierarchy ?? parsed);
  }

  async getDeviceInfo(serial?: string): Promise<{
    serial: string;
    model: string;
    manufacturer: string;
    sdk: string;
    device: string;
    product: string;
  }> {
    const { deviceClient, resolved } = await this.getDeviceClient(serial);
    const props = [
      'ro.product.model',
      'ro.product.manufacturer',
      'ro.build.version.sdk',
      'ro.product.device',
      'ro.product.name',
    ];
    const cmd = props.map((p) => `getprop ${p}`).join(' && ');
    const stream = await deviceClient.shell(cmd);
    const out = (await this.readStreamAsString(stream))
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    const [model, manufacturer, sdk, device, product] = out;
    return {
      serial: resolved,
      model: model ?? '',
      manufacturer: manufacturer ?? '',
      sdk: sdk ?? '',
      device: device ?? '',
      product: product ?? '',
    };
  }

  private normalizeUiTree(node: any): UiNode {
    if (!node) {
      return {};
    }
    const childrenArray = Array.isArray(node.node) ? node.node : node.node ? [node.node] : [];
    return {
      text: node.text,
      contentDesc: node['content-desc'],
      resourceId: node['resource-id'],
      class: node.class,
      bounds: node.bounds,
      children: childrenArray.map((child: any) => this.normalizeUiTree(child)),
    };
  }

  private async readStreamAsString(stream: NodeJS.ReadableStream): Promise<string> {
    const buffer = await this.readStreamAsBuffer(stream);
    return buffer.toString('utf8');
  }

  private async readStreamAsBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
    const chunks: Buffer[] = [];
    return new Promise((resolve, reject) => {
      stream.on('data', (d: Buffer) => chunks.push(d));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  private async getDeviceClient(serial?: string) {
    const resolved = await this.resolveSerial(serial);
    const deviceClient = this.client.getDevice(resolved);
    return { deviceClient, resolved };
  }
}

