# Android ADB MCP

MCP stdio server that talks to Android devices over the ADB protocol (using `@devicefarmer/adbkit`). It relies on the official `@modelcontextprotocol/sdk` with newline-delimited JSON-RPC framing (no `Content-Length` headers).

## Requirements

- ADB server available on the host (`adb start-server`).
- Node.js 18+.
- At least one device/emulator attached (`adb devices`).

## Install

```bash
cd mcp-android-adb
npm install
```

## Run (local)

```bash
npm run dev
```

Send newline-delimited JSON requests on stdin, one per line. Responses are emitted on stdout, also one per line.

## Cursor MCP entry

Example `~/.cursor/mcp.json` entry (matches the repo layout):

```json
{
  "mcpServers": {
    "android-adb": {
      "type": "stdio",
      "command": "npx",
      "args": ["--yes", "tsx", "/home/ivan/code/kindle-gratis-compose/mcp-android-adb/src/server.ts"],
      "cwd": "/home/ivan/code/kindle-gratis-compose/mcp-android-adb"
    }
  }
}
```

## Methods

- `selectDevice` `{ serial }` → sets default device for subsequent calls.
- `keyEvent` `{ keyCode, serial? }` → sends `input keyevent`.
- `tap` `{ x, y, serial? }`
- `text` `{ text, serial? }` → uses `input text` (spaces become `%s`).
- `startActivity` `{ component, serial? }` → e.g. `"org.example/.MainActivity"`.
- `screenshot` `{ serial? }` → `{ mimeType: "image/png", base64 }`.
- `uiDump` `{ serial? }` → parsed `uiautomator dump` tree (text, contentDesc, resourceId, bounds).
- `findAndTap` `{ text?, contentDesc?, serial? }` → finds first matching node in the UI tree and taps the center of its bounds.
- `listDevicesDetailed` → lists all attached devices with model/manufacturer/sdk info.

## Notes and limits

- Screenshot and UI dump are periodic (no streaming).
- UI dump depends on `uiautomator` being present on the device.
- This is a prototype transport; wiring to a full MCP SDK can replace the minimal JSON-RPC loop without changing the ADB helpers.

