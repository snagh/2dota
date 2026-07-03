import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import { RealTimeRoom } from './rooms/RealTimeRoom.js';
import { TurnBasedRoom } from './rooms/TurnBasedRoom.js';
import { type GameMode } from 'shared';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3001;

// Inicializa as duas salas independentes
const normalRoom = new RealTimeRoom(io);
const turnRoom = new TurnBasedRoom(io);

// Mapeamento de socketId -> sala de jogo ativa
const socketRooms: Map<string, any> = new Map();

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    normalRoom: {
      players: normalRoom.players.size,
      creeps: normalRoom.creeps.size,
      projectiles: normalRoom.projectiles.size
    },
    turnRoom: {
      players: turnRoom.players.size,
      creeps: turnRoom.creeps.size,
      projectiles: turnRoom.projectiles.size
    }
  });
});

io.on('connection', (socket: Socket) => {
  console.log(`Conectado: ${socket.id}`);

  // 1. Jogador entra no jogo especificando o modo
  socket.on('join_game', (data: { username: string; mode: GameMode }) => {
    const isTurn = data.mode === 'TURN_BASED';
    const selectedRoom = isTurn ? turnRoom : normalRoom;

    const newPlayer = selectedRoom.addPlayer(socket.id, data.username);
    socketRooms.set(socket.id, selectedRoom);

    socket.emit('joined_successfully', newPlayer);
    console.log(
      `${newPlayer.username} entrou no Modo ${isTurn ? 'Turno' : 'Normal'} (Time: ${
        newPlayer.team === 1 ? 'Sentinel' : 'Scourge'
      })`
    );
  });

  // 2. Comando de movimentação (Click-to-Move com A*)
  socket.on('move', (data: { x: number; y: number }) => {
    const room = socketRooms.get(socket.id);
    if (room) {
      room.movePlayer(socket.id, data.x, data.y);
    }
  });

  // 3. Conjuração de Habilidade (Skillshot)
  socket.on('cast_ability', (data: { key: 'Q' | 'W'; x: number; y: number }) => {
    const room = socketRooms.get(socket.id);
    if (room) {
      room.castAbility(socket.id, data.key, data.x, data.y);
    }
  });

  // 4. Passar Turno (Exclusivo do Modo Turno)
  socket.on('end_turn', () => {
    const room = socketRooms.get(socket.id);
    if (room && typeof room.endTurn === 'function') {
      room.endTurn(socket.id);
    }
  });

  // 5. Desconexão do jogador
  socket.on('disconnect', () => {
    const room = socketRooms.get(socket.id);
    if (room) {
      const player = room.players.get(socket.id);
      const username = player ? player.username : socket.id;
      console.log(`${username} desconectou do Modo ${room.roomName === 'turn_based' ? 'Turno' : 'Normal'}.`);
      
      room.removePlayer(socket.id);
      socketRooms.delete(socket.id);
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Servidor dual-mode (Normal e Turno) rodando em http://localhost:${PORT}`);
});
