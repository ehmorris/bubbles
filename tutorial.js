import { BUBBLE_RADIUS, FONT_WEIGHT_BOLD, FONT } from "./constants.js";
import { red, white, turquoise, yellow } from "./colors.js";
import { makeBall } from "./ball.js";
import { clampedProgress, transition } from "./helpers.js";
import { easeOutQuart } from "./easings.js";
import { makeTextBlock } from "./textBlock.js";

export const makeTutorialManager = (
  canvasManager,
  onTutorialStart,
  onAdvance,
  onCompletion
) => {
  const CTX = canvasManager.getContext();
  const tutorialData = getTutorialData(canvasManager);
  const successMessageDuration = 2000;
  let tutorialComplete = !!localStorage.getItem("bubblesTutorialComplete");
  let tutorialCompletedThisSession = false;
  let currentTutorialStep = 1;
  let stepStarted = Date.now();
  let holdingBlast = false;
  let holdingSlingshot = false;

  const textManager = makeTextBlock(
    canvasManager,
    {
      xPos: canvasManager.getWidth() / 2,
      yPos: canvasManager.getHeight() / 2 - canvasManager.getHeight() / 4,
      textAlign: "center",
      verticalAlign: "center",
    },
    [tutorialData[0].initialText]
  );

  const getCurrentStepData = () =>
    tutorialData.find(({ step }) => step === currentTutorialStep);

  const showTutorial = () => {
    stepStarted = Date.now();
    onTutorialStart();
  };

  const advance = () => {
    currentTutorialStep++;

    if (currentTutorialStep > tutorialData.length) {
      tutorialComplete = true;
      tutorialCompletedThisSession = true;
      localStorage.setItem("bubblesTutorialComplete", true);
      onCompletion();
    } else {
      textManager.updateYPos(getCurrentStepData().textYPos);
      textManager.updateLines([getCurrentStepData().initialText]);
      stepStarted = Date.now();
      onAdvance();
    }
  };

  const canMakeTap = () => currentTutorialStep === 1;

  const canMakeBlast = () => currentTutorialStep === 3;

  const canMakeSlingshot = () => currentTutorialStep === 5;

  const logTriggerOutput = (_) => {
    holdingSlingshot = false;
    holdingBlast = false;
  };

  const previewingBlast = (startPosition, pointerStart) => {
    // TODO get power and determine if it'll pop all bubbles
    textManager.updateLines([getCurrentStepData().confirmationText]);
    holdingBlast = true;
  };

  const previewingSlingshot = (startPosition, currentPosition) => {
    // TODO get angle and determine if it'll strike all bubbles
    textManager.updateLines([getCurrentStepData().confirmationText]);
    holdingSlingshot = true;
  };

  const generateBalls = (onPop, onMiss) =>
    getCurrentStepData().balls.map(({ position: { x, y }, fill }) =>
      makeBall(
        canvasManager,
        {
          startPosition: { x, y },
          startVelocity: { x: 0, y: 0 },
          radius: BUBBLE_RADIUS,
          fill,
          gravity: 0,
        },
        onPop,
        onMiss
      )
    );

  const drawTopLabel = () => {
    CTX.save();
    CTX.font = `${FONT_WEIGHT_BOLD} 14px ${FONT}`;
    CTX.fillStyle = yellow;
    CTX.letterSpacing = "1px";
    CTX.textAlign = "center";
    CTX.translate(canvasManager.getWidth() / 2, 24);
    CTX.fillText("TUTORIAL", 0, 0);
    CTX.restore();
  };

  const drawDownwardsArrow = () => {
    const endPointTransition = transition(
      textManager.getYPos() + 32,
      canvasManager.getHeight() / 2 - BUBBLE_RADIUS - 28,
      clampedProgress(0, 1600, Date.now() - stepStarted),
      easeOutQuart
    );
    CTX.save();
    CTX.beginPath();
    CTX.moveTo(0, textManager.getYPos() + 32);
    CTX.lineTo(0, endPointTransition);
    CTX.lineTo(8, endPointTransition);
    CTX.lineTo(0, endPointTransition + 12);
    CTX.lineTo(-8, endPointTransition);
    CTX.lineTo(0, endPointTransition);
    CTX.closePath();
    CTX.stroke();
    CTX.restore();
  };

  const drawUpwardsArrow = () => {
    const endPointTransition = transition(
      textManager.getYPos() - 16,
      canvasManager.getHeight() / 2 + BUBBLE_RADIUS + 28,
      clampedProgress(0, 1600, Date.now() - stepStarted),
      easeOutQuart
    );

    CTX.save();
    CTX.beginPath();
    CTX.moveTo(0, textManager.getYPos() - 16);
    CTX.lineTo(0, endPointTransition);
    CTX.lineTo(8, endPointTransition);
    CTX.lineTo(0, endPointTransition - 12);
    CTX.lineTo(-8, endPointTransition);
    CTX.lineTo(0, endPointTransition);
    CTX.closePath();
    CTX.stroke();
    CTX.restore();
  };

  const drawThumbPlaceholder = () => {
    CTX.fillStyle = "rgba(0, 0, 0, .6)";
    CTX.beginPath();
    CTX.arc(0, canvasManager.getHeight() / 2, BUBBLE_RADIUS, 0, Math.PI * 2);
    CTX.closePath();
    CTX.fill();
  };

  const draw = () => {
    drawTopLabel();

    textManager.draw();

    CTX.save();
    CTX.translate(canvasManager.getWidth() / 2, 0);
    CTX.fillStyle = white;
    CTX.strokeStyle = white;
    CTX.lineWidth = 2;

    if (currentTutorialStep === 1) {
      drawDownwardsArrow();
    } else if (
      currentTutorialStep === 2 &&
      Date.now() - stepStarted > successMessageDuration
    ) {
      advance();
    } else if (currentTutorialStep === 3) {
      drawDownwardsArrow();
      drawThumbPlaceholder();
    } else if (
      currentTutorialStep === 4 &&
      Date.now() - stepStarted > successMessageDuration
    ) {
      advance();
    } else if (currentTutorialStep === 5) {
      if (!holdingSlingshot) drawUpwardsArrow();
      drawThumbPlaceholder();
    }
    CTX.restore();
  };

  return {
    isTutorialComplete: () => tutorialComplete,
    isTutorialCompletedThisSession: () => tutorialCompletedThisSession,
    showTutorial,
    advance,
    canMakeTap,
    canMakeBlast,
    canMakeSlingshot,
    logTriggerOutput,
    previewingBlast,
    previewingSlingshot,
    generateBalls,
    draw,
  };
};

function getTutorialData(canvasManager) {
  return [
    {
      step: 1,
      initialText: "Pop this",
      textYPos: canvasManager.getHeight() / 2 - canvasManager.getHeight() / 4,
      balls: [
        {
          position: {
            x: canvasManager.getWidth() / 2,
            y: canvasManager.getHeight() / 2,
          },
          fill: red,
        },
      ],
    },
    {
      step: 2,
      initialText: "Nice!",
      textYPos: canvasManager.getHeight() / 2,
      balls: [],
    },
    {
      step: 3,
      initialText: "Hold down",
      confirmationText: "Now let go!",
      textYPos: canvasManager.getHeight() / 2 - canvasManager.getHeight() / 4,
      balls: [
        {
          position: {
            x: canvasManager.getWidth() / 2 - BUBBLE_RADIUS * 2,
            y: canvasManager.getHeight() / 2 - BUBBLE_RADIUS * 2,
          },
          fill: yellow,
        },
        {
          position: {
            x: canvasManager.getWidth() / 2 + BUBBLE_RADIUS * 2.5,
            y: canvasManager.getHeight() / 2 - BUBBLE_RADIUS * 1.2,
          },
          fill: turquoise,
        },
        {
          position: {
            x: canvasManager.getWidth() / 2 - BUBBLE_RADIUS * 2.5,
            y: canvasManager.getHeight() / 2 + BUBBLE_RADIUS * 2,
          },
          fill: red,
        },
        {
          position: {
            x: canvasManager.getWidth() / 2 + BUBBLE_RADIUS * 1.5,
            y: canvasManager.getHeight() / 2 + BUBBLE_RADIUS * 3,
          },
          fill: white,
        },
      ],
    },
    {
      step: 4,
      initialText: "Awesome",
      textYPos: canvasManager.getHeight() / 2,
      balls: [],
    },
    {
      step: 5,
      initialText: "Drag down",
      confirmationText: "Let go!",
      textYPos: canvasManager.getHeight() / 2 + canvasManager.getHeight() / 4,
      balls: [
        {
          position: {
            x: canvasManager.getWidth() / 2,
            y: BUBBLE_RADIUS * 4 + 16,
          },
          fill: yellow,
        },
        {
          position: {
            x: canvasManager.getWidth() / 2,
            y: BUBBLE_RADIUS * 2 + 8,
          },
          fill: red,
        },
        {
          position: {
            x: canvasManager.getWidth() / 2,
            y: 0,
          },
          fill: turquoise,
        },
      ],
    },
  ];
}
