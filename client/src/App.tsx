import React, { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import GameEngine from './GameEngine.tsx';

export default function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [username, setUsername] = useState('');
  const [joined, setJoined] = useState(false);

  // Status do Jogador Atualizados pelo Motor PixiJS
  const [playerHp, setPlayerHp] = useState(600);
  const [playerMaxHp, setPlayerMaxHp] = useState(600);
  const [playerMp, setPlayerMp] = useState(300);
  const [playerMaxMp, setPlayerMaxMp] = useState(300);
  const [playerKills, setPlayerKills] = useState(0);
  const [playerDeaths, setPlayerDeaths] = useState(0);

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

    return () => {
      newSocket.close();
    };
  }, []);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !socket) return;
    socket.emit('join_game', { username });
  };

  const handleUpdatePlayerStats = (
    hp: number,
    maxHp: number,
    mp: number,
    maxMp: number,
    kills: number,
    deaths: number
  ) => {
    setPlayerHp(hp);
    setPlayerMaxHp(maxHp);
    setPlayerMp(mp);
    setPlayerMaxMp(maxMp);
    setPlayerKills(kills);
    setPlayerDeaths(deaths);
  };

  // 1. Tela de Entrada / Login (Lobby)
  if (!joined) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gradient-to-br from-shonen-dark via-[#0f0f15] to-[#1a0f0a] px-4">
        <div className="glass max-w-md w-full rounded-2xl p-8 shadow-2xl energy-border text-center">
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-shonen-primary to-shonen-secondary tracking-tight mb-2">
            2D.OTA
          </h1>
          <p className="text-zinc-400 text-sm mb-6">Mini MOBA 2D em Tempo Real</p>

          <form onSubmit={handleJoin} className="space-y-4">
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
            <p className="text-[10px] text-zinc-400 font-semibold">PARTIDA EM CURSO (30Hz)</p>
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

      {/* HUD Inferior Esquerdo: Atributos Vitais do Herói (Vida e Mana) */}
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

      {/* HUD Inferior Direito: Dicas e Instruções */}
      <div className="absolute bottom-6 right-6 pointer-events-none max-w-xs">
        <div className="glass rounded-xl px-5 py-4 border border-zinc-800">
          <h3 className="text-shonen-primary font-extrabold text-xs uppercase tracking-wider mb-2">Comandos do Jogo</h3>
          <ul className="text-[11px] text-zinc-300 space-y-1.5 font-medium leading-relaxed">
            <li>🖱️ <span className="text-shonen-secondary font-bold">Botão Direito</span> no mapa para se mover.</li>
            <li>⚡ Pressione <span className="bg-zinc-800 px-1.5 py-0.5 rounded text-shonen-primary font-bold">Q</span> ou <span className="bg-zinc-800 px-1.5 py-0.5 rounded text-shonen-primary font-bold">W</span> para disparar feitiços (mira pelo cursor).</li>
            <li>🌲 Creeps da selva atacam se você chegar perto!</li>
          </ul>
        </div>
      </div>

    </div>
  );
}
