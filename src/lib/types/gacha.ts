/**
 * 明日方舟抽卡养成系统 - TypeScript 类型定义
 */

/**
 * 干员职业枚举
 */
export enum OperatorClass {
  VANGUARD = 'VANGUARD',     // 先锋
  GUARD = 'GUARD',           // 近卫
  DEFENDER = 'DEFENDER',     // 重装
  SNIPER = 'SNIPER',         // 狙击
  CASTER = 'CASTER',         // 术师
  MEDIC = 'MEDIC',           // 医疗
  SUPPORTER = 'SUPPORTER',   // 辅助
  SPECIALIST = 'SPECIALIST'  // 特种
}

/**
 * 干员数据模型
 */
export interface Operator {
  id: string;                    // 唯一标识
  name: string;                  // 干员名称
  rarity: number;                // 稀有度 3-6
  class: OperatorClass;          // 职业
  level: number;                 // 当前等级 1-90
  elite: number;                 // 精英化阶段 0-2
  experience: number;            // 当前经验值
  potential: number;             // 潜能 1-6
  obtainedAt: number;            // 获得时间 (Unix timestamp)
  lastUpgradedAt: number;        // 最后养成时间 (Unix timestamp)
}

/**
 * 货币系统
 */
export interface Currency {
  originite: number;             // 源石（付费货币）
  orundum: number;               // 合成玉（抽卡货币）
  lmd: number;                   // 龙门币（养成货币）
}

/**
 * 资源系统
 */
export interface Resources {
  lmd: number;                   // 龙门币
  exp: number;                   // 经验值道具
  chips: Record<string, number>; // 芯片（精英化材料）
}

/**
 * 抽卡结果
 */
export interface GachaResult {
  operators: Operator[];         // 获得的干员列表
  pityCounter: number;           // 更新后的保底计数器
  costCurrency: Currency;        // 消耗的货币
}

/**
 * 抽卡历史记录
 */
export interface GachaHistory {
  id: string;                    // 唯一标识
  timestamp: number;             // 抽卡时间 (Unix timestamp)
  gachaType: 'single' | 'ten';   // 抽卡类型
  operators: Operator[];         // 获得的干员
  costCurrency: Currency;        // 消耗的货币
  pityCounterBefore: number;     // 抽卡前保底计数器
  pityCounterAfter: number;      // 抽卡后保底计数器
}

/**
 * 会话奖励
 */
export interface SessionRewards {
  sessionId: string;             // 会话ID
  sessionType: 'work' | 'break'; // 会话类型
  completed: boolean;            // 是否完成
  isBoss: boolean;               // 是否为Boss番茄钟
  challengeCompleted: boolean;   // 是否完成挑战
  earnedCurrency: Currency;      // 获得的货币
  earnedResources: Resources;    // 获得的资源
}

/**
 * 干员升级结果
 */
export interface UpgradeResult {
  success: boolean;              // 是否成功
  operator?: Operator;           // 更新后的干员
  costResources?: Resources;     // 消耗的资源
  message: string;               // 结果消息
}

/**
 * 抽卡系统状态
 */
export interface GachaSystemState {
  pityCounter: number;           // 当前保底计数器
  currency: Currency;            // 当前货币
  resources: Resources;          // 当前资源
  operators: Operator[];         // 拥有的干员
  gachaHistory: GachaHistory[];  // 抽卡历史
}
