import { FONT, FONT_WEIGHT_NORMAL } from "./constants.js";
import { white } from "./colors.js";
import { clampedProgress, transition } from "./helpers.js";
import { easeOutExpo } from "./easings.js";
import { makeSpring } from "./spring.js";

export const makeTextBlock = (
  canvasManager,
  {
    xPos,
    yPos: initialYPos,
    textAlign,
    verticalAlign = "top",
    fontSize = 24,
    fontWeight = FONT_WEIGHT_NORMAL,
    lineHeight = 32,
    letterSpacing = "0px",
    fill = white,
  },
  initialLinesArray
) => {
  const CTX = canvasManager.getContext();
  let textStart = Date.now();
  let linesArray = [...initialLinesArray];
  let verticalOffset =
    verticalAlign === "center" ? (linesArray.length / 2) * lineHeight : 0;
  let yPos = initialYPos;

  const positionSpring = makeSpring(lineHeight, {
    stiffness: 120,
    damping: 13,
    mass: 1,
    precision: 120,
  });
  positionSpring.setEndValue(0);

  const updateLines = (newLines) => {
    textStart = Date.now();
    positionSpring.resetValue();
    positionSpring.setEndValue(0);

    linesArray = [...newLines];
    verticalOffset =
      verticalAlign === "center" ? (linesArray.length / 2) * lineHeight : 0;
  };

  const updateYPos = (newYPos) => (yPos = newYPos);

  const hide = () => positionSpring.setEndValue(-lineHeight);

  const getBoundingBox = () => {
    const leading = lineHeight - fontSize;

    return {
      top: yPos - verticalOffset + leading,
      bottom: yPos - verticalOffset + leading + lineHeight * linesArray.length,
    };
  };

  const draw = (deltaTime, delay = 0) => {
    if (Date.now() - textStart > delay) {
      positionSpring.update(deltaTime);

      CTX.save();
      CTX.font = `${fontWeight} ${fontSize}px ${FONT}`;
      CTX.fillStyle = fill;
      CTX.textAlign = textAlign;
      CTX.letterSpacing = letterSpacing;
      CTX.translate(xPos, yPos - verticalOffset);
      linesArray.forEach((line, index) => {
        const lineYPos = (index + 1) * lineHeight;

        CTX.save();

        // Draw clipping mask
        CTX.beginPath();
        CTX.rect(
          -xPos,
          lineYPos - fontSize,
          canvasManager.getWidth(),
          lineHeight
        );
        CTX.clip();

        // Move text up into non clipped area
        CTX.fillText(line, 0, lineYPos + positionSpring.getCurrentValue());
        CTX.restore();
      });
      CTX.restore();
    }
  };

  return {
    draw,
    getHeight: () => linesArray.length * lineHeight,
    getBoundingBox,
    getLines: () => linesArray,
    updateLines,
    updateYPos,
    hide,
  };
};
