export const makeCanvasManager = ({
  initialWidth,
  initialHeight,
  maxWidth,
  attachNode,
}) => {
  let width = Math.min(initialWidth, maxWidth);
  let height = initialHeight;
  const element = document.createElement("canvas");
  const context = element.getContext("2d", {
    colorSpace: "display-p3",
  });
  const resizeSubscribers = [];
  let scale = window.devicePixelRatio;

  const setCanvasSize = () => {
    scale = window.devicePixelRatio;
    element.style.width = width + "px";
    element.style.height = height + "px";
    element.width = Math.floor(width * scale);
    element.height = Math.floor(height * scale);
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.scale(scale, scale);
  };

  setCanvasSize();

  document.querySelector(attachNode).appendChild(element);

  window.addEventListener("resize", () => {
    width = Math.min(window.innerWidth, maxWidth);
    height = window.innerHeight;
    setCanvasSize();
    resizeSubscribers.forEach((subscriber) => subscriber());
  });

  return {
    getElement: () => element,
    getContext: () => context,
    getWidth: () => width,
    getHeight: () => height,
    getScaleFactor: () => scale,
    onResize: (subscriber) => resizeSubscribers.push(subscriber),
  };
};

export const makeOffscreenCanvas = ({
  width,
  height,
  scale = window.devicePixelRatio,
}) => {
  const offscreenElement = new OffscreenCanvas(width, height);
  const context = offscreenElement.getContext("2d", {
    colorSpace: "display-p3",
  });
  let _width = width;
  let _height = height;
  let _scale = scale;

  const setCanvasSize = ({
    width = _width,
    height = _height,
    scale = _scale,
  } = {}) => {
    _width = width;
    _height = height;
    _scale = scale;

    offscreenElement.width = Math.floor(_width * _scale);
    offscreenElement.height = Math.floor(_height * _scale);
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.scale(_scale, _scale);
  };

  setCanvasSize();

  return {
    getContext: () => context,
    getBitmap: () => offscreenElement.transferToImageBitmap(),
    getElement: () => offscreenElement,
    getWidth: () => _width,
    getHeight: () => _height,
    getScaleFactor: () => _scale,
    setCanvasSize,
  };
};
