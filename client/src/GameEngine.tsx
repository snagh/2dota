import React, { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { Socket } from 'socket.io-client';
import { GAME_SETTINGS, HERO_CATALOG, getObstacleGrid, findPath, type Vector2D } from 'shared';

interface GameEngineProps {
  socket: Socket | null;
  username: string;
  onUpdatePlayerStats: (
    hp: number,
    maxHp: number,
    mp: number,
    maxMp: number,
    kills: number,
    deaths: number,
    ap: number,
    mpPoints: number,
    serverMode: any,
    activePlayerId: string | null,
    isNpcTurn: boolean,
    level: number,
    xp: number,
    maxXp: number
  ) => void;
}

// ─── Types for new features ─────────────────────────────────────────────────
interface FloatingText {
  text: string;
  x: number;
  y: number;
  createdAt: number;
  duration: number;
  color: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: number;
  life: number;
  maxLife: number;
}

export default function GameEngine({ socket, username, onUpdatePlayerStats }: GameEngineProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);

  // Referências mutáveis para o loop do PixiJS (evita closures e re-renders)
  const gameStateRef = useRef<any>(null);
  const mouseScreenPos = useRef<Vector2D>({ x: 0, y: 0 });
  const localPlayerId = useRef<string>('');

  // ── FASE 1: Client-Side Prediction ──────────────────────────────────────
  const predictedPosRef = useRef<{ x: number; y: number } | null>(null);
  const predictedPathRef = useRef<{ x: number; y: number }[]>([]);

  // ── FASE 4: Floating Combat Text ─────────────────────────────────────────
  const floatingTexts = useRef<FloatingText[]>([]);
  const fctIndexRef = useRef(0);

  // ── FASE 4: Screen Shake ─────────────────────────────────────────────────
  const screenShake = useRef({ intensity: 0, decayMs: 0 });

  // ── FASE 4: Particles ────────────────────────────────────────────────────
  const particles = useRef<Particle[]>([]);

  // ── FASE 4: Hit-Stop ─────────────────────────────────────────────────────
  const hitStopUntil = useRef(0);

  // ── FASE 4: Ability Range Preview ────────────────────────────────────────
  const holdingKey = useRef<string | null>(null);

  // ── Tower Cache ───────────────────────────────────────────────────────────
  const cachedTowersRef = useRef<any[]>([]);

  // Estados locais para renderizar na UI do HUD do React
  const [qCooldown, setQCooldown] = useState(0);
  const [wCooldown, setWCooldown] = useState(0);
  const [eCooldown, setECooldown] = useState(0);
  const [rCooldown, setRCooldown] = useState(0);

  useEffect(() => {
    if (!containerRef.current || !socket) return;

    localPlayerId.current = socket.id || '';

    // 1. Inicializa o PixiJS App
    const app = new PIXI.Application({
      resizeTo: window,
      antialias: true,
      backgroundColor: 0x0a0a0c,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    appRef.current = app;
    containerRef.current.appendChild(app.view as HTMLCanvasElement);

    // Desabilita menu de contexto (clique direito padrão) globalmente
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    window.addEventListener('contextmenu', handleContextMenu);

    // 2. Cria contêineres para o Mundo e Câmera
    const worldContainer = new PIXI.Container();
    app.stage.addChild(worldContainer);

    const gridLayer = new PIXI.Container();
    const mapDecorLayer = new PIXI.Container();
    const entitiesLayer = new PIXI.Container();
    const projectilesLayer = new PIXI.Container();
    const fxLayer = new PIXI.Container();
    const uiLayer = new PIXI.Container();

    worldContainer.addChild(gridLayer);
    worldContainer.addChild(mapDecorLayer);
    worldContainer.addChild(entitiesLayer);
    worldContainer.addChild(projectilesLayer);
    worldContainer.addChild(fxLayer);
    worldContainer.addChild(uiLayer);

    // Desenha o Grid de Fundo do Mapa
    const gridGraphic = new PIXI.Graphics();
    gridGraphic.lineStyle(1, 0x181822, 1);
    const tileSize = GAME_SETTINGS.MAP.TILE_SIZE;

    // Desenha linhas verticais
    for (let x = 0; x <= GAME_SETTINGS.MAP.WIDTH; x += tileSize) {
      gridGraphic.moveTo(x, 0);
      gridGraphic.lineTo(x, GAME_SETTINGS.MAP.HEIGHT);
    }
    // Desenha linhas horizontais
    for (let y = 0; y <= GAME_SETTINGS.MAP.HEIGHT; y += tileSize) {
      gridGraphic.moveTo(0, y);
      gridGraphic.lineTo(GAME_SETTINGS.MAP.WIDTH, y);
    }

    // Contorno do Mapa
    gridGraphic.lineStyle(8, 0xff5a1f, 0.4);
    gridGraphic.drawRect(0, 0, GAME_SETTINGS.MAP.WIDTH, GAME_SETTINGS.MAP.HEIGHT);
    gridLayer.addChild(gridGraphic);

    // Desenha as Bases (Sentinel e Scourge)
    const baseGraphics = new PIXI.Graphics();
    // Sentinel (Verde / Inferior Esquerdo)
    baseGraphics.beginFill(0x1b4d22, 0.3);
    baseGraphics.lineStyle(4, 0x2e7d32, 0.7);
    baseGraphics.drawCircle(150, 2250, 180);
    // Scourge (Vermelho / Superior Direito)
    baseGraphics.beginFill(0x4d1b1b, 0.3);
    baseGraphics.lineStyle(4, 0xc62828, 0.7);
    baseGraphics.drawCircle(2250, 150, 180);
    mapDecorLayer.addChild(baseGraphics);

    // Desenha o Rio Central (Água Azul Translúcida)
    const riverGraphics = new PIXI.Graphics();
    riverGraphics.lineStyle(160, 0x1d4ed8, 0.25); // 160px de largura, azul dota translúcido
    riverGraphics.moveTo(0, 0);
    riverGraphics.lineTo(2400, 2400);
    mapDecorLayer.addChild(riverGraphics);

    // Desenha a Grade de Obstáculos Estáticos (A* Obstacles)
    const obstacleGrid = getObstacleGrid();
    const obstacleGraphics = new PIXI.Graphics();
    obstacleGraphics.beginFill(0x24242d, 0.45); // Cor de parede/obstáculo no mapa
    obstacleGraphics.lineStyle(1, 0x1d1d26, 0.4);
    for (let r = 0; r < obstacleGrid.length; r++) {
      for (let c = 0; c < obstacleGrid[r].length; c++) {
        if (obstacleGrid[r][c] === 1) {
          obstacleGraphics.drawRect(c * tileSize, r * tileSize, tileSize, tileSize);
        }
      }
    }
    obstacleGraphics.endFill();
    mapDecorLayer.addChild(obstacleGraphics);

    // 3. Gerenciadores gráficos de entidades dinâmicas e efeitos visuais
    const graphicsPool: Map<string, PIXI.Graphics> = new Map();
    const textPool: Map<string, PIXI.Text> = new Map();
    const visualEffects: any[] = [];

    // 4. Receber Estado do Servidor e Eventos de Combate
    socket.on('game_state', (state: any) => {
      // Cache towers when they arrive (towers may be sparse in updates)
      if (state.towers && Array.isArray(state.towers) && state.towers.length > 0) {
        cachedTowersRef.current = state.towers;
      }
      gameStateRef.current = state;
    });

    socket.on('level_up', (data: { playerId: string; level: number; maxHp: number; maxMp: number }) => {
      const state = gameStateRef.current;
      if (!state) return;
      const p = state.players.find((x: any) => x.id === data.playerId);
      if (p) {
        visualEffects.push({
          type: 'LEVEL_UP',
          x: p.x,
          y: p.y,
          targetId: data.playerId,
          createdAt: Date.now(),
          duration: 1000
        });

        // FCT: +LEVEL in green
        floatingTexts.current.push({
          text: `+LEVEL ${data.level}!`,
          x: p.x,
          y: p.y - 30,
          createdAt: Date.now(),
          duration: 1200,
          color: 0x22c55e
        });
      }
    });

    socket.on('unit_attacked', (data: { attackerId: string; targetId: string; damage: number; melee?: boolean }) => {
      const state = gameStateRef.current;
      const target = state
        ? (state.players.find((x: any) => x.id === data.targetId) ||
           (state.creeps && state.creeps.find((x: any) => x.id === data.targetId)))
        : null;

      // FCT: -damage in red/yellow
      const targetX = target ? target.x : 0;
      const targetY = target ? target.y : 0;
      if (target) {
        floatingTexts.current.push({
          text: `-${data.damage}`,
          x: targetX + (Math.random() - 0.5) * 20,
          y: targetY - 20,
          createdAt: Date.now(),
          duration: 900,
          color: data.damage > 80 ? 0xffd200 : 0xef4444
        });
      }

      // Screen Shake: if local player is the target
      if (data.targetId === localPlayerId.current) {
        screenShake.current.intensity = 8;
        screenShake.current.decayMs = 200;
      }

      if (data.melee) {
        if (target) {
          visualEffects.push({
            type: 'MELEE_SLASH',
            x: target.x,
            y: target.y,
            createdAt: Date.now(),
            duration: 150
          });

          // Particle Burst on melee impact
          for (let i = 0; i < 8; i++) {
            const angle = (Math.PI * 2 * i) / 8 + (Math.random() - 0.5) * 0.5;
            const speed = 60 + Math.random() * 80;
            particles.current.push({
              x: target.x,
              y: target.y,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              color: 0xef4444,
              life: 0.35 + Math.random() * 0.2,
              maxLife: 0.35 + Math.random() * 0.2
            });
          }
        }

        // Hit-Stop: if local player is the attacker
        if (data.attackerId === localPlayerId.current) {
          hitStopUntil.current = Date.now() + 60;
        }
      }
    });

    // 5. Escutar inputs de mouse e teclado
    const handleWindowMouseMove = (e: MouseEvent) => {
      mouseScreenPos.current = { x: e.clientX, y: e.clientY };
    };

    const handleWindowMouseDown = (e: MouseEvent) => {
      if (e.button === 2) {
        // Botão Direito: Click-to-Move
        const canvas = app.view as HTMLCanvasElement;
        const canvasBounds = canvas.getBoundingClientRect();
        const mouseX = e.clientX - canvasBounds.left;
        const mouseY = e.clientY - canvasBounds.top;

        // Converte coordenadas de tela para coordenadas do mundo baseado na câmera
        const worldX = mouseX - app.screen.width / 2 + worldContainer.pivot.x;
        const worldY = mouseY - app.screen.height / 2 + worldContainer.pivot.y;

        socket.emit('move', { x: worldX, y: worldY });

        // Client-side prediction: compute path and start moving immediately
        const state = gameStateRef.current;
        if (state) {
          const lp = state.players.find((p: any) => p.id === localPlayerId.current);
          if (lp) {
            const startPos = predictedPosRef.current || { x: lp.x, y: lp.y };
            const path = findPath(startPos, { x: worldX, y: worldY });
            predictedPathRef.current = path;
            if (!predictedPosRef.current) {
              predictedPosRef.current = { x: lp.x, y: lp.y };
            }
          }
        }

        // Determina se o clique direito focou um inimigo (creep ou player inimigo)
        let isEnemyClicked = false;
        if (state) {
          const clickRadius = 64;
          const targetCreep = state.creeps && state.creeps.find(
            (c: any) => c.hp > 0 && Math.sqrt(Math.pow(c.x - worldX, 2) + Math.pow(c.y - worldY, 2)) < clickRadius
          );
          let targetEnemyPlayer = null;
          const localPlayer = state.players.find((p: any) => p.id === localPlayerId.current);
          if (localPlayer) {
            targetEnemyPlayer = state.players.find(
              (p: any) => p.id !== localPlayerId.current && p.hp > 0 && p.team !== localPlayer.team && Math.sqrt(Math.pow(p.x - worldX, 2) + Math.pow(p.y - worldY, 2)) < clickRadius
            );
          }
          if (targetCreep || targetEnemyPlayer) {
            isEnemyClicked = true;
          }
        }

        visualEffects.push({
          type: 'CLICK_INDICATOR',
          x: worldX,
          y: worldY,
          createdAt: Date.now(),
          duration: 300,
          color: isEnemyClicked ? 0xef4444 : 0x22c55e
        });
      }
    };

    // Cooldown trackers locais em milissegundos
    let qReadyTime = 0;
    let wReadyTime = 0;
    let eReadyTime = 0;
    let rReadyTime = 0;

    const handleWindowKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toUpperCase() as 'Q' | 'W' | 'E' | 'R';
      if (key === 'Q' || key === 'W' || key === 'E' || key === 'R') {
        // Set holdingKey for range preview BEFORE sending cast
        holdingKey.current = key;

        const now = Date.now();
        let readyTime = 0;
        if (key === 'Q') readyTime = qReadyTime;
        else if (key === 'W') readyTime = wReadyTime;
        else if (key === 'E') readyTime = eReadyTime;
        else if (key === 'R') readyTime = rReadyTime;

        if (now < readyTime) return; // Em cooldown

        // Smart Cast: Conjura habilidade na direção do mouse
        const canvas = app.view as HTMLCanvasElement;
        const canvasBounds = canvas.getBoundingClientRect();
        const mouseX = mouseScreenPos.current.x - canvasBounds.left;
        const mouseY = mouseScreenPos.current.y - canvasBounds.top;

        const worldX = mouseX - app.screen.width / 2 + worldContainer.pivot.x;
        const worldY = mouseY - app.screen.height / 2 + worldContainer.pivot.y;

        socket.emit('cast_ability', { key, x: worldX, y: worldY });

        // Aplica o cooldown visual local dinâmico
        const state = gameStateRef.current;
        if (state) {
          const localPlayer = state.players.find((p: any) => p.id === localPlayerId.current);
          if (localPlayer) {
            const heroDef = HERO_CATALOG[localPlayer.heroId || 'axe'];
            const cd = heroDef.abilities[key].cooldown;
            if (key === 'Q') qReadyTime = now + cd * 1000;
            else if (key === 'W') wReadyTime = now + cd * 1000;
            else if (key === 'E') eReadyTime = now + cd * 1000;
            else if (key === 'R') rReadyTime = now + cd * 1000;
          }
        }
      }
    };

    const handleWindowKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toUpperCase();
      if (key === holdingKey.current) {
        holdingKey.current = null;
      }
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mousedown', handleWindowMouseDown);
    window.addEventListener('keydown', handleWindowKeyDown);
    window.addEventListener('keyup', handleWindowKeyUp);

    // ── Minimap setInterval ───────────────────────────────────────────────
    let lastShakeTime = Date.now();
    const minimapInterval = setInterval(() => {
      const canvas = minimapRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const state = gameStateRef.current;

      const W = 200;
      const H = 200;
      const scaleX = W / GAME_SETTINGS.MAP.WIDTH;
      const scaleY = H / GAME_SETTINGS.MAP.HEIGHT;

      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, W, H);

      // Draw a subtle grid tint
      ctx.fillStyle = 'rgba(30,30,50,0.5)';
      ctx.fillRect(0, 0, W, H);

      if (state) {
        // Draw players
        state.players.forEach((p: any) => {
          const mx = p.x * scaleX;
          const my = p.y * scaleY;
          const isLocal = p.id === localPlayerId.current;

          if (isLocal) {
            // Bright white with square border
            ctx.strokeStyle = 'rgba(255,255,255,0.7)';
            ctx.lineWidth = 1;
            ctx.strokeRect(mx - 4, my - 4, 8, 8);
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(mx, my, 4, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.fillStyle = p.team === 1 ? '#22c55e' : '#ef4444';
            ctx.beginPath();
            ctx.arc(mx, my, 3, 0, Math.PI * 2);
            ctx.fill();
          }
        });

        // Draw Roshan if alive
        if (state.roshan && state.roshan.hp > 0) {
          const mx = state.roshan.x * scaleX;
          const my = state.roshan.y * scaleY;
          ctx.fillStyle = '#facc15';
          ctx.beginPath();
          ctx.arc(mx, my, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // White border outline
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(0, 0, W, H);
    }, 200);

    // 6. Pixi Ticker (Loop de Renderização a 60 FPS com Interpolação local)
    app.ticker.add((delta) => {
      const state = gameStateRef.current;
      if (!state) return;

      const nowMs = Date.now();

      // ── Hit-Stop check ────────────────────────────────────────────────
      const isHitStopped = nowMs < hitStopUntil.current;

      // Localiza o jogador local
      const localPlayer = state.players.find((p: any) => p.id === localPlayerId.current);

      if (!isHitStopped) {
        // ── FASE 1: Advance predicted position along path ───────────────
        if (localPlayer && predictedPosRef.current && predictedPathRef.current.length > 0) {
          const speed = (localPlayer.speed || 300) * (delta / 60);
          let remaining = speed;
          const path = predictedPathRef.current;

          while (remaining > 0 && path.length > 0) {
            const next = path[0];
            const dx: number = next.x - predictedPosRef.current.x;
            const dy: number = next.y - predictedPosRef.current.y;
            const dist: number = Math.sqrt(dx * dx + dy * dy);

            if (dist <= remaining) {
              predictedPosRef.current = { x: next.x, y: next.y };
              path.shift();
              remaining -= dist;
            } else {
              const ratio = remaining / dist;
              predictedPosRef.current = {
                x: predictedPosRef.current.x + dx * ratio,
                y: predictedPosRef.current.y + dy * ratio
              };
              remaining = 0;
            }
          }

          // Reconciliation with server position
          if (localPlayer) {
            const divergeX = localPlayer.x - predictedPosRef.current.x;
            const divergeY = localPlayer.y - predictedPosRef.current.y;
            const divergeDist = Math.sqrt(divergeX * divergeX + divergeY * divergeY);

            if (divergeDist > 64) {
              // Snap to server
              predictedPosRef.current = { x: localPlayer.x, y: localPlayer.y };
              predictedPathRef.current = [];
            } else {
              // Lerp toward server
              predictedPosRef.current.x += divergeX * 0.15;
              predictedPosRef.current.y += divergeY * 0.15;
            }
          }
        } else if (localPlayer && predictedPosRef.current && predictedPathRef.current.length === 0) {
          // Path exhausted; reconcile toward server
          const divergeX = localPlayer.x - predictedPosRef.current.x;
          const divergeY = localPlayer.y - predictedPosRef.current.y;
          const divergeDist = Math.sqrt(divergeX * divergeX + divergeY * divergeY);
          if (divergeDist > 64) {
            predictedPosRef.current = null;
          } else if (divergeDist > 1) {
            predictedPosRef.current.x += divergeX * 0.15;
            predictedPosRef.current.y += divergeY * 0.15;
          }
        }
      }

      if (localPlayer) {
        // Envia estatísticas de volta para o componente HUD do React
        onUpdatePlayerStats(
          localPlayer.hp,
          localPlayer.maxHp,
          localPlayer.mp,
          localPlayer.maxMp,
          localPlayer.kills,
          localPlayer.deaths,
          localPlayer.ap || 0,
          localPlayer.mpPoints || 0,
          state.gameMode || 'NORMAL',
          state.activePlayerId || null,
          state.isNpcTurn || false,
          localPlayer.level || 1,
          localPlayer.xp || 0,
          localPlayer.maxXp || 100
        );

        // Use predicted position for camera pivot (when available)
        const camX = predictedPosRef.current ? predictedPosRef.current.x : localPlayer.x;
        const camY = predictedPosRef.current ? predictedPosRef.current.y : localPlayer.y;

        // Suaviza a Câmera seguindo o jogador local (via predicted pos)
        worldContainer.pivot.x += (camX - worldContainer.pivot.x) * 0.15;
        worldContainer.pivot.y += (camY - worldContainer.pivot.y) * 0.15;
      }

      // Centraliza câmera na viewport da tela
      worldContainer.position.x = app.screen.width / 2;
      worldContainer.position.y = app.screen.height / 2;

      // ── Screen Shake ──────────────────────────────────────────────────
      if (screenShake.current.intensity > 0) {
        const shakeX = (Math.random() - 0.5) * 2 * screenShake.current.intensity;
        const shakeY = (Math.random() - 0.5) * 2 * screenShake.current.intensity;
        worldContainer.position.x += shakeX;
        worldContainer.position.y += shakeY;

        const elapsed = nowMs - lastShakeTime;
        const decayRate = screenShake.current.intensity / (screenShake.current.decayMs / 16.67);
        screenShake.current.intensity = Math.max(0, screenShake.current.intensity - decayRate * delta);
      }
      lastShakeTime = nowMs;

      // Conjunto de IDs presentes neste tick para limpeza dos expirados
      const activeIds = new Set<string>();

      // Desenha o círculo de alcance de PM (Modo Turno)
      const rangeId = 'local_player_range';
      let rangeGraphic = graphicsPool.get(rangeId);
      if (!rangeGraphic) {
        rangeGraphic = new PIXI.Graphics();
        gridLayer.addChild(rangeGraphic);
        graphicsPool.set(rangeId, rangeGraphic);
      }
      rangeGraphic.clear();
      activeIds.add(rangeId);

      if (state.gameMode === 'TURN_BASED' && localPlayer && state.activePlayerId === localPlayerId.current && localPlayer.mpPoints > 0) {
        rangeGraphic.beginFill(0x8257e5, 0.08); // Roxo translúcido
        rangeGraphic.lineStyle(1.5, 0x8257e5, 0.4);
        rangeGraphic.drawCircle(localPlayer.x, localPlayer.y, localPlayer.mpPoints * GAME_SETTINGS.MAP.TILE_SIZE);
        rangeGraphic.endFill();
      }

      // ── FASE 4: Ability Range Preview ──────────────────────────────────
      const abilityRangeId = 'ability_range_preview';
      let abilityRangeGraphic = graphicsPool.get(abilityRangeId);
      if (!abilityRangeGraphic) {
        abilityRangeGraphic = new PIXI.Graphics();
        gridLayer.addChild(abilityRangeGraphic);
        graphicsPool.set(abilityRangeId, abilityRangeGraphic);
      }
      abilityRangeGraphic.clear();
      activeIds.add(abilityRangeId);

      if (holdingKey.current && localPlayer) {
        const heroDef = HERO_CATALOG[localPlayer.heroId || 'axe'];
        if (heroDef) {
          const abilityKey = holdingKey.current as 'Q' | 'W' | 'E' | 'R';
          const ability = heroDef.abilities[abilityKey];
          if (ability && ability.range && ability.range > 0) {
            const posX = predictedPosRef.current ? predictedPosRef.current.x : localPlayer.x;
            const posY = predictedPosRef.current ? predictedPosRef.current.y : localPlayer.y;
            abilityRangeGraphic.lineStyle(2, 0x818cf8, 0.55);
            abilityRangeGraphic.beginFill(0x818cf8, 0.06);
            abilityRangeGraphic.drawCircle(posX, posY, ability.range);
            abilityRangeGraphic.endFill();
          }
        }
      }

      // Desenha a rota (caminho planejado A*) do jogador local
      const pathId = 'local_player_path';
      let pathGraphic = graphicsPool.get(pathId);
      if (!pathGraphic) {
        pathGraphic = new PIXI.Graphics();
        projectilesLayer.addChild(pathGraphic);
        graphicsPool.set(pathId, pathGraphic);
      }
      pathGraphic.clear();
      activeIds.add(pathId);

      // Draw predicted path
      const predPath = predictedPathRef.current;
      const predPos = predictedPosRef.current;
      if (localPlayer && predPos && predPath.length > 0) {
        pathGraphic.lineStyle(2, 0xffd200, 0.45); // Amarelo suave
        pathGraphic.moveTo(predPos.x, predPos.y);
        predPath.forEach((pt: any) => {
          pathGraphic!.lineTo(pt.x, pt.y);
        });
        predPath.forEach((pt: any) => {
          pathGraphic!.beginFill(0xffd200, 0.7);
          pathGraphic!.drawCircle(pt.x, pt.y, 3);
          pathGraphic!.endFill();
        });
      } else if (localPlayer && localPlayer.path && localPlayer.path.length > 0) {
        pathGraphic.lineStyle(2, 0xffd200, 0.45);
        pathGraphic.moveTo(localPlayer.x, localPlayer.y);
        localPlayer.path.forEach((pt: any) => {
          pathGraphic!.lineTo(pt.x, pt.y);
        });
        localPlayer.path.forEach((pt: any) => {
          pathGraphic!.beginFill(0xffd200, 0.7);
          pathGraphic!.drawCircle(pt.x, pt.y, 3);
          pathGraphic!.endFill();
        });
      }

      // 6.1 RENDERIZAR JOGADORES
      state.players.forEach((player: any) => {
        const id = player.id;
        activeIds.add(id);

        let g = graphicsPool.get(id);
        if (!g) {
          g = new PIXI.Graphics();
          entitiesLayer.addChild(g);
          graphicsPool.set(id, g);
        }

        // Limpa e redesenha o círculo do herói
        g.clear();

        const isSelf = id === localPlayerId.current;

        // Use predicted position for local player
        const drawX = isSelf && predictedPosRef.current ? predictedPosRef.current.x : player.x;
        const drawY = isSelf && predictedPosRef.current ? predictedPosRef.current.y : player.y;

        const heroDef = HERO_CATALOG[player.heroId];
        let attributeColor = 0xa855f7; // Roxo padrão
        if (heroDef) {
          if (heroDef.attribute === 'STR') attributeColor = 0xef4444; // Vermelho
          else if (heroDef.attribute === 'AGI') attributeColor = 0x10b981; // Verde
          else if (heroDef.attribute === 'INT') attributeColor = 0x3b82f6; // Azul
        }

        // Sombra de brilho sob o herói
        g.beginFill(attributeColor, 0.15);
        g.drawCircle(drawX, drawY, GAME_SETTINGS.PLAYER.RADIUS + 6);
        g.endFill();

        // Círculo principal
        g.beginFill(attributeColor);
        g.lineStyle(2.5, player.team === 1 ? 0x22c55e : 0xe11d48, 0.95);
        g.drawCircle(drawX, drawY, GAME_SETTINGS.PLAYER.RADIUS);
        g.endFill();

        // Barra de Vida
        const barWidth = 50;
        const barHeight = 6;
        const barX = drawX - barWidth / 2;
        const barY = drawY - GAME_SETTINGS.PLAYER.RADIUS - 16;

        g.lineStyle(0);
        g.beginFill(0x1f2937); // Fundo cinza
        g.drawRect(barX, barY, barWidth, barHeight);
        g.endFill();

        const hpPercentage = Math.max(0, player.hp / player.maxHp);
        g.beginFill(0x10b981); // Verde de vida
        g.drawRect(barX, barY, barWidth * hpPercentage, barHeight);
        g.endFill();

        // ── FASE 4: Buff/Debuff Bar above HP bar (local player only) ────
        if (isSelf && player.activeBuffs && player.activeBuffs.length > 0) {
          const buffSize = 12;
          const buffPadding = 2;
          const buffStartY = barY - buffSize - 4;
          player.activeBuffs.forEach((buff: string, idx: number) => {
            let buffColor = 0x6b7280;
            if (buff === 'SLOW') buffColor = 0x3b82f6;       // blue
            else if (buff === 'DOT') buffColor = 0xef4444;   // red
            else if (buff === 'SPEED_BOOST') buffColor = 0x22c55e; // green

            const buffX = drawX - (player.activeBuffs.length * (buffSize + buffPadding)) / 2 + idx * (buffSize + buffPadding);
            g!.beginFill(buffColor, 0.85);
            g!.lineStyle(1, 0xffffff, 0.4);
            g!.drawRect(buffX, buffStartY, buffSize, buffSize);
            g!.endFill();
          });
        }

        // Nome de jogador por cima
        let t = textPool.get(id + '_text');
        const heroName = heroDef ? heroDef.name : 'Hero';
        const displayName = `${player.username} (${heroName})`;

        if (!t) {
          t = new PIXI.Text(displayName, {
            fontFamily: 'Space Grotesk',
            fontSize: 12,
            fill: 0xffffff,
            align: 'center',
          });
          t.anchor.set(0.5);
          uiLayer.addChild(t);
          textPool.set(id + '_text', t);
        }
        t.position.set(drawX, drawY - GAME_SETTINGS.PLAYER.RADIUS - 26);
        t.text = displayName;
        t.alpha = player.hp <= 0 ? 0.3 : 1;
      });

      // 6.2 RENDERIZAR CREEPS (Monstros Neutros) E ILUSÕES
      if (state.creeps) {
        state.creeps.forEach((creep: any) => {
          const id = creep.id;
          activeIds.add(id);

          let g = graphicsPool.get(id);
          if (!g) {
            g = new PIXI.Graphics();
            entitiesLayer.addChild(g);
            graphicsPool.set(id, g);
          }

          g.clear();
          if (creep.isIllusion) {
            let illColor = 0xa855f7; // Roxo padrão
            const ownerHero = HERO_CATALOG[creep.heroId || 'axe'];
            if (ownerHero) {
              if (ownerHero.attribute === 'STR') illColor = 0xef4444;
              else if (ownerHero.attribute === 'AGI') illColor = 0x10b981;
              else if (ownerHero.attribute === 'INT') illColor = 0x3b82f6;
            }
            g.beginFill(illColor, 0.45); // Translúcido
            g.lineStyle(2, 0xffffff, 0.5);
            g.drawCircle(creep.x, creep.y, creep.radius);
            g.endFill();

            // Nome de ilusão por cima
            let t = textPool.get(id + '_text');
            const displayName = `${ownerHero ? ownerHero.name : 'Hero'} (Ilusão)`;
            if (!t) {
              t = new PIXI.Text(displayName, {
                fontFamily: 'Space Grotesk',
                fontSize: 10,
                fill: 0x93c5fd,
                align: 'center',
              });
              t.anchor.set(0.5);
              uiLayer.addChild(t);
              textPool.set(id + '_text', t);
            }
            t.position.set(creep.x, creep.y - creep.radius - 18);
            t.text = displayName;
            t.alpha = 0.8;
          } else {
            // Creep normal
            g.beginFill(0xa1a1aa); // Cor cinza/amarelo neutro
            g.lineStyle(1.5, 0xffffff, 0.6);
            g.drawCircle(creep.x, creep.y, creep.radius);
            g.endFill();

            let t = textPool.get(id + '_text');
            if (t) {
              t.destroy();
              textPool.delete(id + '_text');
            }
          }

          // HP bar do creep
          const barWidth = 30;
          const barHeight = 4;
          const barX = creep.x - barWidth / 2;
          const barY = creep.y - creep.radius - 10;

          g.lineStyle(0);
          g.beginFill(0x1f2937);
          g.drawRect(barX, barY, barWidth, barHeight);
          g.endFill();

          const hpPercentage = Math.max(0, creep.hp / creep.maxHp);
          g.beginFill(0xeab308); // Amarelo/Dourado neutro
          g.drawRect(barX, barY, barWidth * hpPercentage, barHeight);
          g.endFill();
        });
      }

      // 6.3 RENDERIZAR TORRES (usando cache)
      const towersToRender = cachedTowersRef.current.length > 0
        ? cachedTowersRef.current
        : (state.towers || []);

      towersToRender.forEach((tower: any) => {
        const id = tower.id;
        activeIds.add(id);

        let g = graphicsPool.get(id);
        if (!g) {
          g = new PIXI.Graphics();
          entitiesLayer.addChild(g);
          graphicsPool.set(id, g);
        }

        g.clear();
        const color = tower.team === 1 ? 0x1b4d22 : 0x4d1b1b;
        g.beginFill(color);
        g.lineStyle(4, tower.team === 1 ? 0x4ade80 : 0xef4444, 0.8);
        g.drawRect(
          tower.x - GAME_SETTINGS.TOWERS.RADIUS,
          tower.y - GAME_SETTINGS.TOWERS.RADIUS,
          GAME_SETTINGS.TOWERS.RADIUS * 2,
          GAME_SETTINGS.TOWERS.RADIUS * 2
        );
        g.endFill();

        // Barra de Vida da Torre
        const barWidth = 80;
        const barHeight = 8;
        const barX = tower.x - barWidth / 2;
        const barY = tower.y - GAME_SETTINGS.TOWERS.RADIUS - 18;

        g.lineStyle(0);
        g.beginFill(0x1f2937);
        g.drawRect(barX, barY, barWidth, barHeight);
        g.endFill();

        const hpPercentage = Math.max(0, tower.hp / tower.maxHp);
        g.beginFill(tower.team === 1 ? 0x10b981 : 0xef4444);
        g.drawRect(barX, barY, barWidth * hpPercentage, barHeight);
        g.endFill();

        // Nome da Torre
        let t = textPool.get(id + '_text');
        if (!t) {
          t = new PIXI.Text(tower.name, {
            fontFamily: 'Space Grotesk',
            fontSize: 10,
            fill: 0xa1a1aa,
            align: 'center'
          });
          t.anchor.set(0.5);
          uiLayer.addChild(t);
          textPool.set(id + '_text', t);
        }
        t.position.set(tower.x, tower.y - GAME_SETTINGS.TOWERS.RADIUS - 28);
        t.alpha = tower.hp <= 0 ? 0.2 : 1;
      });

      // 6.4 RENDERIZAR PROJÉTEIS (Skillshots)
      if (state.projectiles) {
        state.projectiles.forEach((proj: any) => {
          const id = proj.id;
          activeIds.add(id);

          let g = graphicsPool.get(id);
          if (!g) {
            g = new PIXI.Graphics();
            projectilesLayer.addChild(g);
            graphicsPool.set(id, g);
          }

          g.clear();
          // Brilho do projétil
          const projColor = proj.color || 0xffd200;
          g.beginFill(projColor, 0.4);
          g.drawCircle(proj.position.x, proj.position.y, proj.radius + 4);
          g.endFill();
          // Centro do projétil
          g.beginFill(0xffffff);
          g.drawCircle(proj.position.x, proj.position.y, proj.radius);
          g.endFill();
        });
      }

      // 6.5 Renderizar Efeitos Visuais (Level Up & Slash) + FCT + Particles
      fxLayer.removeChildren();
      const fxGraphics = new PIXI.Graphics();
      fxLayer.addChild(fxGraphics);

      // ── Particles ────────────────────────────────────────────────────
      const dt = delta / 60; // seconds per frame
      for (let i = particles.current.length - 1; i >= 0; i--) {
        const p = particles.current[i];
        if (!isHitStopped) {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.life -= dt;
          p.vx *= 0.92; // friction
          p.vy *= 0.92;
        }
        if (p.life <= 0) {
          particles.current.splice(i, 1);
          continue;
        }
        const lifeRatio = p.life / p.maxLife;
        const radius = 4 * lifeRatio;
        fxGraphics.beginFill(p.color, lifeRatio * 0.9);
        fxGraphics.drawCircle(p.x, p.y, Math.max(0.5, radius));
        fxGraphics.endFill();
      }

      // ── Floating Combat Text ─────────────────────────────────────────
      for (let i = floatingTexts.current.length - 1; i >= 0; i--) {
        const fct = floatingTexts.current[i];
        const elapsed = nowMs - fct.createdAt;
        if (elapsed >= fct.duration) {
          // Clean up text object if it exists
          const fctKey = `fct_${i}`;
          const fctTxt = textPool.get(fctKey);
          if (fctTxt) {
            fctTxt.destroy();
            textPool.delete(fctKey);
          }
          floatingTexts.current.splice(i, 1);
          continue;
        }

        const progress = elapsed / fct.duration;
        const floatY = fct.y - progress * 60; // float upward
        const alpha = progress < 0.7 ? 1 : 1 - (progress - 0.7) / 0.3;

        const fctKey = `fct_${i}`;
        let fctTxt = textPool.get(fctKey);
        if (!fctTxt) {
          fctTxt = new PIXI.Text(fct.text, {
            fontFamily: 'Space Grotesk',
            fontSize: 16,
            fontWeight: 'bold',
            fill: fct.color,
            stroke: 0x000000,
            strokeThickness: 3,
          });
          fctTxt.anchor.set(0.5);
          uiLayer.addChild(fctTxt);
          textPool.set(fctKey, fctTxt);
        }
        fctTxt.text = fct.text;
        fctTxt.style.fill = fct.color;
        fctTxt.position.set(fct.x, floatY);
        fctTxt.alpha = alpha;
      }

      for (let i = visualEffects.length - 1; i >= 0; i--) {
        const fx = visualEffects[i];
        const elapsed = nowMs - fx.createdAt;
        if (elapsed >= fx.duration) {
          const txt = textPool.get(fx.targetId + '_lvlup_txt');
          if (txt) {
            txt.destroy();
            textPool.delete(fx.targetId + '_lvlup_txt');
          }
          visualEffects.splice(i, 1);
          continue;
        }

        const progress = elapsed / fx.duration;

        if (fx.type === 'LEVEL_UP') {
          const player = state.players.find((p: any) => p.id === fx.targetId);
          const posX = player ? player.x : fx.x;
          const posY = player ? player.y : fx.y;

          const radius = 24 + progress * 50;
          const alpha = 1 - progress;
          fxGraphics.lineStyle(3, 0x22c55e, alpha);
          fxGraphics.drawCircle(posX, posY, radius);

          let lvText = textPool.get(fx.targetId + '_lvlup_txt');
          if (!lvText) {
            lvText = new PIXI.Text('+1 LEVEL!', {
              fontFamily: 'Space Grotesk',
              fontSize: 14,
              fontWeight: 'bold',
              fill: 0xfacc15,
              stroke: 0x000000,
              strokeThickness: 3,
            });
            lvText.anchor.set(0.5);
            uiLayer.addChild(lvText);
            textPool.set(fx.targetId + '_lvlup_txt', lvText);
          }
          lvText.position.set(posX, posY - 45 - progress * 40);
          lvText.alpha = alpha;
        } else if (fx.type === 'MELEE_SLASH') {
          const alpha = 1 - progress;
          fxGraphics.lineStyle(4, 0xef4444, alpha);
          fxGraphics.moveTo(fx.x - 20, fx.y - 20);
          fxGraphics.lineTo(fx.x + 20, fx.y + 20);
          fxGraphics.moveTo(fx.x + 20, fx.y - 20);
          fxGraphics.lineTo(fx.x - 20, fx.y + 20);
        } else if (fx.type === 'CLICK_INDICATOR') {
          const alpha = 1 - progress;
          const radius = 4 + progress * 20;
          fxGraphics.lineStyle(2.5, fx.color || 0x22c55e, alpha);
          fxGraphics.drawCircle(fx.x, fx.y, radius);

          if (progress > 0.3) {
            const alpha2 = 1 - (progress - 0.3) / 0.7;
            const radius2 = 4 + (progress - 0.3) * 15;
            fxGraphics.lineStyle(1.5, fx.color || 0x22c55e, alpha2);
            fxGraphics.drawCircle(fx.x, fx.y, radius2);
          }
        }
      }

      // 6.6 LIMPAR GRÁFICOS NÃO ATIVOS
      for (const [key, g] of graphicsPool.entries()) {
        if (!activeIds.has(key)) {
          g.destroy();
          graphicsPool.delete(key);
        }
      }

      for (const [key, t] of textPool.entries()) {
        const cleanKey = key.replace('_text', '');
        // Evita remover o texto de level up enquanto a animação está rodando
        if (key.includes('_lvlup_txt')) continue;
        // Evita remover FCT textos enquanto existem floating texts
        if (key.startsWith('fct_')) continue;
        if (!activeIds.has(cleanKey)) {
          t.destroy();
          textPool.delete(key);
        }
      }

      // 6.7 Atualiza Cooldowns locais na UI do React
      const now = Date.now();
      setQCooldown(Math.max(0, Math.ceil((qReadyTime - now) / 1000)));
      setWCooldown(Math.max(0, Math.ceil((wReadyTime - now) / 1000)));
      setECooldown(Math.max(0, Math.ceil((eReadyTime - now) / 1000)));
      setRCooldown(Math.max(0, Math.ceil((rReadyTime - now) / 1000)));
    });

    // Cleanup completo ao desmontar
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mousedown', handleWindowMouseDown);
      window.removeEventListener('keydown', handleWindowKeyDown);
      window.removeEventListener('keyup', handleWindowKeyUp);
      window.removeEventListener('contextmenu', handleContextMenu);

      clearInterval(minimapInterval);

      socket.off('game_state');
      socket.off('level_up');
      socket.off('unit_attacked');

      if (appRef.current) {
        appRef.current.destroy(true, { children: true, texture: true, baseTexture: true });
        appRef.current = null;
      }
    };
  }, [socket]);

  const localPlayer = gameStateRef.current?.players.find((p: any) => p.id === localPlayerId.current);
  const activeHero = HERO_CATALOG[localPlayer?.heroId || 'axe'] || HERO_CATALOG.axe;

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Container onde o PixiJS irá montar seu Canvas */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full" />

      {/* ── Minimap (200x200 bottom-right) ── */}
      <canvas
        ref={minimapRef}
        width={200}
        height={200}
        style={{
          position: 'absolute',
          bottom: '90px',
          right: '16px',
          border: '2px solid rgba(255,255,255,0.25)',
          borderRadius: '4px',
          zIndex: 40,
          imageRendering: 'pixelated',
          background: '#000',
          boxShadow: '0 0 16px rgba(0,0,0,0.7)',
        }}
      />

      {/* Barra de Ações Rápidas de Skillshot (HUD sobreposta ao PixiJS) */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex space-x-4 pointer-events-none z-50">

        {/* Habilidade Q */}
        <div className="group relative flex flex-col items-center bg-black/80 border border-zinc-800 px-4 py-3 rounded-2xl w-24 text-center pointer-events-auto cursor-pointer hover:border-shonen-primary/50 transition-colors">
          <span className="absolute -top-3 bg-shonen-primary text-black font-extrabold text-xs px-2 py-0.5 rounded-full shadow-glow">
            Q
          </span>
          <p className="text-white font-bold text-xs mt-1 truncate max-w-full">
            {activeHero.abilities.Q.name}
          </p>
          <p className="text-[10px] text-zinc-500 font-semibold mt-0.5">
            Mana: {activeHero.abilities.Q.manaCost}
          </p>
          {qCooldown > 0 && (
            <div className="absolute inset-0 bg-black/85 flex items-center justify-center rounded-2xl">
              <span className="text-shonen-secondary font-extrabold text-lg">{qCooldown}s</span>
            </div>
          )}

          {/* Tooltip Hover Premium */}
          <div className="absolute bottom-full mb-3 hidden group-hover:flex flex-col bg-zinc-950/95 border border-zinc-800 p-3.5 rounded-xl w-64 text-left shadow-2xl transition-all duration-200 pointer-events-none">
            <h4 className="font-extrabold text-sm text-shonen-primary mb-1">
              {activeHero.abilities.Q.name}
            </h4>
            <p className="text-[9px] text-zinc-400 font-bold mb-2 uppercase tracking-wider">
              {activeHero.abilities.Q.behavior === 'SKILLSHOT' ? '🎯 Skillshot Direcional' :
               activeHero.abilities.Q.behavior === 'TARGET_AOE' ? '💥 Área de Efeito (AoE)' :
               activeHero.abilities.Q.behavior === 'BLINK' ? '⚡ Teleporte/Blink' : '🛡️ Autocast / Self Buff'}
            </p>
            <p className="text-xs text-zinc-300 leading-relaxed font-medium">
              {activeHero.abilities.Q.description}
            </p>
            <div className="border-t border-zinc-800/80 mt-2.5 pt-2 flex justify-between text-[10px] font-mono text-zinc-400">
              <span>Dano: <strong className="text-red-400">{activeHero.abilities.Q.damage || '0'}</strong></span>
              <span>CD: <strong className="text-amber-400">{activeHero.abilities.Q.cooldown}s</strong></span>
              <span>Alcance: <strong className="text-blue-400">{activeHero.abilities.Q.range || 'Global'}</strong></span>
            </div>
          </div>
        </div>

        {/* Habilidade W */}
        <div className="group relative flex flex-col items-center bg-black/80 border border-zinc-800 px-4 py-3 rounded-2xl w-24 text-center pointer-events-auto cursor-pointer hover:border-shonen-primary/50 transition-colors">
          <span className="absolute -top-3 bg-shonen-primary text-black font-extrabold text-xs px-2 py-0.5 rounded-full shadow-glow">
            W
          </span>
          <p className="text-white font-bold text-xs mt-1 truncate max-w-full">
            {activeHero.abilities.W.name}
          </p>
          <p className="text-[10px] text-zinc-500 font-semibold mt-0.5">
            Mana: {activeHero.abilities.W.manaCost}
          </p>
          {wCooldown > 0 && (
            <div className="absolute inset-0 bg-black/85 flex items-center justify-center rounded-2xl">
              <span className="text-shonen-secondary font-extrabold text-lg">{wCooldown}s</span>
            </div>
          )}

          {/* Tooltip Hover Premium */}
          <div className="absolute bottom-full mb-3 hidden group-hover:flex flex-col bg-zinc-950/95 border border-zinc-800 p-3.5 rounded-xl w-64 text-left shadow-2xl transition-all duration-200 pointer-events-none">
            <h4 className="font-extrabold text-sm text-shonen-primary mb-1">
              {activeHero.abilities.W.name}
            </h4>
            <p className="text-[9px] text-zinc-400 font-bold mb-2 uppercase tracking-wider">
              {activeHero.abilities.W.behavior === 'SKILLSHOT' ? '🎯 Skillshot Direcional' :
               activeHero.abilities.W.behavior === 'TARGET_AOE' ? '💥 Área de Efeito (AoE)' :
               activeHero.abilities.W.behavior === 'BLINK' ? '⚡ Teleporte/Blink' : '🛡️ Autocast / Self Buff'}
            </p>
            <p className="text-xs text-zinc-300 leading-relaxed font-medium">
              {activeHero.abilities.W.description}
            </p>
            <div className="border-t border-zinc-800/80 mt-2.5 pt-2 flex justify-between text-[10px] font-mono text-zinc-400">
              <span>Dano: <strong className="text-red-400">{activeHero.abilities.W.damage || '0'}</strong></span>
              <span>CD: <strong className="text-amber-400">{activeHero.abilities.W.cooldown}s</strong></span>
              <span>Alcance: <strong className="text-blue-400">{activeHero.abilities.W.range || 'Global'}</strong></span>
            </div>
          </div>
        </div>

        {/* Habilidade E */}
        <div className="group relative flex flex-col items-center bg-black/80 border border-zinc-800 px-4 py-3 rounded-2xl w-24 text-center pointer-events-auto cursor-pointer hover:border-shonen-primary/50 transition-colors">
          <span className="absolute -top-3 bg-shonen-primary text-black font-extrabold text-xs px-2 py-0.5 rounded-full shadow-glow">
            E
          </span>
          <p className="text-white font-bold text-xs mt-1 truncate max-w-full">
            {activeHero.abilities.E.name}
          </p>
          <p className="text-[10px] text-zinc-500 font-semibold mt-0.5">
            Mana: {activeHero.abilities.E.manaCost}
          </p>
          {eCooldown > 0 && (
            <div className="absolute inset-0 bg-black/85 flex items-center justify-center rounded-2xl">
              <span className="text-shonen-secondary font-extrabold text-lg">{eCooldown}s</span>
            </div>
          )}

          {/* Tooltip Hover Premium */}
          <div className="absolute bottom-full mb-3 hidden group-hover:flex flex-col bg-zinc-950/95 border border-zinc-800 p-3.5 rounded-xl w-64 text-left shadow-2xl transition-all duration-200 pointer-events-none">
            <h4 className="font-extrabold text-sm text-shonen-primary mb-1">
              {activeHero.abilities.E.name}
            </h4>
            <p className="text-[9px] text-zinc-400 font-bold mb-2 uppercase tracking-wider">
              {activeHero.abilities.E.behavior === 'SKILLSHOT' ? '🎯 Skillshot Direcional' :
               activeHero.abilities.E.behavior === 'TARGET_AOE' ? '💥 Área de Efeito (AoE)' :
               activeHero.abilities.E.behavior === 'BLINK' ? '⚡ Teleporte/Blink' : '🛡️ Autocast / Self Buff'}
            </p>
            <p className="text-xs text-zinc-300 leading-relaxed font-medium">
              {activeHero.abilities.E.description}
            </p>
            <div className="border-t border-zinc-800/80 mt-2.5 pt-2 flex justify-between text-[10px] font-mono text-zinc-400">
              <span>Dano: <strong className="text-red-400">{activeHero.abilities.E.damage || '0'}</strong></span>
              <span>CD: <strong className="text-amber-400">{activeHero.abilities.E.cooldown}s</strong></span>
              <span>Alcance: <strong className="text-blue-400">{activeHero.abilities.E.range || 'Global'}</strong></span>
            </div>
          </div>
        </div>

        {/* Habilidade R (Ultimate) */}
        <div className="group relative flex flex-col items-center bg-black/80 border border-zinc-800 px-4 py-3 rounded-2xl w-24 text-center pointer-events-auto cursor-pointer hover:border-shonen-primary/50 transition-colors">
          <span className="absolute -top-3 bg-amber-500 text-black font-extrabold text-xs px-2 py-0.5 rounded-full shadow-glow">
            ULT
          </span>
          <p className="text-white font-bold text-xs mt-1 truncate max-w-full">
            {activeHero.abilities.R.name}
          </p>
          <p className="text-[10px] text-zinc-500 font-semibold mt-0.5">
            Mana: {activeHero.abilities.R.manaCost}
          </p>
          {rCooldown > 0 && (
            <div className="absolute inset-0 bg-black/85 flex items-center justify-center rounded-2xl">
              <span className="text-shonen-secondary font-extrabold text-lg">{rCooldown}s</span>
            </div>
          )}

          {/* Tooltip Hover Premium */}
          <div className="absolute bottom-full mb-3 hidden group-hover:flex flex-col bg-zinc-950/95 border border-zinc-800 p-3.5 rounded-xl w-64 text-left shadow-2xl transition-all duration-200 pointer-events-none">
            <h4 className="font-extrabold text-sm text-amber-500 mb-1">
              {activeHero.abilities.R.name}
            </h4>
            <p className="text-[9px] text-amber-400 font-bold mb-2 uppercase tracking-wider">
              ⭐ Habilidade Ultimate
            </p>
            <p className="text-xs text-zinc-300 leading-relaxed font-medium">
              {activeHero.abilities.R.description}
            </p>
            <div className="border-t border-zinc-800/80 mt-2.5 pt-2 flex justify-between text-[10px] font-mono text-zinc-400">
              <span>Dano: <strong className="text-red-400">{activeHero.abilities.R.damage || '0'}</strong></span>
              <span>CD: <strong className="text-amber-400">{activeHero.abilities.R.cooldown}s</strong></span>
              <span>Alcance: <strong className="text-blue-400">{activeHero.abilities.R.range || 'Global'}</strong></span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
