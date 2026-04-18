#[derive(Clone, Copy, Eq, PartialEq)]
pub enum BannerKind {
    Standard,
    Event,
    Kernel,
}

#[derive(Clone, Copy)]
pub struct BannerDef {
    pub id: &'static str,
    pub name: &'static str,
    pub summary: &'static str,
    pub starts_at: &'static str,
    pub ends_at: &'static str,
    pub kind: BannerKind,
    pub six_star_rate_up_share: u64,
    pub five_star_rate_up_share: u64,
    pub four_star_rate_up_share: u64,
    pub rate_up_six_ids: &'static [&'static str],
    pub rate_up_five_ids: &'static [&'static str],
    pub rate_up_four_ids: &'static [&'static str],
}

#[derive(Clone, Copy)]
pub struct OperatorDef {
    pub id: &'static str,
    pub name: &'static str,
    pub rarity: u8,
    pub profession: &'static str,
    pub is_kernel: bool,
}

const EVENT_202604_RATE_UP_SIX: [&str; 1] = ["nuchao-lingdong"];
const EVENT_202604_RATE_UP_FIVE: [&str; 2] = ["wanqing", "grain-buds"];
const EVENT_202604_RATE_UP_FOUR: [&str; 1] = ["beanstalk"];

const STANDARD_202604_RATE_UP_SIX: [&str; 2] = ["penance", "mlynar"];
const STANDARD_202604_RATE_UP_FIVE: [&str; 3] = ["lappland", "quercus", "ptilopsis"];

const KERNEL_202604_RATE_UP_SIX: [&str; 2] = ["saria", "weedy"];
const KERNEL_202604_RATE_UP_FIVE: [&str; 3] = ["swire", "glaucus", "zima"];

pub const DEFAULT_BANNER_ID: &str = "cn-event-202604";

const OPERATORS: [OperatorDef; 38] = [
    OperatorDef { id: "nuchao-lingdong", name: "怒潮凌冬", rarity: 6, profession: "近卫", is_kernel: false },
    OperatorDef { id: "penance", name: "斥罪", rarity: 6, profession: "重装", is_kernel: false },
    OperatorDef { id: "pozemka", name: "鸿雪", rarity: 6, profession: "狙击", is_kernel: false },
    OperatorDef { id: "mlynar", name: "玛恩纳", rarity: 6, profession: "近卫", is_kernel: false },
    OperatorDef { id: "silverash", name: "银灰", rarity: 6, profession: "近卫", is_kernel: false },
    OperatorDef { id: "exusiai", name: "能天使", rarity: 6, profession: "狙击", is_kernel: false },
    OperatorDef { id: "eyjafjalla", name: "艾雅法拉", rarity: 6, profession: "术师", is_kernel: false },
    OperatorDef { id: "kaltsit", name: "凯尔希", rarity: 6, profession: "医疗", is_kernel: false },
    OperatorDef { id: "mudrock", name: "泥岩", rarity: 6, profession: "重装", is_kernel: false },
    OperatorDef { id: "jessica-the-liberated", name: "涤火杰西卡", rarity: 6, profession: "狙击", is_kernel: false },
    OperatorDef { id: "surtr", name: "史尔特尔", rarity: 6, profession: "术师", is_kernel: true },
    OperatorDef { id: "hellagur", name: "赫拉格", rarity: 6, profession: "近卫", is_kernel: true },
    OperatorDef { id: "saria", name: "塞雷娅", rarity: 6, profession: "重装", is_kernel: true },
    OperatorDef { id: "weedy", name: "温蒂", rarity: 6, profession: "特种", is_kernel: true },
    OperatorDef { id: "siege", name: "推进之王", rarity: 6, profession: "先锋", is_kernel: true },
    OperatorDef { id: "ifrit", name: "伊芙利特", rarity: 6, profession: "术师", is_kernel: true },
    OperatorDef { id: "wanqing", name: "婉晴", rarity: 5, profession: "先锋", is_kernel: false },
    OperatorDef { id: "grain-buds", name: "谷芽", rarity: 5, profession: "辅助", is_kernel: false },
    OperatorDef { id: "lappland", name: "拉普兰德", rarity: 5, profession: "近卫", is_kernel: false },
    OperatorDef { id: "quercus", name: "夏栎", rarity: 5, profession: "辅助", is_kernel: false },
    OperatorDef { id: "ptilopsis", name: "白面鸮", rarity: 5, profession: "医疗", is_kernel: false },
    OperatorDef { id: "liskarm", name: "雷蛇", rarity: 5, profession: "重装", is_kernel: false },
    OperatorDef { id: "warfarin", name: "华法琳", rarity: 5, profession: "医疗", is_kernel: false },
    OperatorDef { id: "texas", name: "德克萨斯", rarity: 5, profession: "先锋", is_kernel: false },
    OperatorDef { id: "swire", name: "诗怀雅", rarity: 5, profession: "近卫", is_kernel: true },
    OperatorDef { id: "glaucus", name: "格劳克斯", rarity: 5, profession: "辅助", is_kernel: true },
    OperatorDef { id: "zima", name: "凛冬", rarity: 5, profession: "先锋", is_kernel: true },
    OperatorDef { id: "beanstalk", name: "豆苗", rarity: 4, profession: "先锋", is_kernel: false },
    OperatorDef { id: "myrtle", name: "桃金娘", rarity: 4, profession: "先锋", is_kernel: false },
    OperatorDef { id: "gravel", name: "砾", rarity: 4, profession: "特种", is_kernel: false },
    OperatorDef { id: "vigna", name: "红豆", rarity: 4, profession: "先锋", is_kernel: false },
    OperatorDef { id: "shirayuki", name: "白雪", rarity: 4, profession: "狙击", is_kernel: false },
    OperatorDef { id: "perfumer", name: "调香师", rarity: 4, profession: "医疗", is_kernel: false },
    OperatorDef { id: "fang", name: "芬", rarity: 3, profession: "先锋", is_kernel: false },
    OperatorDef { id: "plume", name: "翎羽", rarity: 3, profession: "先锋", is_kernel: false },
    OperatorDef { id: "hibiscus", name: "芙蓉", rarity: 3, profession: "医疗", is_kernel: false },
    OperatorDef { id: "lava", name: "炎熔", rarity: 3, profession: "术师", is_kernel: false },
    OperatorDef { id: "ansel", name: "安赛尔", rarity: 3, profession: "医疗", is_kernel: false },
];

const BANNERS: [BannerDef; 3] = [
    BannerDef {
        id: "cn-event-202604",
        name: "活动寻访·怒潮凌冬",
        summary: "国服活动卡池快照：当前 6 星 UP 为怒潮凌冬。",
        starts_at: "2026-04-11 16:00",
        ends_at: "2026-04-25 03:59",
        kind: BannerKind::Event,
        six_star_rate_up_share: 50,
        five_star_rate_up_share: 50,
        four_star_rate_up_share: 20,
        rate_up_six_ids: &EVENT_202604_RATE_UP_SIX,
        rate_up_five_ids: &EVENT_202604_RATE_UP_FIVE,
        rate_up_four_ids: &EVENT_202604_RATE_UP_FOUR,
    },
    BannerDef {
        id: "cn-standard-202604",
        name: "标准寻访·轮换常驻",
        summary: "国服标准卡池快照：当前 6 星 UP 为斥罪、玛恩纳。",
        starts_at: "2026-04-14 04:00",
        ends_at: "2026-04-28 03:59",
        kind: BannerKind::Standard,
        six_star_rate_up_share: 50,
        five_star_rate_up_share: 50,
        four_star_rate_up_share: 0,
        rate_up_six_ids: &STANDARD_202604_RATE_UP_SIX,
        rate_up_five_ids: &STANDARD_202604_RATE_UP_FIVE,
        rate_up_four_ids: &[],
    },
    BannerDef {
        id: "cn-kernel-202604",
        name: "中坚寻访·轮换精选",
        summary: "国服中坚卡池快照：当前 6 星 UP 为塞雷娅、温蒂。",
        starts_at: "2026-04-14 04:00",
        ends_at: "2026-04-28 03:59",
        kind: BannerKind::Kernel,
        six_star_rate_up_share: 50,
        five_star_rate_up_share: 50,
        four_star_rate_up_share: 0,
        rate_up_six_ids: &KERNEL_202604_RATE_UP_SIX,
        rate_up_five_ids: &KERNEL_202604_RATE_UP_FIVE,
        rate_up_four_ids: &[],
    },
];

pub fn all_banners() -> &'static [BannerDef] {
    &BANNERS
}

pub fn banner_by_id(id: &str) -> Option<BannerDef> {
    BANNERS.iter().copied().find(|banner| banner.id == id)
}

pub fn operator_by_id(id: &str) -> Option<OperatorDef> {
    OPERATORS.iter().copied().find(|operator| operator.id == id)
}

pub fn operators_for_banner_rarity(banner: BannerDef, rarity: u8) -> Vec<OperatorDef> {
    OPERATORS
        .iter()
        .copied()
        .filter(|operator| {
            operator.rarity == rarity
                && if rarity <= 3 {
                    true
                } else {
                    match banner.kind {
                        BannerKind::Kernel => operator.is_kernel,
                        _ => !operator.is_kernel,
                    }
                }
        })
        .collect()
}

pub fn rate_up_ids_for_rarity(banner: BannerDef, rarity: u8) -> &'static [&'static str] {
    match rarity {
        6 => banner.rate_up_six_ids,
        5 => banner.rate_up_five_ids,
        4 => banner.rate_up_four_ids,
        _ => &[],
    }
}

pub fn rate_up_share_for_rarity(banner: BannerDef, rarity: u8) -> u64 {
    match rarity {
        6 => banner.six_star_rate_up_share,
        5 => banner.five_star_rate_up_share,
        4 => banner.four_star_rate_up_share,
        _ => 0,
    }
}
