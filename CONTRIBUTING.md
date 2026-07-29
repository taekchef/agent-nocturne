# Contributing to Agent Nocturne

Issues and pull requests are welcome, especially compatibility reports for different MacBook, macOS, Claude Code, and Codex versions.

Before submitting a change:

```bash
npm run check
npm test
npm run validate:claude
npm run build:native
```

Use `NOCTURNE_BACKEND=mock` for automated adapter tests. Hardware behavior still needs manual verification on a MacBook with a built-in backlit keyboard.

Keep host payload mapping in `src/host-events.mjs` pure and fixture-tested. Adapters must remain fail-open, emit no model-visible output, and never make permission decisions. Avoid elevated privileges and reserve sharp effects for states that require attention.
