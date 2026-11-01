// Computes a full-bleed tile layout: every pixel of containerW x containerH
// is covered by some tile (minus the thin gaps between tiles) — there is no
// leftover black space, which an aspect-ratio-preserving "fit" layout would
// leave as letterboxing whenever rows * tileAspect-correct-height doesn't
// reach the container's full height (e.g. a 3x2 grid of 16:9 tiles on a
// 16:9 screen only fills ~2/3 of the height).
//
// For each candidate column count, rows = ceil(count / cols) and each row's
// tiles are stretched to exactly fill that row's width; row heights are
// chosen so rows stack to exactly fill the container height. We then pick
// whichever column count makes a full row's tiles closest to the target
// aspect ratio — that minimizes how much each tile's video has to be
// cropped (via object-fit: cover) to fill its cell.
export function computeTileLayout(count, containerW, containerH, aspectRatio = 16 / 9, gap = 4) {
  if (count <= 0 || containerW <= 0 || containerH <= 0) {
    return { rects: [], cols: 0, rows: 0 };
  }

  let best = null;
  for (let cols = 1; cols <= count; cols++) {
    const rows = Math.ceil(count / cols);
    const rowHeight = (containerH - gap * (rows - 1)) / rows;
    const fullRowTileWidth = (containerW - gap * (cols - 1)) / cols;
    if (rowHeight <= 0 || fullRowTileWidth <= 0) continue;

    const cellAspect = fullRowTileWidth / rowHeight;
    const score = Math.abs(cellAspect - aspectRatio);
    if (!best || score < best.score) {
      best = { cols, rows, rowHeight, score };
    }
  }

  if (!best) return { rects: [], cols: 0, rows: 0 };

  const rects = [];
  let remaining = count;
  let y = 0;
  for (let r = 0; r < best.rows; r++) {
    const itemsInRow = Math.min(best.cols, remaining);
    const rowWidth = containerW - gap * (itemsInRow - 1);
    const tileW = rowWidth / itemsInRow;
    let x = 0;
    for (let c = 0; c < itemsInRow; c++) {
      rects.push({ x, y, w: tileW, h: best.rowHeight });
      x += tileW + gap;
    }
    y += best.rowHeight + gap;
    remaining -= itemsInRow;
  }

  return { rects, cols: best.cols, rows: best.rows };
}
