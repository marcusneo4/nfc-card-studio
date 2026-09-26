import { FabricObject } from 'fabric';

/** Extra Fabric fields stored with each card object. */
export const DOCUMENT_PROPERTIES = ['cardRole', 'cardKind', 'qrPayload'];

FabricObject.customProperties = DOCUMENT_PROPERTIES;

/**
 * Serializes the live canvas, including NFC object metadata.
 * @param {import('fabric').Canvas} canvas
 * @returns {Record<string, unknown>}
 */
export function snapshotCanvas(canvas) {
  return canvas.toJSON(DOCUMENT_PROPERTIES);
}

/**
 * @param {import('fabric').Canvas} canvas
 * @returns {boolean}
 */
export function canvasHasUserContent(canvas) {
  return canvas.getObjects().length > 0 || Boolean(canvas.backgroundImage);
}

/**
 * @param {Record<string, unknown> | null | undefined} snapshot
 * @returns {boolean}
 */
export function snapshotHasContent(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') {
    return false;
  }
  const objects = snapshot.objects;
  return Boolean(snapshot.backgroundImage) || (Array.isArray(objects) && objects.length > 0);
}

/**
 * True when a saved face has text or a QR tied to the profile.
 * @param {Record<string, unknown> | null | undefined} snapshot
 * @returns {boolean}
 */
export function snapshotLinksProfile(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || !Array.isArray(snapshot.objects)) {
    return false;
  }
  return snapshot.objects.some((object) => objectLinksProfile(object));
}

/**
 * @param {unknown} object
 * @returns {boolean}
 */
function objectLinksProfile(object) {
  if (!object || typeof object !== 'object') {
    return false;
  }
  const record = /** @type {{ cardRole?: unknown, cardKind?: unknown }} */ (object);
  return Boolean(record.cardRole) || record.cardKind === 'qr' || record.cardKind === 'qr-slot';
}
