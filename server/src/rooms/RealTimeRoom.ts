import { Server } from 'socket.io';
import { BaseRoom, type ServerPlayer } from './BaseRoom.js';
import { 
  GAME_SETTINGS, 
  moveTowards, 
  checkCircleCollision, 
  normalize,
  findPath,
  type SkillshotProjectile 
} from 'shared';

export class RealTimeRoom extends BaseRoom {
  private loopInterval: NodeJS.Timeout | null = null;
  private lastTickTime: number = Date.now();

  constructor(io: Server) {
    super(io, 'normal');
    this.startGameLoop();
  }

  /**
   * Inicia o loop de simulação em tempo real a 30Hz
   */
  private startGameLoop() {
    this.lastTickTime = Date.now();
    this.loopInterval = setInterval(() => {
      this.tick();
    }, GAME_SETTINGS.NETWORK.TICK_INTERVAL);
  }

  /**
   * Passo de simulação de física em tempo real
   */
  private tick() {
    const now = Date.now();
    const dt = (now - this.lastTickTime) / 1000;
    this.lastTickTime = now;

    // 1. Movimentação dos Jogadores ao longo dos waypoints
    for (const player of this.players.values()) {
      if (player.hp <= 0) continue;

      if (player.path && player.path.length > 0) {
        const nextWaypoint = player.path[0];
        const maxDist = GAME_SETTINGS.PLAYER.SPEED * dt;
        const currentPos = { x: player.x, y: player.y };
        
        const nextPos = moveTowards(currentPos, nextWaypoint, maxDist);
        player.x = nextPos.x;
        player.y = nextPos.y;

        // Se chegou ao waypoint intermediário, avança
        const distToWaypoint = Math.sqrt(
          Math.pow(nextWaypoint.x - player.x, 2) + Math.pow(nextWaypoint.y - player.y, 2)
        );
        if (distToWaypoint < 4) {
          player.path.shift();
        }
      }
    }

    // 2. Inteligência Artificial de Creeps Neutros
    for (const creep of this.creeps.values()) {
      if (creep.hp <= 0) {
        this.creeps.delete(creep.id);
        continue;
      }

      let target: ServerPlayer | null = null;
      let minDist = GAME_SETTINGS.TOWERS.ATTACK_RANGE;

      for (const player of this.players.values()) {
        if (player.hp <= 0) continue;
        const dist = this.getDistance(creep, player);
        if (dist < minDist) {
          minDist = dist;
          target = player;
        }
      }

      if (target) {
        if (minDist > GAME_SETTINGS.CREEPS.ATTACK_RANGE) {
          creep.targetX = target.x;
          creep.targetY = target.y;
          const nextPos = moveTowards(creep, target, GAME_SETTINGS.CREEPS.SPEED * dt);
          creep.x = nextPos.x;
          creep.y = nextPos.y;
        } else {
          // Ataque básico
          if (Math.random() < 0.05) {
            target.hp = Math.max(0, target.hp - GAME_SETTINGS.CREEPS.DAMAGE);
            if (target.hp <= 0) {
              this.killPlayer(target);
            }
          }
        }
      } else {
        if (creep.x !== creep.targetX || creep.y !== creep.targetY) {
          const nextPos = moveTowards(creep, { x: creep.targetX, y: creep.targetY }, GAME_SETTINGS.CREEPS.SPEED * dt);
          creep.x = nextPos.x;
          creep.y = nextPos.y;
        }
      }
    }

    // 3. Atualizar Projéteis
    for (const [projId, proj] of this.projectiles.entries()) {
      const stepDistance = proj.speed * dt;
      proj.position.x += proj.direction.x * stepDistance;
      proj.position.y += proj.direction.y * stepDistance;
      proj.distanceTraveled += stepDistance;

      let destroyed = proj.distanceTraveled >= proj.maxRange;

      // Colisão com Jogadores
      if (!destroyed) {
        for (const player of this.players.values()) {
          if (player.id === proj.casterId || player.hp <= 0) continue;

          const collides = checkCircleCollision(proj.position, proj.radius, player, GAME_SETTINGS.PLAYER.RADIUS);
          if (collides) {
            player.hp = Math.max(0, player.hp - proj.damage);
            destroyed = true;

            if (player.hp <= 0) {
              const caster = this.players.get(proj.casterId);
              if (caster) caster.kills++;
              this.killPlayer(player);
            }
            break;
          }
        }
      }

      // Colisão com Creeps
      if (!destroyed) {
        for (const creep of this.creeps.values()) {
          const collides = checkCircleCollision(proj.position, proj.radius, creep, creep.radius);
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

    // 4. Ataque das Torres Sentinel/Scourge
    this.towers.forEach(tower => {
      if (tower.hp <= 0) return;

      if (now - tower.lastShotTime > 1500) {
        let nearestEnemy: ServerPlayer | null = null;
        let minDist = GAME_SETTINGS.TOWERS.ATTACK_RANGE;

        for (const player of this.players.values()) {
          if (player.hp <= 0 || player.team === tower.team) continue;
          const dist = this.getDistance(tower, player);
          if (dist < minDist) {
            minDist = dist;
            nearestEnemy = player;
          }
        }

        if (nearestEnemy) {
          nearestEnemy.hp = Math.max(0, nearestEnemy.hp - GAME_SETTINGS.TOWERS.DAMAGE);
          tower.lastShotTime = now;

          this.io.emit('tower_attacked', {
            towerId: tower.id,
            targetId: nearestEnemy.id,
            damage: GAME_SETTINGS.TOWERS.DAMAGE
          });

          if (nearestEnemy.hp <= 0) {
            this.killPlayer(nearestEnemy);
          }
        }
      }
    });

    // Envia o estado completo no modo NORMAL
    this.sendGameState('NORMAL');
  }

  /**
   * Respawna o jogador morto na respectiva base
   */
  private killPlayer(player: ServerPlayer) {
    player.deaths++;
    player.x = player.team === 1 ? 150 : 2250;
    player.y = player.team === 1 ? 2250 : 150;
    player.targetX = player.x;
    player.targetY = player.y;
    player.hp = GAME_SETTINGS.PLAYER.BASE_HP;
    player.mp = GAME_SETTINGS.PLAYER.BASE_MP;
    player.path = [];
  }

  /**
   * Define o destino do jogador na movimentação A*
   */
  public override movePlayer(id: string, x: number, y: number) {
    const player = this.players.get(id);
    if (!player || player.hp <= 0) return;

    const targetX = Math.max(0, Math.min(GAME_SETTINGS.MAP.WIDTH, x));
    const targetY = Math.max(0, Math.min(GAME_SETTINGS.MAP.HEIGHT, y));
    player.targetX = targetX;
    player.targetY = targetY;

    player.path = findPath({ x: player.x, y: player.y }, { x: targetX, y: targetY });
  }

  /**
   * Dispara um skillshot em tempo real
   */
  public override castAbility(id: string, key: 'Q' | 'W', targetX: number, targetY: number) {
    const player = this.players.get(id);
    if (!player || player.hp <= 0) return;

    const now = Date.now();
    const config = GAME_SETTINGS.ABILITIES[key];

    if (now < player.cooldowns[key]) return;
    if (player.mp < config.MANA_COST) return;

    player.mp -= config.MANA_COST;
    player.cooldowns[key] = now + config.COOLDOWN * 1000;

    const directionX = targetX - player.x;
    const directionY = targetY - player.y;
    const dirVec = normalize({ x: directionX, y: directionY });

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

    this.io.emit('ability_casted', {
      casterId: id,
      key,
      projectileId,
      position: { x: player.x, y: player.y },
      direction: dirVec
    });
  }

  private getDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Destrutor da sala
   */
  public override destroy() {
    if (this.loopInterval) {
      clearInterval(this.loopInterval);
    }
  }
}
