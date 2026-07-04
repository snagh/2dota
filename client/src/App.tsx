import React, { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import GameEngine from './GameEngine.tsx';
import { type GameMode, HERO_CATALOG } from 'shared';

export default function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [username, setUsername] = useState('');
  const [selectedMode, setSelectedMode] = useState<GameMode>('NORMAL');
  const [joined, setJoined] = useState(false);

  // Seleção de Herói no Lobby
  const [selectedHeroId, setSelectedHeroId] = useState<string>('axe');
  const [selectedTab, setSelectedTab] = useState<'STR' | 'AGI' | 'INT'>('STR');

  // Status do Jogador Atualizados pelo Motor PixiJS
  const [gameMode, setGameMode] = useState<GameMode>('NORMAL');
  const [playerHp, setPlayerHp] = useState(600);
  const [playerMaxHp, setPlayerMaxHp] = useState(600);
  const [playerMp, setPlayerMp] = useState(300);
  const [playerMaxMp, setPlayerMaxMp] = useState(300);
  const [playerKills, setPlayerKills] = useState(0);
  const [playerDeaths, setPlayerDeaths] = useState(0);
  const [playerAp, setPlayerAp] = useState(2);
  const [playerMpPoints, setPlayerMpPoints] = useState(3);

  // Status de Nível e XP
  const [playerLevel, setPlayerLevel] = useState(1);
  const [playerXp, setPlayerXp] = useState(0);
  const [playerMaxXp, setPlayerMaxXp] = useState(100);

  // Economia
  const [playerGold, setPlayerGold] = useState(625);
  const [showShop, setShowShop] = useState(false);
  const [shopItems, setShopItems] = useState<Record<string, any>>({});

  // Estados do Modo Turno
  const [activePlayerId, setActivePlayerId] = useState<string | null>(null);
  const [isNpcTurn, setIsNpcTurn] = useState(false);

  const isMyTurn = socket && activePlayerId === socket.id;

  // Inicializa conexão única de socket
  useEffect(() => {
    const newSocket = io('http://localhost:3001');
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
      setJoined(false);
    });

    newSocket.on('joined_successfully', () => {
      setJoined(true);
      // Carrega catálogo de itens do servidor
      fetch('http://localhost:3001/items')
        .then(r => r.json())
        .then(data => setShopItems(data))
        .catch(() => {});
    });

    newSocket.on('gold_gained', (data: { amount: number; total: number }) => {
      setPlayerGold(data.total);
    });

    // Monitora troca de turnos no servidor
    newSocket.on('turn_update', (data: { activePlayerId: string | null; isNpcTurn: boolean }) => {
      setActivePlayerId(data.activePlayerId);
      setIsNpcTurn(data.isNpcTurn);
    });

    return () => {
      newSocket.close();
    };
  }, []);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !socket) return;
    socket.emit('join_game', { username, mode: selectedMode, heroId: selectedHeroId });
  };

  const handleUpdatePlayerStats = (
    hp: number,
    maxHp: number,
    mp: number,
    maxMp: number,
    kills: number,
    deaths: number,
    ap: number,
    mpPoints: number,
    serverMode: GameMode,
    serverActivePlayerId: string | null,
    serverIsNpcTurn: boolean,
    level: number,
    xp: number,
    maxXp: number
  ) => {
    setPlayerHp(hp);
    setPlayerMaxHp(maxHp);
    setPlayerMp(mp);
    setPlayerMaxMp(maxMp);
    setPlayerKills(kills);
    setPlayerDeaths(deaths);
    setPlayerAp(ap);
    setPlayerMpPoints(mpPoints);
    setGameMode(serverMode);
    setActivePlayerId(serverActivePlayerId);
    setIsNpcTurn(serverIsNpcTurn);
    setPlayerLevel(level);
    setPlayerXp(xp);
    setPlayerMaxXp(maxXp);
  };

  const handleEndTurn = () => {
    if (socket && isMyTurn && !isNpcTurn) {
      socket.emit('end_turn');
    }
  };

  const handleBuyItem = (itemId: string) => {
    if (!socket) return;
    socket.emit('buy_item', { itemId });
  };

  // 1. Tela de Entrada / Login (Lobby com Seleção de Herói Premium)
  if (!joined) {
    // Filtragem de heróis da aba selecionada
    const currentTabHeroes = Object.entries(HERO_CATALOG).filter(
      ([_, def]) => def.attribute === selectedTab
    );

    const activeHeroDef = HERO_CATALOG[selectedHeroId] || HERO_CATALOG.axe;

    // Determina o papel do herói de acordo com seu atributo principal
    const getHeroRole = (attr: string) => {
      if (attr === 'STR') return 'Tanque Iniciador / Linha de Frente';
      if (attr === 'AGI') return 'Carregador Ágil / DPS Físico';
      return 'Conjurador de Batalha / Suporte Tático';
    };

    if (!connected) {
      return (
        <div className="flex h-screen w-screen flex-col items-center justify-center bg-[#0B0C10] px-6 select-none">
          <div className="glass max-w-md w-full rounded-2xl p-8 border border-zinc-800 text-center space-y-6 shadow-2xl">
            <div className="h-16 w-16 border-4 border-t-[#66FCF1] border-zinc-900 rounded-full animate-spin mx-auto" />
            <div className="space-y-2">
              <h2 className="text-xl font-black text-white tracking-widest font-mono">2D.OTA</h2>
              <p className="text-zinc-400 text-xs font-semibold leading-relaxed">
                Estabelecendo conexão cristalina com o campo de batalha. Aguarde...
              </p>
            </div>
            <div className="text-[10px] text-zinc-600 font-mono">
              IP: localhost:3001
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex min-h-screen w-screen items-center justify-center bg-gradient-to-b from-[#0B0C10] via-[#0f1115] to-[#0B0C10] px-4 py-8 overflow-y-auto select-none">
        <div className="glass max-w-6xl w-full rounded-3xl p-6 md:p-8 shadow-2xl border border-zinc-800/80 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          
          {/* Coluna Esquerda: Configurações e Detalhes do Herói */}
          <div className="lg:col-span-5 flex flex-col justify-between space-y-6">
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
                <div>
                  <h1 className="text-3xl font-black text-white tracking-widest font-mono">
                    2D.OTA
                  </h1>
                  <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mt-0.5">Mini Arena de Campeões</p>
                </div>
                <div className="flex items-center space-x-2 bg-[#121218] border border-zinc-900 px-3 py-1.5 rounded-lg">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest">Servidor Online</span>
                </div>
              </div>

              <form onSubmit={handleJoin} className="space-y-4">
                {/* Nome do Jogador */}
                <div>
                  <label className="block text-zinc-400 text-[10px] font-extrabold uppercase tracking-widest mb-2">
                    Identidade na Arena (Apelido)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Mogul_Khan"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    maxLength={14}
                    required
                    className="w-full bg-[#121218] border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#66FCF1] focus:ring-1 focus:ring-[#66FCF1] transition-all text-sm font-semibold focus-ring"
                  />
                </div>

                {/* Seleção de Modo */}
                <div>
                  <label className="block text-zinc-400 text-[10px] font-extrabold uppercase tracking-widest mb-2">
                    Modo de Arena
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedMode('NORMAL')}
                      className={`p-3.5 rounded-xl border text-left transition-all focus-ring flex flex-col justify-between ${
                        selectedMode === 'NORMAL'
                          ? 'border-[#66FCF1] bg-[#66FCF1]/5 text-white shadow-[0_0_15px_rgba(102,252,241,0.05)]'
                          : 'border-zinc-800 bg-[#121218]/40 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      <span className="font-extrabold text-xs tracking-wider uppercase mb-1 block">⚔️ Tempo Real</span>
                      <span className="text-[10px] text-zinc-500 font-medium leading-relaxed">
                        Partida clássica de ação rápida, micro-gerenciamento e reflexos instantâneos.
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedMode('TURN_BASED')}
                      className={`p-3.5 rounded-xl border text-left transition-all focus-ring flex flex-col justify-between ${
                        selectedMode === 'TURN_BASED'
                          ? 'border-[#FF2E63] bg-[#FF2E63]/5 text-white shadow-[0_0_15px_rgba(255,46,99,0.05)]'
                          : 'border-zinc-800 bg-[#121218]/40 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      <span className="font-extrabold text-xs tracking-wider uppercase mb-1 block">⏳ Turno Tático</span>
                      <span className="text-[10px] text-zinc-500 font-medium leading-relaxed">
                        Combate estratégico por turnos. Planeje cada movimento usando pontos de ação (PA/PM).
                      </span>
                    </button>
                  </div>
                </div>
              </form>
            </div>

            {/* Painel Detalhado do Herói Selecionado (Visual Premium) */}
            <div className="bg-[#121218] border border-zinc-800 rounded-2xl p-5 text-left space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-black text-white text-xl tracking-wide uppercase">{activeHeroDef.name}</h3>
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mt-0.5">{activeHeroDef.title}</span>
                  <span className="text-[9px] text-[#66FCF1] font-bold uppercase tracking-wider block mt-1">{getHeroRole(activeHeroDef.attribute)}</span>
                </div>
                <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase border ${
                  activeHeroDef.attribute === 'STR' ? 'bg-red-950/40 text-[#FF2E63] border-[#FF2E63]/30' :
                  activeHeroDef.attribute === 'AGI' ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/30' :
                  'bg-sky-950/40 text-[#66FCF1] border-[#66FCF1]/30'
                }`}>
                  {activeHeroDef.attribute === 'STR' ? '🔴 Força' :
                   activeHeroDef.attribute === 'AGI' ? '🟢 Agilidade' :
                   '🔵 Inteligência'}
                </span>
              </div>

              {/* Status do Herói */}
              <div className="grid grid-cols-3 gap-2 text-[10px] text-zinc-400 font-mono border-t border-b border-zinc-900 py-3">
                <div>❤️ VIDA: <span className="text-white font-bold">{activeHeroDef.baseHp}</span></div>
                <div>🧪 MANA: <span className="text-white font-bold">{activeHeroDef.baseMp}</span></div>
                <div>🏃 VEL: <span className="text-white font-bold">{activeHeroDef.speed}</span></div>
              </div>

              {/* Habilidades do Herói com Detalhes Completos */}
              <div className="space-y-3.5">
                <p className="text-zinc-500 font-extrabold uppercase text-[9px] tracking-wider mb-1">Grade de Habilidades de Combate</p>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(activeHeroDef.abilities).map(([key, ability]: [string, any]) => (
                    <div key={key} className="bg-[#0B0C10] border border-zinc-800/80 rounded-xl p-3 space-y-1 hover:border-zinc-700 transition-all">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] bg-zinc-800 text-zinc-300 font-mono font-bold px-1.5 py-0.5 rounded uppercase">{key}</span>
                        <span className="text-[9px] text-zinc-500 font-mono">Mana: {ability.manaCost}</span>
                      </div>
                      <p className="font-extrabold text-[11px] text-white truncate">{ability.name}</p>
                      <p className="text-[9px] text-zinc-400 leading-normal line-clamp-2 h-7">{ability.description}</p>
                      <div className="flex justify-between text-[8px] font-mono text-zinc-500 border-t border-zinc-900 pt-1 mt-1">
                        <span>Dano: {ability.damage || '0'}</span>
                        <span>CD: {ability.cooldown}s</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={handleJoin}
              disabled={!connected || !username.trim()}
              className="w-full py-4 rounded-xl font-black bg-gradient-to-r from-[#66FCF1] to-[#3b82f6] text-black hover:opacity-95 active:scale-[0.99] transition-all disabled:opacity-30 disabled:pointer-events-none uppercase text-xs tracking-widest shadow-lg focus-ring"
            >
              ENTRAR NA ARENA ⚔️
            </button>
          </div>

          {/* Coluna Direita: Grade de Escolha de Heróis (30 slots) */}
          <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h2 className="text-md font-black text-white uppercase tracking-wider">Escolha seu Campeão</h2>
                
                {/* Abas de Atributo */}
                <div className="flex bg-[#121218] border border-zinc-900 rounded-xl p-1 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setSelectedTab('STR')}
                    className={`flex-1 sm:flex-none px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-wider transition-all focus-ring ${
                      selectedTab === 'STR'
                        ? 'bg-red-700/10 text-[#FF2E63] border border-red-700/20'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    🔴 Força
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedTab('AGI')}
                    className={`flex-1 sm:flex-none px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-wider transition-all focus-ring ${
                      selectedTab === 'AGI'
                        ? 'bg-emerald-700/10 text-emerald-400 border border-emerald-700/20'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    🟢 Agilidade
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedTab('INT')}
                    className={`flex-1 sm:flex-none px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-wider transition-all focus-ring ${
                      selectedTab === 'INT'
                        ? 'bg-sky-700/10 text-[#66FCF1] border border-sky-700/20'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    🔵 Inteligência
                  </button>
                </div>
              </div>

              {/* Grade de Seleção dos Heróis */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 overflow-y-auto max-h-[460px] pr-2 scrollbar-thin scrollbar-thumb-zinc-800">
                {currentTabHeroes.map(([heroId, def]) => {
                  const isSelected = selectedHeroId === heroId;
                  return (
                    <button
                      key={heroId}
                      type="button"
                      onClick={() => setSelectedHeroId(heroId)}
                      className={`p-3.5 rounded-xl border text-left flex flex-col justify-between transition-all focus-ring h-20 ${
                        isSelected
                          ? selectedTab === 'STR' ? 'border-[#FF2E63] bg-[#FF2E63]/5 shadow-[0_0_12px_rgba(255,46,99,0.1)]' :
                            selectedTab === 'AGI' ? 'border-emerald-500 bg-emerald-950/20 shadow-[0_0_12px_rgba(16,185,129,0.1)]' :
                            'border-[#66FCF1] bg-[#66FCF1]/5 shadow-[0_0_12px_rgba(102,252,241,0.1)]'
                          : 'border-zinc-800 bg-[#121218]/30 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <span className="font-extrabold text-xs block tracking-wide truncate w-full">{def.name}</span>
                      <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider truncate block w-full mt-1">{def.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between text-[10px] text-zinc-500 border-t border-zinc-900 pt-4">
              <span>* Selecione seu herói, escolha o modo e pressione o botão para conectar ao lobby da arena.</span>
              <div className="flex items-center space-x-1.5">
                <span className={`h-2 w-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                <span className="font-mono">{connected ? 'CONECTADO' : 'DESCONECTADO'}</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    );
  }

  // 2. Tela de Partida (GameEngine PixiJS + HUD TailwindCSS)
  const hpPercentage = Math.max(0, (playerHp / playerMaxHp) * 100);
  const mpPercentage = Math.max(0, (playerMp / playerMaxMp) * 100);
  const activeHero = HERO_CATALOG[selectedHeroId] || HERO_CATALOG.axe;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black select-none">
      
      {/* Motor Gráfico PixiJS */}
      <GameEngine 
        socket={socket} 
        username={username}
        onUpdatePlayerStats={handleUpdatePlayerStats}
      />

      {/* HUD Superior Esquerdo: Informações Gerais */}
      <div className="absolute top-4 left-4 pointer-events-none">
        <div className="glass pointer-events-auto rounded-xl px-5 py-3 flex items-center space-x-4 border border-shonen-primary/20">
          <div className="h-3.5 w-3.5 bg-shonen-primary rounded-full animate-pulse shadow-glow" />
          <div>
            <h2 className="font-bold text-sm text-zinc-200 uppercase tracking-wide">
              [Nv. {playerLevel}] {username} <span className="text-xs text-zinc-400 font-normal">({activeHero.name})</span>
            </h2>
            <p className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">
              {gameMode === 'TURN_BASED' ? '⏳ Modo Turno Tático' : '⚔️ Modo Tempo Real (30Hz)'}
            </p>
          </div>
        </div>
      </div>

      {/* HUD Superior Direito: Placar de KDA + Gold */}
      <div className="absolute top-4 right-4 pointer-events-none flex gap-3">
        <div className="glass pointer-events-auto rounded-xl px-4 py-2.5 text-center border border-amber-800/30 bg-amber-950/20">
          <p className="text-[10px] text-amber-500 font-bold uppercase tracking-wider mb-0.5">🪙 Ouro</p>
          <p className="text-lg font-mono font-extrabold text-amber-400">{playerGold}</p>
        </div>
        <div className="glass pointer-events-auto rounded-xl px-5 py-3 text-center border border-zinc-800">
          <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mb-0.5">Placar K/D</p>
          <p className="text-lg font-mono font-extrabold text-shonen-secondary">
            {playerKills} <span className="text-zinc-600 text-xs">/</span> {playerDeaths}
          </p>
        </div>
        {/* Botão da Loja */}
        <button
          onClick={() => setShowShop(s => !s)}
          className="glass pointer-events-auto rounded-xl px-4 py-2.5 border border-amber-700/40 bg-amber-900/10 hover:bg-amber-800/20 transition-all font-bold text-amber-400 text-sm"
        >
          🛒 Loja
        </button>
      </div>

      {/* HUD Inferior Esquerdo: Atributos Vitais (HP/MP) */}
      <div className="absolute bottom-6 left-6 pointer-events-none max-w-sm w-full">
        <div className="glass pointer-events-auto rounded-2xl p-4 border border-zinc-800 space-y-3">
          
          {/* Barra de Vida */}
          <div>
            <div className="flex justify-between items-center text-xs font-bold text-zinc-300 mb-1">
              <span>HP (Vida)</span>
              <span>{playerHp} / {playerMaxHp}</span>
            </div>
            <div className="w-full bg-zinc-900 h-4 rounded-full overflow-hidden border border-zinc-800">
              <div 
                className="bg-gradient-to-r from-emerald-600 to-green-500 h-full transition-all duration-150"
                style={{ width: `${hpPercentage}%` }}
              />
            </div>
          </div>

          {/* Barra de Mana */}
          <div>
            <div className="flex justify-between items-center text-xs font-bold text-zinc-300 mb-1">
              <span>MANA (Mana)</span>
              <span>{playerMp} / {playerMaxMp}</span>
            </div>
            <div className="w-full bg-zinc-900 h-4 rounded-full overflow-hidden border border-zinc-800">
              <div 
                className="bg-gradient-to-r from-blue-600 to-sky-500 h-full transition-all duration-150"
                style={{ width: `${mpPercentage}%` }}
              />
            </div>
          </div>

          {/* Barra de XP */}
          <div>
            <div className="flex justify-between items-center text-xs font-bold text-zinc-300 mb-1">
              <span>XP (Experiência)</span>
              <span>{playerXp} / {playerMaxXp}</span>
            </div>
            <div className="w-full bg-zinc-900 h-2.5 rounded-full overflow-hidden border border-zinc-800">
              <div 
                className="bg-gradient-to-r from-amber-500 to-yellow-400 h-full transition-all duration-150"
                style={{ width: `${Math.max(0, (playerXp / playerMaxXp) * 100)}%` }}
              />
            </div>
          </div>

        </div>
      </div>

      {/* HUD Inferior Direito: Controles e Turnos */}
      <div className="absolute bottom-6 right-6 pointer-events-none max-w-xs w-full">
        {gameMode === 'TURN_BASED' ? (
          /* HUD Específico do Modo Turno */
          <div className="glass pointer-events-auto rounded-2xl p-5 border border-[#8257e5] space-y-4 shadow-lg">
            
            {/* Status do Turno */}
            <div className="text-center py-2 bg-zinc-950/80 rounded-xl border border-zinc-800 font-bold text-xs uppercase tracking-wider">
              {isNpcTurn ? (
                <span className="text-amber-500 animate-pulse">🤖 Turno dos Creeps/Torres</span>
              ) : isMyTurn ? (
                <span className="text-shonen-secondary animate-bounce">⚡ Seu Turno! ⚡</span>
              ) : (
                <span className="text-zinc-500">Aguardando Vez...</span>
              )}
            </div>

            {/* PA / PM Indicators */}
            <div className="grid grid-cols-2 gap-2 text-xs font-bold text-zinc-200">
              <div className="bg-zinc-900/50 rounded-xl px-3 py-2 border border-zinc-800 text-center">
                <span className="text-[10px] block text-zinc-400 mb-0.5">Pontos de Ação (PA)</span>
                <span className="text-shonen-primary font-mono text-sm">
                  {isMyTurn ? `${playerAp} / 2` : '0 / 2'}
                </span>
              </div>
              <div className="bg-zinc-900/50 rounded-xl px-3 py-2 border border-zinc-800 text-center">
                <span className="text-[10px] block text-zinc-400 mb-0.5">Movimento (PM)</span>
                <span className="text-shonen-secondary font-mono text-sm">
                  {isMyTurn ? `${playerMpPoints} / 3` : '0 / 3'}
                </span>
              </div>
            </div>

            {/* Habilidades ativas de Turno */}
            <div className="bg-zinc-950/70 p-3 rounded-xl border border-zinc-900 space-y-1.5 text-[11px] text-zinc-300 font-medium">
              <p className="text-zinc-400 font-bold uppercase text-[9px] mb-1">Habilidades do Herói</p>
              <div>🔥 <span className="font-bold text-shonen-primary">Q:</span> {activeHero.abilities.Q.name} <span className="text-zinc-500">({activeHero.abilities.Q.manaCost} MP)</span></div>
              <div>❄️ <span className="font-bold text-shonen-primary">W:</span> {activeHero.abilities.W.name} <span className="text-zinc-500">({activeHero.abilities.W.manaCost} MP)</span></div>
            </div>

            {/* Botão de Passar Turno */}
            <button
              onClick={handleEndTurn}
              disabled={!isMyTurn || isNpcTurn}
              className="w-full py-3 bg-gradient-to-r from-[#8257e5] to-purple-600 hover:from-purple-500 hover:to-purple-600 text-white font-extrabold rounded-xl transition-all shadow-md active:scale-[0.98] disabled:opacity-30 disabled:pointer-events-none uppercase tracking-wider text-xs"
            >
              Passar Turno ⏳
            </button>

          </div>
        ) : (
          /* HUD Específico do Modo Normal */
          <div className="glass rounded-xl px-5 py-4 border border-zinc-800">
            <h3 className="text-shonen-primary font-extrabold text-xs uppercase tracking-wider mb-2">Habilidades: {activeHero.name}</h3>
            <ul className="text-[11px] text-zinc-300 space-y-1.5 font-medium leading-relaxed mb-3">
              <li>🔥 <span className="font-bold text-shonen-secondary">Q: {activeHero.abilities.Q.name}</span> - {activeHero.abilities.Q.behavior} ({activeHero.abilities.Q.manaCost} MP)</li>
              <li>❄️ <span className="font-bold text-shonen-secondary">W: {activeHero.abilities.W.name}</span> - {activeHero.abilities.W.behavior} ({activeHero.abilities.W.manaCost} MP)</li>
            </ul>

            <h3 className="text-shonen-primary font-extrabold text-[10px] uppercase tracking-wider border-t border-zinc-900 pt-2 mb-1.5">Comandos</h3>
            <ul className="text-[10px] text-zinc-400 space-y-1 font-medium leading-relaxed">
              <li>🖱️ clique direito no mapa para andar / focar inimigo.</li>
              <li>⚡ Pressione Q ou W com o mouse na direção do alvo.</li>
            </ul>
          </div>
        )}
      </div>
      {/* LOJA DE ITENS (toggle) */}
      {showShop && (
        <div className="absolute top-20 right-4 z-50 glass rounded-2xl p-5 border border-amber-700/30 w-80 shadow-2xl pointer-events-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-extrabold text-amber-400 text-sm uppercase tracking-wider">🛒 Loja de Itens</h3>
            <button onClick={() => setShowShop(false)} className="text-zinc-500 hover:text-zinc-300 text-xs font-bold">✕ Fechar</button>
          </div>
          <div className="grid grid-cols-1 gap-2 max-h-96 overflow-y-auto pr-1">
            {Object.values(shopItems).map((item: any) => (
              <div key={item.id} className="flex items-center justify-between bg-zinc-900/60 rounded-xl p-3 border border-zinc-800 hover:border-amber-700/40 transition-all">
                <div className="flex-1 min-w-0 mr-3">
                  <p className="font-bold text-xs text-zinc-200 truncate">{item.name}</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5 leading-relaxed">{item.description}</p>
                  {item.isActive && (
                    <span className="text-[9px] text-amber-400 font-bold uppercase tracking-wider">⚡ ATIVO — CD: {item.cooldown}s</span>
                  )}
                </div>
                <button
                  onClick={() => handleBuyItem(item.id)}
                  disabled={playerGold < item.cost}
                  className="flex-shrink-0 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-30 disabled:pointer-events-none text-black font-extrabold text-[10px] rounded-lg uppercase transition-all"
                >
                  {item.cost}🪙
                </button>
              </div>
            ))}
          </div>
          <p className="text-[9px] text-zinc-600 mt-3 text-center">Saldo: <span className="text-amber-400 font-bold">{playerGold} ouro</span></p>
        </div>
      )}

    </div>
  );
}
