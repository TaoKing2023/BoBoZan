



import React, { useState, useEffect, useRef } from 'react';
import { ActionType, GameStatus, PlayerState, RoundResult, LogEntry, ACTION_DETAILS, GameMode, Faction } from './types';
import { resolveRound, resolveRoundTriPhase, getAIAction } from './utils/gameLogic';
import { ActionVisual, EnergyOrb, GameHUD } from './components/Visuals';
import { Controls } from './components/Controls';
import { RotateCcw, Trophy, Skull, Volume2, VolumeX, Zap, Music, Sword, BrainCircuit, Sparkles, GraduationCap, ChevronRight, BookOpen, X } from 'lucide-react';
import confetti from 'canvas-confetti';

const INITIAL_STATE: PlayerState = {
  energy: 1,
  lastAction: null,
  health: 1
};

// Reuse existing assets effectively for new moves
const SOUND_ASSETS = {
  bgm: 'https://codeskulptor-demos.commondatastorage.googleapis.com/GalaxyInvaders/theme_01.mp3',
  charge: 'https://codeskulptor-demos.commondatastorage.googleapis.com/GalaxyInvaders/bonus.wav',
  defend: 'https://codeskulptor-demos.commondatastorage.googleapis.com/pang/pop.mp3',
  magicDefend: 'https://codeskulptor-demos.commondatastorage.googleapis.com/GalaxyInvaders/pause.wav',
  attackSmall: 'https://codeskulptor-demos.commondatastorage.googleapis.com/GalaxyInvaders/player_shoot.wav',
  attackBig: 'https://codeskulptor-demos.commondatastorage.googleapis.com/GalaxyInvaders/explosion_02.wav',
  win: 'https://commondatastorage.googleapis.com/codeskulptor-assets/week7-brrring.m4a',
  // Replaced broken sound with a working explosion sound
  lose: 'https://commondatastorage.googleapis.com/codeskulptor-assets/sounddogs/explosion.mp3'
};

const CLASSIC_TUTORIAL_CONFIG: Record<number, { pEnergy: number, aiEnergy: number, aiAction: ActionType, target: ActionType, text: string }> = {
  1: {
    pEnergy: 0,
    aiEnergy: 0,
    aiAction: ActionType.CHARGE,
    target: ActionType.CHARGE,
    text: "欢迎来到波波攒！在这个游戏里，一切行动都需要【气】。\n先试试积攒能量吧。"
  },
  2: {
    pEnergy: 1,
    aiEnergy: 0,
    aiAction: ActionType.CHARGE,
    target: ActionType.ATTACK_SMALL,
    text: "对手正在蓄力，这是攻击的好机会！\n消耗 1 个气发射【小波】！"
  },
  3: {
    pEnergy: 1,
    aiEnergy: 1,
    aiAction: ActionType.ATTACK_SMALL,
    target: ActionType.DEFEND,
    text: "小心！对手有气，他可能要攻击了。\n快使用【防御】！"
  },
  4: {
    pEnergy: 3,
    aiEnergy: 0,
    aiAction: ActionType.DEFEND,
    target: ActionType.ATTACK_BIG,
    text: "你已经攒够了 3 个气！对手虽然在防御，但【大波】可以击穿它！"
  },
  5: {
    pEnergy: 2,
    aiEnergy: 3,
    aiAction: ActionType.ATTACK_BIG,
    target: ActionType.MAGIC_DEFEND,
    text: "危险！对手要发大波了！普通防御挡不住，快用‘魔法防御’（消耗2气）！"
  }
};

const TRI_PHASE_TUTORIAL_CONFIG: Record<number, { pEnergy: number, aiEnergy: number, aiAction: ActionType, target: ActionType, text: string }> = {
  1: {
    pEnergy: 0,
    aiEnergy: 0,
    aiAction: ActionType.CHARGE,
    target: ActionType.CHARGE,
    text: "欢迎来到武道场！在这里，一切招式都需要‘气’。现在的你手无寸铁，先点击【蓄力】积攒能量吧！"
  },
  2: {
    pEnergy: 1,
    aiEnergy: 1, // Will execute charge
    aiAction: ActionType.CHARGE,
    target: ActionType.PEGASUS_ATK_T1,
    text: "很好！你有1点气了。对手正在贪婪地继续蓄力，趁现在，使用【天马攻】（消耗1气）攻击他！这是最基础的T1攻击。"
  },
  3: {
    pEnergy: 1,
    aiEnergy: 1, 
    aiAction: ActionType.ICE_ATK_T1,
    target: ActionType.PEGASUS_ATK_T1,
    text: "看！对手切换到了【寒冰】流派，并准备发动攻击。\n根据规则：天马 克制 寒冰。\n虽然你们都出T1招式，但属性占优者胜。点击【天马攻】和他对拼！"
  },
  4: {
    pEnergy: 0,
    aiEnergy: 3,
    aiAction: ActionType.COTTON_ULT,
    target: ActionType.ICE_DEF_ELE,
    text: "危险！对手切换到了【绵柔】流派，而且有3点气，即将释放最强的T3奥义！\n普通防御挡不住T3，必须利用属性克制。\n规则是：寒冰 克 绵柔，只有寒冰系的防御能挡下绵柔攻击。\n快切换到寒冰流派，点击蓝色盾牌【冰防】！"
  },
  5: {
    pEnergy: 3,
    aiEnergy: 2,
    aiAction: ActionType.PEGASUS_ATK_T2,
    target: ActionType.PEGASUS_ULT,
    text: "最后一种情况。对手准备出T2必杀，而你已经攒满了3气。\n在绝对的力量面前，属性都不重要。T3 > T2。\n点击最右侧的【天马流星拳】（T3），碾碎他的攻击！"
  }
};

const App: React.FC = () => {
  const [gameMode, setGameMode] = useState<GameMode | null>(null); // Null means selecting mode
  const [gameStatus, setGameStatus] = useState<GameStatus>(GameStatus.IDLE);
  const [playerState, setPlayerState] = useState<PlayerState>(INITIAL_STATE);
  const [aiState, setAiState] = useState<PlayerState>(INITIAL_STATE);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [roundCount, setRoundCount] = useState(1);
  const [showRules, setShowRules] = useState(false);
  const [showMenuTooltip, setShowMenuTooltip] = useState(false);
  const [showRulesTooltip, setShowRulesTooltip] = useState(false);
  
  // Tutorial State
  const [tutorialStep, setTutorialStep] = useState(0);
  const [showTutorialNext, setShowTutorialNext] = useState(false);

  // Volume State
  const [showVolumePanel, setShowVolumePanel] = useState(false);
  const [bgmVolume, setBgmVolume] = useState(0.2); 
  const [sfxVolume, setSfxVolume] = useState(0.8); 

  const bgmRef = useRef<HTMLAudioElement | null>(null);
  const volumePanelRef = useRef<HTMLDivElement>(null);
  const hasShownMenuTooltipRef = useRef(false);
  const hasShownRulesTooltipRef = useRef(false);

  useEffect(() => {
    bgmRef.current = new Audio(SOUND_ASSETS.bgm);
    bgmRef.current.loop = true;
    bgmRef.current.volume = bgmVolume;
    bgmRef.current.load();
    return () => {
      if (bgmRef.current) {
        bgmRef.current.pause();
        bgmRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (bgmRef.current) {
      bgmRef.current.volume = bgmVolume;
      if (gameStatus !== GameStatus.IDLE && bgmVolume > 0 && bgmRef.current.paused) {
          bgmRef.current.play().catch(e => console.log("Auto-resume BGM failed:", e));
      }
    }
  }, [bgmVolume, gameStatus]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (volumePanelRef.current && !volumePanelRef.current.contains(event.target as Node)) {
        setShowVolumePanel(false);
      }
    };

    if (showVolumePanel) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showVolumePanel]);

  // Handle Tutorial Steps Initialization
  useEffect(() => {
    const isTutorial = gameMode === GameMode.TUTORIAL || gameMode === GameMode.TRI_PHASE_TUTORIAL;
    if (isTutorial && tutorialStep > 0 && tutorialStep <= 5) {
        const config = gameMode === GameMode.TUTORIAL ? CLASSIC_TUTORIAL_CONFIG : TRI_PHASE_TUTORIAL_CONFIG;
        const stepConfig = config[tutorialStep];
        setPlayerState({ ...INITIAL_STATE, energy: stepConfig.pEnergy });
        setAiState({ ...INITIAL_STATE, energy: stepConfig.aiEnergy });
        setLogs([]); 
        setShowTutorialNext(false);
    }
  }, [gameMode, tutorialStep]);

  // Handle Menu & Rules Tooltips
  useEffect(() => {
    if (gameStatus === GameStatus.PLAYING && (gameMode === GameMode.CLASSIC || gameMode === GameMode.TRI_PHASE)) {
        const timers: ReturnType<typeof setTimeout>[] = [];
        
        if (!hasShownMenuTooltipRef.current) {
            setShowMenuTooltip(true);
            hasShownMenuTooltipRef.current = true;
            timers.push(setTimeout(() => setShowMenuTooltip(false), 3000));
        }

        if (!hasShownRulesTooltipRef.current) {
            setShowRulesTooltip(true);
            hasShownRulesTooltipRef.current = true;
            timers.push(setTimeout(() => setShowRulesTooltip(false), 3000));
        }

        return () => timers.forEach(t => clearTimeout(t));
    } else {
        setShowMenuTooltip(false);
        setShowRulesTooltip(false);
    }
  }, [gameStatus, gameMode]);

  const playSound = (type: keyof typeof SOUND_ASSETS | string) => {
    if (sfxVolume === 0) return;
    
    // Map new actions to existing sounds
    let assetKey = type;
    if (type.includes('CHARGE')) assetKey = 'charge';
    else if (type.includes('DEF')) assetKey = 'defend';
    else if (type.includes('ULT') || type.includes('BIG')) assetKey = 'attackBig';
    else if (type.includes('ATK')) assetKey = 'attackSmall';

    // Fallback if key not found in asset list
    if (!SOUND_ASSETS[assetKey as keyof typeof SOUND_ASSETS]) assetKey = 'attackSmall';

    const audio = new Audio(SOUND_ASSETS[assetKey as keyof typeof SOUND_ASSETS]);
    audio.volume = Math.min(1, sfxVolume);
    
    audio.play().catch(error => {
        console.error(`Error playing sound ${type}:`, error);
    });
  };

  const startNewGame = (mode: GameMode) => {
    // Start BGM
    if (bgmRef.current && bgmRef.current.paused && bgmVolume > 0) {
      bgmRef.current.play().catch(e => console.log("BGM start failed:", e));
    }

    setGameMode(mode);
    setGameStatus(GameStatus.PLAYING);
    setShowRules(false);
    
    if (mode === GameMode.TUTORIAL || mode === GameMode.TRI_PHASE_TUTORIAL) {
        setTutorialStep(1);
        setShowTutorialNext(false);
    } else {
        setTutorialStep(0);
    }

    setPlayerState(INITIAL_STATE);
    setAiState(INITIAL_STATE);
    setLogs([]);
    setRoundCount(1);
  };

  const nextTutorialStep = () => {
    if (tutorialStep < 5) {
        setTutorialStep(prev => prev + 1);
    } else {
        setGameStatus(GameStatus.VICTORY);
        triggerFireworks();
    }
  };

  const returnToMenu = () => {
      setGameMode(null);
      setGameStatus(GameStatus.IDLE);
      setTutorialStep(0);
  };

  const restartGame = () => {
      if (gameMode) startNewGame(gameMode);
  };

  const triggerFireworks = () => {
    playSound('win');
    confetti({
      particleCount: 150,
      angle: 60,
      spread: 80,
      origin: { x: 0, y: 0.8 }, 
      colors: ['#FCD34D', '#F87171', '#60A5FA', '#34D399'],
      disableForReducedMotion: true,
      zIndex: 100,
    });
    confetti({
      particleCount: 150,
      angle: 120,
      spread: 80,
      origin: { x: 1, y: 0.8 }, 
      colors: ['#FCD34D', '#F87171', '#60A5FA', '#34D399'],
      disableForReducedMotion: true,
      zIndex: 100,
    });
  };

  const executeTurn = (playerAction: ActionType) => {
    if (!gameMode) return;

    playSound(playerAction);

    // 1. AI Action
    let aiAction: ActionType;
    if (gameMode === GameMode.TUTORIAL) {
        aiAction = CLASSIC_TUTORIAL_CONFIG[tutorialStep].aiAction;
    } else if (gameMode === GameMode.TRI_PHASE_TUTORIAL) {
        aiAction = TRI_PHASE_TUTORIAL_CONFIG[tutorialStep].aiAction;
    } else {
        aiAction = getAIAction(aiState, gameMode);
    }

    // 2. Resolve
    // Tutorial uses Classic logic for resolution
    const isTriPhase = gameMode === GameMode.TRI_PHASE || gameMode === GameMode.TRI_PHASE_TUTORIAL;
    const resolution = isTriPhase
        ? resolveRoundTriPhase(playerAction, aiAction)
        : resolveRound(playerAction, aiAction);
    
    const { result, message } = resolution;

    // 3. Update States
    let newPlayerEnergy = playerState.energy - ACTION_DETAILS[playerAction].cost;
    let newAiEnergy = aiState.energy - ACTION_DETAILS[aiAction].cost;

    if (playerAction === ActionType.CHARGE) newPlayerEnergy++;
    if (aiAction === ActionType.CHARGE) newAiEnergy++;

    newPlayerEnergy = Math.max(0, newPlayerEnergy);
    newAiEnergy = Math.max(0, newAiEnergy);

    // 4. Log
    const newLog: LogEntry = {
      round: roundCount,
      playerAction,
      aiAction,
      resultMessage: message,
      result: result
    };

    // 5. Check End (Modified for Tutorial)
    if (gameMode === GameMode.TUTORIAL || gameMode === GameMode.TRI_PHASE_TUTORIAL) {
        setPlayerState({ ...playerState, energy: newPlayerEnergy, lastAction: playerAction });
        setAiState({ ...aiState, energy: newAiEnergy, lastAction: aiAction });
        
        // Special logic for Tutorial Wins
        let tutorialWin = result === RoundResult.PLAYER_WINS;
        // Tri-Phase Tutorial Step 4 is a Defense step, so Continue/Draw is success if defense worked
        if (gameMode === GameMode.TRI_PHASE_TUTORIAL && tutorialStep === 4) {
             if (message.includes("完美防御")) tutorialWin = true;
        }
        
        if (tutorialWin) {
            triggerFireworks();
            newLog.resultMessage += " 挑战成功！";
        } else {
             // For tutorial, if they don't win/succeed as expected, strictly speaking they retry, 
             // but here we just show the result. The button handles flow.
             // If we wanted to force retry we could disable the next button, but simplified flow is better.
        }
        
        setLogs(prev => [newLog, ...prev]);
        setShowTutorialNext(true); // Always wait for user to click next in tutorial
    } else {
        setLogs(prev => [newLog, ...prev]);
        if (result === RoundResult.PLAYER_WINS) {
            setGameStatus(GameStatus.VICTORY);
            triggerFireworks();
        } else if (result === RoundResult.AI_WINS) {
            setGameStatus(GameStatus.DEFEAT);
            playSound('lose');
        } else {
            setPlayerState({ ...playerState, energy: newPlayerEnergy, lastAction: playerAction });
            setAiState({ ...aiState, energy: newAiEnergy, lastAction: aiAction });
            setRoundCount(prev => prev + 1);
        }
    }
  };

  const isGlobalMuted = bgmVolume === 0 && sfxVolume === 0;

  // Helper to get tutorial config
  const getCurrentTutorialConfig = () => {
      if (gameMode === GameMode.TUTORIAL) return CLASSIC_TUTORIAL_CONFIG;
      if (gameMode === GameMode.TRI_PHASE_TUTORIAL) return TRI_PHASE_TUTORIAL_CONFIG;
      return null;
  };
  const tutorialConfig = getCurrentTutorialConfig();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800 select-none overflow-hidden">
      
      {/* Header */}
      <header className="p-4 flex justify-between items-center bg-white shadow-sm z-10 relative">
        <div className="flex items-center gap-2 relative" ref={volumePanelRef}>
           <button 
             onClick={() => setShowVolumePanel(!showVolumePanel)} 
             className="p-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors"
           >
             {isGlobalMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
           </button>

           {showVolumePanel && (
             <div className="absolute top-12 left-0 bg-white rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.1)] p-4 w-60 border border-slate-100 flex flex-col gap-4 animate-in fade-in slide-in-from-top-2 duration-200 z-50">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-slate-600 mb-1">
                    <Music className="w-4 h-4" />
                    <span className="text-xs font-bold">背景音乐</span>
                  </div>
                  <input type="range" min="0" max="1" step="0.05" value={bgmVolume} onChange={(e) => setBgmVolume(parseFloat(e.target.value))} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-purple-500" />
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-slate-600 mb-1">
                    <Zap className="w-4 h-4" />
                    <span className="text-xs font-bold">音效</span>
                  </div>
                  <input type="range" min="0" max="1" step="0.05" value={sfxVolume} onChange={(e) => setSfxVolume(parseFloat(e.target.value))} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                </div>
             </div>
           )}
        </div>

        <div className="relative flex flex-col items-center">
            <h1 onClick={returnToMenu} className="cursor-pointer text-3xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 arcade-font">
              波波攒
            </h1>
            {showMenuTooltip && (
                <div className="absolute top-full mt-2 bg-slate-800 text-white text-xs px-3 py-2 rounded-lg shadow-lg whitespace-nowrap z-50 animate-bounce pointer-events-none">
                   <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45"></div>
                   点击这里切换回主菜单
                </div>
            )}
        </div>
        
        {/* Tutorial/Rules Button - Only visible in-game */}
        <div className="w-10 relative flex flex-col items-center">
            {gameMode && (
                <>
                <button 
                  onClick={() => setShowRules(true)}
                  className="p-2 rounded-full hover:bg-slate-100 text-slate-400 transition-colors"
                  title="游戏说明"
                >
                  <BookOpen className="w-6 h-6" />
                </button>
                {showRulesTooltip && (
                    <div className="absolute top-full mt-2 right-0 bg-slate-800 text-white text-xs px-3 py-2 rounded-lg shadow-lg whitespace-nowrap z-50 animate-bounce pointer-events-none">
                       <div className="absolute -top-1 right-[16px] w-2 h-2 bg-slate-800 rotate-45"></div>
                       点击这里查看规则
                    </div>
                )}
                </>
            )}
        </div>
      </header>

      {/* MODE SELECTION SCREEN */}
      {!gameMode && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 animate-in fade-in duration-500">
           <h2 className="text-2xl font-bold mb-6 text-slate-700">选择游戏模式</h2>
           
           <div className="grid gap-4 w-full max-w-md">
             {/* Classic Group */}
             <div className="space-y-3">
                 <button onClick={() => startNewGame(GameMode.CLASSIC)} className="w-full relative overflow-hidden group bg-white p-5 rounded-3xl shadow-lg border-2 border-slate-100 hover:border-blue-300 transition-all text-left">
                    <div className="absolute right-0 top-0 opacity-5 group-hover:opacity-10 transition-opacity">
                       <Zap className="w-32 h-32 -mr-8 -mt-8 rotate-12" />
                    </div>
                    <h3 className="text-lg font-black text-blue-600 mb-1 flex items-center gap-2">
                        <Zap className="w-5 h-5" /> 经典模式
                    </h3>
                    <p className="text-xs text-slate-500">童年回忆。蓄力、防御、小波、大波。</p>
                 </button>
                 <button onClick={() => startNewGame(GameMode.TUTORIAL)} className="w-full bg-white p-4 rounded-3xl border-2 border-slate-100 shadow-lg hover:border-blue-300 transition-all text-left flex items-center gap-4 group">
                     <div className="bg-blue-50 p-2.5 rounded-2xl group-hover:bg-blue-100 transition-colors"><GraduationCap className="w-6 h-6 text-blue-500"/></div>
                     <span className="text-lg font-bold text-slate-700 group-hover:text-blue-600 transition-colors">经典模式教程</span>
                 </button>
             </div>

             {/* Tri-Phase Group */}
             <div className="space-y-3 mt-2">
                 <button onClick={() => startNewGame(GameMode.TRI_PHASE)} className="w-full relative overflow-hidden group bg-white p-5 rounded-3xl shadow-lg border-2 border-slate-100 hover:border-purple-300 transition-all text-left">
                    <div className="absolute right-0 top-0 opacity-5 group-hover:opacity-10 transition-opacity">
                       <BrainCircuit className="w-32 h-32 -mr-8 -mt-8 rotate-12" />
                    </div>
                    <div className="flex gap-1 mb-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                        <span className="w-1.5 h-1.5 rounded-full bg-pink-400"></span>
                    </div>
                    <h3 className="text-lg font-black text-purple-600 mb-1 flex items-center gap-2">
                        <Sparkles className="w-5 h-5" /> 三相演武
                    </h3>
                    <p className="text-xs text-slate-500">进阶玩法。天马、寒冰、绵柔三系克制。</p>
                 </button>
                 <button onClick={() => startNewGame(GameMode.TRI_PHASE_TUTORIAL)} className="w-full bg-white p-4 rounded-3xl border-2 border-slate-100 shadow-lg hover:border-purple-300 transition-all text-left flex items-center gap-4 group">
                     <div className="bg-purple-50 p-2.5 rounded-2xl group-hover:bg-purple-100 transition-colors"><BrainCircuit className="w-6 h-6 text-purple-500"/></div>
                     <span className="text-lg font-bold text-slate-700 group-hover:text-purple-600 transition-colors">三相演武教程 (新手推荐)</span>
                 </button>
             </div>

           </div>
        </div>
      )}

      {/* Main Game Area */}
      {gameMode && (
        <main className="flex-1 flex flex-col max-w-lg mx-auto w-full relative">
          {/* Game Area Content */}
          <div className="flex-1 flex flex-col justify-between py-6 relative z-0">
            
            {/* HUD for Tri-Phase */}
            <GameHUD mode={gameMode === GameMode.TRI_PHASE_TUTORIAL ? GameMode.TRI_PHASE : gameMode} />
            
            {/* Opponent Area */}
            <div className="flex flex-col items-center justify-center transition-all duration-500">
              <ActionVisual action={gameStatus === GameStatus.PLAYING ? (logs[0]?.aiAction || aiState.lastAction) : null} isPlayer={false} />
              <div className="mt-4">
                <span className="text-xs font-bold text-rose-500 tracking-wider mb-1 block text-center uppercase">
                    {(gameMode === GameMode.TUTORIAL || gameMode === GameMode.TRI_PHASE_TUTORIAL) ? "AI 教练" : "对手"}
                </span>
                <EnergyOrb count={aiState.energy} isPlayer={false} />
              </div>
            </div>

            {/* Center Status / Log / Tutorial Instruction */}
            <div className="flex flex-col items-center justify-center px-6 py-2 my-4 relative">
               {/* Tutorial Result Next Button */}
               {(gameMode === GameMode.TUTORIAL || gameMode === GameMode.TRI_PHASE_TUTORIAL) && showTutorialNext && (
                   <div className="absolute z-50 -bottom-16">
                       <button onClick={nextTutorialStep} className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-8 rounded-full shadow-lg animate-bounce flex items-center gap-2">
                           {tutorialStep === 5 ? "完成教程" : "下一步"} <ChevronRight className="w-5 h-5" />
                       </button>
                   </div>
               )}

               {logs.length > 0 ? (
                 <div className={`bg-white/90 backdrop-blur-sm shadow-xl rounded-2xl p-6 text-center max-w-sm transform transition-all animate-in fade-in zoom-in duration-300 ${
                     logs[0].result === RoundResult.PLAYER_WINS || (gameMode === GameMode.TRI_PHASE_TUTORIAL && tutorialStep === 4 && logs[0].resultMessage.includes('完美防御')) || logs[0].resultMessage.includes('完美防御') || logs[0].resultMessage.includes('防御成功') ? 'border-4 border-blue-500 shadow-blue-200' : 'border border-slate-100'
                 }`}>
                    <p className="text-xl font-bold text-slate-800 arcade-font leading-relaxed">{logs[0].resultMessage}</p>
                    {!(gameMode === GameMode.TUTORIAL || gameMode === GameMode.TRI_PHASE_TUTORIAL) && <p className="text-xs text-slate-400 mt-3 font-mono">第 {logs[0].round} 回合</p>}
                 </div>
               ) : (
                 <div className="bg-white/80 backdrop-blur-sm shadow-lg rounded-2xl p-6 border border-slate-100 text-center">
                   <p className="text-lg font-bold text-slate-600 arcade-font">
                       {gameStatus === GameStatus.IDLE ? "准备就绪" : "互相试探..."}
                   </p>
                 </div>
               )}
            </div>

            {/* Player Area */}
            <div className="flex flex-col items-center justify-center transition-all duration-500 mb-4">
              <div className="mb-4">
                 <span className="text-xs font-bold text-blue-600 tracking-wider mb-1 block text-center uppercase">你</span>
                 <EnergyOrb count={playerState.energy} isPlayer={true} />
              </div>
              <ActionVisual action={playerState.lastAction} isPlayer={true} />
            </div>

          </div>

          {/* Controls */}
          <div className="bg-white/50 backdrop-blur-md pt-2 relative">
              {/* Tutorial Bubble */}
              {(gameMode === GameMode.TUTORIAL || gameMode === GameMode.TRI_PHASE_TUTORIAL) && !showTutorialNext && tutorialStep > 0 && tutorialConfig && (
                  <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-72 z-40">
                      <div className="bg-slate-800 text-white p-4 rounded-2xl shadow-xl relative animate-in slide-in-from-bottom-4 fade-in duration-300 border-2 border-white/20">
                          <p className="text-xs leading-relaxed text-center font-medium whitespace-pre-line">
                            {tutorialConfig[tutorialStep].text}
                          </p>
                          {/* Triangle pointer */}
                          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-slate-800 rotate-45 border-b-2 border-r-2 border-white/20"></div>
                      </div>
                  </div>
              )}

              <Controls 
                energy={playerState.energy} 
                onAction={executeTurn} 
                disabled={gameStatus !== GameStatus.PLAYING || ((gameMode === GameMode.TUTORIAL || gameMode === GameMode.TRI_PHASE_TUTORIAL) && showTutorialNext)} 
                gameMode={gameMode}
                highlightAction={(gameMode === GameMode.TUTORIAL || gameMode === GameMode.TRI_PHASE_TUTORIAL) && !showTutorialNext && tutorialConfig ? tutorialConfig[tutorialStep].target : null}
              />
          </div>

          {/* VICTORY / DEFEAT SCREENS */}
          {(gameStatus === GameStatus.VICTORY || gameStatus === GameStatus.DEFEAT) && (
            <div className="absolute inset-0 z-50 bg-white/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-500">
                <div className={`bg-white rounded-3xl shadow-2xl p-8 max-w-xs w-full text-center border-4 ${gameStatus === GameStatus.VICTORY ? 'border-yellow-200' : 'border-red-100'}`}>
                {gameStatus === GameStatus.VICTORY ? (
                    <Trophy className="w-24 h-24 text-yellow-500 mx-auto mb-4 animate-bounce" />
                ) : (
                    <Skull className="w-24 h-24 text-red-500 mx-auto mb-4 animate-pulse" />
                )}
                <h2 className={`text-4xl font-black mb-2 arcade-font ${gameStatus === GameStatus.VICTORY ? 'text-yellow-500' : 'text-red-500'}`}>
                    {gameStatus === GameStatus.VICTORY ? '胜利！' : '失败'}
                </h2>
                <p className="text-slate-600 mb-8 font-medium">
                    {(gameMode === GameMode.TUTORIAL || gameMode === GameMode.TRI_PHASE_TUTORIAL)
                        ? '恭喜你完成了新手教程！现在你已经准备好进行真正的对决了。'
                        : (gameStatus === GameStatus.VICTORY 
                            ? '你智取了对手。' 
                            : (logs[0]?.resultMessage || '胜败乃兵家常事。')
                          )
                    }
                </p>
                <div className="flex flex-col gap-3">
                    <button 
                        onClick={restartGame}
                        className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                        <RotateCcw className="w-5 h-5" />
                        {(gameMode === GameMode.TUTORIAL || gameMode === GameMode.TRI_PHASE_TUTORIAL) ? '再学一次' : '再来一局'}
                    </button>
                    <button 
                        onClick={returnToMenu}
                        className="w-full bg-white text-slate-500 border-2 border-slate-100 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-50 hover:text-slate-700 transition-all"
                    >
                        返回主菜单
                    </button>
                </div>
                </div>
            </div>
          )}

          {/* Rules Modal */}
          {showRules && (
            <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setShowRules(false)}>
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-blue-500" />
                    游戏说明
                  </h3>
                  <button onClick={() => setShowRules(false)} className="p-1 hover:bg-slate-100 rounded-full">
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>
                
                <div className="p-6 space-y-6">
                  {(gameMode === GameMode.TRI_PHASE || gameMode === GameMode.TRI_PHASE_TUTORIAL) ? (
                    <>
                      <section>
                        <h4 className="font-bold text-slate-700 mb-2 flex items-center gap-2"><Sparkles className="w-4 h-4 text-purple-500"/> 属性克制</h4>
                        <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
                          <span className="text-amber-500 font-bold">天马</span> 克 <span className="text-cyan-500 font-bold">寒冰</span><br/>
                          <span className="text-cyan-500 font-bold">寒冰</span> 克 <span className="text-pink-500 font-bold">绵柔</span><br/>
                          <span className="text-pink-500 font-bold">绵柔</span> 克 <span className="text-amber-500 font-bold">天马</span>
                        </p>
                      </section>
                      <section>
                         <h4 className="font-bold text-slate-700 mb-2">防御规则</h4>
                         <ul className="text-sm text-slate-600 space-y-1 list-disc pl-4">
                            <li><span className="font-bold">属性防御</span>：0消耗。可防御所有T1攻击。但对于T2及以上的强力攻击，只有属性克制的防御才能抵挡。</li>
                         </ul>
                      </section>
                      <section>
                         <h4 className="font-bold text-slate-700 mb-2">拼招规则</h4>
                         <ul className="text-sm text-slate-600 space-y-1 list-disc pl-4">
                            <li>威力大者胜 (T3 &gt; T2 &gt; T1)。</li>
                            <li>威力相同看属性克制。</li>
                            <li>完全相同则抵消。</li>
                            <li><span className="font-bold text-amber-500">特殊</span>：天马拳(T2) 直接击碎 冰箭(T2)。</li>
                         </ul>
                      </section>
                    </>
                  ) : (
                    <>
                      <section>
                        <h4 className="font-bold text-slate-700 mb-2 flex items-center gap-2"><Zap className="w-4 h-4 text-blue-500"/> 基础规则</h4>
                        <div className="grid grid-cols-1 gap-3 text-sm">
                           <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                             <div className="font-bold text-blue-600 mb-1">蓄力 (0气)</div>
                             <div className="text-slate-600">积攒1个气。被攻击会直接受到伤害。</div>
                           </div>
                           <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                             <div className="font-bold text-slate-600 mb-1">防御 (0气)</div>
                             <div className="text-slate-600">可以防御【小波】。无法防御【大波】。</div>
                           </div>
                           <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                             <div className="font-bold text-cyan-600 mb-1">小波 (1气)</div>
                             <div className="text-slate-600">攻击蓄力中的对手。被防御挡住无效。</div>
                           </div>
                           <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                             <div className="font-bold text-purple-600 mb-1">魔法防御 (2气)</div>
                             <div className="text-slate-600">绝对防御。可以挡下小波和大波。</div>
                           </div>
                           <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                             <div className="font-bold text-red-600 mb-1">大波 (3气)</div>
                             <div className="text-slate-600">强力攻击。可以击穿【防御】。</div>
                           </div>
                        </div>
                      </section>
                    </>
                  )}
                </div>
                
                <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
                   <button onClick={() => setShowRules(false)} className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors">
                      明白了
                   </button>
                </div>
              </div>
            </div>
          )}

        </main>
      )}
    </div>
  );
};

export default App;
