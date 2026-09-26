import { MIN_QR_MM, MIN_QR_PX } from '../constants.js';

/**
 * @typedef {'front' | 'back'} CardFace
 */

/**
 * Smallest edge of a printed QR, in canvas pixels.
 * Placeholder slots are ignored because they are not scannable yet.
 * @param {ReadonlyArray<{ cardKind?: string, width?: number, height?: number, scaleX?: number, scaleY?: number, getScaledWidth?: () => number, getScaledHeight?: () => number }>} objects
 * @returns {number | null}
 */
export function smallestQrPx(objects) {
  let smallest = Number.POSITIVE_INFINITY;
  let found = false;

  objects.forEach((object) => {
    if (object.cardKind !== 'qr') {
      return;
    }
    found = true;
    const width = typeof object.getScaledWidth === 'function'
      ? object.getScaledWidth()
      : Number(object.width ?? 0) * Number(object.scaleX ?? 1);
    const height = typeof object.getScaledHeight === 'function'
      ? object.getScaledHeight()
      : Number(object.height ?? 0) * Number(object.scaleY ?? 1);
    smallest = Math.min(smallest, width, height);
  });

  return found ? smallest : null;
}

/**
 * @param {number | null} frontPx
 * @param {number | null} backPx
 * @returns {string}
 */
export function qrHealthNote(frontPx, backPx) {
  /** @type {CardFace[]} */
  const tight = [];
  if (frontPx !== null && frontPx < MIN_QR_PX) {
    tight.push('front');
  }
  if (backPx !== null && backPx < MIN_QR_PX) {
    tight.push('back');
  }
  if (frontPx === null && backPx === null) {
    return 'No QR on the card yet. Add one so a camera reads the same record as the chip.';
  }
  if (tight.length === 0) {
    return '';
  }
  const faces = tight.join(' and ');
  return `The ${faces} QR is under ${MIN_QR_MM} mm. Enlarge it so a phone can scan the print.`;
}
