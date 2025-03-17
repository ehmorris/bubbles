import { makeCanvasManager } from "./canvas.js";
import { BLAST_MAX_DURATION, FONT, FONT_WEIGHT_BOLD } from "./constants.js";
import {
  animate,
  clampedProgress,
  findBallAtPoint,
  randomBetween,
  transition,
  getBoundedPosition,
} from "./helpers.js";
import { background } from "./colors.js";
import {
  checkParticleCollision,
  adjustParticlePositions,
  resolveParticleCollision,
} from "./particle.js";
import { makeRipple } from "./ripple.js";
import { makeAudioManager } from "./audio.js";
import { makeLifeManager } from "./lifeManager.js";
import { makeLevelManager } from "./level.js";
import { makeInterstitialButtonManager } from "./interstitialButton.js";
import { makeActivePointer } from "./activePointer.js";
import { makeTextBlock } from "./textBlock.js";
import { makeScoreDisplay } from "./scoreDisplay.js";
import { makeLevelBalls } from "./levelData.js";
import { makeScoreStore } from "./scoreStore.js";
import { makeTutorialManager } from "./tutorial.js";
import { makeFirework } from "./firework.js";
import { makeShareImageManager } from "./shareImage.js";

const URLParams = new URLSearchParams(window.location.search);
const previewData =
  URLParams.get("level") && JSON.parse(atob(URLParams.get("level")));
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
  previewData
);
const scoreStore = makeScoreStore(levelManager);
const scoreDisplay = makeScoreDisplay(canvasManager, scoreStore, levelManager);
const interstitialButtonManager = makeInterstitialButtonManager(canvasManager);
const tutorialManager = makeTutorialManager(
  canvasManager,
  onTutorialStart,
  onTutorialAdvance,
  onTutorialComplete
);
const shareImageManager = makeShareImageManager(scoreStore, levelManager);
const CTX = canvasManager.getContext();

levelManager.setScoreStore(scoreStore);

// These are all reset on game restart
let activePointers;
let pointerTriggerOutput;
let previousLevelBalls;
let balls;
let ripples;
let fireworks;

function resetGame() {
  activePointers = [];
  pointerTriggerOutput = [];
  previousLevelBalls = [];
  balls = [];
  ripples = [];
  fireworks = [];
  lifeManager.reset();
  levelManager.reset();
  tutorialManager.isTutorialComplete()
    ? levelManager.showLevelInterstitial()
    : tutorialManager.showTutorial();
  audioManager.resetPluckSequence();
  scoreStore.reset();
}
resetGame();

function resetLevelData() {
  fireworks = [];
  audioManager.resetPluckSequence();
}

function resetPreviewData() {
  audioManager.resetPluckSequence();
  lifeManager.reset();
  scoreStore.reset();
}

function resetOngoingVisuals() {
  activePointers = [];
  pointerTriggerOutput = pointerTriggerOutput.filter((b) => !b.isGone());
  ripples = [];
}

canvasManager.getElement().addEventListener("pointerdown", (e) => {
  const { pointerId, offsetX: x, offsetY: y } = e;

  if (levelManager.isInterstitialShowing()) {
    interstitialButtonManager.handleClick(
      { x, y },
      levelManager.isGameOver() || levelManager.isLastLevel()
        ? resetGame
        : levelManager.dismissInterstitialAndAdvanceLevel,
      shareImageManager.share
    );
  } else {
    activePointers.push(
      makeActivePointer(
        canvasManager,
        audioManager,
        scoreStore,
        tutorialManager,
        pointerId,
        { x, y },
        findBallAtPoint(balls, { x, y }),
        onPointerTrigger,
        handleGameClick
      )
    );
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

  activePointers.forEach((pointer) => {
    if (pointerId === pointer.getId()) pointer.setPosition({ x, y });
  });

  if (levelManager.isInterstitialShowing())
    interstitialButtonManager.handleHover({ x, y });

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

const triggerTimedOutHoldBlasts = () => {
  activePointers.forEach((p, pointerIndex) => {
    if (p.isHoldBlast() && p.getDuration() >= BLAST_MAX_DURATION) {
      activePointers.splice(pointerIndex, 1);
      p.trigger();
    }
  });
};

const detectCollisionsForGameObjects = () => {
  // Run collision detection on bubbles and bounce bubbles off eachother
  // Run collision detection on blasts + slingshots and pop colliding bubbles
  const ballsInPlay = balls.filter((b) => b.isRemaining() && b.shouldRender());
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
};

const drawComboMessages = (deltaTime) => {
  scoreStore
    .getCombos()
    .filter(({ hasShownCombo }) => !hasShownCombo)
    .forEach(({ popped, position, spring }) => {
      spring.update(deltaTime);

      const boundedPosition = getBoundedPosition(canvasManager, position, 100);
      const text = `x${popped}!`;
      const textHeight = 48;

      const fadeIn = transition(
        0,
        1,
        clampedProgress(0, 1, spring.getCurrentValue())
      );
      const slideUp = transition(
        boundedPosition.y + 100,
        boundedPosition.y + textHeight / 2,
        spring.getCurrentValue()
      );
      const rotateIn = transition(
        -Math.PI / 2,
        Math.PI / 80,
        spring.getCurrentValue()
      );
      const scaleIn = transition(0.01, 1, spring.getCurrentValue());

      CTX.save();
      CTX.globalAlpha = fadeIn;
      CTX.translate(boundedPosition.x, slideUp);
      CTX.rotate(rotateIn);
      CTX.scale(scaleIn, scaleIn);
      CTX.font = `${FONT_WEIGHT_BOLD} 64px ${FONT}`;

      // Shadow
      CTX.fillStyle = "#000";
      CTX.textAlign = "center";
      CTX.fillText(text, 0, 0);

      // Text
      CTX.translate(-2, -3);
      CTX.fillStyle = "#fff";
      CTX.fillText(text, 0, 0);

      CTX.restore();
    });
};

animate((deltaTime) => {
  CTX.save();
  CTX.fillStyle = background;
  CTX.fillRect(0, 0, canvasManager.getWidth(), canvasManager.getHeight());
  CTX.restore();

  cameraWrapper(() => {
    // Trigger holdBlasts that have been held down past the max time
    if (!levelManager.isInterstitialShowing()) {
      triggerTimedOutHoldBlasts();
    }

    detectCollisionsForGameObjects();

    // Draw text elements (level, life, interstitial) underneath bubbles
    levelManager.drawInterstitialMessage({
      previewInitialMessage: (msElapsed) => {
        makeTextBlock(
          canvasManager,
          {
            xPos: canvasManager.getWidth() / 2,
            yPos: canvasManager.getHeight() / 2,
            textAlign: "center",
            verticalAlign: "center",
          },
          [`Preview of “${previewData.name}”`]
        ).draw(msElapsed);
        interstitialButtonManager.draw(
          deltaTime,
          msElapsed,
          80,
          "Play Preview"
        );
      },
      initialMessage: (msElapsed) => {
        makeTextBlock(
          canvasManager,
          {
            xPos: canvasManager.getWidth() / 2,
            yPos: canvasManager.getHeight() / 2,
            textAlign: "center",
            verticalAlign: "center",
          },
          tutorialManager.isTutorialCompletedThisSession()
            ? ["Bubbles fall from the top"]
            : ["Pop the bubble"]
        ).draw(msElapsed);
        interstitialButtonManager.draw(deltaTime, msElapsed, {
          delay: 80,
          text: "Play",
        });
      },
      firstMissMessage: (msElapsed) => {
        scoreDisplay.draw();
        shareImageManager.draw();
        interstitialButtonManager.draw(deltaTime, msElapsed, {
          delay: 960,
          isSharable: true,
        });
      },
      defaultMessage: (msElapsed) => {
        scoreDisplay.draw();
        shareImageManager.draw();
        interstitialButtonManager.draw(deltaTime, msElapsed, {
          delay: 960,
          isSharable: true,
        });
      },
      endGameMessage: (msElapsed) => {
        scoreDisplay.draw();
        shareImageManager.draw();
        interstitialButtonManager.draw(deltaTime, msElapsed, {
          delay: 1920,
          text: "Try Again",
          isSharable: true,
        });
      },
      reachedEndOfGameMessage: (msElapsed) => {
        scoreDisplay.draw();
        shareImageManager.draw();
        interstitialButtonManager.draw(deltaTime, msElapsed, {
          delay: 1920,
          text: "Play Again",
          isSharable: true,
        });
      },
    });

    if (tutorialManager.isTutorialComplete()) {
      levelManager.drawLevelNumber();

      if (!levelManager.isInterstitialShowing() && !levelManager.isGameOver()) {
        lifeManager.draw();
      }
    } else {
      tutorialManager.draw();
    }

    // Draw main game elements
    ripples.forEach((r) => r.draw());
    previousLevelBalls.forEach((b) => b.draw(deltaTime));
    fireworks.forEach((f) => f.draw(deltaTime));

    if (levelManager.showLevelCountdown()) {
      levelManager.drawLevelCountdown();
    } else {
      balls.forEach((b) => b.draw(deltaTime));
    }

    pointerTriggerOutput.forEach((b) => b.draw(deltaTime));
    activePointers.forEach((p) => p.draw());

    // Draw combo messages over everything
    if (tutorialManager.isTutorialComplete()) {
      drawComboMessages(deltaTime);
    }
  });
});

function handleGameClick(currentTapPosition, ballAtPointOfInitialTap) {
  // In case of an active tutorial, the ball pop may be the first interaction
  // Subsequent calls are ignored.
  audioManager.initialize();

  // Taps are delayed until pointerup so that we can determine whether a tap
  // is a slingshot, blast, or tap, and not trigger two events from one gesture.
  // So that taps don't feel slow, and the game isn't frustrating, we detect
  // what ball the user would have popped on pointerdown as well as pointerup
  // and let them have the pop in either case.
  const collisionOnPointerUp = findBallAtPoint(balls, currentTapPosition);
  const collidingBall = ballAtPointOfInitialTap || collisionOnPointerUp;

  if (collidingBall) {
    scoreStore.recordTap(currentTapPosition, 1, collidingBall.getFill());
    collidingBall.pop();
    audioManager.playSequentialPluck();
  } else {
    scoreStore.recordTap(currentTapPosition, 0);
    ripples.push(makeRipple(canvasManager, currentTapPosition));
    audioManager.playMiss();
  }
}

function onPointerTrigger(output) {
  pointerTriggerOutput.push(output);
}

function onPop() {
  if (balls.filter((b) => b.isRemaining()) <= 0) {
    // Pause before showing interstitial so user can see the final bubble pop
    setTimeout(levelManager.showLevelInterstitial, 600);
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

function onTutorialPop() {
  if (balls.filter((b) => b.isRemaining()) <= 0) {
    tutorialManager.advance();
  }
}

function onGameEnd() {
  audioManager.playLose();
  levelManager.onGameOver();
}

function onInterstitial() {
  scoreDisplay.update();
  shareImageManager.update();
  resetOngoingVisuals();

  if (!levelManager.isGameOver() && levelManager.isLastLevel()) {
    fireworks = new Array(8)
      .fill()
      .map(() => makeFirework(canvasManager, audioManager));
  }
}

function onLevelAdvance() {
  resetLevelData();

  // Allow popping animation to finish playing for previous level bubbles
  previousLevelBalls = balls.filter((b) => b.isPopping());
  balls = makeLevelBalls(
    canvasManager,
    levelManager.getLevelData(),
    onPop,
    onMiss
  );

  // Call on first interaction. Subsequent calls are ignored.
  audioManager.initialize();
  audioManager.playRandomLevel();
}

function onPreviewAdvance() {
  resetPreviewData();

  // Allow popping animation to finish playing for previous level bubbles
  previousLevelBalls = balls.filter((b) => b.isPopping());
  balls = makeLevelBalls(canvasManager, previewData, onPop, onMiss);

  // Call on first interaction. Subsequent calls are ignored.
  audioManager.initialize();
  audioManager.playRandomLevel();
}

function onTutorialStart() {
  balls = tutorialManager.generateBalls(onTutorialPop, () => {});
}

function onTutorialAdvance() {
  previousLevelBalls = balls.filter((b) => b.isPopping());
  balls = tutorialManager.generateBalls(onTutorialPop, () => {});
}

function onTutorialComplete() {
  resetGame();
}
