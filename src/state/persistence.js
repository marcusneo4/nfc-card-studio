import { CARD_BACKGROUND } from '../constants.js';
import { parseCardDocument, serializeDocument } from '../domain/document.js';
import { createEmptyProfile, normalizeProfile } from '../domain/profile.js';
import { stripStackedQrDuplicates } from '../tools/qr.js';

const STORAGE_KEY = 'card-atelier.document.v2';
const LEGACY_STORAGE_KEY = 'card-atelier.document.v1';
const ONBOARDING_KEY = 'card-atelier.onboarded.v1';

/**
 * @typedef {import('../domain/profile.js').CardProfile} CardProfile
 * @typedef {import('../domain/document.js').CardDocument} CardDocument
 */

/**
 * Saves both card faces and the NFC profile without changing the current selection.
 * @param {import('fabric').Canvas} canvas
 * @param {{ activeFace: 'front' | 'back', snapshots: Record<'front' | 'back', Record<string, unknown> | null>, projectName?: string }} state
 * @param {CardProfile} profile
 * @returns {void}
 * @throws {Error} When browser storage is unavailable.
 */
export function saveCardDocument(canvas, state, profile) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeDocument(canvas, state, profile)));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown storage error';
    throw new Error(`[Persistence] Failed to save locally: ${message}`);
  }
}

/**
 * Restores the latest local document into the editor.
 * @param {import('fabric').Canvas} canvas
 * @param {{ activeFace: 'front' | 'back', snapshots: Record<'front' | 'back', Record<string, unknown> | null>, projectName?: string }} state
 * @returns {Promise<{ restored: boolean, repaired: boolean, profile: CardProfile }>}
 * @throws {Error} When stored data cannot be parsed or loaded.
 */
export async function restoreCardDocument(canvas, state) {
  const rawDocument = localStorage.getItem(STORAGE_KEY) ?? migrateLegacyDocument();
  if (!rawDocument) {
    return { restored: false, repaired: false, profile: createEmptyProfile() };
  }

  try {
    const documentState = parseCardDocument(rawDocument);
    state.activeFace = documentState.activeFace;
    state.snapshots.front = documentState.snapshots.front;
    state.snapshots.back = documentState.snapshots.back;
    state.projectName = documentState.projectName;
    state.projectId = documentState.id;
    const repaired = repairStackedQrSnapshots(state);
    const activeSnapshot = state.snapshots[state.activeFace];
    if (activeSnapshot) {
      await canvas.loadFromJSON(activeSnapshot);
    } else {
      canvas.clear();
      canvas.backgroundColor = CARD_BACKGROUND;
    }
    canvas.requestRenderAll();
    return { restored: true, repaired, profile: normalizeProfile(documentState.profile) };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown storage error';
    throw new Error(`[Persistence] Failed to restore local design: ${message}`);
  }
}

/**
 * @param {CardDocument} documentState
 * @param {import('fabric').Canvas} canvas
 * @param {{ activeFace: 'front' | 'back', snapshots: Record<'front' | 'back', Record<string, unknown> | null>, projectName?: string }} state
 * @returns {Promise<CardProfile>}
 */
export async function applyImportedDocument(documentState, canvas, state) {
  state.activeFace = documentState.activeFace;
  state.snapshots.front = documentState.snapshots.front;
  state.snapshots.back = documentState.snapshots.back;
  state.projectName = documentState.projectName;
  state.projectId = documentState.id;
  repairStackedQrSnapshots(state);
  const activeSnapshot = state.snapshots[state.activeFace];
  if (activeSnapshot) {
    await canvas.loadFromJSON(activeSnapshot);
  } else {
    canvas.clear();
    canvas.backgroundColor = CARD_BACKGROUND;
  }
  canvas.requestRenderAll();
  return normalizeProfile(documentState.profile);
}

/**
 * Removes a leftover QR image that overlaps the tagged code.
 * @param {{ snapshots: Record<'front' | 'back', Record<string, unknown> | null> }} state
 * @returns {boolean}
 */
function repairStackedQrSnapshots(state) {
  let repaired = false;
  for (const face of ['front', 'back']) {
    const next = stripStackedQrDuplicates(state.snapshots[face]);
    if (next !== state.snapshots[face]) {
      state.snapshots[face] = next;
      repaired = true;
    }
  }
  return repaired;
}

/**
 * @returns {boolean}
 */
export function hasCompletedOnboarding() {
  return localStorage.getItem(ONBOARDING_KEY) === '1';
}

/**
 * @returns {void}
 */
export function markOnboardingComplete() {
  localStorage.setItem(ONBOARDING_KEY, '1');
}

/**
 * @returns {string | null}
 */
function migrateLegacyDocument() {
  const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!legacy) {
    return null;
  }
  try {
    const parsed = JSON.parse(legacy);
    const migrated = {
      ...parsed,
      version: 2,
      app: 'card-atelier',
      projectName: 'Untitled card',
      profile: createEmptyProfile(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    return JSON.stringify(migrated);
  } catch {
    return null;
  }
}
