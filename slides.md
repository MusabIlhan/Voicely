---
theme: default
title: Voicely
titleTemplate: '%s · Slidev'
info: |
  Voicely 2-minute judge pitch for support teams that already use an internal AI agent and want it to handle customer calls and follow-up meetings.
class: text-left
colorSchema: dark
mdc: true
fonts:
  sans: Space Grotesk
  serif: Bitter
  mono: IBM Plex Mono
drawings:
  persist: false
transition: fade-out
---

<style>
@import url('https://fonts.googleapis.com/css2?family=Bitter:wght@500;700&family=IBM+Plex+Mono:wght@400;500&family=Space+Grotesk:wght@400;500;700&display=swap');

:root {
  --voicely-ink: #ecf3ff;
  --voicely-muted: #9db0cc;
  --voicely-line: rgba(157, 176, 204, 0.18);
  --voicely-panel: rgba(9, 16, 31, 0.74);
  --voicely-cyan: #7be7ff;
  --voicely-blue: #5b8cff;
  --voicely-violet: #8b5cf6;
  --voicely-lime: #b8ff72;
}

.slidev-layout {
  color: var(--voicely-ink);
  background:
    radial-gradient(circle at top left, rgba(91, 140, 255, 0.22), transparent 30%),
    radial-gradient(circle at top right, rgba(123, 231, 255, 0.16), transparent 26%),
    radial-gradient(circle at bottom left, rgba(139, 92, 246, 0.18), transparent 28%),
    linear-gradient(135deg, #050912 0%, #09101f 45%, #03060d 100%);
}

.slidev-layout::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0.22;
  background-image: linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px);
  background-size: 32px 32px;
  mask-image: radial-gradient(circle at center, black 46%, transparent 92%);
}

h1, h2, h3, h4, p, li, div, span {
  font-family: 'Space Grotesk', sans-serif;
}

code, pre {
  font-family: 'IBM Plex Mono', monospace;
}

.eyebrow {
  display: inline-block;
  margin-bottom: 0.8rem;
  padding: 0.35rem 0.7rem;
  border: 1px solid rgba(123, 231, 255, 0.32);
  border-radius: 999px;
  background: rgba(123, 231, 255, 0.08);
  color: var(--voicely-cyan);
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.14em;
}

.hero-title {
  font-size: 3.7rem;
  line-height: 0.92;
  max-width: 11ch;
}

.hero-accent,
.accent {
  color: var(--voicely-cyan);
}

.lede {
  color: var(--voicely-muted);
  font-size: 1.08rem;
  line-height: 1.45;
}

.panel,
.mini,
.metric,
.step {
  border: 1px solid var(--voicely-line);
  background: var(--voicely-panel);
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(10px);
}

.panel {
  border-radius: 24px;
  padding: 1rem 1.1rem;
}

.grid-2,
.metrics,
.steps {
  display: grid;
  gap: 0.9rem;
}

.grid-2 {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.metrics,
.steps {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.metric,
.mini,
.step {
  border-radius: 20px;
  padding: 0.9rem 1rem;
}

.metric strong,
.step strong {
  display: block;
  color: white;
}

.muted,
.caption,
.mini p,
.step p,
.metric span {
  color: var(--voicely-muted);
}

.mini h4,
.panel h3 {
  margin: 0 0 0.35rem 0;
}

.callout {
  border-left: 3px solid var(--voicely-lime);
  padding-left: 0.85rem;
  color: #d9f3a9;
}

.architecture {
  display: grid;
  grid-template-columns: 1.15fr 0.85fr;
  gap: 1rem;
  align-items: start;
}

.stack {
  display: grid;
  gap: 0.75rem;
}

.caption {
  font-size: 0.8rem;
  margin-top: 0.65rem;
}

.diagram-frame {
  padding: 0.6rem;
}

.architecture-diagram {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 16px;
  background: rgba(3, 6, 13, 0.9);
}

ul.tight {
  margin-top: 0.35rem;
}

ul.tight li + li {
  margin-top: 0.3rem;
}
</style>

---
layout: cover
---

<div class="eyebrow">Voicely · 2-minute product pitch</div>

# <span class="hero-title">Voicely gives <span class="hero-accent">support teams with an internal AI agent</span> a voice channel.</span>

<p class="lede max-w-3xl mt-6">
Put the agent your support team already trusts on customer calls, then carry that same context into the follow-up meeting.
</p>

<div class="metrics max-w-4xl mt-8">
  <div class="metric">
    <strong>Faster customer response</strong>
    <span>Answer with the agent you already have</span>
  </div>
  <div class="metric">
    <strong>Continuity</strong>
    <span>From call to follow-up meeting</span>
  </div>
  <div class="metric">
    <strong>No rebuild</strong>
    <span>Keep your current agent stack</span>
  </div>
</div>

---

<div class="eyebrow">Problem</div>

# Great internal support agents still disappear when the customer picks up the phone.

<div class="grid-2 mt-6">
  <div class="panel">
    <h3>Primary user</h3>
    <ul class="tight">
      <li>Support teams that already use an internal AI agent</li>
      <li>That agent already knows policies, tools, and account workflows</li>
      <li>But today it mostly helps inside chat</li>
    </ul>
  </div>
  <div class="panel">
    <h3>What breaks in voice</h3>
    <ul class="tight">
      <li>Customers still call when the issue is urgent or messy</li>
      <li>Support reps have to restate context from call to follow-up meeting</li>
      <li>Most voice tools make the team rebuild a second agent</li>
    </ul>
  </div>
</div>

<p class="callout mt-6">Support teams already have a useful internal agent. They need it to respond faster, keep context, and work in voice without starting over.</p>

---

<div class="eyebrow">Product</div>

# Your support team keeps its current agent and adds voice.

<div class="grid-2 mt-6">
  <div class="panel">
    <h3>What the team already has</h3>
    <p><span class="accent">Claude Code · OpenCode · Dust · any MCP-compatible runtime</span></p>
    <p class="muted">Keep the prompts, tools, memory, and knowledge base the support team already trusts.</p>
  </div>
  <div class="panel">
    <h3>Voicely</h3>
    <p><span class="accent">Adds calls and meetings to that same agent</span></p>
    <p class="muted">Voicely lets the same agent answer the customer, create the handoff, and show up ready for the follow-up meeting.</p>
  </div>
</div>

<div class="panel mt-6">
  <h3>One clear mechanism</h3>
  <p class="lede"><span class="accent">Voicely</span> is the voice layer for the support team's existing MCP-connected agent — so they get calls and meetings without rebuilding the stack.</p>
</div>

---

<div class="eyebrow">How it works</div>

# Architecture that supports the product.

<div class="architecture mt-5">
  <div class="panel diagram-frame">
    <img
      class="architecture-diagram"
      src="/slides/voice-mcp-architecture.svg"
      alt="Architecture diagram showing the existing MCP agent connecting through Voicely to phone calls and meetings"
    />
  </div>

  <div class="stack">
    <div class="mini">
      <h4>No second bot</h4>
      <p>The support team keeps one agent, not a duplicate voice workflow.</p>
    </div>
    <div class="mini">
      <h4>Continuity built in</h4>
      <p>The call and follow-up meeting share the same context.</p>
    </div>
    <div class="mini">
      <h4>Why it matters</h4>
      <p>Faster response for the customer, less handoff work for the team.</p>
    </div>
  </div>
</div>

<p class="caption">Architecture in one sentence: keep the existing agent, add Voicely in the middle, and use phone + meeting as two channels for one continuous support flow.</p>

---

<div class="eyebrow">Closing</div>

# Faster response. Continuity. No rebuild.

<p class="lede max-w-3xl mt-6">
Voicely helps support teams turn the internal AI agent they already use into a customer-ready voice workflow — from the first call to the follow-up meeting.
</p>

<div class="panel mt-8 max-w-3xl">
  <p><strong>Payoff:</strong> answer customers faster, keep context across the whole interaction, and avoid rebuilding the support team's current agent stack.</p>
  <p class="muted mt-3"><strong>Ask:</strong> back Voicely as the fastest way to give an existing internal AI agent a voice.</p>
</div>
