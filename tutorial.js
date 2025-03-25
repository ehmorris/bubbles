import { BUBBLE_RADIUS, FONT_WEIGHT_BOLD, FONT } from "./constants.js";
import { red, white, turquoise, yellow } from "./colors.js";
import { makeBall } from "./ball.js";
import { clampedProgress, transition } from "./helpers.js";
import { easeOutExpo } from "./easings.js";
import { makeTextBlock } from "./textBlock.js";

export const makeTutorialManager = (
  canvasManager,
  onTutorialStart,
  onAdvance,
  onCompletion
) => {
  const CTX = canvasManager.getContext();
  let tutorialComplete = !!localStorage.getItem("bubblesTutorialComplete");
  let tutorialCompletedThisSession = false;
  let currentTutorialStepIndex = 0;
  let stepStarted = Date.now();

  const textManager = makeTextBlock(
    canvasManager,
    {
      xPos: canvasManager.getWidth() / 2,
      yPos: canvasManager.getHeight() / 2 - canvasManager.getHeight() / 4,
      textAlign: "center",
      verticalAlign: "center",
    },
    []
  );
  const tutorialData = makeTutorialData(
    canvasManager,
    textManager,
    stepStarted
  );
  textManager.updateLines(tutorialData[0].initialText);

  const showTutorial = () => {
    stepStarted = Date.now();
    onTutorialStart();
  };

  const advance = () => {
    if (currentTutorialStepIndex + 1 === tutorialData.length) {
      tutorialComplete = true;
      tutorialCompletedThisSession = true;
      localStorage.setItem("bubblesTutorialComplete", true);
      onCompletion();
    } else {
      currentTutorialStepIndex++;
      textManager.updateYPos(tutorialData[currentTutorialStepIndex].textYPos);
      textManager.updateLines(
        tutorialData[currentTutorialStepIndex].initialText
      );
      stepStarted = Date.now();
      onAdvance();
    }
  };

  const confirm = () => {
    if (
      "confirmationText" in tutorialData[currentTutorialStepIndex] &&
      textManager.getLines()[0] !==
        tutorialData[currentTutorialStepIndex].confirmationText[0]
    ) {
      textManager.updateLines(
        tutorialData[currentTutorialStepIndex].confirmationText
      );
    }
  };

  const canMakeTap = () =>
    tutorialData[currentTutorialStepIndex].allowedGestures.includes("tap");

  const canMakeBlast = () =>
    tutorialData[currentTutorialStepIndex].allowedGestures.includes("blast");

  const canMakeSlingshot = () =>
    tutorialData[currentTutorialStepIndex].allowedGestures.includes(
      "slingshot"
    );

  const previewingBlast = () => confirm();

  const previewingSlingshot = () => confirm();

  const generateBalls = (onPop, onMiss) =>
    tutorialData[currentTutorialStepIndex].balls.map(
      ({ position: { x, y }, fill }) =>
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

  const draw = (deltaTime) => {
    if (
      "timeout" in tutorialData[currentTutorialStepIndex] &&
      Date.now() - stepStarted > tutorialData[currentTutorialStepIndex].timeout
    ) {
      advance();
    }

    // Top label
    CTX.save();
    CTX.font = `${FONT_WEIGHT_BOLD} 14px ${FONT}`;
    CTX.fillStyle = yellow;
    CTX.letterSpacing = "1px";
    CTX.textAlign = "center";
    CTX.translate(canvasManager.getWidth() / 2, 24);
    CTX.fillText("TUTORIAL", 0, 0);
    CTX.restore();

    // Tutorial step text and arrows
    // Ball data is passed via generateBalls() into index and drawn there
    textManager.draw(deltaTime);
    if ("draw" in tutorialData[currentTutorialStepIndex]) {
      tutorialData[currentTutorialStepIndex].draw();
    }
  };

  return {
    isTutorialComplete: () => tutorialComplete,
    isTutorialCompletedThisSession: () => tutorialCompletedThisSession,
    showTutorial,
    advance,
    canMakeTap,
    canMakeBlast,
    canMakeSlingshot,
    previewingBlast,
    previewingSlingshot,
    generateBalls,
    draw,
  };
};

function makeTutorialData(canvasManager, textManager, stepStarted) {
  return [
    {
      initialText: ["Pop this"],
      textYPos: canvasManager.getHeight() / 2 - canvasManager.getHeight() / 4,
      draw: () => {
        drawCenteredDownwardsArrow(
          canvasManager,
          textManager.getBoundingBox().bottom + 12,
          canvasManager.getHeight() / 2 - BUBBLE_RADIUS - 32,
          stepStarted,
          white
        );
      },
      balls: [
        {
          position: {
            x: canvasManager.getWidth() / 2,
            y: canvasManager.getHeight() / 2,
          },
          fill: red,
        },
      ],
      allowedGestures: ["tap"],
    },
    {
      timeout: 1800,
      initialText: ["Nice! But…"],
      textYPos: canvasManager.getHeight() / 2 - 8,
      balls: [],
      allowedGestures: [],
    },
    {
      timeout: 2300,
      initialText: ["What if there are more?"],
      textYPos: canvasManager.getHeight() / 2 - 8,
      balls: [],
      allowedGestures: [],
    },
    {
      initialText: ["Hold down in", "the center"],
      confirmationText: ["Now let go!"],
      textYPos: canvasManager.getHeight() / 2 - canvasManager.getHeight() / 3,
      draw: () => {
        drawCenteredDownwardsArrow(
          canvasManager,
          textManager.getBoundingBox().bottom + 12,
          canvasManager.getHeight() / 2,
          stepStarted,
          white
        );
      },
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
      allowedGestures: ["blast"],
    },
    {
      timeout: 1100,
      initialText: ["Boom!"],
      textYPos: canvasManager.getHeight() / 2 - 8,
      balls: [],
      allowedGestures: [],
    },
    {
      timeout: 2000,
      initialText: ["That’s called a “blast”"],
      textYPos: canvasManager.getHeight() / 2 - 8,
      balls: [],
      allowedGestures: [],
    },
    {
      timeout: 1900,
      initialText: ["One last thing…"],
      textYPos: canvasManager.getHeight() / 2 - 8,
      balls: [],
      allowedGestures: [],
    },
    {
      initialText: ["Drag down", "", "Start right here"],
      confirmationText: ["Let go!"],
      textYPos: canvasManager.getHeight() / 2,
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
      allowedGestures: ["slingshot"],
    },
    {
      timeout: 2600,
      initialText: ["Those are all the", "ways to pop bubbles"],
      textYPos: canvasManager.getHeight() / 2 - 8,
      balls: [],
      allowedGestures: [],
    },
    {
      timeout: 1800,
      initialText: ["You’re ready to play"],
      textYPos: canvasManager.getHeight() / 2 - 8,
      balls: [],
      allowedGestures: [],
    },
  ];
}

function drawCenteredDownwardsArrow(
  canvasManager,
  startY,
  endY,
  animationStart,
  fill
) {
  const CTX = canvasManager.getContext();
  const oscillatingEndY =
    endY + Math.sin((Date.now() - animationStart) / 400) * 6;
  const endYTransition = transition(
    startY,
    oscillatingEndY,
    clampedProgress(0, 928, Date.now() - animationStart),
    easeOutExpo
  );

  CTX.save();
  CTX.strokeStyle = fill;
  CTX.fillStyle = fill;
  CTX.lineWidth = 2;
  CTX.translate(canvasManager.getWidth() / 2, 0);
  CTX.beginPath();
  CTX.moveTo(0, startY);
  CTX.lineTo(0, endYTransition);
  CTX.lineTo(8, endYTransition);
  CTX.lineTo(0, endYTransition + 12);
  CTX.lineTo(-8, endYTransition);
  CTX.lineTo(0, endYTransition);
  CTX.closePath();
  CTX.stroke();
  CTX.fill();
  CTX.restore();
}
