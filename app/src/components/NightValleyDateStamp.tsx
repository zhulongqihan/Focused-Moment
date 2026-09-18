import { createSignal, onCleanup, onMount } from "solid-js";

export function formatNightValleyClock(date: Date) {
  return [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map((unit) => String(unit).padStart(2, "0"))
    .join(":");
}

export interface NightValleyClockProps {
  className?: string;
}

export function NightValleyClock(props: NightValleyClockProps) {
  const [currentTime, setCurrentTime] = createSignal(new Date());

  onMount(() => {
    const clockInterval = window.setInterval(() => setCurrentTime(new Date()), 1000);
    onCleanup(() => window.clearInterval(clockInterval));
  });

  return (
    <time
      class={props.className}
      dateTime={currentTime().toISOString()}
      aria-label={`当前时间 ${formatNightValleyClock(currentTime())}`}
    >
      {formatNightValleyClock(currentTime())}
    </time>
  );
}

export interface NightValleyDateStampProps {
  date: string;
  className?: string;
}

export function NightValleyDateStamp(props: NightValleyDateStampProps) {
  return (
    <div class={`nv-page-heading__date${props.className ? ` ${props.className}` : ""}`}>
      <span class="nv-page-heading__date-value">{props.date}</span>
      <NightValleyClock className="nv-page-heading__clock" />
    </div>
  );
}
