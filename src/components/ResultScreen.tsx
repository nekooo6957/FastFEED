import { motion } from 'motion/react';
import { GameState } from '../types';

interface ResultScreenProps {
  state: GameState;
  onRestart: () => void;
  failReason?: string;
}

export function ResultScreen({ state, onRestart, failReason }: ResultScreenProps) {
  const isWin = !failReason && state.timeLeft > 0;

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm p-6">
      <motion.div 
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={`w-full max-w-sm rounded-3xl p-8 border-4 border-black text-center shadow-[0_0_50px_rgba(0,0,0,0.5)] ${
          isWin ? 'bg-[#00FF00]' : 'bg-white'
        }`}
      >
        <h2 className="text-5xl font-black mb-2 uppercase italic">
          {isWin ? 'VICTORY!' : 'FAILED'}
        </h2>
        
        {failReason && (
          <div className="bg-black text-white p-4 rounded-xl mb-6 font-bold transform rotate-1">
            ☠️ {failReason}
          </div>
        )}

        {!failReason && (
          <div className="mb-6">
            <p className="text-sm font-bold uppercase opacity-70">最终得分</p>
            <p className="text-6xl font-black tracking-tighter">{state.score}</p>
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={onRestart}
            className="w-full py-4 bg-black text-white rounded-xl font-black text-lg uppercase hover:scale-105 transition-transform"
          >
            {isWin ? '下一关 / 再来一局' : '重新挑战'}
          </button>
          
          <button className="w-full py-3 border-2 border-black rounded-xl font-bold uppercase bg-white hover:bg-gray-50">
            分享给 {state.region} 老乡
          </button>
        </div>
      </motion.div>
    </div>
  );
}
