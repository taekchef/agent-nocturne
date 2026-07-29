# Install Agent Nocturne

## Requirements

- macOS on a MacBook with a built-in backlit keyboard
- Node.js 20+
- Xcode Command Line Tools for the native backend

## 1. Install the core

```bash
git clone https://github.com/taekchef/agent-nocturne.git
cd agent-nocturne
npm run build:native
npm link
```

The native helper dynamically uses Apple's private `CoreBrightness.framework`. If build or probe fails, use the mock backend for development.

Plugin caches do not contain a locally compiled native helper. Install and link the core before installing a Claude Code or Codex plugin so their hooks can find `nocturne` on `PATH`.

## 2. Initialize configuration

```bash
nocturne config init
nocturne config show
```

Agent Nocturne keeps the compatibility path `~/Library/Application Support/AgentLight/config.json`; existing Agent Light users do not need a migration.

## 3. Start the daemon

```bash
nocturne daemon start
nocturne status
```

## 4. Install the Pi extension

From the cloned repository:

```bash
mkdir -p ~/.pi/agent/extensions
ln -sf "$PWD/adapters/pi/agent-light.ts" ~/.pi/agent/extensions/agent-nocturne.ts
```

Remove the old `~/.pi/agent/extensions/agent-light.ts` symlink if it points to the same adapter, otherwise Pi would load it twice. Restart Pi or run `/reload`.

## 5. Install the Claude Code plugin

```bash
claude plugin marketplace add taekchef/agent-nocturne
claude plugin install agent-nocturne@agent-nocturne
```

Verify with `/plugin` or:

```bash
claude plugin list
```

If a configuration manager such as CC Switch regenerates Claude settings, preserve these two user-level fields:

- `enabledPlugins["agent-nocturne@agent-nocturne"]`
- `extraKnownMarketplaces["agent-nocturne"]`

Do not replace unrelated `env`, `model`, status-line, or routing fields.

## 6. Install the Codex plugin

```bash
codex plugin marketplace add taekchef/agent-nocturne --ref main
codex plugin add agent-nocturne@agent-nocturne
```

Open `/hooks`, inspect the commands under Agent Nocturne, and trust their current hashes. Start a new Codex CLI session or Desktop conversation afterward.

If another application regenerates `~/.codex/config.toml`, preserve only the Agent Nocturne marketplace and plugin entries; do not replace model, provider, approval, sandbox, or routing configuration.

## 7. Test

```bash
nocturne test thinking --duration 3
nocturne test done --duration 1
nocturne restore
```

## Uninstall / rollback

```bash
nocturne restore
nocturne daemon stop
rm -f ~/.pi/agent/extensions/agent-nocturne.ts

claude plugin uninstall agent-nocturne@agent-nocturne
claude plugin marketplace remove agent-nocturne

codex plugin remove agent-nocturne@agent-nocturne
codex plugin marketplace remove agent-nocturne

npm unlink -g agent-nocturne
```

The legacy `agent-light` CLI alias and `AgentLight` data directory can remain during transition. Remove the data directory only if you deliberately want to delete local configuration and logs.
