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

