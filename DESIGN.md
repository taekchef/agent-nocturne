# Agent Nocturne Design System

## Product thesis

Agent Nocturne turns the MacBook keyboard backlight into a local status signal for coding agents. The website must explain that idea on one page and prove it with a physically credible keyboard demonstration.

## Information architecture

There is one public product page.

1. Hero: product statement and live keyboard demonstration.
2. Install: local core plus Pi, Claude Code, and Codex adapter tabs.
3. Facts and footer: local runtime, socket mode, fail-open behavior, hardware limitation, source and license.

English and Chinese switch in place. Lighting states stay inside the hero. Installation stays below the hero. Do not create separate Language, Install, or locale page trees.

## Environment modes

### Default

The page is a light editorial surface. Only the keyboard stage is dark because white backlight needs a dark optical environment.

### Dark room

A user-controlled Room lights button may dim the full page to neutral near-black. The keyboard becomes the center light source. This mode must remain neutral, photographic, and quiet. It is not a blue nocturnal theme and must not add RGB color, glow decoration, or technology motifs.

## Keyboard model

The hardware exposes one global keyboard brightness value.

- Keycaps are near-black and never move, scale, fade, or change size.
- All legends read one shared `--backlight` value.
- Legends emit neutral white light.
- A short legend halo, weak key-gap spill, and weaker deck reflection may follow the same global value.
- No key may animate independently.
- No wave, chase, RGB, per-key color, or keypress simulation.
- The stage must remain clearly darker than the surrounding page in default mode.

## Cadence

- Thinking: 4.8 second asymmetric breath, 0.03 to 0.80.
- Tool: 1.8 second low pulse, 0.10 to 0.32.
- Permission: 540 ms global attention blink.
- Waiting: two global taps every 2.5 seconds.
- Done: one 1.2 second completion exhale.
- Error: four finite short global flashes.
- Reduced motion: static medium-low backlight.

Only `--backlight` changes in the keyboard animation. Key geometry and typography remain fixed.

## Color

### Light page

- Canvas: `#f2f0ea`
- Paper: `#faf9f5`
- Ink: `#171714`
- Muted: `#63615a`
- Hairline: `#d8d5cb`
- Signal: `#3d5a48`

### Dark room

- Canvas: `#080909`
- Paper: `#0f100f`
- Ink: `#f0eee7`
- Muted: `#9b9a93`
- Hairline: `#262826`

### Keyboard

- Stage: `#0a0b0b`
- Deck: `#070708`
- Keycap: `#121214`
- Key edge: `#2e2f32`
- Legend and light: neutral white

Do not use blue-black, purple, gradients, glass surfaces, colored glows, or decorative shadows.

## Typography

- UI and display: `Helvetica Neue`, Helvetica, Arial, system fallback.
- Chinese: system PingFang stack.
- Commands, cadence, eyebrows, nav, and spec labels: `SFMono-Regular`, Menlo, Consolas, uppercase with wide tracking. Chinese labels keep hanzi in the system stack and only the Latin prefixes render mono.
- Headlines use medium weight (500), tight tracking, and short line lengths.
- Chinese headlines are sized down relative to Latin (max 3.6rem) and constrained to whole-phrase line breaks.
- Body copy stays below 65 characters per line.
- Do not load external fonts.

## Layout

- Maximum shell: 1280px.
- Desktop hero: concise copy left, keyboard stage right. Chinese pages widen the copy column slightly so the headline breaks on whole phrases.
- Mobile hero order: label, headline, complete keyboard stage, explanation, actions, spec line.
- The full keyboard must remain inside the first 812px viewport at 320px and 375px widths.
- Install is one compact split section, not another page.
- Code blocks are near-black terminal panels with light text, matching the keyboard deck. They stay dark in both room modes.
- Lighting states are presented as a numbered index (CSS counters) under the keyboard, doubling as the state language documentation.
- The keyboard renders a half-height function row, matching MacBook hardware.
- Avoid generic card grids and repeated marketing sections.

## Interaction

- Room lights and language are reversible buttons with visible focus.
- Room choice and language persist locally.
- State controls use `aria-pressed`.
- Adapter tabs support Left and Right Arrow keys.
- Copy buttons announce success through `aria-live`.
- No analytics, cookies, forms, remote runtime assets, or network requests.
- Without JavaScript, navigation, English copy, installation commands, and a static lit keyboard remain visible.

## Accessibility and motion

- Keep a skip link and semantic heading order.
- Minimum interactive height is 40px where space allows.
- Never encode state with color alone. State names and cadence remain visible.
- Honor `prefers-reduced-motion` by stopping cadence and showing a static backlight.
- Keyboard geometry must remain identical at animation trough and peak.
