## Android MCP – Standalone Repo Guide

This repo currently lives inside a larger monorepo. Follow these notes to split it out cleanly and set up local + CI workflows under the `android-mcp` name.

### Requirements
- Node.js 18+ and npm.
- ADB available on PATH. Typically from Android SDK Platform Tools (e.g. `~/Android/Sdk/platform-tools`). Verify with `adb version` and `adb devices`.
- Android SDK & Gradle: the Android app in the parent monorepo uses the Gradle wrapper in `/home/ivan/code/kindle-gratis-compose/gradlew`. For this MCP server only, you just need Node + ADB; for building the APK you need the Android SDK, platform-tools, and Java 17.

### Local setup (server only)
```bash
git clone <new-repo-url> android-mcp
cd android-mcp
npm install
npm test      # runs stdio init/tools smoke test
# run server
npx --yes tsx src/server.ts
```

Cursor/Claude MCP entry (stdio):
```json
{
  "mcpServers": {
    "android-mcp": {
      "type": "stdio",
      "command": "npx",
      "args": ["--yes", "tsx", "<repo>/src/server.ts"],
      "cwd": "<repo>"
    }
  }
}
```

### Tools exposed
- `listDevicesDetailed` → list devices with model/manufacturer/sdk
- `selectDevice`, `keyEvent`, `tap`, `text`, `startActivity`, `screenshot`, `uiDump`, `findAndTap`

### Optional: Build/install the demo app (APK)
Only needed if you want to exercise the app UI on device:
```bash
cd <monorepo-root>
./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n org.dronix.android.kindlegratis/.MainActivity
```

### CI suggestions
- Node workflow:
  - `runs-on: ubuntu-latest`
  - steps: checkout, setup-node 18+, `npm ci`, `npm test`
- Optional Android job (if you include the app):
  - Use `actions/setup-java` (Zulu 17) and `actions/setup-android-sdk`
  - Cache Gradle, run `./gradlew assembleDebug`

Example minimal GitHub Actions (node only):
```yaml
name: ci
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 18 }
      - run: npm ci
      - run: npm test
```

### How to split into its own repo
1) Create a new GitHub repo (e.g., `android-mcp`).
2) From the monorepo root:
```bash
mkdir /tmp/android-mcp
cp -r android-mcp/* /tmp/android-mcp
cd /tmp/android-mcp
git init
git add .
git commit -m "Initial import from kindle-gratis-compose"
git remote add origin <new-repo-url>
git push -u origin main
```
3) Add the `.cursor/mcp.json` (or global) entry pointing to the new path.
4) (Optional) Add the CI workflow file shown above.

### Notes
- Content returned to MCP tools is text-encoded JSON for compatibility with stdio clients.
- Ensure `adb devices` succeeds before invoking tools.
- If using the optional Android build, keep Java 17 and Android SDK platform-tools installed locally or configured in CI.
