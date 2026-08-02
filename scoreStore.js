import { levels as levelData } from "./levelData.js";
import { makeSpring } from "./spring.js";

export const makeScoreStore = (levelManager) => {
  // MAP STRUCTURE EXAMPLE
  // We store discrete actions that we can flexibly sum, score, etc. later
  //
  // new Map([
  //   [
  //     "taps",
  //     [
  //       { timestamp: 1234, level: 1, position: { x: 42, y: 56 }, popped: 0, fill: false },
  //       { timestamp: 1234, level: 1, position: { x: 40, y: 52 }, popped: 1, fill: '#000000' },
  //       { timestamp: 1234, level: 2, position: { x: 42, y: 60 }, popped: 0, fill: false}
  //     ],
  //   ],
  //   [
  //     "slingshots",
  //     [
  //       { timestamp: 1234, level: 1, position: { x: 42, y: 56 }, velocity: { x: 0, y: 0 }, popped: 3, spring: [object], hasShownCombo: false },
  //       { timestamp: 1234, level: 1, position: { x: 42, y: 56 }, velocity: { x: 0, y: 0 }, popped: 2, spring: [object], hasShownCombo: false }
  //     ],
  //   ],
  //   [
  //     "blasts",
  //     [
  //       { timestamp: 1234, level: 1, position: { x: 42, y: 56 }, power: 123, popped: 2 },
  //       { timestamp: 1234, level: 1, position: { x: 42, y: 56 }, power: 123, popped: 3 }
  //     ],
  //   ],
  //   [
  //     "missedBubbles",
  //     [
  //       { timestamp: 1234, level: 1, popped: 0 },
  //       { timestamp: 1234, level: 2, popped: 0 },
  //       { timestamp: 1234, level: 2, popped: 0 },
  //     ],
  //   ],
  // ]);

  let store;

  const reset = () =>
    (store = new Map([
      ["taps", []],
      ["slingshots", []],
      ["blasts", []],
      ["missedBubbles", []],
    ]));
  reset();

  const recordTap = (position, popped, fill = false) => {
    store.set("taps", [
      ...store.get("taps"),
      {
        timestamp: Date.now(),
        level: levelManager.getLevel(),
        position,
        popped,
        fill,
      },
    ]);
  };

  const recordSlingshot = (position, velocity, popped) => {
    const timestamp = Date.now();

    store.set("slingshots", [
      ...store.get("slingshots"),
      {
        timestamp,
        level: levelManager.getLevel(),
        position: { ...position },
        velocity: { ...velocity },
        popped,
        hasShownCombo: false,
      },
    ]);

    return timestamp;
  };

  const updateSlingshot = (timestamp, popped) => {
    const slingshotIndex = store
      .get("slingshots")
      .findIndex((i) => i.timestamp === timestamp);

    // A projectile can outlive the store that recorded it — resetting the score
    // store doesn't clear projectiles still in flight
    if (slingshotIndex === -1) return;

    const slingshotsCopy = [...store.get("slingshots")];

    slingshotsCopy[slingshotIndex].popped = popped;

    if (!slingshotsCopy[slingshotIndex].spring) {
      slingshotsCopy[slingshotIndex].spring = makeSpring(0, {
        stiffness: 70,
        damping: 6,
        mass: 1,
        precision: 100,
      });

      slingshotsCopy[slingshotIndex].spring.setEndValue(1).then(() => {
        slingshotsCopy[slingshotIndex].spring.setEndValue(0).then(() => {
          slingshotsCopy[slingshotIndex].hasShownCombo = true;
        });
      });
    }

    store.set("slingshots", slingshotsCopy);
  };

  const recordBlast = (position, power, popped) => {
    const timestamp = Date.now();

    store.set("blasts", [
      ...store.get("blasts"),
      {
        timestamp,
        level: levelManager.getLevel(),
        position,
        power,
        popped,
        hasShownCombo: false,
      },
    ]);

    return timestamp;
  };

  const updateBlast = (timestamp, popped) => {
    const blastIndex = store
      .get("blasts")
      .findIndex((i) => i.timestamp === timestamp);

    if (blastIndex === -1) return;

    const blastsCopy = [...store.get("blasts")];

    blastsCopy[blastIndex].popped = popped;

    if (!blastsCopy[blastIndex].spring) {
      blastsCopy[blastIndex].spring = makeSpring(0, {
        stiffness: 70,
        damping: 6,
        mass: 1,
        precision: 100,
      });

      blastsCopy[blastIndex].spring.setEndValue(1).then(() => {
        blastsCopy[blastIndex].spring.setEndValue(0).then(() => {
          blastsCopy[blastIndex].hasShownCombo = true;
        });
      });
    }

    store.set("blasts", blastsCopy);
  };

  const recordMiss = () =>
    store.set("missedBubbles", [
      ...store.get("missedBubbles"),
      { timestamp: Date.now(), level: levelManager.getLevel(), popped: 0 },
    ]);

  const sumCategoryLevelEvents = (category, passedLevel = null) => {
    let filteredEvents;

    if (passedLevel) {
      filteredEvents = store
        .get(category)
        .filter(({ level }) => level === passedLevel);
    } else {
      filteredEvents = store.get(category);
    }

    // Every recorded event stores a `popped` key, including missed bubbles,
    // which store 0. An empty category therefore sums to 0 rather than
    // omitting numPopped entirely.
    return {
      data: filteredEvents,
      num: filteredEvents.length,
      numPopped: filteredEvents.reduce((acc, { popped }) => acc + popped, 0),
    };
  };

  const sumPopped = (passedLevel = null) => {
    let totalPopped = 0;

    store.forEach((category) => {
      if (passedLevel) {
        category
          .filter(({ level }) => level === passedLevel)
          .forEach(({ popped }) => (totalPopped += popped));
      } else {
        category.forEach(({ popped }) => (totalPopped += popped));
      }
    });

    return totalPopped;
  };

  const getCombos = () => [
    ...store.get("slingshots").filter((s) => s.popped > 1),
    ...store.get("blasts").filter((b) => b.popped > 1),
  ];

  const levelScoreNumber = () => {
    const level = levelManager.getLevel();
    const numMoves =
      store.get("taps").filter((t) => t.level === level).length +
      store.get("slingshots").filter((s) => s.level === level).length +
      store.get("blasts").filter((b) => b.level === level).length;

    return numMoves - levelManager.getLevelData().par;
  };

  // `currentLevelPlayed` has no default on purpose: leaving it off silently
  // gave the end-of-game screens the countdown behavior, which dropped the
  // final level from the score. Every caller has to say which it wants.
  const overallScoreNumber = (currentLevelPlayed) => {
    // For the level countdown we want to display the overall par before the
    // current level is played e.g. on level 3, we want to display the score of
    // level 1 + level 2.
    //
    // For the end-of-game screen we want to display the overall par after the
    // current level has been played e.g. after level 3, we want to display the
    // score of level 1 + level 2 + level 3. A level ended by a game over was
    // not completed, so it passes false and contributes neither moves nor par.
    const maxLevelReached = currentLevelPlayed
      ? levelManager.getLevel()
      : levelManager.getLevel() - 1;
    const numMoves =
      store.get("taps").filter((t) => t.level <= maxLevelReached).length +
      store.get("slingshots").filter((s) => s.level <= maxLevelReached).length +
      store.get("blasts").filter((b) => b.level <= maxLevelReached).length;

    const summedPar = levelData.reduce(
      (acc, level, index) => (index < maxLevelReached ? acc + level.par : acc),
      0
    );

    return numMoves - summedPar;
  };

  const getTaps = (passedLevel = null) => [
    ...store
      .get("taps")
      .filter((s) => (passedLevel ? s.level === passedLevel : true)),
  ];

  const getSlingshots = (passedLevel = null) => [
    ...store
      .get("slingshots")
      .filter((s) => (passedLevel ? s.level === passedLevel : true)),
  ];

  const getBlasts = (passedLevel = null) => [
    ...store
      .get("blasts")
      .filter((b) => (passedLevel ? b.level === passedLevel : true)),
  ];

  return {
    recordTap,
    recordSlingshot,
    updateSlingshot,
    recordBlast,
    updateBlast,
    recordMiss,
    sumCategoryLevelEvents,
    sumPopped,
    getCombos,
    levelScoreNumber,
    overallScoreNumber,
    getTaps,
    getSlingshots,
    getBlasts,
    reset,
  };
};
