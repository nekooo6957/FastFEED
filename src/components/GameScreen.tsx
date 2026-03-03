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
const GRID_ROWS = [40, 60, 80]; // Bottom % (Further away)
const GRID_COLS = [20, 50, 80]; // Left % (Wider)

interface GameScreenProps {
  onGameOver: (score: number, reason?: string) => void;
  onWin: (score: number) => void;
}

export function GameScreen({ onGameOver, onWin }: GameScreenProps) {
  // --- Game State ---
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(LEVEL_CONFIG[0].time);
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
  const [flyingFood, setFlyingFood] = useState<{
    id: string;
    type: FoodType;
    startX: number;
    startY: number;
    targetX: number;
    targetY: number;
    duration: number;
    charge: number; // For rotation speed
  } | null>(null);

  // --- Initialization ---
  useEffect(() => {
    startLevel(1);
  }, []);

  // --- Charge Animation Loop ---
  useEffect(() => {
    if (isCharging) {
      const duration = 2000; // 2 seconds for full cycle
      
      const loop = () => {
        const now = performance.now();
        const elapsed = now - chargeStartTimeRef.current;
        
        // Linear ramp 0 to 100, then wrap around
        const t = (elapsed % duration) / duration; 
        const val = t * 100;
        
        chargeValueRef.current = val;
        
        if (chargeBarRef.current) {
          chargeBarRef.current.style.width = `${val}%`;
        }
        if (chargeCircleRef.current) {
          const offset = 283 - (283 * val) / 100;
          chargeCircleRef.current.style.strokeDashoffset = `${offset}`;
        }
        
        chargeRafRef.current = requestAnimationFrame(loop);
      };
      
      chargeRafRef.current = requestAnimationFrame(loop);
    } else {
      cancelAnimationFrame(chargeRafRef.current);
    }
    
    return () => cancelAnimationFrame(chargeRafRef.current);
  }, [isCharging]);

  const getLevelAllowedFoods = (lvl: number) => {
    const config = LEVEL_CONFIG.find(c => c.level === lvl) || LEVEL_CONFIG[0];
    const allowedFoods = config.types.map(t => ANIMALS[t].preferredFood);
    return Array.from(new Set(allowedFoods));
  };

  const startLevel = (lvl: number) => {
    const config = LEVEL_CONFIG.find(c => c.level === lvl) || LEVEL_CONFIG[0];
    setLevel(lvl);
    setTimeLeft(config.time);
    setCombo(0);
    setShieldActive(false);
    setPowerUpsUsed({ shield: false, magnet: false });
    
    // Generate Grid Slots (0-8)
    const slots = Array.from({ length: 9 }, (_, i) => i);
    // Shuffle slots
    for (let i = slots.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [slots[i], slots[j]] = [slots[j], slots[i]];
    }

    // Spawn animals in slots
    const newAnimals: AnimalEntity[] = [];
    for (let i = 0; i < config.animalCount; i++) {
      const type = random(config.types);
      const slotIndex = slots[i];
      const row = Math.floor(slotIndex / 3);
      const col = slotIndex % 3;
      
      newAnimals.push({
        id: uid(),
        type,
        x: GRID_COLS[col],
        y: GRID_ROWS[row],
        state: 'hungry',
        hungerTimer: 0
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

  // --- Timer ---
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 0) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Check for Time's Up
  useEffect(() => {
    if (timeLeft === 0) {
      onGameOver(score, "Time's Up!");
    }
  }, [timeLeft, onGameOver, score]);

  // --- Interaction Logic ---
  const handlePointerDown = (e: PointerEvent) => {
    if (flyingFood) return;
    
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
    const dy = currentY - startPosRef.current.y;
    
    setDragOffset({ x: dx, y: dy });
  };

  const handlePointerUp = (e: PointerEvent) => {
    if (!isCharging || !startPosRef.current || !gameAreaRef.current) return;
    
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    cancelAnimationFrame(chargeRafRef.current);
    setIsCharging(false);
    
    // Determine Throw Vector
    let angle = -Math.PI / 2; 
    
    if (Math.abs(dragOffset.x) > 10 || Math.abs(dragOffset.y) > 10) {
      angle = Math.atan2(dragOffset.y, dragOffset.x);
    }

    // Distance based on Charge (Calibrated for 5 segments)
    // Max distance in pixels (e.g., 80% of screen height)
    const gameRect = gameAreaRef.current.getBoundingClientRect();
    const maxDistPx = gameRect.height * 0.8;
    
    // Charge 0-100 -> Distance 0-maxDistPx
    const chargeVal = chargeValueRef.current;
    const distPercent = chargeVal / 100;
    const throwDistPx = maxDistPx * distPercent;
    
    // Calculate Target in Pixels
    // Start Pos is already in pixels relative to game area
    const targetPxX = startPosRef.current.x + Math.cos(angle) * throwDistPx;
    const targetPxY = startPosRef.current.y + Math.sin(angle) * throwDistPx;
    
    // Convert to Percentages for rendering
    // Note: Our CSS uses 'left' and 'bottom'. 
    // startPosRef.current.y is from TOP.
    // So bottom% = (height - y) / height * 100
    
    const startXPct = (startPosRef.current.x / gameRect.width) * 100;
    const startYPct = ((gameRect.height - startPosRef.current.y) / gameRect.height) * 100;
    
    const targetXPct = (targetPxX / gameRect.width) * 100;
    const targetYPct = ((gameRect.height - targetPxY) / gameRect.height) * 100;

    // Launch
    const foodToThrow = currentFood;
    setFlyingFood({
      id: uid(),
      type: foodToThrow,
      startX: startXPct,
      startY: startYPct,
      targetX: targetXPct,
      targetY: targetYPct,
      duration: 0.8,
      charge: chargeVal
    });

    // Cycle Food
    const allowedFoods = getLevelAllowedFoods(level);
    const next = nextFoods[0];
    const newQueue = [...nextFoods.slice(1), random(allowedFoods)];
    setCurrentFood(next);
    setNextFoods(newQueue);
    
    // Reset
    chargeValueRef.current = 0;
    setDragOffset({ x: 0, y: 0 });
    startPosRef.current = null;
  };

  // --- Hit Detection ---
  useEffect(() => {
    if (!flyingFood) return;

    const timer = setTimeout(() => {
      checkCollision(flyingFood);
      setFlyingFood(null);
    }, flyingFood.duration * 1000);

    return () => clearTimeout(timer);
  }, [flyingFood]);

  const checkCollision = (food: {type: FoodType, targetX: number, targetY: number}) => {
    let closestAnimal: AnimalEntity | null = null;
    let minDist = 10000;
    const HIT_RADIUS = 15;

    animals.forEach(animal => {
      if (animal.state === 'dead' || animal.state === 'full') return;

      const dx = animal.x - food.targetX;
      const dy = animal.y - food.targetY;
      const dist = Math.sqrt(dx*dx + dy*dy);

      if (dist < HIT_RADIUS) { 
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
        animals.forEach(a => {
           const dist = Math.sqrt(Math.pow(a.x - food.targetX, 2) + Math.pow(a.y - food.targetY, 2));
           if (dist < HIT_RADIUS * 1.5) closeToAny = true;
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
      updateAnimalState(animal.id, 'full');
      setCombo(c => c + 1);
      setScore(s => s + 100 + (combo * 10)); 
      showFeedback(`命中! x${combo + 1}`, animal.x, animal.y);
      
      const remaining = animals.filter(a => a.id !== animal.id && a.state === 'hungry').length;
      if (remaining === 0) {
        setTimeout(() => {
          if (level < 3) {
            startLevel(level + 1);
          } else {
            onWin(score + 100);
          }
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
    setTimeout(() => setFeedback(null), 1000);
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
      // Move to Front Center (Row 0, Col 1)
      setAnimals(prev => prev.map(a => a.id === target.id ? { ...a, y: GRID_ROWS[0], x: GRID_COLS[1] } : a));
      setPowerUpsUsed(p => ({ ...p, magnet: true }));
      showFeedback("Come Here!", 50, 50);
    }
  };

  // --- Render Helpers ---
  const getAnimalStyle = (animal: AnimalEntity) => {
    // Scale based on Row (Y)
    // Front (25%) -> Scale 1.0
    // Mid (50%) -> Scale 0.85
    // Back (75%) -> Scale 0.7
    const scale = 1 - ((animal.y - 25) / 50) * 0.3; 
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
      className="relative w-full h-full bg-[#E4E3E0] overflow-hidden select-none touch-none"
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {/* HUD */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-50 pointer-events-none">
        <div className="bg-white/80 backdrop-blur rounded-xl px-4 py-2 border-2 border-black font-mono font-bold">
          LEVEL {level}
        </div>
        <div className="flex flex-col items-center">
          <div className="text-4xl font-black text-black tracking-tighter">{timeLeft}s</div>
          <div className="w-32 h-2 bg-gray-300 rounded-full mt-1 overflow-hidden border border-black">
            <motion.div 
              className="h-full bg-green-500"
              initial={{ width: '100%' }}
              animate={{ width: `${(timeLeft / (LEVEL_CONFIG.find(c=>c.level===level)?.time || 30)) * 100}%` }}
            />
          </div>
        </div>
        <div className="bg-black text-white rounded-xl px-4 py-2 font-mono font-bold">
          {score} PTS
        </div>
      </div>

      {/* Animals */}
      {animals.map(animal => {
        const config = ANIMALS[animal.type];
        return (
          <div
            key={animal.id}
            className="absolute transition-all duration-500 ease-out"
            style={getAnimalStyle(animal)}
          >
            <div className="relative flex flex-col items-center">
              {/* Status Bubble */}
              {animal.state === 'hungry' && (
                <div className="absolute -top-12 bg-white border-2 border-black rounded-full px-2 py-1 animate-bounce whitespace-nowrap">
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

      {/* Flying Food (3D Parabola) */}
      <AnimatePresence>
        {flyingFood && (
          <motion.div
            key={flyingFood.id}
            initial={{ 
              left: `${flyingFood.startX}%`, 
              bottom: `${flyingFood.startY}%`, 
              scale: 1,
              rotate: 0
            }}
            animate={{ 
              left: `${flyingFood.targetX}%`, 
              bottom: `${flyingFood.targetY}%`, 
              // Scale: Start Small(1) -> Apex Big(1.5) -> Land Small(0.6)
              scale: [1, 1.8, 0.6], 
              rotate: 360 * (1 + flyingFood.charge / 20)
            }}
            transition={{ 
              duration: flyingFood.duration, 
              ease: "easeInOut", // Smooth arc
              times: [0, 0.5, 1] // Apex at 50%
            }}
            className="absolute w-12 h-12 flex items-center justify-center text-4xl z-[200]"
            style={{ transform: 'translate(-50%, 50%)' }}
          >
            {FOODS[flyingFood.type].emoji}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Feedback Text */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 1, y: 0, scale: 0.5 }}
            animate={{ opacity: 0, y: -50, scale: 1.5 }}
            exit={{ opacity: 0 }}
            className="absolute z-[300] font-black text-3xl text-stroke-white text-black pointer-events-none whitespace-nowrap"
            style={{ left: `${feedback.x}%`, bottom: `${feedback.y}%`, transform: 'translate(-50%, 0)' }}
          >
            {feedback.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Power-ups */}
      <div className="absolute bottom-36 left-0 right-0 px-4 flex justify-between pointer-events-auto z-[150]">
        <button 
          className={`p-3 rounded-full shadow-lg border-2 border-black active:scale-95 transition-transform flex items-center gap-2 ${
            powerUpsUsed.shield ? 'bg-gray-400 opacity-50 cursor-not-allowed' : 
            shieldActive ? 'bg-green-500 text-white ring-4 ring-green-300' : 'bg-blue-500 text-white'
          }`}
          onClick={activateShield}
          disabled={powerUpsUsed.shield}
        >
          <span className="text-xl">🛡️</span>
          <span className="text-xs font-bold">{shieldActive ? 'ACTIVE' : '无敌'}</span>
        </button>
        
        <button 
          className={`bg-red-500 text-white p-3 rounded-full shadow-lg border-2 border-black active:scale-95 transition-transform flex items-center gap-2 ${
            powerUpsUsed.magnet ? 'bg-gray-400 opacity-50 cursor-not-allowed' : ''
          }`}
          onClick={activateMagnet}
          disabled={powerUpsUsed.magnet}
        >
          <span className="text-xl">🧲</span>
          <span className="text-xs font-bold">快过来</span>
        </button>
      </div>

      {/* Player Launcher (Bottom) */}
      <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-black/10 to-transparent flex flex-col items-center justify-end pb-16 z-[100] pointer-events-auto">
        
        {/* Current Food (Draggable Visual) */}
        <div 
          className="relative"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
        >
          {/* Guide Arrow / Charge Indicator */}
          {isCharging && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 flex flex-col items-center">
              {/* Charge Bar */}
              <div className="w-16 h-2 bg-gray-300 rounded-full overflow-hidden border border-black mb-2 relative">
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

          <motion.div 
            className={`w-20 h-20 rounded-full border-4 border-black flex items-center justify-center text-4xl shadow-xl cursor-grab active:cursor-grabbing ${FOODS[currentFood].color} ${isCharging ? 'scale-110' : ''}`}
            animate={{
              scale: isCharging ? [1, 1.1, 1] : 1,
            }}
            transition={{ repeat: isCharging ? Infinity : 0, duration: 0.5 }}
          >
            {/* Charge Ring Overlay */}
            <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none">
              <circle
                ref={chargeCircleRef}
                cx="50%" cy="50%" r="45%"
                fill="none"
                stroke="black"
                strokeWidth="4"
                strokeDasharray="283" // 2 * PI * r (approx 45% of 80px width? No, r is relative)
                strokeDashoffset={283}
                opacity={isCharging ? 1 : 0}
                style={{ transition: 'none' }}
              />
            </svg>
            {FOODS[currentFood].emoji}
          </motion.div>
        </div>

        {/* Next Food Queue */}
        <div className="absolute bottom-4 right-4 flex gap-2 pointer-events-none">
          {nextFoods.slice(0, 1).map((f, i) => (
            <div key={i} className={`w-8 h-8 rounded-full border border-black flex items-center justify-center text-sm ${FOODS[f].color} opacity-80`}>
              {FOODS[f].emoji}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
