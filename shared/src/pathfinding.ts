import { GAME_SETTINGS, TOWER_LOCATIONS } from './constants.js';
import { type Vector2D } from './physics.js';

// Tamanho da Grade baseado no mapa e no tamanho do tile (2400 / 32 = 75)
export const GRID_COLS = Math.floor(GAME_SETTINGS.MAP.WIDTH / GAME_SETTINGS.MAP.TILE_SIZE); // 75
export const GRID_ROWS = Math.floor(GAME_SETTINGS.MAP.HEIGHT / GAME_SETTINGS.MAP.TILE_SIZE); // 75
const TILE_SIZE = GAME_SETTINGS.MAP.TILE_SIZE;

// Matriz de obstáculos estática (resolução 75x75)
// 0 = livre, 1 = obstáculo
const obstacleGrid: number[][] = Array(GRID_ROWS).fill(0).map(() => Array(GRID_COLS).fill(0));

/**
 * Inicializa a matriz de colisão com a topologia MOBA (rio diagonal, florestas e torres)
 */
export function initializeObstacles() {
  // Limpa a grade
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      obstacleGrid[r][c] = 0;
    }
  }

  // 1. Cria um rio central diagonal (do canto superior esquerdo ao inferior direito)
  // Bloqueia uma faixa diagonal (c === r), EXCETO pelas pontes/rampas de travessia das rotas
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      // Equação da diagonal principal: c - r próximo de 0
      const distToDiagonal = Math.abs(c - r);
      
      if (distToDiagonal <= 2) {
        // Rio bloqueado
        obstacleGrid[r][c] = 1;
      }
    }
  }

  // Abre "pontes" no rio para permitir travessias nas lanes:
  // Ponte do Top (Canto Superior Esquerdo - cruzamento da rota Top)
  for (let r = 3; r <= 7; r++) {
    for (let c = 3; c <= 7; c++) {
      if (r < GRID_ROWS && c < GRID_COLS && r >= 0 && c >= 0) obstacleGrid[r][c] = 0;
    }
  }

  // Ponte do Mid (Centro do Mapa)
  for (let r = 35; r <= 39; r++) {
    for (let c = 35; c <= 39; c++) {
      if (r < GRID_ROWS && c < GRID_COLS && r >= 0 && c >= 0) obstacleGrid[r][c] = 0;
    }
  }

  // Ponte do Bot (Canto Inferior Direito - cruzamento da rota Bot)
  for (let r = 67; r <= 71; r++) {
    for (let c = 67; c <= 71; c++) {
      if (r < GRID_ROWS && c < GRID_COLS && r >= 0 && c >= 0) obstacleGrid[r][c] = 0;
    }
  }

  // 2. Cria florestas / selva (Jungle)
  // Top Jungle (Acima do Mid)
  for (let r = 15; r <= 22; r++) {
    for (let c = 20; c <= 28; c++) {
      obstacleGrid[r][c] = 1;
    }
  }

  // Bot Jungle (Abaixo do Mid)
  for (let r = 50; r <= 57; r++) {
    for (let c = 45; c <= 53; c++) {
      obstacleGrid[r][c] = 1;
    }
  }

  // 3. Bloqueia células onde as Torres estão posicionadas (grade 3x3 em torno de cada torre)
  TOWER_LOCATIONS.forEach(tower => {
    const col = Math.floor(tower.x / TILE_SIZE);
    const row = Math.floor(tower.y / TILE_SIZE);

    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = row + dr;
        const nc = col + dc;
        if (nr >= 0 && nr < GRID_ROWS && nc >= 0 && nc < GRID_COLS) {
          obstacleGrid[nr][nc] = 1;
        }
      }
    }
  });

  // 4. Limpa áreas ao redor dos campos de creeps neutros na selva para que fiquem acessíveis
  const camps = [
    { x: 800, y: 700 },
    { x: 1600, y: 1700 },
    { x: 600, y: 1400 },
    { x: 1800, y: 1000 }
  ];
  camps.forEach(camp => {
    const col = Math.floor(camp.x / TILE_SIZE);
    const row = Math.floor(camp.y / TILE_SIZE);
    for (let dr = -3; dr <= 3; dr++) {
      for (let dc = -3; dc <= 3; dc++) {
        const nr = row + dr;
        const nc = col + dc;
        if (nr >= 0 && nr < GRID_ROWS && nc >= 0 && nc < GRID_COLS) {
          obstacleGrid[nr][nc] = 0;
        }
      }
    }
  });
}

// Inicializa a grade assim que o módulo é carregado
initializeObstacles();

/**
 * Retorna se determinada coordenada da grade é um obstáculo
 */
export function isCellBlocked(col: number, row: number): boolean {
  if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return true;
  return obstacleGrid[row][col] === 1;
}

/**
 * Retorna uma cópia da grade de obstáculos (usado pelo cliente ou debug)
 */
export function getObstacleGrid(): number[][] {
  return obstacleGrid;
}

// Nó do A*
interface AStarNode {
  col: number;
  row: number;
  g: number; // Custo do início ao nó
  h: number; // Heurística do nó ao fim
  f: number; // Custo total g + h
  parent: AStarNode | null;
}

/**
 * Encontra a célula livre mais próxima de uma célula bloqueada usando BFS (Breadth-First Search)
 */
export function findNearestWalkableCell(col: number, row: number): { col: number; row: number } {
  if (!isCellBlocked(col, row)) return { col, row };

  const queue: { col: number; row: number }[] = [{ col, row }];
  const visited = new Set<string>();
  visited.add(`${col},${row}`);

  const maxSearchDist = 20;

  while (queue.length > 0) {
    const curr = queue.shift()!;
    const dist = Math.abs(curr.col - col) + Math.abs(curr.row - row);
    
    if (dist > maxSearchDist) continue;

    if (!isCellBlocked(curr.col, curr.row)) {
      return curr;
    }

    const neighbors = [
      { col: curr.col + 1, row: curr.row },
      { col: curr.col - 1, row: curr.row },
      { col: curr.col, row: curr.row + 1 },
      { col: curr.col, row: curr.row - 1 }
    ];

    for (const n of neighbors) {
      const key = `${n.col},${n.row}`;
      if (n.col >= 0 && n.col < GRID_COLS && n.row >= 0 && n.row < GRID_ROWS && !visited.has(key)) {
        visited.add(key);
        queue.push(n);
      }
    }
  }

  return { col, row };
}

/**
 * Algoritmo A* Pathfinding de 8 direções para encontrar caminho em pixels
 */
export function findPath(start: Vector2D, target: Vector2D): Vector2D[] {
  // Converte pixels para células da grade
  const startCol = Math.floor(start.x / TILE_SIZE);
  const startRow = Math.floor(start.y / TILE_SIZE);
  const targetCol = Math.max(0, Math.min(GRID_COLS - 1, Math.floor(target.x / TILE_SIZE)));
  const targetRow = Math.max(0, Math.min(GRID_ROWS - 1, Math.floor(target.y / TILE_SIZE)));

  // Se o ponto de partida for igual ao ponto final na grade, move direto para o pixel alvo
  if (startCol === targetCol && startRow === targetRow) {
    return [target];
  }

  // Encontra a célula livre mais próxima caso o destino esteja bloqueado (BFS Fallback)
  const nearest = findNearestWalkableCell(targetCol, targetRow);
  const actualTargetCol = nearest.col;
  const actualTargetRow = nearest.row;

  const openList: AStarNode[] = [];
  const closedSet = new Set<string>();

  const startNode: AStarNode = {
    col: startCol,
    row: startRow,
    g: 0,
    h: Math.abs(startCol - actualTargetCol) + Math.abs(startRow - actualTargetRow),
    f: 0,
    parent: null
  };
  startNode.f = startNode.g + startNode.h;

  openList.push(startNode);

  while (openList.length > 0) {
    // Busca o índice do nó com menor custo F (Varredura linear O(N) de alta performance)
    let minIndex = 0;
    for (let i = 1; i < openList.length; i++) {
      if (openList[i].f < openList[minIndex].f) {
        minIndex = i;
      }
    }
    const current = openList.splice(minIndex, 1)[0];

    closedSet.add(`${current.col},${current.row}`);

    // Se chegou ao nó de destino
    if (current.col === actualTargetCol && current.row === actualTargetRow) {
      const path: Vector2D[] = [];
      let curr: AStarNode | null = current;
      
      while (curr !== null) {
        // Converte as coordenadas da grade de volta para coordenadas em pixel (centro da célula)
        path.push({
          x: curr.col * TILE_SIZE + TILE_SIZE / 2,
          y: curr.row * TILE_SIZE + TILE_SIZE / 2
        });
        curr = curr.parent;
      }
      
      path.reverse();
      
      // Ajusta o último waypoint para ser exatamente o pixel do clique do mouse original
      if (path.length > 0) {
        path[path.length - 1] = target;
      }
      return path;
    }

    // Direções de movimento (8 direções)
    // Custo ortogonal = 10, Custo diagonal = 14 (~raiz de 2)
    const moves = [
      { dc: 1, dr: 0, cost: 10 },
      { dc: -1, dr: 0, cost: 10 },
      { dc: 0, dr: 1, cost: 10 },
      { dc: 0, dr: -1, cost: 10 },
      // Diagonais
      { dc: 1, dr: 1, cost: 14 },
      { dc: -1, dr: -1, cost: 14 },
      { dc: 1, dr: -1, cost: 14 },
      { dc: -1, dr: 1, cost: 14 }
    ];

    for (const move of moves) {
      const nextCol = current.col + move.dc;
      const nextRow = current.row + move.dr;

      if (nextCol < 0 || nextCol >= GRID_COLS || nextRow < 0 || nextRow >= GRID_ROWS) continue;
      if (isCellBlocked(nextCol, nextRow)) continue;

      // Evita cortar cantos de obstáculos em movimentos diagonais
      if (Math.abs(move.dc) === 1 && Math.abs(move.dr) === 1) {
        if (isCellBlocked(current.col + move.dc, current.row) || isCellBlocked(current.col, current.row + move.dr)) {
          continue; // Cortar quina bloqueado
        }
      }

      const key = `${nextCol},${nextRow}`;
      if (closedSet.has(key)) continue;

      const gCost = current.g + move.cost;
      
      // Heurística de distância Euclidiana
      const hCost = Math.sqrt(Math.pow(nextCol - actualTargetCol, 2) + Math.pow(nextRow - actualTargetRow, 2)) * 10;
      
      const existingNode = openList.find(n => n.col === nextCol && n.row === nextRow);

      if (!existingNode) {
        const neighborNode: AStarNode = {
          col: nextCol,
          row: nextRow,
          g: gCost,
          h: hCost,
          f: gCost + hCost,
          parent: current
        };
        openList.push(neighborNode);
      } else if (gCost < existingNode.g) {
        existingNode.g = gCost;
        existingNode.f = gCost + existingNode.h;
        existingNode.parent = current;
      }
    }
  }

  // Sem caminho possível
  return [];
}
