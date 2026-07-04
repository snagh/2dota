import React, { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { Socket } from 'socket.io-client';
import { GAME_SETTINGS, HERO_CATALOG, getObstacleGrid, type Vector2D } from 'shared';

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

export default function GameEngine({ socket, username, onUpdatePlayerStats }: GameEngineProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  
  // Referências mutáveis para o loop do PixiJS (evita closures e re-renders)
  const gameStateRef = useRef<any>(null);
  const mouseScreenPos = useRef<Vector2D>({ x: 0, y: 0 });
  const localPlayerId = useRef<string>('');

  // Estados locais para renderizar na UI do HUD do React
  const [qCooldown, setQCooldown] = useState(0);
  const [wCooldown, setWCooldown] = useState(0);

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
      }
    });

    socket.on('unit_attacked', (data: { attackerId: string; targetId: string; damage: number; melee?: boolean }) => {
      if (data.melee) {
        const state = gameStateRef.current;
        if (!state) return;
        const target = state.players.find((x: any) => x.id === data.targetId) || state.creeps.find((x: any) => x.id === data.targetId);
        if (target) {
          visualEffects.push({
            type: 'MELEE_SLASH',
            x: target.x,
            y: target.y,
            createdAt: Date.now(),
            duration: 150
          });
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

        // Determina se o clique direito focou um inimigo (creep ou player inimigo)
        let isEnemyClicked = false;
        const state = gameStateRef.current;
        if (state) {
          const clickRadius = 64;
          const targetCreep = state.creeps.find(
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

    const handleWindowKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toUpperCase();
      if (key === 'Q' || key === 'W') {
        const now = Date.now();
        const readyTime = key === 'Q' ? qReadyTime : wReadyTime;
        
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
            if (key === 'Q') {
              qReadyTime = now + cd * 1000;
            } else {
              wReadyTime = now + cd * 1000;
            }
          }
        }
      }
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mousedown', handleWindowMouseDown);
    window.addEventListener('keydown', handleWindowKeyDown);

    // 6. Pixi Ticker (Loop de Renderização a 60 FPS com Interpolação local)
    app.ticker.add(() => {
      const state = gameStateRef.current;
      if (!state) return;

      // Localiza o jogador local
      const localPlayer = state.players.find((p: any) => p.id === localPlayerId.current);
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

        // Suaviza a Câmera seguindo o jogador local
        worldContainer.pivot.x += (localPlayer.x - worldContainer.pivot.x) * 0.15;
        worldContainer.pivot.y += (localPlayer.y - worldContainer.pivot.y) * 0.15;
      }

      // Centraliza câmera na viewport da tela
      worldContainer.position.x = app.screen.width / 2;
      worldContainer.position.y = app.screen.height / 2;

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

      if (localPlayer && localPlayer.path && localPlayer.path.length > 0) {
        pathGraphic.lineStyle(2, 0xffd200, 0.45); // Amarelo suave
        pathGraphic.moveTo(localPlayer.x, localPlayer.y);
        localPlayer.path.forEach((pt: any) => {
          pathGraphic!.lineTo(pt.x, pt.y);
        });
        
        // Desenha pequenas bolinhas nos waypoints
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
        const heroDef = HERO_CATALOG[player.heroId];
        let attributeColor = 0xa855f7; // Roxo padrão
        if (heroDef) {
          if (heroDef.attribute === 'STR') attributeColor = 0xef4444; // Vermelho
          else if (heroDef.attribute === 'AGI') attributeColor = 0x10b981; // Verde
          else if (heroDef.attribute === 'INT') attributeColor = 0x3b82f6; // Azul
        }
        
        // Sombra de brilho sob o herói
        g.beginFill(attributeColor, 0.15);
        g.drawCircle(player.x, player.y, GAME_SETTINGS.PLAYER.RADIUS + 6);
        g.endFill();

        // Círculo principal
        g.beginFill(attributeColor);
        g.lineStyle(2.5, player.team === 1 ? 0x22c55e : 0xe11d48, 0.95);
        g.drawCircle(player.x, player.y, GAME_SETTINGS.PLAYER.RADIUS);
        g.endFill();

        // Barra de Vida
        const barWidth = 50;
        const barHeight = 6;
        const barX = player.x - barWidth / 2;
        const barY = player.y - GAME_SETTINGS.PLAYER.RADIUS - 16;
        
        g.lineStyle(0);
        g.beginFill(0x1f2937); // Fundo cinza
        g.drawRect(barX, barY, barWidth, barHeight);
        g.endFill();

        const hpPercentage = Math.max(0, player.hp / player.maxHp);
        g.beginFill(0x10b981); // Verde de vida
        g.drawRect(barX, barY, barWidth * hpPercentage, barHeight);
        g.endFill();

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
        t.position.set(player.x, player.y - GAME_SETTINGS.PLAYER.RADIUS - 26);
        t.text = displayName;
        t.alpha = player.hp <= 0 ? 0.3 : 1;
      });

      // 6.2 RENDERIZAR CREEPS (Monstros Neutros)
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
        g.beginFill(0xa1a1aa); // Cor cinza/amarelo neutro
        g.lineStyle(1.5, 0xffffff, 0.6);
        g.drawCircle(creep.x, creep.y, creep.radius);
        g.endFill();

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

      // 6.3 RENDERIZAR TORRES
      state.towers.forEach((tower: any) => {
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

      // 6.5 Renderizar Efeitos Visuais (Level Up & Slash)
      fxLayer.removeChildren();
      const fxGraphics = new PIXI.Graphics();
      fxLayer.addChild(fxGraphics);

      const nowMs = Date.now();
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
        if (!activeIds.has(cleanKey)) {
          t.destroy();
          textPool.delete(key);
        }
      }

      // 6.7 Atualiza Cooldowns locais na UI do React
      const now = Date.now();
      setQCooldown(Math.max(0, Math.ceil((qReadyTime - now) / 1000)));
      setWCooldown(Math.max(0, Math.ceil((wReadyTime - now) / 1000)));
    });

    // Cleanup completo ao desmontar
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mousedown', handleWindowMouseDown);
      window.removeEventListener('keydown', handleWindowKeyDown);
      
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

      </div>
    </div>
  );
}
