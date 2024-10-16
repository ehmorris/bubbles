import {
  clampedProgress,
  transition,
  getHeadingInRadsFromTwoPoints,
  getVelocityFromSpeedAndHeading,
} from "./helpers.js";
import { easeOutCubic, easeOutSine } from "./easings.js";
import { red } from "./colors.js";
import { BLAST_HOLD_THRESHOLD } from "./constants.js";

const holdMaxDuration = 2000;

export const drawHoldBlastPreview = (
  canvasManager,
  { x, y },
  blastHoldStart
) => {
  const CTX = canvasManager.getContext();

  const scaleProgress = clampedProgress(
    BLAST_HOLD_THRESHOLD,
    holdMaxDuration,
    Date.now() - blastHoldStart
  );
  const previewSize = transition(0, 140, scaleProgress, easeOutSine);

  CTX.save();
  CTX.fillStyle = red;
  CTX.globalAlpha = 0.2;
  CTX.translate(x, y);
  CTX.beginPath();
  CTX.arc(0, 0, previewSize, 0, 2 * Math.PI);
  CTX.closePath();
  CTX.fill();
  CTX.restore();
};

export const makeHoldBlast = (canvasManager, { x, y }, holdDuration) => {
  const CTX = canvasManager.getContext();
  const blastStart = Date.now();
  const blastDuration = 400;
  const startSize = transition(
    0,
    140,
    clampedProgress(BLAST_HOLD_THRESHOLD, holdMaxDuration, holdDuration),
    easeOutSine
  );
  let gone = false;

  const getBlastProgress = () =>
    clampedProgress(0, blastDuration, Date.now() - blastStart);

  const getRadius = () =>
    transition(startSize, startSize * 2, getBlastProgress(), easeOutCubic);

  // A blast has no velocity since it's motionless in space, but we still want
  // to impart a direction to bubbles that a blast pops, and we want this to
  // be proportional to its power. This generates a vector from the center of
  // the blast to the given bubble's center. We pass this vector into the
  // bubble's pop() func to give its pop a direction
  const getRelativeVelocity = (targetPosition) => {
    const blastPower = startSize / 4;
    const headingToTarget =
      getHeadingInRadsFromTwoPoints({ x, y }, targetPosition) - Math.PI;

    return getVelocityFromSpeedAndHeading(blastPower, headingToTarget);
  };

  const draw = () => {
    if (!gone) {
      if (Date.now() - blastStart > blastDuration) gone = true;

      CTX.save();
      CTX.shadowColor = red;
      CTX.shadowBlur = 15;
      CTX.strokeStyle = red;
      CTX.lineWidth = transition(14, 2, getBlastProgress(), easeOutCubic);
      CTX.globalAlpha = transition(1, 0, getBlastProgress(), easeOutCubic);
      CTX.translate(x, y);
      CTX.beginPath();
      CTX.arc(0, 0, getRadius(), 0, 2 * Math.PI);
      CTX.closePath();
      CTX.stroke();
      CTX.restore();
    }
  };

  // getRadius and getPosition have to match the methods on particle.js so we
  // can run checkParticleCollision() on blasts
  return {
    getPosition: () => ({ x, y }),
    getRelativeVelocity,
    getRadius,
    draw,
    isGone: () => gone,
    causesShake: () => true,
    isSlingshot: () => false,
    isHoldBlast: () => true,
  };
};
