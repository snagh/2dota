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
    serverIsNpcTurn: boolean
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
  };

  const handleEndTurn = () => {
    if (socket && isMyTurn && !isNpcTurn) {
      socket.emit('end_turn');
    }
  };

  // 1. Tela de Entrada / Login (Lobby com Seleção de Herói Premium)
  if (!joined) {
    // Filtragem de heróis da aba selecionada
    const currentTabHeroes = Object.entries(HERO_CATALOG).filter(
      ([_, def]) => def.attribute === selectedTab
    );

    const activeHeroDef = HERO_CATALOG[selectedHeroId] || HERO_CATALOG.axe;

    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gradient-to-br from-shonen-dark via-[#0c0c12] to-[#120b07] px-6 overflow-y-auto py-10 select-none">
        <div className="glass max-w-5xl w-full rounded-3xl p-8 shadow-2xl energy-border grid grid-cols-1 md:grid-cols-12 gap-8 items-stretch">
          
          {/* Coluna Esquerda: Formulário e Informações do Herói */}
          <div className="md:col-span-5 flex flex-col justify-between space-y-6">
            <div>
              <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-shonen-primary to-shonen-secondary tracking-wider text-left mb-1 font-sans">
                2D.OTA
              </h1>
              <p className="text-zinc-400 text-xs font-bold uppercase tracking-wider text-left mb-6">Mini Arena Multiplayer</p>

              <form onSubmit={handleJoin} className="space-y-4">
                {/* Nome do Jogador */}
                <div>
                  <label className="block text-left text-zinc-400 text-[10px] font-bold uppercase tracking-widest mb-1.5">
                    Nome do Jogador
                  </label>
                  <input
                    type="text"
                    placeholder="Apelido..."
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    maxLength={14}
                    required
                    className="w-full bg-[#161620] border border-zinc-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-shonen-primary transition-all text-sm font-semibold"
                  />
                </div>

                {/* Modo de Jogo */}
                <div>
                  <label className="block text-left text-zinc-400 text-[10px] font-bold uppercase tracking-widest mb-1.5">
                    Modo de Arena
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedMode('NORMAL')}
                      className={`py-2 rounded-lg border font-black text-[10px] uppercase tracking-wider transition-all ${
                        selectedMode === 'NORMAL'
                          ? 'border-shonen-primary bg-shonen-primary/10 text-shonen-primary shadow-glow'
                          : 'border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      ⚔️ Tempo Real
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedMode('TURN_BASED')}
                      className={`py-2 rounded-lg border font-black text-[10px] uppercase tracking-wider transition-all ${
                        selectedMode === 'TURN_BASED'
                          ? 'border-[#8257e5] bg-[#8257e5]/10 text-[#8257e5] shadow-glow'
                          : 'border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      ⏳ Turno Tático
                    </button>
                  </div>
                </div>
              </form>
            </div>

            {/* Painel do Herói Selecionado */}
            <div className="bg-[#121218] border border-zinc-800 rounded-2xl p-4 text-left space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-extrabold text-white text-lg tracking-wide uppercase">{activeHeroDef.name}</h3>
                  <span className="text-[10px] text-zinc-400 font-medium italic">{activeHeroDef.title}</span>
                </div>
                <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase ${
                  activeHeroDef.attribute === 'STR' ? 'bg-red-950 text-red-400 border border-red-800' :
                  activeHeroDef.attribute === 'AGI' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                  'bg-sky-950 text-sky-400 border border-sky-800'
                }`}>
                  {activeHeroDef.attribute === 'STR' ? '🔴 Força' :
                   activeHeroDef.attribute === 'AGI' ? '🟢 Agilidade' :
                   '🔵 Inteligência'}
                </span>
              </div>

              {/* Status do Herói */}
              <div className="grid grid-cols-3 gap-2 text-[10px] text-zinc-300 font-bold border-t border-b border-zinc-900 py-2">
                <div>❤️ Vida: <span className="text-zinc-100">{activeHeroDef.baseHp}</span></div>
                <div>🧪 Mana: <span className="text-zinc-100">{activeHeroDef.baseMp}</span></div>
                <div>🏃 Speed: <span className="text-zinc-100">{activeHeroDef.speed}</span></div>
              </div>

              {/* Habilidades do Herói */}
              <div className="space-y-2 text-xs">
                <div>
                  <p className="font-bold text-shonen-primary">⚡ Q: {activeHeroDef.abilities.Q.name}</p>
                  <p className="text-[10px] text-zinc-400">Tipo: {activeHeroDef.abilities.Q.behavior} | Dano: {activeHeroDef.abilities.Q.damage} | CD: {activeHeroDef.abilities.Q.cooldown}s</p>
                </div>
                <div>
                  <p className="font-bold text-shonen-secondary">⚡ W: {activeHeroDef.abilities.W.name}</p>
                  <p className="text-[10px] text-zinc-400">Tipo: {activeHeroDef.abilities.W.behavior} | Dano: {activeHeroDef.abilities.W.damage} | CD: {activeHeroDef.abilities.W.cooldown}s</p>
                </div>
              </div>
            </div>

            <button
              onClick={handleJoin}
              disabled={!connected || !username.trim()}
              className="w-full py-3.5 rounded-xl font-extrabold bg-gradient-to-r from-shonen-primary to-shonen-secondary text-black hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-30 disabled:pointer-events-none uppercase text-xs tracking-widest shadow-lg"
            >
              {connected ? 'ENTRAR NA ARENA ⚔️' : 'CONECTANDO AO SERVIDOR...'}
            </button>
          </div>

          {/* Coluna Direita: Grade de Escolha de Heróis (30 slots) */}
          <div className="md:col-span-7 flex flex-col justify-between space-y-4">
            {/* Abas de Seleção */}
            <div className="grid grid-cols-3 gap-2 bg-[#121218]/90 border border-zinc-800 rounded-xl p-1">
              <button
                type="button"
                onClick={() => setSelectedTab('STR')}
                className={`py-2 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all ${
                  selectedTab === 'STR'
                    ? 'bg-red-700/20 text-red-400 border border-red-700/40 shadow-glow'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                🔴 Força
              </button>
              <button
                type="button"
                onClick={() => setSelectedTab('AGI')}
                className={`py-2 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all ${
                  selectedTab === 'AGI'
                    ? 'bg-emerald-700/20 text-emerald-400 border border-emerald-700/40 shadow-glow'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                🟢 Agilidade
              </button>
              <button
                type="button"
                onClick={() => setSelectedTab('INT')}
                className={`py-2 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all ${
                  selectedTab === 'INT'
                    ? 'bg-sky-700/20 text-sky-400 border border-sky-700/40 shadow-glow'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                🔵 Inteligência
              </button>
            </div>

            {/* Grade de Heróis */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 overflow-y-auto max-h-[360px] pr-2 scrollbar-thin scrollbar-thumb-zinc-800">
              {currentTabHeroes.map(([heroId, def]) => {
                const isSelected = selectedHeroId === heroId;
                return (
                  <button
                    key={heroId}
                    type="button"
                    onClick={() => setSelectedHeroId(heroId)}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                      isSelected
                        ? selectedTab === 'STR' ? 'border-red-500 bg-red-950/20 shadow-red-500/20 shadow-md' :
                          selectedTab === 'AGI' ? 'border-emerald-500 bg-emerald-950/20 shadow-emerald-500/20 shadow-md' :
                          'border-sky-500 bg-sky-950/20 shadow-sky-500/20 shadow-md'
                        : 'border-zinc-800/80 bg-zinc-900/30 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <span className="font-extrabold text-sm block tracking-wide truncate">{def.name}</span>
                    <span className="text-[9px] text-zinc-500 font-medium truncate block">{def.title}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between text-[10px] text-zinc-500 border-t border-zinc-900 pt-3">
              <span>* Escolha seu herói e clique no botão para jogar.</span>
              <span className={`h-2.5 w-2.5 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
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
              {username} <span className="text-xs text-zinc-400 font-normal">({activeHero.name})</span>
            </h2>
            <p className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">
              {gameMode === 'TURN_BASED' ? '⏳ Modo Turno Tático' : '⚔️ Modo Tempo Real (30Hz)'}
            </p>
          </div>
        </div>
      </div>

      {/* HUD Superior Direito: Placar de KDA */}
      <div className="absolute top-4 right-4 pointer-events-none">
        <div className="glass pointer-events-auto rounded-xl px-5 py-3 text-center border border-zinc-800">
          <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mb-0.5">Placar K/D</p>
          <p className="text-lg font-mono font-extrabold text-shonen-secondary">
            {playerKills} <span className="text-zinc-600 text-xs">/</span> {playerDeaths}
          </p>
        </div>
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

    </div>
  );
}
