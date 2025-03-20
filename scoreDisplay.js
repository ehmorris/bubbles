import {
  FONT,
  FONT_WEIGHT_NORMAL,
  FONT_WEIGHT_BOLD,
  BLAST_MAX_SIZE,
} from "./constants.js";
import { getGradientBitmap, red, white } from "./colors.js";
import { clampedProgress, transition, randomBetween } from "./helpers.js";
import {
  easeInOutSine,
  easeOutQuad,
  easeOutCubic,
  easeOutBack,
  easeOutQuart,
  easeOutExpo,
} from "./easings.js";
import { makeGrid } from "./grid.js";
import { makeTextBlock } from "./textBlock.js";

export const makeScoreDisplay = (
  canvasManager,
  scoreStore,
  levelManager,
  {
    edgeMargin = 32,
    verticalMargin = 32,
    verticalMarginBetweenSections = 48,
  } = {}
) => {
  const CTX = canvasManager.getContext();
  const iconSize = 24;
  const iconRadius = iconSize / 2;
  const numPoppedTextWidth = 40;
  let scoreDisplayStart = Date.now();
  let stats = null;
  let scoreHeight = null;

  const topText = makeTextBlock(
    canvasManager,
    {
      xPos: edgeMargin,
      yPos: verticalMarginBetweenSections,
      fontSize: 28,
      fontWeight: FONT_WEIGHT_BOLD,
      lineHeight: 36,
    },
    []
  );

  const update = () => {
    const currentLevel = levelManager.getLevel();
    const textLines = [];
    scoreDisplayStart = Date.now();

    if (levelManager.isGameOver() || levelManager.isLastLevel()) {
      stats = {
        score: scoreStore.overallScoreNumber(),
        taps: scoreStore.getTaps(),
        tapsPopped: scoreStore.sumCategoryLevelEvents("taps").numPopped,
        slingshots: scoreStore.getSlingshots(),
        blasts: scoreStore.getBlasts(),
        totalPopped: scoreStore.sumPopped(),
        totalMissed: scoreStore.sumCategoryLevelEvents("missedBubbles").num,
      };

      textLines.push(
        levelManager.isGameOver()
          ? `Reached level ${currentLevel}`
          : "You beat all levels!"
      );

      textLines.push(
        `${
          stats.score > 0 || stats.score < 0 ? `${Math.abs(stats.score)} ` : ""
        }${
          stats.score > 0 ? "over" : stats.score < 0 ? "under" : "Even with"
        } par overall:`
      );
    } else {
      stats = {
        score: scoreStore.levelScoreNumber(),
        taps: scoreStore.getTaps(currentLevel),
        tapsPopped: scoreStore.sumCategoryLevelEvents("taps", currentLevel)
          .numPopped,
        slingshots: scoreStore.getSlingshots(currentLevel),
        blasts: scoreStore.getBlasts(currentLevel),
        totalPopped: scoreStore.sumPopped(currentLevel),
        totalMissed: scoreStore.sumCategoryLevelEvents(
          "missedBubbles",
          currentLevel
        ).num,
      };

      if (stats.totalMissed) {
        textLines.push(
          `Lost ${stats.totalMissed} ${
            stats.totalMissed === 1 ? "life" : "lives"
          }`
        );
      }

      textLines.push(
        `${
          stats.score <= -4
            ? "Condor, "
            : stats.score === -3
            ? "Albatross, "
            : stats.score === -2
            ? "Eagle, "
            : stats.score === -1
            ? "Birdie, "
            : stats.score === 1
            ? "Bogey, "
            : stats.score === 2
            ? "Double bogey, "
            : stats.score === 3
            ? "Triple Bogey, "
            : stats.score >= 4
            ? "Disaster, "
            : ""
        }${
          stats.score > 0 || stats.score < 0 ? `${Math.abs(stats.score)} ` : ""
        }${
          stats.score > 0 ? "over" : stats.score < 0 ? "under" : "Even with"
        } par:`
      );
    }

    topText.updateLines(textLines);
  };

  const draw = () => {
    CTX.save();
    // Darken screen so it looks different from normal interstitial
    if (levelManager.isGameOver() || levelManager.isLastLevel()) {
      CTX.fillStyle = "rgba(0, 0, 0, 0.6)";
      CTX.fillRect(0, 0, canvasManager.getWidth(), canvasManager.getHeight());
    }
    topText.draw();
    CTX.restore();

    CTX.save();

    const slideUpTransition = transition(
      topText.getHeight() +
        topText.getBoundingBox().top +
        verticalMarginBetweenSections * 1.4,
      topText.getHeight() +
        topText.getBoundingBox().top +
        verticalMarginBetweenSections,
      clampedProgress(0, 816, Date.now() - scoreDisplayStart),
      easeOutExpo
    );

    CTX.translate(0, slideUpTransition);
    scoreHeight =
      topText.getHeight() +
      topText.getBoundingBox().top +
      verticalMarginBetweenSections;

    if (stats.taps.length) {
      drawTitleLine(
        "TAPS",
        `${stats.tapsPopped} ${stats.tapsPopped === 1 ? "Hit" : "Hits"}, ${
          stats.taps.length - stats.tapsPopped
        } ${stats.taps.length - stats.tapsPopped === 1 ? "Miss" : "Misses"}`
      );

      CTX.translate(0, verticalMargin);
      scoreHeight += verticalMargin;

      const tapsGrid = makeGrid(canvasManager, stats.taps, {
        itemWidth: iconSize,
        itemHeight: iconSize,
        edgeMargin,
        maxRows: 2,
      });

      tapsGrid.drawItems(drawTapItem);

      CTX.translate(0, tapsGrid.getHeight() + verticalMarginBetweenSections);
      scoreHeight += tapsGrid.getHeight() + verticalMarginBetweenSections;
    }

    if (stats.slingshots.length) {
      drawTitleLine("SLINGSHOTS", `${stats.slingshots.length} Launched`);

      CTX.translate(0, verticalMargin);
      scoreHeight += verticalMargin;

      const slingshotsGrid = makeGrid(canvasManager, stats.slingshots, {
        itemWidth: iconSize + 8 + numPoppedTextWidth,
        itemHeight: iconSize,
        edgeMargin,
      });

      slingshotsGrid.drawItems(drawSlingshotItem);

      CTX.translate(
        0,
        slingshotsGrid.getHeight() + verticalMarginBetweenSections
      );
      scoreHeight += slingshotsGrid.getHeight() + verticalMarginBetweenSections;
    }

    if (stats.blasts.length) {
      drawTitleLine("BLASTS", `${stats.blasts.length} Detonated`);

      CTX.translate(0, verticalMargin);
      scoreHeight += verticalMargin;

      const blastsGrid = makeGrid(canvasManager, stats.blasts, {
        itemWidth: iconSize + 8 + numPoppedTextWidth,
        itemHeight: iconSize,
        edgeMargin,
        maxRows: 2,
      });

      blastsGrid.drawItems(drawBlastItem);

      scoreHeight += blastsGrid.getHeight() + verticalMarginBetweenSections;
    }

    CTX.restore();
  };

  function drawTitleLine(leftText, rightText) {
    CTX.save();
    applyTextStyle1(CTX);
    const leftTextWidth = CTX.measureText(leftText).width;
    const leftTextHeight = 10;

    CTX.fillText(leftText, edgeMargin, leftTextHeight);
    CTX.restore();

    CTX.save();
    applyTextStyle2(CTX);
    const rightTextWidth = CTX.measureText(rightText).width;
    CTX.fillText(
      rightText,
      canvasManager.getWidth() - edgeMargin,
      leftTextHeight
    );
    CTX.restore();

    const lineMargin = 8;
    CTX.fillStyle = "rgba(255, 255, 255, .2)";
    CTX.fillRect(
      leftTextWidth + edgeMargin + lineMargin,
      leftTextHeight / 2,
      canvasManager.getWidth() -
        leftTextWidth -
        rightTextWidth -
        edgeMargin * 2 -
        lineMargin * 2,
      1
    );
  }

  function drawTapItem({ popped, fill }, index) {
    if (popped) {
      const preRenderImage = getGradientBitmap(fill);
      CTX.translate(iconRadius, 0);
      CTX.drawImage(preRenderImage, -iconRadius, 0, iconSize, iconSize);
    } else {
      const animationDelay = Math.min(index * 160, 960);
      const rippleProgress = clampedProgress(
        animationDelay,
        2800 + animationDelay,
        Date.now() - scoreDisplayStart
      );
      const outerCircleRadius = transition(
        iconRadius,
        iconRadius * 1.4,
        rippleProgress,
        easeOutQuad
      );
      const outerCircleFade = transition(1, 0, rippleProgress, easeOutQuad);
      const outerCircleLineWidth = transition(
        2,
        3,
        rippleProgress,
        easeOutQuad
      );
      const innerCircleRadius = transition(
        iconRadius / 2,
        iconRadius,
        rippleProgress,
        easeOutQuad
      );
      const innerCircleFade = transition(0.6, 1, rippleProgress, easeOutQuad);
      const innerCircleLineWidth = transition(
        1,
        2,
        rippleProgress,
        easeOutQuad
      );
      const hiddenCircleRadius = transition(
        0,
        iconRadius / 2,
        rippleProgress,
        easeOutQuad
      );

      CTX.strokeStyle = red;
      CTX.lineWidth = outerCircleLineWidth;
      CTX.globalAlpha = outerCircleFade;
      CTX.beginPath();
      CTX.arc(iconRadius, iconRadius, outerCircleRadius, 0, 2 * Math.PI);
      CTX.closePath();
      CTX.stroke();

      CTX.lineWidth = innerCircleLineWidth;
      CTX.globalAlpha = innerCircleFade;
      CTX.beginPath();
      CTX.arc(iconRadius, iconRadius, innerCircleRadius, 0, 2 * Math.PI);
      CTX.closePath();
      CTX.stroke();

      CTX.lineWidth = 1;
      CTX.globalAlpha = 0.6;
      CTX.beginPath();
      CTX.arc(iconRadius, iconRadius, hiddenCircleRadius, 0, 2 * Math.PI);
      CTX.closePath();
      CTX.stroke();
    }
  }

  function drawSlingshotItem({ popped, velocity }, index) {
    const animationDelay = Math.min(index * 88, 880);
    const textHeight = 17.2;
    const angleInRads = Math.atan2(velocity.y, velocity.x);
    const scaleIn = transition(
      0,
      1,
      clampedProgress(
        animationDelay,
        800 + animationDelay,
        Date.now() - scoreDisplayStart
      ),
      easeOutQuart
    );
    const rotateIn = transition(
      0,
      angleInRads,
      clampedProgress(
        animationDelay,
        880 + animationDelay,
        Date.now() - scoreDisplayStart
      ),
      easeOutBack
    );

    CTX.save();
    if (popped) {
      CTX.strokeStyle = red;
      CTX.fillStyle = red;
    } else {
      CTX.strokeStyle = "rgba(255, 255, 255, .3)";
      CTX.fillStyle = "rgba(255, 255, 255, .3)";
    }

    const arrowLength = 10;
    const arrowWidth = 6;
    const lineWidth = 5;

    CTX.translate(iconRadius, iconRadius);
    CTX.scale(scaleIn, scaleIn);
    CTX.rotate(rotateIn);
    CTX.beginPath();
    CTX.moveTo(-iconRadius, -lineWidth / 2);
    CTX.lineTo(iconRadius - arrowLength, -lineWidth / 2);
    CTX.lineTo(iconRadius - arrowLength, -lineWidth / 2 - arrowWidth);
    CTX.lineTo(iconRadius, 0);
    CTX.lineTo(iconRadius - arrowLength, lineWidth / 2 + arrowWidth);
    CTX.lineTo(iconRadius - arrowLength, lineWidth / 2);
    CTX.lineTo(-iconRadius, lineWidth / 2);
    CTX.closePath();
    CTX.fill();
    CTX.restore();

    applyTextStyle3(CTX);
    CTX.fillText(`x${popped}`, 30, iconRadius + textHeight / 2);
  }

  function drawBlastItem({ popped, power }, index) {
    const animationDelay = index * 88;
    const textHeight = 17.2;
    const blastIconNumVertices = 12;
    const blastIconRadius = transition(
      iconRadius / 3,
      iconRadius * 1.2,
      clampedProgress(0, BLAST_MAX_SIZE, power)
    );
    const blastIconJitter = transition(
      1,
      2.25,
      clampedProgress(0, BLAST_MAX_SIZE, power)
    );
    const scaleIn = transition(
      0,
      1,
      clampedProgress(
        animationDelay,
        800 + animationDelay,
        Date.now() - scoreDisplayStart
      ),
      easeOutQuad
    );

    const blastIconVertices = new Array(blastIconNumVertices)
      .fill()
      .map((_, index) => {
        const angle = (index / blastIconNumVertices) * Math.PI * 2;
        const distance = randomBetween(
          blastIconRadius - blastIconJitter,
          blastIconRadius + blastIconJitter
        );
        return {
          x: Math.cos(angle) * distance,
          y: Math.sin(angle) * distance,
        };
      });

    CTX.save();
    if (popped > 0) {
      CTX.fillStyle = red;
      CTX.strokeStyle = red;
    } else {
      CTX.fillStyle = "rgba(255, 255, 255, .3)";
      CTX.strokeStyle = "rgba(255, 255, 255, .5)";
    }
    CTX.globalAlpha = 0.2;
    CTX.translate(iconRadius, iconRadius);
    CTX.scale(scaleIn, scaleIn);
    CTX.beginPath();
    blastIconVertices.forEach(({ x, y }, index) => {
      index === 0 ? CTX.moveTo(x, y) : CTX.lineTo(x, y);
    });
    CTX.closePath();
    CTX.fill();
    CTX.globalAlpha = 1;
    CTX.stroke();
    CTX.restore();

    applyTextStyle3(CTX);
    CTX.fillText(`x${popped}`, 32, iconRadius + textHeight / 2);
  }

  const getCurrentHeight = () => scoreHeight;

  return { draw, update, getCurrentHeight };
};

function applyTextStyle1(CTX) {
  CTX.fillStyle = white;
  CTX.font = `${FONT_WEIGHT_BOLD} 14px ${FONT}`;
  CTX.textAlign = "left";
  CTX.letterSpacing = "1px";
}

function applyTextStyle2(CTX) {
  CTX.fillStyle = white;
  CTX.font = `${FONT_WEIGHT_NORMAL} 14px ${FONT}`;
  CTX.textAlign = "right";
  CTX.letterSpacing = "0px";
}

function applyTextStyle3(CTX) {
  CTX.fillStyle = white;
  CTX.font = `${FONT_WEIGHT_BOLD} 24px ${FONT}`;
  CTX.textAlign = "left";
  CTX.letterSpacing = "0px";
}
