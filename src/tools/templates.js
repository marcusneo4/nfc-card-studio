import { Circle, Rect } from 'fabric';
import { CARD_HEIGHT, CARD_WIDTH } from '../constants.js';
import { addQrSlot } from './qr.js';
import { addText } from './objects.js';

/** @typedef {'editorial' | 'signal' | 'minimal' | 'orchid' | 'luxe' | 'grid' | 'studio' | 'monogram'} TemplateName */

const FRONT_TEMPLATES = {
  editorial: createEditorialTemplate,
  signal: createSignalTemplate,
  minimal: createMinimalTemplate,
  orchid: createOrchidTemplate,
  luxe: createLuxeTemplate,
  grid: createGridTemplate,
  studio: createStudioTemplate,
  monogram: createMonogramTemplate,
};

const BACK_TEMPLATES = {
  'editorial-back': createEditorialBack,
  'signal-back': createSignalBack,
  'minimal-back': createMinimalBack,
  'orchid-back': createOrchidBack,
  'luxe-back': createLuxeBack,
  'grid-back': createGridBack,
  'studio-back': createStudioBack,
  'monogram-back': createMonogramBack,
};

/**
 * @param {string} templateName
 * @returns {string}
 */
export function matchingBackName(templateName) {
  return `${templateName}-back`;
}

/**
 * @param {string} templateName
 * @returns {boolean}
 */
export function isFrontTemplate(templateName) {
  return templateName in FRONT_TEMPLATES;
}

/**
 * Replaces the active face with a complete starter composition.
 * @param {import('fabric').Canvas} canvas
 * @param {string} templateName
 * @returns {void}
 * @throws {Error} When the template name is unknown.
 */
export function applyCardTemplate(canvas, templateName) {
  canvas.clear();
  const factory = FRONT_TEMPLATES[templateName] ?? BACK_TEMPLATES[templateName];
  if (!factory) {
    throw new Error(`[Templates] Unknown template: ${templateName}`);
  }
  factory(canvas);
  if (typeof canvas.discardActiveObject === 'function') {
    canvas.discardActiveObject();
  }
  canvas.requestRenderAll();
}

/**
 * @param {import('fabric').Canvas} canvas
 * @returns {void}
 */
function createEditorialTemplate(canvas) {
  canvas.backgroundColor = '#eee5d6';
  canvas.add(new Rect({
    left: 690,
    top: 0,
    width: CARD_WIDTH - 690,
    height: CARD_HEIGHT,
    fill: '#aa4d3d',
    selectable: false,
    evented: false,
  }));
  addText(canvas, 'ALEX\nMORGAN', {
    left: 70,
    top: 90,
    fontSize: 92,
    fill: '#231f1b',
    fontFamily: 'Cormorant Garamond',
    cardRole: 'name',
  }).set({ fontWeight: 700, lineHeight: 0.84 });
  addText(canvas, 'CREATIVE DIRECTOR', {
    left: 76,
    top: 320,
    fontSize: 25,
    fill: '#aa4d3d',
    fontFamily: 'IBM Plex Mono',
    cardRole: 'title',
  }).set({ charSpacing: 130 });
  addText(canvas, 'alex@studio.sg\n+65 8123 4567', {
    left: 76,
    top: 455,
    fontSize: 25,
    fill: '#514a42',
    fontFamily: 'Manrope',
    cardRole: 'contactPair',
  }).set({ lineHeight: 1.55 });
  addText(canvas, 'A', {
    left: 768,
    top: 172,
    fontSize: 200,
    fill: '#eee5d6',
    fontFamily: 'Fraunces',
    cardRole: 'monogram',
  });
}

/**
 * @param {import('fabric').Canvas} canvas
 * @returns {void}
 */
function createSignalTemplate(canvas) {
  canvas.backgroundColor = '#101c2b';
  canvas.add(new Circle({
    left: 745,
    top: -92,
    radius: 188,
    fill: '#e7613e',
    selectable: false,
    evented: false,
  }));
  addText(canvas, 'NOAH\nKIM', {
    left: 64,
    top: 64,
    fontSize: 154,
    fill: '#efd66f',
    fontFamily: 'Bebas Neue',
    cardRole: 'name',
  }).set({ charSpacing: 30, lineHeight: 0.82 });
  addText(canvas, 'PRODUCT DESIGNER  /  NFC', {
    left: 73,
    top: 402,
    fontSize: 24,
    fill: '#efd66f',
    fontFamily: 'IBM Plex Mono',
    cardRole: 'title',
  }).set({ charSpacing: 60 });
  addText(canvas, 'hello@noahkim.sg\n+65 8123 4567', {
    left: 73,
    top: 500,
    fontSize: 25,
    fill: '#aab8c5',
    fontFamily: 'Space Grotesk',
    cardRole: 'contactPair',
  }).set({ lineHeight: 1.45 });
}

/**
 * @param {import('fabric').Canvas} canvas
 * @returns {void}
 */
function createMinimalTemplate(canvas) {
  canvas.backgroundColor = '#deddd5';
  canvas.add(new Rect({
    left: 0,
    top: 0,
    width: 26,
    height: CARD_HEIGHT,
    fill: '#294138',
    selectable: false,
    evented: false,
  }));
  addText(canvas, 'MAYA CHEN', {
    left: 82,
    top: 116,
    fontSize: 82,
    fill: '#171a17',
    fontFamily: 'Syne',
    cardRole: 'name',
  }).set({ fontWeight: 600, charSpacing: -20 });
  addText(canvas, 'ARCHITECT & MAKER', {
    left: 87,
    top: 236,
    fontSize: 24,
    fill: '#56635c',
    fontFamily: 'IBM Plex Mono',
    cardRole: 'title',
  }).set({ charSpacing: 115 });
  canvas.add(new Rect({
    left: 86,
    top: 338,
    width: 838,
    height: 2,
    fill: '#9fa29a',
    selectable: false,
    evented: false,
  }));
  addText(canvas, 'maya@fieldoffice.co', {
    left: 86,
    top: 414,
    fontSize: 28,
    fill: '#294138',
    fontFamily: 'Manrope',
    cardRole: 'email',
  });
  addText(canvas, '+65 8123 4567', {
    left: 665,
    top: 414,
    fontSize: 28,
    fill: '#294138',
    fontFamily: 'Manrope',
    cardRole: 'phone',
  });
}

/**
 * @param {import('fabric').Canvas} canvas
 * @returns {void}
 */
function createOrchidTemplate(canvas) {
  canvas.backgroundColor = '#ece7f6';
  canvas.add(new Circle({
    left: 680,
    top: 90,
    radius: 215,
    fill: '#6d28d9',
    selectable: false,
    evented: false,
  }));
  addText(canvas, 'AMELIA\nTAN', {
    left: 62,
    top: 78,
    fontSize: 112,
    fill: '#211735',
    fontFamily: 'Playfair Display',
    cardRole: 'name',
  }).set({ fontWeight: 700, lineHeight: 0.86 });
  addText(canvas, 'BRAND STRATEGIST', {
    left: 70,
    top: 343,
    fontSize: 24,
    fill: '#6d28d9',
    fontFamily: 'Montserrat',
    cardRole: 'title',
  }).set({ charSpacing: 115 });
  addText(canvas, 'amelia@north.sg  ·  +65 8123 4567', {
    left: 70,
    top: 510,
    fontSize: 25,
    fill: '#514665',
    fontFamily: 'Inter',
    cardRole: 'contactPair',
  });
  addText(canvas, 'AT', {
    left: 750,
    top: 210,
    fontSize: 118,
    fill: '#ece7f6',
    fontFamily: 'Libre Baskerville',
    cardRole: 'monogram',
  });
}

/**
 * @param {import('fabric').Canvas} canvas
 * @returns {void}
 */
function createLuxeTemplate(canvas) {
  canvas.backgroundColor = '#17130f';
  canvas.add(new Rect({
    left: 44,
    top: 44,
    width: CARD_WIDTH - 88,
    height: CARD_HEIGHT - 88,
    fill: 'transparent',
    stroke: '#c7a76a',
    strokeWidth: 2,
    selectable: false,
    evented: false,
  }));
  addText(canvas, 'ELENA ONG', {
    left: CARD_WIDTH / 2,
    top: 190,
    fontSize: 82,
    fill: '#f0e7d5',
    fontFamily: 'Cormorant Garamond',
    cardRole: 'name',
  }).set({ originX: 'center', fontWeight: 600, charSpacing: 80 });
  addText(canvas, 'PRIVATE CLIENT ADVISOR', {
    left: CARD_WIDTH / 2,
    top: 310,
    fontSize: 21,
    fill: '#c7a76a',
    fontFamily: 'Montserrat',
    cardRole: 'title',
  }).set({ originX: 'center', charSpacing: 180 });
  addText(canvas, '+65 8123 4567   ·   elena@maison.sg', {
    left: CARD_WIDTH / 2,
    top: 455,
    fontSize: 23,
    fill: '#bcb2a3',
    fontFamily: 'Inter',
    cardRole: 'contactPair',
  }).set({ originX: 'center' });
}

/**
 * @param {import('fabric').Canvas} canvas
 * @returns {void}
 */
function createGridTemplate(canvas) {
  canvas.backgroundColor = '#f2f0e9';
  canvas.add(new Rect({
    left: 0,
    top: 0,
    width: 370,
    height: CARD_HEIGHT,
    fill: '#172554',
    selectable: false,
    evented: false,
  }));
  addText(canvas, 'RK', {
    left: 76,
    top: 128,
    fontSize: 190,
    fill: '#facc15',
    fontFamily: 'Archivo',
    cardRole: 'monogram',
  }).set({ fontWeight: 700, charSpacing: -80 });
  addText(canvas, 'RYAN KOH', {
    left: 435,
    top: 110,
    fontSize: 72,
    fill: '#172554',
    fontFamily: 'Archivo',
    cardRole: 'name',
  }).set({ fontWeight: 700 });
  addText(canvas, 'SOFTWARE ENGINEER\nSINGAPORE', {
    left: 440,
    top: 235,
    fontSize: 26,
    fill: '#475569',
    fontFamily: 'IBM Plex Mono',
    cardRole: 'title',
  }).set({ lineHeight: 1.55, charSpacing: 45 });
  addText(canvas, 'ryan@build.sg\n+65 8123 4567', {
    left: 440,
    top: 452,
    fontSize: 26,
    fill: '#172554',
    fontFamily: 'Inter',
    cardRole: 'contactPair',
  }).set({ lineHeight: 1.45 });
}

/**
 * @param {import('fabric').Canvas} canvas
 * @returns {void}
 */
function createStudioTemplate(canvas) {
  canvas.backgroundColor = '#ee5a36';
  canvas.add(new Circle({
    left: 650,
    top: 145,
    radius: 210,
    fill: '#f7e9ca',
    selectable: false,
    evented: false,
  }));
  addText(canvas, 'JUNE\nLEE', {
    left: 62,
    top: 74,
    fontSize: 142,
    fill: '#17211d',
    fontFamily: 'Bebas Neue',
    cardRole: 'name',
  }).set({ lineHeight: 0.78, charSpacing: 20 });
  addText(canvas, 'ART DIRECTION / IMAGE MAKING', {
    left: 70,
    top: 410,
    fontSize: 22,
    fill: '#17211d',
    fontFamily: 'IBM Plex Mono',
    cardRole: 'title',
  }).set({ charSpacing: 50 });
  addText(canvas, 'june@form.sg\n+65 8123 4567', {
    left: 70,
    top: 500,
    fontSize: 24,
    fill: '#3f332d',
    fontFamily: 'Space Grotesk',
    cardRole: 'contactPair',
  }).set({ lineHeight: 1.35 });
  addText(canvas, 'JL', {
    left: 748,
    top: 258,
    fontSize: 92,
    fill: '#ee5a36',
    fontFamily: 'Fraunces',
    cardRole: 'monogram',
  }).set({ fontWeight: 700 });
}

/**
 * @param {import('fabric').Canvas} canvas
 * @returns {void}
 */
function createMonogramTemplate(canvas) {
  canvas.backgroundColor = '#dce7df';
  addText(canvas, 'ST', {
    left: 62,
    top: 42,
    fontSize: 232,
    fill: '#24473b',
    fontFamily: 'Playfair Display',
    cardRole: 'monogram',
  }).set({ fontWeight: 700, opacity: 0.16, charSpacing: -80 });
  addText(canvas, 'SAMANTHA TEO', {
    left: 70,
    top: 315,
    fontSize: 68,
    fill: '#17372d',
    fontFamily: 'Outfit',
    cardRole: 'name',
  }).set({ fontWeight: 600 });
  addText(canvas, 'INTERIOR DESIGN', {
    left: 75,
    top: 418,
    fontSize: 23,
    fill: '#527065',
    fontFamily: 'IBM Plex Mono',
    cardRole: 'title',
  }).set({ charSpacing: 150 });
  addText(canvas, 'studio@teo.sg   /   +65 8123 4567', {
    left: 75,
    top: 522,
    fontSize: 24,
    fill: '#17372d',
    fontFamily: 'Inter',
    cardRole: 'contactPair',
  });
}

/**
 * @param {import('fabric').Canvas} canvas
 * @returns {void}
 */
function createEditorialBack(canvas) {
  canvas.backgroundColor = '#aa4d3d';
  addQrSlot(canvas, 86, 120, 250);
  addText(canvas, 'TAP TO CONNECT', {
    left: 380,
    top: 150,
    fontSize: 28,
    fill: '#f4e8d8',
    fontFamily: 'IBM Plex Mono',
  }).set({ charSpacing: 80 });
  addText(canvas, 'ALEX MORGAN', {
    left: 380,
    top: 230,
    fontSize: 54,
    fill: '#f7f1e6',
    fontFamily: 'Cormorant Garamond',
    cardRole: 'name',
  }).set({ fontWeight: 700 });
  addText(canvas, 'studio.sg', {
    left: 380,
    top: 430,
    fontSize: 26,
    fill: '#f0d2c4',
    fontFamily: 'Manrope',
    cardRole: 'website',
  });
}

/**
 * @param {import('fabric').Canvas} canvas
 * @returns {void}
 */
function createSignalBack(canvas) {
  canvas.backgroundColor = '#101c2b';
  addQrSlot(canvas, 360, 110, 290);
  addText(canvas, 'SCAN OR TAP', {
    left: 70,
    top: 130,
    fontSize: 26,
    fill: '#efd66f',
    fontFamily: 'IBM Plex Mono',
  }).set({ charSpacing: 90 });
  addText(canvas, 'NOAH KIM', {
    left: 70,
    top: 200,
    fontSize: 72,
    fill: '#f1ede1',
    fontFamily: 'Bebas Neue',
    cardRole: 'name',
  });
  addText(canvas, 'hello@noahkim.sg', {
    left: 70,
    top: 500,
    fontSize: 24,
    fill: '#aab8c5',
    fontFamily: 'Space Grotesk',
    cardRole: 'email',
  });
}

/**
 * @param {import('fabric').Canvas} canvas
 * @returns {void}
 */
function createMinimalBack(canvas) {
  canvas.backgroundColor = '#deddd5';
  canvas.add(new Rect({
    left: 0,
    top: 0,
    width: 26,
    height: CARD_HEIGHT,
    fill: '#294138',
    selectable: false,
    evented: false,
  }));
  addQrSlot(canvas, 380, 94, 250);
  addText(canvas, 'TAP THE CARD', {
    left: 86,
    top: 150,
    fontSize: 24,
    fill: '#294138',
    fontFamily: 'IBM Plex Mono',
  }).set({ charSpacing: 90 });
  addText(canvas, 'MAYA CHEN', {
    left: 86,
    top: 220,
    fontSize: 48,
    fill: '#171a17',
    fontFamily: 'Syne',
    cardRole: 'name',
  }).set({ fontWeight: 600 });
  addText(canvas, 'maya@fieldoffice.co', {
    left: 86,
    top: 500,
    fontSize: 24,
    fill: '#294138',
    fontFamily: 'Manrope',
    cardRole: 'email',
  });
}

/**
 * @param {import('fabric').Canvas} canvas
 * @returns {void}
 */
function createOrchidBack(canvas) {
  canvas.backgroundColor = '#211735';
  addQrSlot(canvas, 96, 150, 240);
  addText(canvas, 'AMELIA TAN', {
    left: 380,
    top: 180,
    fontSize: 48,
    fill: '#ece7f6',
    fontFamily: 'Playfair Display',
    cardRole: 'name',
  }).set({ fontWeight: 700 });
  addText(canvas, 'BRAND STRATEGIST', {
    left: 380,
    top: 270,
    fontSize: 20,
    fill: '#c4b5fd',
    fontFamily: 'Montserrat',
    cardRole: 'title',
  }).set({ charSpacing: 80 });
  addText(canvas, 'Tap to save contact', {
    left: 380,
    top: 460,
    fontSize: 24,
    fill: '#d6ccf0',
    fontFamily: 'Inter',
  });
}

/**
 * @param {import('fabric').Canvas} canvas
 * @returns {void}
 */
function createLuxeBack(canvas) {
  canvas.backgroundColor = '#17130f';
  canvas.add(new Rect({
    left: 44,
    top: 44,
    width: CARD_WIDTH - 88,
    height: CARD_HEIGHT - 88,
    fill: 'transparent',
    stroke: '#c7a76a',
    strokeWidth: 2,
    selectable: false,
    evented: false,
  }));
  addQrSlot(canvas, 380, 130, 250);
  addText(canvas, 'ELENA ONG', {
    left: CARD_WIDTH / 2,
    top: 420,
    fontSize: 36,
    fill: '#f0e7d5',
    fontFamily: 'Cormorant Garamond',
    cardRole: 'name',
  }).set({ originX: 'center', charSpacing: 80 });
}

/**
 * @param {import('fabric').Canvas} canvas
 * @returns {void}
 */
function createGridBack(canvas) {
  canvas.backgroundColor = '#172554';
  addQrSlot(canvas, 96, 160, 240);
  addText(canvas, 'RYAN KOH', {
    left: 400,
    top: 180,
    fontSize: 52,
    fill: '#facc15',
    fontFamily: 'Archivo',
    cardRole: 'name',
  }).set({ fontWeight: 700 });
  addText(canvas, 'SOFTWARE ENGINEER', {
    left: 400,
    top: 270,
    fontSize: 22,
    fill: '#bfdbfe',
    fontFamily: 'IBM Plex Mono',
    cardRole: 'title',
  }).set({ charSpacing: 40 });
  addText(canvas, 'ryan@build.sg', {
    left: 400,
    top: 470,
    fontSize: 24,
    fill: '#f2f0e9',
    fontFamily: 'Inter',
    cardRole: 'email',
  });
}

/**
 * @param {import('fabric').Canvas} canvas
 * @returns {void}
 */
function createStudioBack(canvas) {
  canvas.backgroundColor = '#17211d';
  addQrSlot(canvas, 86, 140, 250);
  addText(canvas, 'JUNE LEE', {
    left: 380,
    top: 170,
    fontSize: 70,
    fill: '#f7e9ca',
    fontFamily: 'Bebas Neue',
    cardRole: 'name',
  });
  addText(canvas, 'ART DIRECTION', {
    left: 380,
    top: 280,
    fontSize: 22,
    fill: '#ee5a36',
    fontFamily: 'IBM Plex Mono',
    cardRole: 'title',
  }).set({ charSpacing: 60 });
  addText(canvas, 'june@form.sg', {
    left: 380,
    top: 480,
    fontSize: 24,
    fill: '#f7e9ca',
    fontFamily: 'Space Grotesk',
    cardRole: 'email',
  });
}

/**
 * @param {import('fabric').Canvas} canvas
 * @returns {void}
 */
function createMonogramBack(canvas) {
  canvas.backgroundColor = '#17372d';
  addText(canvas, 'ST', {
    left: 620,
    top: 40,
    fontSize: 220,
    fill: '#24473b',
    fontFamily: 'Playfair Display',
    cardRole: 'monogram',
  }).set({ fontWeight: 700, opacity: 0.35 });
  addQrSlot(canvas, 90, 150, 240);
  addText(canvas, 'SAMANTHA TEO', {
    left: 370,
    top: 190,
    fontSize: 40,
    fill: '#dce7df',
    fontFamily: 'Outfit',
    cardRole: 'name',
  }).set({ fontWeight: 600 });
  addText(canvas, 'Tap or scan to save', {
    left: 370,
    top: 470,
    fontSize: 22,
    fill: '#9db5aa',
    fontFamily: 'Inter',
  });
}
