import { GRAVITY, INTERVAL } from "./constants.js";
import {
  progress,
  clampedProgress,
  transition,
  randomBetween,
} from "./helpers.js";
import { easeInCubic, easeInOutSine, easeOutCubic } from "./easings.js";

export const makeBall = (
  CTX,
  canvasWidth,
  canvasHeight,
  { startPosition, startVelocity, radius, fill, delay = 0 },
  onPop,
  onMiss
) => {
  const popAnimationDurationMax = 2400;
  const popAnimationDuration = randomBetween(
    popAnimationDurationMax - 800,
    popAnimationDurationMax
  );
  const numberOfPopPieces = 60;
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
      position.y += deltaTimeMultiplier * velocity.y;
      velocity.y += deltaTimeMultiplier * GRAVITY;

      if (position.y > canvasHeight + radius) {
        gone = true;

        if (!popped) onMiss();
      }

      if (position.x > canvasWidth - radius) {
        position.x = canvasWidth - radius;
        velocity.x *= -0.7;
      } else if (position.x < radius) {
        position.x = radius;
        velocity.x *= -0.7;
      }
    }
  };

  const pop = () => {
    popped = true;
    poppedTime = Date.now();
    poppedPieces = new Array(numberOfPopPieces).fill().map(() => {
      const randomAngle = Math.random() * Math.PI * 2;
      const maxSize = 6;
      const randomSize = randomBetween(1, maxSize);
      const randomSpeedMultiplier = transition(
        7,
        1.2,
        progress(1, maxSize, randomSize)
      );

      return makeBall(
        CTX,
        canvasWidth,
        canvasHeight,
        {
          startPosition: {
            x: position.x + Math.cos(randomAngle) * (radius - maxSize),
            y: position.y + Math.sin(randomAngle) * (radius - maxSize),
          },
          startVelocity: {
            x: velocity.x + Math.cos(randomAngle) * randomSpeedMultiplier,
            y: velocity.y + Math.sin(randomAngle) * randomSpeedMultiplier,
          },
          radius: randomSize,
          fill,
        },
        () => {},
        () => {}
      );
    });
    onPop();
  };

  const draw = (deltaTime, scale = 1) => {
    if (popped) {
      const timeSincePopped = Date.now() - poppedTime;
      if (timeSincePopped > popAnimationDurationMax) {
        gone = true;
      } else {
        const rootBallScaleDuration = popAnimationDurationMax / 8;

        if (timeSincePopped < rootBallScaleDuration) {
          const rootBallAnimationProgress = clampedProgress(
            0,
            rootBallScaleDuration,
            timeSincePopped
          );
          const scaleTransition = transition(
            0,
            1.5,
            rootBallAnimationProgress,
            easeOutCubic
          );
          const lineWidthTransition = transition(
            8,
            0,
            rootBallAnimationProgress,
            easeOutCubic
          );

          CTX.save();
          CTX.strokeStyle = fill;
          CTX.lineWidth = lineWidthTransition;
          CTX.translate(position.x, position.y);
          CTX.scale(scaleTransition, scaleTransition);
          CTX.beginPath();
          CTX.arc(0, 0, radius, 0, 2 * Math.PI);
          CTX.closePath();
          CTX.stroke();
          CTX.restore();
        }

        poppedPieces.forEach((p) => {
          const scaleProgress = progress(
            0,
            p.getPopAnimationDuration(),
            timeSincePopped
          );
          p.update(deltaTime);
          p.draw(deltaTime, transition(1, 0, scaleProgress, easeOutCubic));
        });
      }
    } else if (shouldRender()) {
      CTX.save();
      CTX.fillStyle = fill;
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
