import { PIXELS_PER_METER } from '../constants.js';

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

/**
 * CRC table for the PNG ISO-3309 checksum.
 * @returns {Uint32Array}
 */
function createCrcTable() {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      const lsbSet = (value & 1) === 1;
      value = lsbSet ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    }
    table[index] = value >>> 0;
  }
  return table;
}

const CRC_TABLE = createCrcTable();

/**
 * @param {Uint8Array} bytes
 * @returns {number}
 */
function crc32(bytes) {
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index += 1) {
    crc = CRC_TABLE[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * @param {Uint8Array} bytes
 * @param {number} offset
 * @returns {boolean}
 */
function hasPngSignature(bytes, offset = 0) {
  return PNG_SIGNATURE.every((byte, index) => bytes[offset + index] === byte);
}

/**
 * Walks PNG chunks so compressed image data cannot look like a pHYs marker.
 * @param {Uint8Array} bytes
 * @returns {boolean}
 */
function alreadyHasPhys(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = PNG_SIGNATURE.length;
  while (offset + 8 <= bytes.length) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(
      bytes[offset + 4],
      bytes[offset + 5],
      bytes[offset + 6],
      bytes[offset + 7],
    );
    if (type === 'pHYs') {
      return true;
    }
    if (type === 'IEND') {
      return false;
    }
    offset += 12 + length;
  }
  return false;
}

/**
 * Builds a 9-byte pHYs chunk at 300 DPI (pixels per meter).
 * @returns {Uint8Array}
 */
function createPhysChunk() {
  const data = new Uint8Array(9);
  const view = new DataView(data.buffer);
  view.setUint32(0, PIXELS_PER_METER);
  view.setUint32(4, PIXELS_PER_METER);
  data[8] = 1;

  const typeAndData = new Uint8Array(13);
  typeAndData.set([112, 72, 89, 115], 0);
  typeAndData.set(data, 4);

  const chunk = new Uint8Array(21);
  const chunkView = new DataView(chunk.buffer);
  chunkView.setUint32(0, 9);
  chunk.set(typeAndData, 4);
  chunkView.setUint32(17, crc32(typeAndData));
  return chunk;
}

/**
 * Inserts a pHYs chunk so print software reads the PNG as 85.6 mm × 54.0 mm.
 * @param {Uint8Array} pngBytes
 * @returns {Uint8Array}
 * @throws {Error} When the buffer is not a PNG.
 */
export function injectPhysChunk(pngBytes) {
  if (!hasPngSignature(pngBytes)) {
    throw new Error('[Export] Canvas output was not a PNG');
  }
  if (alreadyHasPhys(pngBytes)) {
    return pngBytes;
  }

  const view = new DataView(pngBytes.buffer, pngBytes.byteOffset, pngBytes.byteLength);
  const ihdrLength = view.getUint32(8);
  const ihdrType = String.fromCharCode(
    pngBytes[12],
    pngBytes[13],
    pngBytes[14],
    pngBytes[15],
  );
  if (ihdrType !== 'IHDR') {
    throw new Error('[Export] PNG is missing an IHDR chunk');
  }

  const insertAt = PNG_SIGNATURE.length + 12 + ihdrLength;
  const chunk = createPhysChunk();
  const output = new Uint8Array(pngBytes.length + chunk.length);
  output.set(pngBytes.subarray(0, insertAt), 0);
  output.set(chunk, insertAt);
  output.set(pngBytes.subarray(insertAt), insertAt + chunk.length);
  return output;
}

/**
 * @param {string} dataUrl
 * @returns {Uint8Array}
 * @throws {Error} When the URL is not a base64 PNG data URL.
 */
export function dataUrlToBytes(dataUrl) {
  const comma = dataUrl.indexOf(',');
  if (!dataUrl.startsWith('data:image/png') || comma === -1) {
    throw new Error('[Export] Expected a PNG data URL');
  }

  const binary = atob(dataUrl.slice(comma + 1));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

/**
 * @param {string} dataUrl
 * @returns {Blob}
 */
export function pngDataUrlToPrintBlob(dataUrl) {
  const withDensity = injectPhysChunk(dataUrlToBytes(dataUrl));
  return new Blob([withDensity], { type: 'image/png' });
}
