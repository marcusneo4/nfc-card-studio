import { FabricImage } from 'fabric';
import * as ort from 'onnxruntime-web';
import { readFileAsDataUrl } from './objects.js';

let backgroundRemovalSession = null;
const MODEL_CACHE_VERSION_KEY = 'card-atelier.rembg-model.v1';
const U2NETP_MODEL_URL = 'https://huggingface.co/edgetools/u2netp/resolve/main/u2netp.onnx';
const ortWasmUrl = new URL('../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm', import.meta.url).href;
const ortJsepWasmUrl = new URL('../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.wasm', import.meta.url).href;
ort.env.wasm.wasmPaths = {
  'ort-wasm-simd-threaded.wasm': ortWasmUrl,
  'ort-wasm-simd-threaded.jsep.wasm': ortJsepWasmUrl,
};

/**
 * Removes the background from the selected image locally in the browser.
 * The lightweight model is downloaded once and then cached by the browser.
 * @param {import('fabric').Canvas} canvas
 * @param {(progress: number, message: string) => void} onProgress
 * @returns {Promise<boolean>}
 * @throws {Error} When no image is selected or processing fails.
 */
export async function removeSelectedImageBackground(canvas, onProgress) {
  const selectedImage = canvas.getActiveObject();
  if (!selectedImage || selectedImage.type !== 'image') {
    throw new Error('[BackgroundRemoval] Select an image first');
  }

  try {
    onProgress(2, 'Loading background remover…');
    const {
      clearModelCacheForModel,
      newSession,
      rembgConfig,
      remove,
    } = await import('@bunnio/rembg-web');
    if (!backgroundRemovalSession) {
      rembgConfig.setCustomModelPath('u2netp', U2NETP_MODEL_URL);
      if (localStorage.getItem(MODEL_CACHE_VERSION_KEY) !== U2NETP_MODEL_URL) {
        await clearModelCacheForModel('u2netp');
      }
      backgroundRemovalSession = await newSession('u2netp');
      localStorage.setItem(MODEL_CACHE_VERSION_KEY, U2NETP_MODEL_URL);
    }

    const source = await sourceToBlob(selectedImage.getSrc());
    const processedBlob = await remove(source, {
      session: backgroundRemovalSession,
      postProcessMask: true,
      onProgress(info) {
        onProgress(Math.round(info.progress), info.message);
      },
    });
    const processedDataUrl = await readFileAsDataUrl(processedBlob);
    const replacementImage = await FabricImage.fromURL(processedDataUrl);
    replaceImage(canvas, selectedImage, replacementImage);
    onProgress(100, 'Background removed');
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown processing error';
    throw new Error(`[BackgroundRemoval] Could not remove the background: ${message}`);
  }
}

/**
 * @param {string} source
 * @returns {Promise<Blob>}
 */
async function sourceToBlob(source) {
  if (!source) {
    throw new Error('Selected image has no readable source');
  }
  const response = await fetch(source);
  if (!response.ok) {
    throw new Error(`Image source returned ${response.status}`);
  }
  return response.blob();
}

/**
 * @param {import('fabric').Canvas} canvas
 * @param {import('fabric').FabricImage} sourceImage
 * @param {import('fabric').FabricImage} replacementImage
 * @returns {void}
 */
function replaceImage(canvas, sourceImage, replacementImage) {
  const layerIndex = canvas.getObjects().indexOf(sourceImage);
  const sourceSize = sourceImage.getOriginalSize();
  const replacementSize = replacementImage.getOriginalSize();
  const samePixelSize = sourceSize.width === replacementSize.width && sourceSize.height === replacementSize.height;
  replacementImage.set({
    left: sourceImage.left,
    top: sourceImage.top,
    originX: sourceImage.originX,
    originY: sourceImage.originY,
    scaleX: sourceImage.scaleX,
    scaleY: sourceImage.scaleY,
    angle: sourceImage.angle,
    flipX: sourceImage.flipX,
    flipY: sourceImage.flipY,
    opacity: sourceImage.opacity,
    skewX: sourceImage.skewX,
    skewY: sourceImage.skewY,
    cropX: samePixelSize ? sourceImage.cropX : 0,
    cropY: samePixelSize ? sourceImage.cropY : 0,
    width: samePixelSize ? sourceImage.width : replacementImage.width,
    height: samePixelSize ? sourceImage.height : replacementImage.height,
  });
  canvas.remove(sourceImage);
  canvas.add(replacementImage);
  if (layerIndex >= 0) {
    canvas.moveObjectTo(replacementImage, layerIndex);
  }
  replacementImage.setCoords();
  canvas.setActiveObject(replacementImage);
  canvas.requestRenderAll();
}
