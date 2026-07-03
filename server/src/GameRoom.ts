import { Server } from 'socket.io';
import { 
  GAME_SETTINGS, 
  TOWER_LOCATIONS, 
  moveTowards, 
  checkCircleCollision, 
  createVector, 
  normalize,
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
  mp: number;
  maxMp: number;
  team: number; // 1 = Sentinel, 2 = Scourge
  cooldowns: {
    Q: number; // Timestamp de quando estará disponível novamente
    W: number;
  };
  kills: number;
  deaths: number;
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
  lastShotTime: number; // Timestamp do último tiro
}

export class GameRoom {
  private io: Server;
  public players: Map<string, ServerPlayer> = new Map();
  public creeps: Map<string, ServerCreep> = new Map();
  public towers: ServerTower[] = [];
  public projectiles: Map<string, SkillshotProjectile> = new Map();
  
  private loopInterval: NodeJS.Timeout | null = null;
  private lastTickTime: number = Date.now();
  private projectileIdCounter = 0;
  private creepIdCounter = 0;

  constructor(io: Server) {
    this.io = io;
    this.initializeTowers();
    this.spawnInitialCreeps();
    this.startGameLoop();
  }

  /**
   * Inicializa as torres estáticas do mapa baseadas no layout do Dota
   */
  private initializeTowers() {
    this.towers = TOWER_LOCATIONS.map((loc, idx) => ({
      id: `tower_${idx}`,
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
   * Spawna monstros neutros iniciais em acampamentos da selva
   */
  private spawnInitialCreeps() {
    // Spawna creeps neutros em 4 acampamentos estratégicos
    const camps = [
      { x: 800, y: 700 },
      { x: 1600, y: 1700 },
      { x: 600, y: 1400 },
      { x: 1800, y: 1000 }
    ];

    camps.forEach((camp, index) => {
      for (let i = 0; i < 3; i++) {
        const id = `creep_${this.creepIdCounter++}`;
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
   * Inicia o loop de física autoritário do servidor a 30Hz
   */
  private startGameLoop() {
    if (this.loopInterval) clearInterval(this.loopInterval);
    
    this.lastTickTime = Date.now();
    this.loopInterval = setInterval(() => {
      this.tick();
    }, GAME_SETTINGS.NETWORK.TICK_INTERVAL);
  }

  /**
   * Executa um passo da simulação de física
   */
  private tick() {
    const now = Date.now();
    const dt = (now - this.lastTickTime) / 1000; // Delta tempo em segundos
    this.lastTickTime = now;

    // 1. Mover Jogadores
    for (const player of this.players.values()) {
      if (player.hp <= 0) continue;

      if (player.x !== player.targetX || player.y !== player.targetY) {
        const maxDist = GAME_SETTINGS.PLAYER.SPEED * dt;
        const currentPos = { x: player.x, y: player.y };
        const targetPos = { x: player.targetX, y: player.targetY };
        
        const nextPos = moveTowards(currentPos, targetPos, maxDist);
        player.x = nextPos.x;
        player.y = nextPos.y;
      }
    }

    // 2. Mover e atualizar comportamento básico de Creeps (AI)
    for (const creep of this.creeps.values()) {
      if (creep.hp <= 0) {
        this.creeps.delete(creep.id);
        continue;
      }

      // Procura inimigos próximos para atacar ou seguir
      let target: ServerPlayer | null = null;
      let minDist = GAME_SETTINGS.TOWERS.ATTACK_RANGE; // Raio máximo de aggro dos creeps

      for (const player of this.players.values()) {
        if (player.hp <= 0) continue;
        const dist = getDistance(creep, player);
        if (dist < minDist) {
          minDist = dist;
          target = player;
        }
      }

      if (target) {
        // Se estiver fora do alcance de ataque, move em direção
        if (minDist > GAME_SETTINGS.CREEPS.ATTACK_RANGE) {
          creep.targetX = target.x;
          creep.targetY = target.y;
          const nextPos = moveTowards(creep, target, GAME_SETTINGS.CREEPS.SPEED * dt);
          creep.x = nextPos.x;
          creep.y = nextPos.y;
        } else {
          // Ataca jogador inimigo (aplicação de dano simples com cooldown básico em ticks)
          if (Math.random() < 0.05) { // Simula ataque periódico a cada segundo aproximadamente
            target.hp = Math.max(0, target.hp - GAME_SETTINGS.CREEPS.DAMAGE);
            if (target.hp <= 0) {
              target.deaths++;
              target.x = target.team === 1 ? 150 : 2250; // Respawna na respectiva base
              target.y = target.team === 1 ? 2250 : 150;
              target.targetX = target.x;
              target.targetY = target.y;
              target.hp = GAME_SETTINGS.PLAYER.BASE_HP;
              target.mp = GAME_SETTINGS.PLAYER.BASE_MP;
            }
          }
        }
      } else {
        // Volta para o local de spawn original
        if (creep.x !== creep.targetX || creep.y !== creep.targetY) {
          const nextPos = moveTowards(creep, { x: creep.targetX, y: creep.targetY }, GAME_SETTINGS.CREEPS.SPEED * dt);
          creep.x = nextPos.x;
          creep.y = nextPos.y;
        }
      }
    }

    // 3. Atualizar Projéteis de Skillshots
    for (const [projId, proj] of this.projectiles.entries()) {
      const stepDistance = proj.speed * dt;
      proj.position.x += proj.direction.x * stepDistance;
      proj.position.y += proj.direction.y * stepDistance;
      proj.distanceTraveled += stepDistance;

      let destroyed = proj.distanceTraveled >= proj.maxRange;

      // Verificar colisões contra Jogadores
      if (!destroyed) {
        for (const player of this.players.values()) {
          // Ignora aliados e jogadores mortos
          if (player.id === proj.casterId || player.hp <= 0) continue;

          const collides = checkCircleCollision(
            proj.position, 
            proj.radius, 
            player, 
            GAME_SETTINGS.PLAYER.RADIUS
          );

          if (collides) {
            player.hp = Math.max(0, player.hp - proj.damage);
            destroyed = true;

            // Se o jogador morreu, computa kill para o caster
            if (player.hp <= 0) {
              const caster = this.players.get(proj.casterId);
              if (caster) caster.kills++;
              
              // Respawn imediato na base
              player.deaths++;
              player.x = player.team === 1 ? 150 : 2250;
              player.y = player.team === 1 ? 2250 : 150;
              player.targetX = player.x;
              player.targetY = player.y;
              player.hp = GAME_SETTINGS.PLAYER.BASE_HP;
              player.mp = GAME_SETTINGS.PLAYER.BASE_MP;
            }
            break;
          }
        }
      }

      // Verificar colisão contra Creeps neutros
      if (!destroyed) {
        for (const creep of this.creeps.values()) {
          const collides = checkCircleCollision(
            proj.position,
            proj.radius,
            creep,
            creep.radius
          );

          if (collides) {
            creep.hp = Math.max(0, creep.hp - proj.damage);
            destroyed = true;
            break;
          }
        }
      }

      if (destroyed) {
        this.projectiles.delete(projId);
      }
    }

    // 4. Ataque das Torres
    this.towers.forEach(tower => {
      if (tower.hp <= 0) return;

      if (now - tower.lastShotTime > 1500) { // Ataca a cada 1.5s
        let nearestEnemy: ServerPlayer | null = null;
        let minDist = GAME_SETTINGS.TOWERS.ATTACK_RANGE;

        for (const player of this.players.values()) {
          if (player.hp <= 0 || player.team === tower.team) continue;
          const dist = getDistance(tower, player);
          if (dist < minDist) {
            minDist = dist;
            nearestEnemy = player;
          }
        }

        if (nearestEnemy) {
          nearestEnemy.hp = Math.max(0, nearestEnemy.hp - GAME_SETTINGS.TOWERS.DAMAGE);
          tower.lastShotTime = now;

          // Dispara animação ou efeito no cliente enviando alerta
          this.io.emit('tower_attacked', {
            towerId: tower.id,
            targetId: nearestEnemy.id,
            damage: GAME_SETTINGS.TOWERS.DAMAGE
          });

          if (nearestEnemy.hp <= 0) {
            nearestEnemy.deaths++;
            nearestEnemy.x = nearestEnemy.team === 1 ? 150 : 2250;
            nearestEnemy.y = nearestEnemy.team === 1 ? 2250 : 150;
            nearestEnemy.targetX = nearestEnemy.x;
            nearestEnemy.targetY = nearestEnemy.y;
            nearestEnemy.hp = GAME_SETTINGS.PLAYER.BASE_HP;
            nearestEnemy.mp = GAME_SETTINGS.PLAYER.BASE_MP;
          }
        }
      }
    });

    // 5. Broadcast do estado sincronizado para todos os jogadores
    this.sendGameState();
  }

  /**
   * Envia o estado completo e consolidado aos jogadores conectados
   */
  private sendGameState() {
    const payload = {
      players: Array.from(this.players.values()),
      creeps: Array.from(this.creeps.values()),
      towers: this.towers,
      projectiles: Array.from(this.projectiles.values())
    };
    
    this.io.emit('game_state', payload);
  }

  /**
   * Adiciona um novo jogador ao GameRoom
   */
  public addPlayer(id: string, username: string): ServerPlayer {
    // Escolhe time baseado na quantidade atual
    const team1Count = Array.from(this.players.values()).filter(p => p.team === 1).length;
    const team2Count = Array.from(this.players.values()).filter(p => p.team === 2).length;
    const team = team1Count <= team2Count ? 1 : 2;

    // Sentinel respawna embaixo/esquerda, Scourge respawna no topo/direita
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
      deaths: 0
    };

    this.players.set(id, newPlayer);
    return newPlayer;
  }

  /**
   * Remove um jogador do GameRoom
   */
  public removePlayer(id: string) {
    this.players.delete(id);
  }

  /**
   * Define o ponto de destino do click-to-move de um jogador
   */
  public movePlayer(id: string, x: number, y: number) {
    const player = this.players.get(id);
    if (!player || player.hp <= 0) return;
    
    // Limita o movimento às fronteiras do mapa
    player.targetX = Math.max(0, Math.min(GAME_SETTINGS.MAP.WIDTH, x));
    player.targetY = Math.max(0, Math.min(GAME_SETTINGS.MAP.HEIGHT, y));
  }

  /**
   * Conjura uma habilidade (Skillshot) em determinada direção
   */
  public castAbility(id: string, key: 'Q' | 'W', targetX: number, targetY: number) {
    const player = this.players.get(id);
    if (!player || player.hp <= 0) return;

    const now = Date.now();
    const config = GAME_SETTINGS.ABILITIES[key];

    // Verifica Cooldown e Mana
    if (now < player.cooldowns[key]) return;
    if (player.mp < config.MANA_COST) return;

    player.mp -= config.MANA_COST;
    player.cooldowns[key] = now + config.COOLDOWN * 1000;

    // Calcula direção do projétil linear
    const directionX = targetX - player.x;
    const directionY = targetY - player.y;
    const dirVec = normalize({ x: directionX, y: directionY });

    // Instancia o Projétil
    const projectileId = `proj_${id}_${key}_${this.projectileIdCounter++}`;
    const newProjectile: SkillshotProjectile = {
      id: projectileId,
      casterId: id,
      position: { x: player.x, y: player.y },
      direction: dirVec,
      speed: config.SPEED,
      radius: config.RADIUS,
      damage: config.DAMAGE,
      distanceTraveled: 0,
      maxRange: config.RANGE
    };

    this.projectiles.set(projectileId, newProjectile);

    // Alerta de ativação para animações sonoras/visuais
    this.io.emit('ability_casted', {
      casterId: id,
      key,
      projectileId,
      position: { x: player.x, y: player.y },
      direction: dirVec
    });
  }

  /**
   * Encerra o loop e limpa referências
   */
  public destroy() {
    if (this.loopInterval) {
      clearInterval(this.loopInterval);
    }
  }
}

// Helper para distância
function getDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}
