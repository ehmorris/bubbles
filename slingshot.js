import { GRAVITY } from "./constants.js";
import { red } from "./colors.js";
import {
  getHeadingInRadsFromTwoPoints,
  getVelocityFromSpeedAndHeading,
  clampedProgress,
  transition,
} from "./helpers.js";
import { makeParticle } from "./particle.js";
import { drawTrajectory } from "./trajectory.js";

const slingshotRadius = (distance) =>
  transition(32, 12, clampedProgress(0, 600, distance));

export const drawSlingshotPreview = (
  canvasManager,
  startPosition,
  currentPosition,
  drawPreviewTrajectory = false
) => {
  const CTX = canvasManager.getContext();

  const distance = Math.sqrt(
    (startPosition.x - currentPosition.x) ** 2 +
      (startPosition.y - currentPosition.y) ** 2
  );
  const radius = slingshotRadius(distance);
  const previewVelocity = getVelocityFromSpeedAndHeading(
    distance / 10,
    getHeadingInRadsFromTwoPoints(startPosition, currentPosition)
  );

  if (drawPreviewTrajectory) {
    drawTrajectory(canvasManager, currentPosition, previewVelocity, GRAVITY);
  }

  CTX.save();
  CTX.fillStyle = red;
  CTX.strokeStyle = red;
  CTX.lineWidth = 4;
  CTX.beginPath();
  CTX.moveTo(startPosition.x, startPosition.y);
  CTX.lineTo(currentPosition.x, currentPosition.y);
  CTX.closePath();
  CTX.stroke();

  CTX.save();
  CTX.translate(startPosition.x, startPosition.y);
  CTX.rotate(
    getHeadingInRadsFromTwoPoints(startPosition, currentPosition) - Math.PI / 2
  );
  CTX.beginPath();
  CTX.moveTo(-10, -10);
  CTX.lineTo(0, 10);
  CTX.lineTo(10, -10);
  CTX.closePath();
  CTX.fill();
  CTX.restore();

  CTX.beginPath();
  CTX.arc(currentPosition.x, currentPosition.y, radius, 0, 2 * Math.PI);
  CTX.closePath();
  CTX.fill();

  CTX.restore();
};

export const makeSlingshot = (
  canvasManager,
  scoreStore,
  startPosition,
  endPosition
) => {
  const CTX = canvasManager.getContext();
  const distance = Math.sqrt(
    (startPosition.x - endPosition.x) ** 2 +
      (startPosition.y - endPosition.y) ** 2
  );

  // TODO something wrong here:
  // * Point slingshot down and left
  // * Pull back far
  // * Release
  // * Slingshot has the wrong angle
  const startVelocity = getVelocityFromSpeedAndHeading(
    distance / 10,
    getHeadingInRadsFromTwoPoints(startPosition, endPosition)
  );
  let particleGone = false;
  let numCollisions = 0;
  let positionHistory = [startPosition];
  const positionHistoryLength = 40;

  const baseParticle = makeParticle(canvasManager, {
    radius: slingshotRadius(distance),
    startPosition: { ...endPosition },
    startVelocity,
    gravity: GRAVITY,
    onRightPassed: onLeaveScreen,
    onBottomPassed: onLeaveScreen,
    onLeftPassed: onLeaveScreen,
    onTopPassed: onLeaveScreen,
  });

  let comboTrackerId = scoreStore.recordSlingshot(
    baseParticle.getPosition(),
    startVelocity,
    numCollisions
  );

  function onLeaveScreen() {
    particleGone = true;
  }

  const logCollision = () => {
    numCollisions++;
    scoreStore.updateSlingshot(comboTrackerId, numCollisions);
  };

  const draw = (deltaTime) => {
    if (!particleGone) baseParticle.update(deltaTime);

    if (positionHistory.length > 0) {
      if (!particleGone) {
        positionHistory.push({ ...baseParticle.getPosition() });
        if (positionHistory.length > positionHistoryLength)
          positionHistory.shift();
      } else {
        positionHistory.shift();
      }

      CTX.save();
      positionHistory.forEach(({ x, y }, index) => {
        if (positionHistory.length > index + 1) {
          const nextPosition = positionHistory[index + 1];
          CTX.lineWidth = baseParticle.getRadius() * 2;
          CTX.strokeStyle = red;
          CTX.globalAlpha = index / positionHistory.length;
          CTX.beginPath();
          CTX.moveTo(x, y);
          CTX.lineTo(nextPosition.x, nextPosition.y);
          CTX.stroke();
        }
      });
      CTX.restore();
    }

    if (!particleGone) {
      CTX.save();
      CTX.fillStyle = red;
      CTX.translate(baseParticle.getPosition().x, baseParticle.getPosition().y);
      CTX.beginPath();
      CTX.arc(0, 0, baseParticle.getRadius(), 0, 2 * Math.PI);
      CTX.closePath();
      CTX.fill();
      CTX.restore();
    }
  };

  return {
    getPosition: baseParticle.getPosition,
    getVelocity: baseParticle.getVelocity,
    getRadius: baseParticle.getRadius,
    setPosition: baseParticle.setPosition,
    setVelocity: baseParticle.setVelocity,
    draw,
    logCollision,
    isGone: () => particleGone,
    causesShake: () => false,
    isSlingshot: () => true,
    isHoldBlast: () => false,
  };
};
