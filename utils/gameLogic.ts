


import { ActionType, RoundResult, PlayerState, Faction, ACTION_DETAILS, GameMode } from '../types';

// CYCLE: PEGASUS > ICE > COTTON > PEGASUS
// Action A beats Action B if A's faction beats B's faction
const FACTION_ADVANTAGE: Record<Faction, Faction> = {
  [Faction.PEGASUS]: Faction.ICE,
  [Faction.ICE]: Faction.COTTON,
  [Faction.COTTON]: Faction.PEGASUS,
};

// DEFENSE LOGIC: Which faction does this defense block?
// Rule: A Faction Defense blocks the Faction it beats (Advantageous Defense).
// Pegasus > Ice => Pegasus Defense blocks Ice
// Ice > Cotton => Ice Defense blocks Cotton
// Cotton > Pegasus => Cotton Defense blocks Pegasus
const DEFENSE_TARGETS: Record<Faction, Faction> = {
  [Faction.PEGASUS]: Faction.ICE,
  [Faction.ICE]: Faction.COTTON,
  [Faction.COTTON]: Faction.PEGASUS,
};

const getActionTier = (action: ActionType): number => {
  if (action === ActionType.CHARGE) return -1;
  if (action === ActionType.DEFEND || action.includes('_DEF_')) return 0; // Defenses
  
  // Attacks
  const details = ACTION_DETAILS[action];
  return details.cost; // Cost roughly equals Tier (1, 2, 3)
};

const getActionFaction = (action: ActionType): Faction | null => {
  return ACTION_DETAILS[action].faction || null;
};

// --- Tri-Phase Resolution Logic ---
export const resolveRoundTriPhase = (
  pAction: ActionType,
  aiAction: ActionType
): { result: RoundResult; message: string } => {

  // 1. Exact Clash (Same Move)
  if (pAction === aiAction) {
    if (pAction === ActionType.CHARGE) return { result: RoundResult.CONTINUE, message: "双方都在积攒气势..." };
    return { result: RoundResult.CONTINUE, message: "招式完全相同，互相抵消！" };
  }

  const pTier = getActionTier(pAction);
  const aiTier = getActionTier(aiAction);
  const pFaction = getActionFaction(pAction);
  const aiFaction = getActionFaction(aiAction);

  // 2. Charge Interactions
  if (pAction === ActionType.CHARGE) {
    if (aiTier > 0) return { result: RoundResult.AI_WINS, message: "你在蓄力时被攻击命中！" };
    return { result: RoundResult.CONTINUE, message: "你在蓄力，对手也在防守。" };
  }
  if (aiAction === ActionType.CHARGE) {
    if (pTier > 0) return { result: RoundResult.PLAYER_WINS, message: "对手蓄力时被你击中！" };
    return { result: RoundResult.CONTINUE, message: "对手在蓄力，你在防守。" };
  }

  // 3. Defense Interactions
  const isPDefense = pTier === 0;
  const isAiDefense = aiTier === 0;

  // Player Defending
  if (isPDefense && !isAiDefense) {
    // Basic Defend (If reachable somehow)
    if (pAction === ActionType.DEFEND) {
      if (aiTier === 1) return { result: RoundResult.CONTINUE, message: "普通防御挡住了普通攻击。" };
      return { result: RoundResult.AI_WINS, message: "普通防御挡不住强力攻击！" };
    }
    
    // Elemental Defend
    if (pFaction && aiFaction) {
      // Logic Update: Faction Defense blocks ALL T1 attacks.
      // For T2 and T3, it only blocks if it is the specific counter.
      
      const isCounterDefense = DEFENSE_TARGETS[pFaction] === aiFaction;

      if (aiTier === 1) {
          // Block T1 always
          if (isCounterDefense) {
             return { result: RoundResult.CONTINUE, message: `完美防御！${ACTION_DETAILS[pAction].label}轻松挡下了${ACTION_DETAILS[aiAction].label}。` };
          }
          return { result: RoundResult.CONTINUE, message: `防御成功！${ACTION_DETAILS[pAction].label}勉强挡住了${ACTION_DETAILS[aiAction].label}。` };
      } else {
          // T2+ requires strict counter
          if (isCounterDefense) {
             return { result: RoundResult.CONTINUE, message: `完美防御！${ACTION_DETAILS[pAction].label}化解了${ACTION_DETAILS[aiAction].label}。` };
          }
          return { result: RoundResult.AI_WINS, message: `防御属性错误！${ACTION_DETAILS[pAction].label}无法抵挡T${aiTier}强攻！` };
      }
    }
    // Fallback logic
    return { result: RoundResult.AI_WINS, message: "防御失效。" };
  }

  // AI Defending
  if (!isPDefense && isAiDefense) {
    if (aiAction === ActionType.DEFEND) {
      if (pTier === 1) return { result: RoundResult.CONTINUE, message: "攻击被普通防御挡住了。" };
      return { result: RoundResult.PLAYER_WINS, message: "你的攻击击穿了普通防御！" };
    }
    if (pFaction && aiFaction) {
      const isCounterDefense = DEFENSE_TARGETS[aiFaction] === pFaction;

      if (pTier === 1) {
           if (isCounterDefense) {
               return { result: RoundResult.CONTINUE, message: `攻击无效！对手的${ACTION_DETAILS[aiAction].label}完美克制了你。` };
           }
           return { result: RoundResult.CONTINUE, message: `攻击被挡住！对手的${ACTION_DETAILS[aiAction].label}防住了你的T1攻击。` };
      } else {
           // T2+
           if (isCounterDefense) {
               return { result: RoundResult.CONTINUE, message: `攻击无效！对手的${ACTION_DETAILS[aiAction].label}完美克制了你。` };
           }
           return { result: RoundResult.PLAYER_WINS, message: "对手防御属性错误，被你的强攻穿透！" };
      }
    }
    return { result: RoundResult.PLAYER_WINS, message: "对手防御失效！" };
  }

  // 4. Attack vs Attack (Clash)
  if (pTier > 0 && aiTier > 0) {
    // SPECIAL RULE: Pegasus Punch (T2) vs Ice Arrow (T2)
    // "拼招之王"
    if (pAction === ActionType.PEGASUS_ATK_T2 && aiAction === ActionType.ICE_ATK_T2) {
         return { result: RoundResult.PLAYER_WINS, message: "拼招之王！天马拳直接击碎了冰箭！" };
    }
    if (aiAction === ActionType.PEGASUS_ATK_T2 && pAction === ActionType.ICE_ATK_T2) {
         return { result: RoundResult.AI_WINS, message: "拼招失败！冰箭被天马拳击碎！" };
    }

    // Rule A: Higher Tier wins
    if (pTier > aiTier) return { result: RoundResult.PLAYER_WINS, message: "你的招式威力更胜一筹！" };
    if (aiTier > pTier) return { result: RoundResult.AI_WINS, message: "对手的招式威力更强！" };

    // Rule B: Same Tier -> Check Element
    // Cycle: Pegasus > Ice > Cotton > Pegasus
    if (pFaction && aiFaction) {
        if (FACTION_ADVANTAGE[pFaction] === aiFaction) {
            return { result: RoundResult.PLAYER_WINS, message: "属性压制！你的流派克制对手。" };
        }
        if (FACTION_ADVANTAGE[aiFaction] === pFaction) {
            return { result: RoundResult.AI_WINS, message: "属性压制！你被对手克制了。" };
        }
    }
    
    return { result: RoundResult.CONTINUE, message: "双方势均力敌，平分秋色。" };
  }

  return { result: RoundResult.CONTINUE, message: "互相试探..." };
};

// --- Classic Resolution ---
export const resolveRound = (
  playerAction: ActionType,
  aiAction: ActionType
): { result: RoundResult; message: string } => {
  if (playerAction === aiAction) {
     if (playerAction === ActionType.ATTACK_SMALL || playerAction === ActionType.ATTACK_BIG) {
       return { result: RoundResult.CONTINUE, message: "波与波相撞！互相抵消。" };
     }
     if (playerAction === ActionType.CHARGE) {
       return { result: RoundResult.CONTINUE, message: "双方都在蓄力..." };
     }
     return { result: RoundResult.CONTINUE, message: "僵持不下。" };
  }

  if (playerAction === ActionType.ATTACK_SMALL) {
    if (aiAction === ActionType.CHARGE) return { result: RoundResult.PLAYER_WINS, message: "小波击中了正在蓄力的对手！" };
    if (aiAction === ActionType.DEFEND) return { result: RoundResult.CONTINUE, message: "小波被对手防御住了！" };
    if (aiAction === ActionType.MAGIC_DEFEND) return { result: RoundResult.CONTINUE, message: "小波被对手的魔法防御吸收！" };
    if (aiAction === ActionType.ATTACK_BIG) return { result: RoundResult.AI_WINS, message: "对手的大波压倒了你的小波！" };
  }

  if (playerAction === ActionType.ATTACK_BIG) {
    if (aiAction === ActionType.CHARGE) return { result: RoundResult.PLAYER_WINS, message: "大波吞噬了正在蓄力的对手！" };
    if (aiAction === ActionType.DEFEND) return { result: RoundResult.PLAYER_WINS, message: "大波击穿了对手的普通防御！" };
    if (aiAction === ActionType.ATTACK_SMALL) return { result: RoundResult.PLAYER_WINS, message: "你的大波压倒了对手的小波！" };
    if (aiAction === ActionType.MAGIC_DEFEND) return { result: RoundResult.CONTINUE, message: "大波被对手的魔法防御挡下了！" };
  }

  if (aiAction === ActionType.ATTACK_SMALL) {
    if (playerAction === ActionType.CHARGE) return { result: RoundResult.AI_WINS, message: "你在蓄力时被小波击中！" };
    if (playerAction === ActionType.DEFEND) return { result: RoundResult.CONTINUE, message: "你防御住了小波。" };
    if (playerAction === ActionType.MAGIC_DEFEND) return { result: RoundResult.CONTINUE, message: "魔法防御吸收了小波。" };
  }

  if (aiAction === ActionType.ATTACK_BIG) {
    if (playerAction === ActionType.CHARGE) return { result: RoundResult.AI_WINS, message: "你在蓄力时被大波吞噬！" };
    if (playerAction === ActionType.DEFEND) return { result: RoundResult.AI_WINS, message: "普通防御挡不住大波！" };
    if (playerAction === ActionType.MAGIC_DEFEND) return { result: RoundResult.CONTINUE, message: "你的魔法防御扛住了大波！" };
  }

  return { result: RoundResult.CONTINUE, message: "互相试探..." };
};

export const getAIAction = (aiState: PlayerState, mode: GameMode): ActionType => {
  if (mode === GameMode.CLASSIC) {
    // Classic AI
    const possibleMoves: ActionType[] = [ActionType.CHARGE];
    possibleMoves.push(ActionType.DEFEND);
    if (aiState.energy >= 2) possibleMoves.push(ActionType.MAGIC_DEFEND);
    if (aiState.energy >= 1) possibleMoves.push(ActionType.ATTACK_SMALL);
    if (aiState.energy >= 3) possibleMoves.push(ActionType.ATTACK_BIG);

    if (aiState.energy === 0) return Math.random() > 0.3 ? ActionType.CHARGE : ActionType.DEFEND;
    
    // Weighted random
    const roll = Math.random();
    const attacks = possibleMoves.filter(m => m.includes('ATTACK'));
    if (attacks.length > 0 && roll < 0.5) {
        return attacks[Math.floor(Math.random() * attacks.length)];
    }
    return possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
  } else {
    // Tri-Phase AI
    // 1. Determine Energy Budget
    const energy = aiState.energy;
    
    // 2. Build available move pool
    // NO ORDINARY DEFENSE IN TRI-PHASE
    let options: ActionType[] = [ActionType.CHARGE]; 
    
    // Faction Defenses (always available if 0 energy or needed)
    const defenses = [ActionType.PEGASUS_DEF_ELE, ActionType.ICE_DEF_ELE, ActionType.COTTON_DEF_ELE];

    // Let's make AI random but capable
    const allMoves = Object.keys(ACTION_DETAILS) as ActionType[];
    const validMoves = allMoves.filter(m => {
        // Exclude classic specific moves if in Tri-phase
        if (['MAGIC_DEFEND', 'ATTACK_SMALL', 'ATTACK_BIG', 'DEFEND'].includes(m)) return false;
        
        const cost = ACTION_DETAILS[m].cost;
        const minEnergy = ACTION_DETAILS[m].minEnergy;
        return energy >= minEnergy;
    });

    // If Energy 0: Charge (50%), Faction Defend (50%)
    if (energy === 0) {
        const r = Math.random();
        if (r < 0.5) return ActionType.CHARGE;
        // Pick a random elemental defense
        return defenses[Math.floor(Math.random() * defenses.length)];
    }

    // If Energy > 0: Mix of Attack and Defense
    // Add Defenses to valid moves pool to ensure AI defends sometimes
    validMoves.push(...defenses);
    
    return validMoves[Math.floor(Math.random() * validMoves.length)];
  }
};
