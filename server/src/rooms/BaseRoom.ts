import { Server } from 'socket.io';
import { 
  GAME_SETTINGS, 
  TOWER_LOCATIONS, 
  HERO_CATALOG,
  normalize,
  type Vector2D, 
  type SkillshotProjectile 
} from 'shared';

export interface ServerPlayer {
  id: string;
  username: string;
  heroId: string;
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
  targetId: string | null;
  lastAttackTime: number;
  
  // Atributos de Turno (PA e PM)
  ap: number; // Action Points (Pontos de Ação)
  maxAp: number;
  mpPoints: number; // Movement Points (Pontos de Movimento)
  maxMpPoints: number;

  // Atributos de Progressão (Nível e XP)
  level: number;
  xp: number;
  maxXp: number;
  attackRange: number;
  baseDamage: number;
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
  path?: any[];
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
  public addPlayer(id: string, username: string, heroId?: string): ServerPlayer {
    const team1Count = Array.from(this.players.values()).filter(p => p.team === 1).length;
    const team2Count = Array.from(this.players.values()).filter(p => p.team === 2).length;
    const team = team1Count <= team2Count ? 1 : 2;

    const spawnX = team === 1 ? 150 : 2250;
    const spawnY = team === 1 ? 2250 : 150;

    const heroKey = heroId && HERO_CATALOG[heroId] ? heroId : 'axe';
    const heroDef = HERO_CATALOG[heroKey];

    const newPlayer: ServerPlayer = {
      id,
      username: username || heroDef.name,
      heroId: heroKey,
      x: spawnX,
      y: spawnY,
      targetX: spawnX,
      targetY: spawnY,
      hp: heroDef.baseHp,
      maxHp: heroDef.baseHp,
      mp: heroDef.baseMp,
      maxMp: heroDef.baseMp,
      team,
      cooldowns: { Q: 0, W: 0 },
      kills: 0,
      deaths: 0,
      path: [],
      targetId: null,
      lastAttackTime: 0,
      // Atributos de Turno
      ap: 2,
      maxAp: 2,
      mpPoints: 3,
      maxMpPoints: 3,
      // Atributos de Progressão
      level: 1,
      xp: 0,
      maxXp: 100,
      attackRange: heroDef.baseAttackRange,
      baseDamage: 50
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

  /**
   * Respawna jogador morto
   */
  public killPlayerInternal(player: ServerPlayer) {
    player.deaths++;
    player.x = player.team === 1 ? 150 : 2250;
    player.y = player.team === 1 ? 2250 : 150;
    player.targetX = player.x;
    player.targetY = player.y;
    player.hp = player.maxHp;
    player.mp = player.maxMp;
    player.path = [];
    player.targetId = null;
    if (this.roomName === 'turn_based') {
      player.ap = 0;
      player.mpPoints = 0;
    }
  }

  /**
   * Concede XP ao jogador e processa o Level Up
   */
  public addXp(playerId: string, amount: number): void {
    const player = this.players.get(playerId);
    if (!player || player.hp <= 0) return;

    player.xp += amount;
    const heroDef = HERO_CATALOG[player.heroId] || HERO_CATALOG.axe;

    // Loop de level-up (caso ganhe XP suficiente para subir vários níveis)
    let leveledUp = false;
    while (player.xp >= player.maxXp) {
      player.level++;
      player.xp -= player.maxXp;
      player.maxXp = player.level * 100;
      leveledUp = true;

      // Ganho de atributos por nível com base no tipo de herói
      if (heroDef.attribute === 'STR') {
        player.maxHp += 100;
        player.maxMp += 30;
        player.baseDamage += 6;
        player.attackRange += (heroDef.isRanged ? 10 : 2);
      } else if (heroDef.attribute === 'AGI') {
        player.maxHp += 60;
        player.maxMp += 40;
        player.baseDamage += 8;
        player.attackRange += (heroDef.isRanged ? 15 : 2);
      } else { // INT
        player.maxHp += 45;
        player.maxMp += 80;
        player.baseDamage += 5;
        player.attackRange += (heroDef.isRanged ? 10 : 2);
      }
    }

    if (leveledUp) {
      // Cura completamente na subida de nível
      player.hp = player.maxHp;
      player.mp = player.maxMp;

      this.io.emit('level_up', {
        playerId: player.id,
        level: player.level,
        maxHp: player.maxHp,
        maxMp: player.maxMp
      });
    }
  }

  /**
   * Cast de Habilidade genérica baseada em Behavior (Q ou W)
   */
  public castAbility(id: string, key: 'Q' | 'W', targetX: number, targetY: number): void {
    const player = this.players.get(id);
    if (!player || player.hp <= 0) return;

    if (this.roomName === 'turn_based') {
      const turnRoom = this as any;
      const activePlayerId = turnRoom.turnOrder[turnRoom.activePlayerIndex];
      if (id !== activePlayerId || turnRoom.isNpcTurn || player.ap <= 0) return;
    }

    const heroDef = HERO_CATALOG[player.heroId || 'axe'];
    const config = heroDef.abilities[key];
    const now = Date.now();

    if (this.roomName !== 'turn_based' && now < player.cooldowns[key]) return;
    if (player.mp < config.manaCost) return;

    // Consome recursos
    player.mp -= config.manaCost;
    if (this.roomName === 'turn_based') {
      player.ap -= 1;
    } else {
      player.cooldowns[key] = now + config.cooldown * 1000;
    }

    // Executa comportamento
    if (config.behavior === 'SKILLSHOT') {
      const directionX = targetX - player.x;
      const directionY = targetY - player.y;
      const dirVec = normalize({ x: directionX, y: directionY });

      const projectileId = `proj_${id}_${key}_${this.projectileIdCounter++}`;
      const newProjectile: SkillshotProjectile = {
        id: projectileId,
        casterId: id,
        position: { x: player.x, y: player.y },
        direction: dirVec,
        speed: 450,
        radius: config.radius || 20,
        damage: config.damage,
        distanceTraveled: 0,
        maxRange: config.range
      };

      this.projectiles.set(projectileId, newProjectile);

      this.io.emit('ability_casted', {
        casterId: id,
        key,
        projectileId,
        position: { x: player.x, y: player.y },
        direction: dirVec,
        color: config.color || 0xffffff
      });

    } else if (config.behavior === 'BLINK') {
      const dist = Math.sqrt(Math.pow(targetX - player.x, 2) + Math.pow(targetY - player.y, 2));
      const allowedDist = Math.min(config.blinkDistance || 400, dist);
      
      const dirX = targetX - player.x;
      const dirY = targetY - player.y;
      const len = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
      
      const newX = player.x + (dirX / len) * allowedDist;
      const newY = player.y + (dirY / len) * allowedDist;

      player.x = Math.max(0, Math.min(GAME_SETTINGS.MAP.WIDTH, newX));
      player.y = Math.max(0, Math.min(GAME_SETTINGS.MAP.HEIGHT, newY));
      player.targetX = player.x;
      player.targetY = player.y;
      player.path = [];
      player.targetId = null;

      this.io.emit('ability_casted', {
        casterId: id,
        key,
        position: { x: player.x, y: player.y },
        blink: true
      });

    } else if (config.behavior === 'SELF_BUFF') {
      if (config.healAmount) {
        player.hp = Math.min(heroDef.baseHp, player.hp + config.healAmount);
      }
      
      this.io.emit('ability_casted', {
        casterId: id,
        key,
        selfBuff: true
      });

    } else if (config.behavior === 'TARGET_AOE') {
      // Aplica dano instantâneo em área
      this.creeps.forEach(creep => {
        const dist = Math.sqrt(Math.pow(creep.x - targetX, 2) + Math.pow(creep.y - targetY, 2));
        if (dist <= config.radius) {
          creep.hp = Math.max(0, creep.hp - config.damage);
          if (creep.hp <= 0) {
            this.creeps.delete(creep.id);
          }
        }
      });

      this.players.forEach(p => {
        if (p.id !== id && p.team !== player.team && p.hp > 0) {
          const dist = Math.sqrt(Math.pow(p.x - targetX, 2) + Math.pow(p.y - targetY, 2));
          if (dist <= config.radius) {
            p.hp = Math.max(0, p.hp - config.damage);
            if (p.hp <= 0) {
              player.kills++;
              this.killPlayerInternal(p);
            }
          }
        }
      });

      this.io.emit('ability_casted', {
        casterId: id,
        key,
        targetX,
        targetY,
        aoe: true,
        radius: config.radius,
        color: config.color || 0xff0000
      });
    }
  }

  // Métodos abstratos específicos de cada modo
  public abstract movePlayer(id: string, x: number, y: number): void;
  public abstract destroy(): void;
}
