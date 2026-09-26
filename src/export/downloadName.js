/**
 * @typedef {{ cardRole?: unknown, text?: unknown, fontSize?: unknown }} PrintTextSource
 * @typedef {{ nameText: string, subtext: string }} PrintedIdentity
 */

const CONTACT_ROLES = new Set(['email', 'phone', 'website', 'contactPair', 'monogram']);

/**
 * Reads the printed name and the subtitle under it. Contact lines are left out.
 * @param {PrintTextSource[]} objects
 * @returns {PrintedIdentity}
 */
export function readPrintedIdentity(objects) {
  const texts = objects.flatMap((object) => {
    const text = clean(object.text);
    if (!text || text.length < 2) {
      return [];
    }
    const role = typeof object.cardRole === 'string' ? object.cardRole : '';
    if (CONTACT_ROLES.has(role) || looksLikeContact(text)) {
      return [];
    }
    return [{ role, text, fontSize: Number(object.fontSize) || 0 }];
  });

  const named = texts.find((item) => item.role === 'name');
  const titled = texts.find((item) => item.role === 'title');
  const largest = texts
    .filter((item) => item.role !== 'title')
    .sort((left, right) => right.fontSize - left.fontSize)[0];

  return {
    nameText: named?.text || largest?.text || '',
    subtext: titled?.text || '',
  };
}

/**
 * Uses the painted name and subtitle, then the profile fields when a side has neither.
 * @param {PrintedIdentity} printed
 * @param {{ fullName?: string, title?: string }} profile
 * @returns {PrintedIdentity}
 */
export function resolveDownloadIdentity(printed, profile) {
  return {
    nameText: printed.nameText || clean(profile.fullName),
    subtext: printed.subtext || clean(profile.title),
  };
}

/**
 * Slug of the name, then the subtitle, then a stamp so repeated downloads do not collide.
 * @param {PrintedIdentity} identity
 * @returns {string}
 */
export function createDownloadStem(identity) {
  const name = slug(identity.nameText).slice(0, 48);
  const subtext = slug(identity.subtext).slice(0, 32);
  const label = [name, subtext].filter(Boolean).join('-') || 'nfc-card';
  const time = Date.now().toString(36).slice(-5);
  const random = Math.random().toString(36).slice(2, 5);
  return `${label}-${time}${random}`;
}

/**
 * @param {string} stem
 * @param {'front' | 'back'} face
 * @returns {string}
 */
export function faceDownloadName(stem, face) {
  return `${stem}-${face}.png`;
}

/**
 * @param {string} stem
 * @returns {string}
 */
export function sheetDownloadName(stem) {
  return `${stem}-print-sheet.png`;
}

/**
 * @param {string} stem
 * @returns {string}
 */
export function contactDownloadName(stem) {
  return `${stem}.vcf`;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * @param {string} text
 * @returns {boolean}
 */
function looksLikeContact(text) {
  return /@|\+?\d[\d\s()-]{6,}|https?:|www\./i.test(text);
}

/**
 * @param {string} value
 * @returns {string}
 */
function slug(value) {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
