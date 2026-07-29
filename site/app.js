const keyboardRows = [
  [["esc", 1], ["1", 1], ["2", 1], ["3", 1], ["4", 1], ["5", 1], ["6", 1], ["7", 1], ["8", 1], ["9", 1], ["0", 1], ["-", 1], ["=", 1], ["delete", 1.6]],
  [["tab", 1.45], ["Q", 1], ["W", 1], ["E", 1], ["R", 1], ["T", 1], ["Y", 1], ["U", 1], ["I", 1], ["O", 1], ["P", 1], ["[", 1], ["]", 1], ["\\", 1.2]],
  [["caps", 1.75], ["A", 1], ["S", 1], ["D", 1], ["F", 1], ["G", 1], ["H", 1], ["J", 1], ["K", 1], ["L", 1], [";", 1], ["'", 1], ["return", 1.75]],
  [["shift", 2.25], ["Z", 1], ["X", 1], ["C", 1], ["V", 1], ["B", 1], ["N", 1], ["M", 1], [",", 1], [".", 1], ["/", 1], ["shift", 2.25]],
  [["fn", 1], ["control", 1], ["option", 1], ["command", 1.25], ["", 5.2], ["command", 1.25], ["option", 1], ["◀", 0.8], ["▲", 0.8], ["▶", 0.8]],
];

const copy = {
  en: {
    skip: "Skip to main content",
    installNav: "Install",
    eyebrow: "MacBook keyboard status",
    headline: "See what your agent is doing.",
    lede: "Agent Nocturne turns one global keyboard brightness value into a quiet status language for Pi, Claude Code, and Codex.",
    installCta: "Install",
    sourceCta: "View source",
    globalLight: "Global backlight",
    stateThinking: "Thinking",
    stateTool: "Tool",
    statePermission: "Permission",
    stateWaiting: "Waiting",
    stateDone: "Done",
    stateError: "Error",
    installEyebrow: "Install",
    installHeadline: "Install once. Add your agents.",
    installLede: "macOS, Node.js 20 or newer, and a MacBook with a backlit keyboard.",
    coreLabel: "Core",
    copy: "Copy",
    piNote: "Link the extension, then run /reload inside Pi.",
    claudeNote: "Install the plugin from the repository marketplace.",
    codexNote: "Install the plugin, then review its hook definitions in /hooks.",
    runtimeLabel: "Runtime",
    runtimeValue: "Local only",
    socketLabel: "Socket",
    adapterLabel: "Adapters",
    adapterValue: "Fail-open",
    hardwareLabel: "Hardware",
    hardwareValue: "Global white light",
    footer: "Open source under the MIT License. No account, cloud service, or analytics.",
    fullGuide: "Full guide",
    license: "License",
  },
  zh: {
    skip: "跳到主要内容",
    installNav: "安装",
    eyebrow: "MacBook 键盘状态灯",
    headline: "看一眼键盘，就知道 Agent 在做什么。",
    lede: "Agent Nocturne 把 MacBook 的全局键盘亮度变成 Pi、Claude Code 和 Codex 的安静状态语言。",
    installCta: "安装",
    sourceCta: "查看源码",
    globalLight: "全局背光",
    stateThinking: "思考",
    stateTool: "工具",
    statePermission: "权限",
    stateWaiting: "等待",
    stateDone: "完成",
    stateError: "错误",
    installEyebrow: "安装",
    installHeadline: "安装一次，接入你的 Agent。",
    installLede: "需要 macOS、Node.js 20 或更新版本，以及带背光键盘的 MacBook。",
    coreLabel: "核心",
    copy: "复制",
    piNote: "链接扩展，然后在 Pi 内运行 /reload。",
    claudeNote: "从仓库 marketplace 安装插件。",
    codexNote: "安装插件，然后在 /hooks 中逐项检查 hook 定义。",
    runtimeLabel: "运行方式",
    runtimeValue: "仅限本机",
    socketLabel: "Socket",
    adapterLabel: "适配器",
    adapterValue: "Fail-open",
    hardwareLabel: "硬件",
    hardwareValue: "全局白色背光",
    footer: "MIT 开源。无需账户、云服务或 analytics。",
    fullGuide: "完整指南",
    license: "许可证",
  },
};

const states = {
  en: {
    thinking: { name: "Thinking", cadence: "4.8 second breath", description: "The whole keyboard breathes together. Nothing moves or changes size." },
    tool: { name: "Tool activity", cadence: "1.8 second pulse", description: "A low global pulse stays visible while a tool batch is active." },
    permission: { name: "Permission", cadence: "540 ms attention blink", description: "The full backlight blinks because the agent cannot continue without you." },
    waiting: { name: "Waiting for input", cadence: "two taps every 2.5 seconds", description: "Two brief full-keyboard taps ask for a reply, then the light rests." },
    done: { name: "Done", cadence: "one 1.2 second exhale", description: "One soft global rise and fall closes the turn." },
    error: { name: "Terminal error", cadence: "four short flashes", description: "Four finite global flashes are reserved for terminal failure." },
  },
  zh: {
    thinking: { name: "思考中", cadence: "4.8 秒呼吸", description: "整块键盘同步呼吸。键帽和字符不会移动，也不会改变尺寸。" },
    tool: { name: "工具执行", cadence: "1.8 秒脉冲", description: "工具批次运行时，整块键盘保持低幅度全局脉冲。" },
    permission: { name: "权限请求", cadence: "540 毫秒注意闪烁", description: "Agent 需要你的决定，因此整块背光会明显闪烁。" },
    waiting: { name: "等待输入", cadence: "每 2.5 秒两次轻触", description: "整块键盘短促亮起两次，请求回复，然后回到安静亮度。" },
    done: { name: "完成", cadence: "一次 1.2 秒呼气", description: "一次柔和的全局起落结束当前 turn。" },
    error: { name: "终局错误", cadence: "四次短闪", description: "四次有限的全局闪烁只用于终局失败。" },
  },
};

const root = document.documentElement;
let language = initialLanguage();
let activeState = "thinking";

for (const keyboard of document.querySelectorAll("[data-keyboard]")) {
  keyboard.replaceChildren(...keyboardRows.map(createKeyboardRow));
}

applyLanguage(language, false);
applyRoom(readStorage("agent-nocturne-room") === "dark" ? "dark" : "light", false);

for (const button of document.querySelectorAll("[data-state-control]")) {
  button.addEventListener("click", () => setDemoState(button.dataset.stateControl, true));
}

document.querySelector("[data-language-toggle]")?.addEventListener("click", () => {
  applyLanguage(language === "en" ? "zh" : "en", true);
});

document.querySelector("[data-room-toggle]")?.addEventListener("click", () => {
  applyRoom(root.dataset.room === "dark" ? "light" : "dark", true);
});

for (const button of document.querySelectorAll("[data-copy-button]")) {
  button.addEventListener("click", async () => {
    const block = button.closest(".code-block");
    const text = block.querySelector("code")?.textContent ?? "";
    const status = block.querySelector(".copy-status");
    try {
      await copyText(text);
      button.textContent = language === "zh" ? "已复制" : "Copied";
      status.textContent = language === "zh" ? "命令已复制" : "Command copied";
    } catch {
      status.textContent = language === "zh" ? "复制失败，请手动选择命令。" : "Copy failed. Select the command manually.";
    }
    window.setTimeout(() => {
      button.textContent = copy[language].copy;
      status.textContent = "";
    }, 1800);
  });
}

const tabs = [...document.querySelectorAll("[data-install-tab]")];
for (const [index, tab] of tabs.entries()) {
  tab.addEventListener("click", () => selectInstallTab(tab.dataset.installTab));
  tab.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    const offset = event.key === "ArrowRight" ? 1 : -1;
    const next = tabs[(index + offset + tabs.length) % tabs.length];
    selectInstallTab(next.dataset.installTab);
    next.focus();
  });
}

function createKeyboardRow(keys) {
  const row = document.createElement("div");
  row.className = "key-row";
  row.setAttribute("aria-hidden", "true");
  for (const [label, size] of keys) {
    const key = document.createElement("span");
    key.className = "key";
    key.style.setProperty("--key-size", size);
    const legend = document.createElement("span");
    legend.className = "key-label";
    legend.textContent = label || "space";
    key.append(legend);
    row.append(key);
  }
  return row;
}

function setDemoState(stateName, restart) {
  if (!states[language][stateName]) return;
  activeState = stateName;
  const keyboard = document.querySelector("[data-keyboard]");
  if (restart) {
    keyboard.dataset.state = "";
    void keyboard.offsetWidth;
  }
  keyboard.dataset.state = stateName;
  const state = states[language][stateName];
  document.querySelector("[data-state-name]").textContent = state.name;
  document.querySelector("[data-state-cadence]").textContent = state.cadence;
  document.querySelector("[data-state-description]").textContent = state.description;
  for (const control of document.querySelectorAll("[data-state-control]")) {
    control.setAttribute("aria-pressed", String(control.dataset.stateControl === stateName));
  }
}

function applyLanguage(nextLanguage, updateUrl) {
  language = nextLanguage;
  root.dataset.language = language;
  root.lang = language === "zh" ? "zh-CN" : "en";
  for (const element of document.querySelectorAll("[data-i18n]")) {
    const value = copy[language][element.dataset.i18n];
    if (value) element.textContent = value;
  }
  const toggle = document.querySelector("[data-language-toggle]");
  toggle.textContent = language === "en" ? "中文" : "EN";
  toggle.setAttribute("aria-label", language === "en" ? "切换为中文" : "Switch to English");
  document.querySelector("[data-keyboard]").setAttribute("aria-label", language === "zh" ? "MacBook 键盘背光演示" : "MacBook keyboard backlight demonstration");
  document.querySelector(".state-controls").setAttribute("aria-label", language === "zh" ? "选择灯光状态" : "Choose a lighting state");
  document.querySelector(".install-tabs").setAttribute("aria-label", language === "zh" ? "Agent 适配器" : "Agent adapters");
  for (const button of document.querySelectorAll("[data-copy-button]")) button.textContent = copy[language].copy;
  setDemoState(activeState, false);
  updateRoomButton();
  writeStorage("agent-nocturne-language", language);
  if (updateUrl) {
    const url = new URL(window.location.href);
    if (language === "zh") url.searchParams.set("lang", "zh");
    else url.searchParams.delete("lang");
    history.replaceState(null, "", url);
  }
}

function applyRoom(room, persist) {
  root.dataset.room = room;
  document.querySelector('meta[name="theme-color"]').content = room === "dark" ? "#080909" : "#f3f1ec";
  updateRoomButton();
  if (persist) writeStorage("agent-nocturne-room", room);
}

function updateRoomButton() {
  const button = document.querySelector("[data-room-toggle]");
  if (!button) return;
  const dark = root.dataset.room === "dark";
  button.setAttribute("aria-pressed", String(dark));
  button.textContent = language === "zh" ? (dark ? "开灯" : "暗室") : (dark ? "Daylight" : "Dark room");
}

function selectInstallTab(name) {
  for (const tab of tabs) {
    const selected = tab.dataset.installTab === name;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
  }
  for (const panel of document.querySelectorAll("[data-install-panel]")) {
    panel.hidden = panel.dataset.installPanel !== name;
  }
}

function initialLanguage() {
  const query = new URLSearchParams(window.location.search).get("lang");
  if (query === "zh") return "zh";
  if (query === "en") return "en";
  return readStorage("agent-nocturne-language") === "zh" ? "zh" : "en";
}

function readStorage(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function writeStorage(key, value) {
  try { localStorage.setItem(key, value); } catch { /* storage is optional */ }
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("copy failed");
}
