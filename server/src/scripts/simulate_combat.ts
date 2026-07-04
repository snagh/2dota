/**
 * Script de Simulação de Combate 1x1 — 2D.OTA
 * Fase 5: Ferramenta de balanceamento de heróis
 *
 * Como usar:
 *   cd server && npx tsx src/scripts/simulate_combat.ts [hero1] [hero2] [level]
 * Exemplo:
 *   npx tsx src/scripts/simulate_combat.ts axe sniper 6
 */

import { HERO_CATALOG } from 'shared';

interface SimPlayer {
  heroId: string;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  baseDamage: number;
  attackRange: number;
  attackInterval: number; // ms entre ataques
  speed: number;
  level: number;
  kills: number;
}

function buildPlayer(heroId: string, level: number): SimPlayer {
  const def = HERO_CATALOG[heroId];
  if (!def) throw new Error(`Herói não encontrado: ${heroId}`);

  let maxHp = def.baseHp;
  let maxMp = def.baseMp;
  let baseDamage = 50;
  let attackRange = def.baseAttackRange;
  const speed = def.speed || 300;

  // Aplica ganhos de nível
  for (let i = 1; i < level; i++) {
    if (def.attribute === 'STR') {
      maxHp += 100; maxMp += 30; baseDamage += 6;
      attackRange += def.isRanged ? 10 : 2;
    } else if (def.attribute === 'AGI') {
      maxHp += 60; maxMp += 40; baseDamage += 8;
      attackRange += def.isRanged ? 15 : 2;
    } else {
      maxHp += 45; maxMp += 80; baseDamage += 5;
      attackRange += def.isRanged ? 10 : 2;
    }
  }

  return {
    heroId,
    hp: maxHp,
    maxHp,
    mp: maxMp,
    maxMp,
    baseDamage,
    attackRange,
    attackInterval: 1000, // ms
    speed,
    level,
    kills: 0
  };
}

function simulateCombat(
  hero1Id: string,
  hero2Id: string,
  level: number,
  iterations = 1000
): {
  hero1WinRate: number;
  hero2WinRate: number;
  drawRate: number;
  avgDurationMs: number;
  hero1Dps: number;
  hero2Dps: number;
  hero1Ehp: number;
  hero2Ehp: number;
} {
  const def1 = HERO_CATALOG[hero1Id];
  const def2 = HERO_CATALOG[hero2Id];

  if (!def1 || !def2) {
    throw new Error(`Herói inválido: ${hero1Id} ou ${hero2Id}`);
  }

  let wins1 = 0, wins2 = 0, draws = 0;
  let totalDuration = 0;

  for (let iter = 0; iter < iterations; iter++) {
    const p1 = buildPlayer(hero1Id, level);
    const p2 = buildPlayer(hero2Id, level);

    // Tick simulado de 100ms por iteração (coerente com 30Hz ≈ 33ms)
    const SIM_TICK = 100; // ms
    const SIM_MAX_TIME = 60000; // 60 segundos = limite da luta
    let elapsed = 0;

    let lastAttack1 = 0;
    let lastAttack2 = 0;

    while (p1.hp > 0 && p2.hp > 0 && elapsed < SIM_MAX_TIME) {
      elapsed += SIM_TICK;

      // Simula que ambos estão ao alcance um do outro
      // P1 ataca P2
      if (elapsed - lastAttack1 >= p1.attackInterval) {
        lastAttack1 = elapsed;
        p2.hp = Math.max(0, p2.hp - p1.baseDamage);
      }

      // P2 ataca P1
      if (elapsed - lastAttack2 >= p2.attackInterval) {
        lastAttack2 = elapsed;
        p1.hp = Math.max(0, p1.hp - p2.baseDamage);
      }
    }

    totalDuration += elapsed;

    if (p1.hp <= 0 && p2.hp <= 0) draws++;
    else if (p1.hp > 0) wins1++;
    else wins2++;
  }

  // Calcula DPS e EHP (Effective HP)
  const template1 = buildPlayer(hero1Id, level);
  const template2 = buildPlayer(hero2Id, level);

  const hero1Dps = (template1.baseDamage * 1000) / template1.attackInterval;
  const hero2Dps = (template2.baseDamage * 1000) / template2.attackInterval;
  const hero1Ehp = template1.maxHp; // Pode ser expandido com armor
  const hero2Ehp = template2.maxHp;

  return {
    hero1WinRate: (wins1 / iterations) * 100,
    hero2WinRate: (wins2 / iterations) * 100,
    drawRate: (draws / iterations) * 100,
    avgDurationMs: totalDuration / iterations,
    hero1Dps,
    hero2Dps,
    hero1Ehp,
    hero2Ehp
  };
}

// ─── CLI Entry Point ──────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const hero1Id = args[0] || 'axe';
const hero2Id = args[1] || 'sniper';
const level = parseInt(args[2] || '6', 10);

console.log(`\n🔮 Simulação de Combate 2D.OTA — Nível ${level}`);
console.log(`   ${hero1Id.toUpperCase()} vs ${hero2Id.toUpperCase()}`);
console.log('─'.repeat(48));

try {
  const result = simulateCombat(hero1Id, hero2Id, level, 1000);

  console.log(`\n📊 RESULTADO (1000 iterações):`);
  console.log(`  ${hero1Id}: ${result.hero1WinRate.toFixed(1)}% de vitórias`);
  console.log(`  ${hero2Id}: ${result.hero2WinRate.toFixed(1)}% de vitórias`);
  console.log(`  Empates: ${result.drawRate.toFixed(1)}%`);
  console.log(`  Duração média da luta: ${(result.avgDurationMs / 1000).toFixed(1)}s`);

  console.log(`\n⚔️  DPS (Dano por Segundo):`);
  console.log(`  ${hero1Id}: ${result.hero1Dps.toFixed(1)} DPS`);
  console.log(`  ${hero2Id}: ${result.hero2Dps.toFixed(1)} DPS`);

  console.log(`\n❤️  EHP (HP Efetivo no Nível ${level}):`);
  console.log(`  ${hero1Id}: ${result.hero1Ehp} HP`);
  console.log(`  ${hero2Id}: ${result.hero2Ehp} HP`);

  console.log(`\n💡 TTK (Tempo para Matar):`);
  console.log(`  ${hero1Id} mata ${hero2Id} em: ${(result.hero2Ehp / result.hero1Dps).toFixed(1)}s`);
  console.log(`  ${hero2Id} mata ${hero1Id} em: ${(result.hero1Ehp / result.hero2Dps).toFixed(1)}s`);

  // Sugere balanceamento
  const diff = Math.abs(result.hero1WinRate - result.hero2WinRate);
  if (diff > 20) {
    const stronger = result.hero1WinRate > result.hero2WinRate ? hero1Id : hero2Id;
    const weaker = result.hero1WinRate > result.hero2WinRate ? hero2Id : hero1Id;
    console.log(`\n⚠️  DESBALANCEAMENTO DETECTADO (diferença de ${diff.toFixed(1)}%)`);
    console.log(`   Considere reduzir baseDamage de ${stronger} ou aumentar baseHp de ${weaker}.`);
  } else {
    console.log(`\n✅ Combate razoavelmente equilibrado (diferença de ${diff.toFixed(1)}%)`);
  }

} catch (err: any) {
  console.error(`\n❌ Erro: ${err.message}`);
  console.log(`\nHeróis disponíveis: ${Object.keys(HERO_CATALOG).join(', ')}`);
}
