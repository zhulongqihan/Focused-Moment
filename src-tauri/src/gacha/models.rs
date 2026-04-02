/**
 * 明日方舟抽卡养成系统 - Rust 数据模型
 */

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/**
 * 干员职业枚举
 */
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "UPPERCASE")]
pub enum OperatorClass {
    Vanguard,   // 先锋
    Guard,      // 近卫
    Defender,   // 重装
    Sniper,     // 狙击
    Caster,     // 术师
    Medic,      // 医疗
    Supporter,  // 辅助
    Specialist, // 特种
}

/**
 * 干员数据模型
 */
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Operator {
    pub id: String,                    // 唯一标识
    pub name: String,                  // 干员名称
    pub rarity: u8,                    // 稀有度 3-6
    pub class: OperatorClass,          // 职业
    pub level: u8,                     // 当前等级 1-90
    pub elite: u8,                     // 精英化阶段 0-2
    pub experience: u32,               // 当前经验值
    pub potential: u8,                 // 潜能 1-6
    pub obtained_at: i64,              // 获得时间 (Unix timestamp)
    pub last_upgraded_at: i64,         // 最后养成时间 (Unix timestamp)
}

impl Operator {
    /// 验证干员数据的有效性
    pub fn validate(&self) -> Result<(), String> {
        if !(3..=6).contains(&self.rarity) {
            return Err(format!("Invalid rarity: {}, must be 3-6", self.rarity));
        }
        
        if !(1..=90).contains(&self.level) {
            return Err(format!("Invalid level: {}, must be 1-90", self.level));
        }
        
        if self.elite > 2 {
            return Err(format!("Invalid elite: {}, must be 0-2", self.elite));
        }
        
        if !(1..=6).contains(&self.potential) {
            return Err(format!("Invalid potential: {}, must be 1-6", self.potential));
        }
        
        // 验证等级上限
        let max_level = match self.elite {
            0 => 50,
            1 => 70,
            2 => 90,
            _ => return Err(format!("Invalid elite level: {}", self.elite)),
        };
        
        if self.level > max_level {
            return Err(format!(
                "Level {} exceeds max level {} for elite {}",
                self.level, max_level, self.elite
            ));
        }
        
        Ok(())
    }
    
    /// 获取当前精英化阶段的最大等级
    pub fn max_level(&self) -> u8 {
        match self.elite {
            0 => 50,
            1 => 70,
            2 => 90,
            _ => 50,
        }
    }
}

/**
 * 货币系统
 */
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Currency {
    pub originite: u32,  // 源石（付费货币）
    pub orundum: u32,    // 合成玉（抽卡货币）
    pub lmd: u32,        // 龙门币（养成货币）
}

impl Currency {
    /// 创建新的货币实例
    pub fn new(originite: u32, orundum: u32, lmd: u32) -> Self {
        Self {
            originite,
            orundum,
            lmd,
        }
    }
    
    /// 检查是否有足够的货币
    pub fn has_enough(&self, cost: &Currency) -> bool {
        self.originite >= cost.originite
            && self.orundum >= cost.orundum
            && self.lmd >= cost.lmd
    }
    
    /// 扣除货币
    pub fn subtract(&mut self, cost: &Currency) -> Result<(), String> {
        if !self.has_enough(cost) {
            return Err("Insufficient currency".to_string());
        }
        
        self.originite -= cost.originite;
        self.orundum -= cost.orundum;
        self.lmd -= cost.lmd;
        
        Ok(())
    }
    
    /// 增加货币
    pub fn add(&mut self, amount: &Currency) {
        self.originite += amount.originite;
        self.orundum += amount.orundum;
        self.lmd += amount.lmd;
    }
}

/**
 * 资源系统
 */
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Resources {
    pub lmd: u32,                        // 龙门币
    pub exp: u32,                        // 经验值道具
    pub chips: HashMap<String, u32>,    // 芯片（精英化材料）
}

impl Resources {
    /// 创建新的资源实例
    pub fn new(lmd: u32, exp: u32) -> Self {
        Self {
            lmd,
            exp,
            chips: HashMap::new(),
        }
    }
    
    /// 检查是否有足够的资源
    pub fn has_enough(&self, cost: &Resources) -> bool {
        if self.lmd < cost.lmd || self.exp < cost.exp {
            return false;
        }
        
        for (chip_type, &required) in &cost.chips {
            if self.chips.get(chip_type).unwrap_or(&0) < &required {
                return false;
            }
        }
        
        true
    }
    
    /// 扣除资源
    pub fn subtract(&mut self, cost: &Resources) -> Result<(), String> {
        if !self.has_enough(cost) {
            return Err("Insufficient resources".to_string());
        }
        
        self.lmd -= cost.lmd;
        self.exp -= cost.exp;
        
        for (chip_type, &required) in &cost.chips {
            let current = self.chips.get_mut(chip_type).unwrap();
            *current -= required;
        }
        
        Ok(())
    }
    
    /// 增加资源
    pub fn add(&mut self, amount: &Resources) {
        self.lmd += amount.lmd;
        self.exp += amount.exp;
        
        for (chip_type, &amount) in &amount.chips {
            *self.chips.entry(chip_type.clone()).or_insert(0) += amount;
        }
    }
}

/**
 * 抽卡结果
 */
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GachaResult {
    pub operators: Vec<Operator>,       // 获得的干员列表
    pub pity_counter: u32,              // 更新后的保底计数器
    pub cost_currency: Currency,        // 消耗的货币
}

/**
 * 抽卡历史记录
 */
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GachaHistory {
    pub id: String,                     // 唯一标识
    pub timestamp: i64,                 // 抽卡时间 (Unix timestamp)
    pub gacha_type: GachaType,          // 抽卡类型
    pub operators: Vec<Operator>,       // 获得的干员
    pub cost_currency: Currency,        // 消耗的货币
    pub pity_counter_before: u32,       // 抽卡前保底计数器
    pub pity_counter_after: u32,        // 抽卡后保底计数器
}

/**
 * 抽卡类型
 */
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum GachaType {
    Single,  // 单抽
    Ten,     // 十连
}

/**
 * 会话奖励
 */
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionRewards {
    pub session_id: String,             // 会话ID
    pub session_type: SessionType,      // 会话类型
    pub completed: bool,                // 是否完成
    pub is_boss: bool,                  // 是否为Boss番茄钟
    pub challenge_completed: bool,      // 是否完成挑战
    pub earned_currency: Currency,      // 获得的货币
    pub earned_resources: Resources,    // 获得的资源
}

/**
 * 会话类型
 */
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum SessionType {
    Work,   // 工作
    Break,  // 休息
}

/**
 * 干员升级结果
 */
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpgradeResult {
    pub success: bool,                  // 是否成功
    pub operator: Option<Operator>,     // 更新后的干员
    pub cost_resources: Option<Resources>, // 消耗的资源
    pub message: String,                // 结果消息
}

/**
 * 抽卡系统状态
 */
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct GachaSystemState {
    pub pity_counter: u32,              // 当前保底计数器
    pub currency: Currency,             // 当前货币
    pub resources: Resources,           // 当前资源
    pub operators: Vec<Operator>,       // 拥有的干员
    pub gacha_history: Vec<GachaHistory>, // 抽卡历史
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_operator_validation() {
        let mut op = Operator {
            id: "test_001".to_string(),
            name: "测试干员".to_string(),
            rarity: 6,
            class: OperatorClass::Guard,
            level: 1,
            elite: 0,
            experience: 0,
            potential: 1,
            obtained_at: 0,
            last_upgraded_at: 0,
        };
        
        assert!(op.validate().is_ok());
        
        // 测试无效稀有度
        op.rarity = 7;
        assert!(op.validate().is_err());
        op.rarity = 6;
        
        // 测试等级上限
        op.level = 51;
        assert!(op.validate().is_err());
        op.level = 50;
        assert!(op.validate().is_ok());
    }

    #[test]
    fn test_currency_operations() {
        let mut currency = Currency::new(100, 1000, 5000);
        let cost = Currency::new(50, 600, 2000);
        
        assert!(currency.has_enough(&cost));
        assert!(currency.subtract(&cost).is_ok());
        assert_eq!(currency.originite, 50);
        assert_eq!(currency.orundum, 400);
        assert_eq!(currency.lmd, 3000);
        
        // 测试货币不足
        let large_cost = Currency::new(100, 0, 0);
        assert!(currency.subtract(&large_cost).is_err());
    }

    #[test]
    fn test_resources_operations() {
        let mut resources = Resources::new(5000, 1000);
        let cost = Resources::new(2000, 500);
        
        assert!(resources.has_enough(&cost));
        assert!(resources.subtract(&cost).is_ok());
        assert_eq!(resources.lmd, 3000);
        assert_eq!(resources.exp, 500);
    }
}
