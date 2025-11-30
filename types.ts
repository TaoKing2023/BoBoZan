
export enum GameMode {
  CLASSIC = 'CLASSIC',
  TRI_PHASE = 'TRI_PHASE',
  TUTORIAL = 'TUTORIAL',
  TRI_PHASE_TUTORIAL = 'TRI_PHASE_TUTORIAL',
}

export enum Faction {
  PEGASUS = 'PEGASUS', // Gold/Orange - Beats Ice
  ICE = 'ICE',         // Cyan/Blue - Beats Cotton
  COTTON = 'COTTON',   // Pink/Purple - Beats Pegasus
}

export enum ActionType {
  // Classic Moves
  CHARGE = 'CHARGE',
  DEFEND = 'DEFEND', // Basic Defend (Blocks T1)
  MAGIC_DEFEND = 'MAGIC_DEFEND', // Classic Magic Defend
  ATTACK_SMALL = 'ATTACK_SMALL',
  ATTACK_BIG = 'ATTACK_BIG',

  // Tri-Phase: Pegasus (Gold)
  PEGASUS_ATK_T1 = 'PEGASUS_ATK_T1', // 1 Qi
  PEGASUS_ATK_T2 = 'PEGASUS_ATK_T2', // 2 Qi
  PEGASUS_DEF_ELE = 'PEGASUS_DEF_ELE', // 0 Qi, Blocks Ice
  PEGASUS_ULT = 'PEGASUS_ULT', // 3 Qi

  // Tri-Phase: Ice (Blue)
  ICE_ATK_T1 = 'ICE_ATK_T1', // 1 Qi
  ICE_ATK_T2 = 'ICE_ATK_T2', // 2 Qi
  ICE_DEF_ELE = 'ICE_DEF_ELE', // 0 Qi, Blocks Cotton
  ICE_ULT = 'ICE_ULT', // 3 Qi

  // Tri-Phase: Cotton (Pink)
  COTTON_ATK_T1 = 'COTTON_ATK_T1', // 1 Qi
  COTTON_ATK_T2 = 'COTTON_ATK_T2', // 2 Qi
  COTTON_DEF_ELE = 'COTTON_DEF_ELE', // 0 Qi, Blocks Pegasus
  COTTON_ULT = 'COTTON_ULT', // 3 Qi
}

export enum GameStatus {
  IDLE = 'IDLE',
  PLAYING = 'PLAYING',
  VICTORY = 'VICTORY',
  DEFEAT = 'DEFEAT',
  DRAW = 'DRAW',
}

export enum RoundResult {
  CONTINUE = 'CONTINUE',
  PLAYER_WINS = 'PLAYER_WINS',
  AI_WINS = 'AI_WINS',
  DRAW_GAME = 'DRAW_GAME',
}

export interface PlayerState {
  energy: number;
  lastAction: ActionType | null;
  health: number;
}

export interface LogEntry {
  round: number;
  playerAction: ActionType;
  aiAction: ActionType;
  resultMessage: string;
  result?: RoundResult;
}

export const ACTION_DETAILS: Record<ActionType, { label: string; cost: number; minEnergy: number; description: string; faction?: Faction }> = {
  // Classic
  [ActionType.CHARGE]: { label: '蓄力', cost: 0, minEnergy: 0, description: '积攒1个气。' },
  [ActionType.DEFEND]: { label: '防御', cost: 0, minEnergy: 0, description: '抵挡1消耗的攻击。' },
  [ActionType.MAGIC_DEFEND]: { label: '魔法防御', cost: 2, minEnergy: 2, description: '防御所有攻击。' },
  [ActionType.ATTACK_SMALL]: { label: '小波', cost: 1, minEnergy: 1, description: '克制蓄力。' },
  [ActionType.ATTACK_BIG]: { label: '大波', cost: 3, minEnergy: 3, description: '强力攻击。' },

  // Pegasus
  [ActionType.PEGASUS_ATK_T1]: { label: '天马攻', cost: 1, minEnergy: 1, description: '普通攻击。', faction: Faction.PEGASUS },
  [ActionType.PEGASUS_ATK_T2]: { label: '天马拳', cost: 2, minEnergy: 2, description: '重型攻击。拼招之王，破冰箭。', faction: Faction.PEGASUS },
  [ActionType.PEGASUS_DEF_ELE]: { label: '天马防', cost: 0, minEnergy: 0, description: '防所有T1。克制寒冰(防T2-T3)。', faction: Faction.PEGASUS },
  [ActionType.PEGASUS_ULT]: { label: '天马流星拳', cost: 3, minEnergy: 3, description: '终极攻击。', faction: Faction.PEGASUS },

  // Ice
  [ActionType.ICE_ATK_T1]: { label: '冰攻', cost: 1, minEnergy: 1, description: '普通攻击。', faction: Faction.ICE },
  [ActionType.ICE_ATK_T2]: { label: '冰箭', cost: 2, minEnergy: 2, description: '重型攻击。', faction: Faction.ICE },
  [ActionType.ICE_DEF_ELE]: { label: '冰防', cost: 0, minEnergy: 0, description: '防所有T1。克制绵柔(防T2-T3)。', faction: Faction.ICE },
  [ActionType.ICE_ULT]: { label: '超冰', cost: 3, minEnergy: 3, description: '终极攻击。', faction: Faction.ICE },

  // Cotton
  [ActionType.COTTON_ATK_T1]: { label: '绵攻', cost: 1, minEnergy: 1, description: '普通攻击。', faction: Faction.COTTON },
  [ActionType.COTTON_ATK_T2]: { label: '绵掌', cost: 2, minEnergy: 2, description: '重型攻击。', faction: Faction.COTTON },
  [ActionType.COTTON_DEF_ELE]: { label: '绵防', cost: 0, minEnergy: 0, description: '防所有T1。克制天马(防T2-T3)。', faction: Faction.COTTON },
  [ActionType.COTTON_ULT]: { label: '通心拳', cost: 3, minEnergy: 3, description: '终极攻击。', faction: Faction.COTTON },
};
