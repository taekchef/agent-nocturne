import { ONE_SHOT_DURATIONS, PRIORITY } from "./effects.mjs";

const LATCHED_STATES = new Set([
  "thinking",
  "tool",
  "permission",
  "waiting-input",
  "blocked",
  "compact",
  "background",
]);

const ONE_SHOT_EVENTS = new Set([
  "startup",
  "tool-start",
  "tool-error",
  "notification",
  "done",
  "error",
  "cancelled",
]);

export class AgentLightStateMachine {
  constructor(options = {}) {
    this.sessions = new Map();
    this.oneShots = [];
    this.debounceMs = options.debounceMs ?? 600;
    this.lastPulseByKey = new Map();
  }

  apply(event, now = Date.now()) {
    this.expire(now);

    if (event.event === "restore" || event.event === "shutdown") {
      this.sessions.clear();
      this.oneShots = [];
      return;
    }

    if (event.event === "status") return;

    const key = sessionKey(event);
    const session = this.sessions.get(key) ?? createSession(event, now);
    session.agent = event.agent;
    session.sessionId = event.sessionId;
    session.cwd = event.cwd;
    session.updatedAt = now;
    session.expiresAt = now + Math.max(1_000, event.ttlMs ?? 120_000);

    switch (event.event) {
      case "idle":
        this.sessions.delete(key);
        return;
      case "thinking":
        session.activeTurn = true;
        session.latch = "thinking";
        session.latchStartedAt = now;
        session.expiresAt = now + Math.max(1_000, event.ttlMs ?? 120_000);
        this.sessions.set(key, session);
        return;
      case "tool-start": {
        const startsBatch = session.toolCount === 0;
        session.activeTurn = true;
        session.toolCount += 1;
        session.latch = "tool";
        session.latchStartedAt = startsBatch ? now : session.latchStartedAt;
        this.sessions.set(key, session);
        if (startsBatch) this.enqueueOneShot(event, now);
        return;
      }
      case "tool-end":
        session.toolCount = Math.max(0, session.toolCount - 1);
        if (session.toolCount > 0) {
          session.latch = "tool";
          this.sessions.set(key, session);
        } else if (session.activeTurn) {
          session.latch = "thinking";
          session.latchStartedAt = now;
          this.sessions.set(key, session);
        } else {
          this.sessions.delete(key);
        }
        return;
      case "tool-error":
        this.enqueueOneShot(event, now);
        this.sessions.set(key, session);
        return;
      case "done":
      case "cancelled":
        this.enqueueOneShot(event, now);
        this.sessions.delete(key);
        return;
      case "error":
        this.enqueueOneShot(event, now);
        if (event.terminal) {
          this.sessions.delete(key);
        } else {
          this.sessions.set(key, session);
        }
        return;
      case "notification":
      case "startup":
        this.enqueueOneShot(event, now);
        this.sessions.set(key, session);
        return;
      case "permission":
      case "waiting-input":
      case "blocked":
      case "compact":
      case "background":
        session.latch = event.event;
        session.latchStartedAt = now;
        session.activeTurn = event.event !== "background";
        this.sessions.set(key, session);
        return;
      default:
        if (LATCHED_STATES.has(event.event)) {
          session.latch = event.event;
          session.latchStartedAt = now;
          this.sessions.set(key, session);
        }
    }
  }

  enqueueOneShot(event, now = Date.now()) {
    if (!ONE_SHOT_EVENTS.has(event.event)) return;
    const key = `${event.agent}:${event.sessionId}:${event.event}`;
    const last = this.lastPulseByKey.get(key) ?? 0;
    if (now - last < this.debounceMs && (event.event === "tool-start" || event.event === "tool-error")) return;
    this.lastPulseByKey.set(key, now);

    const duration = ONE_SHOT_DURATIONS[event.event] ?? 500;
    this.oneShots.push({
      state: event.event,
      agent: event.agent,
      sessionId: event.sessionId,
      priority: PRIORITY[event.event] ?? 0,
      startedAt: now,
      expiresAt: now + duration,
      message: event.message,
    });
  }

  expire(now = Date.now()) {
    for (const [key, session] of this.sessions) {
      if (session.expiresAt <= now) this.sessions.delete(key);
    }
    this.oneShots = this.oneShots.filter((item) => item.expiresAt > now);
  }

  visible(now = Date.now()) {
    this.expire(now);
    const candidates = [];

    for (const session of this.sessions.values()) {
      if (!session.latch || session.latch === "idle") continue;
      candidates.push({
        state: session.latch,
        agent: session.agent,
        sessionId: session.sessionId,
        priority: PRIORITY[session.latch] ?? 0,
        startedAt: session.latchStartedAt,
        expiresAt: session.expiresAt,
        toolCount: session.toolCount,
      });
    }

    candidates.push(...this.oneShots);
    if (candidates.length === 0) {
      return { state: "idle", priority: 0, startedAt: now };
    }

    candidates.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return b.startedAt - a.startedAt;
    });
    return candidates[0];
  }

  snapshot(now = Date.now()) {
    this.expire(now);
    return {
      visible: this.visible(now),
      sessions: [...this.sessions.values()].map((session) => ({ ...session })),
      oneShots: this.oneShots.map((item) => ({ ...item })),
    };
  }
}

function createSession(event, now) {
  return {
    agent: event.agent,
    sessionId: event.sessionId,
    cwd: event.cwd,
    latch: "idle",
    latchStartedAt: now,
    activeTurn: false,
    toolCount: 0,
    updatedAt: now,
    expiresAt: now + Math.max(1_000, event.ttlMs ?? 120_000),
  };
}

function sessionKey(event) {
  return `${event.agent}:${event.sessionId}`;
}
