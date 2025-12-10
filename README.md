# Android MCP 🤖✨

[![npm](https://img.shields.io/badge/npm-private-lightgrey)](#) [![node](https://img.shields.io/badge/node-%E2%89%A518-green)](#-requirements) [![adb](https://img.shields.io/badge/ADB-required-blue)](#-requirements) [![ci](https://img.shields.io/badge/CI-coming%20soon-lightgrey)](#-notes--limits)

Friendly MCP stdio server that chats with Android devices over ADB using `@devicefarmer/adbkit`, speaking newline-delimited JSON-RPC via `@modelcontextprotocol/sdk` (no `Content-Length` headers needed). Plug it into Cursor/Claude MCP and start poking at devices.

## ✨ What is this?
- MCP transport that forwards handy ADB actions (tap, text, screenshot, UI dump, etc).
- Uses newline-delimited JSON on stdin/stdout; one request per line, one response per line.
- Prototype-friendly: swap out the minimal JSON-RPC loop for a full MCP SDK later if you want.

## 📦 Requirements
- Node.js 18+ and npm.
- ADB on PATH (e.g., Android SDK platform-tools). Keep `adb start-server` running.
- At least one device or emulator attached (`adb devices`).
- Optional: Android SDK/Gradle only if you plan to build the demo app; not needed for the MCP server itself.

## 🚀 Setup (local)
```bash
git clone <repo-url> android-mcp
cd android-mcp
npm ci           # or npm install
npm test         # stdio + tsconfig smoke tests
npm run dev      # start MCP server with tsx
# or explicitly:
npx --yes tsx src/server.ts
```
To build output: `npm run build` (emits `dist/`). Keep `adb devices` happy before invoking tools.

## 🧰 MCP config (Cursor/Claude)
Example `~/.cursor/mcp.json` entry:
```json
{
  "mcpServers": {
    "android-mcp": {
      "type": "stdio",
      "command": "npx",
      "args": ["--yes", "tsx", "/home/ivan/code/android-mcp/src/server.ts"],
      "cwd": "/home/ivan/code/android-mcp"
    }
  }
}
```

## 🎮 Tools exposed
- `selectDevice` `{ serial }` → set default device for subsequent calls.
- `keyEvent` `{ keyCode, serial? }` → send `input keyevent`.
- `tap` `{ x, y, serial? }`
- `text` `{ text, serial? }` → uses `input text` (spaces become `%s`).
- `startActivity` `{ component, serial? }` → e.g. `"org.example/.MainActivity"`.
- `screenshot` `{ serial? }` → `{ mimeType: "image/png", base64 }`.
- `uiDump` `{ serial? }` → parsed `uiautomator dump` tree (text, contentDesc, resourceId, bounds).
- `findAndTap` `{ text?, contentDesc?, serial? }` → finds the first matching node and taps its center.
- `listDevicesDetailed` → lists attached devices with model/manufacturer/sdk info.

## 📸 Notes & limits
- Screenshot and UI dump are periodic snapshots (no streaming yet).
- UI dump depends on `uiautomator` being present on the device.
- Prototype transport; you can wire in a richer MCP SDK without changing the ADB helpers.

## 🧪 Tests
```bash
npm test
```

## 📱 Optional: Build/install the demo app
Only needed if you want to exercise the sample Android UI:
```bash
# from the parent monorepo that contains the Android app
./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n org.dronix.android.kindlegratis/.MainActivity
```

## 🛠️ CI hints
- Node workflow: checkout → setup-node 18+ → `npm ci` → `npm test`.
- If building the Android app in CI, add Java 17 + Android SDK setup and run `./gradlew assembleDebug`.
