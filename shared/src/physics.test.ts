/**
 * Testes Unitários — physics.ts
 * Fase 2: Garantia de qualidade da camada física compartilhada
 *
 * Executar com: cd shared && npx tsx --test src/physics.test.ts
 * Ou com vitest: npx vitest run src/physics.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

import {
  createVector,
  getDistance,
  normalize,
  moveTowards,
  checkCircleCollision,
  updateProjectile,
  type SkillshotProjectile
} from './physics.js';

describe('createVector', () => {
  it('cria vetor com valores padrão (0, 0)', () => {
    const v = createVector();
    assert.strictEqual(v.x, 0);
    assert.strictEqual(v.y, 0);
  });

  it('cria vetor com valores fornecidos', () => {
    const v = createVector(3, 4);
    assert.strictEqual(v.x, 3);
    assert.strictEqual(v.y, 4);
  });
});

describe('getDistance', () => {
  it('calcula distância zero entre pontos iguais', () => {
    const d = getDistance({ x: 5, y: 5 }, { x: 5, y: 5 });
    assert.strictEqual(d, 0);
  });

  it('calcula distância 5 para triângulo 3-4-5', () => {
    const d = getDistance({ x: 0, y: 0 }, { x: 3, y: 4 });
    assert.strictEqual(d, 5);
  });

  it('calcula distância em eixo x puro', () => {
    const d = getDistance({ x: 0, y: 0 }, { x: 100, y: 0 });
    assert.strictEqual(d, 100);
  });
});

describe('normalize', () => {
  it('normaliza vetor com comprimento 1', () => {
    const v = normalize({ x: 3, y: 4 });
    const len = Math.sqrt(v.x * v.x + v.y * v.y);
    assert.ok(Math.abs(len - 1) < 0.0001);
  });

  it('retorna (0, 0) para vetor zero', () => {
    const v = normalize({ x: 0, y: 0 });
    assert.strictEqual(v.x, 0);
    assert.strictEqual(v.y, 0);
  });

  it('normaliza vetor puramente horizontal', () => {
    const v = normalize({ x: 100, y: 0 });
    assert.strictEqual(v.x, 1);
    assert.strictEqual(v.y, 0);
  });
});

describe('moveTowards', () => {
  it('não ultrapassa o alvo', () => {
    const result = moveTowards({ x: 0, y: 0 }, { x: 10, y: 0 }, 100);
    assert.strictEqual(result.x, 10);
    assert.strictEqual(result.y, 0);
  });

  it('avança parcialmente em direção ao alvo', () => {
    const result = moveTowards({ x: 0, y: 0 }, { x: 100, y: 0 }, 20);
    assert.strictEqual(result.x, 20);
    assert.strictEqual(result.y, 0);
  });

  it('não se move se já está no alvo', () => {
    const result = moveTowards({ x: 5, y: 5 }, { x: 5, y: 5 }, 10);
    assert.strictEqual(result.x, 5);
    assert.strictEqual(result.y, 5);
  });
});

describe('checkCircleCollision', () => {
  it('detecta colisão quando círculos se sobrepõem', () => {
    const result = checkCircleCollision({ x: 0, y: 0 }, 10, { x: 5, y: 0 }, 10);
    assert.strictEqual(result, true);
  });

  it('não detecta colisão quando círculos estão separados', () => {
    const result = checkCircleCollision({ x: 0, y: 0 }, 10, { x: 100, y: 0 }, 10);
    assert.strictEqual(result, false);
  });

  it('não detecta colisão em círculos tangentes (touching)', () => {
    // Círculos tangentes: distância = soma dos raios (NÃO colide — < não <=)
    const result = checkCircleCollision({ x: 0, y: 0 }, 5, { x: 10, y: 0 }, 5);
    assert.strictEqual(result, false);
  });
});

describe('updateProjectile', () => {
  const makeProj = (): SkillshotProjectile => ({
    id: 'test',
    casterId: 'p1',
    position: { x: 0, y: 0 },
    direction: { x: 1, y: 0 },
    speed: 100,
    radius: 8,
    damage: 50,
    distanceTraveled: 0,
    maxRange: 200,
  });

  it('avança a posição do projétil no tick', () => {
    const proj = makeProj();
    updateProjectile(proj, 0.5); // 0.5s
    assert.strictEqual(proj.position.x, 50); // 100 * 0.5
    assert.strictEqual(proj.distanceTraveled, 50);
  });

  it('retorna true quando atinge o alcance máximo', () => {
    const proj = makeProj();
    proj.distanceTraveled = 195;
    const expired = updateProjectile(proj, 0.1); // anda +10, total = 205
    assert.strictEqual(expired, true);
  });

  it('retorna false enquanto ainda dentro do alcance', () => {
    const proj = makeProj();
    const expired = updateProjectile(proj, 0.5);
    assert.strictEqual(expired, false);
  });
});
