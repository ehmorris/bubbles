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

// Anyone can put anything after ?level=, and this runs at import time, so a
// malformed payload would otherwise take the whole game down with it
function parsePreviewData(encodedLevel) {
  if (!encodedLevel) return false;

  try {
    const parsed = JSON.parse(atob(encodedLevel));
    return Array.isArray(parsed?.balls) ? parsed : false;
  } catch (e) {
    return false;
  }
}

const URLParams = new URLSearchParams(window.location.search);
const previewData = parsePreviewData(URLParams.get("level"));
const previewDataPresent = !!previewData;

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
const interstitialText = makeTextBlock(
  canvasManager,
  {
    xPos: () => canvasManager.getWidth() / 2,
    yPos: () => canvasManager.getHeight() / 2,
    textAlign: "center",
    verticalAlign: "center",
  },
  []
);

const tutorialManager = makeTutorialManager(
  canvasManager,
  onTutorialStart,
  onTutorialAdvance,
  resetGame
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
let showInterstitialTimeout;

function resetGame() {
  clearTimeout(showInterstitialTimeout);
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

// The last level and the missed-first-bubble screen both offer a restart
// rather than a next level, so every way of dismissing an interstitial has to
// route through here. Advancing off the last level walks past the end of the
// level data.
function advanceFromInterstitial() {
  levelManager.isGameOver() ||
  levelManager.isLastLevel() ||
  levelManager.missedFirstBubble()
    ? resetGame()
    : levelManager.dismissInterstitialAndAdvanceLevel();
}

canvasManager.getElement().addEventListener("pointerdown", (e) => {
  const { pointerId, offsetX: x, offsetY: y } = e;

  if (levelManager.isInterstitialShowing()) {
    interstitialButtonManager.handleClick(
      { x, y },
      advanceFromInterstitial,
      shareImageManager.share
    );
  } else {
    // Capture the pointer so a drag that ends outside the canvas still
    // delivers pointerup here. Without it the pointer is never removed and its
    // slingshot preview stays on screen. This throws if the pointer is already
    // gone by the time the queued event is handled, which is harmless — but it
    // must not stop the gesture below from being registered.
    try {
      canvasManager.getElement().setPointerCapture(pointerId);
    } catch (e) {}

    activePointers.push(
      makeActivePointer(
        canvasManager,
        audioManager,
        scoreStore,
        tutorialManager,
        pointerId,
        { x, y },
        findBallAtPoint(
          balls.filter((b) => b.inPlay() && b.inViewport()),
          { x, y }
        ),
        onPointerTrigger,
        handleGameClick
      )
    );
  }

  e.preventDefault();
});

canvasManager.getElement().addEventListener("pointerup", (e) => {
  const { pointerId, offsetX: x, offsetY: y } = e;
  const releasedPointers = activePointers.filter(
    (pointer) => pointerId === pointer.getId()
  );

  activePointers = activePointers.filter(
    (pointer) => pointerId !== pointer.getId()
  );

  releasedPointers.forEach((pointer) => {
    pointer.setPosition({ x, y });
    if (!levelManager.isInterstitialShowing()) pointer.trigger();
  });

  e.preventDefault();
});

// The browser can take a pointer away mid-gesture, e.g. a system swipe or a
// touch it decides belongs to something else. Drop it rather than leaving it
// active and drawing forever.
canvasManager.getElement().addEventListener("pointercancel", (e) => {
  activePointers = activePointers.filter(
    (pointer) => e.pointerId !== pointer.getId()
  );
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

  // Gated on the button's own delay so the keyboard can't skip an interstitial
  // before its button is live
  if (
    validKey &&
    levelManager.isInterstitialShowing() &&
    interstitialButtonManager.hasDelayPassed()
  ) {
    document.body.classList.remove("buttonHover");
    advanceFromInterstitial();
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
  const timedOut = activePointers.filter(
    (p) => p.isHoldBlast() && p.getDuration() >= BLAST_MAX_DURATION
  );

  if (timedOut.length) {
    activePointers = activePointers.filter((p) => !timedOut.includes(p));
    timedOut.forEach((p) => p.trigger());
  }
};

const detectCollisionsForGameObjects = () => {
  // Run collision detection on bubbles and bounce bubbles off eachother
  // Run collision detection on blasts + slingshots and pop colliding bubbles
  const ballsInPlay = balls.filter((b) => b.inPlay());
  const outputsInPlay = pointerTriggerOutput.filter((p) => !p.isGone());

  ballsInPlay.forEach((ballA, indexA) => {
    // Start past ballA so each pair is handled once per frame. Running both
    // (A, B) and (B, A) applied the positional correction twice.
    for (let indexB = indexA + 1; indexB < ballsInPlay.length; indexB++) {
      const ballB = ballsInPlay[indexB];
      const collision = checkParticleCollision(ballA, ballB);
      if (collision[0]) {
        adjustParticlePositions(ballA, ballB, collision[1]);
        resolveParticleCollision(ballA, ballB);
      }
    }

    // Bubbles wait above the top of the screen before a level starts, and a
    // maxed blast reaches a radius of 280 — far enough to pop the first queued
    // row at y -180, which the player can't see yet
    if (ballA.inViewport()) {
      outputsInPlay.forEach((output) => {
        // Once popped, a bubble shouldn't also credit the next output that
        // happens to overlap it this frame with a combo
        if (ballA.isPopped()) return;

        const collision = checkParticleCollision(ballA, output);
        if (collision[0]) {
          output.isHoldBlast()
            ? ballA.pop(output.getRelativeVelocity(ballA.getPosition()))
            : ballA.pop(output.getVelocity());

          output.logCollision();

          audioManager.playSequentialPluck();
        }
      });
    }
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
        const text = `Preview of “${previewData.name}”`;
        if (interstitialText.getLines()[0] !== text)
          interstitialText.updateLines([text]);

        interstitialText.draw(deltaTime);

        interstitialButtonManager.draw(deltaTime, msElapsed, {
          delay: 80,
          text: "Play Preview",
        });
      },
      initialMessage: (msElapsed) => {
        const text = tutorialManager.isTutorialCompletedThisSession()
          ? "Bubbles fall from the top"
          : "Pop the bubble";
        if (interstitialText.getLines()[0] !== text)
          interstitialText.updateLines([text]);

        interstitialText.draw(deltaTime);

        interstitialButtonManager.draw(deltaTime, msElapsed, {
          delay: 80,
          text: "Play",
        });
      },
      retryFirstLevelMessage: (msElapsed) => {
        const textArray = ["Whoops, try to get", "that bubble"];
        if (interstitialText.getLines()[0] !== textArray[0])
          interstitialText.updateLines(textArray);

        interstitialText.draw(deltaTime);

        interstitialButtonManager.draw(deltaTime, msElapsed, {
          delay: 80,
          text: "Try Again",
        });
      },
      defaultMessage: (msElapsed) => {
        scoreDisplay.draw(deltaTime);
        shareImageManager.draw(deltaTime);
        interstitialButtonManager.draw(deltaTime, msElapsed, {
          delay: 960,
          isSharable: true,
        });
      },
      endGameMessage: (msElapsed) => {
        scoreDisplay.draw(deltaTime);
        shareImageManager.draw(deltaTime);
        interstitialButtonManager.draw(deltaTime, msElapsed, {
          delay: 1920,
          text: "Try Again",
          isSharable: true,
        });
      },
      reachedEndOfGameMessage: (msElapsed) => {
        scoreDisplay.draw(deltaTime);
        shareImageManager.draw(deltaTime);
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
      tutorialManager.draw(deltaTime);
    }

    // Draw main game elements
    ripples.forEach((r) => r.draw());
    previousLevelBalls.forEach((b) => b.draw(deltaTime));
    fireworks.forEach((f) => f.draw(deltaTime));

    levelManager.drawLevelCountdown(deltaTime);
    if (!levelManager.levelCountingDown()) {
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
  const collisionOnPointerUp = findBallAtPoint(
    balls.filter((b) => b.inPlay() && b.inViewport()),
    currentTapPosition
  );
  // The bubble found on pointerdown may have been popped by a blast in the
  // meantime, in which case tapping it shouldn't count as popping it again
  const collidingBall =
    ballAtPointOfInitialTap && ballAtPointOfInitialTap.inPlay()
      ? ballAtPointOfInitialTap
      : collisionOnPointerUp;

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
  if (balls.filter((b) => b.inPlay()).length === 0) {
    // Pause before showing interstitial so user can see the final bubble pop.
    // Tracked so that losing the last life inside this window doesn't let a
    // stale timer restart the game over screen behind the player.
    clearTimeout(showInterstitialTimeout);
    showInterstitialTimeout = setTimeout(
      levelManager.showLevelInterstitial,
      600
    );
  }
}

function onMiss() {
  if (!levelManager.isGameOver()) {
    scoreStore.recordMiss();
    lifeManager.subtract();
    audioManager.playRandomFireworks();

    if (lifeManager.getLives() <= 0) {
      onGameEnd();
    } else if (balls.filter((b) => b.inPlay()).length === 0) {
      if (levelManager.getLevel() === 1) {
        levelManager.setMissedFirstBubble();
      }
      levelManager.showLevelInterstitial();
    }
  }
}

function onTutorialPop() {
  if (balls.filter((b) => b.inPlay()).length === 0) {
    tutorialManager.advance();
  }
}

function onGameEnd() {
  clearTimeout(showInterstitialTimeout);
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
