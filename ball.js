import { GRAVITY } from "./constants.js";
import { makeParticle } from "./particle.js";
import {
  progress,
  transition,
  randomBetween,
  getHeadingInRadsFromTwoPoints,
  clampedProgress,
} from "./helpers.js";
import { easeOutCubic } from "./easings.js";
import { getGradientBitmap } from "./colors.js";

export const makeBall = (
  canvasManager,
  {
    startPosition,
    startVelocity,
    radius,
    fill,
    gravity = GRAVITY,
    delay = 0,
    terminalVelocity = 12,
  },
  onPop,
  onMiss
) => {
  const CTX = canvasManager.getContext();
  const popAnimationDurationMax = 2400;
  const popAnimationDuration = randomBetween(1200, popAnimationDurationMax);
  const preRenderImage = getGradientBitmap(fill);
  let popped = false;
  let poppedTime = false;
  let poppedParticles = [];
  let sparks = [];
  let missed = false;

  const baseParticle = makeParticle(canvasManager, {
    radius,
    startPosition,
    startVelocity,
    gravity,
    terminalVelocity,
    onRightTouch,
    onBottomPassed,
    onLeftTouch,
  });

  const shouldRender = () => !missed && baseParticle.getDuration() > delay;

  function onRightTouch(position, velocity) {
    position.x = canvasManager.getWidth() - radius;
    velocity.x *= -0.7;
  }

  function onBottomPassed() {
    missed = true;
    onMiss();
  }

  function onLeftTouch(position, velocity) {
    position.x = radius;
    velocity.x *= -0.7;
  }

  const pop = (popperVelocity = false) => {
    const transferringVelocity = popperVelocity
      ? popperVelocity
      : baseParticle.getVelocity();
    const numberOfPopPieces = Math.round(randomBetween(10, 80));
    popped = true;
    poppedTime = Date.now();

    // A popped ball is composed of many tiny ball objects. The first frame after
    // the pop, we want them to cluster together to form a shape that still looks
    // mostly like the ball, and then we want each of them to explode outwards.
    // This is accomplished by creating a ring of small to medium sized balls around
    // the outer edge, and also a cluster of larger balls in a smaller ring close to
    // the center of the popped ball. They all move outwards at different speeds.
    const outerParticles = new Array(numberOfPopPieces).fill().map(() => {
      const randomAngle = Math.random() * Math.PI * 2;
      const minSize = radius / 22;
      const maxSize = radius / 5;
      const innerMargin = radius / 4;
      const randomSize = randomBetween(minSize, maxSize);
      const randomSpeedMultiplier = transition(
        10,
        1.2,
        progress(1, maxSize, randomSize)
      );

      return makeParticle(canvasManager, {
        radius: randomSize,
        startPosition: {
          x:
            baseParticle.getPosition().x +
            Math.cos(randomAngle) * (radius - innerMargin),
          y:
            baseParticle.getPosition().y +
            Math.sin(randomAngle) * (radius - innerMargin),
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
        gravity,
        terminalVelocity: 90,
      });
    });

    const innerParticles = new Array(Math.round(numberOfPopPieces / 2))
      .fill()
      .map(() => {
        const randomAngle = Math.random() * Math.PI * 2;
        const minSize = radius / 7;
        const maxSize = radius / 3;
        const innerMargin = radius / 2;
        const randomSize = randomBetween(minSize, maxSize);
        const randomSpeedMultiplier = transition(
          12,
          3,
          progress(1, maxSize, randomSize)
        );

        return makeParticle(canvasManager, {
          radius: randomSize,
          startPosition: {
            x:
              baseParticle.getPosition().x +
              Math.cos(randomAngle) * (radius - innerMargin),
            y:
              baseParticle.getPosition().y +
              Math.sin(randomAngle) * (radius - innerMargin),
          },
          startVelocity: {
            x:
              transferringVelocity.x / 3 +
              Math.cos(randomAngle) * randomSpeedMultiplier,
            y:
              transferringVelocity.y / 3 +
              Math.sin(randomAngle) * randomSpeedMultiplier,
          },
          gravity,
          terminalVelocity: 90,
        });
      });

    poppedParticles = outerParticles.concat(innerParticles);

    sparks = new Array(16).fill().map(() => {
      const randomAngle = Math.random() * Math.PI * 2;
      const randomLength = randomBetween(20, 50);
      const randomSpeedMultiplier = randomBetween(8, 16);

      return makeParticle(canvasManager, {
        radius: randomLength,
        startPosition: {
          x: baseParticle.getPosition().x + Math.cos(randomAngle) * radius,
          y: baseParticle.getPosition().y + Math.sin(randomAngle) * radius,
        },
        startVelocity: {
          x:
            transferringVelocity.x / 3 +
            Math.cos(randomAngle) * randomSpeedMultiplier,
          y:
            transferringVelocity.y / 3 +
            Math.sin(randomAngle) * randomSpeedMultiplier,
        },
        gravity: 0.02,
        terminalVelocity: 110,
      });
    });

    onPop();
  };

  const draw = (deltaTime) => {
    if (popped) {
      const timeSincePopped = Date.now() - poppedTime;
      if (timeSincePopped > popAnimationDurationMax) {
        poppedParticles = [];
        sparks = [];
      } else {
        poppedParticles.forEach((p) => {
          p.update(deltaTime);

          // Some particles should fly towards the player, but most should fly away
          const scale =
            p.getRadius() > 4
              ? transition(
                  1,
                  0,
                  clampedProgress(0, popAnimationDuration, timeSincePopped),
                  easeOutCubic
                )
              : transition(
                  0.5,
                  1.5,
                  clampedProgress(0, popAnimationDuration, timeSincePopped),
                  easeOutCubic
                );

          const { x, y } = p.getPosition();
          const radius = p.getRadius();
          if (
            scale > 0 &&
            x < canvasManager.getWidth() + radius &&
            x > -radius &&
            y < canvasManager.getHeight() + radius &&
            y > -radius
          ) {
            CTX.save();
            CTX.translate(p.getPosition().x, p.getPosition().y);
            CTX.scale(scale, scale);
            CTX.drawImage(
              preRenderImage,
              -p.getRadius(),
              -p.getRadius(),
              p.getRadius() * 2,
              p.getRadius() * 2
            );
            CTX.restore();
          }
        });

        sparks.forEach((s) => {
          s.update(deltaTime);

          // Using radius to define the spark length instead
          const length = transition(
            s.getRadius(),
            0,
            clampedProgress(0, popAnimationDuration, timeSincePopped),
            easeOutCubic
          );

          const { x, y } = s.getPosition();
          if (
            length > 0 &&
            x < canvasManager.getWidth() + length &&
            x > -length &&
            y < canvasManager.getHeight() + length &&
            y > -length
          ) {
            CTX.save();
            CTX.translate(s.getPosition().x, s.getPosition().y);
            CTX.rotate(
              getHeadingInRadsFromTwoPoints(
                baseParticle.getPosition(),
                s.getPosition()
              )
            );
            CTX.fillStyle = "oklch(74.2% 0.2146 50.82)";
            CTX.fillRect(0, 0, length, 1);
            CTX.restore();
          }
        });
      }
    } else if (shouldRender()) {
      baseParticle.update(deltaTime);
      if (baseParticle.getPosition().y > -baseParticle.getRadius()) {
        CTX.save();
        CTX.translate(
          baseParticle.getPosition().x,
          baseParticle.getPosition().y
        );
        CTX.drawImage(preRenderImage, -radius, -radius, radius * 2, radius * 2);
        CTX.restore();
      }
    }
  };

  return {
    getPosition: baseParticle.getPosition,
    getVelocity: baseParticle.getVelocity,
    getRadius: baseParticle.getRadius,
    setPosition: baseParticle.setPosition,
    setVelocity: baseParticle.setVelocity,
    getFill: () => fill,
    draw,
    pop,
    isPopped: () => popped,
    isRemaining: () => !popped && !missed,
    shouldRender,
    isPopping: () =>
      popped && Date.now() - poppedTime <= popAnimationDurationMax,
  };
};
