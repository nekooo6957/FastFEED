import { useState, useEffect, useRef, PointerEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  AnimalEntity, 
  FoodType, 
  LEVEL_CONFIG, 
  ANIMALS, 
  FOODS 
} from '../types';
import { FAILURE_MESSAGES } from '../data/messages';

// Helper to get random item from array
const random = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

// Helper to generate unique ID
const uid = () => Math.random().toString(36).substr(2, 9);

// Grid Configuration
// Dynamic generation based on level

interface GameScreenProps {
  onGameOver: (score: number, reason?: string) => void;
  onWin: (score: number) => void;
}

// Helper for hitbox scaling
// Level 1-3: 1.3 * globalScale (Standard)
// Level 4: 1.25 * globalScale (Further increased)
// Level 5+: 1.08 * globalScale (Increased proportionally to L4)
const getHitScaleByY = (yPct: number, globalScale: number = 1, level: number = 1) => {
  if (level === 4) {
    return 1.25 * globalScale;
  }
  if (level >= 5) {
    return 1.08 * globalScale;
  }
  return 1.3 * globalScale;
};

export function GameScreen({ onGameOver, onWin }: GameScreenProps) {
  // --- Game State ---
  const [level, setLevel] = useState(1);
  
  // Calculate Global Scale based on Level to prevent overlap
  // Level 1: 1.0
  // Level 2: 0.95
  // Level 3: 0.9
  // Level 4: 0.85
  // Level 5: 0.8
  const globalScale = Math.max(0.8, 1 - (level - 1) * 0.05);
  const [score, setScore] = useState(0);
  const [animals, setAnimals] = useState<AnimalEntity[]>([]);
  const [currentFood, setCurrentFood] = useState<FoodType>('bone');
  const [nextFoods, setNextFoods] = useState<FoodType[]>([]);
  const [feedback, setFeedback] = useState<{id: string, text: string, x: number, y: number} | null>(null);
  const [combo, setCombo] = useState(0);
  
  // Power-ups State
  const [shieldActive, setShieldActive] = useState(false);
  const [powerUpsUsed, setPowerUpsUsed] = useState({ shield: false, magnet: false });

  // --- Interaction State ---
  const [isCharging, setIsCharging] = useState(false);
  const chargeValueRef = useRef(0); // Use ref for animation value
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const chargeStartTimeRef = useRef<number>(0);
  const chargeRafRef = useRef<number>(0);
  const startPosRef = useRef<{x: number, y: number} | null>(null);
  
  const chargeBarRef = useRef<HTMLDivElement>(null);
  const chargeCircleRef = useRef<SVGCircleElement>(null);

  const gameAreaRef = useRef<HTMLDivElement>(null);
  const [flyingFoods, setFlyingFoods] = useState<{
    id: string;
    type: FoodType;
    startX: number;
    startY: number;
    targetX: number;
    targetY: number;
    duration: number;
    charge: number; // For rotation speed
  }[]>([]);
  
  // Refs for collision detection to avoid stale closures
  const animalsRef = useRef(animals);
  const processedFoodIds = useRef<Set<string>>(new Set());
  
  // Track Game Area Dimensions in State for Responsive Rendering
  const [gameDimensions, setGameDimensions] = useState({ 
    width: typeof window !== 'undefined' ? window.innerWidth : 1000, 
    height: typeof window !== 'undefined' ? window.innerHeight : 1000 
  });

  useEffect(() => {
    animalsRef.current = animals;
  }, [animals]);

  // Track Game Area Dimensions
  useEffect(() => {
    if (!gameAreaRef.current) return;
    
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setGameDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height
        });
      }
    });
    
    observer.observe(gameAreaRef.current);
    return () => observer.disconnect();
  }, []);

  const [discardedFood, setDiscardedFood] = useState<{ type: FoodType, id: number } | null>(null);

  // --- Initialization ---
  useEffect(() => {
    startLevel(1);
  }, []);

  // --- Hit Detection & Scaling Constants ---
  // Use fixed percentage radius to ensure consistent gaps across screen sizes
  // 10.5% radius = 21% diameter
  // Level 4 Spacing is 20%. 
  // Level 4 Scale is 0.85 * 0.95 = 0.8075
  // Effective Diameter = 21% * 0.8075 = 16.95%
  // Gap = 20% - 16.95% = 3.05% (Consistent on all screens)
  const baseHitRadiusPct = 10.5;
  const foodHitRadiusPct = 2.5; // Food radius for circle-circle collision

  // Calculate Visual Scale Multiplier
  // We want the visual emoji (text-6xl ~ 60px) to match the hitbox size
  // Hitbox Diameter (px) = width * (baseHitRadiusPct / 100) * 2
  // Visual Size (px) = 60 * Scale
  // So Scale Factor = Hitbox Diameter / 60
  const visualScaleMultiplier = (gameDimensions.width * (baseHitRadiusPct / 100) * 2) / 60;

  const getVisualScale = (yPct: number) => {
    // Get the hitbox scale (relative factor)
    const hitScale = getHitScaleByY(yPct, globalScale, level);
    // Apply the correction multiplier so visual matches hitbox
    return hitScale * visualScaleMultiplier;
  };

  // --- Discard Logic ---
  const handleDiscard = () => {
    if (nextFoods.length === 0) return;

    // Trigger animation
    setDiscardedFood({ type: currentFood, id: Date.now() });
    
    // Clear animation after it plays
    setTimeout(() => setDiscardedFood(null), 500);

    // Logic to get next food
    const hungryTypes = new Set(animals.filter(a => a.state === 'hungry').map(a => a.type));
    let currentLevelAllowedFoods = getLevelAllowedFoods(level);
    
    if (hungryTypes.size > 0) {
      // Explicitly cast t to AnimalType to avoid TS error
      currentLevelAllowedFoods = Array.from(hungryTypes).map(t => ANIMALS[t as import('../types').AnimalType].preferredFood);
    }

    const next = nextFoods[0];
    const newFoodItem = random(currentLevelAllowedFoods) || 'bone';
    const newQueue = [...nextFoods.slice(1), newFoodItem];
    
    setCurrentFood(next);
    setNextFoods(newQueue);
  };

  // --- Charge Animation Loop Removed (Now Distance Based) ---
  // useEffect(() => { ... }, [isCharging]);

  const getLevelAllowedFoods = (lvl: number) => {
    // Use config if available, otherwise allow all foods
    const config = LEVEL_CONFIG.find(c => c.level === lvl);
    if (config) {
      const allowedFoods = config.types.map(t => ANIMALS[t].preferredFood);
      return Array.from(new Set(allowedFoods));
    }
    // Default for higher levels: all foods
    return Object.values(ANIMALS).map(a => a.preferredFood);
  };

  const startLevel = (lvl: number) => {
    setLevel(lvl);
    setCombo(0);
    setShieldActive(false);
    setPowerUpsUsed({ shield: false, magnet: false });
    
    const gridSize = lvl; // 1x1, 2x2, 3x3, etc.
    const animalCount = gridSize * gridSize;
    
    // Calculate Grid Positions
    const minRow = 40, maxRow = 80;
    
    // Dynamic column range based on level to prevent overcrowding
    let minCol = 20;
    let maxCol = 80;
    
    if (lvl === 4) {
      minCol = 15;
      maxCol = 85;
    } else if (lvl >= 5) {
      minCol = 10;
      maxCol = 90;
    }
    
    const getRowPos = (i: number) => {
      if (gridSize === 1) return (minRow + maxRow) / 2;
      return minRow + (i * (maxRow - minRow)) / (gridSize - 1);
    };
    
    const getColPos = (j: number) => {
      if (gridSize === 1) return 50; // Center
      return minCol + (j * (maxCol - minCol)) / (gridSize - 1);
    };

    // Generate Grid Slots
    const slots = Array.from({ length: animalCount }, (_, i) => i);
    // Shuffle slots
    for (let i = slots.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [slots[i], slots[j]] = [slots[j], slots[i]];
    }

    // Determine allowed animal types
    let allowedTypes = Object.keys(ANIMALS) as import('../types').AnimalType[];
    const config = LEVEL_CONFIG.find(c => c.level === lvl);
    if (config) {
      allowedTypes = config.types;
    }

    // Spawn animals in slots
    const newAnimals: AnimalEntity[] = [];
    for (let i = 0; i < animalCount; i++) {
      const type = random(allowedTypes);
      const slotIndex = slots[i];
      const row = Math.floor(slotIndex / gridSize);
      const col = slotIndex % gridSize;
      
      let requiredFeeds = 1;
      if (lvl === 2) {
        // Level 2: Some 1, some 2 (50/50 chance)
        requiredFeeds = Math.random() > 0.5 ? 2 : 1;
      } else if (lvl >= 3) {
        // Level 3+: 1, 2, 3 (Weighted towards 2 and 3)
        const r = Math.random();
        if (r < 0.2) requiredFeeds = 1;
        else if (r < 0.6) requiredFeeds = 2;
        else requiredFeeds = 3;
      }

      newAnimals.push({
        id: uid(),
        type,
        x: getColPos(col),
        y: getRowPos(row),
        state: 'hungry',
        hungerTimer: 0,
        requiredFeeds,
        currentFeeds: 0
      });
    }
    setAnimals(newAnimals);

    // Init Food Queue
    const allowedFoods = getLevelAllowedFoods(lvl);
    const initialFoods: FoodType[] = [];
    for(let i=0; i<5; i++) initialFoods.push(random(allowedFoods));
    setCurrentFood(initialFoods[0]);
    setNextFoods(initialFoods.slice(1));
  };

  // --- Interaction Logic ---
  const handlePointerDown = (e: PointerEvent) => {
    // Removed single food check to allow rapid fire
    
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    
    // Calculate start position relative to game area
    if (gameAreaRef.current) {
      const gameRect = gameAreaRef.current.getBoundingClientRect();
      const btnRect = target.getBoundingClientRect();
      
      // Center of button relative to game area
      const startX = btnRect.left + btnRect.width / 2 - gameRect.left;
      const startY = btnRect.top + btnRect.height / 2 - gameRect.top;
      
      startPosRef.current = { x: startX, y: startY };
    }
    
    setIsCharging(true);
    chargeValueRef.current = 0;
    setDragOffset({ x: 0, y: 0 });
    chargeStartTimeRef.current = performance.now();
    // Animation loop is handled by useEffect
  };

  const handlePointerMove = (e: PointerEvent) => {
    if (!isCharging || !startPosRef.current || !gameAreaRef.current) return;
    
    // Calculate drag vector relative to start position (in pixels)
    // We need current pointer position relative to game area
    const gameRect = gameAreaRef.current.getBoundingClientRect();
    const currentX = e.clientX - gameRect.left;
    const currentY = e.clientY - gameRect.top;
    
    const dx = currentX - startPosRef.current.x;
    const dy = Math.max(0, currentY - startPosRef.current.y); // Restrict upward dragging
    
    setDragOffset({ x: dx, y: dy });

    // Cartesian Charging (Linear Vertical Force)
    // Power is primarily determined by how far down you pull
    const maxDrag = 150; 
    const charge = Math.min((dy / maxDrag) * 100, 100);
    
    chargeValueRef.current = charge;

    // Update Visuals directly
    if (chargeBarRef.current) {
      chargeBarRef.current.style.width = `${charge}%`;
    }
    if (chargeCircleRef.current) {
      const offset = 283 - (283 * charge) / 100;
      chargeCircleRef.current.style.strokeDashoffset = `${offset}`;
    }
  };

  const handlePointerUp = (e: PointerEvent) => {
    if (!isCharging || !startPosRef.current || !gameAreaRef.current) return;
    
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    cancelAnimationFrame(chargeRafRef.current);
    setIsCharging(false);
    
    const gameRect = gameAreaRef.current.getBoundingClientRect();
    
    // Calculate Start Position (Hand Position)
    const spawnPxX = startPosRef.current.x + dragOffset.x;
    const spawnPxY = startPosRef.current.y + dragOffset.y;

    // Cartesian Launch Logic
    // We apply a multiplier to the drag vector to get the throw vector
    // This ensures "Linear" feel: Pulling down X pixels always adds Y pixels of distance
    const FORCE_MULTIPLIER = 5.0; // Amplification factor (Drag 1px -> Throw 5px)
    
    // Drag Down (+y) -> Throw Up (-y)
    const throwVecX = -dragOffset.x * FORCE_MULTIPLIER;
    const throwVecY = -dragOffset.y * FORCE_MULTIPLIER;

    // Calculate Target
    const targetPxX = spawnPxX + throwVecX;
    const targetPxY = spawnPxY + throwVecY;
    
    // Charge for animation speed (based on vertical pull)
    // Use same maxDrag as in handlePointerMove
    const chargeVal = Math.min((dragOffset.y / 150) * 100, 100);
    
    // Convert to Percentages for rendering
    const startXPct = (spawnPxX / gameRect.width) * 100;
    const startYPct = ((gameRect.height - spawnPxY) / gameRect.height) * 100;
    
    const targetXPct = (targetPxX / gameRect.width) * 100;
    const targetYPct = ((gameRect.height - targetPxY) / gameRect.height) * 100;

    // Launch
    const foodToThrow = currentFood;
    const newFood = {
      id: uid(),
      type: foodToThrow,
      startX: startXPct,
      startY: startYPct,
      targetX: targetXPct,
      targetY: targetYPct,
      duration: 0.8,
      charge: chargeVal
    };

    setFlyingFoods(prev => [...prev, newFood]);

    // Cycle Food
    // Filter allowed foods to only those needed by current hungry animals
    const hungryTypes = new Set(animals.filter(a => a.state === 'hungry').map(a => a.type));
    let currentLevelAllowedFoods = getLevelAllowedFoods(level);
    
    if (hungryTypes.size > 0) {
      // Explicitly cast t to AnimalType to avoid TS error
      currentLevelAllowedFoods = Array.from(hungryTypes).map(t => ANIMALS[t as import('../types').AnimalType].preferredFood);
    }

    const next = nextFoods[0];
    const newQueue = [...nextFoods.slice(1), random(currentLevelAllowedFoods)];
    setCurrentFood(next);
    setNextFoods(newQueue);
    
    // Reset
    chargeValueRef.current = 0;
    setDragOffset({ x: 0, y: 0 });
    startPosRef.current = null;
  };

  // --- Hit Detection ---
  // (Constants moved to top of component)


  useEffect(() => {
    flyingFoods.forEach(food => {
      if (processedFoodIds.current.has(food.id)) return;
      
      processedFoodIds.current.add(food.id);
      
      setTimeout(() => {
        checkCollision(food);
        setFlyingFoods(prev => prev.filter(f => f.id !== food.id));
        processedFoodIds.current.delete(food.id);
      }, food.duration * 1000);
    });
  }, [flyingFoods]);

  const checkCollision = (food: {type: FoodType, targetX: number, targetY: number}) => {
    let closestAnimal: AnimalEntity | null = null;
    let minDist = 10000;
    
    const { width, height } = gameDimensions;
    const aspectRatio = height / width;

    // Use ref to get latest animals state inside timeout
    animalsRef.current.forEach(animal => {
      if (animal.state === 'dead' || animal.state === 'full') return;

      // Use hit scale for collision detection (more forgiving at distance)
      const scale = getHitScaleByY(animal.y, globalScale, level);
      const effectiveHitRadius = baseHitRadiusPct * scale;
      const effectiveFoodRadius = foodHitRadiusPct * scale;

      const dx = animal.x - food.targetX;
      // Correct DY by aspect ratio to ensure circular hit zone in pixels
      let dy = (animal.y - food.targetY) * aspectRatio;
      
      // Circle-Circle Collision
      const dist = Math.sqrt(dx*dx + dy*dy);

      if (dist < (effectiveHitRadius + effectiveFoodRadius)) { 
        if (dist < minDist) {
          minDist = dist;
          closestAnimal = animal;
        }
      }
    });

    if (closestAnimal) {
      handleHit(closestAnimal, food.type);
    } else {
      // Detailed Miss Feedback
      let msg = "未命中"; // Default
      
      // Check Y position for depth feedback
      if (food.targetY < 35) {
        msg = "落在前方很远";
      } else if (food.targetY > 90) {
        msg = "飞过头顶";
      } else {
        // It was in the playable zone but missed
        // Check if it was close to any animal
        let closeToAny = false;
        animalsRef.current.forEach(a => {
           const scale = getHitScaleByY(a.y, globalScale, level);
           const effectiveHitRadius = baseHitRadiusPct * scale;
           const effectiveFoodRadius = foodHitRadiusPct * scale;
           
           const dx = a.x - food.targetX;
           let dy = (a.y - food.targetY) * aspectRatio;
           // No asymmetric logic here either
           
           const dist = Math.sqrt(dx*dx + dy*dy);
           
           if (dist < (effectiveHitRadius + effectiveFoodRadius) * 1.5) closeToAny = true;
        });
        
        if (closeToAny) {
           // Check if it went "behind" the animal (Y > Animal.Y)
           // Simple heuristic
           msg = "擦过边缘";
        } else {
           // Maybe hit "back of head" if slightly past a row?
           // Row centers: 40, 60, 80
           if ((food.targetY > 45 && food.targetY < 55) || (food.targetY > 65 && food.targetY < 75)) {
             msg = "砸中头部后方";
           } else {
             msg = "未命中";
           }
        }
      }
      
      showFeedback(msg, food.targetX, food.targetY);
      setCombo(0);
    }
  };

  const handleHit = (animal: AnimalEntity, foodType: FoodType) => {
    const config = ANIMALS[animal.type];
    
    if (foodType === config.preferredFood) {
      const newCurrentFeeds = (animal.currentFeeds || 0) + 1;
      const isFull = newCurrentFeeds >= (animal.requiredFeeds || 1);

      if (isFull) {
        updateAnimalState(animal.id, 'full');
        setCombo(c => c + 1);
        setScore(s => s + 100 + (combo * 10)); 
        showFeedback(`命中! x${combo + 1}`, animal.x, animal.y);
      } else {
        // Partial Feed
        setAnimals(prev => prev.map(a => a.id === animal.id ? { ...a, currentFeeds: newCurrentFeeds } : a));
        setCombo(c => c + 1);
        setScore(s => s + 50);
        showFeedback(`再喂${(animal.requiredFeeds || 1) - newCurrentFeeds}次!`, animal.x, animal.y);
      }
      
      // Check Level Completion
      // We need to count how many are NOT full (excluding this one if it just became full)
      const remaining = animals.filter(a => a.id !== animal.id && a.state === 'hungry').length;
      
      // If this was the last hungry one and it is now full
      if (remaining === 0 && isFull) {
        setTimeout(() => {
          startLevel(level + 1);
        }, 1000);
      }
    } else {
      if (shieldActive) {
        setShieldActive(false);
        showFeedback("护盾抵挡!", animal.x, animal.y);
      } else {
        updateAnimalState(animal.id, 'wrong_food');
        const failMsg = FAILURE_MESSAGES[animal.type][foodType] || `${config.emoji} 不吃 ${FOODS[foodType].emoji}！`;
        onGameOver(score, failMsg);
      }
    }
  };

  const updateAnimalState = (id: string, newState: AnimalEntity['state']) => {
    setAnimals(prev => prev.map(a => a.id === id ? { ...a, state: newState } : a));
  };

  const showFeedback = (text: string, x: number, y: number) => {
    setFeedback({ id: uid(), text, x, y });
    setTimeout(() => setFeedback(null), 2000);
  };

  // --- Power Ups ---
  const activateShield = () => {
    if (powerUpsUsed.shield) return;
    setShieldActive(true);
    setPowerUpsUsed(p => ({ ...p, shield: true }));
    showFeedback("Shield ON!", 50, 50);
  };

  const activateMagnet = () => {
    if (powerUpsUsed.magnet) return;
    
    // Find furthest hungry animal (Highest Y)
    const hungryAnimals = animals.filter(a => a.state === 'hungry');
    if (hungryAnimals.length === 0) return;

    hungryAnimals.sort((a, b) => b.y - a.y); 
    
    const target = hungryAnimals[0];
    if (target) {
      // Move to Front Center (Row 0, Col 1 equivalent)
      setAnimals(prev => prev.map(a => a.id === target.id ? { ...a, y: 40, x: 50 } : a));
      setPowerUpsUsed(p => ({ ...p, magnet: true }));
      showFeedback("Come Here!", 50, 50);
    }
  };

  // --- Render Helpers ---
  // getScaleByY moved outside

  const getAnimalStyle = (animal: AnimalEntity) => {
    const scale = getVisualScale(animal.y);
    const zIndex = 100 - Math.floor(animal.y);
    
    return {
      left: `${animal.x}%`,
      bottom: `${animal.y}%`,
      transform: `translate(-50%, 50%) scale(${scale})`,
      zIndex
    };
  };

  return (
    <div 
      ref={gameAreaRef}
      className="relative w-full h-full overflow-hidden select-none touch-none"
      style={{
        backgroundImage: 'url(https://img.freepik.com/free-vector/green-grass-background-texture_1308-43555.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}
    >
      {/* HUD */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-50 pointer-events-none">
        <div className="bg-white/80 backdrop-blur rounded-xl px-4 py-2 border-2 border-black font-mono font-bold">
          LEVEL {level}
        </div>
        <div className="bg-black text-white rounded-xl px-4 py-2 font-mono font-bold">
          {score} PTS
        </div>
      </div>

      {/* Animals */}
      {animals.map(animal => {
        if (animal.state === 'full') return null;
        const config = ANIMALS[animal.type];
        return (
          <div
            key={animal.id}
            className="absolute transition-all duration-500 ease-out"
            style={getAnimalStyle(animal)}
          >
            <div className="relative flex flex-col items-center">
              {/* Feed Count Indicator - Moved Closer */}
              {animal.state === 'hungry' && animal.requiredFeeds > 1 && (
                <div className="absolute -top-4 -right-4 bg-black text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold border-2 border-white z-20">
                  {animal.requiredFeeds - animal.currentFeeds}
                </div>
              )}

              {/* Status Bubble - Moved Closer */}
              {animal.state === 'hungry' && (
                <div className="absolute -top-8 bg-white border-2 border-black rounded-full px-2 py-1 animate-bounce whitespace-nowrap z-10">
                  {FOODS[config.preferredFood].emoji}
                </div>
              )}
              
              {/* Animal Sprite */}
              <div className={`text-6xl filter drop-shadow-lg transition-transform ${
                animal.state === 'wrong_food' ? 'grayscale rotate-180' : 
                animal.state === 'full' ? 'scale-110' : 'animate-pulse'
              }`}>
                {config.emoji}
              </div>
              
              {/* Shadow */}
              <div className="w-12 h-4 bg-black/20 rounded-full mt-[-5px] blur-sm" />
            </div>
          </div>
        );
      })}

      {/* Debug Hit Zones */}
      {animals.map(animal => {
        if (animal.state === 'full') return null;
        const scale = getHitScaleByY(animal.y, globalScale, level);
        const effectiveHitRadius = baseHitRadiusPct * scale;
        
        return (
          <div
            key={`hit-${animal.id}`}
            className="absolute border-2 border-red-500/50 bg-red-500/10 rounded-full pointer-events-none z-[150]"
            style={{
              left: `${animal.x}%`,
              bottom: `${animal.y}%`,
              width: `${effectiveHitRadius * 2}%`,
              aspectRatio: '1/1',
              transform: 'translate(-50%, 50%)'
            }}
          />
        );
      })}

      {/* Flying Food (3D Parabola) */}
      <AnimatePresence>
        {flyingFoods.map(food => {
          // Calculate scales for this specific food
          const startScale = getVisualScale(food.startY);
          const targetScale = getVisualScale(food.targetY);
          
          return (
            <div key={food.id} className="absolute inset-0 pointer-events-none z-[200]">
               {/* Shadow (Ground Path) - Moves Linearly */}
               <motion.div
                initial={{ 
                  left: `${food.startX}%`, 
                  bottom: `${food.startY}%`,
                  scale: startScale,
                  opacity: 0.5
                }}
                animate={{ 
                  left: `${food.targetX}%`, 
                  bottom: `${food.targetY}%`,
                  scale: targetScale,
                  opacity: 0.2
                }}
                transition={{ 
                  duration: food.duration, 
                  ease: "linear" 
                }}
                className="absolute w-12 h-4 bg-black rounded-full blur-sm"
                style={{ transform: 'translate(-50%, 50%)' }}
              />

              {/* Food Sprite (Arc) - Moves Linearly X/Y, Parabolic Z (translateY) */}
              <motion.div
                initial={{ 
                  left: `${food.startX}%`, 
                  bottom: `${food.startY}%`, 
                  scale: startScale,
                  rotate: 0,
                  y: 0 
                }}
                animate={{ 
                  left: `${food.targetX}%`, 
                  bottom: `${food.targetY}%`, 
                  scale: targetScale,
                  rotate: 360 * (1 + food.charge / 20),
                  y: [0, -150, 0] // The Arc (Height)
                }}
                transition={{ 
                  left: { duration: food.duration, ease: "linear" },
                  bottom: { duration: food.duration, ease: "linear" },
                  scale: { duration: food.duration, ease: "linear" },
                  rotate: { duration: food.duration, ease: "linear" },
                  y: { duration: food.duration, ease: "easeInOut", times: [0, 0.5, 1] }
                }}
                className="absolute w-12 h-12 flex items-center justify-center text-4xl"
                style={{ transformOrigin: 'center center', transform: 'translate(-50%, 50%)' }}
              >
                {FOODS[food.type].emoji}
              </motion.div>
            </div>
          );
        })}
      </AnimatePresence>

      {/* Feedback Text */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 1, y: 0, scale: 0.5 }}
            animate={{ opacity: 0, y: -30, scale: 1.2 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
            className="absolute z-[300] font-black text-xl text-stroke-white text-black pointer-events-none whitespace-nowrap"
            style={{ left: `${feedback.x}%`, bottom: `${feedback.y}%`, transform: 'translate(-50%, 0)' }}
          >
            {feedback.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Player Launcher (Bottom) */}
      <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-black/10 to-transparent flex flex-col items-center justify-end pb-12 z-[100] pointer-events-auto">
        
        <div className="relative w-full flex items-end justify-center">
          
          {/* Left Group - Pinned to Left Edge */}
          <div className="absolute left-5 bottom-0 flex flex-col items-center gap-2">
            <div className="relative h-32 w-24">
              {/* Shield (Top) */}
              <div className="absolute top-0 left-0 right-0 flex flex-col items-center">
                <button 
                  className={`w-24 h-12 rounded-full shadow-lg border-2 border-black active:scale-95 transition-transform flex items-center justify-center gap-1 ${
                    powerUpsUsed.shield ? 'bg-gray-400 opacity-50 cursor-not-allowed' : 
                    shieldActive ? 'bg-green-100 text-black ring-4 ring-green-300' : 'bg-white text-black'
                  }`}
                  onClick={activateShield}
                  disabled={powerUpsUsed.shield}
                  title="Shield"
                >
                  <span className="text-xl">🛡️</span>
                </button>
              </div>
              {/* Shield Label */}
              <div className="absolute top-14 left-0 right-0 flex justify-center">
                <span className="text-[10px] font-bold text-white drop-shadow-md">护盾</span>
              </div>
              
              {/* Next Food (Bottom) - Now a Pill Button */}
              <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center">
                <div className={`w-24 h-12 rounded-full border-2 border-black flex items-center justify-center shadow-lg bg-white`}>
                  {nextFoods.length > 0 && (
                    <span className="text-3xl">{FOODS[nextFoods[0]].emoji}</span>
                  )}
                </div>
              </div>
            </div>
            {/* Next Food Label - Outside */}
            <span className="text-[10px] font-bold text-white drop-shadow-md mt-1">即将上菜</span>
          </div>

          {/* Current Food (Center) */}
          <div className="flex flex-col items-center gap-2">
            <div 
              className="relative z-10"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
            >
              {/* Guide Arrow / Charge Indicator */}
              {isCharging && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 flex flex-col items-center">
                  {/* Charge Bar */}
                  <div className="w-24 h-3 bg-gray-300 rounded-full overflow-hidden border border-black mb-2 relative">
                    {/* Segment Markers */}
                    <div className="absolute left-[20%] top-0 bottom-0 w-[1px] bg-black/20 z-10"></div>
                    <div className="absolute left-[40%] top-0 bottom-0 w-[1px] bg-black/20 z-10"></div>
                    <div className="absolute left-[60%] top-0 bottom-0 w-[1px] bg-black/20 z-10"></div>
                    <div className="absolute left-[80%] top-0 bottom-0 w-[1px] bg-black/20 z-10"></div>
                    
                    <div 
                      ref={chargeBarRef}
                      className="h-full bg-orange-500"
                      style={{ width: '0%', transition: 'none' }}
                    />
                  </div>
                </div>
              )}

              <div 
                className={`relative flex items-center justify-center cursor-grab active:cursor-grabbing w-32 h-32 mb-10 ${isCharging ? 'scale-110' : ''}`}
              >
                {/* Hand Container - Rotates to follow drag (Wrist Bend) */}
                <motion.div
                  className="absolute w-full h-full flex items-center justify-center origin-bottom"
                  style={{
                    x: isCharging ? dragOffset.x : 0,
                    y: isCharging ? dragOffset.y : 0,
                    rotate: isCharging ? -dragOffset.x * 0.5 : 0,
                    transition: isCharging ? 'none' : 'all 0.3s ease-out'
                  }}
                >
                  {/* Hand SVG */}
                  <svg width="110" height="110" viewBox="0 0 100 100" className="drop-shadow-xl">
                    {/* Simple Hand Shape (Palm + Fingers) */}
                    <path 
                      d="M30,100 L30,60 Q30,30 50,30 Q70,30 70,60 L70,100 Z" 
                      fill="#FFCCAA" 
                      stroke="black" 
                      strokeWidth="3"
                    />
                    {/* Thumb */}
                    <path 
                      d="M70,70 Q90,70 90,50 Q90,30 70,40" 
                      fill="#FFCCAA" 
                      stroke="black" 
                      strokeWidth="3"
                      fillOpacity="0" // Thumb is behind or outline? Let's make it simple
                    />
                    {/* Fingers Detail */}
                    <path d="M40,30 L40,60" stroke="black" strokeWidth="2" opacity="0.3" />
                    <path d="M50,30 L50,60" stroke="black" strokeWidth="2" opacity="0.3" />
                    <path d="M60,30 L60,60" stroke="black" strokeWidth="2" opacity="0.3" />
                  </svg>

                  {/* Food in Hand */}
                  <div className="absolute top-[40%] text-5xl z-10 pointer-events-none">
                    {FOODS[currentFood].emoji}
                  </div>

                  {/* Direction Indicator Triangle (Inside Hand Container) */}
                  {isCharging && (Math.abs(dragOffset.x) > 5 || Math.abs(dragOffset.y) > 5) && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full z-20">
                      {/* Triangle pointing UP (relative to Hand) */}
                      <div className="w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-b-[20px] border-b-black" />
                    </div>
                  )}
                </motion.div>
              </div>
            </div>
            <span className="text-sm font-bold text-white drop-shadow-md">快喂我</span>
          </div>

          {/* Right Group - Pinned to Right Edge */}
          <div className="absolute right-5 bottom-0 flex flex-col items-center gap-2">
            <div className="relative h-32 w-24">
              {/* Magnet (Top) */}
              <div className="absolute top-0 left-0 right-0 flex flex-col items-center">
                <button 
                  className={`w-24 h-12 rounded-full shadow-lg border-2 border-black active:scale-95 transition-transform flex items-center justify-center gap-1 ${
                    powerUpsUsed.magnet ? 'bg-gray-400 opacity-50 cursor-not-allowed' : 'bg-white text-black'
                  }`}
                  onClick={activateMagnet}
                  disabled={powerUpsUsed.magnet}
                  title="Magnet"
                >
                  <span className="text-xl">🧲</span>
                </button>
              </div>
              {/* Magnet Label */}
              <div className="absolute top-14 left-0 right-0 flex justify-center">
                <span className="text-[10px] font-bold text-white drop-shadow-md">勾引</span>
              </div>

              {/* Discard Button (Bottom) - Now a Pill Button */}
              <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center">
                <button 
                  onClick={handleDiscard}
                  className="w-24 h-12 rounded-full bg-white border-2 border-black flex items-center justify-center text-2xl shadow-lg active:scale-95 transition-transform hover:bg-gray-100"
                  title="Discard"
                >
                  🗑️
                </button>
              </div>
            </div>
            {/* Discard Label - Outside */}
            <span className="text-[10px] font-bold text-white drop-shadow-md mt-1">换菜</span>
          </div>

          {/* Discard Animation - Only Emoji Falls */}
          <AnimatePresence>
            {discardedFood && (
              <motion.div
                key={discardedFood.id}
                initial={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
                animate={{ opacity: 0, y: 150, scale: 0.5, rotate: 180 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5, ease: "easeIn" }}
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-6xl pointer-events-none z-20"
              >
                {FOODS[discardedFood.type].emoji}
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </div>
    </div>
  );
}
