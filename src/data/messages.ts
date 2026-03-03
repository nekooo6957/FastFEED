import { AnimalType, FoodType } from '../types';

export const FAILURE_MESSAGES: Record<AnimalType, Partial<Record<FoodType, string>>> = {
  dog: {
    carrot: "狗狗是食肉动物，不吃胡萝卜！",
    grass: "狗狗吃草拉肚子，送医急救！",
    bug: "你的狗狗被毒虫咬晕了，游戏失败！",
    fish: "狗狗被鱼刺卡喉，无法呼吸！",
    shrimp: "狗狗吃虾过敏，肿成猪头！",
  },
  rabbit: {
    bone: "兔子崩断了大门牙，痛哭流涕！",
    grass: "兔子吃了毒草，口吐白沫！",
    bug: "兔子被虫子吓死，胆子太小了！",
    fish: "兔子闻到鱼腥味，当场晕倒！",
    shrimp: "兔子海鲜过敏肿成了猪，游戏失败！",
  },
  sheep: {
    bone: "羊被骨头噎住，翻白眼了！",
    carrot: "羊吃胡萝卜噎到了，咩咩惨叫！",
    bug: "羊误食毒虫，四肢抽搐！",
    fish: "羊被咸鱼熏倒，口吐白沫！",
    shrimp: "羊对海鲜严重过敏，休克了！",
  },
  chicken: {
    bone: "小鸡啄不动骨头，嘴巴歪了！",
    carrot: "小鸡不喜欢胡萝卜，绝食抗议！",
    grass: "小鸡不是牛，吃草不消化！",
    fish: "小鸡被鱼腥味熏晕了！",
    shrimp: "小鸡被虾钳夹住，痛得乱叫！",
  },
  cat: {
    bone: "猫咪啃骨头崩掉牙，喵喵大哭！",
    carrot: "猫咪鄙视胡萝卜，离家出走了！",
    grass: "猫咪吃草催吐，吐了一地！",
    bug: "猫咪抓虫子摔下楼，骨折了！",
    shrimp: "猫咪被虾壳划破喉咙，无法进食！",
  },
  frog: {
    bone: "你的青蛙被你用骨头砸死了，游戏失败！",
    carrot: "青蛙被胡萝卜戳瞎了眼睛！",
    grass: "青蛙被水草缠住淹死了！",
    bug: "青蛙今天想吃海鲜，不吃虫子！",
    fish: "青蛙被大鱼一口吞了！",
  }
};
