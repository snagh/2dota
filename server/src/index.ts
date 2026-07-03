import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import { GameRoom } from './GameRoom.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*', // Permitir qualquer origem em desenvolvimento
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3001;

// Inicializa a sala de jogo autoritária
const gameRoom = new GameRoom(io);

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    playersCount: gameRoom.players.size,
    creepsCount: gameRoom.creeps.size,
    projectilesCount: gameRoom.projectiles.size
  });
});

io.on('connection', (socket: Socket) => {
  console.log(`Conectado: ${socket.id}`);

  // 1. Jogador entra no jogo
  socket.on('join_game', (data: { username: string }) => {
    const newPlayer = gameRoom.addPlayer(socket.id, data.username);
    socket.emit('joined_successfully', newPlayer);
    console.log(`${newPlayer.username} entrou no time ${newPlayer.team === 1 ? 'Sentinel' : 'Scourge'}`);
  });

  // 2. Comando de movimentação (Click-to-Move)
  socket.on('move', (data: { x: number; y: number }) => {
    gameRoom.movePlayer(socket.id, data.x, data.y);
  });

  // 3. Conjuração de Habilidade (Skillshot)
  socket.on('cast_ability', (data: { key: 'Q' | 'W'; x: number; y: number }) => {
    if (data.key === 'Q' || data.key === 'W') {
      gameRoom.castAbility(socket.id, data.key, data.x, data.y);
    }
  });

  // 4. Desconexão do jogador
  socket.on('disconnect', () => {
    const player = gameRoom.players.get(socket.id);
    if (player) {
      console.log(`${player.username} desconectou.`);
      gameRoom.removePlayer(socket.id);
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Servidor de alta cadência rodando em http://localhost:${PORT}`);
});
