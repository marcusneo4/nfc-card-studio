import { Circle, IText } from 'fabric';

/** @typedef {'phone' | 'email' | 'web' | 'linkedin'} ContactIconKind */

const ICON_GLYPHS = {
  phone: '☎',
  email: '@',
  web: '◎',
  linkedin: 'in',
};

/**
 * Adds a compact contact icon used by NFC and print layouts.
 * @param {import('fabric').Canvas} canvas
 * @param {ContactIconKind} kind
 * @param {string} fill
 * @returns {void}
 */
export function addContactIcon(canvas, kind, fill) {
  const glyph = ICON_GLYPHS[kind];
  if (!glyph) {
    throw new Error(`[Icons] Unknown icon: ${kind}`);
  }

  const disk = new Circle({
    left: 80,
    top: 80,
    radius: 28,
    fill,
    originX: 'left',
    originY: 'top',
  });
  disk.set({ cardKind: 'icon', cardRole: kind });

  const label = new IText(glyph, {
    left: 94,
    top: kind === 'linkedin' ? 88 : 86,
    fontFamily: kind === 'linkedin' ? 'Montserrat' : 'Manrope',
    fontSize: kind === 'linkedin' ? 22 : 28,
    fontWeight: 700,
    fill: '#F4F0E6',
    selectable: true,
    evented: true,
  });
  label.set({ cardKind: 'icon-label', cardRole: kind });

  canvas.add(disk, label);
  canvas.setActiveObject(disk);
  canvas.requestRenderAll();
}
