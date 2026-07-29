# Troubleshooting

## Keyboard stays lit or restores to the wrong brightness

```bash
agent-light restore
agent-light daemon stop
```

Start the daemon again after setting the keyboard to the brightness you want captured as the baseline.

While idle, Agent Light checks the hardware every 1.5 seconds and adopts manual brightness changes as the new baseline.

## Native backend unavailable

From the cloned repository:

```bash
npm run build:native
agent-light daemon probe
```

If native control fails, use mock mode:

```bash
AGENT_LIGHT_BACKEND=mock agent-light daemon start
```

The native helper depends on Apple's private `CoreBrightness.framework`, which may change between macOS versions.

## Pi extension does not fire

1. Confirm the symlink exists:

   ```bash
   ls -l ~/.pi/agent/extensions/agent-light.ts
   ```

2. Confirm `agent-light` is on `PATH`, or set `AGENT_LIGHT_BIN` to the cloned `bin/agent-light.mjs`.
3. Restart Pi or run `/reload`.
4. Check the local log:

   ```bash
   tail -50 ~/Library/Logs/AgentLight/agent-light.log
   ```

## Configuration changes do not appear

Configuration is loaded when the daemon starts:

```bash
agent-light daemon stop
agent-light daemon start
agent-light config show
```

## Hooks must not block agents

All adapters are fail-open. If Agent Light is missing or broken, Pi, Claude Code, and Codex should continue normally. Diagnose through the local log rather than expecting hook errors in the agent UI.

## Keep the keyboard dark when backlight is off

Set:

```json
{
  "respectKeyboardOff": true
}
```

Then restart the daemon.
