# ⚔️ 2D.OTA — Isometric MOBA Battle Royale 🎮

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-blue.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-v4-brightgreen.svg)](https://socket.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v3-38bdf8.svg)](https://tailwindcss.com/)

**2D.OTA** é um jogo de navegador multiplayer (Battle Royale híbrido com MOBA) inspirado nos clássicos mapas do Dota. Os jogadores exploram um mapa 2D modesto composto por **3 rotas (lanes)**, **monstros neutros (creeps do mato)** e **lojas de itens** em tempo real com **câmera isométrica** (estética pixelada retrô). Ao colidirem ou iniciarem encontros, os heróis entram em um combate instanciado por turnos táticos. O último sobrevivente vivo no mapa vence a partida!

---

## 🚀 Funcionalidades Principais

- 🌍 **Exploração Isométrica em Tempo Real**: Movimentação fluida em perspectiva isométrica 2D renderizada via HTML5 Canvas.
- 🗺️ **Mapa Clássico Miniaturizado**: 3 rotas (top, mid, bot) com criaturas neutras da selva que concedem ouro e experiência.
- ⚔️ **Combates Instanciados por Turnos**: Batalhas táticas individuais com seleção de habilidades de heróis, feitiços e uso de itens.
- 🎒 **Loja de Itens**: Adquira itens para customizar seus atributos e ganhar vantagens ativas/passivas no combate por turnos.
- 💰 **Rentável & Escalável**: Base de código preparada para microtransações (skins de heróis, efeitos de golpes) e backend rápido com **Express** e **Prisma ORM**.
- 🛠️ **Arquitetura Clean Code**: Lógica de jogo compartilhada (`/shared`) entre cliente e servidor para consistência de fórmulas de dano, movimento e atributos.

---

## 🛠️ Stack Tecnológica

### Frontend (`/client`)
- **React** + **Vite** + **TypeScript**
- **HTML5 Canvas** (para renderização de mapa, grades e sprites)
- **Tailwind CSS** (para menus, HUD, loja e interfaces de combate)
- **Socket.IO Client** (comunicação em tempo real)

### Backend (`/server`)
- **Node.js** + **Express** + **TypeScript**
- **Socket.IO** (gerenciamento de conexões e sincronização de estado)
- **Prisma ORM** + **PostgreSQL** (persistência de contas, inventários e estatísticas)

### Lógica Compartilhada (`/shared`)
- Regras de negócio, cálculos de dano, constantes físicas e validação de movimentos executados em comum.

---

## 📋 Pré-requisitos

Para rodar este projeto localmente, você precisa ter instalado:
* **Node.js** (versão 18 ou superior)
* **npm** (versão 9 ou superior) ou outro gerenciador que suporte workspaces.
* **PostgreSQL** (opcional para rodar localmente com banco de dados, configurável via Prisma).

---

## ⚙️ Instalação e Inicialização

### 1. Clonar o Repositório
```bash
git clone https://github.com/seu-usuario/2dota.git
cd 2dota
```

### 2. Instalar Dependências
Como utilizamos **npm Workspaces**, todas as dependências da raiz, cliente, servidor e lógica compartilhada são instaladas com um único comando na raiz do projeto:
```bash
npm install
```

### 3. Configurar Variáveis de Ambiente
No diretório `server/`, crie um arquivo `.env` baseado no seu PostgreSQL local:
```env
DATABASE_URL="postgresql://usuario:senha@localhost:5432/2dota_db?schema=public"
PORT=3001
```

### 4. Rodar em Ambiente de Desenvolvimento
Para iniciar tanto o frontend quanto o servidor em paralelo com hot-reload ativo:
```bash
npm run dev
```

O cliente estará disponível em: [http://localhost:5173](http://localhost:5173)  
O servidor estará rodando em: [http://localhost:3001](http://localhost:3001)

---

## 📂 Estrutura do Repositório

```
├── client/          # Frontend em React (Vite)
├── server/          # Servidor Express + Socket.IO + Prisma
├── shared/          # Lógica, constantes e tipos compartilhados
├── package.json     # Orquestrador do monorepo (npm Workspaces)
└── README.md        # Documentação principal
```

---

## 📄 Licença

Este projeto está licenciado sob a licença MIT - consulte o arquivo [LICENSE](LICENSE) para obter detalhes.
