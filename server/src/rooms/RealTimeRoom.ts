import { Server } from 'socket.io';
import { BaseRoom, type ServerPlayer } from './BaseRoom.js';
import { 
  GAME_SETTINGS, 
  HERO_CATALOG,
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
  // Controle de trickle de ouro (1 ouro por segundo por jogador)
  private lastGoldTrickle: number = Date.now();

  private tick() {
    const now = Date.now();
    const dt = (now - this.lastTickTime) / 1000;
    this.lastTickTime = now;

    // 0. Processar itens (regen passivo) e buffs ativos
    this.processItemRegen(dt);

    // 0.1 Trickle de ouro (1/s)
    if (now - this.lastGoldTrickle >= 1000) {
      this.lastGoldTrickle = now;
      for (const player of this.players.values()) {
        if (player.hp > 0 && !player.isDisconnected) {
          this.addGold(player.id, 1);
        }
      }
    }

    // 0.2 Processar DoT (dano ao longo do tempo) e Slow dos buffs
    for (const player of this.players.values()) {
      if (player.hp <= 0 || player.isDisconnected) continue;
      for (const buff of player.activeBuffs) {
        if (buff.type === 'DOT' && buff.expiresAt > now) {
          player.hp = Math.max(0, player.hp - buff.value * dt);
        }
      }
    }

    // 1. Movimentação dos Jogadores ao longo dos waypoints / Auto-Ataques
    for (const player of this.players.values()) {
      if (player.hp <= 0) continue;

      // 1.0 Postura Agressiva: Foca inimigos próximos se estiver parado (Auto-Acquire Aggro)
      if (!player.targetId && (!player.path || player.path.length === 0)) {
        let nearestEnemy: any = null;
        let bestDist = player.attackRange + 120;

        for (const creep of this.creeps.values()) {
          if (creep.hp > 0) {
            const dist = this.getDistance(player, creep);
            if (dist < bestDist) {
              bestDist = dist;
              nearestEnemy = creep;
            }
          }
        }

        for (const p of this.players.values()) {
          if (p.id !== player.id && p.hp > 0 && p.team !== player.team) {
            const dist = this.getDistance(player, p);
            if (dist < bestDist) {
              bestDist = dist;
              nearestEnemy = p;
            }
          }
        }

        if (nearestEnemy) {
          player.targetId = nearestEnemy.id;
        }
      }

      // 1.1 Se o jogador tem um alvo focado (targetId)
      if (player.targetId) {
        let targetUnit: any = this.creeps.get(player.targetId) || this.players.get(player.targetId);

        if (targetUnit && targetUnit.hp > 0) {
          const distToTarget = this.getDistance(player, targetUnit);
          const heroDef = HERO_CATALOG[player.heroId || 'axe'];
          const isRanged = heroDef?.isRanged || false;

          if (distToTarget <= player.attackRange) {
            player.path = []; // Para de andar

            // Velocidade de ataque: 1000ms base, Gloves of Haste reduzem 20%
            const attackInterval = player.items.includes('gloves') ? 800 : 1000;

            // Ataca se o cooldown tiver expirado
            if (now - player.lastAttackTime > attackInterval) {
              player.lastAttackTime = now;

              if (isRanged) {
                // Ranged: Cria um projétil de auto-ataque guiado
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
                // Melee: Causa dano instantâneo
                targetUnit.hp = Math.max(0, targetUnit.hp - player.baseDamage);

                // Verificação de Lifesteal para ataques corpo a corpo
                let lifestealPct = 0;
                if (player.heroId === 'broodmother' && this.isBuffActive(player, 'R', 10000)) lifestealPct = 0.8;
                if (player.heroId === 'chaos_knight') lifestealPct = 0.35; // Lifesteal passivo crítico
                if (lifestealPct > 0) {
                  player.hp = Math.min(player.maxHp, player.hp + player.baseDamage * lifestealPct);
                }

                this.io.emit('unit_attacked', {
                  attackerId: player.id,
                  targetId: targetUnit.id,
                  damage: player.baseDamage,
                  melee: true
                });

                if (targetUnit.hp <= 0) {
                  this.handleUnitDeath(targetUnit, player);
                  player.targetId = null;
                }
              }
            }
          } else {
            // Recalcula o caminho periodicamente (~3 vezes por segundo) ou se estiver vazio para evitar jitter e travamento
            if (!player.path || player.path.length === 0 || Math.random() < 0.1) {
              player.path = findPath({ x: player.x, y: player.y }, { x: targetUnit.x, y: targetUnit.y });
            }
          }
        } else {
          player.targetId = null;
        }
      }

      // 1.2 Processa a movimentação mecânica com velocidade dinâmica (com velocidade base e buffs)
      if (player.path && player.path.length > 0) {
        const nextWaypoint = player.path[0];
        // player.speed já inclui bônus de itens (Boots, etc.)
        let speed = player.speed;

        // Aplica os buffs de velocidade originais do Dota
        if (player.heroId === 'centaur' && this.isBuffActive(player, 'R', 8000)) {
          speed += 150; // Stampede
        } else if (player.heroId === 'alchemist' && this.isBuffActive(player, 'R', 15000)) {
          speed += 100; // Chemical Rage
        } else if (player.heroId === 'dark_seer' && this.isBuffActive(player, 'E', 5000)) {
          speed += 150; // Surge
        } else if (player.heroId === 'doom' && this.isBuffActive(player, 'W', 10000)) {
          speed += 70; // Scorched Earth
        }

        // Aplica slow de buffs ativos
        const now2 = Date.now();
        const slowBuff = player.activeBuffs.find(b => b.type === 'SLOW' && b.expiresAt > now2);
        if (slowBuff) {
          speed = speed * (1 - slowBuff.value);
        }

        const maxDist = speed * dt;
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

    // 2. Inteligência Artificial de Creeps Neutros e Ilusões
    for (const creep of this.creeps.values()) {
      if (creep.hp <= 0) {
        this.creeps.delete(creep.id);
        continue;
      }

      // Expira clones/ilusões após o tempo de vida limite
      const cAny = creep as any;
      if (cAny.isIllusion && cAny.lifetime && Date.now() > cAny.lifetime) {
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

          // Recalcula rota A* periodicamente (~3 vezes por segundo) para seguir jogador em movimento
          if (!creep.path || creep.path.length === 0 || Math.random() < 0.1) {
            creep.path = findPath({ x: creep.x, y: creep.y }, { x: target.x, y: target.y });
          }

          if (creep.path && creep.path.length > 0) {
            const nextWaypoint = creep.path[0];
            const maxDist = GAME_SETTINGS.CREEPS.SPEED * dt;
            const currentPos = { x: creep.x, y: creep.y };
            
            const nextPos = moveTowards(currentPos, nextWaypoint, maxDist);
            creep.x = nextPos.x;
            creep.y = nextPos.y;

            const distToWaypoint = Math.sqrt(
              Math.pow(nextWaypoint.x - creep.x, 2) + Math.pow(nextWaypoint.y - creep.y, 2)
            );
            if (distToWaypoint < 4) {
              creep.path.shift();
            }
          }
        } else {
          // Ataque básico com cooldown fixo de 1.5s (não mais aleatório)
          creep.path = [];
          const creepAny = creep as any;
          if (now - (creepAny.lastAttackTime || 0) > 1500) {
            creepAny.lastAttackTime = now;
            target.hp = Math.max(0, target.hp - GAME_SETTINGS.CREEPS.DAMAGE);
            this.io.emit('unit_attacked', {
              attackerId: creep.id,
              targetId: target.id,
              damage: GAME_SETTINGS.CREEPS.DAMAGE
            });
            if (target.hp <= 0) {
              this.killPlayerInternal(target);
            }
          }
        }
      } else {
        // Retorno ao ponto de spawn original na selva (evita perambulação)
        const destX = creep.spawnX !== undefined ? creep.spawnX : creep.targetX;
        const destY = creep.spawnY !== undefined ? creep.spawnY : creep.targetY;

        if (creep.x !== destX || creep.y !== destY) {
          if (!creep.path || creep.path.length === 0) {
            creep.path = findPath({ x: creep.x, y: creep.y }, { x: destX, y: destY });
          }

          if (creep.path && creep.path.length > 0) {
            const nextWaypoint = creep.path[0];
            const maxDist = GAME_SETTINGS.CREEPS.SPEED * dt;
            const currentPos = { x: creep.x, y: creep.y };
            
            const nextPos = moveTowards(currentPos, nextWaypoint, maxDist);
            creep.x = nextPos.x;
            creep.y = nextPos.y;

            const distToWaypoint = Math.sqrt(
              Math.pow(nextWaypoint.x - creep.x, 2) + Math.pow(nextWaypoint.y - creep.y, 2)
            );
            if (distToWaypoint < 4) {
              creep.path.shift();
            }
          }
        } else {
          creep.path = [];
          // Reseta o target para a posição original de spawn para que ele permaneça estático no camp
          creep.targetX = destX;
          creep.targetY = destY;
        }
      }
    }

    // 3. Atualizar Projéteis
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
              // Verificação de Lifesteal para ataques ranged
              let lifestealPct = 0;
              if (caster.heroId === 'broodmother' && this.isBuffActive(caster, 'R', 10000)) lifestealPct = 0.8;
              if (lifestealPct > 0) {
                caster.hp = Math.min(caster.maxHp, caster.hp + proj.damage * lifestealPct);
              }

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

    // 4. Ataque das Torres Sentinel/Scourge (Ataca heróis ou creeps inimigos)
    this.towers.forEach(tower => {
      if (tower.hp <= 0) return;

      if (now - tower.lastShotTime > 1500) {
        let target: any = null;
        let minDist = GAME_SETTINGS.TOWERS.ATTACK_RANGE;

        // Procura heróis inimigos
        for (const player of this.players.values()) {
          if (player.hp <= 0 || player.team === tower.team) continue;
          const dist = this.getDistance(tower, player);
          if (dist < minDist) {
            minDist = dist;
            target = player;
          }
        }

        // Procura creeps inimigos (se não houver herói, ou ataca o mais próximo)
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
          tower.lastShotTime = now;

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
          // Torres receberam dano — informa o delta
          this.markTowersChanged();
        }
      }
    });

    // 5. Roshan AI — ataca o herói mais próximo em raio de 350px a cada 2s
    if (this.roshan.alive) {
      let closestPlayer: ServerPlayer | null = null;
      let closestDist = 350;
      for (const player of this.players.values()) {
        if (player.hp <= 0) continue;
        const dx = player.x - this.roshan.x;
        const dy = player.y - this.roshan.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < closestDist) { closestDist = d; closestPlayer = player; }
      }
      const roshAny = this.roshan as any;
      if (closestPlayer && now - (roshAny.lastAttackTime || 0) > 2000) {
        roshAny.lastAttackTime = now;
        const roshDmg = 120;
        closestPlayer.hp = Math.max(0, closestPlayer.hp - roshDmg);
        this.io.emit('unit_attacked', {
          attackerId: 'roshan',
          targetId: closestPlayer.id,
          damage: roshDmg
        });
        if (closestPlayer.hp <= 0) {
          this.killPlayerInternal(closestPlayer);
        }
      }
    }

    // Envia o estado completo no modo NORMAL
    this.sendGameState('NORMAL');
  }



  /**
   * Define o destino do jogador na movimentação A*
   */
  public override movePlayer(id: string, x: number, y: number) {
    const player = this.players.get(id);
    if (!player || player.hp <= 0) return;

    // 1. Procura se há um alvo (creep ou player inimigo) próximo ao local do clique
    let foundTarget: any = null;
    const clickRadius = 64;

    for (const creep of this.creeps.values()) {
      if (creep.hp > 0 && this.getDistance({ x, y }, creep) < clickRadius) {
        foundTarget = creep;
        break;
      }
    }

    if (!foundTarget) {
      for (const p of this.players.values()) {
        if (p.id !== id && p.hp > 0 && p.team !== player.team && this.getDistance({ x, y }, p) < clickRadius) {
          foundTarget = p;
          break;
        }
      }
    }

    if (foundTarget) {
      player.targetId = foundTarget.id;
      player.targetX = foundTarget.x;
      player.targetY = foundTarget.y;
      player.path = findPath({ x: player.x, y: player.y }, { x: foundTarget.x, y: foundTarget.y });
    } else {
      player.targetId = null;
      const targetX = Math.max(0, Math.min(GAME_SETTINGS.MAP.WIDTH, x));
      const targetY = Math.max(0, Math.min(GAME_SETTINGS.MAP.HEIGHT, y));
      player.targetX = targetX;
      player.targetY = targetY;
      player.path = findPath({ x: player.x, y: player.y }, { x: targetX, y: targetY });
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
      this.io.emit('kill_event', {
        killerId: killer.id,
        killerName: killer.username,
        killerHeroId: killer.heroId,
        victimId: deadUnit.id,
        victimName: deadUnit.username,
        victimHeroId: deadUnit.heroId
      });
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
