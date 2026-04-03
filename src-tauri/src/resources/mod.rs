/**
 * 资源管理系统模块
 * 
 * 负责管理干员养成所需的资源（LMD、经验值、芯片）
 */

pub mod manager;

pub use manager::{get_resources, add_resources, spend_resources};
