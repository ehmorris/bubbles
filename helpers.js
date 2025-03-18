export const animate = (drawFunc) => {
  let previousTimestamp = false;

  const drawFuncContainer = (timestamp) => {
    // Prevent deltaTime from producing huge values when e.g. user switches
    // tabs and then switches back. 20 represents the number of milliseconds
    // between frames when game is running at 50fps.
    const deltaTime = Math.min(
      20,
      previousTimestamp
        ? timestamp - previousTimestamp
        : performance.now() - timestamp
    );
    drawFunc(deltaTime);
    window.requestAnimationFrame(drawFuncContainer);
    previousTimestamp = timestamp;
  };

  window.requestAnimationFrame(drawFuncContainer);
};

export const progress = (start, end, current) =>
  (current - start) / (end - start);

export const clampedProgress = (start, end, current) =>
  Math.max(0, Math.min(1, (current - start) / (end - start)));

export const transition = (start, end, progress, easingFunc) => {
  const easedProgress = easingFunc ? easingFunc(progress) : progress;
  return start + Math.sign(end - start) * Math.abs(end - start) * easedProgress;
};

export const randomBool = (probability = 0.5) => Math.random() >= probability;

export const randomBetween = (min, max) => Math.random() * (max - min) + min;

export const degToRag = (degree) => (degree * Math.PI) / 180;

export const getHeadingInRadsFromTwoPoints = (a, b) =>
  Math.atan2(a.y - b.y, a.x - b.x);

export const getVelocityFromSpeedAndHeading = (speed, headingInRads) => ({
  x: speed * Math.cos(headingInRads),
  y: speed * Math.sin(headingInRads),
});

export const getSpeedFromVelocity = ({ x, y }) => Math.sqrt(x * x + y * y);

export const findBallAtPoint = (balls, { x, y }) =>
  balls.find((ball) => {
    const dx = x - ball.getPosition().x;
    const dy = y - ball.getPosition().y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < ball.getRadius();
  });

export const getBoundedPosition = (canvasManager, { x, y }, padding = 16) => {
  const paddedBoundedX = Math.min(
    canvasManager.getWidth() - padding,
    Math.max(padding, x)
  );
  const paddedBoundedY = Math.min(
    canvasManager.getHeight() - padding,
    Math.max(padding, y)
  );
  return { x: paddedBoundedX, y: paddedBoundedY };
};
