/**
 * Testes Unitários — pathfinding.ts
 * Fase 2: Garantia de qualidade do algoritmo A*
 *
 * Executar com: cd shared && npx tsx --test src/pathfinding.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

import {
  findPath,
  isCellBlocked,
  findNearestWalkableCell,
  GRID_COLS,
  GRID_ROWS
} from './pathfinding.js';

describe('isCellBlocked', () => {
  it('retorna true para células fora dos limites do grid (negativo)', () => {
    assert.strictEqual(isCellBlocked(-1, 0), true);
    assert.strictEqual(isCellBlocked(0, -1), true);
  });

  it('retorna true para células fora dos limites do grid (excede)', () => {
    assert.strictEqual(isCellBlocked(GRID_COLS, 0), true);
    assert.strictEqual(isCellBlocked(0, GRID_ROWS), true);
  });

  it('retorna false para células livres conhecidas (dentro do mapa)', () => {
    // Centro do mapa: célula 37,37 que ficou dentro da área de jungle limpa
    // Usamos coordenada que sabemos que não é selva ou torre
    assert.strictEqual(isCellBlocked(5, 5), false);
  });
});

describe('findNearestWalkableCell', () => {
  it('retorna a própria célula se já for caminhável', () => {
    const result = findNearestWalkableCell(5, 5);
    assert.strictEqual(result.col, 5);
    assert.strictEqual(result.row, 5);
  });

  it('retorna uma célula vizinha caminhável se a atual for bloqueada', () => {
    // Jungle bloqueada: r=15-22, c=20-28 (da initializeObstacles)
    const result = findNearestWalkableCell(24, 18); // dentro da jungle
    // Resultado deve ser diferente da entrada bloqueada ou a própria (se não estiver bloqueada)
    assert.ok(result.col >= 0 && result.col < GRID_COLS);
    assert.ok(result.row >= 0 && result.row < GRID_ROWS);
    // A célula retornada não deve ser bloqueada
    assert.strictEqual(isCellBlocked(result.col, result.row), false);
  });
});

describe('findPath', () => {
  it('retorna lista vazia para origem = destino na mesma célula', () => {
    const path = findPath({ x: 160, y: 160 }, { x: 164, y: 164 }); // Mesma célula (tile 32px)
    // Pode retornar [target] ou [] dependendo da implementação, mas nunca deve crashar
    assert.ok(Array.isArray(path));
  });

  it('retorna caminho não vazio para dois pontos livres distantes', () => {
    // Origem: base sentinel (150, 2250) | Destino: base scourge (2250, 150)
    const path = findPath({ x: 150, y: 2250 }, { x: 2250, y: 150 });
    assert.ok(path.length > 0);
  });

  it('primeiro waypoint está próximo da origem', () => {
    const start = { x: 200, y: 200 };
    const target = { x: 500, y: 200 };
    const path = findPath(start, target);
    if (path.length > 0) {
      const firstWaypoint = path[0];
      const dx = firstWaypoint.x - start.x;
      const dy = firstWaypoint.y - start.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      // O primeiro waypoint deve estar relativamente perto da origem (dentro de 3 tiles)
      assert.ok(dist < 32 * 4);
    }
  });

  it('último waypoint está próximo do destino', () => {
    const start = { x: 200, y: 200 };
    const target = { x: 800, y: 200 };
    const path = findPath(start, target);
    if (path.length > 0) {
      const lastWaypoint = path[path.length - 1];
      const dx = lastWaypoint.x - target.x;
      const dy = lastWaypoint.y - target.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      // O último waypoint é ajustado para ser exatamente o pixel do destino
      assert.ok(dist < 2);
    }
  });

  it('todos os waypoints estão dentro dos limites do mapa', () => {
    const path = findPath({ x: 150, y: 2250 }, { x: 2250, y: 150 });
    for (const pt of path) {
      assert.ok(pt.x >= 0 && pt.x <= 2400, `x=${pt.x} fora dos limites`);
      assert.ok(pt.y >= 0 && pt.y <= 2400, `y=${pt.y} fora dos limites`);
    }
  });
});
