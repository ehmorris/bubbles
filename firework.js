import { makeBall } from "./ball.js";
import { randomColor } from "./colors.js";
import { randomBetween } from "./helpers.js";

export const makeFirework = (canvasManager) => {
  const baseBall = makeBall(
    canvasManager,
    {
      startPosition: {
        x: randomBetween(0, canvasManager.getWidth()),
        y: canvasManager.getHeight(),
      },
      startVelocity: { x: randomBetween(-1, 1), y: randomBetween(-8, -10) },
      radius: randomBetween(6, 14),
      fill: randomColor(),
      delay: randomBetween(0, 1200),
    },
    () => {},
    () => {}
  );

  const draw = (deltaTime) => {
    if (!baseBall.isPopped() && baseBall.getVelocity().y > 0) {
      baseBall.pop();
    }

    baseBall.draw(deltaTime);
  };

  return { draw };
};
