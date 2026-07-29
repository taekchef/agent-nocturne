# Install Agent Light

## Requirements

- macOS on a MacBook with a built-in backlit keyboard
- Node.js 20+
- Xcode Command Line Tools for the native backend

## 1. Clone and build

```bash
git clone https://github.com/taekchef/macbook-agent-light.git
cd macbook-agent-light
npm run build:native
npm link
```

The native helper uses Apple's private `CoreBrightness.framework` dynamically. If build or probe fails, use the mock backend for development.

## 2. Initialize config

```bash
agent-light config init
agent-light config show
```

Restart the daemon after editing configuration.

## 3. Start daemon

```bash
agent-light daemon start
agent-light status
```

## 4. Install Pi extension

Run this from the cloned repository:

```bash
mkdir -p ~/.pi/agent/extensions
ln -sf "$PWD/adapters/pi/agent-light.ts" ~/.pi/agent/extensions/agent-light.ts
```

Restart Pi or run `/reload`.

## 5. Test

```bash
agent-light test thinking --duration 3
agent-light test done --duration 1
agent-light restore
```

## Experimental adapters

Claude Code and Codex adapter packages live under `adapters/`. Their hook scripts have mock smoke coverage, but installation and host behavior can vary by host version. Review the included manifests before enabling them globally.

Set `AGENT_LIGHT_BIN` to an explicit `bin/agent-light.mjs` path if an adapter cannot resolve the repository-local CLI or the global `agent-light` command.

## Uninstall / rollback

```bash
agent-light restore
agent-light daemon stop
rm -f ~/.pi/agent/extensions/agent-light.ts
npm unlink -g agent-light
```

Remove Claude Code or Codex plugin installs separately if enabled.
