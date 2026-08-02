import { makeOffscreenCanvas } from "./canvas.js";
import { makeScoreDisplay } from "./scoreDisplay.js";
import { background, yellow } from "./colors.js";
import { FONT_WEIGHT_BOLD, FONT_WEIGHT_NORMAL, FONT } from "./constants.js";

// The share image is encoded ahead of the tap so that share() can hand it to
// navigator.share() without awaiting anything. Snapshots are taken at moments
// where the score display has settled:
//
// * 880ms: after the 816ms slide-up finishes (getCurrentHeight() reports the
//   settled height, so capturing mid-slide clips the bottom) and before the
//   mid-game share button unlocks at 960ms.
// * 1900ms: just before the end-of-game share button unlocks at 1920ms.
// * 3800ms: after the longest icon animation, the missed-tap ripple.
//
// The first two are pinned to the `delay` values in index.js. If those move,
// these move.
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
  let captureStart = Date.now();
  let numCapturesTaken = 0;
  let captureToken = 0;
  let shareFile = false;

  const update = () => {
    shareImageScoreDisplay.update();
    captureStart = Date.now();
    numCapturesTaken = 0;
    // Discard the previous interstitial's image, and make any encode still in
    // flight for it a no-op
    shareFile = false;
    captureToken++;
  };

  // convertToBlob copies the bitmap synchronously and encodes off-thread, so
  // calling this at the end of draw() captures the frame just painted
  const captureShareImage = () => {
    const token = captureToken;

    shareImageCanvasManager
      .getElement()
      .convertToBlob({ type: "image/jpeg", quality: 0.8 })
      .then((blob) => {
        if (token === captureToken) {
          shareFile = new File([blob], "bubbles.jpeg", { type: "image/jpeg" });
        }
      })
      .catch(() => {});
  };

  const draw = (deltaTime) => {
    // Resize before painting anything. Changing the height of an OffscreenCanvas
    // clears its bitmap and resets the context, so resizing partway through the
    // frame wipes everything drawn so far — which used to leave the image as
    // just the header on black. getCurrentHeight() is null until the score
    // display has drawn once, and a null height would floor the bitmap to 0.
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
      Date.now() - captureStart > CAPTURE_DELAYS[numCapturesTaken]
    ) {
      numCapturesTaken++;
      captureShareImage();
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

    // Everything from here has to run in the same turn as the pointer event.
    // Awaiting the image encode first spends the transient user activation, and
    // iOS Safari then rejects navigator.share() — the first tap did nothing and
    // the second worked only because the encoder was warm enough to land inside
    // the activation window.
    const fileData = shareFile
      ? { files: [shareFile], text: shareText }
      : false;
    const textData = { text: shareText };

    // Fall back through image + text, then text alone, then the clipboard. The
    // image is only missing if the tab was backgrounded so the capture never
    // ran, and text-only sharing beats silently copying (desktop Chrome can't
    // share files but does have a share sheet).
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
        // Dismissing the share sheet rejects with AbortError. The player
        // changed their mind, so there's nothing to recover from.
        if (error.name !== "AbortError") copyShareText(shareText);
      });
    } catch (e) {
      copyShareText(shareText);
    }
  };

  return { update, draw, share };
};
