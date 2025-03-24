// Based on https://github.com/hatsumatsu/spring
export const makeSpring = (
  initialValue = 0,
  {
    stiffness: initialStiffness = 200,
    damping: initialDamping = 10,
    precision: initialPrecision = 50,
    mass: initialMass = 1,
  }
) => {
  let stiffness = initialStiffness;
  let damping = initialDamping;
  let precision = initialPrecision;
  let mass = initialMass;

  let currentValue = initialValue;
  let endValue = initialValue; // initialize spring at rest
  let velocity = 0;
  let atRest = true;
  let pendingResolver = null;

  const update = (deltaTime) => {
    const difference = endValue - currentValue;
    const acceleration = (stiffness * difference) / mass - damping * velocity;
    const newVelocity = velocity + acceleration * (deltaTime / 1000);
    const newValue = currentValue + newVelocity * (deltaTime / 1000);

    atRest =
      Math.abs(newVelocity) < 1 / precision &&
      Math.abs(endValue - newValue) < 1 / precision;

    currentValue = atRest ? endValue : newValue;
    velocity = atRest ? 0 : newVelocity;

    // If the spring is at rest and we have a pending resolver, resolve it
    if (atRest && pendingResolver) {
      pendingResolver();
      pendingResolver = null;
    }
  };

  const updateProps = ({
    stiffness: passedStiffness = stiffness,
    damping: passedDamping = damping,
    precision: passedPrecision = precision,
    mass: passedMass = mass,
  }) => {
    stiffness = passedStiffness;
    damping = passedDamping;
    precision = passedPrecision;
    mass = passedMass;
  };

  const setEndValue = (v) => {
    endValue = v;

    // If already at rest and at the target value, resolve immediately
    return new Promise((resolve) => {
      atRest && currentValue === endValue
        ? resolve()
        : (pendingResolver = resolve);
    });
  };

  const resetValue = (v = initialValue) => {
    currentValue = v;
    endValue = v;
    velocity = 0;
    atRest = true;
    pendingResolver = null;
  };

  return {
    setEndValue,
    resetValue,
    getCurrentValue: () => currentValue,
    update,
    updateProps,
    getStiffness: () => stiffness,
    getDamping: () => damping,
    getMass: () => mass,
  };
};
