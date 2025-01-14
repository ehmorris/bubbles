import { GRAVITY } from "./constants.js";
import { red } from "./colors.js";
import {
  getHeadingInRadsFromTwoPoints,
  getVelocityFromSpeedAndHeading,
  clampedProgress,
  transition,
} from "./helpers.js";
import { makeParticle } from "./particle.js";

const slingshotRadius = (distance) =>
  transition(32, 12, clampedProgress(0, 600, distance));

export const drawSlingshotPreview = (
  canvasManager,
  startPosition,
  currentPosition
) => {
  const CTX = canvasManager.getContext();
  const distance = Math.hypot(
    startPosition.x - currentPosition.x,
    startPosition.y - currentPosition.y
  );
  const radius = slingshotRadius(distance);

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
  const distance = Math.hypot(
    startPosition.x - endPosition.x,
    startPosition.y - endPosition.y
  );
  const startVelocity = getVelocityFromSpeedAndHeading(
    distance / 10,
    getHeadingInRadsFromTwoPoints(startPosition, endPosition)
  );
  let gone = false;
  let numCollisions = 0;
  let comboTrackerTimestamp = null;

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

  function onLeaveScreen() {
    gone = true;
  }

  const logCollision = () => {
    numCollisions++;

    if (numCollisions > 1) {
      scoreStore.updateSlingshot(comboTrackerTimestamp, numCollisions);
    } else {
      comboTrackerTimestamp = scoreStore.recordSlingshot(
        baseParticle.getPosition(),
        startVelocity,
        numCollisions
      );
    }
  };

  const draw = (deltaTime) => {
    if (!gone) {
      baseParticle.update(deltaTime);
      CTX.save();
      CTX.shadowColor = red;
      CTX.shadowBlur = 15;
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
    isGone: () => gone,
    causesShake: () => false,
    isSlingshot: () => true,
    isHoldBlast: () => false,
  };
};
