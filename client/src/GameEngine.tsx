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
  id: number;
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

interface KillFeedEntry {
  id: string;
  killerName: string;
  killerHeroId: string;
  victimName: string;
  victimHeroId: string;
}

interface Announcement {
  title: string;
  subtitle: string;
}

interface MatchResult {
  status: 'victory' | 'defeat';
  kills: number;
  deaths: number;
  gold: number;
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

  // ── Cooldown trackers locais em milissegundos
  const qReadyTimeRef = useRef(0);
  const wReadyTimeRef = useRef(0);
  const eReadyTimeRef = useRef(0);
  const rReadyTimeRef = useRef(0);

  // ── Match Ended Guard Ref
  const matchEndedRef = useRef(false);

  // Estados locais para renderizar na UI do HUD do React
  const [qCooldown, setQCooldown] = useState(0);
  const [wCooldown, setWCooldown] = useState(0);
  const [eCooldown, setECooldown] = useState(0);
  const [rCooldown, setRCooldown] = useState(0);

  // Novos Estados Reativos (Phase 2 & 4)
  const [playerMana, setPlayerMana] = useState(0);
  const [playerLevel, setPlayerLevel] = useState(1);
  const [killFeed, setKillFeed] = useState<KillFeedEntry[]>([]);
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);

  useEffect(() => {
    if (!containerRef.current || !socket) return;

    localPlayerId.current = socket.id || '';
    let lastShakeTime = Date.now();

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
        const nextId = fctIndexRef.current++;
        floatingTexts.current.push({
          id: nextId,
          text: `+LEVEL ${data.level}!`,
          x: p.x,
          y: p.y - 30,
          createdAt: Date.now(),
          duration: 1200,
          color: 0x22c55e
        });

        // Central announcement when local player levels up
        if (data.playerId === localPlayerId.current) {
          setAnnouncement({
            title: 'LEVEL UP!',
            subtitle: `You reached Level ${data.level}`
          });
          setTimeout(() => {
            setAnnouncement(null);
          }, 3000);
        }
      }
    });

    socket.on('unit_attacked', (data: { attackerId: string; targetId: string; damage: number; melee?: boolean }) => {
      const state = gameStateRef.current;
      const target = state
        ? (state.players.find((x: any) => x.id === data.targetId) ||
           (state.creeps && state.creeps.find((x: any) => x.id === data.targetId)))
        : null;

      const targetX = target ? target.x : 0;
      const targetY = target ? target.y : 0;

      // ── FASE 4 / Phase 4 FCT Custom Logic
      if (target) {
        let color = 0xffffff;
        const isHeal = data.damage < 0 || (data as any).heal;
        
        if (isHeal) {
          color = 0x22c55e; // Green
        } else if (data.melee) {
          color = 0xef4444; // Dread Crimson (physical)
        } else {
          color = 0xd946ef; // Magenta/Purple (spell)
        }

        const displayText = isHeal ? `+${Math.abs(data.damage)}` : `-${data.damage}`;

        const nextId = fctIndexRef.current++;
        floatingTexts.current.push({
          id: nextId,
          text: displayText,
          x: targetX + (Math.random() - 0.5) * 20,
          y: targetY - 20,
          createdAt: Date.now(),
          duration: 900,
          color: color
        });

        // Add cool spell impact particles
        if (!data.melee && !isHeal) {
          for (let i = 0; i < 6; i++) {
            const angle = (Math.PI * 2 * i) / 6 + (Math.random() - 0.5) * 0.5;
            const speed = 40 + Math.random() * 60;
            particles.current.push({
              x: target.x,
              y: target.y,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              color: 0xd946ef,
              life: 0.3 + Math.random() * 0.2,
              maxLife: 0.3 + Math.random() * 0.2
            });
          }
        }
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

    // Escutar eventos de abates (kill_event) enviados pelo servidor
    socket.on('kill_event', (data: { killerName: string; killerHeroId: string; victimName: string; victimHeroId: string }) => {
      const feedId = Math.random().toString(36).substring(2, 9);
      const entry: KillFeedEntry = { id: feedId, ...data };
      setKillFeed(prev => [...prev, entry]);

      // Remover automaticamente o abate do feed após 5 segundos
      setTimeout(() => {
        setKillFeed(prev => prev.filter(k => k.id !== feedId));
      }, 5000);

      // Configurar anúncio dramático centralizado
      const killerHero = HERO_CATALOG[data.killerHeroId]?.name || data.killerHeroId;
      const victimHero = HERO_CATALOG[data.victimHeroId]?.name || data.victimHeroId;
      
      setAnnouncement({
        title: `${data.killerName.toUpperCase()} SLAUGHTERED ${data.victimName.toUpperCase()}!`,
        subtitle: `${killerHero} slaughtered ${victimHero}`
      });

      // Limpar anúncio após 3 segundos
      setTimeout(() => {
        setAnnouncement(null);
      }, 3000);
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

    const handleWindowKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toUpperCase() as 'Q' | 'W' | 'E' | 'R';
      if (key === 'Q' || key === 'W' || key === 'E' || key === 'R') {
        // Set holdingKey for range preview BEFORE sending cast
        holdingKey.current = key;

        const now = Date.now();
        let readyTime = 0;
        if (key === 'Q') readyTime = qReadyTimeRef.current;
        else if (key === 'W') readyTime = wReadyTimeRef.current;
        else if (key === 'E') readyTime = eReadyTimeRef.current;
        else if (key === 'R') readyTime = rReadyTimeRef.current;

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
            if (key === 'Q') qReadyTimeRef.current = now + cd * 1000;
            else if (key === 'W') wReadyTimeRef.current = now + cd * 1000;
            else if (key === 'E') eReadyTimeRef.current = now + cd * 1000;
            else if (key === 'R') rReadyTimeRef.current = now + cd * 1000;
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

    // ── Minimap setInterval (Refined Minimap) ───────────────────────────────
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

      ctx.fillStyle = '#040406';
      ctx.fillRect(0, 0, W, H);

      // Draw a subtle grid tint
      ctx.fillStyle = 'rgba(16, 24, 36, 0.4)';
      ctx.fillRect(0, 0, W, H);

      if (state) {
        // 1. Draw Towers (Squares - Green/Red)
        const towersToRender = cachedTowersRef.current.length > 0
          ? cachedTowersRef.current
          : (state.towers || []);

        towersToRender.forEach((tower: any) => {
          if (tower.hp <= 0) return;
          const mx = tower.x * scaleX;
          const my = tower.y * scaleY;
          ctx.fillStyle = tower.team === 1 ? '#22c55e' : '#ef4444';
          ctx.fillRect(mx - 4, my - 4, 8, 8);
        });

        // 2. Draw Creeps (2px Gray Circles)
        if (state.creeps) {
          state.creeps.forEach((creep: any) => {
            if (creep.hp <= 0) return;
            const mx = creep.x * scaleX;
            const my = creep.y * scaleY;
            ctx.fillStyle = '#9ca3af';
            ctx.beginPath();
            ctx.arc(mx, my, 2, 0, Math.PI * 2);
            ctx.fill();
          });
        }

        // 3. Draw Roshan (Gold/Amber Star)
        if (state.roshan && state.roshan.hp > 0) {
          const rx = state.roshan.x * scaleX;
          const ry = state.roshan.y * scaleY;
          ctx.fillStyle = '#facc15';
          ctx.beginPath();
          // Draw diamond/star shape
          ctx.moveTo(rx, ry - 6);
          ctx.lineTo(rx + 2, ry - 2);
          ctx.lineTo(rx + 6, ry);
          ctx.lineTo(rx + 2, ry + 2);
          ctx.lineTo(rx, ry + 6);
          ctx.lineTo(rx - 2, ry + 2);
          ctx.lineTo(rx - 6, ry);
          ctx.lineTo(rx - 2, ry - 2);
          ctx.closePath();
          ctx.fill();
        }

        // 4. Draw Players
        state.players.forEach((p: any) => {
          if (p.hp <= 0) return;
          const mx = p.x * scaleX;
          const my = p.y * scaleY;
          const isLocal = p.id === localPlayerId.current;

          if (isLocal) {
            // Bright white circle with stroke border
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(mx - 5, my - 5, 10, 10);
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(mx, my, 3.5, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.fillStyle = p.team === 1 ? '#10b981' : '#f43f5e';
            ctx.beginPath();
            ctx.arc(mx, my, 3, 0, Math.PI * 2);
            ctx.fill();
          }
        });
      }

      // Cyan tinted runic grid outline inside canvas
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.3)';
      ctx.lineWidth = 1;
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

        // Atualizar estado de Mana e Level no React para HUD reativo e tooltips
        setPlayerMana(localPlayer.mp);
        setPlayerLevel(localPlayer.level || 1);

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

      // ── FASE 4: Ability Range Preview & AoE Circle Indicator ───────────
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

            // Círculo principal do alcance da habilidade
            abilityRangeGraphic.lineStyle(2, 0x818cf8, 0.55);
            abilityRangeGraphic.beginFill(0x818cf8, 0.06);
            abilityRangeGraphic.drawCircle(posX, posY, ability.range);
            abilityRangeGraphic.endFill();

            // Círculo Secundário Dinâmico de AoE (Phase 2 & 4 Feature 2)
            if (ability.behavior === 'TARGET_AOE' && ability.radius && ability.radius > 0) {
              const canvas = app.view as HTMLCanvasElement;
              const canvasBounds = canvas.getBoundingClientRect();
              
              // Calcular coordenadas do mundo para o cursor do mouse
              const worldMouseX = mouseScreenPos.current.x - canvasBounds.left - app.screen.width / 2 + worldContainer.pivot.x;
              const worldMouseY = mouseScreenPos.current.y - canvasBounds.top - app.screen.height / 2 + worldContainer.pivot.y;

              abilityRangeGraphic.lineStyle(1.5, 0xff7c7c, 0.7);
              abilityRangeGraphic.beginFill(0xff7c7c, 0.15); // Preenchimento semitransparente crimson/orange (0xff7c7c, alpha 0.15)
              abilityRangeGraphic.drawCircle(worldMouseX, worldMouseY, ability.radius);
              abilityRangeGraphic.endFill();
            }
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

        // ── FASE 4: Buff/Debuff Bar (Para todos os players visíveis - Feature 1)
        if (player.activeBuffs && player.activeBuffs.length > 0) {
          const buffSize = 10;
          const buffPadding = 2;
          const totalWidth = player.activeBuffs.length * buffSize + (player.activeBuffs.length - 1) * buffPadding;
          const buffStartY = barY - buffSize - 4;

          player.activeBuffs.forEach((buffObj: any, idx: number) => {
            const buffType = typeof buffObj === 'string' ? buffObj : buffObj?.type;
            let buffColor = 0x6b7280;

            if (buffType === 'SLOW') buffColor = 0x22d3ee;       // ciano/blue
            else if (buffType === 'DOT') buffColor = 0xef4444;   // dread-crimson/red
            else if (buffType === 'SPEED_BOOST') buffColor = 0x10b981; // green/emerald

            const buffX = drawX - totalWidth / 2 + idx * (buffSize + buffPadding);
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

      // ── FASE 4: Match Ending Detection (Feature 5) ───────────────────
      const mainTowers = state.towers || cachedTowersRef.current;
      if (!matchEndedRef.current && mainTowers && mainTowers.length > 0 && localPlayer) {
        const isTurnBased = state.gameMode === 'TURN_BASED';
        const sentinelMainId = isTurnBased ? 'turn_based_tower_1' : 'normal_tower_1';
        const scourgeMainId = isTurnBased ? 'turn_based_tower_4' : 'normal_tower_4';

        const sentinelMainTower = mainTowers.find((t: any) => t.id === sentinelMainId);
        const scourgeMainTower = mainTowers.find((t: any) => t.id === scourgeMainId);

        if (sentinelMainTower && sentinelMainTower.hp <= 0) {
          matchEndedRef.current = true;
          const status = localPlayer.team === 1 ? 'defeat' : 'victory';
          setMatchResult({
            status,
            kills: localPlayer.kills || 0,
            deaths: localPlayer.deaths || 0,
            gold: localPlayer.gold || 0
          });
        } else if (scourgeMainTower && scourgeMainTower.hp <= 0) {
          matchEndedRef.current = true;
          const status = localPlayer.team === 1 ? 'victory' : 'defeat';
          setMatchResult({
            status,
            kills: localPlayer.kills || 0,
            deaths: localPlayer.deaths || 0,
            gold: localPlayer.gold || 0
          });
        }
      }

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

      // ── Advanced Floating Combat Text ────────────────────────────────
      for (let i = floatingTexts.current.length - 1; i >= 0; i--) {
        const fct = floatingTexts.current[i];
        const elapsed = nowMs - fct.createdAt;
        const fctKey = `fct_${fct.id}`;
        
        if (elapsed >= fct.duration) {
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
        
        // Sinusoidal wiggle: move x by sin(progress * 5) * 10 (Feature 3)
        const floatX = fct.x + Math.sin(progress * 5) * 10;
        const alpha = progress < 0.7 ? 1 : 1 - (progress - 0.7) / 0.3;

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
        fctTxt.position.set(floatX, floatY);
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

      // 6.7 Atualiza Cooldowns locais na UI do React (as floats for smooth swipe overlay)
      const tickerNow = Date.now();
      setQCooldown(Math.max(0, (qReadyTimeRef.current - tickerNow) / 1000));
      setWCooldown(Math.max(0, (wReadyTimeRef.current - tickerNow) / 1000));
      setECooldown(Math.max(0, (eReadyTimeRef.current - tickerNow) / 1000));
      setRCooldown(Math.max(0, (rReadyTimeRef.current - tickerNow) / 1000));
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
      socket.off('kill_event');

      if (appRef.current) {
        appRef.current.destroy(true, { children: true, texture: true, baseTexture: true });
        appRef.current = null;
      }
    };
  }, [socket]);

  const localPlayer = gameStateRef.current?.players.find((p: any) => p.id === localPlayerId.current);
  const activeHero = HERO_CATALOG[localPlayer?.heroId || 'axe'] || HERO_CATALOG.axe;

  const getAbilityData = (key: 'Q' | 'W' | 'E' | 'R') => {
    const ability = activeHero.abilities[key];
    let cd = 0;
    if (key === 'Q') cd = qCooldown;
    else if (key === 'W') cd = wCooldown;
    else if (key === 'E') cd = eCooldown;
    else if (key === 'R') cd = rCooldown;

    const totalCd = ability.cooldown;
    const ratio = totalCd > 0 ? cd / totalCd : 0;
    const isOutOfMana = playerMana < ability.manaCost;

    return { ability, cd, ratio, isOutOfMana };
  };

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Estilos CSS Injetados para HUD Premium */}
      <style>{`
        .crystal-frame {
          position: relative;
          background: rgba(10, 10, 12, 0.85);
          border: 2px solid rgba(6, 182, 212, 0.45);
          box-shadow: 0 0 12px rgba(6, 182, 212, 0.25), inset 0 0 6px rgba(6, 182, 212, 0.1);
          transition: all 0.3s ease;
        }
        .crystal-frame:hover {
          border-color: rgba(6, 182, 212, 0.8);
          box-shadow: 0 0 18px rgba(6, 182, 212, 0.45), inset 0 0 10px rgba(6, 182, 212, 0.2);
        }
        .crimson-frame {
          position: relative;
          background: rgba(20, 10, 10, 0.9);
          border: 2px solid rgba(239, 68, 68, 0.5);
          box-shadow: 0 0 12px rgba(239, 68, 68, 0.25), inset 0 0 6px rgba(239, 68, 68, 0.1);
          transition: all 0.3s ease;
        }
        .crimson-frame:hover {
          border-color: rgba(239, 68, 68, 0.85);
          box-shadow: 0 0 18px rgba(239, 68, 68, 0.45), inset 0 0 10px rgba(239, 68, 68, 0.2);
        }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(50px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes floatAnnounce {
          0% { transform: translate(-50%, -60%) scale(0.9); opacity: 0; }
          10% { transform: translate(-50%, -50%) scale(1.05); opacity: 1; }
          15% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          85% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          100% { transform: translate(-50%, -40%) scale(0.95); opacity: 0; }
        }

        .animate-fade-in {
          animation: fadeIn 0.4s ease-out forwards;
        }
        .animate-slide-in {
          animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-announce {
          animation: floatAnnounce 3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* Container onde o PixiJS irá montar seu Canvas */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full" />

      {/* ── Central Game Announcements ── */}
      {announcement && (
        <div className="absolute top-1/3 left-1/2 pointer-events-none z-50 text-center animate-announce">
          <div className="bg-black/85 backdrop-blur-md px-10 py-6 rounded-2xl border border-amber-500/40 shadow-[0_0_50px_rgba(245,158,11,0.35)]">
            <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-500 to-amber-300 drop-shadow-[0_0_20px_rgba(245,158,11,0.5)] tracking-widest uppercase">
              {announcement.title}
            </h1>
            <p className="text-zinc-300 text-xs font-bold tracking-widest mt-2 uppercase">
              {announcement.subtitle}
            </p>
          </div>
        </div>
      )}

      {/* ── Kill Feed (Top Right) ── */}
      <div className="absolute top-6 right-6 flex flex-col space-y-2 pointer-events-none z-50 w-72">
        {killFeed.map((feed) => {
          const killerHero = HERO_CATALOG[feed.killerHeroId]?.name || feed.killerHeroId;
          const victimHero = HERO_CATALOG[feed.victimHeroId]?.name || feed.victimHeroId;
          return (
            <div
              key={feed.id}
              className="bg-zinc-950/85 border border-zinc-800/80 px-4 py-2.5 rounded-xl flex items-center justify-between shadow-xl animate-slide-in"
              style={{
                boxShadow: '0 4px 20px rgba(0,0,0,0.5), inset 0 0 10px rgba(239,68,68,0.05)',
              }}
            >
              <div className="flex flex-col text-left">
                <span className="text-white font-extrabold text-xs">
                  {feed.killerName}
                </span>
                <span className="text-[9px] text-zinc-400 font-semibold uppercase">
                  {killerHero}
                </span>
              </div>

              <div className="flex flex-col items-center px-2">
                <span className="text-red-500 font-extrabold text-[10px] uppercase tracking-wider">
                  SLAUGHTERED
                </span>
                <span className="text-[14px]">⚔️</span>
              </div>

              <div className="flex flex-col text-right">
                <span className="text-zinc-300 font-extrabold text-xs">
                  {feed.victimName}
                </span>
                <span className="text-[9px] text-zinc-500 font-semibold uppercase">
                  {victimHero}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Match Ending Screen Overlay ── */}
      {matchResult && (
        <div className="absolute inset-0 bg-black/90 backdrop-blur-lg flex flex-col items-center justify-center z-[100] animate-fade-in pointer-events-auto">
          <div className={`text-7xl font-black tracking-widest mb-4 uppercase ${
            matchResult.status === 'victory' 
              ? 'text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-500 drop-shadow-[0_0_35px_rgba(16,185,129,0.5)]' 
              : 'text-transparent bg-clip-text bg-gradient-to-r from-rose-500 to-red-700 drop-shadow-[0_0_35px_rgba(225,29,72,0.5)]'
          }`}>
            {matchResult.status === 'victory' ? 'Victory' : 'Defeat'}
          </div>
          
          <div className="text-zinc-400 text-lg mb-8 tracking-widest uppercase font-medium">
            The Ancient has fallen!
          </div>

          <div className="bg-zinc-950/80 border border-zinc-800 p-8 rounded-2xl w-96 flex flex-col space-y-4 shadow-2xl">
            <h3 className="text-white font-bold text-center border-b border-zinc-800/80 pb-3 uppercase tracking-wider text-sm">
              Partida Terminada
            </h3>
            <div className="flex justify-between items-center text-sm font-medium">
              <span className="text-zinc-500">Abates (Kills):</span>
              <span className="text-emerald-400 font-mono font-bold text-base">{matchResult.kills}</span>
            </div>
            <div className="flex justify-between items-center text-sm font-medium">
              <span className="text-zinc-500">Mortes (Deaths):</span>
              <span className="text-rose-400 font-mono font-bold text-base">{matchResult.deaths}</span>
            </div>
            <div className="flex justify-between items-center text-sm font-medium">
              <span className="text-zinc-500">Ouro Restante:</span>
              <span className="text-amber-400 font-mono font-bold text-base">{matchResult.gold}</span>
            </div>
          </div>

          <button
            onClick={() => window.location.reload()}
            className="mt-8 px-8 py-3.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-extrabold rounded-xl transition-all shadow-lg hover:shadow-cyan-500/25 active:scale-95 uppercase tracking-wider text-sm"
          >
            Jogar Novamente / Sair
          </button>
        </div>
      )}

      {/* ── Refined Minimap Wrap with glass runic border ── */}
      <div className="absolute bottom-[95px] right-[16px] z-40 p-1 bg-zinc-950/80 backdrop-blur-md rounded-xl border border-cyan-500/40 shadow-[0_0_16px_rgba(6,182,212,0.25)]">
        <canvas
          ref={minimapRef}
          width={200}
          height={200}
          className="rounded-lg"
          style={{
            imageRendering: 'pixelated',
            background: '#040406',
          }}
        />
      </div>

      {/* Barra de Ações Rápidas (Premium Skill Slot Redesign) */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex space-x-4 pointer-events-none z-50">
        {['Q', 'W', 'E', 'R'].map((key) => {
          const { ability, cd, ratio, isOutOfMana } = getAbilityData(key as 'Q' | 'W' | 'E' | 'R');
          const frameClass = cd > 0 ? 'crimson-frame' : 'crystal-frame';
          
          // Formula de escalonamento para os Tooltips
          const baseDamage = ability.damage || 0;
          const scalingDamage = baseDamage > 0 ? baseDamage + playerLevel * 10 : 0;

          const radius = 24;
          const strokeWidth = 48;
          const circumference = 2 * Math.PI * radius; // ~150.8
          const strokeDashoffset = circumference * ratio;

          return (
            <div
              key={key}
              className={`group relative flex flex-col items-center p-3.5 w-24 text-center pointer-events-auto cursor-pointer select-none transition-all duration-300 ${frameClass}`}
              style={{
                clipPath: 'polygon(10px 0%, 100% 0%, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0% 100%, 0% 10px)',
              }}
            >
              {/* Tecla de Atalho */}
              <span className={`absolute -top-3.5 font-extrabold text-xs px-2.5 py-0.5 rounded-full shadow-glow transition-all ${
                key === 'R' 
                  ? 'bg-amber-500 text-black border border-amber-300' 
                  : 'bg-cyan-500 text-black border border-cyan-300'
              }`}>
                {key === 'R' ? 'ULT' : key}
              </span>

              {/* Nome da Habilidade */}
              <p className="text-white font-extrabold text-xs mt-2.5 truncate max-w-full">
                {ability.name}
              </p>

              {/* Custo de Mana */}
              <p className={`text-[10px] font-semibold mt-1 transition-colors ${
                isOutOfMana ? 'text-red-400 font-bold scale-105' : 'text-zinc-400'
              }`}>
                Mana: {ability.manaCost}
              </p>

              {/* Cooldown SVG overlay radial swipe */}
              {cd > 0 && (
                <div className="absolute inset-0 bg-black/85 flex items-center justify-center z-10">
                  <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 64 64">
                    <circle
                      cx="32"
                      cy="32"
                      r={radius}
                      fill="none"
                      stroke="rgba(239, 68, 68, 0.4)"
                      strokeWidth={strokeWidth}
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                    />
                  </svg>
                  <span className="text-rose-400 font-extrabold text-lg drop-shadow-md z-20">
                    {Math.ceil(cd)}s
                  </span>
                </div>
              )}

              {/* Sem Mana Overlay */}
              {isOutOfMana && (
                <div className="absolute inset-0 bg-cyan-950/80 backdrop-filter backdrop-brightness-75 flex flex-col items-center justify-center z-10">
                  <span className="text-red-500 font-extrabold text-[10px] tracking-wider uppercase animate-pulse">
                    SEM MANA
                  </span>
                  <span className="text-cyan-400 font-bold text-xs mt-1">
                    Requer {ability.manaCost}
                  </span>
                </div>
              )}

              {/* Tooltip Hover Premium */}
              <div className="absolute bottom-full mb-4 hidden group-hover:flex flex-col bg-zinc-950/95 border border-zinc-800 p-4 rounded-xl w-72 text-left shadow-2xl transition-all duration-200 pointer-events-none z-[110]">
                <h4 className={`font-extrabold text-sm mb-1 ${key === 'R' ? 'text-amber-400' : 'text-cyan-400'}`}>
                  {ability.name}
                </h4>
                <p className="text-[9px] text-zinc-500 font-bold mb-2 uppercase tracking-wider">
                  {ability.behavior === 'SKILLSHOT' ? '🎯 Skillshot Direcional' :
                   ability.behavior === 'TARGET_AOE' ? '💥 Área de Efeito (AoE)' :
                   ability.behavior === 'BLINK' ? '⚡ Teleporte/Blink' : '🛡️ Autocast / Self Buff'}
                </p>
                <p className="text-xs text-zinc-300 leading-relaxed font-medium mb-3">
                  {ability.description}
                </p>
                <div className="border-t border-zinc-800/80 pt-2.5 flex flex-col space-y-1 text-[10px] font-mono text-zinc-400">
                  {baseDamage > 0 && (
                    <div className="flex justify-between">
                      <span>Dano:</span>
                      <span>
                        <strong className="text-red-400">{scalingDamage}</strong>{' '}
                        <span className="text-zinc-500">({baseDamage} + {playerLevel * 10} Escalonado)</span>
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Tempo de Recarga (CD):</span>
                    <strong className="text-amber-400">{ability.cooldown}s</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Custo de Mana:</span>
                    <strong className={`${isOutOfMana ? 'text-red-400 font-bold' : 'text-blue-400'}`}>
                      {ability.manaCost} MP
                    </strong>
                  </div>
                  {ability.range > 0 && (
                    <div className="flex justify-between">
                      <span>Alcance:</span>
                      <strong className="text-cyan-400">{ability.range}px</strong>
                    </div>
                  )}
                  {ability.radius > 0 && (
                    <div className="flex justify-between">
                      <span>Raio da Habilidade:</span>
                      <strong className="text-purple-400">{ability.radius}px</strong>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
