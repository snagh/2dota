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
  // Composição de efeitos — Fase 3
  slowDuration?: number;    // Duração do slow em ms
  slowAmount?: number;      // Percentual de redução de velocidade (0.0-1.0)
  dotDamage?: number;       // Dano por segundo do DoT
  dotDuration?: number;     // Duração do DoT em ms
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
    E: HeroAbility;
    R: HeroAbility;
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
      W: { name: "Unstable Concoction", manaCost: 100, cooldown: 15, damage: 150, range: 500, radius: 30, behavior: "SKILLSHOT", stunDuration: 2.0, color: 0xeab308, description: "Prepara uma poção instável que explode ao atingir um inimigo em linha reta, atordoando-o e causando dano." },
      E: { name: "Greevil's Greed", manaCost: 0, cooldown: 10, damage: 0, range: 0, radius: 0, behavior: "SELF_BUFF", description: "Ativa a ganância de greevil para ganhar ouro adicional e velocidade temporária." },
      R: { name: "Chemical Rage", manaCost: 100, cooldown: 40, damage: 0, range: 0, radius: 0, behavior: "SELF_BUFF", healAmount: 400, speedBoost: 120, description: "Entra em fúria química. Concede regeneração massiva de HP e velocidade de movimento bônus." }
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
      W: { name: "Battle Hunger", manaCost: 85, cooldown: 8, damage: 120, range: 450, radius: 40, behavior: "TARGET_AOE", color: 0xf97316, description: "Enraivece o inimigo com uma sede de batalha, causando dano contínuo e lentidão até que a duração acabe." },
      E: { name: "Counter Helix", manaCost: 0, cooldown: 4, damage: 90, range: 150, radius: 150, behavior: "TARGET_AOE", color: 0xef4444, description: "Contra-ataca com um giro de seu machado quando atacado, causando dano puro a inimigos próximos." },
      R: { name: "Culling Blade", manaCost: 120, cooldown: 30, damage: 350, range: 150, radius: 80, behavior: "TARGET_AOE", color: 0xb91c1c, description: "Desfere um golpe fatal. Se o HP do inimigo estiver abaixo do limiar, ele é executado instantaneamente." }
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
      W: { name: "Quill Spray", manaCost: 40, cooldown: 4, damage: 85, range: 250, radius: 250, behavior: "TARGET_AOE", color: 0xe4e4e7, description: "Dispara uma chuva de espinhos em área. O dano aumenta progressivamente a cada acerto recente no mesmo alvo." },
      E: { name: "Bristleback", manaCost: 0, cooldown: 5, damage: 0, range: 0, radius: 0, behavior: "SELF_BUFF", description: "Ativa sua carcaça calejada, reduzindo passivamente todo o dano recebido pelas costas e flancos." },
      R: { name: "Warpath", manaCost: 50, cooldown: 12, damage: 0, range: 0, radius: 0, behavior: "SELF_BUFF", speedBoost: 80, description: "Entra em caminho de guerra, aumentando a velocidade e o dano de ataque a cada magia conjurada." }
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
      W: { name: "Double Edge", manaCost: 0, cooldown: 5, damage: 200, range: 150, radius: 80, behavior: "TARGET_AOE", color: 0xd97706, description: "Desfere um golpe devastador de curta distância, causando alto dano em área ao custo de uma parte da vida do próprio herói." },
      E: { name: "Retaliate", manaCost: 0, cooldown: 6, damage: 0, range: 0, radius: 0, behavior: "SELF_BUFF", description: "Retalia passivamente contra atacantes, devolvendo dano físico a cada golpe sofrido." },
      R: { name: "Stampede", manaCost: 150, cooldown: 50, damage: 0, range: 0, radius: 0, behavior: "SELF_BUFF", speedBoost: 200, description: "Lidera uma debandada em velocidade máxima, atropelando inimigos e causando lentidão." }
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
      W: { name: "Reality Rift", manaCost: 70, cooldown: 6, damage: 60, range: 500, radius: 0, behavior: "BLINK", blinkDistance: 500, description: "Teletransporta Chaos Knight e o alvo para um ponto médio, reduzindo a armadura do inimigo." },
      E: { name: "Chaos Strike", manaCost: 0, cooldown: 4, damage: 0, range: 0, radius: 0, behavior: "SELF_BUFF", description: "Garante chance de acerto crítico e lifesteal em seu próximo golpe físico." },
      R: { name: "Phantasm", manaCost: 125, cooldown: 40, damage: 0, range: 0, radius: 0, behavior: "SELF_BUFF", description: "Invoca clones (ilusões) de si mesmo para confundir e aniquilar os adversários." }
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
      W: { name: "Power Cogs", manaCost: 80, cooldown: 15, damage: 80, range: 120, radius: 120, behavior: "TARGET_AOE", stunDuration: 1.0, color: 0x9ca3af, description: "Cria uma barreira de engrenagens eletrificadas ao redor, prendendo inimigos e drenando mana." },
      E: { name: "Rocket Flare", manaCost: 50, cooldown: 10, damage: 100, range: 2400, radius: 120, behavior: "TARGET_AOE", color: 0xf59e0b, description: "Dispara um sinalizador global que revela o mapa e explode causando dano na área alvo." },
      R: { name: "Hookshot", manaCost: 120, cooldown: 20, damage: 150, range: 800, radius: 25, behavior: "SKILLSHOT", stunDuration: 1.5, color: 0x9ca3af, description: "Dispara um gancho veloz em linha reta. Se atingir uma unidade, Clockwerk voa até ela, atordoando e danificando todos no trajeto." }
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
      W: { name: "Celestial Hammer", manaCost: 110, cooldown: 11, damage: 80, range: 600, radius: 30, behavior: "SKILLSHOT", color: 0xf59e0b, description: "Arremessa seu martelo criando um rastro de fogo. O martelo pode ser chamado de volta a qualquer momento, danificando os inimigos no caminho." },
      E: { name: "Luminosity", manaCost: 0, cooldown: 6, damage: 0, range: 0, radius: 0, behavior: "SELF_BUFF", healAmount: 100, description: "Carrega cura passiva a cada 4 ataques. O quarto ataque cura aliados próximos e causa crítico." },
      R: { name: "Solar Guardian", manaCost: 150, cooldown: 60, damage: 200, range: 2400, radius: 200, behavior: "TARGET_AOE", stunDuration: 1.8, healAmount: 200, color: 0xeab308, description: "Cria uma pulsação de luz global na área de destino, curando aliados e atordoando inimigos ao aterrissar." }
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
      W: { name: "Scorched Earth", manaCost: 110, cooldown: 15, damage: 30, range: 250, radius: 250, behavior: "SELF_BUFF", speedBoost: 70, description: "Cobre o chão ao seu redor com chamas infernais. Concede velocidade de movimento bônus e causa dano por segundo a inimigos próximos." },
      E: { name: "Infernal Blade", manaCost: 40, cooldown: 4, damage: 80, range: 150, radius: 40, behavior: "TARGET_AOE", stunDuration: 0.6, color: 0xef4444, description: "Corta com sua espada de fogo, atordoando brevemente e queimando o HP máximo do alvo por segundo." },
      R: { name: "Doom", manaCost: 150, cooldown: 50, damage: 300, range: 450, radius: 50, behavior: "TARGET_AOE", color: 0xb91c1c, description: "Aplica uma maldição terrível que impede o inimigo de conjurar magias e causa dano contínuo massivo." }
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
      Q: { name: "Breathe Fire", manaCost: 100, cooldown: 7, damage: 140, range: 500, radius: 60, behavior: "SKILLSHOT", color: 0xf97316, description: "Exala uma rajada de fogo em cone, causando dano mágico e aumentando a letalidade física." },
      W: { name: "Dragon Tail", manaCost: 85, cooldown: 9, damage: 80, range: 150, radius: 80, behavior: "TARGET_AOE", stunDuration: 2.2, color: 0xeab308, description: "Desfere um golpe com seu escudo, atordoando o inimigo de perto e causando dano." },
      E: { name: "Dragon Blood", manaCost: 0, cooldown: 8, damage: 0, range: 0, radius: 0, behavior: "SELF_BUFF", healAmount: 120, description: "Melhora passivamente a regeneração de HP e concede armadura física adicional." },
      R: { name: "Elder Dragon Form", manaCost: 100, cooldown: 60, damage: 0, range: 0, radius: 0, behavior: "SELF_BUFF", speedBoost: 50, description: "Transforma-se em um Dragão lendário, tornando-se Ranged (+200 alcance) com ataque corrosivo." }
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
      W: { name: "Rolling Boulder", manaCost: 70, cooldown: 6, damage: 90, range: 450, radius: 0, behavior: "BLINK", blinkDistance: 450, description: "Transforma-se em uma rocha rolante e avança em velocidade, colidindo com inimigos e parando atrás deles." },
      E: { name: "Geomagnetic Grip", manaCost: 80, cooldown: 12, damage: 100, range: 600, radius: 30, behavior: "SKILLSHOT", stunDuration: 1.0, color: 0x059669, description: "Puxa uma rocha distante em linha reta, silenciando e danificando todos os inimigos atingidos." },
      R: { name: "Magnetize", manaCost: 150, cooldown: 40, damage: 180, range: 300, radius: 300, behavior: "TARGET_AOE", color: 0x10b981, description: "Magnetiza inimigos próximos, causando dano mágico contínuo devastador por 6 segundos." }
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
      Q: { name: "Mana Break", manaCost: 0, cooldown: 2, damage: 45, range: 150, radius: 50, behavior: "TARGET_AOE", description: "Queima a mana do inimigo a cada ataque, convertendo a mana queimada em dano físico." },
      W: { name: "Blink", manaCost: 60, cooldown: 5, damage: 0, range: 500, radius: 0, behavior: "BLINK", blinkDistance: 500, description: "Teletransporta Anti-Mage por uma curta distância dentro do campo de batalha instantaneamente." },
      E: { name: "Counterspell", manaCost: 45, cooldown: 8, damage: 0, range: 0, radius: 0, behavior: "SELF_BUFF", description: "Cria uma barreira mágica que reflete feitiços direcionados de volta para os atacantes por 1.2s." },
      R: { name: "Mana Void", manaCost: 150, cooldown: 45, damage: 300, range: 400, radius: 150, behavior: "TARGET_AOE", color: 0xa855f7, description: "Cria um vácuo eletrostático que causa dano em área com base na mana que falta ao herói atingido." }
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
      W: { name: "Blood Rite", manaCost: 100, cooldown: 12, damage: 130, range: 600, radius: 160, behavior: "TARGET_AOE", color: 0xd97706, description: "Santifica uma área com runas de sangue. Após um atraso, as runas explodem silenciando e danificando inimigos na área." },
      E: { name: "Thirst", manaCost: 0, cooldown: 10, damage: 0, range: 0, radius: 0, behavior: "SELF_BUFF", speedBoost: 120, description: "Sente o HP baixo de inimigos no mapa, ganhando velocidade de movimento passiva proporcional." },
      R: { name: "Rupture", manaCost: 150, cooldown: 50, damage: 250, range: 600, radius: 40, behavior: "TARGET_AOE", color: 0xd97706, description: "Dilacera a pele do inimigo. Causa dano puro proporcional a qualquer distância percorrida pelo alvo." }
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
      W: { name: "Shadow Walk", manaCost: 65, cooldown: 10, damage: 0, range: 0, radius: 0, behavior: "SELF_BUFF", speedBoost: 75, description: "Torna-se invisível temporariamente e concede velocidade bônus, permitindo se posicionar ou fugir." },
      E: { name: "Jinada", manaCost: 0, cooldown: 5, damage: 80, range: 150, radius: 50, behavior: "TARGET_AOE", description: "Rouba ouro confiável do herói inimigo atingido e causa dano físico bônus crítico." },
      R: { name: "Track", manaCost: 60, cooldown: 4, damage: 0, range: 800, radius: 50, behavior: "TARGET_AOE", speedBoost: 100, description: "Rastreia um herói inimigo, revelando sua posição e concedendo velocidade de movimento aliada próxima." }
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
      W: { name: "Spin Web", manaCost: 80, cooldown: 15, damage: 0, range: 0, radius: 0, behavior: "SELF_BUFF", healAmount: 150, speedBoost: 80, description: "Tece uma teia gigante no chão que cura Broodmother e concede velocidade de movimento massiva." },
      E: { name: "Silken Bola", manaCost: 75, cooldown: 8, damage: 70, range: 600, radius: 25, behavior: "SKILLSHOT", description: "Arremessa uma bola de teia sedosa, causando lentidão ao alvo e aumentando o dano físico sofrido." },
      R: { name: "Insatiable Hunger", manaCost: 100, cooldown: 30, damage: 0, range: 0, radius: 0, behavior: "SELF_BUFF", healAmount: 200, description: "Entra em apetite insaciável, ganhando grande bônus de dano físico e 80% de lifesteal nos golpes." }
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
      W: { name: "Tar Bomb", manaCost: 80, cooldown: 6, damage: 70, range: 600, radius: 50, behavior: "SKILLSHOT", color: 0xf97316, description: "Lança uma bomba de piche que causa lentidão aos inimigos e aumenta o dano de flechas de Clinkz." },
      E: { name: "Death Pact", manaCost: 90, cooldown: 15, damage: 0, range: 0, radius: 0, behavior: "SELF_BUFF", healAmount: 300, description: "Consome um creep aliado ou neutro para ganhar HP máximo temporário e dano bônus." },
      R: { name: "Burning Army", manaCost: 150, cooldown: 40, damage: 120, range: 650, radius: 100, behavior: "TARGET_AOE", description: "Invoca uma linha de arqueiros esqueléticos que disparam flechas de fogo lineares nos inimigos." }
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
      W: { name: "Gust", manaCost: 90, cooldown: 13, damage: 60, range: 500, radius: 80, behavior: "SKILLSHOT", color: 0xa5f3fc, description: "Dispara uma forte rajada de vento que empurra inimigos para trás e silencia suas magias por alguns segundos." },
      E: { name: "Multishot", manaCost: 80, cooldown: 10, damage: 140, range: 650, radius: 60, behavior: "SKILLSHOT", description: "Dispara uma rajada contínua de flechas em leque, aplicando lentidão e alto dano físico." },
      R: { name: "Marksmanship", manaCost: 0, cooldown: 15, damage: 0, range: 0, radius: 0, behavior: "SELF_BUFF", description: "Ativa foco perfeito, garantindo chance de ignorar a armadura do alvo e causar dano físico massivo." }
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
      W: { name: "Sleight of Fist", manaCost: 75, cooldown: 6, damage: 110, range: 450, radius: 0, behavior: "BLINK", blinkDistance: 450, description: "Salta em velocidade e ataca todos os inimigos na área selecionada antes de retornar à sua posição original." },
      E: { name: "Flame Guard", manaCost: 90, cooldown: 15, damage: 0, range: 0, radius: 0, behavior: "SELF_BUFF", healAmount: 180, description: "Envolve Ember Spirit em um escudo de chamas que absorve dano mágico e queima inimigos próximos." },
      R: { name: "Fire Remnant", manaCost: 100, cooldown: 20, damage: 150, range: 800, radius: 100, behavior: "BLINK", blinkDistance: 800, description: "Arremessa um clone de fogo. Ember Spirit pode se teletransportar instantaneamente até o clone, danificando quem estiver no caminho." }
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
      W: { name: "Time Dilation", manaCost: 75, cooldown: 12, damage: 50, range: 500, radius: 150, behavior: "TARGET_AOE", description: "Congela o cooldown das habilidades inimigas ativas e causa lentidão proporcional a elas." },
      E: { name: "Time Lock", manaCost: 0, cooldown: 4, damage: 60, range: 150, radius: 50, behavior: "TARGET_AOE", stunDuration: 1.0, description: "Garante chance passiva de congelar o alvo no tempo a cada ataque físico, desferindo dano bônus." },
      R: { name: "Chronosphere", manaCost: 150, cooldown: 55, damage: 50, range: 500, radius: 180, behavior: "TARGET_AOE", stunDuration: 3.5, color: 0x8b5cf6, description: "Cria uma redoma de vácuo temporal. Todas as unidades dentro da redoma ficam congeladas no tempo, exceto Void." }
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
      W: { name: "Homing Missile", manaCost: 120, cooldown: 14, damage: 120, range: 700, radius: 25, behavior: "SKILLSHOT", stunDuration: 1.8, color: 0xef4444, description: "Dispara um míssil teleguiado que persegue o alvo selecionado, atordoando-o e causando dano." },
      E: { name: "Flak Cannon", manaCost: 70, cooldown: 16, damage: 0, range: 0, radius: 0, behavior: "SELF_BUFF", description: "Ativa canhões laterais, fazendo com que seus próximos 5 ataques atinjam todos os inimigos ao redor." },
      R: { name: "Call Down", manaCost: 125, cooldown: 45, damage: 250, range: 800, radius: 250, behavior: "TARGET_AOE", stunDuration: 1.2, description: "Dispara dois mísseis guiados do céu na área alvo, causando dano devastador e lentidão massiva." }
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
      W: { name: "Bushwhack", manaCost: 100, cooldown: 12, damage: 90, range: 550, radius: 120, behavior: "TARGET_AOE", stunDuration: 1.8, color: 0x22c55e, description: "Lança uma rede de caça. Inimigos na área são puxados para árvores próximas e atordoados." },
      E: { name: "Scurry", manaCost: 50, cooldown: 10, damage: 0, range: 0, radius: 0, behavior: "SELF_BUFF", speedBoost: 100, description: "Corre rapidamente com agilidade, atravessando árvores e ganhando bônus de esquiva passiva." },
      R: { name: "Sharpshooter", manaCost: 150, cooldown: 45, damage: 350, range: 1000, radius: 30, behavior: "SKILLSHOT", stunDuration: 2.0, description: "Carrega e dispara um rifle de longo alcance, causando dano estrondoso e quebrando passivas do inimigo." }
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
      W: { name: "Ice Vortex", manaCost: 85, cooldown: 4, damage: 60, range: 700, radius: 140, behavior: "TARGET_AOE", color: 0x60a5fa, description: "Cria um vórtice de gelo no chão que reduz a velocidade de movimento e a resistência mágica dos adversários." },
      E: { name: "Chilling Touch", manaCost: 40, cooldown: 3, damage: 90, range: 650, radius: 20, behavior: "SKILLSHOT", description: "Garante ataque de gelo bônus de longo alcance, causando dano mágico e aplicando lentidão leve." },
      R: { name: "Ice Blast", manaCost: 150, cooldown: 50, damage: 320, range: 2400, radius: 200, behavior: "TARGET_AOE", color: 0x93c5fd, description: "Dispara uma ogiva de gelo global. Inimigos atingidos são impedidos de curar e implodem se HP cair abaixo de 12%." }
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
      W: { name: "Holy Persuasion", manaCost: 100, cooldown: 15, damage: 0, range: 0, radius: 0, behavior: "SELF_BUFF", healAmount: 150, description: "Converte passivamente creeps neutros próximos para lutar ao lado de Chen no Sentinel." },
      E: { name: "Divine Favor", manaCost: 80, cooldown: 12, damage: 0, range: 0, radius: 0, behavior: "SELF_BUFF", healAmount: 100, description: "Cria uma aura passiva que aumenta a cura recebida e regeneração de HP de aliados próximos." },
      R: { name: "Hand of God", manaCost: 200, cooldown: 30, damage: 0, range: 0, radius: 0, behavior: "SELF_BUFF", healAmount: 350, description: "Invoca o poder divino para curar instantaneamente Chen e todos os heróis aliados no mapa." }
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
      W: { name: "Frostbite", manaCost: 125, cooldown: 8, damage: 150, range: 500, radius: 80, behavior: "TARGET_AOE", stunDuration: 2.5, color: 0xbae6fd, description: "Envolve o inimigo em uma prisão de gelo sólido, imobilizando-o e causando dano contínuo." },
      E: { name: "Arcane Aura", manaCost: 0, cooldown: 20, damage: 0, range: 0, radius: 0, behavior: "SELF_BUFF", description: "Regenera mana passivamente para si e todos os heróis aliados no mapa em tempo real." },
      R: { name: "Freezing Field", manaCost: 200, cooldown: 60, damage: 350, range: 300, radius: 300, behavior: "TARGET_AOE", color: 0xbae6fd, description: "Cria uma tempestade de gelo violenta ao redor de Crystal Maiden, causando dano massivo em área." }
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
      W: { name: "Ion Shell", manaCost: 100, cooldown: 9, damage: 120, range: 450, radius: 120, behavior: "TARGET_AOE", description: "Envolve um herói ou creep em um escudo de íons, causando dano por segundo a qualquer inimigo próximo." },
      E: { name: "Surge", manaCost: 50, cooldown: 10, damage: 0, range: 0, radius: 0, behavior: "SELF_BUFF", speedBoost: 150, description: "Energiza um herói aliado, concedendo velocidade de movimento máxima e imunidade a lentidões por tempo limitado." },
      R: { name: "Wall of Replica", manaCost: 150, cooldown: 55, damage: 100, range: 600, radius: 150, behavior: "TARGET_AOE", description: "Cria uma parede de luz translúcida. Inimigos que atravessarem a parede geram clones hostis de si mesmos." }
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
      W: { name: "Shadow Realm", manaCost: 90, cooldown: 12, damage: 130, range: 0, radius: 0, behavior: "SELF_BUFF", speedBoost: 60, description: "Entra no reino das sombras, tornando-se temporariamente intangível e acumulando dano para seu próximo ataque." },
      E: { name: "Cursed Crown", manaCost: 80, cooldown: 15, damage: 90, range: 550, radius: 100, behavior: "TARGET_AOE", stunDuration: 2.0, description: "Conjura uma coroa amaldiçoada sobre o alvo. Após 4 segundos, a coroa detona, atordoando o alvo e vizinhos." },
      R: { name: "Bedlam", manaCost: 120, cooldown: 30, damage: 220, range: 300, radius: 200, behavior: "TARGET_AOE", description: "Invoca sua fada companheira Jex para circular ao redor, desferindo ataques mágicos velozes em área." }
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
      W: { name: "Glimpse", manaCost: 85, cooldown: 12, damage: 0, range: 600, radius: 0, behavior: "BLINK", blinkDistance: 600, description: "Teletransporta o alvo inimigo de volta para a posição onde ele estava 4 segundos atrás." },
      E: { name: "Kinetic Field", manaCost: 90, cooldown: 13, damage: 30, range: 550, radius: 120, behavior: "TARGET_AOE", stunDuration: 2.0, color: 0x1e3a8a, description: "Cria uma barreira circular de energia cinética após um curto atraso, impedindo inimigos de entrar ou sair." },
      R: { name: "Static Storm", manaCost: 150, cooldown: 50, damage: 280, range: 600, radius: 200, behavior: "TARGET_AOE", description: "Conjura uma tempestade estática devastadora que silencia e queima HP de todos na área." }
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
      W: { name: "Untouchable", manaCost: 0, cooldown: 15, damage: 0, range: 0, radius: 0, behavior: "SELF_BUFF", speedBoost: 50, description: "Intocável. Inimigos que tentarem atacar Enchantress fisicamente sofrem penalidade extrema de lentidão de ataque." },
      E: { name: "Nature's Attendants", manaCost: 110, cooldown: 16, damage: 0, range: 0, radius: 0, behavior: "SELF_BUFF", healAmount: 200, description: "Invoca espíritos da floresta que flutuam ao redor de Enchantress, curando-a continuamente." },
      R: { name: "Impetus", manaCost: 60, cooldown: 4, damage: 180, range: 650, radius: 20, behavior: "SKILLSHOT", description: "Carrega seus ataques com energia pura. O dano mágico causado é proporcional à distância percorrida até o alvo." }
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
      W: { name: "Phantom's Embrace", manaCost: 120, cooldown: 15, damage: 120, range: 600, radius: 25, behavior: "SKILLSHOT", stunDuration: 1.5, description: "Envia um fantasma para se agarrar ao inimigo, silenciando-o e causando dano contínuo até ser destruído." },
      E: { name: "Ink Swell", manaCost: 100, cooldown: 14, damage: 80, range: 0, radius: 150, behavior: "SELF_BUFF", stunDuration: 1.5, description: "Cobre um aliado em tinta, aumentando sua velocidade. A tinta explode após 3 segundos atordoando inimigos próximos." },
      R: { name: "Soulbind", manaCost: 150, cooldown: 45, damage: 100, range: 550, radius: 100, behavior: "TARGET_AOE", color: 0x7f1d1d, description: "Vincula o herói inimigo a um aliado próximo. Se qualquer um sofrer uma magia de alvo único, ambos a sofrem." }
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
      W: { name: "Sun Strike", manaCost: 175, cooldown: 16, damage: 250, range: 2400, radius: 80, behavior: "TARGET_AOE", color: 0xf97316, description: "Conjura um raio solar devastador do céu que atinge uma pequena área após 1.7s, causando dano puro altíssimo." },
      E: { name: "Chaos Meteor", manaCost: 150, cooldown: 20, damage: 240, range: 650, radius: 80, behavior: "SKILLSHOT", description: "Lança um meteoro flamejante do céu que rola em linha reta, incinerando todos no caminho." },
      R: { name: "Deafening Blast", manaCost: 100, cooldown: 15, damage: 120, range: 600, radius: 50, behavior: "SKILLSHOT", stunDuration: 1.5, description: "Dispara uma onda sonora que empurra inimigos, causa dano e os desarma (não podem atacar)." }
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
      W: { name: "Ice Path", manaCost: 120, cooldown: 12, damage: 80, range: 600, radius: 30, behavior: "SKILLSHOT", stunDuration: 1.8, color: 0x60a5fa, description: "Cria um trilho de gelo sólido no chão. Qualquer inimigo que encostar no trilho é congelado e atordoado." },
      E: { name: "Liquid Fire", manaCost: 0, cooldown: 8, damage: 90, range: 550, radius: 45, behavior: "SKILLSHOT", description: "Encanta o ataque com fogo líquido, incendiando e aplicando lentidão de ataque a inimigos e torres." },
      R: { name: "Macropyre", manaCost: 180, cooldown: 45, damage: 320, range: 800, radius: 100, behavior: "SKILLSHOT", description: "Jakiro deita uma linha contínua de chamas intensas no chão, causando altíssimo dano por segundo." }
    }
  }
};
