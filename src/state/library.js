import { parseCardDocument } from '../domain/document.js';

const LIBRARY_KEY = 'card-atelier.library.v1';
const MAX_SAVED_CARDS = 8;

/**
 * @typedef {import('../domain/document.js').CardDocument} CardDocument
 * @typedef {{ id: string, projectName: string, savedAt: string }} CardSummary
 */

/**
 * Saved cards other than the one open in the studio.
 * @returns {CardSummary[]}
 */
export function listCardSummaries() {
  return readLibrary()
    .map((card) => ({
      id: card.id,
      projectName: card.projectName,
      savedAt: card.savedAt,
    }))
    .sort((left, right) => right.savedAt.localeCompare(left.savedAt));
}

/**
 * @param {string} id
 * @returns {CardDocument | null}
 */
export function peekSavedCard(id) {
  return readLibrary().find((card) => card.id === id) ?? null;
}

/**
 * Keeps a card that is no longer the open document.
 * The newest eight cards stay. An older copy of the same card is replaced.
 * @param {CardDocument} documentState
 * @returns {{ droppedName: string | null }}
 * @throws {Error} When browser storage cannot hold another card.
 */
export function archiveCard(documentState) {
  const cards = readLibrary().filter((card) => card.id !== documentState.id);
  cards.unshift(documentState);
  let droppedName = null;
  while (cards.length > MAX_SAVED_CARDS) {
    const dropped = cards.pop();
    droppedName = dropped?.projectName ?? droppedName;
  }
  writeLibrary(cards);
  return { droppedName };
}

/**
 * @param {string} id
 * @returns {void}
 */
export function removeSavedCard(id) {
  writeLibrary(readLibrary().filter((card) => card.id !== id));
}

/**
 * @returns {CardDocument[]}
 */
function readLibrary() {
  const raw = localStorage.getItem(LIBRARY_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.flatMap((item) => {
      try {
        return [parseCardDocument(JSON.stringify(item))];
      } catch {
        return [];
      }
    });
  } catch {
    return [];
  }
}

/**
 * @param {CardDocument[]} cards
 * @returns {void}
 * @throws {Error} When browser storage rejects the write.
 */
function writeLibrary(cards) {
  try {
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(cards));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown storage error';
    throw new Error(`[Library] This browser is out of room for saved cards: ${message}`);
  }
}
