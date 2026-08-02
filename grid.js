import { white } from "./colors.js";
import { FONT_WEIGHT_NORMAL, FONT } from "./constants.js";

export const makeGrid = (
  canvasManager,
  items,
  {
    itemWidth,
    itemHeight,
    edgeMargin = 32,
    spaceBetweenH = 8,
    spaceBetweenV = 12,
    maxRows = 3,
  }
) => {
  const CTX = canvasManager.getContext();
  const gridWidth = canvasManager.getWidth() - edgeMargin * 2;
  const itemsPerRow = Math.floor(
    (gridWidth + spaceBetweenH) / (itemWidth + spaceBetweenH)
  );
  const totalRows = Math.ceil(items.length / itemsPerRow);
  const gridHeight =
    (itemHeight + spaceBetweenV) * Math.min(totalRows, maxRows) - spaceBetweenV;

  const drawItems = (drawFunc) => {
    let truncatedIndex = false;
    // Only give up the last cell to the "+N" badge when there are more items
    // than fit. A grid that filled exactly was hiding a real item to show "+1".
    const isTruncated = items.length > itemsPerRow * maxRows;

    items.forEach((item, index) => {
      const colIndex = index % itemsPerRow;
      const rowIndex = Math.floor(index / itemsPerRow);
      const lastRowItem =
        isTruncated && rowIndex + 1 === maxRows && colIndex + 1 === itemsPerRow;

      if (rowIndex < maxRows && !lastRowItem) {
        CTX.save();

        CTX.translate(
          edgeMargin + itemWidth * colIndex + spaceBetweenH * colIndex,
          itemHeight * rowIndex + spaceBetweenV * rowIndex
        );

        drawFunc(item, index);
        CTX.restore();
      } else if (truncatedIndex === false) {
        // Not `!truncatedIndex` — index 0 is a valid place to start truncating
        truncatedIndex = index;
      }
    });

    if (truncatedIndex !== false) {
      CTX.save();
      CTX.translate(
        edgeMargin +
          itemWidth * (itemsPerRow - 1) +
          spaceBetweenH * (itemsPerRow - 1),
        itemHeight * (maxRows - 1) + spaceBetweenV * (maxRows - 1)
      );

      CTX.fillStyle = "rgba(255, 255, 255, .2)";
      CTX.beginPath();
      CTX.roundRect(0, 0, itemWidth, itemHeight, 8);
      CTX.closePath();
      CTX.fill();

      CTX.fillStyle = white;
      CTX.font = `${FONT_WEIGHT_NORMAL} 14px ${FONT}`;
      CTX.textAlign = "center";
      CTX.fillText(
        `+${items.length - truncatedIndex}`,
        itemWidth / 2,
        itemHeight / 2 + 4.5
      );
      CTX.restore();
    }
  };

  return {
    drawItems,
    getHeight: () => gridHeight,
  };
};
