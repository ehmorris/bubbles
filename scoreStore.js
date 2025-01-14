export const makeScoreStore = (levelManager) => {
  // MAP STRUCTURE EXAMPLE
  // We store discrete actions that we can flexibly sum, score, etc. later
  //
  // new Map([
  //   [
  //     "taps",
  //     [
  //       { timestamp: 1234, level: 1, position: { x: 42, y: 56 }, popped: 0 },
  //       { timestamp: 1234, level: 1, position: { x: 40, y: 52 }, popped: 1 },
  //       { timestamp: 1234, level: 2, position: { x: 42, y: 60 }, popped: 0 }
  //     ],
  //   ],
  //   [
  //     "slingshots",
  //     [
  //       { timestamp: 1234, level: 1, position: { x: 42, y: 56 }, velocity: { x: 0, y: 0 }, popped: 3 },
  //       { timestamp: 1234, level: 1, position: { x: 42, y: 56 }, velocity: { x: 0, y: 0 }, popped: 2 }
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
  //       { timestamp: 1234, level: 1 },
  //       { timestamp: 1234, level: 2 },
  //       { timestamp: 1234, level: 2 },
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

  const recordTap = (position, popped) => {
    store.set("taps", [
      ...store.get("taps"),
      {
        timestamp: Date.now(),
        level: levelManager.getLevel(),
        position,
        popped,
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
      },
    ]);

    return timestamp;
  };

  const updateSlingshot = (timestamp, popped) => {
    const slingshotIndex = store
      .get("slingshots")
      .findIndex((i) => i.timestamp === timestamp);

    const slingshotsCopy = [...store.get("slingshots")];

    slingshotsCopy[slingshotIndex].popped = popped;

    store.set("slingshots", slingshotsCopy);
  };

  const recordBlast = (position, power, popped) =>
    store.set("blasts", [
      ...store.get("blasts"),
      {
        timestamp: Date.now(),
        level: levelManager.getLevel(),
        position,
        power,
        popped,
      },
    ]);

  const recordMiss = () =>
    store.set("missedBubbles", [
      ...store.get("missedBubbles"),
      { timestamp: Date.now(), level: levelManager.getLevel() },
    ]);

  const hasPoppedKey = (name) => store.get(name).some((o) => "popped" in o);

  const sumAll = (name) => {
    const keyData = store.get(name);

    return hasPoppedKey(name)
      ? {
          num: keyData.length,
          numPopped: keyData.reduce((acc, { popped }) => acc + popped, 0),
        }
      : { num: keyData.length };
  };

  const sumCurrentLevel = (name) => {
    const keyData = store
      .get(name)
      .filter(({ level }) => level === levelManager.getLevel());

    return hasPoppedKey(name)
      ? {
          num: keyData.length,
          numPopped: keyData.reduce((acc, { popped }) => acc + popped, 0),
        }
      : { num: keyData.length };
  };

  const recentCombos = (level) => {
    const recentTimeframeInMS = 5000;

    return [
      ...store
        .get("slingshots")
        .filter(
          (s) =>
            s.level === level &&
            s.popped > 1 &&
            Date.now() - s.timestamp < recentTimeframeInMS
        ),
      ...store
        .get("blasts")
        .filter(
          (s) =>
            s.level === level &&
            s.popped > 1 &&
            Date.now() - s.timestamp < recentTimeframeInMS
        ),
    ];
  };

  return {
    recordTap,
    recordSlingshot,
    updateSlingshot,
    recordBlast,
    recordMiss,
    sumAll,
    sumCurrentLevel,
    recentCombos,
    reset,
  };
};
