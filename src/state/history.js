import { snapshotCanvas } from '../domain/serialize.js';

const HISTORY_LIMIT = 60;

/**
 * @typedef {Object} HistoryManager
 * @property {() => void} record
 * @property {() => void} reset
 * @property {() => Promise<boolean>} undo
 * @property {() => Promise<boolean>} redo
 * @property {() => boolean} canUndo
 * @property {() => boolean} canRedo
 * @property {() => { entries: string[], index: number }} exportStack
 * @property {(stack: { entries: string[], index: number } | null) => void} importStack
 */

/**
 * Creates bounded undo and redo history for the live card face.
 * @param {import('fabric').Canvas} canvas
 * @param {() => void} onChange
 * @returns {HistoryManager}
 */
export function createHistoryManager(canvas, onChange) {
  /** @type {string[]} */
  let entries = [];
  let index = -1;
  let suspended = false;
  let recordTimer = 0;

  const scheduleRecord = () => {
    window.clearTimeout(recordTimer);
    recordTimer = window.setTimeout(record, 80);
  };

  canvas.on('object:added', scheduleRecord);
  canvas.on('object:removed', scheduleRecord);
  canvas.on('object:modified', scheduleRecord);
  canvas.on('text:changed', scheduleRecord);

  /**
   * @returns {void}
   */
  function record() {
    if (suspended) {
      return;
    }

    const snapshot = JSON.stringify(snapshotCanvas(canvas));
    if (entries[index] === snapshot) {
      return;
    }

    entries = entries.slice(0, index + 1);
    entries.push(snapshot);
    if (entries.length > HISTORY_LIMIT) {
      entries.shift();
    }
    index = entries.length - 1;
    onChange();
  }

  /**
   * @returns {void}
   */
  function reset() {
    window.clearTimeout(recordTimer);
    entries = [JSON.stringify(snapshotCanvas(canvas))];
    index = 0;
    onChange();
  }

  /**
   * @param {number} nextIndex
   * @returns {Promise<boolean>}
   */
  async function restore(nextIndex) {
    if (nextIndex < 0 || nextIndex >= entries.length) {
      return false;
    }

    suspended = true;
    try {
      canvas.discardActiveObject();
      await canvas.loadFromJSON(JSON.parse(entries[nextIndex]));
      index = nextIndex;
      canvas.requestRenderAll();
      onChange();
      return true;
    } finally {
      suspended = false;
    }
  }

  reset();
  return {
    record,
    reset,
    undo: () => restore(index - 1),
    redo: () => restore(index + 1),
    canUndo: () => index > 0,
    canRedo: () => index >= 0 && index < entries.length - 1,
    exportStack() {
      return { entries: entries.slice(), index };
    },
    importStack(stack) {
      window.clearTimeout(recordTimer);
      if (!stack?.entries?.length) {
        reset();
        return;
      }
      entries = stack.entries.slice();
      index = Math.min(Math.max(stack.index, 0), entries.length - 1);
      onChange();
    },
  };
}
