export const GAME_SETTINGS = {
  MAP: {
    WIDTH: 2400,
    HEIGHT: 2400,
    TILE_SIZE: 32,      // Cada célula da grade A* tem 32x32 pixels
  },
  
  PLAYER: {
    RADIUS: 20,
    SPEED: 180,         // Pixels por segundo
    BASE_HP: 600,
    BASE_MP: 250,
  },
  
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
  description: string;
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
      Q: { name: "Acid Spray", manaCost: 120, cooldown: 12, damage: 25, range: 600, radius: 150, behavior: "TARGET_AOE", color: 0x86efac, description: "Dispara uma névoa ácida em uma grande área. Causa dano físico por segundo e reduz a armadura de todos os inimigos sob a névoa." },
      W: { name: "Chemical Rage", manaCost: 100, cooldown: 20, damage: 0, range: 0, radius: 0, behavior: "SELF_BUFF", healAmount: 250, speedBoost: 100, description: "Entra em fúria química. Concede regeneração massiva de HP e velocidade de movimento adicional por tempo limitado." }
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
      Q: { name: "Berserker's Call", manaCost: 110, cooldown: 10, damage: 40, range: 150, radius: 120, behavior: "TARGET_AOE", stunDuration: 2.0, color: 0xef4444, description: "Provoca unidades inimigas ao redor, forçando-as a atacar Axe e paralisando-as temporariamente." },
      W: { name: "Battle Hunger", manaCost: 85, cooldown: 8, damage: 120, range: 450, radius: 40, behavior: "TARGET_AOE", color: 0xf97316, description: "Enraivece o inimigo com uma sede de batalha, causando dano contínuo e lentidão até que a duração acabe." }
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
      Q: { name: "Nasal Goo", manaCost: 30, cooldown: 3, damage: 20, range: 500, radius: 15, behavior: "SKILLSHOT", color: 0xa3e635, description: "Cobre o alvo com meleca nasal, diminuindo sua velocidade de movimento e reduzindo sua armadura." },
      W: { name: "Quill Spray", manaCost: 40, cooldown: 4, damage: 85, range: 250, radius: 250, behavior: "TARGET_AOE", color: 0xe4e4e7, description: "Dispara uma chuva de espinhos em área. O dano aumenta progressivamente a cada acerto recente no mesmo alvo." }
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
      Q: { name: "Hoof Stomp", manaCost: 115, cooldown: 12, damage: 100, range: 100, radius: 150, behavior: "TARGET_AOE", stunDuration: 2.5, color: 0xd97706, description: "Pisa forte no chão, causando dano e atordoando inimigos ao redor por um longo período." },
      W: { name: "Double Edge", manaCost: 0, cooldown: 5, damage: 200, range: 150, radius: 80, behavior: "TARGET_AOE", color: 0xd97706, description: "Desfere um golpe devastador de curta distância, causando alto dano em área ao custo de uma parte da vida do próprio herói." }
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
      Q: { name: "Chaos Bolt", manaCost: 110, cooldown: 10, damage: 150, range: 550, radius: 20, behavior: "SKILLSHOT", stunDuration: 2.0, color: 0xd97706, description: "Lança uma esfera caótica de energia que atordoa e causa dano aleatório ao inimigo atingido." },
      W: { name: "Phantasm", manaCost: 125, cooldown: 18, damage: 0, range: 0, radius: 0, behavior: "SELF_BUFF", healAmount: 180, speedBoost: 60, description: "Invoca ilusões do próprio herói que causam dano total e dividem a atenção dos adversários." }
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
      Q: { name: "Battery Assault", manaCost: 90, cooldown: 12, damage: 95, range: 150, radius: 150, behavior: "TARGET_AOE", stunDuration: 0.5, color: 0xf59e0b, description: "Dispara estilhaços elétricos aleatórios a cada segundo em inimigos próximos, atordoando e causando dano contínuo." },
      W: { name: "Hookshot", manaCost: 120, cooldown: 20, damage: 150, range: 800, radius: 25, behavior: "SKILLSHOT", stunDuration: 1.5, color: 0x9ca3af, description: "Dispara um gancho veloz em linha reta. Se atingir uma unidade, Clockwerk voa até ela, atordoando e danificando todos no trajeto." }
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
      Q: { name: "Starbreaker", manaCost: 100, cooldown: 9, damage: 110, range: 200, radius: 120, behavior: "TARGET_AOE", stunDuration: 1.0, color: 0xfde047, description: "Gira seu martelo três vezes no ar, causando dano a inimigos próximos e atordoando-os com o impacto final." },
      W: { name: "Celestial Hammer", manaCost: 110, cooldown: 11, damage: 80, range: 600, radius: 30, behavior: "SKILLSHOT", color: 0xf59e0b, description: "Arremessa seu martelo criando um rastro de fogo. O martelo pode ser chamado de volta a qualquer momento, danificando os inimigos no caminho." }
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
      Q: { name: "Devour", manaCost: 70, cooldown: 14, damage: 0, range: 0, radius: 0, behavior: "SELF_BUFF", healAmount: 200, description: "Devora uma unidade inimiga ou neutra para digeri-la lentamente, regenerando vida e adquirindo ouro bônus." },
      W: { name: "Scorched Earth", manaCost: 110, cooldown: 15, damage: 30, range: 250, radius: 250, behavior: "SELF_BUFF", speedBoost: 70, description: "Cobre o chão ao seu redor com chamas infernais. Concede velocidade de movimento bônus e causa dano por segundo a inimigos próximos." }
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
      Q: { name: "Breathe Fire", manaCost: 100, cooldown: 7, damage: 140, range: 500, radius: 60, behavior: "SKILLSHOT", color: 0xf97316, description: "Exala uma rajada de fogo em cone, causando dano mágico e reduzindo o poder de ataque físico dos inimigos atingidos." },
      W: { name: "Dragon Tail", manaCost: 85, cooldown: 9, damage: 80, range: 150, radius: 80, behavior: "TARGET_AOE", stunDuration: 2.2, color: 0xeab308, description: "Desfere um golpe com seu escudo, atordoando o inimigo de perto e causando dano." }
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
      Q: { name: "Boulder Smash", manaCost: 100, cooldown: 10, damage: 120, range: 500, radius: 30, behavior: "SKILLSHOT", stunDuration: 1.5, color: 0x10b981, description: "Chuta uma rocha ou inimigo em linha reta, atordoando e causando dano a todos os inimigos atravessados." },
      W: { name: "Rolling Boulder", manaCost: 70, cooldown: 6, damage: 90, range: 450, radius: 0, behavior: "BLINK", blinkDistance: 450, description: "Transforma-se em uma rocha rolante e avança em velocidade, colidindo com inimigos e parando atrás deles." }
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
      Q: { name: "Mana Void", manaCost: 150, cooldown: 15, damage: 180, range: 400, radius: 100, behavior: "TARGET_AOE", color: 0xa855f7, description: "Cria um vácuo eletrostático que causa dano em área com base na mana que falta ao herói atingido." },
      W: { name: "Blink", manaCost: 60, cooldown: 5, damage: 0, range: 500, radius: 0, behavior: "BLINK", blinkDistance: 500, description: "Teletransporta Anti-Mage por uma curta distância dentro do campo de batalha instantaneamente." }
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
      Q: { name: "Bloodrage", manaCost: 80, cooldown: 8, damage: 0, range: 0, radius: 0, behavior: "SELF_BUFF", speedBoost: 90, description: "Entra em fúria de sangue, aumentando drasticamente sua velocidade de ataque ao custo de uma pequena queima de HP." },
      W: { name: "Blood Rite", manaCost: 100, cooldown: 12, damage: 130, range: 600, radius: 160, behavior: "TARGET_AOE", color: 0xd97706, description: "Santifica uma área com runas de sangue. Após um atraso, as runas explodem silenciando e danificando inimigos na área." }
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
      Q: { name: "Shuriken Toss", manaCost: 90, cooldown: 6, damage: 110, range: 650, radius: 15, behavior: "SKILLSHOT", color: 0xeab308, description: "Arremessa uma shuriken afiada que causa dano e ricocheteia entre inimigos." },
      W: { name: "Shadow Walk", manaCost: 65, cooldown: 10, damage: 0, range: 0, radius: 0, behavior: "SELF_BUFF", speedBoost: 75, description: "Torna-se invisível temporariamente e concede velocidade bônus, permitindo se posicionar ou fugir." }
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
      Q: { name: "Spawn Spiderlings", manaCost: 120, cooldown: 10, damage: 130, range: 500, radius: 20, behavior: "SKILLSHOT", color: 0x22c55e, description: "Injeta ovos de aranha no inimigo, causando dano. Se o alvo morrer logo após, pequenas aranhas nascem dele." },
      W: { name: "Spin Web", manaCost: 80, cooldown: 15, damage: 0, range: 0, radius: 0, behavior: "SELF_BUFF", healAmount: 150, speedBoost: 80, description: "Tece uma teia gigante no chão que cura Broodmother e concede velocidade de movimento massiva." }
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
      Q: { name: "Strafe", manaCost: 75, cooldown: 12, damage: 0, range: 0, radius: 0, behavior: "SELF_BUFF", speedBoost: 120, description: "Dispara uma sequência ultrarrápida de flechas de fogo, aumentando temporariamente sua velocidade de ataque de longo alcance." },
      W: { name: "Burning Barrage", manaCost: 90, cooldown: 7, damage: 140, range: 650, radius: 35, behavior: "SKILLSHOT", color: 0xf97316, description: "Canaliza e dispara uma salva contínua de flechas flamejantes em linha reta, atravessando inimigos e causando dano." }
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
      Q: { name: "Frost Arrows", manaCost: 20, cooldown: 2, damage: 45, range: 625, radius: 15, behavior: "SKILLSHOT", color: 0x38bdf8, description: "Encanta suas flechas com gelo ártico, causando dano adicional e aplicando lentidão de movimento ao alvo." },
      W: { name: "Gust", manaCost: 90, cooldown: 13, damage: 60, range: 500, radius: 80, behavior: "SKILLSHOT", color: 0xa5f3fc, description: "Dispara uma forte rajada de vento que empurra inimigos para trás e silencia suas magias por alguns segundos." }
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
      Q: { name: "Searing Chains", manaCost: 110, cooldown: 11, damage: 90, range: 150, radius: 150, behavior: "TARGET_AOE", stunDuration: 2.0, color: 0xf97316, description: "Dispara correntes de fogo que prendem até dois inimigos próximos no chão, imobilizando-os e causando dano." },
      W: { name: "Sleight of Fist", manaCost: 75, cooldown: 6, damage: 110, range: 450, radius: 0, behavior: "BLINK", blinkDistance: 450, description: "Salta em velocidade e ataca todos os inimigos na área selecionada antes de retornar à sua posição original." }
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
      Q: { name: "Time Walk", manaCost: 75, cooldown: 9, damage: 0, range: 450, radius: 0, behavior: "BLINK", blinkDistance: 450, healAmount: 120, description: "Avança no tempo para se teletransportar a uma curta distância, revertendo qualquer dano sofrido nos últimos segundos." },
      W: { name: "Chronosphere", manaCost: 150, cooldown: 25, damage: 50, range: 500, radius: 180, behavior: "TARGET_AOE", stunDuration: 3.0, color: 0x8b5cf6, description: "Cria uma redoma de vácuo temporal. Todas as unidades dentro da redoma ficam congeladas no tempo, exceto Void." }
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
      Q: { name: "Rocket Barrage", manaCost: 90, cooldown: 6, damage: 150, range: 200, radius: 200, behavior: "TARGET_AOE", color: 0xf59e0b, description: "Dispara uma salva de foguetes aéreos a cada fração de segundo em alvos aleatórios ao seu redor." },
      W: { name: "Homing Missile", manaCost: 120, cooldown: 14, damage: 120, range: 700, radius: 25, behavior: "SKILLSHOT", stunDuration: 1.8, color: 0xef4444, description: "Dispara um míssil teleguiado que persegue o alvo selecionado, atordoando-o e causando dano." }
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
      Q: { name: "Acorn Shot", manaCost: 80, cooldown: 8, damage: 100, range: 600, radius: 20, behavior: "SKILLSHOT", color: 0x84cc16, description: "Dispara uma noz mágica em linha reta que causa dano e ricocheteia entre unidades próximas." },
      W: { name: "Bushwhack", manaCost: 100, cooldown: 12, damage: 90, range: 550, radius: 120, behavior: "TARGET_AOE", stunDuration: 1.8, color: 0x22c55e, description: "Lança uma rede de caça. Inimigos na área são puxados para árvores próximas e atordoados." }
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
      Q: { name: "Cold Feet", manaCost: 120, cooldown: 10, damage: 80, range: 600, radius: 80, behavior: "TARGET_AOE", stunDuration: 2.0, color: 0x93c5fd, description: "Congela os pés do inimigo. Causa dano por segundo e, se o alvo não se mover, ele é congelado." },
      W: { name: "Ice Vortex", manaCost: 85, cooldown: 4, damage: 60, range: 700, radius: 140, behavior: "TARGET_AOE", color: 0x60a5fa, description: "Cria um vórtice de gelo no chão que reduz a velocidade de movimento e a resistência mágica dos adversários." }
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
      Q: { name: "Penitence", manaCost: 90, cooldown: 11, damage: 60, range: 600, radius: 20, behavior: "SKILLSHOT", color: 0xfef08a, description: "Reduz a velocidade do alvo e faz com que aliados ganhem velocidade de ataque contra ele." },
      W: { name: "Hand of God", manaCost: 200, cooldown: 30, damage: 0, range: 0, radius: 0, behavior: "SELF_BUFF", healAmount: 300, description: "Invoca o poder divino para curar instantaneamente Chen e todos os heróis aliados no mapa." }
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
      Q: { name: "Crystal Nova", manaCost: 115, cooldown: 9, damage: 110, range: 600, radius: 150, behavior: "TARGET_AOE", color: 0x38bdf8, description: "Cria uma explosão de gelo na área selecionada, causando dano mágico e aplicando lentidão de movimento e ataque." },
      W: { name: "Frostbite", manaCost: 125, cooldown: 8, damage: 150, range: 500, radius: 80, behavior: "TARGET_AOE", stunDuration: 2.5, color: 0xbae6fd, description: "Envolve o inimigo em uma prisão de gelo sólido, imobilizando-o e causando dano contínuo." }
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
      Q: { name: "Vacuum", manaCost: 140, cooldown: 16, damage: 100, range: 500, radius: 160, behavior: "TARGET_AOE", color: 0xa855f7, description: "Cria um vácuo poderoso que puxa todos os inimigos na área selecionada em direção ao centro." },
      W: { name: "Surge", manaCost: 50, cooldown: 10, damage: 0, range: 0, radius: 0, behavior: "SELF_BUFF", speedBoost: 150, description: "Energiza um herói aliado, concedendo velocidade de movimento máxima e imunidade a lentidões por tempo limitado." }
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
      Q: { name: "Bramble Maze", manaCost: 120, cooldown: 14, damage: 80, range: 600, radius: 140, behavior: "TARGET_AOE", stunDuration: 1.5, color: 0x86efac, description: "Cria um labirinto de espinhos na área. Inimigos que tocarem nos espinhos sofrem dano e ficam presos." },
      W: { name: "Shadow Realm", manaCost: 90, cooldown: 12, damage: 130, range: 0, radius: 0, behavior: "SELF_BUFF", speedBoost: 60, description: "Entra no reino das sombras, tornando-se temporariamente intangível e acumulando dano para seu próximo ataque." }
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
      Q: { name: "Thunder Strike", manaCost: 110, cooldown: 10, damage: 140, range: 600, radius: 60, behavior: "TARGET_AOE", color: 0x60a5fa, description: "Atinge o inimigo repetidamente com raios elétricos, causando dano a cada poucos segundos." },
      W: { name: "Kinetic Field", manaCost: 90, cooldown: 13, damage: 30, range: 550, radius: 120, behavior: "TARGET_AOE", stunDuration: 2.0, color: 0x1e3a8a, description: "Cria uma barreira circular de energia cinética após un curto atraso, impedindo inimigos de entrar ou sair." }
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
      Q: { name: "Enchant", manaCost: 70, cooldown: 12, damage: 40, range: 500, radius: 30, behavior: "SKILLSHOT", color: 0x86efac, description: "Encanta um inimigo para aplicar lentidão de movimento ou domina temporariamente uma criatura neutra." },
      W: { name: "Nature's Attendants", manaCost: 110, cooldown: 16, damage: 0, range: 0, radius: 0, behavior: "SELF_BUFF", healAmount: 200, description: "Invoca espíritos da floresta que flutuam ao redor de Enchantress, curando-a continuamente." }
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
      Q: { name: "Stroke of Fate", manaCost: 110, cooldown: 8, damage: 130, range: 700, radius: 45, behavior: "SKILLSHOT", color: 0xef4444, description: "Pinta um rastro de tinta, causando dano e lentidão a todos os inimigos. O dano aumenta para cada inimigo atingido." },
      W: { name: "Soulbind", manaCost: 150, cooldown: 18, damage: 100, range: 550, radius: 100, behavior: "TARGET_AOE", color: 0x7f1d1d, description: "Vincula o herói inimigo a um aliado próximo. Se qualquer um sofrer uma magia de alvo único, ambos a sofrem." }
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
      Q: { name: "EMP", manaCost: 130, cooldown: 14, damage: 120, range: 600, radius: 160, behavior: "TARGET_AOE", color: 0xbae6fd, description: "Gera uma carga eletromagnética que queima a mana dos inimigos na área e causa dano equivalente." },
      W: { name: "Sun Strike", manaCost: 175, cooldown: 16, damage: 250, range: 2400, radius: 80, behavior: "TARGET_AOE", color: 0xf97316, description: "Conjura um raio solar devastador do céu que atinge uma pequena área após 1.7s, causando dano puro altíssimo." }
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
      Q: { name: "Dual Breath", manaCost: 135, cooldown: 10, damage: 140, range: 500, radius: 70, behavior: "SKILLSHOT", color: 0xef4444, description: "Dispara uma onda de fogo e uma de gelo em cone. A de fogo queima inimigos e a de gelo causa lentidão." },
      W: { name: "Ice Path", manaCost: 120, cooldown: 12, damage: 80, range: 600, radius: 30, behavior: "SKILLSHOT", stunDuration: 1.8, color: 0x60a5fa, description: "Cria um trilho de gelo sólido no chão. Qualquer inimigo que encostar no trilho é congelado e atordoado." }
    }
  }
};
