# Contributing

Issues and pull requests are welcome, especially compatibility reports for different MacBook and macOS versions.

Before submitting a change:

```bash
npm run check
npm test
npm run build:native
```

Use `AGENT_LIGHT_BACKEND=mock` for automated adapter tests. Hardware behavior still needs manual verification on a MacBook with a built-in backlit keyboard.

Please keep adapters fail-open, avoid elevated privileges, and reserve sharp effects for states that require user attention.
