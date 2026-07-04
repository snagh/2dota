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
    E: number;
    R: number;
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

  // Velocidade atual (usada pelo cliente na predição local)
  speed: number;

  // Sistema de economia
  gold: number;

  // Itens equipados (slots 1-6 como itemId string)
  items: (string | null)[];

  // Cooldowns de itens ativos
  itemCooldowns: Record<string, number>;

  // Buffs ativos (slow, DoT, etc)
  activeBuffs: ActiveBuff[];

  // Reconexão
  isDisconnected: boolean;
  disconnectTimer?: NodeJS.Timeout;
}

export interface ActiveBuff {
  type: 'SLOW' | 'DOT' | 'SPEED_BOOST' | 'LIFESTEAL';
  value: number;       // percentual ou valor fixo
  expiresAt: number;   // timestamp ms
  sourceId?: string;   // quem aplicou
}

export interface ServerCreep {
  id: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  spawnX?: number; // Posição X de spawn original
  spawnY?: number; // Posição Y de spawn original
  hp: number;
  maxHp: number;
  team: number; // 0 = Neutro, 1 = Sentinel, 2 = Scourge
  radius: number;
  path?: any[];
  lastAttackTime?: number;
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

// Dados de itens (compartilhado com o cliente via constantes)
export const ITEM_CATALOG: Record<string, ItemDefinition> = {
  // Itens Passivos
  boots: {
    id: 'boots',
    name: 'Boots of Speed',
    description: '+50 Velocidade de Movimento.',
    cost: 500,
    isActive: false,
    bonusSpeed: 50,
  },
  blades: {
    id: 'blades',
    name: 'Blades of Attack',
    description: '+15 Dano base.',
    cost: 450,
    isActive: false,
    bonusDamage: 15,
  },
  chain_mail: {
    id: 'chain_mail',
    name: 'Chain Mail',
    description: '+80 HP máximo.',
    cost: 600,
    isActive: false,
    bonusHp: 80,
  },
  mantle: {
    id: 'mantle',
    name: 'Mantle of Intelligence',
    description: '+50 Mana máxima.',
    cost: 350,
    isActive: false,
    bonusMp: 50,
  },
  ring_regen: {
    id: 'ring_regen',
    name: 'Ring of Regen',
    description: '+2 HP regenerado por segundo.',
    cost: 400,
    isActive: false,
    hpRegen: 2,
  },
  gloves: {
    id: 'gloves',
    name: 'Gloves of Haste',
    description: '+20% velocidade de ataque (reduz cooldown de AA em 20%).',
    cost: 500,
    isActive: false,
    attackSpeedBonus: 0.2,
  },
  // Itens Ativos
  salve: {
    id: 'salve',
    name: 'Healing Salve',
    description: 'Recupera 250 HP ao longo de 8 segundos.',
    cost: 115,
    isActive: true,
    cooldown: 30,
    activateFn: 'HEAL_OVER_TIME',
    activateValue: 250,
    activateDuration: 8000,
  },
  blink: {
    id: 'blink',
    name: 'Blink Dagger',
    description: 'Teleporta até 1200 unidades no mapa.',
    cost: 2250,
    isActive: true,
    cooldown: 12,
    activateFn: 'BLINK',
    blinkDistance: 1200,
  },
  dust: {
    id: 'dust',
    name: 'Dust of Appearance',
    description: 'Aumenta o campo de visão em 300px por 8 segundos.',
    cost: 80,
    isActive: true,
    cooldown: 40,
    activateFn: 'VISION_BOOST',
    activateValue: 300,
    activateDuration: 8000,
  },
  urn: {
    id: 'urn',
    name: 'Urn of Shadows',
    description: 'Aplica cura de 150 HP a si mesmo ou 150 de dano DoT a um inimigo próximo.',
    cost: 875,
    isActive: true,
    cooldown: 7,
    activateFn: 'HEAL_OR_DOT',
    activateValue: 150,
  }
};

export interface ItemDefinition {
  id: string;
  name: string;
  description: string;
  cost: number;
  isActive: boolean;
  cooldown?: number;
  bonusSpeed?: number;
  bonusDamage?: number;
  bonusHp?: number;
  bonusMp?: number;
  hpRegen?: number;
  attackSpeedBonus?: number;
  activateFn?: string;
  activateValue?: number;
  activateDuration?: number;
  blinkDistance?: number;
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

  // Torres: apenas envia no snapshot quando houver mudança
  private towersChanged = true;
  private lastTowersSnapshot: ServerTower[] = [];

  // Mapa de desconexões pendentes (username -> player snapshot)
  private disconnectedPlayers: Map<string, { player: ServerPlayer; timer: NodeJS.Timeout }> = new Map();

  // Roshan / Objetivo Neutro
  public roshan: { id: string; x: number; y: number; hp: number; maxHp: number; alive: boolean } = {
    id: 'roshan',
    x: 1200,
    y: 1200,
    hp: 3000,
    maxHp: 3000,
    alive: true
  };

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
    this.towersChanged = true;
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
          spawnX: creepX,
          spawnY: creepY,
          hp: GAME_SETTINGS.CREEPS.BASE_HP,
          maxHp: GAME_SETTINGS.CREEPS.BASE_HP,
          team: 0, // Neutro
          radius: GAME_SETTINGS.CREEPS.RADIUS,
          lastAttackTime: 0
        });
      }
    });
  }

  /**
   * Marca que as torres mudaram de HP (para o delta de snapshot)
   */
  public markTowersChanged() {
    this.towersChanged = true;
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
      cooldowns: { Q: 0, W: 0, E: 0, R: 0 },
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
      baseDamage: 50,
      // Netcode / predição
      speed: GAME_SETTINGS.PLAYER.SPEED,
      // Economia
      gold: 625,
      items: [null, null, null, null, null, null],
      itemCooldowns: {},
      activeBuffs: [],
      isDisconnected: false
    };

    this.players.set(id, newPlayer);
    return newPlayer;
  }

  /**
   * Remove um jogador da sala imediatamente
   */
  public removePlayer(id: string) {
    this.players.delete(id);
  }

  /**
   * Marca o jogador como desconectado e inicia grace period de 15 segundos.
   * Se reconectar com mesmo username antes do timer, o estado é restaurado.
   */
  public handlePlayerDisconnect(socketId: string): void {
    const player = this.players.get(socketId);
    if (!player) return;

    player.isDisconnected = true;
    player.path = [];
    player.targetId = null;

    console.log(`[${this.roomName}] ${player.username} desconectou. Aguardando reconexão por 15s...`);

    const timer = setTimeout(() => {
      // Grace period expirou, remove definitivamente
      this.players.delete(socketId);
      this.disconnectedPlayers.delete(player.username);
      console.log(`[${this.roomName}] ${player.username} removido definitivamente.`);
    }, 15000);

    // Salva o snapshot do jogador keyed pelo username para lookup na reconexão
    this.disconnectedPlayers.set(player.username, { player, timer });
  }

  /**
   * Tenta reconectar um jogador com o mesmo username.
   * Retorna o player restaurado ou null se não havia desconexão pendente.
   */
  public reconnectPlayer(newSocketId: string, username: string): ServerPlayer | null {
    const entry = this.disconnectedPlayers.get(username);
    if (!entry) return null;

    const { player, timer } = entry;

    // Cancela o timer de remoção
    clearTimeout(timer);
    this.disconnectedPlayers.delete(username);

    // Troca a chave do mapa players (socketId antigo -> novo)
    this.players.delete(player.id);
    player.id = newSocketId;
    player.isDisconnected = false;
    player.path = [];
    player.targetId = null;
    this.players.set(newSocketId, player);

    console.log(`[${this.roomName}] ${player.username} reconectou com socket ${newSocketId}.`);
    return player;
  }

  /**
   * Envia o estado completo consolidado aos jogadores conectados a esta sala.
   * Torres só são incluídas se tiverem mudado (delta compression).
   */
  protected sendGameState(gameMode: 'NORMAL' | 'TURN_BASED', extraData: any = {}) {
    // Aplica fog of war por jogador individualmente
    const playerIds = Array.from(this.players.keys());

    // Prepara snapshot de torres (delta)
    let towersPayload: ServerTower[] | null = null;
    if (this.towersChanged) {
      towersPayload = this.towers;
      this.lastTowersSnapshot = [...this.towers];
      this.towersChanged = false;
    }

    playerIds.forEach(socketId => {
      const viewer = this.players.get(socketId);
      if (!viewer || viewer.isDisconnected) return;

      const visRange = 900; // raio de visão padrão

      // Filtra entidades visíveis dentro do raio do jogador
      const visiblePlayers = Array.from(this.players.values()).filter(p => {
        if (p.id === socketId) return true;
        if (p.team === viewer.team) return true; // aliados sempre visíveis
        const dx = p.x - viewer.x;
        const dy = p.y - viewer.y;
        return Math.sqrt(dx * dx + dy * dy) <= visRange;
      });

      const visibleCreeps = Array.from(this.creeps.values()).filter(c => {
        const dx = c.x - viewer.x;
        const dy = c.y - viewer.y;
        return Math.sqrt(dx * dx + dy * dy) <= visRange;
      });

      const payload: any = {
        gameMode,
        players: visiblePlayers,
        creeps: visibleCreeps,
        projectiles: Array.from(this.projectiles.values()),
        roshan: this.roshan,
        ...extraData
      };

      // Inclui torres somente quando houver mudança
      if (towersPayload !== null) {
        payload.towers = towersPayload;
      }

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
    player.activeBuffs = [];
    if (this.roomName === 'turn_based') {
      player.ap = 0;
      player.mpPoints = 0;
    }

    // Emite evento de abate para alimentar o feed de abates do cliente
    this.io.emit('kill_event', {
      victimId: player.id,
      victimName: player.username,
      victimHeroId: player.heroId
    });
  }

  /**
   * Concede XP ao jogador e processa o Level Up
   */
  public addXp(playerId: string, amount: number): void {
    const player = this.players.get(playerId);
    if (!player || player.hp <= 0) return;

    player.xp += amount;
    const heroDef = HERO_CATALOG[player.heroId] || HERO_CATALOG.axe;

    let leveledUp = false;
    while (player.xp >= player.maxXp) {
      player.level++;
      player.xp -= player.maxXp;
      player.maxXp = player.level * 100;
      leveledUp = true;

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
      } else {
        player.maxHp += 45;
        player.maxMp += 80;
        player.baseDamage += 5;
        player.attackRange += (heroDef.isRanged ? 10 : 2);
      }
    }

    if (leveledUp) {
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
   * Concede ouro ao jogador (last-hit, deny, tempo, etc.)
   */
  public addGold(playerId: string, amount: number): void {
    const player = this.players.get(playerId);
    if (!player) return;
    player.gold += amount;
    this.io.to(playerId).emit('gold_gained', { amount, total: player.gold });
  }

  /**
   * Processa compra de item pelo jogador
   */
  public buyItem(playerId: string, itemId: string): boolean {
    const player = this.players.get(playerId);
    const item = ITEM_CATALOG[itemId];
    if (!player || !item) return false;
    if (player.gold < item.cost) return false;

    // Verifica slot livre
    const slotIndex = player.items.findIndex(slot => slot === null);
    if (slotIndex === -1) return false; // Inventário cheio

    player.gold -= item.cost;
    player.items[slotIndex] = itemId;

    // Aplica bônus passivos imediatamente
    if (item.bonusSpeed) player.speed += item.bonusSpeed;
    if (item.bonusDamage) player.baseDamage += item.bonusDamage;
    if (item.bonusHp) { player.maxHp += item.bonusHp; player.hp += item.bonusHp; }
    if (item.bonusMp) { player.maxMp += item.bonusMp; player.mp += item.bonusMp; }

    this.io.to(playerId).emit('item_bought', { itemId, slotIndex, gold: player.gold });
    return true;
  }

  /**
   * Ativa um item ativo do inventário
   */
  public activateItem(playerId: string, itemId: string, targetX?: number, targetY?: number): void {
    const player = this.players.get(playerId);
    const item = ITEM_CATALOG[itemId];
    if (!player || !item || !item.isActive) return;

    const now = Date.now();
    const cdExpiry = player.itemCooldowns[itemId] || 0;
    if (now < cdExpiry) return;

    player.itemCooldowns[itemId] = now + (item.cooldown || 0) * 1000;

    if (item.activateFn === 'HEAL_OVER_TIME') {
      const healPerTick = (item.activateValue || 0) / 8;
      const endTime = now + (item.activateDuration || 8000);
      // Simula o HoT via buff
      player.activeBuffs.push({
        type: 'SPEED_BOOST', // reutiliza como "regen ativo" — o RealTimeRoom processa hpRegen
        value: healPerTick,
        expiresAt: endTime
      });
    } else if (item.activateFn === 'BLINK' && targetX !== undefined && targetY !== undefined) {
      const dx = targetX - player.x;
      const dy = targetY - player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxDist = Math.min(item.blinkDistance || 1200, dist);
      const len = dist || 1;
      player.x = player.x + (dx / len) * maxDist;
      player.y = player.y + (dy / len) * maxDist;
      player.path = [];
      player.targetId = null;
    } else if (item.activateFn === 'HEAL_OR_DOT') {
      // Cura a si mesmo
      player.hp = Math.min(player.maxHp, player.hp + (item.activateValue || 0));
    }

    this.io.to(playerId).emit('item_activated', { itemId });
  }

  /**
   * Processa regeneração por itens (ring_of_regen, etc.) — chamado no tick
   */
  public processItemRegen(dt: number): void {
    for (const player of this.players.values()) {
      if (player.hp <= 0 || player.isDisconnected) continue;

      // Regeneração passiva de itens
      let hpRegenRate = 0;
      for (const itemId of player.items) {
        if (!itemId) continue;
        const item = ITEM_CATALOG[itemId];
        if (item?.hpRegen) hpRegenRate += item.hpRegen;
      }
      if (hpRegenRate > 0) {
        player.hp = Math.min(player.maxHp, player.hp + hpRegenRate * dt);
      }

      // Expiração de buffs ativos
      const now = Date.now();
      player.activeBuffs = player.activeBuffs.filter(b => b.expiresAt > now);
    }
  }

  /**
   * Dano do Roshan e recompensa ao morrer
   */
  public damageRoshan(amount: number, killerId: string): void {
    if (!this.roshan.alive) return;
    this.roshan.hp = Math.max(0, this.roshan.hp - amount);
    if (this.roshan.hp <= 0) {
      this.roshan.alive = false;
      // Recompensa ao time do killer
      const killer = this.players.get(killerId);
      if (killer) {
        // Dar recompensa a todos os aliados próximos
        for (const player of this.players.values()) {
          if (player.team === killer.team && player.hp > 0) {
            this.addGold(player.id, 200);
            this.addXp(player.id, 300);
          }
        }
      }
      this.io.emit('roshan_killed', { killerId });

      // Respawna Roshan após 8 minutos (480s)
      setTimeout(() => {
        this.roshan.hp = this.roshan.maxHp;
        this.roshan.alive = true;
        this.io.emit('roshan_spawned');
      }, 480000);
    }
  }

  /**
   * Verifica se uma habilidade do tipo self-buff/cooldown está ativa baseando-se no timestamp
   */
  public isBuffActive(player: ServerPlayer, key: 'Q' | 'W' | 'E' | 'R', durationMs: number): boolean {
    const cdTime = player.cooldowns[key];
    if (!cdTime) return false;
    const heroDef = HERO_CATALOG[player.heroId];
    if (!heroDef) return false;
    const cooldownMs = heroDef.abilities[key].cooldown * 1000;
    const castTime = cdTime - cooldownMs;
    return Date.now() - castTime < durationMs;
  }

  /**
   * Cast de Habilidade genérica baseada em Behavior (Q, W, E ou R)
   * — Com validação server-side de alcance (anti-cheat)
   */
  public castAbility(id: string, key: 'Q' | 'W' | 'E' | 'R', rawTargetX: number, rawTargetY: number): void {
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

    // ─── VALIDAÇÃO ANTI-CHEAT: Limita as coordenadas ao alcance máximo ─────────
    let targetX = rawTargetX;
    let targetY = rawTargetY;

    if (config.range && config.range > 0 && config.behavior !== 'SELF_BUFF') {
      const dx = rawTargetX - player.x;
      const dy = rawTargetY - player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > config.range) {
        // Limita ao alcance máximo ao longo do vetor
        targetX = player.x + (dx / dist) * config.range;
        targetY = player.y + (dy / dist) * config.range;
      }
    }
    // ──────────────────────────────────────────────────────────────────────────

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
        player.hp = Math.min(player.maxHp, player.hp + config.healAmount);
      }
      
      this.io.emit('ability_casted', {
        casterId: id,
        key,
        selfBuff: true
      });

      // Efeito Especial do Chaos Knight (Phantasm): Invoca ilusões/clones
      if (config.name === 'Phantasm') {
        for (let i = 0; i < 2; i++) {
          const illusionId = `creep_ill_${id}_${this.creepIdCounter++}`;
          const offsetAngle = (i * Math.PI) + Math.random();
          const offsetDist = 50;
          const illX = player.x + Math.cos(offsetAngle) * offsetDist;
          const illY = player.y + Math.sin(offsetAngle) * offsetDist;

          this.creeps.set(illusionId, {
            id: illusionId,
            x: illX,
            y: illY,
            targetX: illX,
            targetY: illY,
            hp: Math.ceil(player.hp * 0.5),
            maxHp: player.maxHp,
            team: player.team,
            radius: GAME_SETTINGS.PLAYER.RADIUS,
            isIllusion: true,
            ownerId: player.id,
            heroId: player.heroId,
            lifetime: now + 15000
          } as any);
        }
      }
    } else if (config.behavior === 'TARGET_AOE') {
      // Aplica composição de efeitos (dano + slow + DoT)
      const applyAoeEffect = (target: any, isPlayer: boolean) => {
        const dist = Math.sqrt(Math.pow(target.x - targetX, 2) + Math.pow(target.y - targetY, 2));
        if (dist > (config.radius || 150)) return;

        target.hp = Math.max(0, target.hp - config.damage);

        // Composição: slow
        if (config.slowDuration && isPlayer) {
          target.activeBuffs = target.activeBuffs || [];
          target.activeBuffs.push({
            type: 'SLOW',
            value: config.slowAmount || 0.3,
            expiresAt: now + (config.slowDuration || 2000),
            sourceId: id
          });
        }

        // Composição: DoT
        if (config.dotDamage && config.dotDuration && isPlayer) {
          target.activeBuffs = target.activeBuffs || [];
          target.activeBuffs.push({
            type: 'DOT',
            value: config.dotDamage,
            expiresAt: now + (config.dotDuration || 3000),
            sourceId: id
          });
        }
      };

      this.creeps.forEach(creep => {
        applyAoeEffect(creep, false);
        if (creep.hp <= 0) this.creeps.delete(creep.id);
      });

      this.players.forEach(p => {
        if (p.id !== id && p.team !== player.team && p.hp > 0) {
          applyAoeEffect(p, true);
          if (p.hp <= 0) {
            player.kills++;
            this.killPlayerInternal(p);
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
