import { CARD_HEIGHT, CARD_WIDTH, SAFE_INSET_PX } from '../constants.js';

/**
 * @param {{ getBoundingRect: () => { left: number, top: number, width: number, height: number } }} object
 * @returns {boolean}
 */
export function objectLeavesSafeArea(object) {
  const bounds = object.getBoundingRect();
  const right = bounds.left + bounds.width;
  const bottom = bounds.top + bounds.height;
  return (
    bounds.left < SAFE_INSET_PX - 0.5
    || bounds.top < SAFE_INSET_PX - 0.5
    || right > CARD_WIDTH - SAFE_INSET_PX + 0.5
    || bottom > CARD_HEIGHT - SAFE_INSET_PX + 0.5
  );
}

/**
 * @param {ReadonlyArray<{ getBoundingRect: () => { left: number, top: number, width: number, height: number } }>} objects
 * @returns {number}
 */
/**
 * Saved objects have no Fabric bounds, so the box is estimated from position and scale.
 * @param {{ left?: number, top?: number, width?: number, height?: number, scaleX?: number, scaleY?: number, originX?: string, originY?: string, getBoundingRect?: () => { left: number, top: number, width: number, height: number } }} object
 * @returns {boolean}
 */
export function objectRecordLeavesSafeArea(object) {
  if (typeof object.getBoundingRect === 'function') {
    return objectLeavesSafeArea(object);
  }

  const width = Math.abs(Number(object.width ?? 0) * Number(object.scaleX ?? 1));
  const height = Math.abs(Number(object.height ?? 0) * Number(object.scaleY ?? 1));
  let left = Number(object.left ?? 0);
  let top = Number(object.top ?? 0);
  if (object.originX === 'center') {
    left -= width / 2;
  } else if (object.originX === 'right') {
    left -= width;
  }
  if (object.originY === 'center') {
    top -= height / 2;
  } else if (object.originY === 'bottom') {
    top -= height;
  }

  return (
    left < SAFE_INSET_PX - 0.5
    || top < SAFE_INSET_PX - 0.5
    || left + width > CARD_WIDTH - SAFE_INSET_PX + 0.5
    || top + height > CARD_HEIGHT - SAFE_INSET_PX + 0.5
  );
}

/**
 * @param {ReadonlyArray<{ getBoundingRect?: () => { left: number, top: number, width: number, height: number } }>} objects
 * @returns {number}
 */
export function countUnsafeObjects(objects) {
  return objects.reduce((count, object) => count + (objectRecordLeavesSafeArea(object) ? 1 : 0), 0);
}
