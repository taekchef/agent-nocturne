# Troubleshooting Agent Nocturne

## Keyboard stays lit or restores to the wrong brightness

```bash
nocturne restore
nocturne daemon stop
```

Set the keyboard to the desired brightness, then start the daemon again. While idle, Agent Nocturne polls every 1.5 seconds and adopts manual brightness changes as the new baseline.

## Native backend unavailable

From the cloned repository:

```bash
npm run build:native
nocturne daemon probe
```

If native control fails, use mock mode:

```bash
NOCTURNE_BACKEND=mock nocturne daemon start
```

The helper depends on Apple's private `CoreBrightness.framework`, which may change between macOS versions.

## Pi extension does not fire

1. Confirm only one symlink points to the adapter:

   ```bash
   ls -l ~/.pi/agent/extensions/*nocturne* ~/.pi/agent/extensions/agent-light.ts 2>/dev/null
   ```

2. Confirm `nocturne` is on `PATH`, or set `NOCTURNE_BIN` to the cloned `bin/nocturne.mjs`.
3. Restart Pi or run `/reload`.
4. Check the compatibility log:

   ```bash
   tail -50 ~/Library/Logs/AgentLight/agent-light.log
   ```

## Claude Code plugin does not fire

```bash
claude plugin list
claude plugin validate --strict /path/to/agent-nocturne
```

Confirm `agent-nocturne@agent-nocturne` is enabled and `nocturne` is on the hook process `PATH`. If CC Switch rewrites Claude settings, preserve the Agent Nocturne entries in `enabledPlugins` and `extraKnownMarketplaces` without replacing routing fields.

## Codex reports hooks need review

This is expected after installation or any hook definition change. Open `/hooks`, inspect the command and source, then trust the current Agent Nocturne hook hash. Installation alone does not bypass Codex hook trust.

## Codex CLI works but Desktop does not

Start a new Desktop conversation after enabling and trusting the plugin. CLI and Desktop share Codex plugin configuration, but an already-running conversation may retain its previous lifecycle configuration.

Do not work around this by tailing transcripts or rollout files. Capture the Codex version and report the compatibility issue instead.

## Configuration changes do not appear

Configuration is loaded when the daemon starts:

```bash
nocturne daemon stop
nocturne daemon start
nocturne config show
```

## Hooks must not block agents

All adapters are fail-open and write no model-visible stdout. If the core or native helper is missing, Pi, Claude Code, and Codex should continue normally. Diagnose through the local log rather than expecting hook errors in the agent UI.

## Keep the keyboard dark when backlight is off

Set:

```json
{
  "respectKeyboardOff": true
}
```

Then restart the daemon.

## Legacy environment variables

`AGENT_LIGHT_BIN`, `AGENT_LIGHT_BACKEND`, `AGENT_LIGHT_ENABLED`, and `AGENT_LIGHT_DISABLE_PI` remain supported. Prefer the corresponding `NOCTURNE_*` names for new installations.
