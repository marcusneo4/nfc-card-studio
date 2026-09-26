import { CARD_BACKGROUND } from '../constants.js';
import { createProjectId } from '../domain/document.js';
import { snapshotCanvas } from '../domain/serialize.js';

/**
 * In-memory front and back design documents.
 * @typedef {'front' | 'back'} CardFace
 * @typedef {Record<string, unknown>} CardSnapshot
 * @typedef {{ activeFace: CardFace, snapshots: Record<CardFace, CardSnapshot | null>, projectName: string, projectId: string }} CardState
 */

/**
 * Creates an empty dual-sided card document.
 * @returns {CardState}
 */
export function createCardState() {
  return {
    activeFace: 'front',
    projectName: 'Untitled card',
    projectId: createProjectId(),
    snapshots: {
      front: null,
      back: null,
    },
  };
}

/**
 * Writes the live canvas into the active face snapshot.
 * Selection is cleared first so control chrome is not part of the document.
 * @param {import('fabric').Canvas} canvas
 * @param {CardState} state
 * @returns {void}
 */
export function captureActiveFace(canvas, state) {
  canvas.discardActiveObject();
  state.snapshots[state.activeFace] = snapshotCanvas(canvas);
  canvas.renderAll();
}

/**
 * Switches the live canvas to the other face without dropping either design.
 * @param {import('fabric').Canvas} canvas
 * @param {CardState} state
 * @param {CardFace} nextFace
 * @returns {Promise<CardFace>}
 * @throws {Error} When `nextFace` is not `front` or `back`.
 */
export async function switchFace(canvas, state, nextFace) {
  if (nextFace !== 'front' && nextFace !== 'back') {
    throw new Error('[CardState] Face must be front or back');
  }
  if (nextFace === state.activeFace) {
    return state.activeFace;
  }

  try {
    captureActiveFace(canvas, state);
    state.activeFace = nextFace;
    await loadSnapshot(canvas, state.snapshots[nextFace]);
    return state.activeFace;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`[CardState] Failed to switch to ${nextFace}: ${message}`);
  }
}

/**
 * @param {import('fabric').Canvas} canvas
 * @param {CardSnapshot | null} snapshot
 * @returns {Promise<void>}
 */
async function loadSnapshot(canvas, snapshot) {
  if (!snapshot) {
    canvas.clear();
    canvas.backgroundColor = CARD_BACKGROUND;
    canvas.renderAll();
    return;
  }

  await canvas.loadFromJSON(snapshot);
  canvas.renderAll();
}
