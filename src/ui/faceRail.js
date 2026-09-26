import { StaticCanvas } from 'fabric';
import { CARD_BACKGROUND, CARD_HEIGHT, CARD_WIDTH } from '../constants.js';

const THUMB_SCALE = 0.16;

/**
 * @typedef {'front' | 'back'} CardFace
 */

/**
 * Live thumbnails for both card faces.
 * @param {(face: CardFace) => void} onSelect
 * @returns {{
 *   setActive: (face: CardFace) => void,
 *   paintLive: (face: CardFace, canvas: import('fabric').Canvas) => void,
 *   paintSnapshot: (face: CardFace, snapshot: Record<string, unknown> | null) => Promise<void>,
 * }}
 * @throws {Error} When the face rail is missing from the page.
 */
export function createFaceRail(onSelect) {
  const rail = document.querySelector('#face-rail');
  if (!(rail instanceof HTMLElement)) {
    throw new Error('[FaceRail] Missing #face-rail');
  }

  /** @type {Record<CardFace, number>} */
  const generation = { front: 0, back: 0 };

  rail.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const face = target.closest('[data-face-thumb]')?.getAttribute('data-face-thumb');
    if (face === 'front' || face === 'back') {
      onSelect(face);
    }
  });

  return {
    /**
     * @param {CardFace} face
     */
    setActive(face) {
      rail.querySelectorAll('[data-face-thumb]').forEach((button) => {
        button.setAttribute('aria-pressed', String(button.getAttribute('data-face-thumb') === face));
      });
    },

    /**
     * @param {CardFace} face
     * @param {import('fabric').Canvas} canvas
     */
    paintLive(face, canvas) {
      const token = bump(generation, face);
      const url = canvas.toDataURL({ format: 'png', multiplier: THUMB_SCALE });
      if (generation[face] === token) {
        assignThumb(face, url);
      }
    },

    /**
     * @param {CardFace} face
     * @param {Record<string, unknown> | null} snapshot
     */
    async paintSnapshot(face, snapshot) {
      const token = bump(generation, face);
      const element = document.createElement('canvas');
      const offscreen = new StaticCanvas(element, {
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        backgroundColor: CARD_BACKGROUND,
        enableRetinaScaling: false,
      });

      try {
        await document.fonts.ready;
        if (snapshot) {
          await offscreen.loadFromJSON(snapshot);
        }
        offscreen.renderAll();
        const url = offscreen.toDataURL({ format: 'png', multiplier: THUMB_SCALE });
        if (generation[face] === token) {
          assignThumb(face, url);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`[FaceRail] Failed to preview the ${face}: ${message}`);
      } finally {
        offscreen.dispose();
      }
    },
  };
}

/**
 * @param {Record<CardFace, number>} generation
 * @param {CardFace} face
 * @returns {number}
 */
function bump(generation, face) {
  generation[face] += 1;
  return generation[face];
}

/**
 * @param {CardFace} face
 * @param {string} url
 * @returns {void}
 */
function assignThumb(face, url) {
  const image = document.querySelector(`#thumb-${face}`);
  if (image instanceof HTMLImageElement) {
    image.src = url;
  }
}
