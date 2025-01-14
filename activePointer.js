import { BLAST_HOLD_THRESHOLD, SLINGSHOT_MOVE_THRESHOLD } from "./constants.js";
import { drawHoldBlastPreview, makeHoldBlast } from "./holdBlast.js";
import { drawSlingshotPreview, makeSlingshot } from "./slingshot.js";

export const makeActivePointer = (
  canvasManager,
  audioManager,
  scoreStore,
  pointerId,
  startPosition,
  onTrigger
) => {
  const pointerStart = Date.now();
  let currentPosition = { ...startPosition };
  let hitSlingshotDistanceThresholdInTime = false;

  const setPosition = ({ x, y }) => {
    currentPosition = { x, y };

    if (
      Date.now() - pointerStart <= BLAST_HOLD_THRESHOLD &&
      getDistance() > SLINGSHOT_MOVE_THRESHOLD
    ) {
      hitSlingshotDistanceThresholdInTime = true;
    }
  };

  const getDistance = () =>
    Math.hypot(
      startPosition.x - currentPosition.x,
      startPosition.y - currentPosition.y
    );

  const isSlingshot = () => hitSlingshotDistanceThresholdInTime;

  const isHoldBlast = () =>
    Date.now() - pointerStart > BLAST_HOLD_THRESHOLD &&
    !hitSlingshotDistanceThresholdInTime;

  const trigger = () => {
    if (isSlingshot()) {
      onTrigger(
        makeSlingshot(canvasManager, scoreStore, startPosition, currentPosition)
      );
      audioManager.playMiss();
    } else if (isHoldBlast()) {
      onTrigger(
        makeHoldBlast(
          canvasManager,
          scoreStore,
          startPosition,
          Date.now() - pointerStart
        )
      );
      audioManager.playImpact();
    }
  };

  const draw = () => {
    if (isSlingshot()) {
      drawSlingshotPreview(canvasManager, startPosition, currentPosition);
    } else if (isHoldBlast()) {
      drawHoldBlastPreview(canvasManager, startPosition, pointerStart);
    }
  };

  return {
    getId: () => pointerId,
    setPosition,
    trigger,
    draw,
    getDuration: () => Date.now() - pointerStart,
    isSlingshot,
    isHoldBlast,
  };
};
