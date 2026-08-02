import { GRAVITY, INTERVAL } from "./constants.js";

export const makeParticle = (
  canvasManager,
  {
    radius,
    startPosition,
    startVelocity,
    gravity = GRAVITY,
    terminalVelocity = 12,
    onRightTouch = () => {},
    onBottomTouch = () => {},
    onLeftTouch = () => {},
    onTopTouch = () => {},
    onRightPassed = () => {},
    onBottomPassed = () => {},
    onLeftPassed = () => {},
    onTopPassed = () => {},
  }
) => {
  const particleStart = Date.now();
  let position = { ...startPosition };
  let velocity = { ...startVelocity };

  const update = (deltaTime) => {
    const deltaTimeMultiplier = deltaTime / INTERVAL;
    position.x += deltaTimeMultiplier * velocity.x;
    position.y += Math.min(deltaTimeMultiplier * velocity.y, terminalVelocity);
    velocity.y += deltaTimeMultiplier * gravity;

    if (position.x > canvasManager.getWidth() + radius) {
      onRightPassed(position, velocity);
    } else if (position.x > canvasManager.getWidth() - radius) {
      onRightTouch(position, velocity);
    } else if (position.x < -radius) {
      onLeftPassed(position, velocity);
    } else if (position.x < radius) {
      onLeftTouch(position, velocity);
    }

    if (position.y > canvasManager.getHeight() + radius) {
      onBottomPassed(position, velocity);
    } else if (position.y > canvasManager.getHeight() - radius) {
      onBottomTouch(position, velocity);
    } else if (position.y < -radius) {
      onTopPassed(position, velocity);
    } else if (position.y < radius) {
      onTopTouch(position, velocity);
    }
  };

  return {
    update,
    getStart: () => particleStart,
    getDuration: () => Date.now() - particleStart,
    getPosition: () => position,
    getRadius: () => radius,
    getVelocity: () => velocity,
    setPosition: (p) => (position = p),
    setVelocity: (c) => (velocity = c),
  };
};

export const checkParticleCollision = (A, B) => {
  const rSum = A.getRadius() + B.getRadius();
  const dx = B.getPosition().x - A.getPosition().x;
  const dy = B.getPosition().y - A.getPosition().y;
  return [rSum * rSum > dx * dx + dy * dy, rSum - Math.sqrt(dx * dx + dy * dy)];
};

export const resolveParticleCollision = (A, B) => {
  const relativeVelocity = {
    x: B.getVelocity().x - A.getVelocity().x,
    y: B.getVelocity().y - A.getVelocity().y,
  };

  const norm = {
    x: B.getPosition().x - A.getPosition().x,
    y: B.getPosition().y - A.getPosition().y,
  };
  const mag = Math.sqrt(norm.x * norm.x + norm.y * norm.y);
  norm.x /= mag;
  norm.y /= mag;

  const velocityAlongNorm =
    relativeVelocity.x * norm.x + relativeVelocity.y * norm.y;

  if (velocityAlongNorm > 0) return;

  const bounce = 0.7;
  let j = -(1 + bounce) * velocityAlongNorm;
  j /= 1 / A.getRadius() + 1 / B.getRadius();
  const impulse = { x: j * norm.x, y: j * norm.y };

  A.setVelocity({
    x: A.getVelocity().x - (1 / A.getRadius()) * impulse.x,
    y: A.getVelocity().y - (1 / A.getRadius()) * impulse.y,
  });

  B.setVelocity({
    x: B.getVelocity().x + (1 / B.getRadius()) * impulse.x,
    y: B.getVelocity().y + (1 / B.getRadius()) * impulse.y,
  });
};

export const adjustParticlePositions = (A, B, depth) => {
  const percent = 0.2;
  const slop = 0.01;
  let correctionNum =
    (Math.max(depth - slop, 0) / (1 / A.getRadius() + 1 / B.getRadius())) *
    percent;

  const norm = {
    x: B.getPosition().x - A.getPosition().x,
    y: B.getPosition().y - A.getPosition().y,
  };
  const mag = Math.sqrt(norm.x * norm.x + norm.y * norm.y);
  norm.x /= mag;
  norm.y /= mag;

  const correction = { x: correctionNum * norm.x, y: correctionNum * norm.y };

  A.setPosition({
    x: A.getPosition().x - (1 / A.getRadius()) * correction.x,
    y: A.getPosition().y - (1 / A.getRadius()) * correction.y,
  });

  B.setPosition({
    x: B.getPosition().x + (1 / B.getRadius()) * correction.x,
    y: B.getPosition().y + (1 / B.getRadius()) * correction.y,
  });
};
