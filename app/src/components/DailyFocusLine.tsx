import { Show, createEffect, createMemo, createSignal, onCleanup } from "solid-js";
import type { CopyLibraryItem } from "../lib/copy-library";

export type DailyFocusTheme =
  | "night-valley"
  | "editorial-paper"
  | "graphite-console"
  | "aurora-ocean"
  | "botanical-library";

interface DailyFocusMeta {
  eyebrow: string;
  context: string;
}

const themeMeta: Record<DailyFocusTheme, DailyFocusMeta> = {
  "night-valley": { eyebrow: "A QUIET LINE", context: "夜行手记" },
  "editorial-paper": { eyebrow: "MARGIN NOTE", context: "页边手记" },
  "graphite-console": { eyebrow: "DAILY TRANSMISSION", context: "今日讯息" },
  "aurora-ocean": { eyebrow: "TIDE NOTE", context: "潮汐寄语" },
  "botanical-library": { eyebrow: "DAILY BOOKMARK", context: "今日书签" },
};

export interface DailyFocusLineProps {
  date: string;
  theme: DailyFocusTheme;
}

export default function DailyFocusLine(props: DailyFocusLineProps) {
  const [copy, setCopy] = createSignal<CopyLibraryItem>();
  createEffect(() => {
    const date = props.date;
    let stale = false;
    let firstFrame = 0;
    let secondFrame = 0;
    firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        void import("../lib/copy-library").then((library) => {
          if (!stale) setCopy(library.getDailyCopy(date));
        });
      });
    });
    onCleanup(() => {
      stale = true;
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
    });
  });
  const displayText = createMemo(() => {
    const item = copy();
    return item ? getCopyDisplayText(item) : "正在准备今日一句…";
  });
  const originalText = createMemo(() => {
    const item = copy();
    return item ? getCopyOriginalText(item) : "";
  });
  const meta = () => themeMeta[props.theme];

  return (
    <aside
      class={"daily-focus-line daily-focus-line--" + props.theme}
      data-copy-id={copy()?.id ?? "loading"}
      aria-busy={!copy()}
      aria-label={"今日一句 · " + meta().context}
    >
      <div class="daily-focus-line__head">
        <span class="daily-focus-line__eyebrow">{meta().eyebrow}</span>
        <span class="daily-focus-line__context">{meta().context}</span>
      </div>
      <blockquote class="daily-focus-line__quote">“{displayText()}”</blockquote>
      <Show when={originalText().length > 0}>
        <span class="daily-focus-line__original">{originalText()}</span>
      </Show>
      <cite class="daily-focus-line__attribution">— {copy() ? getCopyAttribution(copy()!) : "今日摘录"}</cite>
    </aside>
  );
}

function getCopyDisplayText(copy: CopyLibraryItem) {
  return copy.language === "en" ? copy.translationZh ?? copy.original : copy.original;
}

function getCopyOriginalText(copy: CopyLibraryItem) {
  return copy.language === "en" ? copy.original : "";
}

function getCopyAttribution(copy: CopyLibraryItem) {
  return copy.author ? `${copy.author} · ${copy.work}` : copy.work;
}
