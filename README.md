<div align="center">

<img src="site/og.png" alt="Agent Nocturne" width="640" />

# Agent Nocturne

**在键盘的背光上，为你的 agent 弹一首夜曲。**

[Website](https://taekchef.github.io/agent-nocturne/) · [中文](README.zh-CN.md)

[![MIT](https://img.shields.io/badge/License-MIT-3d5a48.svg)](LICENSE)
[![Node](https://img.shields.io/badge/Node.js-%E2%89%A520-3d5a48.svg)](https://nodejs.org)
[![macOS](https://img.shields.io/badge/Platform-macOS-3d5a48.svg)](https://www.apple.com/macos)

</div>

> *One brightness. Six rhythms. The keyboard breathes while the agent thinks.*

Pi · Claude Code · Codex — three agents, one quiet signal, played on the light already beneath your hands. No RGB, no banners, nothing leaves the machine.

---

## Install

macOS · Node.js ≥ 20 · Xcode CLT. Then:

```bash
git clone https://github.com/taekchef/agent-nocturne.git
cd agent-nocturne && npm run build:native && npm link
nocturne config init && nocturne daemon start
```

Pick an agent:

```bash
# Claude Code
claude plugin marketplace add taekchef/agent-nocturne
claude plugin install agent-nocturne@agent-nocturne

# Codex
codex plugin marketplace add taekchef/agent-nocturne --ref main
codex plugin add agent-nocturne@agent-nocturne

# Pi
ln -sf "$PWD/adapters/pi/agent-light.ts" ~/.pi/agent/extensions/agent-nocturne.ts
```

Verify, then pause when you've seen enough:

```bash
nocturne test thinking --duration 3   # watch it breathe
nocturne pause                         # silence it
nocturne resume                        # let it speak again
```

## The language of light

| State | Cadence |
|---|---|
| `thinking` | 4.8 s asymmetric breath |
| `tool` | 1.8 s dim pulse |
| `permission` | 540 ms urgent blink |
| `waiting-input` | two taps, every 2.5 s |
| `done` | one soft exhale |
| `error` | four sharp flashes |

A MacBook keyboard owns a single global brightness — so meaning lives in *timing*, never color. Recoverable tool failures dip once; terminal failures stutter four times. Parallel tools merge into one beat.

## Commands

```bash
nocturne status                  # is it alive?
nocturne test <state> -d <sec>   # play a rhythm
nocturne restore                 # back to your brightness
nocturne pause / resume          # silence / revive
nocturne daemon start|stop       # lifecycle
```

Hooks emit no model-visible output and never approve or deny tools. Adapters fail-open — the agent runs on regardless.

## Under the hood

```
adapter → nocturne CLI → Unix socket (0600) → daemon → CoreBrightness
```

Per-session state machine, priority arbitration, 80 ms active ticks / 1.5 s idle. Config lives at `~/Library/Application Support/AgentLight/config.json`.

> [!WARNING]
> The native helper drives Apple's private `CoreBrightness.framework`. No kext, no privilege — but a future macOS may break it. `nocturne restore` + `NOCTURNE_BACKEND=mock` recover gracefully.

## Privacy

Local-only. User-only socket. No account, cloud, or analytics. Logs stay on disk, never uploaded.

## Develop

```bash
npm run check && npm test
NOCTURNE_BACKEND=mock npm run smoke:mock
```

---

[MIT](LICENSE) · [@taekchef](https://github.com/taekchef) · [中文](README.zh-CN.md)
