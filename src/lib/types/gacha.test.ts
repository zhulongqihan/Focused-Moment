/**
 * 测试 gacha 类型定义
 */

import type { Operator, Currency, Resources, GachaResult } from './gacha';
import { OperatorClass } from './gacha';

// 测试类型定义是否正确
const testOperator: Operator = {
  id: 'op_001',
  name: '阿米娅',
  rarity: 5,
  class: OperatorClass.CASTER,
  level: 1,
  elite: 0,
  experience: 0,
  potential: 1,
  obtainedAt: Date.now(),
  lastUpgradedAt: Date.now()
};

const testCurrency: Currency = {
  originite: 100,
  orundum: 6000,
  lmd: 10000
};

const testResources: Resources = {
  lmd: 10000,
  exp: 5000,
  chips: {
    'guard': 10,
    'caster': 5
  }
};

const testGachaResult: GachaResult = {
  operators: [testOperator],
  pityCounter: 1,
  costCurrency: {
    originite: 0,
    orundum: 600,
    lmd: 0
  }
};

console.log('Type definitions are valid!');
