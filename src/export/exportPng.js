import { StaticCanvas } from 'fabric';
import { CARD_BACKGROUND, CARD_HEIGHT, CARD_WIDTH } from '../constants.js';
import { pngDataUrlToPrintBlob } from './pngPhys.js';

/**
 * @typedef {'front' | 'back'} CardFace
 * @typedef {{ name: string, blob: Blob }} ExportedFace
 */

/**
 * Renders the live canvas to a 1011 × 638 PNG with selection chrome removed.
 * @param {import('fabric').Canvas} canvas
 * @param {string} filename
 * @returns {Promise<ExportedFace>}
 * @throws {Error} When rasterization fails.
 */
export async function exportActiveFace(canvas, filename) {
  const selected = canvas.getActiveObject();
  canvas.discardActiveObject();
  canvas.renderAll();

  try {
    await document.fonts.ready;
    const dataUrl = canvas.toDataURL({ format: 'png', multiplier: 1 });
    return { name: filename, blob: pngDataUrlToPrintBlob(dataUrl) };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`[Export] Failed to render the active face: ${message}`);
  } finally {
    if (selected) {
      canvas.setActiveObject(selected);
      canvas.renderAll();
    }
  }
}

/**
 * Renders a stored face on an offscreen canvas so the editor does not flash.
 * @param {Record<string, unknown> | null} snapshot
 * @param {string} filename
 * @returns {Promise<ExportedFace>}
 * @throws {Error} When the offscreen canvas cannot render the snapshot.
 */
export async function exportSnapshot(snapshot, filename) {
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
    const dataUrl = offscreen.toDataURL({ format: 'png', multiplier: 1 });
    return { name: filename, blob: pngDataUrlToPrintBlob(dataUrl) };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`[Export] Failed to render ${filename}: ${message}`);
  } finally {
    offscreen.dispose();
  }
}

/**
 * Exports both faces. The active face comes from the live canvas.
 * @param {import('fabric').Canvas} canvas
 * @param {{ activeFace: CardFace, snapshots: Record<CardFace, Record<string, unknown> | null> }} state
 * @param {Partial<Record<CardFace, string>>} [filenames]
 * @returns {Promise<{ front: ExportedFace, back: ExportedFace }>}
 */
export async function exportBothFaces(canvas, state, filenames = {}) {
  const otherFace = state.activeFace === 'front' ? 'back' : 'front';
  const active = await exportActiveFace(canvas, filenames[state.activeFace] || faceFilename(state.activeFace));
  const other = await exportSnapshot(state.snapshots[otherFace], filenames[otherFace] || faceFilename(otherFace));

  return {
    front: state.activeFace === 'front' ? active : other,
    back: state.activeFace === 'back' ? active : other,
  };
}

/**
 * @param {CardFace} face
 * @returns {string}
 */
export function faceFilename(face) {
  return face === 'back' ? 'card-back.png' : 'card-front.png';
}

/**
 * Starts a browser download for a PNG blob.
 * @param {Blob} blob
 * @param {string} filename
 * @returns {void}
 */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/**
 * Shares PNG files through the OS share sheet when the browser allows file shares.
 * @param {ExportedFace[]} items
 * @returns {Promise<'shared' | 'cancelled' | 'unsupported'>}
 */
export async function shareFiles(items) {
  if (typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') {
    return 'unsupported';
  }

  const files = items.map((item) => new File([item.blob], item.name, { type: 'image/png' }));
  const payload = { files, title: 'NFC business card' };
  if (!navigator.canShare(payload)) {
    return 'unsupported';
  }

  try {
    await navigator.share(payload);
    return 'shared';
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return 'cancelled';
    }
    return 'unsupported';
  }
}
