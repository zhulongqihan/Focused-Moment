use serde::{Deserialize, Serialize};

pub(crate) const DEFAULT_POMODORO_FOCUS_MINUTES: u64 = 25;
pub(crate) const DEFAULT_POMODORO_BREAK_MINUTES: u64 = 5;
pub(crate) const MIN_POMODORO_FOCUS_MINUTES: u64 = 5;
pub(crate) const MAX_POMODORO_FOCUS_MINUTES: u64 = 90;
pub(crate) const MIN_POMODORO_BREAK_MINUTES: u64 = 1;
pub(crate) const MAX_POMODORO_BREAK_MINUTES: u64 = 30;
pub(crate) const MIN_STOPWATCH_REMINDER_MINUTES: u64 = 1;
pub(crate) const MAX_STOPWATCH_REMINDER_MINUTES: u64 = 12 * 60;
pub(crate) const DEFAULT_STOPWATCH_REMINDER_MINUTES: u64 = 25;
pub(crate) const STOPWATCH_STAGE_MINUTES: [u64; 5] = [25, 45, 60, 90, 120];
pub(crate) const DEFAULT_COUNTDOWN_MINUTES: u64 = 25;
pub(crate) const MIN_COUNTDOWN_MINUTES: u64 = 1;
pub(crate) const MAX_COUNTDOWN_MINUTES: u64 = 12 * 60;
pub(crate) const MAX_TODO_TITLE_CHARS: usize = 200;

#[derive(Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TimerPreferences {
    pub(crate) pomodoro_focus_minutes: u64,
    pub(crate) pomodoro_break_minutes: u64,
    pub(crate) stopwatch_reminder_minutes: Option<u64>,
    pub(crate) toast_reminder_enabled: bool,
    pub(crate) window_attention_reminder_enabled: bool,
    #[serde(default = "default_sound_reminder_enabled")]
    pub(crate) sound_reminder_enabled: bool,
    #[serde(default)]
    pub(crate) alert_sound_key: AlertSoundKey,
}

#[derive(Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum AlertSoundKey {
    SoftChime,
    BrightBell,
    DeepPulse,
    WoodenTick,
    GlassPing,
    MorningChord,
    ViralQuote,
    Custom,
}

impl Default for AlertSoundKey {
    fn default() -> Self {
        Self::SoftChime
    }
}

fn default_sound_reminder_enabled() -> bool {
    true
}

impl Default for TimerPreferences {
    fn default() -> Self {
        Self {
            pomodoro_focus_minutes: DEFAULT_POMODORO_FOCUS_MINUTES,
            pomodoro_break_minutes: DEFAULT_POMODORO_BREAK_MINUTES,
            stopwatch_reminder_minutes: Some(DEFAULT_STOPWATCH_REMINDER_MINUTES),
            toast_reminder_enabled: true,
            window_attention_reminder_enabled: true,
            sound_reminder_enabled: true,
            alert_sound_key: AlertSoundKey::SoftChime,
        }
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TimerPreferencesSnapshot {
    pub(crate) pomodoro_focus_minutes: u64,
    pub(crate) pomodoro_break_minutes: u64,
    pub(crate) stopwatch_reminder_minutes: Option<u64>,
    pub(crate) toast_reminder_enabled: bool,
    pub(crate) window_attention_reminder_enabled: bool,
    pub(crate) sound_reminder_enabled: bool,
    pub(crate) alert_sound_key: &'static str,
}

impl AlertSoundKey {
    pub(crate) fn key(self) -> &'static str {
        match self {
            Self::SoftChime => "soft_chime",
            Self::BrightBell => "bright_bell",
            Self::DeepPulse => "deep_pulse",
            Self::WoodenTick => "wooden_tick",
            Self::GlassPing => "glass_ping",
            Self::MorningChord => "morning_chord",
            Self::ViralQuote => "viral_quote",
            Self::Custom => "custom",
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum AlertKind {
    PomodoroFocusComplete,
    PomodoroBreakComplete,
    StopwatchTargetReached,
    CountdownComplete,
}

impl AlertKind {
    pub(crate) fn key(self) -> &'static str {
        match self {
            AlertKind::PomodoroFocusComplete => "pomodoro_focus_complete",
            AlertKind::PomodoroBreakComplete => "pomodoro_break_complete",
            AlertKind::StopwatchTargetReached => "stopwatch_target_reached",
            AlertKind::CountdownComplete => "countdown_complete",
        }
    }

    pub(crate) fn title(self) -> &'static str {
        match self {
            AlertKind::PomodoroFocusComplete => "本轮番茄已完成",
            AlertKind::PomodoroBreakComplete => "休息时间结束了",
            AlertKind::StopwatchTargetReached => "已达到阶段性目标",
            AlertKind::CountdownComplete => "倒计时已结束",
        }
    }

    pub(crate) fn message(self, preferences: TimerPreferences) -> String {
        match self {
            AlertKind::PomodoroFocusComplete => format!(
                "已经完成一轮 {} 分钟专注，可以休息一下，或者直接补记这轮专注。",
                preferences.pomodoro_focus_minutes
            ),
            AlertKind::PomodoroBreakComplete => format!(
                "{} 分钟休息已经结束，可以回来继续下一轮专注了。",
                preferences.pomodoro_break_minutes
            ),
            AlertKind::StopwatchTargetReached => {
                if let Some(minutes) = preferences.stopwatch_reminder_minutes {
                    format!("已经达到你设置的 {} 分钟提醒目标。", minutes)
                } else {
                    "已经达到这轮正向计时的提醒目标。".to_string()
                }
            }
            AlertKind::CountdownComplete => "计时已到 00:00，可以立即完成并记录。".to_string(),
        }
    }
}

impl TimerPreferences {
    pub(crate) fn snapshot(self) -> TimerPreferencesSnapshot {
        TimerPreferencesSnapshot {
            pomodoro_focus_minutes: self.pomodoro_focus_minutes,
            pomodoro_break_minutes: self.pomodoro_break_minutes,
            stopwatch_reminder_minutes: self.stopwatch_reminder_minutes,
            toast_reminder_enabled: self.toast_reminder_enabled,
            window_attention_reminder_enabled: self.window_attention_reminder_enabled,
            sound_reminder_enabled: self.sound_reminder_enabled,
            alert_sound_key: self.alert_sound_key.key(),
        }
    }

    pub(crate) fn normalized(self) -> Result<Self, String> {
        let focus_minutes = self
            .pomodoro_focus_minutes
            .clamp(MIN_POMODORO_FOCUS_MINUTES, MAX_POMODORO_FOCUS_MINUTES);
        let break_minutes = self
            .pomodoro_break_minutes
            .clamp(MIN_POMODORO_BREAK_MINUTES, MAX_POMODORO_BREAK_MINUTES);
        let stopwatch_reminder_minutes = match self.stopwatch_reminder_minutes {
            Some(minutes) if minutes == 0 => None,
            Some(minutes) => Some(minutes.clamp(
                MIN_STOPWATCH_REMINDER_MINUTES,
                MAX_STOPWATCH_REMINDER_MINUTES,
            )),
            None => None,
        };

        if self.pomodoro_focus_minutes < MIN_POMODORO_FOCUS_MINUTES
            || self.pomodoro_focus_minutes > MAX_POMODORO_FOCUS_MINUTES
        {
            return Err("番茄专注时长需要在 5 到 90 分钟之间。".to_string());
        }

        if self.pomodoro_break_minutes < MIN_POMODORO_BREAK_MINUTES
            || self.pomodoro_break_minutes > MAX_POMODORO_BREAK_MINUTES
        {
            return Err("番茄休息时长需要在 1 到 30 分钟之间。".to_string());
        }

        if let Some(minutes) = self.stopwatch_reminder_minutes {
            if !(MIN_STOPWATCH_REMINDER_MINUTES..=MAX_STOPWATCH_REMINDER_MINUTES).contains(&minutes)
            {
                return Err("正向计时提醒需要在 1 到 720 分钟之间，或留空关闭。".to_string());
            }
        }

        Ok(Self {
            pomodoro_focus_minutes: focus_minutes,
            pomodoro_break_minutes: break_minutes,
            stopwatch_reminder_minutes,
            toast_reminder_enabled: self.toast_reminder_enabled,
            window_attention_reminder_enabled: self.window_attention_reminder_enabled,
            sound_reminder_enabled: self.sound_reminder_enabled,
            alert_sound_key: self.alert_sound_key,
        })
    }

    pub(crate) fn pomodoro_focus_ms(self) -> u64 {
        self.pomodoro_focus_minutes.saturating_mul(60_000)
    }

    pub(crate) fn pomodoro_break_ms(self) -> u64 {
        self.pomodoro_break_minutes.saturating_mul(60_000)
    }

    pub(crate) fn stopwatch_reminder_ms(self) -> Option<u64> {
        self.stopwatch_reminder_minutes
            .map(|minutes| minutes.saturating_mul(60_000))
    }
}

pub(crate) fn stopwatch_stage_index_for_elapsed(elapsed_ms: u64) -> usize {
    STOPWATCH_STAGE_MINUTES
        .iter()
        .take_while(|minutes| elapsed_ms >= minutes.saturating_mul(60_000))
        .count()
}

pub(crate) fn stopwatch_next_target_ms(stage_index: usize) -> Option<u64> {
    STOPWATCH_STAGE_MINUTES
        .get(stage_index)
        .map(|minutes| minutes.saturating_mul(60_000))
}
