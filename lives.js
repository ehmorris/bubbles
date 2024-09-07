import { red } from "./colors.js";
import { easeInCubic, easeInOutSine } from "./easings.js";
import { clampedProgress, transition } from "./helpers.js";

export const makeLifeManager = (CTX, canvasWidth, canvasHeight) => {
  let lives;
  let previousLivesValue;
  let lastSubtractStart;

  const reset = () => {
    lives = 10;
    previousLivesValue = false;
    lastSubtractStart = false;
  };
  reset();

  const subtract = () => {
    previousLivesValue = lives;
    lives--;
    lastSubtractStart = Date.now();
  };

  const draw = () => {
    const width = 72;
    const height = 38;
    const textVerticalOffset = 1;
    const marginFromBottom = 64;

    CTX.save();
    CTX.font = "500 24px -apple-system, BlinkMacSystemFont, sans-serif";
    CTX.fillStyle = red;
    CTX.strokeStyle = red;
    CTX.lineWidth = 3;
    CTX.textAlign = "center";
    CTX.textBaseline = "middle";

    CTX.translate(canvasWidth / 2, canvasHeight - marginFromBottom);
    CTX.beginPath();
    CTX.roundRect(-width / 2, 0, width, height, height);
    CTX.stroke();

    if (previousLivesValue) {
      const lifeAnimationProgress = clampedProgress(
        0,
        160,
        Date.now() - lastSubtractStart
      );
      const travelDistance = 20;
      const blurAmount = 8;

      CTX.save();
      CTX.translate(
        0,
        transition(0, -travelDistance, lifeAnimationProgress, easeInOutSine)
      );
      CTX.globalAlpha = transition(1, 0, lifeAnimationProgress, easeInOutSine);
      CTX.filter = `blur(${transition(
        0,
        blurAmount,
        lifeAnimationProgress,
        easeInOutSine
      )}px)`;
      CTX.fillText(
        `♥ ${previousLivesValue}`,
        0,
        height / 2 + textVerticalOffset
      );
      CTX.restore();

      CTX.save();
      CTX.translate(
        0,
        transition(travelDistance, 0, lifeAnimationProgress, easeInOutSine)
      );
      CTX.globalAlpha = transition(0, 1, lifeAnimationProgress, easeInOutSine);
      CTX.filter = `blur(${transition(
        blurAmount,
        0,
        lifeAnimationProgress,
        easeInOutSine
      )}px)`;
      CTX.fillText(`♥ ${lives}`, 0, height / 2 + textVerticalOffset);
      CTX.restore();
    } else {
      CTX.fillText(`♥ ${lives}`, 0, height / 2 + textVerticalOffset);
    }

    CTX.restore();
  };

  return {
    draw,
    reset,
    subtract,
    getLives: () => lives,
  };
};
