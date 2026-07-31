<div align="center">

<img src="site/og.png" alt="Agent Nocturne" width="640" />

# Agent Nocturne

**为你的 coding agent 演奏一首夜曲 —— 在 MacBook 键盘背光上。**

[官网](https://taekchef.github.io/agent-nocturne/) · [English](README.md) · [安装](https://taekchef.github.io/agent-nocturne/#install)

[![License: MIT](https://img.shields.io/badge/License-MIT-3d5a48.svg)](LICENSE)
[![Node](https://img.shields.io/badge/Node.js-%E2%89%A520-3d5a48.svg)](https://nodejs.org)
[![Platform](https://img.shields.io/badge/Platform-macOS-3d5a48.svg)](https://www.apple.com/macos)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-3d5a48.svg)](CONTRIBUTING.md)

</div>

---

> 夜曲（nocturne）是为夜晚作的安静小曲。Agent Nocturne 把你的 MacBook 键盘背光变成同样克制的信号 —— 让 coding agent 不必把你的视线从工作里拽走，也能告诉你它走到哪了。

Agent Nocturne 把 MacBook 内置键盘背光变成一套给 [Pi](https://github.com/earendil-works/pi-coding-agent)、Claude Code、Codex 用的**本地状态语言**。

它用**节奏，而不是颜色**来区分思考、工具执行、请求授权、完成与失败。MacBook 键盘只有一个全局亮度值，所以 Agent Nocturne 不假装能做 RGB 或逐键变色 —— 它把*时间*变成语义。

## 一句话概览

- 🎵 **节奏优先于颜色** —— 六种节奏（呼吸、脉冲、闪烁、轻触、呼气、急促）承载状态，而非色相。
- 🔒 **完全本地** —— 事件只走当前用户私有的 Unix socket（`0600`）。没有账户、云服务或分析，数据不离开本机。
- 🛟 **失败不阻塞** —— daemon 或 adapter 不可用时，coding agent 照常运行。
- 🔌 **三个 adapter** —— Pi、Claude Code、Codex，通过各自的生命周期 hook 观察。

## 快速开始

安装核心（macOS、Node.js ≥ 20、Xcode Command Line Tools）：

```bash
git clone https://github.com/taekchef/agent-nocturne.git
cd agent-nocturne
npm run build:native
npm link
nocturne config init
nocturne daemon start
nocturne status
```

然后添加一个 adapter（以 Claude Code 为例）：

```bash
claude plugin marketplace add taekchef/agent-nocturne
claude plugin install agent-nocturne@agent-nocturne
```

测试硬件，再恢复捕获到的亮度：

```bash
nocturne test thinking --duration 3
nocturne test done --duration 1
nocturne restore
```

完整 adapter 安装见 [安装指南](https://taekchef.github.io/agent-nocturne/#install) 与 [docs/install.md](docs/install.md)。

## 为什么叫「Nocturne（夜曲）」？

*夜曲*是为夜晚而作的乐曲 —— 安静、克制，属于深夜。当你夜里写代码、agent 在后台跑，你不想要横幅、提示音，也不想一直切回终端盯着看。你想要一个停留在注意力边缘的信号。

于是键盘演奏起一首小小的夜曲：agent 思考时缓慢呼吸，完成时柔和呼气，只有真正失败时才急促闪烁几次。房间保持安静，你继续工作。

## 支持状态

| 集成 | 状态 |
|---|---|
| Pi | 已用 mock 与 native 后端验证 |
| Claude Code | 官方插件；严格校验与实时 hook 执行已验证 |
| Codex CLI | 已在 0.145.0 上验证正常与工具 turn |
| Codex Desktop | 已通过 ChatGPT Desktop 内置 0.146 app-server 验证 |

所有 adapter 均为 fail-open：Agent Nocturne 或 daemon 不可用时，coding agent 照常运行。

## 夜曲灯效语言

| 状态 / 事件 | 默认效果 |
|---|---|
| `thinking` | 4.8 秒缓慢非对称呼吸 |
| `tool-start` / `tool` | 一次批次确认，随后低亮度活动脉冲 |
| `tool-error` | 一次柔和下沉（可恢复的工具失败）|
| `permission` | 高对比急促闪烁 |
| `waiting-input` | 两次提醒轻触 |
| `blocked` | 长停顿心跳 |
| `compact` | 极慢低呼吸 |
| `background` | 低亮度心跳 |
| `done` | 一次柔和完成呼气 |
| `error` | 急促闪烁（终局失败）|
| `cancelled` | 渐弱脉冲 |
| `idle` | 恢复用户最新亮度基线 |

并行工具合并为一次批次，所以日常读文件、跑 shell 不会反复闪键盘。可恢复的工具失败与终局 agent 失败始终保持区分。

## 环境要求

- macOS，带内置背光键盘的 MacBook
- Node.js 20 或更新
- Xcode Command Line Tools（`clang`），用于 native 后端

> [!WARNING]
> native helper 动态使用 Apple 私有框架 `CoreBrightness.framework`。它不需要内核扩展或提权，但 Apple 可能在未来 macOS 版本中改动或移除该 API。native 控制不可用时，用 `nocturne restore` 恢复捕获的亮度，并使用 mock 后端。

## 安装核心

```bash
git clone https://github.com/taekchef/agent-nocturne.git
cd agent-nocturne
npm run build:native
npm link
nocturne config init
nocturne daemon start
nocturne status
```

旧命令 `agent-light` 仍是别名。已有的配置、日志、socket 名与 `AgentLight` 应用支持目录在过渡期继续保留。

测试硬件并恢复原始亮度：

```bash
nocturne test thinking --duration 3
nocturne test done --duration 1
nocturne restore
```

开发时用 mock 后端：

```bash
NOCTURNE_BACKEND=mock nocturne test thinking --duration 2
NOCTURNE_BACKEND=mock nocturne status
```

## Pi

在克隆的仓库目录下：

```bash
mkdir -p ~/.pi/agent/extensions
ln -sf "$PWD/adapters/pi/agent-light.ts" ~/.pi/agent/extensions/agent-nocturne.ts
```

在 Pi 中运行 `/reload` 或重启 Pi。用 `NOCTURNE_DISABLE_PI=1 pi` 临时禁用。

## Claude Code

先装核心，再装官方插件：

```bash
claude plugin marketplace add taekchef/agent-nocturne
claude plugin install agent-nocturne@agent-nocturne
```

插件只观察生命周期 hook，不注入 prompt 上下文，不做权限决策。

## Codex CLI 与 Desktop

先装核心，再装官方插件：

```bash
codex plugin marketplace add taekchef/agent-nocturne --ref main
codex plugin add agent-nocturne@agent-nocturne
```

在 Codex 中打开 `/hooks`，审阅并信任 Agent Nocturne 的 hook 定义。Codex 会对非托管 hook 计算哈希，改动后需重新审阅。启用插件后开启新的 CLI 会话或 Desktop 对话。

Codex 在非零 Bash 退出后触发 `PostToolUse`，但 Codex CLI 0.145.0 与测试用的 Desktop 0.146 app-server 在该事件发送空 `tool_response`。在 Codex 提供结构化结果数据前，Agent Nocturne 无法可靠区分这类可恢复失败与成功工具。Codex 也没有 Claude Code 终局 `StopFailure` 的等价 hook，因此不对 Codex 声称失败检测对等。

## 命令

```bash
nocturne notify thinking --agent pi --session abc
nocturne notify tool-start --agent pi --tool Bash
nocturne notify tool-error tool-end --agent pi --tool Bash
nocturne notify permission --agent codex
nocturne notify done --agent claude
nocturne notify error --agent pi --terminal
nocturne notify idle --agent pi

nocturne status
nocturne test thinking --duration 5
nocturne restore
nocturne pause
nocturne resume
nocturne daemon start
nocturne daemon stop
nocturne config show
```

### 暂停与恢复

`nocturne pause` 立即让键盘安静下来，亮度回到你的设定值并保持。暂停状态会被持久化，所以即使 daemon 重启（包括 agent hook 触发的自动重启），灯光也不会复活。`nocturne resume` 重新打开信号。

## 配置

兼容路径：

```text
~/Library/Application Support/AgentLight/config.json
```

默认 Nocturne profile 等价于：

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

改完配置需重启 daemon。若捕获到的基线是 `0`，动画期间默认临时点亮键盘，idle 时恢复为 `0`。设 `respectKeyboardOff` 为 `true` 可始终保持熄灭。

## 架构

```text
Pi / Claude Code / Codex adapter
              │ 本地归一化事件
              ▼
        nocturne CLI
              │ Unix socket（mode 0600）
              ▼
     Agent Nocturne daemon
              │ 串行化亮度写入
              ▼
  CoreBrightness helper 或 mock 后端
```

daemon 按 agent session 跟踪状态，对并发 agent 做优先级仲裁，清理过期状态，并在空闲时刷新用户亮度基线。活动动画 tick 为 80ms，空闲轮询降到 1.5s。

## 隐私与安全

- 运行时处理完全本地；Agent Nocturne 不发起任何网络请求。
- 日志可能包含工作目录路径、agent 名、工具名与不透明 session ID。
- 兼容日志路径：`~/Library/Logs/AgentLight/agent-light.log`。
- 项目从不上传日志。
- Unix socket 仅当前用户可访问（`0600`）。
- hook 不写 model-visible stdout，也绝不批准或拒绝工具。
- `nocturne restore` 恢复捕获到的基线亮度。

## 常见问题

**会一直让背光亮着吗？**
不会。`idle` 时 daemon 恢复你最新的手动亮度基线 —— 包括 `0`（熄灭）。设 `respectKeyboardOff: true` 可让动画期间也保持熄灭。

**觉得烦想关掉怎么办？**
`nocturne pause`。键盘立即安静下来并保持 —— 即使 agent 触发了会自动拉起 daemon 的 hook，灯光也不会复活。`nocturne resume` 重新打开。

**我手动调亮度时会和它打架吗？**
不会。空闲时 daemon 每 1.5s 刷新基线，你的手动调整会成为新的静止亮度。`nocturne restore` 始终回到它。

**支持外接键盘吗？**
不支持。它通过私有 `CoreBrightness` API 驱动内置 MacBook 键盘背光，该 API 不涉及外接设备。

**有 Windows / Linux 版吗？**
没有。硬件控制路径是 macOS 专属。mock 后端可用于任意 OS 的开发与 CI。

## 开发

```bash
npm run check
npm test
npm run validate:claude
npm run build:native
NOCTURNE_BACKEND=mock npm run smoke:mock
```

参见 [安装说明](docs/install.md) 与 [排错](docs/troubleshooting.md)。

## 许可证

[MIT](LICENSE) · 由 [@taekchef](https://github.com/taekchef) 构建

English version: [README.md](README.md).
