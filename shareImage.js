import { makeOffscreenCanvas } from "./canvas.js";
import { makeScoreDisplay } from "./scoreDisplay.js";
import { background, yellow } from "./colors.js";
import { FONT_WEIGHT_BOLD, FONT_WEIGHT_NORMAL, FONT } from "./constants.js";

export const makeShareImageManager = (scoreStore, levelManager) => {
  const shareImageCanvasManager = makeOffscreenCanvas({
    width: 400,
    height: 500,
    scale: 2,
  });

  const shareImageScoreDisplay = makeScoreDisplay(
    shareImageCanvasManager,
    scoreStore,
    levelManager,
    { edgeMargin: 20, verticalMarginBetweenSections: 36 }
  );

  const CTX = shareImageCanvasManager.getContext();

  const update = () => {
    shareImageScoreDisplay.update();
  };

  const draw = (deltaTime) => {
    CTX.save();
    CTX.fillStyle = background;
    CTX.fillRect(
      0,
      0,
      shareImageCanvasManager.getWidth(),
      shareImageCanvasManager.getHeight()
    );
    CTX.restore();

    shareImageScoreDisplay.draw(deltaTime);

    if (
      shareImageCanvasManager.getHeight() !==
      shareImageScoreDisplay.getCurrentHeight()
    ) {
      shareImageCanvasManager.setCanvasSize({
        height: shareImageScoreDisplay.getCurrentHeight(),
      });
    }

    CTX.save();

    CTX.font = `${FONT_WEIGHT_BOLD} 14px ${FONT}`;
    CTX.fillStyle = yellow;
    CTX.letterSpacing = "1px";
    CTX.fillText(`LEVEL ${levelManager.getLevel()}`, 20, 36);

    CTX.font = `${FONT_WEIGHT_NORMAL} 10px ${FONT}`;
    CTX.fillStyle = "rgba(255, 255, 255, 0.4)";
    CTX.letterSpacing = "0px";
    CTX.textAlign = "right";
    CTX.fillText(
      `ehmorris.com/bubbles`,
      shareImageCanvasManager.getWidth() - 20,
      24
    );

    CTX.restore();
  };

  const share = () => {
    const stats = {
      score: scoreStore.overallScoreNumber(),
      taps: scoreStore.getTaps(),
      tapsPopped: scoreStore.sumCategoryLevelEvents("taps").numPopped,
      slingshots: scoreStore.getSlingshots(),
      blasts: scoreStore.getBlasts(),
    };

    const shareText = `${
      !levelManager.isGameOver() && levelManager.isLastLevel()
        ? "I beat Bubbles!"
        : `Made it to level ${levelManager.getLevel()} in Bubbles!`
    }
${stats.score > 0 || stats.score < 0 ? `${Math.abs(stats.score)} ` : ""}${
      stats.score > 0 ? "over" : stats.score < 0 ? "under" : "Even with"
    } par overall
  
https://ehmorris.com/bubbles

👆 Tapped ${stats.taps.length} times: ${stats.tapsPopped} ${
      stats.tapsPopped === 1 ? "hit" : "hits"
    }, ${stats.taps.length - stats.tapsPopped} ${
      stats.taps.length - stats.tapsPopped === 1 ? "miss" : "misses"
    }
☄️ Launched ${stats.slingshots.length} ${
      stats.slingshots.length === 1 ? "slingshot" : "slingshots"
    }
💥 Detonated ${stats.blasts.length} ${
      stats.blasts.length === 1 ? "blast" : "blasts"
    }
`;

    shareImageCanvasManager
      .getElement()
      .convertToBlob({ type: "image/jpeg", quality: 0.8 })
      .then((blob) => {
        const data = {
          files: [
            new File([blob], "bubbles.jpeg", {
              type: "image/jpeg",
            }),
          ],
          text: shareText,
        };

        navigator.canShare && navigator.canShare(data)
          ? navigator.share(data)
          : navigator.clipboard.writeText(shareText);
      });
  };

  return { update, draw, share };
};
