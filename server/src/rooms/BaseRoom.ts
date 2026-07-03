import { Server } from 'socket.io';
import { 
  GAME_SETTINGS, 
  TOWER_LOCATIONS, 
  type Vector2D, 
  type SkillshotProjectile 
} from 'shared';

export interface ServerPlayer {
  id: string;
  username: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  hp: number;
  maxHp: number;
  mp: number; // Mana (Dota style)
  maxMp: number;
  team: number; // 1 = Sentinel, 2 = Scourge
  cooldowns: {
    Q: number;
    W: number;
  };
  kills: number;
  deaths: number;
  path: Vector2D[];
  
  // Atributos de Turno (PA e PM)
  ap: number; // Action Points (Pontos de Ação)
  maxAp: number;
  mpPoints: number; // Movement Points (Pontos de Movimento)
  maxMpPoints: number;
}

export interface ServerCreep {
  id: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  hp: number;
  maxHp: number;
  team: number; // 0 = Neutro, 1 = Sentinel, 2 = Scourge
  radius: number;
}

export interface ServerTower {
  id: string;
  name: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  team: number;
  lastShotTime: number;
}

export abstract class BaseRoom {
  protected io: Server;
  public roomName: string;
  
  public players: Map<string, ServerPlayer> = new Map();
  public creeps: Map<string, ServerCreep> = new Map();
  public towers: ServerTower[] = [];
  public projectiles: Map<string, SkillshotProjectile> = new Map();
  
  protected creepIdCounter = 0;
  protected projectileIdCounter = 0;

  constructor(io: Server, roomName: string) {
    this.io = io;
    this.roomName = roomName;
    this.initializeTowers();
    this.spawnInitialCreeps();
  }

  /**
   * Inicializa as torres estáticas baseadas na topologia do mapa
   */
  protected initializeTowers() {
    this.towers = TOWER_LOCATIONS.map((loc, idx) => ({
      id: `${this.roomName}_tower_${idx}`,
      name: loc.name,
      x: loc.x,
      y: loc.y,
      hp: GAME_SETTINGS.TOWERS.BASE_HP,
      maxHp: GAME_SETTINGS.TOWERS.BASE_HP,
      team: loc.team,
      lastShotTime: 0
    }));
  }

  /**
   * Spawna monstros neutros na selva
   */
  protected spawnInitialCreeps() {
    const camps = [
      { x: 800, y: 700 },
      { x: 1600, y: 1700 },
      { x: 600, y: 1400 },
      { x: 1800, y: 1000 }
    ];

    camps.forEach((camp) => {
      for (let i = 0; i < 3; i++) {
        const id = `${this.roomName}_creep_${this.creepIdCounter++}`;
        const offsetAngle = (i * Math.PI * 2) / 3;
        const offsetDist = 35;
        const creepX = camp.x + Math.cos(offsetAngle) * offsetDist;
        const creepY = camp.y + Math.sin(offsetAngle) * offsetDist;

        this.creeps.set(id, {
          id,
          x: creepX,
          y: creepY,
          targetX: creepX,
          targetY: creepY,
          hp: GAME_SETTINGS.CREEPS.BASE_HP,
          maxHp: GAME_SETTINGS.CREEPS.BASE_HP,
          team: 0, // Neutro
          radius: GAME_SETTINGS.CREEPS.RADIUS
        });
      }
    });
  }

  /**
   * Adiciona um novo jogador ao mapa da sala
   */
  public addPlayer(id: string, username: string): ServerPlayer {
    const team1Count = Array.from(this.players.values()).filter(p => p.team === 1).length;
    const team2Count = Array.from(this.players.values()).filter(p => p.team === 2).length;
    const team = team1Count <= team2Count ? 1 : 2;

    const spawnX = team === 1 ? 150 : 2250;
    const spawnY = team === 1 ? 2250 : 150;

    const newPlayer: ServerPlayer = {
      id,
      username: username || `Heroi_${id.substring(0, 4)}`,
      x: spawnX,
      y: spawnY,
      targetX: spawnX,
      targetY: spawnY,
      hp: GAME_SETTINGS.PLAYER.BASE_HP,
      maxHp: GAME_SETTINGS.PLAYER.BASE_HP,
      mp: GAME_SETTINGS.PLAYER.BASE_MP,
      maxMp: GAME_SETTINGS.PLAYER.BASE_MP,
      team,
      cooldowns: { Q: 0, W: 0 },
      kills: 0,
      deaths: 0,
      path: [],
      // Atributos de Turno
      ap: 2,
      maxAp: 2,
      mpPoints: 3,
      maxMpPoints: 3
    };

    this.players.set(id, newPlayer);
    return newPlayer;
  }

  /**
   * Remove um jogador da sala
   */
  public removePlayer(id: string) {
    this.players.delete(id);
  }

  /**
   * Envia o estado completo consolidado aos jogadores conectados a esta sala
   */
  protected sendGameState(gameMode: 'NORMAL' | 'TURN_BASED', extraData: any = {}) {
    const payload = {
      gameMode,
      players: Array.from(this.players.values()),
      creeps: Array.from(this.creeps.values()),
      towers: this.towers,
      projectiles: Array.from(this.projectiles.values()),
      ...extraData
    };
    
    // Filtramos para emitir apenas aos sockets associados aos jogadores desta sala
    const playerIds = Array.from(this.players.keys());
    playerIds.forEach(socketId => {
      this.io.to(socketId).emit('game_state', payload);
    });
  }

  // Métodos abstratos específicos de cada modo
  public abstract movePlayer(id: string, x: number, y: number): void;
  public abstract castAbility(id: string, key: 'Q' | 'W', targetX: number, targetY: number): void;
  public abstract destroy(): void;
}
