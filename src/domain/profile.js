/**
 * @typedef {Object} CardProfile
 * @property {string} fullName
 * @property {string} title
 * @property {string} company
 * @property {string} email
 * @property {string} phone
 * @property {string} website
 * @property {string} linkedin
 * @property {string} instagram
 * @property {'vcard' | 'website'} qrMode
 */

const PROFILE_FIELDS = [
  'fullName',
  'title',
  'company',
  'email',
  'phone',
  'website',
  'linkedin',
  'instagram',
];

/**
 * @returns {CardProfile}
 */
export function createEmptyProfile() {
  return {
    fullName: '',
    title: '',
    company: '',
    email: '',
    phone: '',
    website: '',
    linkedin: '',
    instagram: '',
    qrMode: 'vcard',
  };
}

/**
 * @param {unknown} raw
 * @returns {CardProfile}
 */
export function normalizeProfile(raw) {
  const profile = createEmptyProfile();
  if (!raw || typeof raw !== 'object') {
    return profile;
  }

  const record = /** @type {Record<string, unknown>} */ (raw);
  PROFILE_FIELDS.forEach((field) => {
    const value = record[field];
    if (typeof value === 'string') {
      profile[field] = value.trim();
    }
  });
  profile.qrMode = record.qrMode === 'website' ? 'website' : 'vcard';
  return profile;
}

/**
 * @param {CardProfile} profile
 * @returns {boolean}
 */
export function profileHasIdentity(profile) {
  return Boolean(profile.fullName || profile.email || profile.phone);
}

/**
 * @param {CardProfile} profile
 * @returns {string}
 */
export function profileInitials(profile) {
  const parts = profile.fullName.split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return 'CA';
  }
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/**
 * @param {CardProfile} profile
 * @returns {string}
 */
export function profileDisplayName(profile) {
  return profile.fullName || 'Your name';
}

/**
 * Writes profile values into objects tagged with `cardRole`.
 * @param {import('fabric').Canvas} canvas
 * @param {CardProfile} profile
 * @returns {number} Count of updated objects.
 */
export function applyProfileToCanvas(canvas, profile) {
  let updated = 0;
  canvas.getObjects().forEach((object) => {
    const role = typeof object.cardRole === 'string' ? object.cardRole : '';
    if (!role || !('text' in object)) {
      return;
    }

    const nextText = textForRole(role, profile, String(object.text ?? ''));
    if (!nextText || nextText === object.text) {
      return;
    }
    object.set({ text: nextText });
    object.setCoords();
    updated += 1;
  });
  if (updated > 0) {
    canvas.requestRenderAll();
  }
  return updated;
}

/**
 * Tags printed text that still shows the last saved identity, so an older face can be updated.
 * @param {import('fabric').Canvas} canvas
 * @param {CardProfile} profile
 * @returns {number}
 */
export function relinkPrintedText(canvas, profile) {
  let linked = 0;
  canvas.getObjects().forEach((object) => {
    if (object.cardRole || typeof object.text !== 'string') {
      return;
    }
    const role = inferCardRole(object.text, profile);
    if (!role) {
      return;
    }
    object.set({ cardRole: role });
    linked += 1;
  });
  return linked;
}

/**
 * @param {string} text
 * @param {CardProfile} profile
 * @returns {string}
 */
function inferCardRole(text, profile) {
  const value = text.trim();
  if (!value) {
    return '';
  }
  if (profile.fullName && value === profile.fullName.trim()) {
    return 'name';
  }
  if (profile.title && value === profile.title.trim()) {
    return 'title';
  }
  if (profile.company && value === profile.company.trim()) {
    return 'company';
  }
  if (profile.email && value === profile.email.trim()) {
    return 'email';
  }
  if (profile.phone && value === profile.phone.trim()) {
    return 'phone';
  }
  const website = formatWebsiteLabel(profile.website);
  if (website && value === website) {
    return 'website';
  }
  if (profile.fullName && value === profileInitials(profile)) {
    return 'monogram';
  }
  return '';
}

/**
 * @param {string} role
 * @param {CardProfile} profile
 * @param {string} currentText
 * @returns {string}
 */
function textForRole(role, profile, currentText) {
  if (role === 'name') {
    return formatName(profile.fullName, currentText);
  }
  if (role === 'title') {
    return profile.title;
  }
  if (role === 'company') {
    return profile.company;
  }
  if (role === 'email') {
    return profile.email;
  }
  if (role === 'phone') {
    return profile.phone;
  }
  if (role === 'website') {
    return formatWebsiteLabel(profile.website);
  }
  if (role === 'monogram') {
    return profileInitials(profile);
  }
  if (role === 'contactPair') {
    return formatContactPair(profile, currentText);
  }
  return '';
}

/**
 * Keeps a two-line name stack when the template already used a line break.
 * @param {string} fullName
 * @param {string} currentText
 * @returns {string}
 */
function formatName(fullName, currentText) {
  if (!fullName) {
    return '';
  }
  if (currentText.includes('\n') && !fullName.includes('\n')) {
    const parts = fullName.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]}\n${parts.slice(1).join(' ')}`;
    }
  }
  return fullName;
}

/**
 * @param {CardProfile} profile
 * @param {string} currentText
 * @returns {string}
 */
function formatContactPair(profile, currentText) {
  const parts = [profile.email, profile.phone].filter(Boolean);
  if (parts.length === 0) {
    return '';
  }
  if (currentText.includes('\n')) {
    return parts.join('\n');
  }
  if (currentText.includes(' / ')) {
    return parts.join('   /   ');
  }
  return parts.join('  ·  ');
}

/**
 * @param {string} website
 * @returns {string}
 */
function formatWebsiteLabel(website) {
  if (!website) {
    return '';
  }
  return website.replace(/^https?:\/\//, '').replace(/\/$/, '');
}
