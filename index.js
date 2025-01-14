import { makeCanvasManager } from "./canvas.js";
import { BLAST_MAX_DURATION, FONT, FONT_WEIGHT_NORMAL } from "./constants.js";
import {
  animate,
  clampedProgress,
  findBallAtPoint,
  randomBetween,
  transition,
  getBoundedPosition,
} from "./helpers.js";
import {
  checkParticleCollision,
  adjustParticlePositions,
  resolveParticleCollision,
} from "./particle.js";
import { makeRipple } from "./ripple.js";
import { makeAudioManager } from "./audio.js";
import { makeLifeManager } from "./lives.js";
import { makeLevelManager } from "./level.js";
import { makeContinueButtonManager } from "./continueButton.js";
import { makeActivePointer } from "./activePointer.js";
import { centerTextBlock } from "./centerTextBlock.js";
import { drawScore } from "./score.js";
import { levels, makeLevelBalls } from "./levelData.js";
import { red } from "./colors.js";
import { makeScoreStore } from "./scoreStore.js";
import { easeOutBack } from "./easings.js";

const URLParams = new URLSearchParams(window.location.search);
const previewData = JSON.parse(decodeURIComponent(URLParams.get("level")));
const previewDataPresent = !!window.location.search && previewData;

if (previewDataPresent) {
  const previewTitle = `Bubbles! - “${previewData.name}”`;
  const previewDesc = "Click to play this custom level preview";
  document.title = previewTitle;
  document
    .querySelector('meta[property="og:title"]')
    .setAttribute("content", previewTitle);
  document
    .querySelector('meta[name="description"]')
    .setAttribute("content", previewDesc);
  document
    .querySelector('meta[property="og:description"]')
    .setAttribute("content", previewDesc);
}

const canvasManager = makeCanvasManager({
  initialWidth: window.innerWidth,
  initialHeight: window.innerHeight,
  maxWidth: 800,
  attachNode: "#canvas",
});
const audioManager = makeAudioManager();
const lifeManager = makeLifeManager(canvasManager);
const levelManager = makeLevelManager(
  canvasManager,
  onInterstitial,
  previewDataPresent ? onPreviewAdvance : onLevelAdvance,
  previewDataPresent
);
const scoreStore = makeScoreStore(levelManager);
const continueButtonManager = makeContinueButtonManager(canvasManager);
const CTX = canvasManager.getContext();

// These are all reset on game restart
let activePointers;
let pointerTriggerOutput;
let pointerPosition;
let balls;
let ripples;

function resetGame() {
  activePointers = [];
  pointerTriggerOutput = [];
  pointerPosition = null;
  balls = [];
  ripples = [];
  lifeManager.reset();
  levelManager.reset();
  levelManager.showLevelInterstitial();
  audioManager.resetPluckSequence();
  scoreStore.reset();
}
resetGame();

function resetLevelData() {
  audioManager.resetPluckSequence();
}

function resetOngoingVisuals() {
  activePointers = [];
  pointerTriggerOutput = pointerTriggerOutput.filter((b) => !b.isGone());
  ripples = [];
}

canvasManager.getElement().addEventListener("pointerdown", (e) => {
  const { pointerId, offsetX: x, offsetY: y } = e;

  if (levelManager.isInterstitialShowing()) {
    continueButtonManager.handleClick(
      { x, y },
      levelManager.isGameOver() || levelManager.isLastLevel()
        ? resetGame
        : levelManager.dismissInterstitialAndAdvanceLevel
    );
  } else {
    activePointers.push(
      makeActivePointer(
        canvasManager,
        audioManager,
        scoreStore,
        pointerId,
        { x, y },
        onPointerTrigger
      )
    );
    handleGameClick({ x, y });
  }

  e.preventDefault();
});

canvasManager.getElement().addEventListener("pointerup", (e) => {
  const { pointerId, offsetX: x, offsetY: y } = e;

  activePointers.forEach((pointer, pointerIndex) => {
    if (pointerId === pointer.getId()) {
      pointer.setPosition({ x, y });
      activePointers.splice(pointerIndex, 1);
      if (!levelManager.isInterstitialShowing()) pointer.trigger();
    }
  });

  e.preventDefault();
});

canvasManager.getElement().addEventListener("pointermove", (e) => {
  const { pointerId, offsetX: x, offsetY: y } = e;

  pointerPosition = { x, y };

  activePointers.forEach((pointer) => {
    if (pointerId === pointer.getId()) pointer.setPosition({ x, y });
  });

  if (levelManager.isInterstitialShowing())
    continueButtonManager.handleHover({ x, y });

  e.preventDefault();
});

document.addEventListener("keydown", ({ key }) => {
  const validKey = key === " " || key === "Enter";

  if (validKey && levelManager.isGameOver()) {
    resetGame();
  } else if (validKey && levelManager.isInterstitialShowing()) {
    levelManager.dismissInterstitialAndAdvanceLevel();
  }
});

// Scale or translate the entire game
const cameraWrapper = (drawFunc) => {
  const cameraShake = (magnitudeProgress) => {
    const rotationAmount = transition(0, Math.PI / 90, magnitudeProgress);
    const shakeAmount = transition(0, 4, magnitudeProgress);

    // Translate to center and rotate randomly
    CTX.translate(canvasManager.getWidth() / 2, canvasManager.getHeight() / 2);
    CTX.rotate(randomBetween(-rotationAmount, rotationAmount));

    // Translate back to top left to reset w/o calling restore()
    CTX.translate(
      -canvasManager.getWidth() / 2,
      -canvasManager.getHeight() / 2
    );

    // Move canvas randomly
    CTX.translate(
      randomBetween(-shakeAmount, shakeAmount),
      randomBetween(-shakeAmount, shakeAmount)
    );
  };

  if (
    pointerTriggerOutput.filter((o) => !o.isGone() && o.causesShake()).length
  ) {
    CTX.save();
    cameraShake(0.5);
    drawFunc();
    CTX.restore();
  } else {
    drawFunc();
  }
};

animate((deltaTime) => {
  CTX.clearRect(0, 0, canvasManager.getWidth(), canvasManager.getHeight());

  cameraWrapper(() => {
    // Trigger holdBlasts that have been held down past the max time
    if (!levelManager.isInterstitialShowing()) {
      activePointers.forEach((p, pointerIndex) => {
        if (p.isHoldBlast() && p.getDuration() >= BLAST_MAX_DURATION) {
          activePointers.splice(pointerIndex, 1);
          p.trigger();
        }
      });
    }

    // Run collision detection on bubbles and bounce bubbles off eachother
    // Run collision detection on blasts + slingshots and pop colliding bubbles
    const ballsInPlay = balls.filter(
      (b) => b.isRemaining() && b.shouldRender()
    );
    ballsInPlay.forEach((ballA) => {
      ballsInPlay.forEach((ballB) => {
        if (ballA !== ballB) {
          const collision = checkParticleCollision(ballA, ballB);
          if (collision[0]) {
            adjustParticlePositions(ballA, ballB, collision[1]);
            resolveParticleCollision(ballA, ballB);
          }
        }
      });
      pointerTriggerOutput
        .filter((p) => !p.isGone())
        .forEach((output) => {
          const collision = checkParticleCollision(ballA, output);
          if (collision[0]) {
            output.isHoldBlast()
              ? ballA.pop(output.getRelativeVelocity(ballA.getPosition()))
              : ballA.pop(output.getVelocity());

            output.logCollision();

            audioManager.playSequentialPluck();
          }
        });
    });

    // Draw level + life text underneath balls
    levelManager.drawLevelNumber();

    if (!levelManager.isGameOver()) lifeManager.draw();

    // Draw main game elements
    ripples.forEach((r) => r.draw());
    pointerTriggerOutput.forEach((b) => b.draw(deltaTime));
    balls.forEach((b) => b.draw(deltaTime));
    activePointers.forEach((p) => p.draw());

    // Draw combo messages
    if (!levelManager.isInterstitialShowing()) {
      scoreStore.recentCombos(levelManager.getLevel()).forEach((c) => {
        const boundedPosition = getBoundedPosition(
          canvasManager,
          c.position,
          100
        );
        const timeElapsed = Date.now() - c.timestamp;
        const fadeInProgress = clampedProgress(0, 400, timeElapsed);
        const scaleInProgress = clampedProgress(0, 800, timeElapsed);
        const rotateProgress = clampedProgress(0, 1600, timeElapsed);
        const rotateIn = transition(
          -Math.PI / 24,
          Math.PI / 80,
          rotateProgress,
          easeOutBack
        );
        const scaleIn = transition(0, 1, scaleInProgress, easeOutBack);
        const fadeIn = transition(0, 1, fadeInProgress, easeOutBack);

        CTX.save();
        CTX.globalAlpha = fadeIn;
        CTX.translate(boundedPosition.x, boundedPosition.y);
        CTX.rotate(rotateIn);
        CTX.scale(scaleIn, scaleIn);
        CTX.font = `${FONT_WEIGHT_NORMAL} 40px ${FONT}`;

        // Shadow
        CTX.fillStyle = "#000";
        CTX.textAlign = "center";
        CTX.fillText(`Popped ${c.popped}!`, 0, 0);

        // Text
        CTX.translate(-2, -3);
        CTX.fillStyle = "#fff";
        CTX.fillText(`Popped ${c.popped}!`, 0, 0);

        CTX.restore();
      });
    }

    levelManager.drawInterstitialMessage({
      previewInitialMessage: (msElapsed) => {
        centerTextBlock(canvasManager, [`Preview of “${previewData.name}”`]);
        continueButtonManager.draw(msElapsed, 0, "Play Preview");
      },
      initialMessage: (msElapsed) => {
        centerTextBlock(canvasManager, [`Pop the bubble`]);
        continueButtonManager.draw(msElapsed, 0, "Play");
      },
      firstMissMessage: (msElapsed) => {
        centerTextBlock(canvasManager, [`Miss a bubble, lose a life`]);
        continueButtonManager.draw(msElapsed, 1000);
      },
      defaultMessage: (msElapsed) => {
        drawScore(
          canvasManager,
          scoreStore.sumCurrentLevel("taps").num,
          scoreStore.sumCurrentLevel("taps").numPopped,
          scoreStore.sumCurrentLevel("missedBubbles").num,
          msElapsed
        );
        continueButtonManager.draw(msElapsed, 2000);
      },
      endGameMessage: (msElapsed) => {
        drawScore(
          canvasManager,
          scoreStore.sumAll("taps").num,
          scoreStore.sumAll("taps").numPopped,
          scoreStore.sumAll("missedBubbles").num,
          msElapsed,
          "Game over"
        );
        continueButtonManager.draw(msElapsed, 2000, "Try Again");
      },
      reachedEndOfGameMessage: (msElapsed) => {
        drawScore(
          canvasManager,
          scoreStore.sumAll("taps").num,
          scoreStore.sumAll("taps").numPopped,
          scoreStore.sumAll("missedBubbles").num,
          msElapsed,
          "You beat all levels!"
        );
        continueButtonManager.draw(msElapsed, 2000, "Play Again");
      },
    });
  });
});

function handleGameClick({ x, y }) {
  const collidingBall = findBallAtPoint(balls, { x, y });

  if (collidingBall) {
    scoreStore.recordTap({ x, y }, 1);
    collidingBall.pop();
    audioManager.playSequentialPluck();
  } else {
    scoreStore.recordTap({ x, y }, 0);
    ripples.push(makeRipple(canvasManager, { x, y }));
    audioManager.playMiss();
  }
}

function onPointerTrigger(output) {
  pointerTriggerOutput.push(output);
}

function onPop() {
  if (balls.filter((b) => b.isRemaining()) <= 0) {
    levelManager.showLevelInterstitial();
  }
}

function onMiss() {
  if (!levelManager.isGameOver()) {
    scoreStore.recordMiss();
    lifeManager.subtract();
    audioManager.playRandomFireworks();
    levelManager.setFirstMiss();

    if (lifeManager.getLives() <= 0) {
      onGameEnd();
    } else if (balls.filter((b) => b.isRemaining()) <= 0) {
      levelManager.showLevelInterstitial();
    }
  }
}

function onGameEnd() {
  audioManager.playLose();
  levelManager.onGameOver();
}

function onInterstitial() {
  resetOngoingVisuals();
}

function onLevelAdvance() {
  resetLevelData();

  const levelData = levels[levelManager.getLevel() - 1];
  // Allow popping animation to finish playing for previous level balls
  balls = balls
    .filter((b) => b.isPopping())
    .concat(makeLevelBalls(canvasManager, levelData, onPop, onMiss));

  // Call on first interaction. Subsequent calls are ignored.
  audioManager.initialize();
  audioManager.playRandomLevel();
}

function onPreviewAdvance() {
  resetLevelData();

  // Allow popping animation to finish playing for previous level balls
  balls = balls
    .filter((b) => b.isPopping())
    .concat(makeLevelBalls(canvasManager, previewData, onPop, onMiss));

  // Call on first interaction. Subsequent calls are ignored.
  audioManager.initialize();
  audioManager.playRandomLevel();
}
