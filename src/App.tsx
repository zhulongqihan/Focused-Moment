import { invoke } from "@tauri-apps/api/core";
import { For, createMemo, createSignal, onMount } from "solid-js";
import type { ShellSnapshot } from "./lib/contracts";
import {
  closeMainWindow,
  minimizeMainWindow,
  toggleMaximizeMainWindow,
} from "./lib/window-controls";
import "./App.css";

const emptySnapshot: ShellSnapshot = {
  productName: "Focused Moment",
  version: "0.1.0",
  milestone: "v0.1 Foundation",
  slogan: "Precision time, calm focus, quiet review.",
  surfaces: [],
  reservedExtensions: [],
};

function App() {
  const [snapshot, setSnapshot] = createSignal<ShellSnapshot>(emptySnapshot);
  const [statusText, setStatusText] = createSignal("Bootstrapping shell...");
  const [bootError, setBootError] = createSignal<string | null>(null);
  const reservedCount = createMemo(() => snapshot().reservedExtensions.length);

  onMount(async () => {
    try {
      const nextSnapshot = await invoke<ShellSnapshot>("bootstrap_shell");
      setSnapshot(nextSnapshot);
      setStatusText("Foundation ready for timer, task, and analytics modules.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load shell data.";
      setBootError(message);
      setStatusText("Shell loaded with fallback data.");
    }
  });

  return (
    <div class="shell">
      <header class="window-chrome" data-tauri-drag-region>
        <div class="brand-lockup" data-tauri-drag-region>
          <div class="brand-mark">
            <span class="brand-mark__dot" />
          </div>
          <div class="brand-copy">
            <span class="brand-copy__eyebrow">Focused desktop flow</span>
            <strong>{snapshot().productName}</strong>
          </div>
        </div>

        <div class="window-actions">
          <button
            type="button"
            class="window-button"
            onClick={() => void minimizeMainWindow()}
          >
            Min
          </button>
          <button
            type="button"
            class="window-button"
            onClick={() => void toggleMaximizeMainWindow()}
          >
            Max
          </button>
          <button
            type="button"
            class="window-button window-button--danger"
            onClick={() => void closeMainWindow()}
          >
            Close
          </button>
        </div>
      </header>

      <main class="workspace">
        <section class="hero-panel panel">
          <div class="hero-copy">
            <span class="eyebrow">v0.1 foundation</span>
            <h1>{snapshot().productName}</h1>
            <p class="hero-text">{snapshot().slogan}</p>
            <p class="hero-subtext">
              A calm desktop shell for precision timing, task capture, and quiet
              daily review.
            </p>
          </div>

          <div class="status-row">
            <span class="status-pill">{snapshot().milestone}</span>
            <span class="status-copy">{statusText()}</span>
          </div>

          <div class="metric-grid">
            <article class="metric-card">
              <span class="metric-label">Core surfaces</span>
              <strong>{snapshot().surfaces.length}</strong>
              <span class="metric-footnote">Timer, tasks, analytics</span>
            </article>
            <article class="metric-card">
              <span class="metric-label">Reserved modules</span>
              <strong>{reservedCount()}</strong>
              <span class="metric-footnote">Reward, progression, themes</span>
            </article>
            <article class="metric-card">
              <span class="metric-label">Runtime target</span>
              <strong>Windows</strong>
              <span class="metric-footnote">Low-noise desktop focus</span>
            </article>
          </div>
        </section>

        <section class="panel section-panel">
          <div class="section-heading">
            <div>
              <span class="eyebrow">Core surfaces</span>
              <h2>Product areas scheduled in upcoming versions</h2>
            </div>
            <p>
              The shell is live. Functional timer, task, and analytics behaviors
              will be connected in later milestones.
            </p>
          </div>

          <div class="card-grid">
            <For each={snapshot().surfaces}>
              {(surface) => (
                <article class="detail-card">
                  <div class="detail-card__meta">
                    <span>{surface.phase}</span>
                    <span>{surface.status}</span>
                  </div>
                  <h3>{surface.title}</h3>
                  <p>{surface.summary}</p>
                </article>
              )}
            </For>
          </div>
        </section>

        <section class="panel split-panel">
          <div class="split-panel__intro">
            <span class="eyebrow">Future-safe architecture</span>
            <h2>Reserved extension lanes</h2>
            <p>
              These modules stay out of the MVP for now, but the foundation is
              deliberately shaped so they can plug in without reworking the shell.
            </p>
            {bootError() && <p class="error-copy">Bootstrap fallback: {bootError()}</p>}
          </div>

          <div class="stack-list">
            <For each={snapshot().reservedExtensions}>
              {(module) => (
                <article class="stack-card">
                  <span class="stack-card__phase">{module.phase}</span>
                  <div>
                    <h3>{module.title}</h3>
                    <p>{module.summary}</p>
                  </div>
                </article>
              )}
            </For>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
