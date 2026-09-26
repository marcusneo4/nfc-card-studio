import { CARD_HEIGHT, CARD_WIDTH } from '../constants.js';
import { pngDataUrlToPrintBlob } from './pngPhys.js';

const MARGIN = 56;
const LABEL_BAND = 48;
const GAP = 72;
const FOOTER = 72;

/**
 * @typedef {{ name: string, blob: Blob }} ExportedFace
 */

/**
 * Composites both faces onto one 300 DPI sheet so each card prints at CR80 size.
 * @param {Blob} frontBlob
 * @param {Blob} backBlob
 * @returns {Promise<ExportedFace>}
 * @throws {Error} When either face cannot be drawn.
 */
export async function renderPrintSheet(frontBlob, backBlob) {
  const width = MARGIN * 2 + CARD_WIDTH;
  const height = MARGIN + LABEL_BAND + CARD_HEIGHT + GAP + LABEL_BAND + CARD_HEIGHT + FOOTER;
  const sheet = document.createElement('canvas');
  sheet.width = width;
  sheet.height = height;
  const context = sheet.getContext('2d');
  if (!context) {
    throw new Error('[Export] Could not draw the print sheet');
  }

  try {
    await document.fonts.ready;
    context.fillStyle = '#f4f0e6';
    context.fillRect(0, 0, width, height);

    const frontTop = MARGIN + LABEL_BAND;
    const backTop = frontTop + CARD_HEIGHT + GAP + LABEL_BAND;
    await drawLabeledFace(context, frontBlob, MARGIN, frontTop, 'FRONT');
    await drawLabeledFace(context, backBlob, MARGIN, backTop, 'BACK');

    context.fillStyle = '#3c3933';
    context.font = '500 26px Manrope, sans-serif';
    context.fillText('CR80  ·  85.60 × 53.98 mm  ·  300 DPI  ·  each card is actual size', MARGIN, height - 28);

    return {
      name: 'card-print-sheet.png',
      blob: pngDataUrlToPrintBlob(sheet.toDataURL('image/png')),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`[Export] Failed to build the print sheet: ${message}`);
  }
}

/**
 * @param {CanvasRenderingContext2D} context
 * @param {Blob} blob
 * @param {number} x
 * @param {number} cardY
 * @param {string} label
 * @returns {Promise<void>}
 */
async function drawLabeledFace(context, blob, x, cardY, label) {
  context.fillStyle = '#5c564c';
  context.font = '600 28px Manrope, sans-serif';
  context.fillText(label, x, cardY - 16);

  const bitmap = await createImageBitmap(blob);
  try {
    context.drawImage(bitmap, x, cardY, CARD_WIDTH, CARD_HEIGHT);
  } finally {
    bitmap.close();
  }

  context.strokeStyle = '#d2cbbd';
  context.lineWidth = 2;
  context.strokeRect(x + 1, cardY + 1, CARD_WIDTH - 2, CARD_HEIGHT - 2);
  drawCropMarks(context, x, cardY, CARD_WIDTH, CARD_HEIGHT);
}

/**
 * @param {CanvasRenderingContext2D} context
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @param {number} height
 * @returns {void}
 */
function drawCropMarks(context, x, y, width, height) {
  const mark = 28;
  const gap = 14;
  context.strokeStyle = '#2c2a26';
  context.lineWidth = 2;
  context.beginPath();
  const corners = [
    [x, y, -1, -1],
    [x + width, y, 1, -1],
    [x, y + height, -1, 1],
    [x + width, y + height, 1, 1],
  ];
  corners.forEach(([originX, originY, xDir, yDir]) => {
    context.moveTo(originX + xDir * gap, originY);
    context.lineTo(originX + xDir * (gap + mark), originY);
    context.moveTo(originX, originY + yDir * gap);
    context.lineTo(originX, originY + yDir * (gap + mark));
  });
  context.stroke();
}
