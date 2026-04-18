export interface ShellPanel {
  id: string;
  title: string;
  phase: string;
  status: string;
  summary: string;
}

export interface ShellSnapshot {
  productName: string;
  version: string;
  milestone: string;
  slogan: string;
  surfaces: ShellPanel[];
  reservedExtensions: ShellPanel[];
}

export interface TimerSnapshot {
  modeKey: "stopwatch" | "pomodoro";
  phaseKey: "stopwatch" | "focus" | "break";
  mode: string;
  phaseLabel: string;
  status: string;
  isRunning: boolean;
  elapsedMs: number;
  elapsedLabel: string;
  secondaryLabel: string;
  canCompleteSession: boolean;
}

export interface FocusRecord {
  id: number;
  title: string;
  durationMs: number;
  durationLabel: string;
  modeKey: "stopwatch" | "pomodoro";
  modeLabel: string;
  phaseLabel: string;
  linkedTodoId: number | null;
  linkedTodoTitle: string | null;
  completedAt: string;
  completedDate: string;
  completedTime: string;
}

export interface CompletionPayload {
  timerSnapshot: TimerSnapshot;
  records: FocusRecord[];
  rewardSnapshot: RewardSnapshot;
}

export interface DailyInsight {
  date: string;
  totalDurationMs: number;
  totalDurationLabel: string;
  sessionCount: number;
  linkedSessionCount: number;
  independentSessionCount: number;
}

export interface AnalyticsSnapshot {
  totalFocusDurationMs: number;
  totalFocusDurationLabel: string;
  sessionCount: number;
  linkedSessionCount: number;
  independentSessionCount: number;
  pendingTodoCount: number;
  completedTodoCount: number;
  activeDays: number;
  averageDailyDurationLabel: string;
  todayFocusDurationLabel: string;
  todaySessionCount: number;
  dailyBreakdown: DailyInsight[];
}

export interface RewardWallet {
  lmd: number;
  orundum: number;
  originium: number;
}

export interface RewardLedgerEntry {
  id: number;
  sourceRecordId: number;
  sourceTitle: string;
  sourceModeLabel: string;
  durationMs: number;
  durationLabel: string;
  lmd: number;
  orundum: number;
  originium: number;
  completedAt: string;
  completedDate: string;
  completedTime: string;
}

export interface RewardSnapshot {
  wallet: RewardWallet;
  todayFocusDurationMs: number;
  todayFocusDurationLabel: string;
  currentStreakDays: number;
  totalRewardCount: number;
  latestRewards: RewardLedgerEntry[];
}

export interface ContentPackSnapshot {
  currentVersion: string;
  currentServer: string;
  currentUpdatedAt: string;
  operatorCount: number;
  bannerCount: number;
  lastCheckedAt: string | null;
  lastSyncedAt: string | null;
  sourceLabel: string;
  statusLabel: string;
  statusNote: string;
  updateAvailable: boolean;
  remoteVersion: string | null;
  remoteUpdatedAt: string | null;
  remoteOperatorCount: number | null;
  remoteBannerCount: number | null;
  isSyncing: boolean;
  supportsManualImport: boolean;
}

export interface HeadhuntBannerSnapshot {
  id: string;
  name: string;
  summary: string;
  rateUpNames: string[];
  bannerTypeLabel: string;
  startsAt: string;
  endsAt: string;
  rateUpSixNames: string[];
  rateUpFiveNames: string[];
  rateUpFourNames: string[];
  pityGroupLabel: string;
}

export interface HeadhuntPullResult {
  id: number;
  bannerId: string;
  bannerName: string;
  operatorId: string;
  operatorName: string;
  rarity: number;
  profession: string;
  isRateUp: boolean;
  isNew: boolean;
  costOrundum: number;
  pulledAt: string;
}

export interface HeadhuntOwnedOperator {
  operatorId: string;
  operatorName: string;
  rarity: number;
  count: number;
}

export interface HeadhuntSnapshot {
  currentBanner: HeadhuntBannerSnapshot;
  availableBanners: HeadhuntBannerSnapshot[];
  walletOrundum: number;
  totalPulls: number;
  pityWithoutSixStar: number;
  pullsUntilSoftPity: number;
  uniqueOwnedCount: number;
  ownedOperators: HeadhuntOwnedOperator[];
  recentResults: HeadhuntPullResult[];
  history: HeadhuntPullResult[];
}

export interface HeadhuntPayload {
  snapshot: HeadhuntSnapshot;
  batchResults: HeadhuntPullResult[];
  spentOrundum: number;
  isPreview: boolean;
}

export type TodoImportance = "low" | "medium" | "high";

export interface TodoItem {
  id: number;
  title: string;
  isCompleted: boolean;
  scheduledDate: string;
  scheduledTime: string;
  importanceKey: TodoImportance;
}

export interface TodoDraft {
  title: string;
  scheduledDate: string;
  scheduledTime: string;
  importanceKey: TodoImportance;
}
