import { Ellipse, FabricImage, IText, Rect } from 'fabric';
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  MAX_FILL_ZOOM,
  MAX_IMAGE_ZOOM,
  MIN_FILL_ZOOM,
  MIN_IMAGE_ZOOM,
} from '../constants.js';

/** Families loaded from Google Fonts. Names must match the stylesheet. */
export const FONTS = [
  'Manrope',
  'DM Sans',
  'Inter',
  'Archivo',
  'Outfit',
  'Montserrat',
  'Space Grotesk',
  'Syne',
  'Fraunces',
  'Playfair Display',
  'Libre Baskerville',
  'Cormorant Garamond',
  'Bebas Neue',
  'IBM Plex Mono',
];

/** Solid fills offered as one-tap presets. Fourteen values. */
export const COLOR_PRESETS = [
  '#1A1A1A',
  '#F4F4F5',
  '#0F2744',
  '#1E3A5F',
  '#C4A35A',
  '#8C8C8C',
  '#B42318',
  '#0E7490',
  '#166534',
  '#7C3AED',
  '#9A3412',
  '#BE123C',
  '#334155',
  '#E7E5E4',
];

/**
 * @param {import('fabric').Canvas} canvas
 * @param {string} text
 * @param {{ left: number, top: number, fontSize: number, fill: string, fontFamily?: string, originX?: string, originY?: string, cardRole?: string }} placement
 * @returns {IText}
 */
export function addText(canvas, text, placement) {
  const object = new IText(text, {
    left: placement.left,
    top: placement.top,
    originX: placement.originX ?? 'left',
    originY: placement.originY ?? 'top',
    fontFamily: placement.fontFamily ?? 'Manrope',
    fontSize: placement.fontSize,
    fill: placement.fill,
    editable: true,
  });
  if (placement.cardRole) {
    object.set({ cardRole: placement.cardRole });
  }
  canvas.add(object);
  if (typeof canvas.setActiveObject === 'function') {
    canvas.setActiveObject(object);
  }
  canvas.requestRenderAll();
  return object;
}

/**
 * Inserts a name placeholder.
 * @param {import('fabric').Canvas} canvas
 * @param {string} fill
 * @returns {IText}
 */
export function addNameField(canvas, fill, name = 'Name') {
  return addText(canvas, name, { left: 72, top: 150, fontSize: 92, fill, cardRole: 'name' });
}

/**
 * Inserts an email placeholder.
 * @param {import('fabric').Canvas} canvas
 * @param {string} fill
 * @returns {IText}
 */
export function addEmailField(canvas, fill, email = 'name@email.com') {
  return addText(canvas, email, { left: 72, top: 270, fontSize: 40, fill, cardRole: 'email' });
}

/**
 * Inserts a phone placeholder.
 * @param {import('fabric').Canvas} canvas
 * @param {string} fill
 * @returns {IText}
 */
export function addPhoneField(canvas, fill, phone = '+65 8123 4567') {
  return addText(canvas, phone, { left: 72, top: 340, fontSize: 40, fill, cardRole: 'phone' });
}

/**
 * Inserts a job-title placeholder.
 * @param {import('fabric').Canvas} canvas
 * @param {string} fill
 * @param {string} [title]
 * @returns {IText}
 */
export function addTitleField(canvas, fill, title = 'Title') {
  return addText(canvas, title, { left: 72, top: 250, fontSize: 32, fill, cardRole: 'title' });
}

/**
 * Adds a rectangle using the current fill.
 * @param {import('fabric').Canvas} canvas
 * @param {string} fill
 * @returns {Rect}
 */
export function addRectangle(canvas, fill) {
  const object = new Rect({
    left: 96,
    top: 96,
    originX: 'left',
    originY: 'top',
    width: 320,
    height: 180,
    fill,
    rx: 12,
    ry: 12,
  });
  canvas.add(object);
  canvas.setActiveObject(object);
  canvas.requestRenderAll();
  return object;
}

/**
 * Adds an ellipse using the current fill.
 * @param {import('fabric').Canvas} canvas
 * @param {string} fill
 * @returns {Ellipse}
 */
export function addEllipse(canvas, fill) {
  const object = new Ellipse({
    left: 120,
    top: 140,
    originX: 'left',
    originY: 'top',
    rx: 140,
    ry: 90,
    fill,
  });
  canvas.add(object);
  canvas.setActiveObject(object);
  canvas.requestRenderAll();
  return object;
}

/**
 * Reads a local file as a data URL so export does not depend on blob CORS.
 * @param {File} file
 * @returns {Promise<string>}
 * @throws {Error} When the file is missing or cannot be read.
 */
export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('[ImageImport] No file was selected'));
      return;
    }

    const reader = new FileReader();
    reader.addEventListener('load', () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('[ImageImport] FileReader did not return a data URL'));
        return;
      }
      resolve(reader.result);
    });
    reader.addEventListener('error', () => {
      const detail = reader.error?.message ?? 'unknown read error';
      reject(new Error(`[ImageImport] Failed to read file: ${detail}`));
    });
    reader.readAsDataURL(file);
  });
}

/**
 * Places an uploaded image on the active face as a movable object.
 * @param {import('fabric').Canvas} canvas
 * @param {File} file
 * @returns {Promise<FabricImage>}
 * @throws {Error} When the file cannot be read or decoded.
 */
export async function addImageObject(canvas, file) {
  try {
    const dataUrl = await readFileAsDataUrl(file);
    const image = await FabricImage.fromURL(dataUrl);
    image.set({ originX: 'left', originY: 'top', left: 80, top: 80 });
    const maxWidth = CARD_WIDTH * 0.72;
    if (image.width > maxWidth) {
      image.scaleToWidth(maxWidth);
    }
    canvas.add(image);
    canvas.setActiveObject(image);
    canvas.requestRenderAll();
    return image;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`[ImageImport] Failed to add image: ${message}`);
  }
}

/**
 * Places an uploaded logo at a practical default size near the card corner.
 * @param {import('fabric').Canvas} canvas
 * @param {File} file
 * @returns {Promise<FabricImage>}
 * @throws {Error} When the file cannot be read or decoded.
 */
export async function addLogoObject(canvas, file) {
  try {
    const dataUrl = await readFileAsDataUrl(file);
    const logo = await FabricImage.fromURL(dataUrl);
    logo.set({ originX: 'left', originY: 'top', left: 70, top: 70 });
    const maxWidth = CARD_WIDTH * 0.28;
    if (logo.width > maxWidth) {
      logo.scaleToWidth(maxWidth);
    }
    canvas.add(logo);
    canvas.setActiveObject(logo);
    canvas.requestRenderAll();
    return logo;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`[LogoImport] Failed to add logo: ${message}`);
  }
}

/**
 * Sets a full-bleed background from a local image, stored as a data URL.
 * @param {import('fabric').Canvas} canvas
 * @param {File} file
 * @returns {Promise<void>}
 * @throws {Error} When the file cannot be read or decoded.
 */
export async function setBackgroundImage(canvas, file) {
  try {
    const dataUrl = await readFileAsDataUrl(file);
    const image = await FabricImage.fromURL(dataUrl);
    const scale = Math.max(CARD_WIDTH / image.width, CARD_HEIGHT / image.height);
    image.set({
      originX: 'center',
      originY: 'center',
      left: CARD_WIDTH / 2,
      top: CARD_HEIGHT / 2,
      scaleX: scale,
      scaleY: scale,
    });
    canvas.backgroundImage = image;
    canvas.requestRenderAll();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`[ImageImport] Failed to set background: ${message}`);
  }
}

/**
 * Reads the active photo-fill zoom relative to a cover fit.
 * @param {import('fabric').Canvas} canvas
 * @returns {number | null} Null when the card has no background image.
 */
export function getBackgroundFillZoom(canvas) {
  const image = canvas.backgroundImage;
  if (!isFabricImage(image)) {
    return null;
  }

  const coverScale = coverScaleFor(image);
  if (!coverScale) {
    return null;
  }
  return (image.scaleX ?? coverScale) / coverScale;
}

/**
 * Expands or contracts the photo fill around the card center.
 * `zoom` is relative to cover: 1 fills the card, below 1 zooms out.
 * @param {import('fabric').Canvas} canvas
 * @param {number} zoom
 * @returns {boolean} False when the card has no background image.
 */
export function setBackgroundFillZoom(canvas, zoom) {
  const image = canvas.backgroundImage;
  if (!isFabricImage(image)) {
    return false;
  }

  const coverScale = coverScaleFor(image);
  if (!coverScale) {
    return false;
  }

  const nextZoom = clamp(zoom, MIN_FILL_ZOOM, MAX_FILL_ZOOM);
  image.set({
    originX: 'center',
    originY: 'center',
    left: CARD_WIDTH / 2,
    top: CARD_HEIGHT / 2,
    scaleX: coverScale * nextZoom,
    scaleY: coverScale * nextZoom,
  });
  canvas.requestRenderAll();
  return true;
}

/**
 * Crops the selected image to a rectangle in source pixels.
 * @param {import('fabric').Canvas} canvas
 * @param {{ x: number, y: number, width: number, height: number }} crop
 * @returns {boolean} False when no image is selected.
 */
export function cropSelectedImage(canvas, crop) {
  const image = canvas.getActiveObject();
  if (!isFabricImage(image)) {
    return false;
  }

  const original = image.getOriginalSize();
  const sourceWidth = Math.max(original.width, 1);
  const sourceHeight = Math.max(original.height, 1);
  const cropX = clamp(Math.round(crop.x), 0, sourceWidth - 1);
  const cropY = clamp(Math.round(crop.y), 0, sourceHeight - 1);
  const width = clamp(Math.round(crop.width), 1, sourceWidth - cropX);
  const height = clamp(Math.round(crop.height), 1, sourceHeight - cropY);
  const shift = cropOriginShift(image, cropX, cropY);

  image.set({
    cropX,
    cropY,
    width,
    height,
    left: (image.left ?? 0) + shift.x,
    top: (image.top ?? 0) + shift.y,
  });
  image.setCoords();
  canvas.requestRenderAll();
  return true;
}

/**
 * Moves the active object by canvas pixels.
 * @param {import('fabric').Canvas} canvas
 * @param {number} deltaX
 * @param {number} deltaY
 * @returns {boolean} False when nothing is selected.
 */
export function nudgeSelection(canvas, deltaX, deltaY) {
  const object = canvas.getActiveObject();
  if (!object || object.isEditing) {
    return false;
  }

  object.set({
    left: (object.left ?? 0) + deltaX,
    top: (object.top ?? 0) + deltaY,
  });
  object.setCoords();
  canvas.requestRenderAll();
  return true;
}

/**
 * Paints the active text or shape.
 * @param {import('fabric').Canvas} canvas
 * @param {string} fill
 * @returns {boolean}
 */
export function setSelectionFill(canvas, fill) {
  const object = canvas.getActiveObject();
  if (!object || !objectSupportsFill(object)) {
    return false;
  }

  object.set({ fill });
  canvas.requestRenderAll();
  return true;
}

/**
 * Changes the font of the active text object.
 * @param {import('fabric').Canvas} canvas
 * @param {string} fontFamily
 * @returns {boolean}
 */
export function setSelectionFont(canvas, fontFamily) {
  const object = canvas.getActiveObject();
  if (!object || !isTextObject(object)) {
    return false;
  }

  object.set({ fontFamily });
  canvas.requestRenderAll();
  return true;
}

/**
 * Sets a uniform scale on the selected image. `scale` is a ratio, 1 = 100%.
 * @param {import('fabric').Canvas} canvas
 * @param {number} scale
 * @returns {boolean}
 */
export function setSelectedImageScale(canvas, scale) {
  const object = canvas.getActiveObject();
  if (!object || object.type !== 'image') {
    return false;
  }

  const nextScale = clamp(scale, MIN_IMAGE_ZOOM, MAX_IMAGE_ZOOM);
  object.set({ scaleX: nextScale, scaleY: nextScale });
  object.setCoords();
  canvas.requestRenderAll();
  return true;
}

/**
 * Returns editable transform values for the active object.
 * @param {import('fabric').Canvas} canvas
 * @returns {{ x: number, y: number, width: number, height: number, angle: number } | null}
 */
export function getSelectionTransform(canvas) {
  const object = canvas.getActiveObject();
  if (!object) {
    return null;
  }
  return {
    x: Math.round(object.left ?? 0),
    y: Math.round(object.top ?? 0),
    width: Math.round(object.getScaledWidth()),
    height: Math.round(object.getScaledHeight()),
    angle: normalizeAngle(object.angle ?? 0),
  };
}

/**
 * Applies one precise transform value to the active object.
 * @param {import('fabric').Canvas} canvas
 * @param {'x' | 'y' | 'width' | 'height' | 'angle'} property
 * @param {number} value
 * @param {boolean} preserveAspectRatio
 * @returns {boolean}
 */
export function setSelectionTransform(canvas, property, value, preserveAspectRatio = true) {
  const object = canvas.getActiveObject();
  if (!object || !Number.isFinite(value)) {
    return false;
  }

  if (property === 'x' || property === 'y') {
    object.set({ [property === 'x' ? 'left' : 'top']: value });
  } else if (property === 'angle') {
    object.rotate(value);
  } else {
    const currentWidth = Math.max(object.getScaledWidth(), 1);
    const currentHeight = Math.max(object.getScaledHeight(), 1);
    if (property === 'width') {
      const nextScaleX = (object.scaleX ?? 1) * (Math.max(value, 1) / currentWidth);
      object.set({ scaleX: nextScaleX });
      if (preserveAspectRatio) {
        object.set({ scaleY: (object.scaleY ?? 1) * (Math.max(value, 1) / currentWidth) });
      }
    } else {
      const nextScaleY = (object.scaleY ?? 1) * (Math.max(value, 1) / currentHeight);
      object.set({ scaleY: nextScaleY });
      if (preserveAspectRatio) {
        object.set({ scaleX: (object.scaleX ?? 1) * (Math.max(value, 1) / currentHeight) });
      }
    }
  }

  object.setCoords();
  canvas.requestRenderAll();
  return true;
}

/**
 * Flips the active object across one axis.
 * @param {import('fabric').Canvas} canvas
 * @param {'horizontal' | 'vertical'} direction
 * @returns {boolean}
 */
export function flipSelection(canvas, direction) {
  const object = canvas.getActiveObject();
  if (!object) {
    return false;
  }
  object.set(direction === 'horizontal' ? { flipX: !object.flipX } : { flipY: !object.flipY });
  object.setCoords();
  canvas.requestRenderAll();
  return true;
}

/**
 * Changes a supported property on the active text object.
 * @param {import('fabric').Canvas} canvas
 * @param {'fontSize' | 'fontWeight' | 'textAlign' | 'charSpacing' | 'lineHeight' | 'fontStyle'} property
 * @param {number | string} value
 * @returns {boolean}
 */
export function setSelectionTextProperty(canvas, property, value) {
  const object = canvas.getActiveObject();
  if (!object || !isTextObject(object)) {
    return false;
  }

  object.set({ [property]: value });
  object.setCoords();
  canvas.requestRenderAll();
  return true;
}

/**
 * Changes the opacity of the active object.
 * @param {import('fabric').Canvas} canvas
 * @param {number} opacity
 * @returns {boolean}
 */
export function setSelectionOpacity(canvas, opacity) {
  const object = canvas.getActiveObject();
  if (!object) {
    return false;
  }

  object.set({ opacity: Math.min(1, Math.max(0.05, opacity)) });
  canvas.requestRenderAll();
  return true;
}

/**
 * Duplicates the active object with a visible offset.
 * @param {import('fabric').Canvas} canvas
 * @returns {Promise<boolean>}
 */
export async function duplicateSelection(canvas) {
  const object = canvas.getActiveObject();
  if (!object) {
    return false;
  }

  const clone = await object.clone();
  clone.set({
    left: (object.left ?? 0) + 24,
    top: (object.top ?? 0) + 24,
    evented: true,
  });
  canvas.add(clone);
  canvas.setActiveObject(clone);
  clone.setCoords();
  canvas.requestRenderAll();
  return true;
}

/**
 * Removes the active object.
 * @param {import('fabric').Canvas} canvas
 * @returns {boolean}
 */
export function deleteSelection(canvas) {
  const object = canvas.getActiveObject();
  if (!object) {
    return false;
  }

  canvas.remove(object);
  canvas.discardActiveObject();
  canvas.requestRenderAll();
  return true;
}

/**
 * Toggles movement and transform locks on the active object.
 * @param {import('fabric').Canvas} canvas
 * @returns {boolean | null} New lock state, or null when nothing is selected.
 */
export function toggleSelectionLock(canvas) {
  const object = canvas.getActiveObject();
  if (!object) {
    return null;
  }

  const locked = !object.lockMovementX;
  object.set({
    lockMovementX: locked,
    lockMovementY: locked,
    lockScalingX: locked,
    lockScalingY: locked,
    lockRotation: locked,
    hasControls: !locked,
  });
  canvas.requestRenderAll();
  return locked;
}

/**
 * Moves the active object one layer.
 * @param {import('fabric').Canvas} canvas
 * @param {'forward' | 'backward' | 'front' | 'back'} direction
 * @returns {boolean}
 */
export function moveSelectionLayer(canvas, direction) {
  const object = canvas.getActiveObject();
  if (!object) {
    return false;
  }

  if (direction === 'front') {
    canvas.bringObjectToFront(object);
  } else if (direction === 'back') {
    canvas.sendObjectToBack(object);
  } else if (direction === 'forward') {
    canvas.bringObjectForward(object);
  } else {
    canvas.sendObjectBackwards(object);
  }
  canvas.requestRenderAll();
  return true;
}

/**
 * Aligns the active object to a card edge or center.
 * @param {import('fabric').Canvas} canvas
 * @param {'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'} alignment
 * @returns {boolean}
 */
export function alignSelectionToCard(canvas, alignment) {
  const object = canvas.getActiveObject();
  if (!object) {
    return false;
  }

  const bounds = object.getBoundingRect();
  const positions = {
    left: { left: (object.left ?? 0) - bounds.left },
    center: { left: (object.left ?? 0) + CARD_WIDTH / 2 - (bounds.left + bounds.width / 2) },
    right: { left: (object.left ?? 0) + CARD_WIDTH - (bounds.left + bounds.width) },
    top: { top: (object.top ?? 0) - bounds.top },
    middle: { top: (object.top ?? 0) + CARD_HEIGHT / 2 - (bounds.top + bounds.height / 2) },
    bottom: { top: (object.top ?? 0) + CARD_HEIGHT - (bounds.top + bounds.height) },
  };
  const position = positions[alignment];
  if (!position) {
    return false;
  }

  object.set(position);
  object.setCoords();
  canvas.requestRenderAll();
  return true;
}

/**
 * Sets a solid background and removes any background image.
 * @param {import('fabric').Canvas} canvas
 * @param {string} color
 * @returns {void}
 */
export function setCanvasBackgroundColor(canvas, color) {
  canvas.backgroundImage = undefined;
  canvas.backgroundColor = color;
  canvas.requestRenderAll();
}

/**
 * Replaces the text content of the active text object.
 * @param {import('fabric').Canvas} canvas
 * @param {string} text
 * @returns {boolean}
 */
export function setSelectionText(canvas, text) {
  const object = canvas.getActiveObject();
  if (!object || !isTextObject(object)) {
    return false;
  }
  object.set({ text });
  object.setCoords();
  canvas.requestRenderAll();
  return true;
}

/**
 * Toggles italic on the active text object.
 * @param {import('fabric').Canvas} canvas
 * @returns {boolean | null}
 */
export function toggleSelectionItalic(canvas) {
  const object = canvas.getActiveObject();
  if (!object || !isTextObject(object)) {
    return null;
  }
  const italic = object.fontStyle !== 'italic';
  object.set({ fontStyle: italic ? 'italic' : 'normal' });
  canvas.requestRenderAll();
  return italic;
}

/**
 * Paints a stroke on the active shape.
 * @param {import('fabric').Canvas} canvas
 * @param {string} stroke
 * @returns {boolean}
 */
export function setSelectionStroke(canvas, stroke) {
  const object = canvas.getActiveObject();
  if (!object || !objectSupportsStroke(object)) {
    return false;
  }
  object.set({ stroke });
  canvas.requestRenderAll();
  return true;
}

/**
 * @param {import('fabric').Canvas} canvas
 * @param {number} width
 * @returns {boolean}
 */
export function setSelectionStrokeWidth(canvas, width) {
  const object = canvas.getActiveObject();
  if (!object || !objectSupportsStroke(object)) {
    return false;
  }
  object.set({ strokeWidth: Math.max(0, width) });
  object.setCoords();
  canvas.requestRenderAll();
  return true;
}

/**
 * @param {import('fabric').Canvas} canvas
 * @param {number} radius
 * @returns {boolean}
 */
export function setSelectionCornerRadius(canvas, radius) {
  const object = canvas.getActiveObject();
  if (!object || object.type !== 'rect') {
    return false;
  }
  const next = Math.max(0, radius);
  object.set({ rx: next, ry: next });
  canvas.requestRenderAll();
  return true;
}

/**
 * Assigns an NFC field role so profile updates can rewrite this object.
 * @param {import('fabric').Canvas} canvas
 * @param {string} role
 * @returns {boolean}
 */
export function setSelectionCardRole(canvas, role) {
  const object = canvas.getActiveObject();
  if (!object || !isTextObject(object)) {
    return false;
  }
  object.set({ cardRole: role || undefined });
  return true;
}

/**
 * @param {import('fabric').FabricObject} object
 * @returns {boolean}
 */
export function isTextObject(object) {
  return object.type === 'i-text' || object.type === 'text' || object.type === 'textbox';
}

/**
 * @param {import('fabric').FabricObject} object
 * @returns {boolean}
 */
function objectSupportsFill(object) {
  return isTextObject(object) || object.type === 'rect' || object.type === 'ellipse' || object.type === 'circle';
}

/**
 * @param {import('fabric').FabricObject} object
 * @returns {boolean}
 */
function objectSupportsStroke(object) {
  return object.type === 'rect' || object.type === 'ellipse' || object.type === 'circle';
}

/**
 * @param {number} angle
 * @returns {number}
 */
function normalizeAngle(angle) {
  const normalized = Math.round(angle % 360);
  return normalized < 0 ? normalized + 360 : normalized;
}

/**
 * @param {unknown} value
 * @returns {value is import('fabric').FabricImage}
 */
function isFabricImage(value) {
  return Boolean(value && typeof value === 'object' && 'type' in value && value.type === 'image');
}

/**
 * @param {import('fabric').FabricImage} image
 * @returns {number}
 */
function coverScaleFor(image) {
  const width = image.width || image.getOriginalSize().width;
  const height = image.height || image.getOriginalSize().height;
  if (!width || !height) {
    return 0;
  }
  return Math.max(CARD_WIDTH / width, CARD_HEIGHT / height);
}

/**
 * Keeps the newly cropped pixels in the same place on the card.
 * @param {import('fabric').FabricImage} image
 * @param {number} cropX
 * @param {number} cropY
 * @returns {{ x: number, y: number }}
 */
function cropOriginShift(image, cropX, cropY) {
  if (image.originX !== 'left' || image.originY !== 'top') {
    return { x: 0, y: 0 };
  }

  const radians = ((image.angle ?? 0) * Math.PI) / 180;
  const localX = (cropX - (image.cropX || 0)) * (image.scaleX || 1) * (image.flipX ? -1 : 1);
  const localY = (cropY - (image.cropY || 0)) * (image.scaleY || 1) * (image.flipY ? -1 : 1);
  return {
    x: localX * Math.cos(radians) - localY * Math.sin(radians),
    y: localX * Math.sin(radians) + localY * Math.cos(radians),
  };
}

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
