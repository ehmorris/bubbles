// Colors

import { BUBBLE_RADIUS } from "./constants.js";
import { makeOffscreenCanvas } from "./canvas.js";

export const pink = "#EA98AA";
export const red = "#DF432A";
export const yellow = "#F4BF2A";
export const turquoise = "#79CAEC";
export const white = "#FCF6E8";

export const medblue = "#4555A5";
export const green = "#92C262";
export const purple = "#B565A9";
export const orange = "#F38121";
export const teal = "#51BFA4";

export const background = "#2D2D74";

// Gradients

const makeGradient = (
  canvasManager,
  radius,
  centerColor,
  middleColor,
  outerColor
) => {
  const CTX = canvasManager.getContext();
  const gradient = CTX.createRadialGradient(
    -Math.round(radius / 4),
    -Math.round(radius / 4),
    radius / 8,
    0,
    0,
    radius
  );
  gradient.addColorStop(0, centerColor);
  gradient.addColorStop(0.5, middleColor);
  gradient.addColorStop(1, outerColor);

  return gradient;
};

const pinkGradient = (canvasManager, radius) =>
  makeGradient(canvasManager, radius, "#FFB7C7", pink, "#E2627E");
const redGradient = (canvasManager, radius) =>
  makeGradient(canvasManager, radius, "#E44D35", red, "#AE250F");
const yellowGradient = (canvasManager, radius) =>
  makeGradient(canvasManager, radius, "#FFCF49", yellow, "#C39513");
const turquoiseGradient = (canvasManager, radius) =>
  makeGradient(canvasManager, radius, "#98E0FE", turquoise, "#51B3DC");
const whiteGradient = (canvasManager, radius) =>
  makeGradient(canvasManager, radius, "#FFFFFF", white, "#E4D9C1");

// Rendered Bitmaps

const makeBitmap = (gradientFunc) => {
  const bubbleRadius2x = BUBBLE_RADIUS * 2;
  const preRenderCanvas = makeOffscreenCanvas({
    width: bubbleRadius2x * 2,
    height: bubbleRadius2x * 2,
  });
  const preRenderContext = preRenderCanvas.getContext();
  preRenderContext.fillStyle = gradientFunc(preRenderCanvas, bubbleRadius2x);
  preRenderContext.beginPath();
  preRenderContext.translate(bubbleRadius2x, bubbleRadius2x);
  preRenderContext.arc(0, 0, bubbleRadius2x, 0, 2 * Math.PI);
  preRenderContext.closePath();
  preRenderContext.fill();

  const strokeGradient = preRenderContext.createLinearGradient(
    bubbleRadius2x * 4,
    bubbleRadius2x * 4,
    -bubbleRadius2x,
    -bubbleRadius2x
  );
  strokeGradient.addColorStop(0, "rgba(255, 255, 255, .4)");
  strokeGradient.addColorStop(1, "rgba(255, 255, 255, 0)");

  preRenderContext.strokeStyle = strokeGradient;
  preRenderContext.lineWidth = 2;
  preRenderContext.beginPath();
  preRenderContext.arc(0, 0, bubbleRadius2x - 2, 0, 2 * Math.PI);
  preRenderContext.closePath();
  preRenderContext.stroke();

  return preRenderCanvas.getBitmap();
};

const pinkGradientBitmap = makeBitmap(pinkGradient);
const redGradientBitmap = makeBitmap(redGradient);
const yellowGradientBitmap = makeBitmap(yellowGradient);
const turquoiseGradientBitmap = makeBitmap(turquoiseGradient);
const whiteGradientBitmap = makeBitmap(whiteGradient);

const gradientBitmaps = [
  { sourceColor: pink, bitmap: pinkGradientBitmap },
  { sourceColor: red, bitmap: redGradientBitmap },
  { sourceColor: yellow, bitmap: yellowGradientBitmap },
  { sourceColor: turquoise, bitmap: turquoiseGradientBitmap },
  { sourceColor: white, bitmap: whiteGradientBitmap },
];

// Functions

export const randomColor = () => {
  const colors = [pink, red, yellow, turquoise, white];
  return colors[Math.floor(Math.random() * colors.length)];
};

export const getGradientBitmap = (sourceColor) => {
  const gradient = gradientBitmaps.find((g) => g.sourceColor === sourceColor);

  return gradient ? gradient.bitmap : whiteGradientBitmap;
};
