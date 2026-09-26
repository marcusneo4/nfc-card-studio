/**
 * @typedef {import('./profile.js').CardProfile} CardProfile
 */

/**
 * Builds a vCard 3.0 payload for NFC encoding, QR codes, and downloads.
 * @param {CardProfile} profile
 * @returns {string}
 * @throws {Error} When the profile has no name, email, or phone.
 */
export function buildVCard(profile) {
  if (!profile.fullName && !profile.email && !profile.phone) {
    throw new Error('[Contact] Add a name, email, or phone before creating a contact card');
  }

  const lines = ['BEGIN:VCARD', 'VERSION:3.0'];
  if (profile.fullName) {
    lines.push(`FN:${escapeVCard(profile.fullName)}`);
    lines.push(`N:${formatNameField(profile.fullName)}`);
  }
  if (profile.company) {
    lines.push(`ORG:${escapeVCard(profile.company)}`);
  }
  if (profile.title) {
    lines.push(`TITLE:${escapeVCard(profile.title)}`);
  }
  if (profile.phone) {
    lines.push(`TEL;TYPE=CELL:${escapeVCard(profile.phone)}`);
  }
  if (profile.email) {
    lines.push(`EMAIL;TYPE=INTERNET:${escapeVCard(profile.email)}`);
  }
  if (profile.website) {
    lines.push(`URL:${escapeVCard(normalizeUrl(profile.website))}`);
  }
  if (profile.linkedin) {
    lines.push(`X-SOCIALPROFILE;TYPE=linkedin:${escapeVCard(normalizeUrl(profile.linkedin))}`);
  }
  if (profile.instagram) {
    lines.push(`X-SOCIALPROFILE;TYPE=instagram:${escapeVCard(normalizeUrl(profile.instagram))}`);
  }
  lines.push('END:VCARD');
  return lines.join('\r\n');
}

/**
 * @param {CardProfile} profile
 * @returns {string}
 */
export function vcardFilename(profile) {
  const slug = (profile.fullName || 'nfc-card')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${slug || 'nfc-card'}.vcf`;
}

/**
 * @param {string} website
 * @returns {string}
 */
export function normalizeUrl(website) {
  const trimmed = website.trim();
  if (!trimmed) {
    return '';
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

/**
 * @param {string} phone
 * @returns {string}
 */
export function whatsappUrl(phone) {
  const digits = phone.replace(/\D/g, '');
  return digits ? `https://wa.me/${digits}` : '';
}

/**
 * @param {string} value
 * @returns {string}
 */
function escapeVCard(value) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

/**
 * @param {string} fullName
 * @returns {string}
 */
function formatNameField(fullName) {
  const parts = fullName.split(/\s+/).filter(Boolean);
  const last = parts.length > 1 ? parts[parts.length - 1] : '';
  const first = parts.length > 1 ? parts.slice(0, -1).join(' ') : parts[0] ?? '';
  return `${escapeVCard(last)};${escapeVCard(first)};;;`;
}
