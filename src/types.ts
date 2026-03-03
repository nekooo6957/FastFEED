export type FoodType = 'bone' | 'carrot' | 'grass' | 'bug' | 'fish' | 'shrimp';
export type AnimalType = 'dog' | 'rabbit' | 'sheep' | 'chicken' | 'cat' | 'frog';

export interface FoodItem {
  type: FoodType;
  emoji: string;
  color: string;
}

export interface AnimalConfig {
  type: AnimalType;
  emoji: string;
  preferredFood: FoodType;
  deathFood: FoodType; // The food that kills them instantly
  deathMessage: string;
}

export interface AnimalEntity {
  id: string;
  type: AnimalType;
  x: number; // 0-100% (Left to Right)
  y: number; // 0-100% (Bottom to Top, representing depth)
  state: 'hungry' | 'eating' | 'full' | 'dead' | 'wrong_food';
  hungerTimer: number;
}

export interface GameState {
  phase: 'welcome' | 'playing' | 'result';
  level: number;
  score: number;
  timeLeft: number;
  region: string;
  gender: string;
  animals: AnimalEntity[];
  currentFood: FoodType;
  nextFoodQueue: FoodType[];
  combo: number;
}

export const REGIONS = [
  "广东雄狮", "湖南巾帼", "山东雄狮", "四川熊猫", "北京烤鸭", "上海名媛", "东北虎", "福建游龙"
];

export const FOODS: Record<FoodType, FoodItem> = {
  bone: { type: 'bone', emoji: '🦴', color: 'bg-stone-200' },
  carrot: { type: 'carrot', emoji: '🥕', color: 'bg-orange-400' },
  grass: { type: 'grass', emoji: '🌿', color: 'bg-green-500' },
  bug: { type: 'bug', emoji: '🐛', color: 'bg-lime-600' },
  fish: { type: 'fish', emoji: '🐟', color: 'bg-blue-400' },
  shrimp: { type: 'shrimp', emoji: '🦐', color: 'bg-red-400' },
};

export const ANIMALS: Record<AnimalType, AnimalConfig> = {
  dog: { 
    type: 'dog', 
    emoji: '🐕', 
    preferredFood: 'bone', 
    deathFood: 'bug',
    deathMessage: '狗狗被毒虫咬晕了！' 
  },
  rabbit: { 
    type: 'rabbit', 
    emoji: '🐰', 
    preferredFood: 'carrot', 
    deathFood: 'shrimp',
    deathMessage: '兔子海鲜过敏肿成了猪！' 
  },
  sheep: { 
    type: 'sheep', 
    emoji: '🐑', 
    preferredFood: 'grass', 
    deathFood: 'bone',
    deathMessage: '羊被骨头噎住了！' 
  },
  chicken: { 
    type: 'chicken', 
    emoji: '🐔', 
    preferredFood: 'bug', 
    deathFood: 'fish',
    deathMessage: '小鸡被鱼刺卡住了！' 
  },
  cat: { 
    type: 'cat', 
    emoji: '🐱', 
    preferredFood: 'fish', 
    deathFood: 'grass',
    deathMessage: '猫咪吃草消化不良！' 
  },
  frog: { 
    type: 'frog', 
    emoji: '🐸', 
    preferredFood: 'shrimp', 
    deathFood: 'bone',
    deathMessage: '青蛙被骨头砸扁了！' 
  },
};

export const LEVEL_CONFIG = [
  { level: 1, animalCount: 3, time: 30, types: ['dog', 'rabbit', 'sheep'] as AnimalType[] },
  { level: 2, animalCount: 6, time: 45, types: ['dog', 'rabbit', 'sheep', 'cat', 'chicken', 'frog'] as AnimalType[] },
  { level: 3, animalCount: 9, time: 30, types: ['dog', 'rabbit', 'sheep', 'cat', 'chicken', 'frog'] as AnimalType[] },
];
