import { easeOutExpo, easeOutQuart } from "./easings.js";
import { clampedProgress, transition } from "./helpers.js";
import { FONT, FONT_WEIGHT_BOLD } from "./constants.js";
import { randomColor, background, purple, white } from "./colors.js";
import { makeSpring } from "./spring.js";

const edgeMargin = 26;
const spaceBetween = 16;
const borderRadius = 16;

export const makeInterstitialButtonManager = (canvasManager) => {
  const CTX = canvasManager.getContext();
  const shareButton = makeShareButton(canvasManager);
  const continueButton = makeContinueButton(canvasManager, shareButton);
  let isHoveringContinueButton;
  let isHoveringShareButton;
  let delayHasPassed;
  let showingShare = false;

  const pointInButton = ({ x, y }, buttonSize) => {
    CTX.save();
    buttonSize.transform();
    const pointInPath = CTX.isPointInPath(
      buttonSize.path,
      x * canvasManager.getScaleFactor(),
      y * canvasManager.getScaleFactor()
    );
    CTX.restore();

    return pointInPath;
  };

  const handleHover = (coordinates) => {
    const isContinueButtonHovered = pointInButton(
      coordinates,
      showingShare ? continueButton.sizes.partial : continueButton.sizes.default
    );

    const isShareButtonHovered =
      showingShare && pointInButton(coordinates, shareButton.sizes.default);

    if (isContinueButtonHovered !== isHoveringContinueButton) {
      continueButton.spring.setEndValue(isContinueButtonHovered ? 1 : 0);
      isHoveringContinueButton = isContinueButtonHovered;
    }

    if (isShareButtonHovered !== isHoveringShareButton) {
      shareButton.spring.setEndValue(isShareButtonHovered ? 1 : 0);
      isHoveringShareButton = isShareButtonHovered;
    }

    isContinueButtonHovered || isShareButtonHovered
      ? document.body.classList.add("buttonHover")
      : document.body.classList.remove("buttonHover");
  };

  const handleClick = (coordinates, onContinue, onShare) => {
    if (!delayHasPassed) return;

    const continueButtonSize = showingShare
      ? continueButton.sizes.partial
      : continueButton.sizes.default;

    if (pointInButton(coordinates, continueButtonSize)) {
      continueButton.spring.setEndValue(0);
      isHoveringContinueButton = false;
      document.body.classList.remove("buttonHover");
      onContinue();
    } else if (
      showingShare &&
      pointInButton(coordinates, shareButton.sizes.default)
    ) {
      shareButton.spring
        .setEndValue(-3)
        .then(() => shareButton.spring.setEndValue(0));
      isHoveringShareButton = false;
      document.body.classList.remove("buttonHover");
      onShare();
    }
  };

  const draw = (
    deltaTime,
    msElapsed,
    { delay = 0, text = "Continue", isSharable = false }
  ) => {
    continueButton.spring.update(deltaTime);
    shareButton.spring.update(deltaTime);
    delayHasPassed = msElapsed - delay > 0;
    showingShare = isSharable;

    const continueButtonSize = showingShare
      ? continueButton.sizes.partial
      : continueButton.sizes.default;

    const introProgress1 = clampedProgress(0, 800, msElapsed - delay);
    const introProgress2 = clampedProgress(0, 1200, msElapsed - delay);
    const fadeIn = transition(0, 1, introProgress1, easeOutQuart);
    const animateUp = transition(12, 0, introProgress1, easeOutQuart);
    const animateScaleX = transition(0.8, 1, introProgress1, easeOutExpo);
    const animateScaleY = transition(0.9, 1, introProgress1, easeOutExpo);
    const rotateIn = transition(Math.PI / 12, 0, introProgress2, easeOutQuart);
    const clipInRadius = transition(
      0,
      continueButtonSize.width / 2 + 24,
      introProgress2,
      easeOutQuart
    );

    const continueButtonSpring = continueButton.spring.getCurrentValue();
    const hoverShapeScale = transition(1, 1.03, continueButtonSpring);
    const hoverTextScale = transition(1, 1.08, continueButtonSpring);
    const hoverTextAngle = transition(0, -Math.PI / 120, continueButtonSpring);
    const hoverTextPosition = transition(0, -1, continueButtonSpring);

    // Draw stroke and fill
    CTX.save();
    continueButtonSize.transform();
    CTX.strokeStyle = continueButtonSize.fill;
    CTX.fillStyle = continueButtonSize.fill;
    CTX.lineWidth = 4;
    CTX.globalAlpha = fadeIn;
    CTX.translate(0, animateUp);
    CTX.rotate(rotateIn);
    CTX.scale(animateScaleX, animateScaleY);
    CTX.scale(hoverShapeScale, hoverShapeScale);
    CTX.stroke(continueButtonSize.path);
    // Draw fill as a circular wipe
    CTX.clip(continueButtonSize.path);
    CTX.beginPath();
    CTX.arc(0, 0, clipInRadius, 0, Math.PI * 2);
    CTX.fill();
    CTX.restore();

    // Draw text
    // Rotate text in addition to button
    CTX.save();
    continueButtonSize.transform();
    CTX.globalAlpha = fadeIn;
    CTX.rotate(rotateIn);
    CTX.rotate(hoverTextAngle);
    CTX.scale(hoverTextScale, hoverTextScale);
    CTX.translate(0, hoverTextPosition);
    CTX.font = `${FONT_WEIGHT_BOLD} 24px ${FONT}`;
    CTX.fillStyle = background;
    CTX.textAlign = "center";
    CTX.textBaseline = "middle";
    CTX.fillText(text, 0, 0);
    CTX.restore();

    if (showingShare) {
      const shareIntroProgress1 = clampedProgress(100, 900, msElapsed - delay);
      const shareIntroProgress2 = clampedProgress(100, 1300, msElapsed - delay);
      const shareFadeIn = transition(0, 1, shareIntroProgress1, easeOutQuart);
      const shareAnimateUp = transition(
        12,
        0,
        shareIntroProgress1,
        easeOutQuart
      );
      const shareAnimateScaleX = transition(
        0.8,
        1,
        shareIntroProgress1,
        easeOutExpo
      );
      const shareAnimateScaleY = transition(
        0.9,
        1,
        shareIntroProgress1,
        easeOutExpo
      );
      const shareRotateIn = transition(
        Math.PI / 12,
        0,
        shareIntroProgress2,
        easeOutQuart
      );
      const shareClipInRadius = transition(
        0,
        shareButton.sizes.default.width / 2 + 24,
        shareIntroProgress2,
        easeOutQuart
      );

      const shareHoverShapeScale = transition(
        1,
        1.03,
        shareButton.spring.getCurrentValue()
      );

      CTX.save();
      shareButton.sizes.default.transform();
      CTX.fillStyle = shareButton.sizes.default.fill;
      CTX.strokeStyle = shareButton.sizes.default.fill;
      CTX.lineWidth = 4;
      CTX.globalAlpha = shareFadeIn;
      CTX.translate(0, shareAnimateUp);
      CTX.rotate(shareRotateIn);
      CTX.scale(shareAnimateScaleX, shareAnimateScaleY);
      CTX.scale(shareHoverShapeScale, shareHoverShapeScale);
      CTX.stroke(shareButton.sizes.default.path);
      // Draw fill as a circular wipe
      CTX.clip(shareButton.sizes.default.path);
      CTX.beginPath();
      CTX.arc(0, 0, shareClipInRadius, 0, Math.PI * 2);
      CTX.fill();

      CTX.translate(-shareButton.icon.width / 2, -shareButton.icon.height / 2);
      CTX.fillStyle = white;
      CTX.fill(shareButton.icon.path);

      CTX.restore();
    }
  };

  return {
    draw,
    handleClick,
    handleHover,
    hasDelayPassed: () => !!delayHasPassed,
  };
};

function makeShareButton(canvasManager) {
  const CTX = canvasManager.getContext();
  const width = 72;
  const height = 72;
  const buttonPath = new Path2D();
  buttonPath.roundRect(-width / 2, -height / 2, width, height, borderRadius);
  const iconPath = new Path2D(
    "M15 16C15 16.5285 14.5424 17 14 17 13.4715 17 12.998 16.5285 12.998 16L12.9979 5.3666 13.0813 3.6978 12.4999 4.2958 11 5.9646C10.8331 6.1732 10.5365 6.2566 10.3001 6.2566 9.7855 6.2566 9.3999 5.895 9.3999 5.3944 9.3999 5.1302 9.5074 4.9216 9.7021 4.7408L13.2499 1.3338C13.5141 1.0695 13.7495 1 13.9999 1 14.2641 1 14.4995 1.0695 14.7499 1.3338L18.2999 4.7408C18.4807 4.9216 18.6 5.1302 18.6 5.3944 18.6 5.895 18.2145 6.2566 17.7 6.2566 17.4497 6.2566 17.1808 6.1732 17 5.9646L15.4999 4.2958 14.9199 3.6978 14.9999 5.3666 15 16ZM24.0006 21.5 24.0005 11.5C24.0005 9.1776 22.8324 8.0001 20.4543 8.0001L17.0005 8V10.0025L20.4266 10.0026C21.4139 10.0026 21.998 10.545 21.998 11.6018L21.9981 21.4C21.9981 22.4569 21.414 23 20.4267 23H7.5745C6.5733 23 6.0031 22.4569 6.0031 21.4L6.003 11.6018C6.003 10.545 6.5732 10.0026 7.5744 10.0026L11.0005 10.0025V8L7.5466 8.0001C5.1825 8.0001 4.0005 9.1637 4.0005 11.5L4.0006 21.5C4.0006 23.8363 5.1826 25 7.5467 25H20.4545C22.8325 25 24.0006 23.8363 24.0006 21.5Z"
  );

  return {
    sizes: {
      default: {
        transform: () =>
          CTX.translate(
            canvasManager.getWidth() - width / 2 - edgeMargin,
            canvasManager.getHeight() - edgeMargin - height / 2
          ),
        path: buttonPath,
        width,
        height,
        fill: purple,
      },
    },
    icon: {
      path: iconPath,
      width: 28,
      height: 28,
    },
    spring: makeSpring(0, {
      stiffness: 80,
      damping: 8,
      mass: 1,
      precision: 400,
    }),
  };
}

function makeContinueButton(canvasManager, shareButton) {
  const CTX = canvasManager.getContext();
  const fullWidth = canvasManager.getWidth() - edgeMargin * 2;
  const partialWidth =
    canvasManager.getWidth() -
    edgeMargin * 2 -
    shareButton.sizes.default.width -
    spaceBetween;
  const height = 72;

  // One color shared by both widths. Rolling separately meant the button
  // changed color the moment a share button appeared beside it.
  const fill = randomColor();
  const fullButtonPath = new Path2D();
  const partialButtonPath = new Path2D();
  fullButtonPath.roundRect(
    -fullWidth / 2,
    -height / 2,
    fullWidth,
    height,
    borderRadius
  );
  partialButtonPath.roundRect(
    -partialWidth / 2,
    -height / 2,
    partialWidth,
    height,
    borderRadius
  );

  return {
    sizes: {
      default: {
        transform: () =>
          CTX.translate(
            canvasManager.getWidth() / 2,
            canvasManager.getHeight() - edgeMargin - height / 2
          ),
        path: fullButtonPath,
        width: fullWidth,
        height,
        fill,
      },
      partial: {
        transform: () =>
          CTX.translate(
            edgeMargin + partialWidth / 2,
            canvasManager.getHeight() - edgeMargin - height / 2
          ),
        path: partialButtonPath,
        width: partialWidth,
        height,
        fill,
      },
    },
    spring: makeSpring(0, {
      stiffness: 80,
      damping: 8,
      mass: 1,
      precision: 400,
    }),
  };
}
