import React, { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import GameEngine from './GameEngine.tsx';
import { type GameMode } from 'shared';

export default function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [username, setUsername] = useState('');
  const [selectedMode, setSelectedMode] = useState<GameMode>('NORMAL');
  const [joined, setJoined] = useState(false);

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
    socket.emit('join_game', { username, mode: selectedMode });
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

  // 1. Tela de Entrada / Login (Lobby)
  if (!joined) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gradient-to-br from-shonen-dark via-[#0f0f15] to-[#1a0f0a] px-4">
        <div className="glass max-w-md w-full rounded-2xl p-8 shadow-2xl energy-border text-center">
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-shonen-primary to-shonen-secondary tracking-tight mb-2 font-sans">
            2D.OTA
          </h1>
          <p className="text-zinc-400 text-sm mb-6">Mini MOBA 2D em Tempo Real & Turnos</p>

          <form onSubmit={handleJoin} className="space-y-4">
            {/* Escolha do Nome */}
            <div>
              <label className="block text-left text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-2">
                Nome do Herói
              </label>
              <input
                type="text"
                placeholder="Ex: Antimage, Invoker, Pudge..."
                value={username}
                onChange={e => setUsername(e.target.value)}
                maxLength={16}
                required
                className="w-full bg-[#1b1b22] border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-shonen-primary transition-all font-semibold"
              />
            </div>

            {/* Escolha do Modo de Jogo */}
            <div>
              <label className="block text-left text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-2">
                Modo de Jogo
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedMode('NORMAL')}
                  className={`py-3 rounded-xl border font-bold text-xs transition-all ${
                    selectedMode === 'NORMAL'
                      ? 'border-shonen-primary bg-shonen-primary/10 text-shonen-primary shadow-glow'
                      : 'border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  ⚔️ Tempo Real
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedMode('TURN_BASED')}
                  className={`py-3 rounded-xl border font-bold text-xs transition-all ${
                    selectedMode === 'TURN_BASED'
                      ? 'border-shonen-primary bg-shonen-primary/10 text-shonen-primary shadow-glow'
                      : 'border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  ⏳ Turno Tático
                </button>
              </div>
            </div>
            
            <button
              type="submit"
              disabled={!connected || !username.trim()}
              className="w-full py-4 rounded-xl font-bold bg-gradient-to-r from-shonen-primary to-shonen-secondary text-black hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {connected ? 'ENTRAR NA ARENA' : 'CONECTANDO AO SERVIDOR...'}
            </button>
          </form>

          <div className="mt-8 flex items-center justify-center space-x-2 text-xs text-zinc-500">
            <span className={`h-2.5 w-2.5 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span>{connected ? 'Servidor Online' : 'Servidor Offline'}</span>
          </div>
        </div>
      </div>
    );
  }

  // 2. Tela de Partida (GameEngine PixiJS + HUD TailwindCSS)
  const hpPercentage = Math.max(0, (playerHp / playerMaxHp) * 100);
  const mpPercentage = Math.max(0, (playerMp / playerMaxMp) * 100);

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
            <h2 className="font-bold text-sm text-zinc-200 uppercase tracking-wide">{username}</h2>
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
            <h3 className="text-shonen-primary font-extrabold text-xs uppercase tracking-wider mb-2">Comandos do Jogo</h3>
            <ul className="text-[11px] text-zinc-300 space-y-1.5 font-medium leading-relaxed">
              <li>🖱️ <span className="text-shonen-secondary font-bold">Botão Direito</span> no mapa para se mover.</li>
              <li>⚡ Pressione <span className="bg-zinc-800 px-1.5 py-0.5 rounded text-shonen-primary font-bold">Q</span> ou <span className="bg-zinc-800 px-1.5 py-0.5 rounded text-shonen-primary font-bold">W</span> para feitiços (Smart Cast).</li>
              <li>🌲 Monstros neutros patrulham e atacam na selva.</li>
            </ul>
          </div>
        )}
      </div>

    </div>
  );
}
