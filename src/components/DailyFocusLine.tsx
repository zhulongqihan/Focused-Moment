import { Show, createMemo } from "solid-js";
import {
  getCopyAttribution,
  getCopyDisplayText,
  getCopyOriginalText,
  getDailyCopy,
} from "../lib/copy-library";

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
  const copy = createMemo(() => getDailyCopy(props.date));
  const displayText = createMemo(() => getCopyDisplayText(copy()));
  const originalText = createMemo(() => getCopyOriginalText(copy()));
  const meta = () => themeMeta[props.theme];

  return (
    <aside
      class={"daily-focus-line daily-focus-line--" + props.theme}
      data-copy-id={copy().id}
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
      <cite class="daily-focus-line__attribution">— {getCopyAttribution(copy())}</cite>
    </aside>
  );
}
