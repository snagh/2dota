import { Server } from 'socket.io';
import { BaseRoom, type ServerPlayer } from './BaseRoom.js';
import { 
  GAME_SETTINGS, 
  TURN_RULES, 
  HERO_CATALOG,
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

    // 3. Atualizar Projéteis (Modo Turno)
    for (const [projId, proj] of this.projectiles.entries()) {
      let destroyed = proj.distanceTraveled >= proj.maxRange;

      if (proj.isAutoAttack && proj.targetId) {
        const target = this.players.get(proj.targetId) || this.creeps.get(proj.targetId);
        if (target && target.hp > 0) {
          const dx = target.x - proj.position.x;
          const dy = target.y - proj.position.y;
          const distToTarget = Math.sqrt(dx * dx + dy * dy);
          
          if (distToTarget > 0) {
            proj.direction = { x: dx / distToTarget, y: dy / distToTarget };
          }

          const stepDistance = proj.speed * dt;
          proj.position.x += proj.direction.x * stepDistance;
          proj.position.y += proj.direction.y * stepDistance;
          proj.distanceTraveled += stepDistance;

          const collisionDist = proj.radius + ('radius' in target ? target.radius : GAME_SETTINGS.PLAYER.RADIUS);
          if (distToTarget <= collisionDist) {
            target.hp = Math.max(0, target.hp - proj.damage);
            destroyed = true;

            const caster = this.players.get(proj.casterId);
            if (caster) {
              this.io.emit('unit_attacked', {
                attackerId: proj.casterId,
                targetId: target.id,
                damage: proj.damage
              });

              if (target.hp <= 0) {
                this.handleUnitDeath(target, caster);
              }
            }
          }
        } else {
          destroyed = true;
        }
      } else {
        const stepDistance = proj.speed * dt;
        proj.position.x += proj.direction.x * stepDistance;
        proj.position.y += proj.direction.y * stepDistance;
        proj.distanceTraveled += stepDistance;

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
                if (caster) {
                  this.handleUnitDeath(player, caster);
                }
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

              if (creep.hp <= 0) {
                const caster = this.players.get(proj.casterId);
                if (caster) {
                  this.handleUnitDeath(creep, caster);
                }
              }
              break;
            }
          }
        }
      }

      if (destroyed) {
        this.projectiles.delete(projId);
      }
    }

    // Limpeza de creeps mortos (Modo Turno)
    for (const creep of this.creeps.values()) {
      if (creep.hp <= 0) {
        this.creeps.delete(creep.id);
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

    // 1. Torres atacam inimigos próximos (heróis ou creeps)
    this.towers.forEach(tower => {
      if (tower.hp <= 0) return;
      
      let target: any = null;
      let minDist = GAME_SETTINGS.TOWERS.ATTACK_RANGE;

      // Busca heróis inimigos
      for (const player of this.players.values()) {
        if (player.hp <= 0 || player.team === tower.team) continue;
        const dist = this.getDistance(tower, player);
        if (dist < minDist) {
          minDist = dist;
          target = player;
        }
      }

      // Busca creeps inimigos
      for (const creep of this.creeps.values()) {
        if (creep.hp <= 0 || creep.team === tower.team) continue;
        const dist = this.getDistance(tower, creep);
        if (dist < minDist) {
          minDist = dist;
          target = creep;
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
          if (target.id.includes('creep')) {
            this.creeps.delete(target.id);
          } else {
            this.killPlayerInternal(target);
          }
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
            this.killPlayerInternal(target);
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
   * Implementação da movimentação limitada por PM (Pontos de Movimento) ou Auto-Ataque com PA
   */
  public override movePlayer(id: string, x: number, y: number) {
    const activePlayerId = this.turnOrder[this.activePlayerIndex];
    if (id !== activePlayerId || this.isNpcTurn) return;

    const player = this.players.get(id);
    if (!player || player.hp <= 0) return;

    // 1. Procura se há um alvo inimigo focado pelo clique
    let targetUnit: any = null;
    const clickRadius = 64;

    for (const creep of this.creeps.values()) {
      if (creep.hp > 0 && Math.sqrt(Math.pow(creep.x - x, 2) + Math.pow(creep.y - y, 2)) < clickRadius) {
        targetUnit = creep;
        break;
      }
    }

    if (!targetUnit) {
      for (const p of this.players.values()) {
        if (p.id !== id && p.hp > 0 && p.team !== player.team && Math.sqrt(Math.pow(p.x - x, 2) + Math.pow(p.y - y, 2)) < clickRadius) {
          targetUnit = p;
          break;
        }
      }
    }

    if (targetUnit) {
      const dist = Math.sqrt(Math.pow(targetUnit.x - player.x, 2) + Math.pow(targetUnit.y - player.y, 2));
      
      if (dist <= player.attackRange) {
        // Ataque básico (Consome 1 PA)
        if (player.ap >= 1) {
          player.ap -= 1;
          const heroDef = HERO_CATALOG[player.heroId || 'axe'];
          const isRanged = heroDef?.isRanged || false;

          if (isRanged) {
            // Ranged projectile
            const projectileId = `proj_aa_${player.id}_${this.projectileIdCounter++}`;
            const dirX = targetUnit.x - player.x;
            const dirY = targetUnit.y - player.y;
            const dirVec = normalize({ x: dirX, y: dirY });

            let aaColor = 0xff5a1f;
            if (heroDef) {
              if (heroDef.attribute === 'STR') aaColor = 0xef4444;
              else if (heroDef.attribute === 'AGI') aaColor = 0x10b981;
              else if (heroDef.attribute === 'INT') aaColor = 0x3b82f6;
            }

            const newProjectile: SkillshotProjectile = {
              id: projectileId,
              casterId: player.id,
              position: { x: player.x, y: player.y },
              direction: dirVec,
              speed: 600,
              radius: 8,
              damage: player.baseDamage,
              distanceTraveled: 0,
              maxRange: player.attackRange + 150,
              targetId: targetUnit.id,
              isAutoAttack: true,
              color: aaColor
            };

            this.projectiles.set(projectileId, newProjectile);

            this.io.emit('ability_casted', {
              casterId: player.id,
              key: 'AA',
              projectileId,
              position: { x: player.x, y: player.y },
              direction: dirVec,
              color: aaColor
            });

          } else {
            // Melee instant damage
            targetUnit.hp = Math.max(0, targetUnit.hp - player.baseDamage);

            this.io.emit('unit_attacked', {
              attackerId: player.id,
              targetId: targetUnit.id,
              damage: player.baseDamage,
              melee: true
            });

            if (targetUnit.hp <= 0) {
              this.handleUnitDeath(targetUnit, player);
            }
          }
        }
        return;
      } else {
        // Fora do alcance, move o jogador o mais perto possível usando A*
        if (player.mpPoints <= 0) return;
        const startPos = { x: player.x, y: player.y };
        const fullPath = findPath(startPos, { x: targetUnit.x, y: targetUnit.y });
        if (fullPath.length === 0) return;

        const allowedSteps = Math.min(player.mpPoints, fullPath.length);
        const truncatedPath = fullPath.slice(0, allowedSteps);

        player.path = truncatedPath;
        player.mpPoints -= allowedSteps;

        if (truncatedPath.length > 0) {
          const finalPos = truncatedPath[truncatedPath.length - 1];
          player.targetX = finalPos.x;
          player.targetY = finalPos.y;
        }
      }
    } else {
      // Movimentação normal sem alvo
      if (player.mpPoints <= 0) return;
      const startPos = { x: player.x, y: player.y };
      const fullPath = findPath(startPos, { x, y });
      if (fullPath.length === 0) return;

      const allowedSteps = Math.min(player.mpPoints, fullPath.length);
      const truncatedPath = fullPath.slice(0, allowedSteps);

      player.path = truncatedPath;
      player.mpPoints -= allowedSteps;

      if (truncatedPath.length > 0) {
        const finalPos = truncatedPath[truncatedPath.length - 1];
        player.targetX = finalPos.x;
        player.targetY = finalPos.y;
      }
    }
  }

  private handleUnitDeath(deadUnit: any, killer: ServerPlayer) {
    if (deadUnit.id.includes('creep')) {
      this.creeps.delete(deadUnit.id);
      
      const shareRadius = 400;
      const nearbyPlayers = Array.from(this.players.values()).filter(
        p => p.hp > 0 && Math.sqrt(Math.pow(p.x - deadUnit.x, 2) + Math.pow(p.y - deadUnit.y, 2)) < shareRadius
      );
      if (nearbyPlayers.length > 0) {
        const xpPerPlayer = Math.ceil(50 / nearbyPlayers.length);
        nearbyPlayers.forEach(p => {
          this.addXp(p.id, xpPerPlayer);
        });
      }
    } else {
      killer.kills++;
      this.killPlayerInternal(deadUnit);

      const shareRadius = 400;
      const nearbyAllyPlayers = Array.from(this.players.values()).filter(
        p => p.hp > 0 && p.team === killer.team && Math.sqrt(Math.pow(p.x - deadUnit.x, 2) + Math.pow(p.y - deadUnit.y, 2)) < shareRadius
      );
      if (nearbyAllyPlayers.length > 0) {
        const xpPerPlayer = Math.ceil(200 / nearbyAllyPlayers.length);
        nearbyAllyPlayers.forEach(p => {
          this.addXp(p.id, xpPerPlayer);
        });
      }
    }
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
