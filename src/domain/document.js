import { CARD_BACKGROUND } from '../constants.js';
import { createEmptyProfile, normalizeProfile } from './profile.js';
import { snapshotCanvas } from './serialize.js';

export const DOCUMENT_VERSION = 2;
export const DOCUMENT_APP = 'card-atelier';

/**
 * @typedef {import('./profile.js').CardProfile} CardProfile
 * @typedef {'front' | 'back'} CardFace
 * @typedef {{
 *   id: string,
 *   version: number,
 *   app: string,
 *   projectName: string,
 *   activeFace: CardFace,
 *   snapshots: Record<CardFace, Record<string, unknown> | null>,
 *   profile: CardProfile,
 *   savedAt: string,
 * }} CardDocument
 */

/**
 * Stable id for one saved card on this device.
 * @returns {string}
 */
export function createProjectId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `card-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * @param {import('fabric').Canvas} canvas
 * @param {{ activeFace: CardFace, snapshots: Record<CardFace, Record<string, unknown> | null>, projectName?: string, projectId?: string }} state
 * @param {CardProfile} profile
 * @returns {CardDocument}
 */
export function serializeDocument(canvas, state, profile) {
  if (!state.projectId?.trim()) {
    state.projectId = createProjectId();
  }
  return {
    id: state.projectId,
    version: DOCUMENT_VERSION,
    app: DOCUMENT_APP,
    projectName: state.projectName?.trim() || 'Untitled card',
    activeFace: state.activeFace,
    snapshots: {
      ...state.snapshots,
      [state.activeFace]: snapshotCanvas(canvas),
    },
    profile: normalizeProfile(profile),
    savedAt: new Date().toISOString(),
  };
}

/**
 * @param {string} raw
 * @returns {CardDocument}
 * @throws {Error} When the file is not a Card Atelier document.
 */
export function parseCardDocument(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('[Document] That file is not valid JSON');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('[Document] That file is not a card design');
  }

  const version = Number(parsed.version);
  const looksLikeOurs = parsed.app === DOCUMENT_APP || version === 1 || version === 2;
  if (!looksLikeOurs) {
    throw new Error('[Document] Import a Card Atelier design file');
  }
  if (!isCardFace(parsed.activeFace)) {
    throw new Error('[Document] The design file is missing a card face');
  }

  return {
    id: typeof parsed.id === 'string' && parsed.id.trim()
      ? parsed.id.trim().slice(0, 80)
      : createProjectId(),
    version: DOCUMENT_VERSION,
    app: DOCUMENT_APP,
    projectName: typeof parsed.projectName === 'string' && parsed.projectName.trim()
      ? parsed.projectName.trim()
      : 'Untitled card',
    activeFace: parsed.activeFace,
    snapshots: {
      front: isSnapshot(parsed.snapshots?.front) ? parsed.snapshots.front : null,
      back: isSnapshot(parsed.snapshots?.back) ? parsed.snapshots.back : null,
    },
    profile: normalizeProfile(parsed.profile),
    savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : new Date().toISOString(),
  };
}

/**
 * @returns {CardDocument}
 */
export function createEmptyDocument() {
  return {
    id: createProjectId(),
    version: DOCUMENT_VERSION,
    app: DOCUMENT_APP,
    projectName: 'Untitled card',
    activeFace: 'front',
    snapshots: { front: null, back: null },
    profile: createEmptyProfile(),
    savedAt: new Date().toISOString(),
  };
}

/**
 * @param {unknown} value
 * @returns {value is CardFace}
 */
export function isCardFace(value) {
  return value === 'front' || value === 'back';
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isSnapshot(value) {
  return Boolean(value && typeof value === 'object');
}

/**
 * @returns {{ background: string, objects: never[] }}
 */
export function emptyFaceSnapshot() {
  return {
    background: CARD_BACKGROUND,
    objects: [],
  };
}
