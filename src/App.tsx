import { useState } from 'react';
import { WelcomeScreen } from './components/WelcomeScreen';
import { GameScreen } from './components/GameScreen';
import { ResultScreen } from './components/ResultScreen';
import { GameState } from './types';

export default function App() {
  const [gameState, setGameState] = useState<Partial<GameState>>({
    phase: 'welcome',
    score: 0,
    region: '',
    gender: ''
  });
  const [failReason, setFailReason] = useState<string | undefined>(undefined);

  const handleStart = (region: string, gender: string) => {
    setGameState({
      phase: 'playing',
      score: 0,
      region,
      gender
    });
    setFailReason(undefined);
  };

  const handleGameOver = (finalScore: number, reason?: string) => {
    setGameState(prev => ({ ...prev, phase: 'result', score: finalScore }));
    setFailReason(reason);
  };

  const handleWin = (finalScore: number) => {
    setGameState(prev => ({ ...prev, phase: 'result', score: finalScore }));
    setFailReason(undefined);
  };

  const handleRestart = () => {
    setGameState(prev => ({ ...prev, phase: 'playing', score: 0 }));
    setFailReason(undefined);
  };

  return (
    <div className="w-full h-screen overflow-hidden bg-gray-900">
      {gameState.phase === 'welcome' && (
        <WelcomeScreen onStart={handleStart} />
      )}
      
      {gameState.phase === 'playing' && (
        <GameScreen 
          onGameOver={handleGameOver}
          onWin={handleWin}
        />
      )}

      {gameState.phase === 'result' && (
        <ResultScreen 
          state={gameState as GameState} 
          onRestart={handleRestart}
          failReason={failReason}
        />
      )}
    </div>
  );
}
