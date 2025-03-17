import { yellow, white } from "./colors.js";
import { FONT, FONT_WEIGHT_BOLD } from "./constants.js";
import { levels as levelData, getLevelDataByNumber } from "./levelData.js";
import { drawTextRotate } from "./textRotate.js";
import { clampedProgress, transition } from "./helpers.js";
import { makeTextBlock } from "./textBlock.js";
import { easeOutExpo } from "./easings.js";

export const makeLevelManager = (
  canvasManager,
  onInterstitial,
  onAdvance,
  previewData
) => {
  const CTX = canvasManager.getContext();
  const countdownDuration = 2400;
  const circleRadius = 112;
  let scoreStore;
  let level;
  let previousLevelValue;
  let levelChangeStart;
  let hasCompletedInitialAdvance;
  let interstitialShowing;
  let interstitialStart;
  let gameOver;
  let hasShownPreviewInitialMessage;
  let levelStarted;
  let missedFirstBubble;

  const levelCountdownText = makeTextBlock(
    canvasManager,
    {
      xPos: canvasManager.getWidth() / 2,
      yPos: canvasManager.getHeight() / 2 - circleRadius + 10,
      textAlign: "center",
      verticalAlign: "center",
      fontSize: 32,
    },
    [""]
  );

  const overallParLabel = makeTextBlock(
    canvasManager,
    {
      xPos: canvasManager.getWidth() / 2,
      yPos: canvasManager.getHeight() / 2 + circleRadius - 34,
      textAlign: "center",
      verticalAlign: "center",
      fontWeight: FONT_WEIGHT_BOLD,
      fontSize: 14,
      fill: yellow,
      letterSpacing: "1px",
    },
    [""]
  );

  const overallParText = makeTextBlock(
    canvasManager,
    {
      xPos: canvasManager.getWidth() / 2,
      yPos: canvasManager.getHeight() / 2 + circleRadius,
      textAlign: "center",
      verticalAlign: "center",
      fontSize: 24,
    },
    [""]
  );

  const reset = () => {
    level = previewData ? previewData.name : 1;
    previousLevelValue = false;
    hasCompletedInitialAdvance = false;
    interstitialShowing = false;
    gameOver = false;
    hasShownPreviewInitialMessage = false;
    missedFirstBubble = false;
  };
  reset();

  const getLevelData = () =>
    previewData ? previewData : getLevelDataByNumber(level);

  const isLastLevel = () => level >= levelData.length;

  const showLevelInterstitial = () => {
    interstitialShowing = true;
    interstitialStart = Date.now();
    onInterstitial(interstitialStart);
  };

  const showLevelCountdown = () =>
    Date.now() - levelStarted < countdownDuration;

  const dismissInterstitialAndAdvanceLevel = () => {
    if (previewData) {
      hasShownPreviewInitialMessage = true;
      level = previewData.name;
    }

    // On the initial interstitial we want to show the "next" level, aka
    // "Level 1". However on subsequent  interstitials we want to show the
    // completed level aka the previous level, and only transition the level
    // indicator once the player has advanced by hitting "Continue"
    else if (hasCompletedInitialAdvance) {
      previousLevelValue = level;
      level++;
      levelChangeStart = Date.now();
    } else {
      hasCompletedInitialAdvance = true;
    }

    levelCountdownText.updateLines([`Par of ${getLevelData().par}`]);

    overallParLabel.updateLines(["TOTAL"]);
    const score = scoreStore.overallScoreNumber(false);
    overallParText.updateLines([
      `${score > 0 || score < 0 ? `${Math.abs(score)} ` : ""}${
        score > 0 ? "over" : score < 0 ? "under" : "Even with"
      } par so far`,
    ]);

    interstitialShowing = false;
    interstitialStart = false;
    levelStarted = Date.now();

    onAdvance();
  };

  const onGameOver = () => {
    interstitialShowing = true;
    interstitialStart = Date.now();
    gameOver = true;
    onInterstitial(interstitialStart);
  };

  const drawInterstitialMessage = ({
    previewInitialMessage,
    reachedEndOfGameMessage,
    endGameMessage,
    initialMessage,
    retryFirstLevelMessage,
    defaultMessage,
  }) => {
    if (interstitialShowing) {
      const msElapsed = Date.now() - interstitialStart;

      if (previewData && !hasShownPreviewInitialMessage) {
        previewInitialMessage(msElapsed);
      } else if (gameOver) {
        endGameMessage(msElapsed);
      } else if (isLastLevel()) {
        reachedEndOfGameMessage(msElapsed);
      } else if (level === 1 && !hasCompletedInitialAdvance && !previewData) {
        initialMessage(msElapsed);
      } else if (missedFirstBubble && !previewData) {
        retryFirstLevelMessage(msElapsed);
      } else {
        defaultMessage(msElapsed);
      }
    }
  };

  const drawLevelNumber = () => {
    const showLargeDuringCountdown = clampedProgress(
      countdownDuration,
      countdownDuration + 544,
      Date.now() - levelStarted
    );
    const yPos = transition(
      canvasManager.getHeight() / 2 - circleRadius - 12,
      24,
      showLargeDuringCountdown,
      easeOutExpo
    );

    CTX.save();
    CTX.font = `${FONT_WEIGHT_BOLD} 14px ${FONT}`;
    CTX.fillStyle = yellow;
    CTX.letterSpacing = "1px";
    CTX.textAlign = "center";
    CTX.translate(canvasManager.getWidth() / 2, yPos);

    if (!previewData && previousLevelValue) {
      drawTextRotate(
        canvasManager,
        levelChangeStart,
        `LEVEL ${previousLevelValue}`,
        `LEVEL ${level}`
      );
    } else {
      CTX.fillText(previewData ? "PREVIEW" : `LEVEL ${level}`, 0, 0);
    }

    CTX.restore();
  };

  const drawLevelCountdown = () => {
    const timeRemaining = countdownDuration - (Date.now() - levelStarted);

    levelCountdownText.draw();

    if (level > 1) {
      overallParLabel.draw();
      overallParText.draw();
    }

    CTX.save();
    CTX.translate(
      canvasManager.getWidth() / 2,
      canvasManager.getHeight() / 2 - circleRadius
    );
    CTX.lineWidth = timeRemaining / 400;
    CTX.strokeStyle = white;
    CTX.rotate(-Math.PI / 2);
    CTX.beginPath();
    CTX.arc(
      0,
      0,
      circleRadius,
      0,
      transition(
        0,
        2 * Math.PI,
        clampedProgress(countdownDuration, 0, timeRemaining)
      ),
      true
    );
    CTX.stroke();
    CTX.restore();
  };

  return {
    reset,
    setScoreStore: (s) => (scoreStore = s),
    getLevel: () => level,
    getLevelData,
    drawInterstitialMessage,
    isInterstitialShowing: () => interstitialShowing,
    drawLevelNumber,
    showLevelCountdown,
    drawLevelCountdown,
    showLevelInterstitial,
    dismissInterstitialAndAdvanceLevel,
    setMissedFirstBubble: () => (missedFirstBubble = true),
    missedFirstBubble: () => missedFirstBubble,
    isLastLevel,
    onGameOver,
    isGameOver: () => gameOver,
  };
};
