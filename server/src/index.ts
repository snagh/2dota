import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import { RealTimeRoom } from './rooms/RealTimeRoom.js';
import { TurnBasedRoom } from './rooms/TurnBasedRoom.js';
import { ITEM_CATALOG } from './rooms/BaseRoom.js';
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

// Endpoint que retorna o catálogo de itens (para a loja no cliente)
app.get('/items', (req, res) => {
  res.json(ITEM_CATALOG);
});

io.on('connection', (socket: Socket) => {
  console.log(`Conectado: ${socket.id}`);

  // 1. Jogador entra no jogo especificando o modo e o herói escolhido
  socket.on('join_game', (data: { username: string; mode: GameMode; heroId?: string }) => {
    const isTurn = data.mode === 'TURN_BASED';
    const selectedRoom = isTurn ? turnRoom : normalRoom;

    // ─── RECONEXÃO: tenta restaurar estado de desconexão anterior ───────────
    const reconnected = selectedRoom.reconnectPlayer(socket.id, data.username);
    if (reconnected) {
      socketRooms.set(socket.id, selectedRoom);
      socket.emit('joined_successfully', reconnected);
      console.log(`[Reconexão] ${reconnected.username} retornou à partida.`);
      return;
    }
    // ────────────────────────────────────────────────────────────────────────

    const newPlayer = selectedRoom.addPlayer(socket.id, data.username, data.heroId);
    socketRooms.set(socket.id, selectedRoom);

    socket.emit('joined_successfully', newPlayer);
    console.log(
      `${newPlayer.username} entrou no Modo ${isTurn ? 'Turno' : 'Normal'} (Herói: ${newPlayer.heroId}, Time: ${
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

  // 3. Conjuração de Habilidade (Skillshot / AoE / Blink / Buff)
  socket.on('cast_ability', (data: { key: 'Q' | 'W' | 'E' | 'R'; x: number; y: number }) => {
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

  // 5. Compra de Item
  socket.on('buy_item', (data: { itemId: string }) => {
    const room = socketRooms.get(socket.id);
    if (room) {
      room.buyItem(socket.id, data.itemId);
    }
  });

  // 6. Ativar Item
  socket.on('activate_item', (data: { itemId: string; x?: number; y?: number }) => {
    const room = socketRooms.get(socket.id);
    if (room) {
      room.activateItem(socket.id, data.itemId, data.x, data.y);
    }
  });

  // 7. Dano no Roshan (jogador clica nele para atacar — o server valida distância)
  socket.on('attack_roshan', () => {
    const room = socketRooms.get(socket.id);
    if (!room) return;
    const player = room.players.get(socket.id);
    if (!player || player.hp <= 0) return;
    const rosh = room.roshan;
    if (!rosh || !rosh.alive) return;
    const dx = player.x - rosh.x;
    const dy = player.y - rosh.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= player.attackRange + 200) {
      room.damageRoshan(player.baseDamage, socket.id);
    }
  });

  // 8. Desconexão com grace period
  socket.on('disconnect', () => {
    const room = socketRooms.get(socket.id);
    if (room) {
      const player = room.players.get(socket.id);
      const username = player ? player.username : socket.id;
      console.log(`${username} desconectou — iniciando grace period.`);

      room.handlePlayerDisconnect(socket.id);
      socketRooms.delete(socket.id);
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Servidor dual-mode (Normal e Turno) rodando em http://localhost:${PORT}`);
});
