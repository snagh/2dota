// Matemática vetorial e física básica 2D para o MOBA 2D.OTA

export interface Vector2D {
  x: number;
  y: number;
}

/**
 * Cria um vetor 2D
 */
export function createVector(x = 0, y = 0): Vector2D {
  return { x, y };
}

/**
 * Calcula a distância entre dois pontos
 */
export function getDistance(v1: Vector2D, v2: Vector2D): number {
  const dx = v2.x - v1.x;
  const dy = v2.y - v1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Normaliza um vetor (retorna vetor com comprimento = 1)
 */
export function normalize(v: Vector2D): Vector2D {
  const len = Math.sqrt(v.x * v.x + v.y * v.y);
  if (len === 0) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

/**
 * Calcula a movimentação linear de um ponto A em direção ao ponto B com uma velocidade
 */
export function moveTowards(current: Vector2D, target: Vector2D, maxDistanceDelta: number): Vector2D {
  const toVectorX = target.x - current.x;
  const toVectorY = target.y - current.y;
  
  const dist = Math.sqrt(toVectorX * toVectorX + toVectorY * toVectorY);
  
  if (dist <= maxDistanceDelta || dist === 0) {
    return { x: target.x, y: target.y };
  }
  
  return {
    x: current.x + (toVectorX / dist) * maxDistanceDelta,
    y: current.y + (toVectorY / dist) * maxDistanceDelta
  };
}

/**
 * Verifica colisão circular (Círculo vs Círculo)
 */
export function checkCircleCollision(p1: Vector2D, r1: number, p2: Vector2D, r2: number): boolean {
  const dist = getDistance(p1, p2);
  return dist < (r1 + r2);
}

/**
 * Estrutura para representar e atualizar um Projétil (Skillshot)
 */
export interface SkillshotProjectile {
  id: string;
  casterId: string;
  position: Vector2D;
  direction: Vector2D;
  speed: number;
  radius: number;
  damage: number;
  distanceTraveled: number;
  maxRange: number;
}

/**
 * Atualiza a posição de um projétil linear e retorna true se o projétil expirou o alcance máximo
 */
export function updateProjectile(proj: SkillshotProjectile, deltaTimeSeconds: number): boolean {
  const stepDistance = proj.speed * deltaTimeSeconds;
  
  proj.position.x += proj.direction.x * stepDistance;
  proj.position.y += proj.direction.y * stepDistance;
  proj.distanceTraveled += stepDistance;
  
  return proj.distanceTraveled >= proj.maxRange;
}
