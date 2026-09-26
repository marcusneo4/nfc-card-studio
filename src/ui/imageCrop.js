/**
 * @typedef {{ x: number, y: number, width: number, height: number }} CropRect
 * @typedef {{ left: number, top: number, right: number, bottom: number, width: number, height: number }} ImageBox
 * @typedef {{
 *   src: string,
 *   naturalWidth: number,
 *   naturalHeight: number,
 *   crop: CropRect,
 *   onApply: (crop: CropRect) => void,
 *   onError: (error: Error) => void,
 * }} CropSession
 */

/**
 * Opens a drag-to-crop dialog for one image.
 * @param {HTMLDialogElement} dialog
 * @returns {{ open: (session: CropSession) => void }}
 */
export function createImageCropper(dialog) {
  const stage = dialog.querySelector('#crop-stage');
  const image = dialog.querySelector('#crop-source');
  const frameElement = dialog.querySelector('#crop-frame');
  if (!(stage instanceof HTMLElement) || !(image instanceof HTMLImageElement) || !(frameElement instanceof HTMLElement)) {
    throw new Error('[ImageCrop] Crop dialog is missing its stage');
  }

  /** @type {CropSession | null} */
  let session = null;
  /** @type {CropRect} */
  let frame = { x: 0, y: 0, width: 0, height: 0 };
  /** @type {{ pointerId: number, mode: string, startX: number, startY: number, frame: CropRect } | null} */
  let drag = null;

  stage.addEventListener('pointerdown', onPointerDown);
  stage.addEventListener('pointermove', onPointerMove);
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);
  dialog.querySelector('#crop-apply')?.addEventListener('click', applyCrop);
  dialog.querySelector('#crop-cancel')?.addEventListener('click', () => dialog.close());
  dialog.querySelector('#crop-reset')?.addEventListener('click', () => {
    frame = fullImageFrame(imageBox());
    paintFrame(frameElement, frame);
  });
  dialog.addEventListener('close', () => {
    session = null;
    drag = null;
  });
  image.addEventListener('error', () => {
    failCrop(new Error('[ImageCrop] Could not display the image'));
  });

  return { open };

  /**
   * @param {CropSession} nextSession
   * @returns {void}
   */
  function open(nextSession) {
    if (!nextSession.src || nextSession.naturalWidth < 1 || nextSession.naturalHeight < 1) {
      throw new Error('[ImageCrop] The selected image has no readable pixels');
    }

    session = nextSession;
    frameElement.style.visibility = 'hidden';
    image.src = nextSession.src;
    if (!dialog.open) {
      dialog.showModal();
    }
    void layoutFrame();
  }

  /**
   * @returns {Promise<void>}
   */
  async function layoutFrame() {
    try {
      await waitForImage(image);
      if (!session) {
        return;
      }
      const box = imageBox();
      if (box.width < 1 || box.height < 1) {
        throw new Error('[ImageCrop] The image has no visible size');
      }
      frame = frameFromSource(session.crop, box, image.naturalWidth, image.naturalHeight);
      paintFrame(frameElement, frame);
    } catch (error) {
      const failure = error instanceof Error ? error : new Error('[ImageCrop] Could not prepare the crop');
      failCrop(failure);
    }
  }

  /**
   * @param {PointerEvent} event
   * @returns {void}
   */
  function onPointerDown(event) {
    if (!session || !(event.target instanceof Element)) {
      return;
    }
    const handle = event.target.closest('[data-crop-handle]');
    const onFrame = event.target.closest('#crop-frame');
    if (!(handle instanceof HTMLElement) && !(onFrame instanceof HTMLElement)) {
      return;
    }

    event.preventDefault();
    stage.setPointerCapture(event.pointerId);
    drag = {
      pointerId: event.pointerId,
      mode: handle?.dataset.cropHandle || 'move',
      startX: event.clientX,
      startY: event.clientY,
      frame: { ...frame },
    };
  }

  /**
   * @param {PointerEvent} event
   * @returns {void}
   */
  function onPointerMove(event) {
    if (!drag || event.pointerId !== drag.pointerId) {
      return;
    }
    const box = imageBox();
    frame = nextCropFrame(
      drag.frame,
      event.clientX - drag.startX,
      event.clientY - drag.startY,
      drag.mode,
      box,
      Math.min(28, box.width, box.height),
    );
    paintFrame(frameElement, frame);
  }

  /**
   * @param {PointerEvent} event
   * @returns {void}
   */
  function endDrag(event) {
    if (!drag || event.pointerId !== drag.pointerId) {
      return;
    }
    drag = null;
  }

  /**
   * @returns {void}
   */
  function applyCrop() {
    if (!session) {
      return;
    }
    const box = imageBox();
    const crop = sourceCropFromFrame(frame, box, image.naturalWidth, image.naturalHeight);
    const onApply = session.onApply;
    dialog.close();
    onApply(crop);
  }

  /**
   * @param {Error} error
   * @returns {void}
   */
  function failCrop(error) {
    const onError = session?.onError;
    if (dialog.open) {
      dialog.close();
    }
    session = null;
    onError?.(error);
  }

  /**
   * @returns {ImageBox}
   */
  function imageBox() {
    return {
      left: image.offsetLeft,
      top: image.offsetTop,
      width: image.offsetWidth,
      height: image.offsetHeight,
      right: image.offsetLeft + image.offsetWidth,
      bottom: image.offsetTop + image.offsetHeight,
    };
  }
}

/**
 * @param {HTMLImageElement} image
 * @returns {Promise<void>}
 */
function waitForImage(image) {
  if (image.complete && image.naturalWidth > 0) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    image.addEventListener('load', () => resolve(), { once: true });
    image.addEventListener('error', () => reject(new Error('[ImageCrop] Could not display the image')), { once: true });
  });
}

/**
 * @param {CropRect} crop
 * @param {ImageBox} box
 * @param {number} naturalWidth
 * @param {number} naturalHeight
 * @returns {CropRect}
 */
function frameFromSource(crop, box, naturalWidth, naturalHeight) {
  const scaleX = box.width / naturalWidth;
  const scaleY = box.height / naturalHeight;
  const width = clamp(crop.width * scaleX, 1, box.width);
  const height = clamp(crop.height * scaleY, 1, box.height);
  return {
    x: clamp(box.left + crop.x * scaleX, box.left, box.right - width),
    y: clamp(box.top + crop.y * scaleY, box.top, box.bottom - height),
    width,
    height,
  };
}

/**
 * @param {ImageBox} box
 * @returns {CropRect}
 */
function fullImageFrame(box) {
  return { x: box.left, y: box.top, width: box.width, height: box.height };
}

/**
 * @param {HTMLElement} frameElement
 * @param {CropRect} frame
 * @returns {void}
 */
function paintFrame(frameElement, frame) {
  frameElement.style.visibility = 'visible';
  frameElement.style.left = `${frame.x}px`;
  frameElement.style.top = `${frame.y}px`;
  frameElement.style.width = `${frame.width}px`;
  frameElement.style.height = `${frame.height}px`;
}

/**
 * @param {CropRect} start
 * @param {number} deltaX
 * @param {number} deltaY
 * @param {string} mode
 * @param {ImageBox} bounds
 * @param {number} minimumSize
 * @returns {CropRect}
 */
function nextCropFrame(start, deltaX, deltaY, mode, bounds, minimumSize) {
  if (mode === 'move') {
    return {
      x: clamp(start.x + deltaX, bounds.left, bounds.right - start.width),
      y: clamp(start.y + deltaY, bounds.top, bounds.bottom - start.height),
      width: start.width,
      height: start.height,
    };
  }

  let left = start.x;
  let top = start.y;
  let right = start.x + start.width;
  let bottom = start.y + start.height;
  if (mode === 'w' || mode === 'nw' || mode === 'sw') {
    left = clamp(start.x + deltaX, bounds.left, right - minimumSize);
  }
  if (mode === 'e' || mode === 'ne' || mode === 'se') {
    right = clamp(right + deltaX, left + minimumSize, bounds.right);
  }
  if (mode === 'n' || mode === 'nw' || mode === 'ne') {
    top = clamp(start.y + deltaY, bounds.top, bottom - minimumSize);
  }
  if (mode === 's' || mode === 'sw' || mode === 'se') {
    bottom = clamp(bottom + deltaY, top + minimumSize, bounds.bottom);
  }

  return { x: left, y: top, width: right - left, height: bottom - top };
}

/**
 * @param {CropRect} frame
 * @param {ImageBox} box
 * @param {number} naturalWidth
 * @param {number} naturalHeight
 * @returns {CropRect}
 */
function sourceCropFromFrame(frame, box, naturalWidth, naturalHeight) {
  const cropX = clamp(Math.round(((frame.x - box.left) / box.width) * naturalWidth), 0, naturalWidth - 1);
  const cropY = clamp(Math.round(((frame.y - box.top) / box.height) * naturalHeight), 0, naturalHeight - 1);
  return {
    x: cropX,
    y: cropY,
    width: clamp(Math.round((frame.width / box.width) * naturalWidth), 1, naturalWidth - cropX),
    height: clamp(Math.round((frame.height / box.height) * naturalHeight), 1, naturalHeight - cropY),
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
