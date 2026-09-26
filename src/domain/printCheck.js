import { qrHealthNote, smallestQrPx } from './qrHealth.js';
import { countUnsafeObjects } from './safeArea.js';

/**
 * @typedef {'front' | 'back'} CardFace
 * @typedef {{ cardKind?: string, width?: number, height?: number, scaleX?: number, scaleY?: number, left?: number, top?: number, getScaledWidth?: () => number, getScaledHeight?: () => number, getBoundingRect?: () => { left: number, top: number, width: number, height: number } }} FaceObject
 */

/**
 * Problems that would show up at the printer or on a phone scan.
 * The active face should pass live canvas objects. The other face can pass saved JSON.
 * @param {ReadonlyArray<FaceObject>} frontObjects
 * @param {ReadonlyArray<FaceObject>} backObjects
 * @returns {string[]}
 */
export function printIssues(frontObjects, backObjects) {
  /** @type {string[]} */
  const issues = [];
  const unsafe = [
    ['front', countUnsafeObjects(frontObjects)],
    ['back', countUnsafeObjects(backObjects)],
  ].filter(([, count]) => count > 0);

  if (unsafe.length > 0) {
    const faces = unsafe.map(([face]) => face).join(' and ');
    issues.push(`The ${faces} has content outside the 3 mm safe area.`);
  }

  const qrNote = qrHealthNote(smallestQrPx(frontObjects), smallestQrPx(backObjects));
  if (qrNote) {
    issues.push(qrNote);
  }

  return issues;
}
