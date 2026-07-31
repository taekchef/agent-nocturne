/* Agent Nocturne - nocturne stage interactions.
 * Keyboard render + cadence demo + waveform sparklines + in-place i18n + copy + tabs.
 * Waveform samplers mirror src/effects.mjs so the on-page demo matches the real hardware.
 */
(() => {
  "use strict";

  const keyboardRows = [
    [["esc", 1], ["F1", 1], ["F2", 1], ["F3", 1], ["F4", 1], ["F5", 1], ["F6", 1], ["F7", 1], ["F8", 1], ["F9", 1], ["F10", 1], ["F11", 1], ["F12", 1], ["eject", 1]],
    [["`", 1], ["1", 1], ["2", 1], ["3", 1], ["4", 1], ["5", 1], ["6", 1], ["7", 1], ["8", 1], ["9", 1], ["0", 1], ["-", 1], ["=", 1], ["delete", 1.6]],
    [["tab", 1.45], ["Q", 1], ["W", 1], ["E", 1], ["R", 1], ["T", 1], ["Y", 1], ["U", 1], ["I", 1], ["O", 1], ["P", 1], ["[", 1], ["]", 1], ["\\", 1.2]],
    [["caps", 1.75], ["A", 1], ["S", 1], ["D", 1], ["F", 1], ["G", 1], ["H", 1], ["J", 1], ["K", 1], ["L", 1], [";", 1], ["'", 1], ["return", 1.75]],
    [["shift", 2.25], ["Z", 1], ["X", 1], ["C", 1], ["V", 1], ["B", 1], ["N", 1], ["M", 1], [",", 1], [".", 1], ["/", 1], ["shift", 2.25]],
    [["fn", 1], ["ctrl", 1], ["opt", 1], ["cmd", 1.25], ["", 5.2], ["cmd", 1.25], ["opt", 1], ["◀", 0.8], ["▲", 0.8], ["▼", 0.8], ["▶", 0.8]],
  ];

  const l10n = {
    en: {
      menu: "Menu", close: "Close", copy: "Copy", copied: "Copied",
      copyStatus: "Command copied", copyError: "Copy failed. Select the command manually.",
      room: "Room lights", langBtn: "中文",
      thinking: { name: "Thinking", cadence: "4.8 s breath", detail: "The agent is reasoning. A long inhale and a slower exhale stay present without demanding attention." },
      tool: { name: "Tool", cadence: "1.8 s pulse", detail: "A single acknowledgement marks the start of a tool batch. A dim pulse remains while tools are active." },
      permission: { name: "Permission", cadence: "540 ms blink", detail: "The agent cannot continue without a decision. This is intentionally the strongest recurring signal." },
      waiting: { name: "Waiting", cadence: "two taps · 2.5 s", detail: "Two brief taps say the agent needs a reply, then the keyboard returns to a quiet resting level." },
      done: { name: "Done", cadence: "one exhale", detail: "One soft rise and fall closes the turn. The daemon then restores the latest user brightness." },
      error: { name: "Error", cadence: "four flashes", detail: "A sharp finite stutter is reserved for terminal failure. Recoverable tool failures use one muted dip instead." },
    },
    zh: {
      menu: "菜单", close: "关闭", copy: "复制", copied: "已复制",
      copyStatus: "命令已复制", copyError: "复制失败，请手动选择命令。",
      room: "室内灯", langBtn: "EN",
      thinking: { name: "思考", cadence: "4.8 秒呼吸", detail: "Agent 正在推理。较长的吸气与更慢的呼气保持存在感，但不会持续打扰你。" },
      tool: { name: "工具", cadence: "1.8 秒脉冲", detail: "一次柔和提示标记工具批次开始。工具运行期间，键盘保持低亮度活动脉冲。" },
      permission: { name: "权限", cadence: "540 毫秒闪烁", detail: "Agent 需要你的决定才能继续。这是最明显的持续信号。" },
      waiting: { name: "等待", cadence: "每 2.5 秒两次轻触", detail: "两次短促轻触表示 Agent 正在等待回复，随后回到安静亮度。" },
      done: { name: "完成", cadence: "一次呼气", detail: "一次柔和起落结束当前 turn，随后 daemon 恢复用户最新亮度。" },
      error: { name: "错误", cadence: "四段急促闪烁", detail: "急促闪烁只用于终局失败。可恢复的工具错误只产生一次柔和下沉。" },
    },
  };

  /* ---------- Keyboard render ---------- */
  function buildKeyboard(target) {
    const frag = document.createDocumentFragment();
    for (const row of keyboardRows) {
      const rowEl = document.createElement("div");
      rowEl.className = "key-row";
      for (const [label, size] of row) {
        const key = document.createElement("span");
        key.className = "key";
        key.style.setProperty("--key-size", size);
        const lab = document.createElement("span");
        lab.className = "key-label";
        lab.textContent = label || "space";
        key.append(lab);
        rowEl.append(key);
      }
      frag.append(rowEl);
    }
    target.replaceChildren(frag);
  }

  /* ---------- State sync ---------- */
  let currentLang = "en";

  function getStateText(lang, name) { return l10n[lang][name]; }

  function setDemoState(stateName, source) {
    const t = getStateText(currentLang, stateName);
    if (!t) return;
    for (const demo of document.querySelectorAll("[data-demo]")) {
      const kb = demo.querySelector("[data-keyboard]");
      if (kb) { kb.dataset.state = ""; void kb.offsetWidth; kb.dataset.state = stateName; }
      const nm = demo.querySelector("[data-state-name]");
      const cd = demo.querySelector("[data-state-cadence]");
      if (nm) nm.textContent = t.name;
      if (cd) cd.textContent = t.cadence;
    }
    for (const c of document.querySelectorAll("[data-state-control]")) {
      c.setAttribute("aria-pressed", String(c.dataset.stateControl === stateName));
    }
  }

  /* ---------- i18n ---------- */
  function applyLang(lang) {
    currentLang = lang;
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
    document.documentElement.dataset.language = lang;
    for (const el of document.querySelectorAll("[data-en]")) {
      const v = lang === "zh" ? el.dataset.zh : el.dataset.en;
      if (v != null) el.textContent = v;
    }
    // sync active demo state label + cadence text
    const active = document.querySelector('.demo-toggles [aria-pressed="true"]');
    if (active) setDemoState(active.dataset.stateControl);
    // lang button label toggles
    const lt = document.querySelector("[data-language-toggle]");
    if (lt) { lt.textContent = l10n[lang].langBtn; lt.setAttribute("aria-pressed", String(lang === "zh")); }
    try { localStorage.setItem("nocturne-lang", lang); } catch {}
  }

  /* ---------- Theme (room mode) ---------- */
  function applyTheme(theme) {
    const root = document.documentElement;
    root.dataset.room = theme;
    const rt = document.querySelector("[data-room-toggle]");
    if (rt) rt.setAttribute("aria-pressed", String(theme === "light"));
    try { localStorage.setItem("nocturne-room", theme); } catch {}
    // reflect room mode in the URL without a navigation, so it survives reload
    history.replaceState(null, "", `#${root.dataset.room === "light" ? "lights" : ""}`);
  }

  /* ---------- Copy ---------- */
  async function copyText(text) {
    if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
    const ta = document.createElement("textarea");
    ta.value = text; ta.setAttribute("readonly", "");
    ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.append(ta); ta.select();
    const ok = document.execCommand("copy"); ta.remove();
    if (!ok) throw new Error("copy failed");
  }

  function wireCopy() {
    for (const btn of document.querySelectorAll("[data-copy-button]")) {
      btn.addEventListener("click", async () => {
        const block = btn.closest(".code-block");
        const text = block.querySelector("code")?.textContent ?? "";
        const status = block.querySelector(".copy-status");
        const L = l10n[currentLang];
        try {
          await copyText(text);
          btn.textContent = L.copied; if (status) status.textContent = L.copyStatus;
        } catch {
          btn.textContent = L.copy; if (status) status.textContent = L.copyError;
        }
        window.setTimeout(() => { btn.textContent = L.copy; if (status) status.textContent = ""; }, 1800);
      });
    }
  }

  /* ---------- Install tabs ---------- */
  function wireTabs() {
    const tabs = [...document.querySelectorAll("[data-install-tab]")];
    for (const [index, tab] of tabs.entries()) {
      tab.addEventListener("click", () => selectTab(tab.dataset.installTab));
      tab.addEventListener("keydown", (e) => {
        if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return;
        e.preventDefault();
        const off = e.key === "ArrowRight" ? 1 : -1;
        const next = tabs[(index + off + tabs.length) % tabs.length];
        selectTab(next.dataset.installTab); next.focus();
      });
    }
    function selectTab(name) {
      for (const t of tabs) {
        const sel = t.dataset.installTab === name;
        t.setAttribute("aria-selected", String(sel));
        t.tabIndex = sel ? 0 : -1;
      }
      for (const p of document.querySelectorAll("[data-install-panel]")) {
        p.hidden = p.dataset.installPanel !== name;
      }
    }
  }

  /* ---------- Mobile menu ---------- */
  function wireMenu() {
    for (const btn of document.querySelectorAll("[data-menu-button]")) {
      const nav = document.getElementById(btn.getAttribute("aria-controls"));
      btn.addEventListener("click", () => {
        const open = btn.getAttribute("aria-expanded") !== "true";
        btn.setAttribute("aria-expanded", String(open));
        nav.dataset.open = String(open);
        btn.textContent = open ? l10n[currentLang].close : l10n[currentLang].menu;
      });
    }
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      for (const btn of document.querySelectorAll('[data-menu-button][aria-expanded="true"]')) {
        const nav = document.getElementById(btn.getAttribute("aria-controls"));
        btn.setAttribute("aria-expanded", "false"); nav.dataset.open = "false";
        btn.textContent = l10n[currentLang].menu; btn.focus();
      }
    });
  }

  /* ---------- Init ---------- */
  function init() {
    for (const kb of document.querySelectorAll("[data-keyboard]")) buildKeyboard(kb);
    wireCopy();
    wireTabs();
    wireMenu();

    // demo state toggles
    for (const c of document.querySelectorAll("[data-state-control]")) {
      c.addEventListener("click", () => setDemoState(c.dataset.stateControl));
    }

    // language
    let lang = "en";
    try { lang = localStorage.getItem("nocturne-lang") === "zh" ? "zh" : "en"; } catch {}
    applyLang(lang);
    document.querySelector("[data-language-toggle]")?.addEventListener("click", () => applyLang(currentLang === "zh" ? "en" : "zh"));

    // room mode (default dark / nocturne)
    let theme = "dark";
    try { theme = localStorage.getItem("nocturne-room") === "light" ? "light" : "dark"; } catch {}
    applyTheme(theme);
    document.querySelector("[data-room-toggle]")?.addEventListener("click", () => applyTheme(document.documentElement.dataset.room === "light" ? "dark" : "light"));

    // initial active state label
    setDemoState("thinking");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
