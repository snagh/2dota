// Constantes globais do jogo MOBA 2D (2D.OTA)

export const GAME_SETTINGS = {
  // Configurações do Mapa 2D
  MAP: {
    WIDTH: 2400,        // Largura total do mapa (eixo X)
    HEIGHT: 2400,       // Altura total do mapa (eixo Y)
    TILE_SIZE: 32,      // Tamanho do Tile
  },

  // Configurações do Herói/Player
  PLAYER: {
    SPEED: 180,         // Velocidade de movimento em pixels por segundo
    RADIUS: 24,         // Raio de colisão física
    BASE_HP: 600,       // Vida inicial
    BASE_MP: 300,       // Mana inicial
  },

  // Monstros Neutros (Creeps do Mato)
  CREEPS: {
    RADIUS: 18,
    SPEED: 100,
    BASE_HP: 250,
    DAMAGE: 15,
    GOLD_AWARD: 40,
    ATTACK_RANGE: 40,
  },

  // Torres de Defesa (Lanes)
  TOWERS: {
    RADIUS: 45,         // Tamanho físico e raio de colisão da torre
    ATTACK_RANGE: 250,  // Distância que a torre ataca intrusos
    DAMAGE: 60,         // Dano da torre
    BASE_HP: 1500,
  },

  // Configurações de Habilidades (Skillshots)
  ABILITIES: {
    Q: {
      NAME: "Flecha Mística",
      COOLDOWN: 4,      // Segundos
      SPEED: 450,       // Pixels por segundo
      RADIUS: 12,       // Raio do projétil
      DAMAGE: 90,
      MANA_COST: 60,
      RANGE: 600,
    },
    W: {
      NAME: "Onda de Fogo",
      COOLDOWN: 6,
      SPEED: 350,
      RADIUS: 20,
      DAMAGE: 120,
      MANA_COST: 80,
      RANGE: 500,
    }
  },

  // Rede (Tickrate e Simulação)
  NETWORK: {
    TICK_RATE: 30,      // Quantidade de atualizações por segundo (30Hz)
    TICK_INTERVAL: 1000 / 30, // ~33.3ms entre atualizações de física
  },
};

// Posições estáticas das Torres (Dota 2D 3 lanes)
// 0,0 é o canto superior esquerdo (Base Iluminados / Sentinel)
// 2400,2400 é o canto inferior direito (Base Temidos / Scourge)
export const TOWER_LOCATIONS = [
  // Sentinel (Base de Baixo/Esquerda)
  { x: 300, y: 2100, team: 1, name: "Torre Sentinel Bot" },
  { x: 1200, y: 1200, team: 1, name: "Torre Sentinel Mid" },
  { x: 2100, y: 300, team: 1, name: "Torre Sentinel Top" },

  // Scourge (Base de Cima/Direita)
  { x: 500, y: 500, team: 2, name: "Torre Scourge Top" },
  { x: 1400, y: 1400, team: 2, name: "Torre Scourge Mid" },
  { x: 1900, y: 1900, team: 2, name: "Torre Scourge Bot" }
];

export type GameMode = 'NORMAL' | 'TURN_BASED';

export const TURN_RULES = {
  MAX_AP: 2,         // Pontos de Ação (PA) por turno
  MAX_MP: 3,         // Pontos de Movimento (PM) por turno
  AP_COST_ABILITY: 1,
  MP_COST_MOVE: 1,   // Custo de 1 PM por célula de grade percorrida
};

export interface HeroAbility {
  name: string;
  manaCost: number;
  cooldown: number;
  damage: number;
  range: number;
  radius: number;
  behavior: 'SKILLSHOT' | 'TARGET_AOE' | 'SELF_BUFF' | 'BLINK';
  color?: number;
  stunDuration?: number;
  healAmount?: number;
  speedBoost?: number;
  blinkDistance?: number;
}

export interface HeroDefinition {
  name: string;
  title: string;
  attribute: 'STR' | 'AGI' | 'INT';
  baseHp: number;
  baseMp: number;
  speed: number;
  isRanged: boolean;
  baseAttackRange: number;
  abilities: {
    Q: HeroAbility;
    W: HeroAbility;
  };
}

export const HERO_CATALOG: Record<string, HeroDefinition> = {
  // RED - STRENGTH
  alchemist: {
    name: "Alchemist",
    title: "Razzil Darkbrew",
    attribute: "STR",
    baseHp: 750,
    baseMp: 200,
    speed: 300,
    isRanged: false,
    baseAttackRange: 60,
    abilities: {
      Q: { name: "Acid Spray", manaCost: 120, cooldown: 12, damage: 25, range: 600, radius: 150, behavior: "TARGET_AOE", color: 0x86efac },
      W: { name: "Chemical Rage", manaCost: 100, cooldown: 20, damage: 0, range: 0, radius: 0, behavior: "SELF_BUFF", healAmount: 250, speedBoost: 100 }
    }
  },
  axe: {
    name: "Axe",
    title: "Mogul Khan",
    attribute: "STR",
    baseHp: 780,
    baseMp: 180,
    speed: 305,
    isRanged: false,
    baseAttackRange: 60,
    abilities: {
      Q: { name: "Berserker's Call", manaCost: 110, cooldown: 10, damage: 40, range: 150, radius: 120, behavior: "TARGET_AOE", stunDuration: 2.0, color: 0xef4444 },
      W: { name: "Battle Hunger", manaCost: 85, cooldown: 8, damage: 120, range: 450, radius: 40, behavior: "TARGET_AOE", color: 0xf97316 }
    }
  },
  bristleback: {
    name: "Bristleback",
    title: "Rigwarl",
    attribute: "STR",
    baseHp: 760,
    baseMp: 210,
    speed: 300,
    isRanged: false,
    baseAttackRange: 60,
    abilities: {
      Q: { name: "Nasal Goo", manaCost: 30, cooldown: 3, damage: 20, range: 500, radius: 15, behavior: "SKILLSHOT", color: 0xa3e635 },
      W: { name: "Quill Spray", manaCost: 40, cooldown: 4, damage: 85, range: 250, radius: 250, behavior: "TARGET_AOE", color: 0xe4e4e7 }
    }
  },
  centaur: {
    name: "Centaur Warrunner",
    title: "Bradwarden",
    attribute: "STR",
    baseHp: 800,
    baseMp: 190,
    speed: 295,
    isRanged: false,
    baseAttackRange: 60,
    abilities: {
      Q: { name: "Hoof Stomp", manaCost: 115, cooldown: 12, damage: 100, range: 100, radius: 150, behavior: "TARGET_AOE", stunDuration: 2.5, color: 0xd97706 },
      W: { name: "Double Edge", manaCost: 0, cooldown: 5, damage: 200, range: 150, radius: 80, behavior: "TARGET_AOE", color: 0xd97706 }
    }
  },
  chaos_knight: {
    name: "Chaos Knight",
    title: "Nessaj",
    attribute: "STR",
    baseHp: 750,
    baseMp: 220,
    speed: 315,
    isRanged: false,
    baseAttackRange: 60,
    abilities: {
      Q: { name: "Chaos Bolt", manaCost: 110, cooldown: 10, damage: 150, range: 550, radius: 20, behavior: "SKILLSHOT", stunDuration: 2.0, color: 0xd97706 },
      W: { name: "Phantasm", manaCost: 125, cooldown: 18, damage: 0, range: 0, radius: 0, behavior: "SELF_BUFF", healAmount: 180, speedBoost: 60 }
    }
  },
  clockwerk: {
    name: "Clockwerk",
    title: "Rattletrap",
    attribute: "STR",
    baseHp: 740,
    baseMp: 200,
    speed: 300,
    isRanged: false,
    baseAttackRange: 60,
    abilities: {
      Q: { name: "Battery Assault", manaCost: 90, cooldown: 12, damage: 95, range: 150, radius: 150, behavior: "TARGET_AOE", stunDuration: 0.5, color: 0xf59e0b },
      W: { name: "Hookshot", manaCost: 120, cooldown: 20, damage: 150, range: 800, radius: 25, behavior: "SKILLSHOT", stunDuration: 1.5, color: 0x9ca3af }
    }
  },
  dawnbreaker: {
    name: "Dawnbreaker",
    title: "Valora",
    attribute: "STR",
    baseHp: 760,
    baseMp: 230,
    speed: 305,
    isRanged: false,
    baseAttackRange: 60,
    abilities: {
      Q: { name: "Starbreaker", manaCost: 100, cooldown: 9, damage: 110, range: 200, radius: 120, behavior: "TARGET_AOE", stunDuration: 1.0, color: 0xfde047 },
      W: { name: "Celestial Hammer", manaCost: 110, cooldown: 11, damage: 80, range: 600, radius: 30, behavior: "SKILLSHOT", color: 0xf59e0b }
    }
  },
  doom: {
    name: "Doom",
    title: "Lucifer",
    attribute: "STR",
    baseHp: 790,
    baseMp: 190,
    speed: 290,
    isRanged: false,
    baseAttackRange: 60,
    abilities: {
      Q: { name: "Devour", manaCost: 70, cooldown: 14, damage: 0, range: 0, radius: 0, behavior: "SELF_BUFF", healAmount: 200 },
      W: { name: "Scorched Earth", manaCost: 110, cooldown: 15, damage: 30, range: 250, radius: 250, behavior: "SELF_BUFF", speedBoost: 70 }
    }
  },
  dragon_knight: {
    name: "Dragon Knight",
    title: "Davion",
    attribute: "STR",
    baseHp: 760,
    baseMp: 220,
    speed: 300,
    isRanged: false,
    baseAttackRange: 60,
    abilities: {
      Q: { name: "Breathe Fire", manaCost: 100, cooldown: 7, damage: 140, range: 500, radius: 60, behavior: "SKILLSHOT", color: 0xf97316 },
      W: { name: "Dragon Tail", manaCost: 85, cooldown: 9, damage: 80, range: 150, radius: 80, behavior: "TARGET_AOE", stunDuration: 2.2, color: 0xeab308 }
    }
  },
  earth_spirit: {
    name: "Earth Spirit",
    title: "Kaolin",
    attribute: "STR",
    baseHp: 740,
    baseMp: 240,
    speed: 295,
    isRanged: false,
    baseAttackRange: 60,
    abilities: {
      Q: { name: "Boulder Smash", manaCost: 100, cooldown: 10, damage: 120, range: 500, radius: 30, behavior: "SKILLSHOT", stunDuration: 1.5, color: 0x10b981 },
      W: { name: "Rolling Boulder", manaCost: 70, cooldown: 6, damage: 90, range: 450, radius: 0, behavior: "BLINK", blinkDistance: 450 }
    }
  },

  // GREEN - AGILITY
  antimage: {
    name: "Anti-Mage",
    title: "Magina",
    attribute: "AGI",
    baseHp: 580,
    baseMp: 240,
    speed: 340,
    isRanged: false,
    baseAttackRange: 60,
    abilities: {
      Q: { name: "Mana Void", manaCost: 150, cooldown: 15, damage: 180, range: 400, radius: 100, behavior: "TARGET_AOE", color: 0xa855f7 },
      W: { name: "Blink", manaCost: 60, cooldown: 5, damage: 0, range: 500, radius: 0, behavior: "BLINK", blinkDistance: 500 }
    }
  },
  bloodseeker: {
    name: "Bloodseeker",
    title: "Strygwyr",
    attribute: "AGI",
    baseHp: 600,
    baseMp: 220,
    speed: 330,
    isRanged: false,
    baseAttackRange: 60,
    abilities: {
      Q: { name: "Bloodrage", manaCost: 80, cooldown: 8, damage: 0, range: 0, radius: 0, behavior: "SELF_BUFF", speedBoost: 90 },
      W: { name: "Blood Rite", manaCost: 100, cooldown: 12, damage: 130, range: 600, radius: 160, behavior: "TARGET_AOE", color: 0xd97706 }
    }
  },
  bounty_hunter: {
    name: "Bounty Hunter",
    title: "Gondar",
    attribute: "AGI",
    baseHp: 560,
    baseMp: 230,
    speed: 335,
    isRanged: false,
    baseAttackRange: 60,
    abilities: {
      Q: { name: "Shuriken Toss", manaCost: 90, cooldown: 6, damage: 110, range: 650, radius: 15, behavior: "SKILLSHOT", color: 0xeab308 },
      W: { name: "Shadow Walk", manaCost: 65, cooldown: 10, damage: 0, range: 0, radius: 0, behavior: "SELF_BUFF", speedBoost: 75 }
    }
  },
  broodmother: {
    name: "Broodmother",
    title: "Black Arachnia",
    attribute: "AGI",
    baseHp: 570,
    baseMp: 250,
    speed: 325,
    isRanged: false,
    baseAttackRange: 60,
    abilities: {
      Q: { name: "Spawn Spiderlings", manaCost: 120, cooldown: 10, damage: 130, range: 500, radius: 20, behavior: "SKILLSHOT", color: 0x22c55e },
      W: { name: "Spin Web", manaCost: 80, cooldown: 15, damage: 0, range: 0, radius: 0, behavior: "SELF_BUFF", healAmount: 150, speedBoost: 80 }
    }
  },
  clinkz: {
    name: "Clinkz",
    title: "Skeletons Fletcher",
    attribute: "AGI",
    baseHp: 540,
    baseMp: 240,
    speed: 320,
    isRanged: true,
    baseAttackRange: 380,
    abilities: {
      Q: { name: "Strafe", manaCost: 75, cooldown: 12, damage: 0, range: 0, radius: 0, behavior: "SELF_BUFF", speedBoost: 120 },
      W: { name: "Burning Barrage", manaCost: 90, cooldown: 7, damage: 140, range: 650, radius: 35, behavior: "SKILLSHOT", color: 0xf97316 }
    }
  },
  drow_ranger: {
    name: "Drow Ranger",
    title: "Traxex",
    attribute: "AGI",
    baseHp: 550,
    baseMp: 230,
    speed: 325,
    isRanged: true,
    baseAttackRange: 380,
    abilities: {
      Q: { name: "Frost Arrows", manaCost: 20, cooldown: 2, damage: 45, range: 625, radius: 15, behavior: "SKILLSHOT", color: 0x38bdf8 },
      W: { name: "Gust", manaCost: 90, cooldown: 13, damage: 60, range: 500, radius: 80, behavior: "SKILLSHOT", color: 0xa5f3fc }
    }
  },
  ember_spirit: {
    name: "Ember Spirit",
    title: "Xin",
    attribute: "AGI",
    baseHp: 580,
    baseMp: 260,
    speed: 330,
    isRanged: false,
    baseAttackRange: 60,
    abilities: {
      Q: { name: "Searing Chains", manaCost: 110, cooldown: 11, damage: 90, range: 150, radius: 150, behavior: "TARGET_AOE", stunDuration: 2.0, color: 0xf97316 },
      W: { name: "Sleight of Fist", manaCost: 75, cooldown: 6, damage: 110, range: 450, radius: 0, behavior: "BLINK", blinkDistance: 450 }
    }
  },
  void: {
    name: "Faceless Void",
    title: "Darkterror",
    attribute: "AGI",
    baseHp: 600,
    baseMp: 210,
    speed: 320,
    isRanged: false,
    baseAttackRange: 60,
    abilities: {
      Q: { name: "Time Walk", manaCost: 75, cooldown: 9, damage: 0, range: 450, radius: 0, behavior: "BLINK", blinkDistance: 450, healAmount: 120 },
      W: { name: "Chronosphere", manaCost: 150, cooldown: 25, damage: 50, range: 500, radius: 180, behavior: "TARGET_AOE", stunDuration: 3.0, color: 0x8b5cf6 }
    }
  },
  gyrocopter: {
    name: "Gyrocopter",
    title: "Aurel Vlaicu",
    attribute: "AGI",
    baseHp: 560,
    baseMp: 250,
    speed: 330,
    isRanged: true,
    baseAttackRange: 300,
    abilities: {
      Q: { name: "Rocket Barrage", manaCost: 90, cooldown: 6, damage: 150, range: 200, radius: 200, behavior: "TARGET_AOE", color: 0xf59e0b },
      W: { name: "Homing Missile", manaCost: 120, cooldown: 14, damage: 120, range: 700, radius: 25, behavior: "SKILLSHOT", stunDuration: 1.8, color: 0xef4444 }
    }
  },
  hoodwink: {
    name: "Hoodwink",
    title: "Sharpshooter",
    attribute: "AGI",
    baseHp: 530,
    baseMp: 260,
    speed: 345,
    isRanged: true,
    baseAttackRange: 350,
    abilities: {
      Q: { name: "Acorn Shot", manaCost: 80, cooldown: 8, damage: 100, range: 600, radius: 20, behavior: "SKILLSHOT", color: 0x84cc16 },
      W: { name: "Bushwhack", manaCost: 100, cooldown: 12, damage: 90, range: 550, radius: 120, behavior: "TARGET_AOE", stunDuration: 1.8, color: 0x22c55e }
    }
  },

  // BLUE - INTELLIGENCE
  ancient_apparition: {
    name: "Ancient Apparition",
    title: "Kaldr",
    attribute: "INT",
    baseHp: 500,
    baseMp: 440,
    speed: 310,
    isRanged: true,
    baseAttackRange: 320,
    abilities: {
      Q: { name: "Cold Feet", manaCost: 120, cooldown: 10, damage: 80, range: 600, radius: 80, behavior: "TARGET_AOE", stunDuration: 2.0, color: 0x93c5fd },
      W: { name: "Ice Vortex", manaCost: 85, cooldown: 4, damage: 60, range: 700, radius: 140, behavior: "TARGET_AOE", color: 0x60a5fa }
    }
  },
  chen: {
    name: "Chen",
    title: "Holy Knight",
    attribute: "INT",
    baseHp: 510,
    baseMp: 460,
    speed: 305,
    isRanged: true,
    baseAttackRange: 320,
    abilities: {
      Q: { name: "Penitence", manaCost: 90, cooldown: 11, damage: 60, range: 600, radius: 20, behavior: "SKILLSHOT", color: 0xfef08a },
      W: { name: "Hand of God", manaCost: 200, cooldown: 30, damage: 0, range: 0, radius: 0, behavior: "SELF_BUFF", healAmount: 300 }
    }
  },
  crystal_maiden: {
    name: "Crystal Maiden",
    title: "Rylai Crestfall",
    attribute: "INT",
    baseHp: 480,
    baseMp: 450,
    speed: 300,
    isRanged: true,
    baseAttackRange: 320,
    abilities: {
      Q: { name: "Crystal Nova", manaCost: 115, cooldown: 9, damage: 110, range: 600, radius: 150, behavior: "TARGET_AOE", color: 0x38bdf8 },
      W: { name: "Frostbite", manaCost: 125, cooldown: 8, damage: 150, range: 500, radius: 80, behavior: "TARGET_AOE", stunDuration: 2.5, color: 0xbae6fd }
    }
  },
  dark_seer: {
    name: "Dark Seer",
    title: "Ish'Kafel",
    attribute: "INT",
    baseHp: 540,
    baseMp: 400,
    speed: 315,
    isRanged: false,
    baseAttackRange: 60,
    abilities: {
      Q: { name: "Vacuum", manaCost: 140, cooldown: 16, damage: 100, range: 500, radius: 160, behavior: "TARGET_AOE", color: 0xa855f7 },
      W: { name: "Surge", manaCost: 50, cooldown: 10, damage: 0, range: 0, radius: 0, behavior: "SELF_BUFF", speedBoost: 150 }
    }
  },
  dark_willow: {
    name: "Dark Willow",
    title: "Mireska Sunbreeze",
    attribute: "INT",
    baseHp: 500,
    baseMp: 430,
    speed: 310,
    isRanged: true,
    baseAttackRange: 320,
    abilities: {
      Q: { name: "Bramble Maze", manaCost: 120, cooldown: 14, damage: 80, range: 600, radius: 140, behavior: "TARGET_AOE", stunDuration: 1.5, color: 0x86efac },
      W: { name: "Shadow Realm", manaCost: 90, cooldown: 12, damage: 130, range: 0, radius: 0, behavior: "SELF_BUFF", speedBoost: 60 }
    }
  },
  disruptor: {
    name: "Disruptor",
    title: "Thrall",
    attribute: "INT",
    baseHp: 520,
    baseMp: 420,
    speed: 310,
    isRanged: true,
    baseAttackRange: 320,
    abilities: {
      Q: { name: "Thunder Strike", manaCost: 110, cooldown: 10, damage: 140, range: 600, radius: 60, behavior: "TARGET_AOE", color: 0x60a5fa },
      W: { name: "Kinetic Field", manaCost: 90, cooldown: 13, damage: 30, range: 550, radius: 120, behavior: "TARGET_AOE", stunDuration: 2.0, color: 0x1e3a8a }
    }
  },
  enchantress: {
    name: "Enchantress",
    title: "Aiushtha",
    attribute: "INT",
    baseHp: 490,
    baseMp: 440,
    speed: 320,
    isRanged: true,
    baseAttackRange: 400,
    abilities: {
      Q: { name: "Enchant", manaCost: 70, cooldown: 12, damage: 40, range: 500, radius: 30, behavior: "SKILLSHOT", color: 0x86efac },
      W: { name: "Nature's Attendants", manaCost: 110, cooldown: 16, damage: 0, range: 0, radius: 0, behavior: "SELF_BUFF", healAmount: 200 }
    }
  },
  grimstroke: {
    name: "Grimstroke",
    title: "Sarosh",
    attribute: "INT",
    baseHp: 510,
    baseMp: 430,
    speed: 310,
    isRanged: true,
    baseAttackRange: 320,
    abilities: {
      Q: { name: "Stroke of Fate", manaCost: 110, cooldown: 8, damage: 130, range: 700, radius: 45, behavior: "SKILLSHOT", color: 0xef4444 },
      W: { name: "Soulbind", manaCost: 150, cooldown: 18, damage: 100, range: 550, radius: 100, behavior: "TARGET_AOE", color: 0x7f1d1d }
    }
  },
  invoker: {
    name: "Invoker",
    title: "Kael",
    attribute: "INT",
    baseHp: 490,
    baseMp: 480,
    speed: 305,
    isRanged: true,
    baseAttackRange: 320,
    abilities: {
      Q: { name: "EMP", manaCost: 130, cooldown: 14, damage: 120, range: 600, radius: 160, behavior: "TARGET_AOE", color: 0xbae6fd },
      W: { name: "Sun Strike", manaCost: 175, cooldown: 16, damage: 250, range: 2400, radius: 80, behavior: "TARGET_AOE", color: 0xf97316 }
    }
  },
  jakiro: {
    name: "Jakiro",
    title: "Pyrexe Resplend",
    attribute: "INT",
    baseHp: 550,
    baseMp: 410,
    speed: 300,
    isRanged: true,
    baseAttackRange: 340,
    abilities: {
      Q: { name: "Dual Breath", manaCost: 135, cooldown: 10, damage: 140, range: 500, radius: 70, behavior: "SKILLSHOT", color: 0xef4444 },
      W: { name: "Ice Path", manaCost: 120, cooldown: 12, damage: 80, range: 600, radius: 30, behavior: "SKILLSHOT", stunDuration: 1.8, color: 0x60a5fa }
    }
  }
};


