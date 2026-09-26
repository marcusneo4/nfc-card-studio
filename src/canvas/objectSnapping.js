import { CARD_HEIGHT, CARD_WIDTH } from '../constants.js';

const SNAP_THRESHOLD = 8;

/**
 * Adds edge and center snapping for movable canvas objects.
 * @param {import('fabric').Canvas} canvas
 * @param {HTMLElement} verticalGuide
 * @param {HTMLElement} horizontalGuide
 * @returns {{ clear: () => void }}
 */
export function createObjectSnapping(canvas, verticalGuide, horizontalGuide) {
  const xTargets = [0, CARD_WIDTH / 2, CARD_WIDTH];
  const yTargets = [0, CARD_HEIGHT / 2, CARD_HEIGHT];

  const clear = () => {
    verticalGuide.hidden = true;
    horizontalGuide.hidden = true;
  };

  canvas.on('object:moving', ({ target }) => {
    if (!target) {
      clear();
      return;
    }

    const bounds = target.getBoundingRect();
    const xSnap = closestSnap(
      [bounds.left, bounds.left + bounds.width / 2, bounds.left + bounds.width],
      xTargets,
    );
    const ySnap = closestSnap(
      [bounds.top, bounds.top + bounds.height / 2, bounds.top + bounds.height],
      yTargets,
    );

    if (xSnap) {
      target.set({ left: (target.left ?? 0) + xSnap.delta });
      verticalGuide.style.left = `${xSnap.target}px`;
      verticalGuide.hidden = false;
    } else {
      verticalGuide.hidden = true;
    }

    if (ySnap) {
      target.set({ top: (target.top ?? 0) + ySnap.delta });
      horizontalGuide.style.top = `${ySnap.target}px`;
      horizontalGuide.hidden = false;
    } else {
      horizontalGuide.hidden = true;
    }

    target.setCoords();
  });

  canvas.on('object:modified', clear);
  canvas.on('selection:cleared', clear);
  canvas.on('mouse:up', clear);
  return { clear };
}

/**
 * @param {number[]} points
 * @param {number[]} targets
 * @returns {{ delta: number, target: number } | null}
 */
function closestSnap(points, targets) {
  let closest = null;
  for (const point of points) {
    for (const target of targets) {
      const delta = target - point;
      if (Math.abs(delta) > SNAP_THRESHOLD) {
        continue;
      }
      if (!closest || Math.abs(delta) < Math.abs(closest.delta)) {
        closest = { delta, target };
      }
    }
  }
  return closest;
}
