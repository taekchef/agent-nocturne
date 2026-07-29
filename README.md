# Agent Light for MacBook

Agent Light turns the built-in MacBook keyboard backlight into a calm, local status indicator for coding agents.

It uses cadence—not color—to distinguish normal work, tool activity, requests for attention, completion, and failure. The built-in keyboard backlight supports global brightness only; Agent Light does not provide RGB or per-key effects.

## Support status

| Integration | Status |
|---|---|
| Pi | Verified with mock and native backends |
| Claude Code hooks | Experimental; hook-script smoke tested |
| Codex CLI/App hooks | Experimental; packaging included, host validation pending |

## Lighting language

| State/event | Default effect |
|---|---|
| `thinking` | slow asymmetric 4.8s breathing |
| `tool-start` / `tool` | one batch-entry acknowledgement, then a dim active pulse |
| `tool-error` | one muted dip for a recoverable tool failure |
| `permission` | urgent high-contrast blink |
| `waiting-input` | two reminder taps |
| `blocked` | long-pause heartbeat |
| `compact` | very slow low breath |
| `background` | dim heartbeat |
| `done` | one soft completion exhale |
| `error` | sharp stutter for a terminal failure |
| `cancelled` | fade-down pulse |
| `idle` | restore the latest user brightness baseline |

Parallel tools are grouped into one batch, so routine reads and shell calls do not repeatedly flash the keyboard. Recoverable tool failures remain distinct from terminal agent failures.

## Requirements

- macOS on a MacBook with a built-in backlit keyboard
- Node.js 20 or newer
- Xcode Command Line Tools (`clang`) for the native backend

> [!WARNING]
> The native helper dynamically uses Apple's private `CoreBrightness.framework`. It requires no kernel extension or elevated privileges, but Apple may change or remove this API in a future macOS release. Use `agent-light restore` to recover the captured brightness and the mock backend when native control is unavailable.

## Install from source

```bash
git clone https://github.com/taekchef/macbook-agent-light.git
cd macbook-agent-light
npm run build:native
npm link
agent-light config init
agent-light daemon start
agent-light status
```

Test the hardware and restore the original brightness:

```bash
agent-light test thinking --duration 3
agent-light test done --duration 1
agent-light restore
```

Use the mock backend while developing or testing adapters:

```bash
AGENT_LIGHT_BACKEND=mock agent-light test thinking --duration 2
AGENT_LIGHT_BACKEND=mock agent-light status
```

## Pi adapter

From the cloned repository:

```bash
mkdir -p ~/.pi/agent/extensions
ln -sf "$PWD/adapters/pi/agent-light.ts" ~/.pi/agent/extensions/agent-light.ts
```

Run `/reload` in Pi or restart Pi. The adapter is fail-open: lighting failures never interrupt the agent.

To disable it temporarily:

```bash
AGENT_LIGHT_DISABLE_PI=1 pi
```

## Commands

```bash
agent-light notify thinking --agent pi --session abc
agent-light notify tool-start --agent pi --tool bash
agent-light notify tool-error --agent pi --tool bash
agent-light notify tool-end --agent pi --tool bash
agent-light notify permission --agent codex
agent-light notify done --agent claude
agent-light notify error --agent pi --terminal
agent-light notify idle --agent pi

agent-light status
agent-light test thinking --duration 5
agent-light restore
agent-light daemon start
agent-light daemon stop
agent-light config show
```

## Configuration

Configuration lives at:

```text
~/Library/Application Support/AgentLight/config.json
```

The default calm profile is equivalent to:

```json
{
  "backend": "auto",
  "maxBrightness": 0.8,
  "minBrightness": 0.05,
  "respectKeyboardOff": false,
  "effects": {
    "thinking": { "periodMs": 4800 },
    "permission": { "periodMs": 540, "reminderPeriodMs": 2000 },
    "tool": { "periodMs": 1800 },
    "done": { "pulses": 1 },
    "error": { "pulses": 4 }
  }
}
```

Restart the daemon after changing configuration. If the captured baseline is `0`, animations still temporarily light the keyboard by default and restore it to `0` on idle. Set `respectKeyboardOff` to `true` to keep the keyboard dark.

## Architecture

```text
Pi / Claude Code / Codex adapter
            │ local JSON event
            ▼
      agent-light CLI
            │ Unix socket (mode 0600)
            ▼
     agent-light daemon
            │ serialized brightness writes
            ▼
 CoreBrightness helper or mock backend
```

The daemon tracks state per agent session, applies priorities across concurrent agents, expires stale states with TTLs, and refreshes the user's brightness baseline while idle. Active animation ticks run at 80ms; idle polling drops to 1.5s.

## Privacy and safety

- All processing is local; Agent Light makes no network requests.
- Logs may contain local working-directory paths, agent names, tool names, and opaque session IDs.
- Logs are stored at `~/Library/Logs/AgentLight/agent-light.log` and are never uploaded by the project.
- The Unix socket is created with user-only permissions (`0600`).
- Adapters fail open and use a one-second timeout.
- `agent-light restore` restores the captured baseline brightness.

## Development

```bash
npm run check
npm test
npm run build:native
AGENT_LIGHT_BACKEND=mock npm run smoke:mock
```

See [installation notes](docs/install.md) and [troubleshooting](docs/troubleshooting.md).

## License

[MIT](LICENSE)
