import { makeOffscreenCanvas } from "./canvas.js";
import { makeScoreDisplay } from "./scoreDisplay.js";
import { background, yellow } from "./colors.js";
import { FONT_WEIGHT_BOLD, FONT_WEIGHT_NORMAL, FONT } from "./constants.js";

const CAPTURE_DELAYS = [880, 1900, 3800];

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
  let numCapturesTaken = 0;
  let lastCaptureUsed = -1;
  let captureToken = 0;
  let shareFile = false;

  const update = () => {
    shareImageScoreDisplay.update();
    numCapturesTaken = 0;
    lastCaptureUsed = -1;
    shareFile = false;
    captureToken++;
  };

  const captureShareImage = (sequence) => {
    const token = captureToken;

    shareImageCanvasManager
      .getElement()
      .convertToBlob({ type: "image/jpeg", quality: 0.8 })
      .then((blob) => {
        if (token === captureToken && sequence > lastCaptureUsed) {
          lastCaptureUsed = sequence;
          shareFile = new File([blob], "bubbles.jpeg", { type: "image/jpeg" });
        }
      })
      .catch(() => {});
  };

  const draw = (deltaTime, msElapsed) => {
    const settledHeight = shareImageScoreDisplay.getCurrentHeight();
    if (
      settledHeight &&
      shareImageCanvasManager.getHeight() !== settledHeight
    ) {
      shareImageCanvasManager.setCanvasSize({ height: settledHeight });
    }

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

    if (
      numCapturesTaken < CAPTURE_DELAYS.length &&
      msElapsed > CAPTURE_DELAYS[numCapturesTaken]
    ) {
      captureShareImage(numCapturesTaken++);
    }
  };

  const copyShareText = (shareText) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(shareText).catch(() => {});
    }
  };

  const share = () => {
    const stats = {
      score: scoreStore.overallScoreNumber(!levelManager.isGameOver()),
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

    const fileData = shareFile
      ? { files: [shareFile], text: shareText }
      : false;
    const textData = { text: shareText };

    const shareData =
      fileData && navigator.canShare && navigator.canShare(fileData)
        ? fileData
        : navigator.share
        ? textData
        : false;

    if (!shareData) {
      copyShareText(shareText);
      return;
    }

    try {
      navigator.share(shareData).catch((error) => {
        if (error.name !== "AbortError") copyShareText(shareText);
      });
    } catch (e) {
      copyShareText(shareText);
    }
  };

  return { update, draw, share };
};
