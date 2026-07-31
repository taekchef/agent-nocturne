<div align="center">

<img src="site/og.png" alt="Agent Nocturne" width="640" />

# Agent Nocturne

**在键盘的背光上，为你的 agent 弹一首夜曲。**

[官网](https://taekchef.github.io/agent-nocturne/) · [English](README.md)

[![MIT](https://img.shields.io/badge/License-MIT-3d5a48.svg)](LICENSE)
[![Node](https://img.shields.io/badge/Node.js-%E2%89%A520-3d5a48.svg)](https://nodejs.org)
[![macOS](https://img.shields.io/badge/Platform-macOS-3d5a48.svg)](https://www.apple.com/macos)

</div>

> *一束光，六种节奏。agent 思考时，键盘在呼吸。*

Pi · Claude Code · Codex —— 三个 agent，一道安静的信号，就在你手下的光里。不要 RGB，不要横幅，什么都不出本机。

---

## 安装

macOS · Node.js ≥ 20 · Xcode CLT。然后：

```bash
git clone https://github.com/taekchef/agent-nocturne.git
cd agent-nocturne && npm run build:native && npm link
nocturne config init && nocturne daemon start
```

选一个 agent：

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

验证，看够了就关掉：

```bash
nocturne test thinking --duration 3   # 看它呼吸
nocturne pause                         # 让它安静
nocturne resume                        # 让它再开口
```

## 光的语言

| 状态 | 节奏 |
|---|---|
| `thinking` | 4.8 秒非对称呼吸 |
| `tool` | 1.8 秒低幅脉冲 |
| `permission` | 540 毫秒急促闪烁 |
| `waiting-input` | 每 2.5 秒两次轻触 |
| `done` | 一次柔和呼气 |
| `error` | 四段急促短闪 |

MacBook 键盘只有一个全局亮度 —— 所以语义藏在*节奏*里，不在颜色。可恢复的工具错误只下沉一次，终局失败才连闪四下。并行工具合成一拍。

## 命令

```bash
nocturne status                  # 它还活着吗
nocturne test <状态> -d <秒>     # 弹一段节奏
nocturne restore                 # 回到你的亮度
nocturne pause / resume          # 静默 / 复活
nocturne daemon start|stop       # 生命周期
```

Hook 不写 model 可见的输出，也绝不批准或拒绝工具。adapter 失败不阻塞 —— agent 照常运行。

## 内里

```
adapter → nocturne CLI → Unix socket (0600) → daemon → CoreBrightness
```

按 session 跟踪的状态机，优先级仲裁，活动时 80ms 一拍、空闲时 1.5s。配置在 `~/Library/Application Support/AgentLight/config.json`。

> [!WARNING]
> native helper 驱动 Apple 私有 `CoreBrightness.framework`。无需内核扩展、无需提权 —— 但未来 macOS 可能破坏它。`nocturne restore` + `NOCTURNE_BACKEND=mock` 可优雅降级。

## 隐私

完全本地。用户私有 socket。没有账户、云服务或分析。日志留在磁盘，从不上传。

## 开发

```bash
npm run check && npm test
NOCTURNE_BACKEND=mock npm run smoke:mock
```

---

[MIT](LICENSE) · [@taekchef](https://github.com/taekchef) · [English](README.md)
