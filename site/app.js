const keyboardRows = [
  [["esc", 1], ["1", 1], ["2", 1], ["3", 1], ["4", 1], ["5", 1], ["6", 1], ["7", 1], ["8", 1], ["9", 1], ["0", 1], ["-", 1], ["=", 1], ["delete", 1.6]],
  [["tab", 1.45], ["Q", 1], ["W", 1], ["E", 1], ["R", 1], ["T", 1], ["Y", 1], ["U", 1], ["I", 1], ["O", 1], ["P", 1], ["[", 1], ["]", 1], ["\\", 1.2]],
  [["caps", 1.75], ["A", 1], ["S", 1], ["D", 1], ["F", 1], ["G", 1], ["H", 1], ["J", 1], ["K", 1], ["L", 1], [";", 1], ["'", 1], ["return", 1.75]],
  [["shift", 2.25], ["Z", 1], ["X", 1], ["C", 1], ["V", 1], ["B", 1], ["N", 1], ["M", 1], [",", 1], [".", 1], ["/", 1], ["shift", 2.25]],
  [["fn", 1], ["control", 1], ["option", 1], ["command", 1.25], ["", 5.2], ["command", 1.25], ["option", 1], ["◀", 0.8], ["▲", 0.8], ["▶", 0.8]],
];

const isZh = document.documentElement.lang.toLowerCase().startsWith("zh");
const ui = isZh
  ? { menu: "菜单", close: "关闭", copy: "复制", copied: "已复制", copyStatus: "命令已复制", copyError: "复制失败，请手动选择命令。" }
  : { menu: "Menu", close: "Close", copy: "Copy", copied: "Copied", copyStatus: "Command copied", copyError: "Copy failed. Select the command manually." };

const states = isZh ? {
  thinking: {
    name: "思考中",
    cadence: "4.8 秒呼吸",
    description: "Agent 正在推理。较长的吸气和更慢的呼气保持存在感，但不会持续打扰你。",
  },
  tool: {
    name: "工具执行",
    cadence: "1.8 秒脉冲",
    description: "一次柔和提示标记工具批次开始。工具运行期间，键盘保持低亮度活动脉冲。",
  },
  permission: {
    name: "权限请求",
    cadence: "540 毫秒注意闪烁",
    description: "Agent 需要你的决定才能继续。这是最明显的持续信号。",
  },
  waiting: {
    name: "等待输入",
    cadence: "每 2.5 秒两次轻触",
    description: "两次短促轻触表示 Agent 正在等待回复，随后回到安静亮度。",
  },
  done: {
    name: "完成",
    cadence: "一次完成呼气",
    description: "一次柔和起落结束当前 turn，随后 daemon 恢复用户最新亮度。",
  },
  error: {
    name: "终局错误",
    cadence: "四段急促闪烁",
    description: "有限的急促闪烁只用于终局失败。可恢复的工具错误只产生一次柔和下沉。",
  },
} : {
  thinking: {
    name: "Thinking",
    cadence: "4.8 second breath",
    description: "The agent is reasoning. The long inhale and slower exhale stay present without demanding attention.",
  },
  tool: {
    name: "Tool activity",
    cadence: "1.8 second pulse",
    description: "A single acknowledgement marks the start of a tool batch. A dim pulse remains while tools are active.",
  },
  permission: {
    name: "Permission",
    cadence: "540 ms attention blink",
    description: "The agent cannot continue without a decision. This is intentionally the strongest recurring signal.",
  },
  waiting: {
    name: "Waiting input",
    cadence: "two taps every 2.5 seconds",
    description: "Two brief taps say the agent needs a reply, then the keyboard returns to a quiet resting level.",
  },
  done: {
    name: "Done",
    cadence: "one completion exhale",
    description: "One soft rise and fall closes the turn. The daemon then restores the latest user brightness.",
  },
  error: {
    name: "Terminal error",
    cadence: "four-part stutter",
    description: "A sharp finite stutter is reserved for terminal failure. Recoverable tool failures use one muted dip instead.",
  },
};

for (const keyboard of document.querySelectorAll("[data-keyboard]")) {
  keyboard.replaceChildren(...keyboardRows.map(createKeyboardRow));
}

for (const control of document.querySelectorAll("[data-state-control]")) {
  control.addEventListener("click", () => setDemoState(control.closest("[data-demo]"), control.dataset.stateControl));
}

for (const button of document.querySelectorAll("[data-menu-button]")) {
  const nav = document.getElementById(button.getAttribute("aria-controls"));
  button.addEventListener("click", () => {
    const open = button.getAttribute("aria-expanded") !== "true";
    button.setAttribute("aria-expanded", String(open));
    nav.dataset.open = String(open);
    button.textContent = open ? ui.close : ui.menu;
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  for (const button of document.querySelectorAll('[data-menu-button][aria-expanded="true"]')) {
    const nav = document.getElementById(button.getAttribute("aria-controls"));
    button.setAttribute("aria-expanded", "false");
    nav.dataset.open = "false";
    button.textContent = ui.menu;
    button.focus();
  }
});

for (const button of document.querySelectorAll("[data-copy-button]")) {
  button.addEventListener("click", async () => {
    const block = button.closest(".code-block");
    const text = block.querySelector("code")?.textContent ?? "";
    const status = block.querySelector(".copy-status");
    try {
      await copyText(text);
      button.textContent = ui.copied;
      status.textContent = ui.copyStatus;
    } catch {
      button.textContent = ui.copy;
      status.textContent = ui.copyError;
    }
    window.setTimeout(() => {
      button.textContent = ui.copy;
      status.textContent = "";
    }, 1800);
  });
}

const tabs = [...document.querySelectorAll("[data-install-tab]")];
for (const [index, tab] of tabs.entries()) {
  tab.addEventListener("click", () => selectInstallTab(tab.dataset.installTab));
  tab.addEventListener("keydown", (event) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    const offset = event.key === 'ArrowRight' ? 1 : -1;
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
    const text = document.createElement("span");
    text.className = "key-label";
    text.textContent = label || "space";
    key.append(text);
    row.append(key);
  }
  return row;
}

function setDemoState(demo, stateName) {
  if (!demo || !states[stateName]) return;
  const state = states[stateName];
  const keyboard = demo.querySelector("[data-keyboard]");
  keyboard.dataset.state = "";
  void keyboard.offsetWidth;
  keyboard.dataset.state = stateName;
  demo.querySelector("[data-state-name]").textContent = state.name;
  demo.querySelector("[data-state-cadence]").textContent = state.cadence;
  const description = demo.querySelector("[data-state-description]");
  if (description) description.textContent = state.description;
  for (const control of demo.querySelectorAll("[data-state-control]")) {
    control.setAttribute("aria-pressed", String(control.dataset.stateControl === stateName));
  }
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
