import { motion, AnimatePresence } from 'motion/react';
import { useState } from 'react';
import { REGIONS } from '../types';

interface WelcomeScreenProps {
  onStart: (region: string, gender: string) => void;
}

export function WelcomeScreen({ onStart }: WelcomeScreenProps) {
  const [selectedRegion, setSelectedRegion] = useState(REGIONS[0]);
  const [gender, setGender] = useState<'male' | 'female'>('male');

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#FF6321] p-6 text-black font-sans">
      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md bg-white rounded-3xl p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] border-2 border-black"
      >
        <h1 className="text-4xl font-black text-center mb-2 tracking-tighter uppercase italic transform -skew-x-6">
          急速投喂
        </h1>
        <h2 className="text-xl font-bold text-center mb-8 text-orange-600">FastFEED</h2>

        <div className="space-y-6">
          {/* Gender Selection */}
          <div>
            <label className="block text-sm font-bold uppercase mb-2">选择身份</label>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setGender('male')}
                className={`p-4 rounded-xl border-2 border-black font-bold transition-all ${
                  gender === 'male' ? 'bg-blue-400 text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] translate-x-[-2px] translate-y-[-2px]' : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                👨 帅哥
              </button>
              <button
                onClick={() => setGender('female')}
                className={`p-4 rounded-xl border-2 border-black font-bold transition-all ${
                  gender === 'female' ? 'bg-pink-400 text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] translate-x-[-2px] translate-y-[-2px]' : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                👩 美女
              </button>
            </div>
          </div>

          {/* Region Selection */}
          <div>
            <label className="block text-sm font-bold uppercase mb-2">选择阵营</label>
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="w-full p-4 rounded-xl border-2 border-black bg-gray-100 font-bold focus:outline-none focus:ring-2 focus:ring-black"
            >
              {REGIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Leaderboard Preview */}
          <div className="bg-yellow-100 rounded-xl p-4 border-2 border-black border-dashed">
            <h3 className="text-xs font-black uppercase mb-2 text-center">🏆 今日榜单 TOP 3</h3>
            <div className="space-y-2 text-sm font-bold">
              <div className="flex justify-between"><span>1. 广东雄狮</span> <span>10,240分</span></div>
              <div className="flex justify-between text-gray-600"><span>2. 湖南巾帼</span> <span>9,860分</span></div>
              <div className="flex justify-between text-gray-600"><span>3. 山东雄狮</span> <span>8,540分</span></div>
            </div>
          </div>

          <button
            onClick={() => onStart(selectedRegion, gender)}
            className="w-full py-5 bg-black text-white rounded-xl font-black text-xl uppercase tracking-widest hover:bg-gray-900 active:scale-95 transition-transform shadow-[0px_10px_20px_rgba(0,0,0,0.2)]"
          >
            开始挑战
          </button>
          
          <div className="text-center">
             <button className="text-xs font-bold underline decoration-2 decoration-black/30 text-black/60">
               看广告 +2秒 (模拟)
             </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
