import { FabricImage, Rect } from 'fabric';
import QRCode from 'qrcode';
import { buildVCard, normalizeUrl } from '../domain/vcard.js';

/**
 * @typedef {import('../domain/profile.js').CardProfile} CardProfile
 */

/**
 * @param {CardProfile} profile
 * @returns {string}
 * @throws {Error} When the chosen QR payload is empty.
 */
export function buildQrPayload(profile) {
  if (profile.qrMode === 'website') {
    if (!profile.website) {
      throw new Error('[QR] Add a website before encoding a website QR code');
    }
    return normalizeUrl(profile.website);
  }
  return buildVCard(profile);
}

/**
 * @param {import('../domain/profile.js').CardProfile} profile
 * @returns {boolean}
 */
export function canBuildQrPayload(profile) {
  if (profile.qrMode === 'website') {
    return Boolean(profile.website);
  }
  return Boolean(profile.fullName || profile.email || profile.phone);
}

/**
 * @param {string} payload
 * @param {{ dark?: string, light?: string, size?: number }} [options]
 * @returns {Promise<string>}
 */
export async function renderQrDataUrl(payload, options = {}) {
  try {
    return await QRCode.toDataURL(payload, {
      width: options.size ?? 512,
      margin: 1,
      errorCorrectionLevel: payload.length > 180 ? 'M' : 'H',
      color: {
        dark: options.dark ?? '#11120F',
        light: options.light ?? '#F7F3EA',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown QR error';
    throw new Error(`[QR] Could not build a QR code: ${message}`);
  }
}

/**
 * Places or refreshes QR objects so the printed back matches the tap payload.
 * @param {import('fabric').Canvas} canvas
 * @param {CardProfile} profile
 * @param {{ left?: number, top?: number, size?: number }} [placement]
 * @returns {Promise<number>}
 */
export async function syncQrObjects(canvas, profile, placement = {}) {
  if (!canBuildQrPayload(profile)) {
    return 0;
  }
  const payload = buildQrPayload(profile);
  const dataUrl = await renderQrDataUrl(payload);
  const targets = canvas.getObjects().filter((object) => object.cardKind === 'qr' || object.cardKind === 'qr-slot');

  if (targets.length === 0) {
    const size = placement.size ?? 220;
    await placeQrImage(canvas, dataUrl, profile.qrMode, {
      left: placement.left ?? 70,
      top: placement.top ?? 70,
      width: size,
      height: size,
    });
    removeStackedQrDuplicates(canvas);
    return 1;
  }

  for (const target of targets) {
    const bounds = {
      left: target.left ?? 70,
      top: target.top ?? 70,
      width: target.getScaledWidth(),
      height: target.getScaledHeight(),
    };
    const layerIndex = canvas.getObjects().indexOf(target);
    canvas.remove(target);
    const image = await placeQrImage(canvas, dataUrl, profile.qrMode, bounds);
    if (layerIndex >= 0) {
      canvas.moveObjectTo(image, layerIndex);
    }
  }
  removeStackedQrDuplicates(canvas);
  canvas.requestRenderAll();
  return targets.length;
}

/**
 * Drops an older QR image that was saved before its kind was stored and now sits under the real code.
 * @param {Record<string, unknown> | null | undefined} snapshot
 * @returns {Record<string, unknown> | null | undefined}
 */
export function stripStackedQrDuplicates(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || !Array.isArray(snapshot.objects)) {
    return snapshot;
  }
  const qrBoxes = snapshot.objects
    .filter((object) => object.cardKind === 'qr')
    .map((object) => boundsOf(object));
  if (qrBoxes.length === 0) {
    return snapshot;
  }
  const objects = snapshot.objects.filter((object) => !isStackedQrDuplicate(object, qrBoxes));
  if (objects.length === snapshot.objects.length) {
    return snapshot;
  }
  return { ...snapshot, objects };
}

/**
 * @param {import('fabric').Canvas} canvas
 * @returns {number}
 */
export function removeStackedQrDuplicates(canvas) {
  const qrBoxes = canvas.getObjects()
    .filter((object) => object.cardKind === 'qr')
    .map((object) => boundsOf(object));
  if (qrBoxes.length === 0) {
    return 0;
  }
  const leftovers = canvas.getObjects().filter((object) => isStackedQrDuplicate(object, qrBoxes));
  leftovers.forEach((object) => canvas.remove(object));
  return leftovers.length;
}

/**
 * @param {object} object
 * @param {{ left: number, top: number, width: number, height: number }[]} qrBoxes
 * @returns {boolean}
 */
function isStackedQrDuplicate(object, qrBoxes) {
  if (object.cardKind || object.cardRole) {
    return false;
  }
  if (String(object.type || '').toLowerCase() !== 'image') {
    return false;
  }
  const box = boundsOf(object);
  if (box.width <= 0 || box.height <= 0) {
    return false;
  }
  const aspect = box.width / box.height;
  if (aspect < 0.85 || aspect > 1.15) {
    return false;
  }
  return qrBoxes.some((qrBox) => overlapRatio(box, qrBox) > 0.45);
}

/**
 * @param {object} object
 * @returns {{ left: number, top: number, width: number, height: number }}
 */
function boundsOf(object) {
  const width = typeof object.getScaledWidth === 'function'
    ? object.getScaledWidth()
    : (object.width || 0) * (object.scaleX || 1);
  const height = typeof object.getScaledHeight === 'function'
    ? object.getScaledHeight()
    : (object.height || 0) * (object.scaleY || 1);
  return {
    left: object.left || 0,
    top: object.top || 0,
    width,
    height,
  };
}

/**
 * @param {{ left: number, top: number, width: number, height: number }} box
 * @param {{ left: number, top: number, width: number, height: number }} other
 * @returns {number}
 */
function overlapRatio(box, other) {
  const width = Math.max(0, Math.min(box.left + box.width, other.left + other.width) - Math.max(box.left, other.left));
  const height = Math.max(0, Math.min(box.top + box.height, other.top + other.height) - Math.max(box.top, other.top));
  const area = box.width * box.height;
  if (area <= 0) {
    return 0;
  }
  return (width * height) / area;
}

/**
 * @param {import('fabric').Canvas} canvas
 * @param {number} left
 * @param {number} top
 * @param {number} size
 * @returns {Rect}
 */
export function addQrSlot(canvas, left, top, size) {
  const slot = new Rect({
    left,
    top,
    width: size,
    height: size,
    fill: '#f7f3ea',
    rx: 18,
    ry: 18,
  });
  slot.set({ cardKind: 'qr-slot' });
  canvas.add(slot);
  return slot;
}

/**
 * @param {import('fabric').Canvas} canvas
 * @param {string} dataUrl
 * @param {'vcard' | 'website'} qrPayload
 * @param {{ left: number, top: number, width: number, height: number }} bounds
 * @returns {Promise<FabricImage>}
 */
async function placeQrImage(canvas, dataUrl, qrPayload, bounds) {
  const image = await FabricImage.fromURL(dataUrl);
  const size = Math.min(bounds.width, bounds.height);
  image.set({
    originX: 'left',
    originY: 'top',
    left: bounds.left,
    top: bounds.top,
  });
  image.scaleToWidth(size);
  image.set({ cardKind: 'qr', qrPayload });
  canvas.add(image);
  canvas.setActiveObject?.(image);
  canvas.requestRenderAll();
  return image;
}
