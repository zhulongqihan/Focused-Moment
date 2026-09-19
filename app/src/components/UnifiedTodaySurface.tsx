import type { TodaySurfaceProps } from "../lib/theme-contracts";
import type { DailyFocusTheme } from "./DailyFocusLine";
import DailyFocusLine from "./DailyFocusLine";
import ContinuityBoard from "./ContinuityBoard";
import { NightValleyClock } from "./NightValleyDateStamp";

interface UnifiedTodaySurfaceProps extends TodaySurfaceProps {
  theme: DailyFocusTheme;
}

export default function UnifiedTodaySurface(props: UnifiedTodaySurfaceProps) {
  return (
    <section class={`today-page unified-today-page unified-today-page--${props.theme}`} aria-label="今日">
      <header class="unified-today-page__header">
        <div class="unified-today-page__date">
          <strong>{props.todayDate}</strong>
          <NightValleyClock className="unified-today-page__clock" />
          <span>{props.todayLabel}</span>
        </div>
        <h1 aria-label="今天，从一件事开始">今天，从一件事开始</h1>
        <p>把想到的事放进收件箱，把下一步留在眼前。</p>
        <DailyFocusLine date={props.todayDate} theme={props.theme} />
      </header>
      <ContinuityBoard {...props} />
    </section>
  );
}
