import { Server } from 'socket.io';
import { BaseRoom, type ServerPlayer } from './BaseRoom.js';
import { 
  GAME_SETTINGS, 
  TURN_RULES, 
  moveTowards, 
  checkCircleCollision, 
  normalize,
  findPath,
  type SkillshotProjectile 
} from 'shared';

export class TurnBasedRoom extends BaseRoom {
  private loopInterval: NodeJS.Timeout | null = null;
  private lastTickTime: number = Date.now();

  // Fila de turnos
  public turnOrder: string[] = [];
  public activePlayerIndex: number = 0;
  public isNpcTurn: boolean = false;

  constructor(io: Server) {
    super(io, 'turn_based');
    this.startGameLoop();
  }

  /**
   * Inicia o loop de física de 30Hz apenas para atualizações visuais/projéteis
   */
  private startGameLoop() {
    this.lastTickTime = Date.now();
    this.loopInterval = setInterval(() => {
      this.tick();
    }, GAME_SETTINGS.NETWORK.TICK_INTERVAL);
  }

  /**
   * Sobrescreve addPlayer para atualizar a fila de iniciativa do turno
   */
  public override addPlayer(id: string, username: string): ServerPlayer {
    const player = super.addPlayer(id, username);
    this.turnOrder.push(id);
    
    // Se for o único jogador, inicia a fila
    if (this.turnOrder.length === 1) {
      this.activePlayerIndex = 0;
      player.ap = TURN_RULES.MAX_AP;
      player.mpPoints = TURN_RULES.MAX_MP;
    }
    
    this.broadcastTurnInfo();
    return player;
  }

  /**
   * Sobrescreve removePlayer para retirar da fila de iniciativa
   */
  public override removePlayer(id: string) {
    const index = this.turnOrder.indexOf(id);
    super.removePlayer(id);
    
    if (index !== -1) {
      this.turnOrder.splice(index, 1);
      
      // Ajusta o índice do jogador ativo
      if (this.activePlayerIndex >= this.turnOrder.length) {
        this.activePlayerIndex = 0;
      }
      
      this.broadcastTurnInfo();
    }
  }

  /**
   * Loop de simulação visual (movimentação de projéteis e suavização)
   */
  private tick() {
    const now = Date.now();
    const dt = (now - this.lastTickTime) / 1000;
    this.lastTickTime = now;

    // 1. Mover Jogadores ao longo dos waypoints autorizados
    for (const player of this.players.values()) {
      if (player.hp <= 0) continue;

      if (player.path && player.path.length > 0) {
        const nextWaypoint = player.path[0];
        const maxDist = GAME_SETTINGS.PLAYER.SPEED * dt;
        const currentPos = { x: player.x, y: player.y };
        
        const nextPos = moveTowards(currentPos, nextWaypoint, maxDist);
        player.x = nextPos.x;
        player.y = nextPos.y;

        const distToWaypoint = Math.sqrt(
          Math.pow(nextWaypoint.x - player.x, 2) + Math.pow(nextWaypoint.y - player.y, 2)
        );
        if (distToWaypoint < 4) {
          player.path.shift();
        }
      }
    }

    // 2. Atualizar Projéteis
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

    // Envia o estado completo no modo de TURNO
    const activePlayerId = this.turnOrder[this.activePlayerIndex] || null;
    this.sendGameState('TURN_BASED', {
      activePlayerId,
      isNpcTurn: this.isNpcTurn
    });
  }

  /**
   * Respawna o jogador morto na base e reseta fila
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
    player.ap = 0;
    player.mpPoints = 0;
  }

  /**
   * Passa o turno para o próximo jogador ou aciona o turno de NPC
   */
  public endTurn(id: string) {
    const activePlayerId = this.turnOrder[this.activePlayerIndex];
    if (id !== activePlayerId || this.isNpcTurn) return;

    // Avança para o próximo jogador
    this.activePlayerIndex++;
    
    // Se todos jogaram, é o turno das Torres e Creeps
    if (this.activePlayerIndex >= this.turnOrder.length) {
      this.executeNpcTurn();
    } else {
      // Prepara o próximo jogador
      const nextId = this.turnOrder[this.activePlayerIndex];
      const nextPlayer = this.players.get(nextId);
      if (nextPlayer) {
        nextPlayer.ap = TURN_RULES.MAX_AP;
        nextPlayer.mpPoints = TURN_RULES.MAX_MP;
      }
      this.broadcastTurnInfo();
    }
  }

  /**
   * Turno automatizado das Torres e Monstros
   */
  private executeNpcTurn() {
    this.isNpcTurn = true;
    this.broadcastTurnInfo();

    // 1. Torres atacam inimigos próximos
    this.towers.forEach(tower => {
      if (tower.hp <= 0) return;
      
      let target: ServerPlayer | null = null;
      let minDist = GAME_SETTINGS.TOWERS.ATTACK_RANGE;

      for (const player of this.players.values()) {
        if (player.hp <= 0 || player.team === tower.team) continue;
        const dist = this.getDistance(tower, player);
        if (dist < minDist) {
          minDist = dist;
          target = player;
        }
      }

      if (target) {
        target.hp = Math.max(0, target.hp - GAME_SETTINGS.TOWERS.DAMAGE);
        this.io.emit('tower_attacked', {
          towerId: tower.id,
          targetId: target.id,
          damage: GAME_SETTINGS.TOWERS.DAMAGE
        });

        if (target.hp <= 0) {
          this.killPlayer(target);
        }
      }
    });

    // 2. Creeps atacam inimigos próximos
    for (const creep of this.creeps.values()) {
      if (creep.hp <= 0) continue;

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
        if (minDist <= GAME_SETTINGS.CREEPS.ATTACK_RANGE) {
          target.hp = Math.max(0, target.hp - GAME_SETTINGS.CREEPS.DAMAGE);
          if (target.hp <= 0) {
            this.killPlayer(target);
          }
        }
      }
    }

    // Aguarda um pequeno delay de 1.2s para simular as ações do NPC e inicia nova rodada
    setTimeout(() => {
      this.isNpcTurn = false;
      this.activePlayerIndex = 0;

      // Reseta os pontos de todos os jogadores para a nova rodada
      this.players.forEach(player => {
        player.ap = TURN_RULES.MAX_AP;
        player.mpPoints = TURN_RULES.MAX_MP;
      });

      this.broadcastTurnInfo();
    }, 1200);
  }

  /**
   * Implementação da movimentação limitada por PM (Pontos de Movimento)
   */
  public override movePlayer(id: string, x: number, y: number) {
    const activePlayerId = this.turnOrder[this.activePlayerIndex];
    if (id !== activePlayerId || this.isNpcTurn) return;

    const player = this.players.get(id);
    if (!player || player.hp <= 0 || player.mpPoints <= 0) return;

    // Calcula rota completa com o A*
    const startPos = { x: player.x, y: player.y };
    const targetPos = { x, y };
    const fullPath = findPath(startPos, targetPos);

    if (fullPath.length === 0) return;

    // Trunca o caminho de acordo com os PMs restantes do jogador
    const allowedSteps = Math.min(player.mpPoints, fullPath.length);
    const truncatedPath = fullPath.slice(0, allowedSteps);

    // Salva o caminho truncado no player para animação do loop
    player.path = truncatedPath;
    
    // Desconta os PMs consumidos
    player.mpPoints -= allowedSteps;

    // Define alvos virtuais de parada para sincronia
    if (truncatedPath.length > 0) {
      const finalPos = truncatedPath[truncatedPath.length - 1];
      player.targetX = finalPos.x;
      player.targetY = finalPos.y;
    }
  }

  /**
   * Implementação da conjuração de magia limitada por PA (Pontos de Ação)
   */
  public override castAbility(id: string, key: 'Q' | 'W', targetX: number, targetY: number) {
    const activePlayerId = this.turnOrder[this.activePlayerIndex];
    if (id !== activePlayerId || this.isNpcTurn) return;

    const player = this.players.get(id);
    if (!player || player.hp <= 0 || player.ap <= 0) return;

    const config = GAME_SETTINGS.ABILITIES[key];
    if (player.mp < config.MANA_COST) return;

    // Consome Mana e PA
    player.mp -= config.MANA_COST;
    player.ap -= TURN_RULES.AP_COST_ABILITY;

    // Cria o Projétil
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

  /**
   * Notifica a troca de turnos
   */
  private broadcastTurnInfo() {
    const activePlayerId = this.turnOrder[this.activePlayerIndex] || null;
    this.io.emit('turn_update', {
      activePlayerId,
      turnOrder: this.turnOrder,
      isNpcTurn: this.isNpcTurn
    });
  }

  private getDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  public override destroy() {
    if (this.loopInterval) {
      clearInterval(this.loopInterval);
    }
  }
}
