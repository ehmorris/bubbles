import { GRAVITY, INTERVAL } from "./constants.js";
import {
  progress,
  transition,
  randomBetween,
  clampedProgress,
} from "./helpers.js";
import { easeOutCubic } from "./easings.js";
import { drawTrajectory } from "./trajectory.js";
import { getGradient } from "./colors.js";

export const makeBall = (
  canvasManager,
  {
    startPosition,
    startVelocity,
    radius,
    fill,
    gravity = GRAVITY,
    delay = 0,
    shouldDrawTrajectory = false,
    terminalVelocity = 12,
  },
  onPop,
  onMiss
) => {
  const CTX = canvasManager.getContext();
  const popAnimationDurationMax = 2400;
  const popAnimationDuration = randomBetween(1200, popAnimationDurationMax);
  const ballStart = Date.now();

  let position = { ...startPosition };
  let velocity = { ...startVelocity };
  let popped = false;
  let poppedTime = false;
  let poppedPieces = [];
  let gone = false;

  const shouldRender = () => !gone && Date.now() - ballStart > delay;

  const update = (deltaTime) => {
    if (shouldRender()) {
      const deltaTimeMultiplier = deltaTime / INTERVAL;
      position.x += deltaTimeMultiplier * velocity.x;
      position.y += Math.min(
        deltaTimeMultiplier * velocity.y,
        terminalVelocity
      );
      velocity.y += deltaTimeMultiplier * gravity;

      if (position.y > canvasManager.getHeight() + radius) {
        gone = true;
        if (!popped) onMiss();
      }

      if (position.x > canvasManager.getWidth() - radius) {
        position.x = canvasManager.getWidth() - radius;
        velocity.x *= -0.7;
      } else if (position.x < radius) {
        position.x = radius;
        velocity.x *= -0.7;
      }
    }
  };

  const pop = (popperVelocity = false) => {
    const transferringVelocity = popperVelocity ? popperVelocity : velocity;
    const numberOfPopPieces = Math.round(randomBetween(10, 80));
    popped = true;
    poppedTime = Date.now();

    // A popped ball is composed of many tiny ball objects. The first frame after
    // the pop, we want them to cluster together to form a shape that still looks
    // mostly like the ball, and then we want each of them to explode outwards.
    // This is accomplished by creating a ring of small to medium sized balls around
    // the outer edge, and also a cluster of larger balls in a smaller ring close to
    // the center of the popped ball. They all move outwards at different speeds.
    const outerPoppedPieces = new Array(numberOfPopPieces).fill().map(() => {
      const randomAngle = Math.random() * Math.PI * 2;
      const minSize = 2;
      const maxSize = 8;
      const innerMargin = 12;
      const randomSize = randomBetween(minSize, maxSize);
      const randomSpeedMultiplier = transition(
        10,
        1.2,
        progress(1, maxSize, randomSize)
      );

      return makeBall(
        canvasManager,
        {
          startPosition: {
            x: position.x + Math.cos(randomAngle) * (radius - innerMargin),
            y: position.y + Math.sin(randomAngle) * (radius - innerMargin),
          },
          // Popped pieces retain some of the velocity of the parent ball, but
          // mostly go straight out from the center of the ball at the given
          // randomAngle
          startVelocity: {
            x: transferringVelocity.x / 6 + Math.cos(randomAngle),
            y:
              transferringVelocity.y / 6 +
              Math.sin(randomAngle) * randomSpeedMultiplier,
          },
          radius: randomSize,
          terminalVelocity: 90,
          fill,
          gravity,
        },
        () => {},
        () => {}
      );
    });

    const innerPoppedPieces = new Array(Math.round(numberOfPopPieces / 2))
      .fill()
      .map(() => {
        const randomAngle = Math.random() * Math.PI * 2;
        const minSize = 6;
        const maxSize = 14;
        const innerMargin = 22;
        const randomSize = randomBetween(minSize, maxSize);
        const randomSpeedMultiplier = transition(
          12,
          3,
          progress(1, maxSize, randomSize)
        );

        return makeBall(
          canvasManager,
          {
            startPosition: {
              x: position.x + Math.cos(randomAngle) * (radius - innerMargin),
              y: position.y + Math.sin(randomAngle) * (radius - innerMargin),
            },
            startVelocity: {
              x:
                transferringVelocity.x / 3 +
                Math.cos(randomAngle) * randomSpeedMultiplier,
              y:
                transferringVelocity.y / 3 +
                Math.sin(randomAngle) * randomSpeedMultiplier,
            },
            radius: randomSize,
            terminalVelocity: 90,
            fill,
            gravity,
          },
          () => {},
          () => {}
        );
      });

    poppedPieces = outerPoppedPieces.concat(innerPoppedPieces);

    onPop();
  };

  const draw = (deltaTime, scale = 1) => {
    if (popped) {
      const timeSincePopped = Date.now() - poppedTime;
      if (timeSincePopped > popAnimationDurationMax) {
        gone = true;
      } else {
        poppedPieces.forEach((p) => {
          const scaleProgress = clampedProgress(
            0,
            p.getPopAnimationDuration(),
            timeSincePopped
          );
          p.update(deltaTime);
          p.draw(deltaTime, transition(1, 0, scaleProgress, easeOutCubic));
        });
      }
    } else if (shouldRender()) {
      if (shouldDrawTrajectory)
        drawTrajectory(canvasManager, position, velocity, gravity);
      CTX.save();
      CTX.fillStyle = getGradient(canvasManager, fill, radius);
      CTX.translate(position.x, position.y);
      CTX.scale(scale, scale);
      CTX.beginPath();
      CTX.arc(0, 0, radius, 0, 2 * Math.PI);
      CTX.closePath();
      CTX.fill();
      CTX.restore();
    }
  };

  return {
    update,
    draw,
    pop,
    getPosition: () => position,
    getVelocity: () => velocity,
    isPopped: () => popped,
    isRemaining: () => !popped && !gone,
    shouldRender,
    isPopping: () => popped && !gone,
    getPopAnimationDuration: () => popAnimationDuration,
    getRadius: () => radius,
    setPosition: (passedPosition) => (position = passedPosition),
    setVelocity: (passedVelocity) => (velocity = passedVelocity),
  };
};

export const checkBallCollision = (ballA, ballB) => {
  const rSum = ballA.getRadius() + ballB.getRadius();
  const dx = ballB.getPosition().x - ballA.getPosition().x;
  const dy = ballB.getPosition().y - ballA.getPosition().y;
  return [rSum * rSum > dx * dx + dy * dy, rSum - Math.sqrt(dx * dx + dy * dy)];
};

export const resolveBallCollision = (ballA, ballB) => {
  const relativeVelocity = {
    x: ballB.getVelocity().x - ballA.getVelocity().x,
    y: ballB.getVelocity().y - ballA.getVelocity().y,
  };

  const norm = {
    x: ballB.getPosition().x - ballA.getPosition().x,
    y: ballB.getPosition().y - ballA.getPosition().y,
  };
  const mag = Math.sqrt(norm.x * norm.x + norm.y * norm.y);
  norm.x /= mag;
  norm.y /= mag;

  const velocityAlongNorm =
    relativeVelocity.x * norm.x + relativeVelocity.y * norm.y;

  if (velocityAlongNorm > 0) return;

  const bounce = 0.7;
  let j = -(1 + bounce) * velocityAlongNorm;
  j /= 1 / ballA.getRadius() + 1 / ballB.getRadius();
  const impulse = { x: j * norm.x, y: j * norm.y };

  ballA.setVelocity({
    x: ballA.getVelocity().x - (1 / ballA.getRadius()) * impulse.x,
    y: ballA.getVelocity().y - (1 / ballA.getRadius()) * impulse.y,
  });

  ballB.setVelocity({
    x: ballB.getVelocity().x + (1 / ballB.getRadius()) * impulse.x,
    y: ballB.getVelocity().y + (1 / ballB.getRadius()) * impulse.y,
  });
};

export const adjustBallPositions = (ballA, ballB, depth) => {
  const percent = 0.2;
  const slop = 0.01;
  let correctionNum =
    (Math.max(depth - slop, 0) /
      (1 / ballA.getRadius() + 1 / ballB.getRadius())) *
    percent;

  const norm = {
    x: ballB.getPosition().x - ballA.getPosition().x,
    y: ballB.getPosition().y - ballA.getPosition().y,
  };
  const mag = Math.sqrt(norm.x * norm.x + norm.y * norm.y);
  norm.x /= mag;
  norm.y /= mag;

  const correction = { x: correctionNum * norm.x, y: correctionNum * norm.y };

  ballA.setPosition({
    x: ballA.getPosition().x - (1 / ballA.getRadius()) * correction.x,
    y: ballA.getPosition().y - (1 / ballA.getRadius()) * correction.y,
  });
  ballB.setPosition({
    x: ballB.getPosition().x + (1 / ballB.getRadius()) * correction.x,
    y: ballB.getPosition().y + (1 / ballB.getRadius()) * correction.y,
  });
};
