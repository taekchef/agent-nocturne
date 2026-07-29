# Agent Nocturne site design

## 1. Visual theme and atmosphere

A light editorial product sheet for a small, precise Mac utility. The visual system is quiet and nearly monochrome. Quality comes from proportion, typography, alignment, and the live keyboard-light demonstration, not from gradients, dark surfaces, glass, or decorative effects.

## 2. Color palette and roles

| Token | Value | Role |
|---|---|---|
| Canvas | `oklch(97.4% 0.004 100)` | Page background |
| Paper | `oklch(99% 0.002 100)` | Keyboard and code surfaces |
| Ink | `oklch(20% 0.008 90)` | Primary text and buttons |
| Muted | `oklch(48% 0.008 90)` | Secondary text |
| Hairline | `oklch(86% 0.006 100)` | Structural dividers |
| Signal | `oklch(43% 0.035 155)` | Active state and focus only |

## 3. Typography rules

- Display and body: `Helvetica Neue`, `Helvetica`, `Arial`, system sans.
- Commands: `SFMono-Regular`, `Menlo`, `Consolas`, monospace.
- Display sizes use weight 400 and `-0.035em` to `-0.022em` tracking.
- Body copy uses 16-18px, line-height 1.55-1.7, max width 62ch.
- Sentence case everywhere. No decorative uppercase section numbering.

## 4. Component styling

- Navigation: one 1px bottom hairline, no filled container.
- Buttons: 2px radius, 44px minimum height, black primary and underlined text secondary.
- State selector: plain text buttons in a vertical or horizontal list, active state marked by ink weight and Signal underline.
- Code: square paper surface with a copy action aligned to the command, not a floating card.
- Keyboard: functional interactive demonstration with shallow key geometry and animated legend opacity.

## 5. Layout principles

- Maximum content width 1320px.
- Twelve-column desktop grid, strict single column below 760px.
- Home hero uses an asymmetric 5/7 split.
- Section spacing follows 72 / 104 / 144px responsive steps.
- Content groups use whitespace and hairlines, not generic cards.

## 6. Depth and elevation

The site is flat. Structural depth comes from background steps and 1px dividers. Only the keyboard surface may use a shallow inset shadow because it represents a physical object.

## 7. Do and do not

- Do make the live lighting behavior the visual anchor.
- Do keep visible claims grounded in the repository.
- Do use one Signal color for focus and active state.
- Do not use dark blue, black hero backgrounds, glow, mesh, or gradient text.
- Do not use pill badges, equal feature cards, fake testimonials, or fake metrics.
- Do not use stock imagery or fake screenshots.
- Do not use em dash characters in visible copy.

## 8. Responsive behavior

- At 760px, all asymmetric grids collapse to one column.
- Mobile navigation uses an inline Menu button and a simple expanded link list.
- Interactive targets are at least 40px.
- Keyboard demonstration scrolls nowhere and scales within viewport width.
- At 320px, CTAs retain natural width and never wrap.

## 9. Agent prompt guide

- Home hero: canvas `oklch(97.4% 0.004 100)`, 12-column grid, 5/7 split, 64px headline at weight 400, line-height 0.96, tracking `-0.035em`, one black 2px-radius CTA, interactive keyboard on the right.
- State selector: no card, no pill, 16px labels, active text `oklch(20% 0.008 90)`, inactive text `oklch(48% 0.008 90)`, 2px Signal underline, 40px hit area.
- Code block: Paper background, 1px Hairline divider, 14px mono, copy action at right, 2px radius, no drop shadow.
- Footer: one top hairline, two-column text layout, 14px muted links, no multi-column sitemap.
