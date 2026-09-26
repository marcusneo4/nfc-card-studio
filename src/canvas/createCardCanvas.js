import { Canvas, InteractiveFabricObject } from 'fabric';
import {
  CARD_BACKGROUND,
  CARD_HEIGHT,
  CARD_WIDTH,
  MAX_USER_ZOOM,
  MIN_USER_ZOOM,
} from '../constants.js';

/**
 * @typedef {Object} ViewportController
 * @property {(enabled: boolean) => void} setPanEnabled
 * @property {() => boolean} isPanEnabled
 * @property {(factor: number) => void} zoomBy
 * @property {() => void} resetView
 * @property {() => number} getUserZoom
 * @property {() => void} applyTransform
 */

/**
 * Keeps selection handles visually compact while preserving a large touch target.
 * Must run before objects are constructed.
 * @returns {void}
 */
export function configureTouchControls() {
  InteractiveFabricObject.ownDefaults.cornerSize = 18;
  InteractiveFabricObject.ownDefaults.touchCornerSize = 44;
  InteractiveFabricObject.ownDefaults.padding = 8;
  InteractiveFabricObject.ownDefaults.transparentCorners = false;
  InteractiveFabricObject.ownDefaults.cornerStyle = 'circle';
  InteractiveFabricObject.ownDefaults.cornerColor = '#F7F3EA';
  InteractiveFabricObject.ownDefaults.cornerStrokeColor = '#171811';
  InteractiveFabricObject.ownDefaults.borderColor = '#D7B46A';
  InteractiveFabricObject.ownDefaults.borderScaleFactor = 1.5;
  InteractiveFabricObject.ownDefaults.snapAngle = 15;
  InteractiveFabricObject.ownDefaults.snapThreshold = 4;
}

/**
 * Creates the print-resolution card canvas. Display size is applied with CSS, not here.
 * @param {HTMLCanvasElement} canvasElement
 * @returns {Canvas}
 */
export function createCardCanvas(canvasElement) {
  configureTouchControls();
  return new Canvas(canvasElement, {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: CARD_BACKGROUND,
    enableRetinaScaling: false,
    preserveObjectStacking: true,
    selection: true,
  });
}

/**
 * Fits the fixed-size stage into the viewport and supports pan plus user zoom.
 * @param {HTMLElement} viewport
 * @param {HTMLElement} stage
 * @param {Canvas} canvas
 * @param {(zoom: number) => void} onZoomChange
 * @returns {ViewportController}
 */
export function createViewportController(viewport, stage, canvas, onZoomChange) {
  let userZoom = 1;
  let panX = 0;
  let panY = 0;
  let panEnabled = false;
  /** @type {Map<number, { x: number, y: number }>} */
  const pointers = new Map();
  let pinchStartDistance = 0;
  let pinchStartZoom = 1;

  stage.style.width = `${CARD_WIDTH}px`;
  stage.style.height = `${CARD_HEIGHT}px`;

  const observer = new ResizeObserver(() => {
    applyTransform();
  });
  observer.observe(viewport);

  viewport.addEventListener('pointerdown', onPointerDown);
  viewport.addEventListener('pointermove', onPointerMove);
  viewport.addEventListener('pointerup', onPointerEnd);
  viewport.addEventListener('pointercancel', onPointerEnd);
  viewport.addEventListener('wheel', onWheel, { passive: false });

  applyTransform();

  /**
   * @returns {number}
   */
  /**
   * @returns {{ top: number }}
   */
  function chromeInset() {
    const rail = viewport.querySelector('#face-rail');
    if (!(rail instanceof HTMLElement)) {
      return { top: 0 };
    }
    return { top: rail.offsetHeight + 12 };
  }

  function fitScale() {
    const inset = chromeInset();
    const width = Math.max(viewport.clientWidth - 32, 1);
    const height = Math.max(viewport.clientHeight - inset.top - 24, 1);
    return Math.min(width / CARD_WIDTH, height / CARD_HEIGHT);
  }

  /**
   * @returns {void}
   */
  function applyTransform() {
    const inset = chromeInset();
    const scale = fitScale() * userZoom;
    const x = (viewport.clientWidth - CARD_WIDTH * scale) / 2 + panX;
    const usableHeight = viewport.clientHeight - inset.top;
    const y = inset.top + (usableHeight - CARD_HEIGHT * scale) / 2 + panY;
    stage.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    onZoomChange(userZoom);
  }

  /**
   * @param {number} nextZoom
   * @returns {void}
   */
  function setUserZoom(nextZoom) {
    userZoom = clamp(nextZoom, MIN_USER_ZOOM, MAX_USER_ZOOM);
    applyTransform();
  }

  /**
   * @param {boolean} enabled
   * @returns {void}
   */
  function setPanEnabled(enabled) {
    panEnabled = enabled;
    canvas.skipTargetFind = enabled;
    canvas.selection = !enabled;
    canvas.wrapperEl.style.pointerEvents = enabled ? 'none' : '';
    viewport.classList.toggle('is-panning', enabled);
    if (enabled) {
      canvas.discardActiveObject();
      canvas.requestRenderAll();
    }
  }

  /**
   * @param {PointerEvent} event
   * @returns {void}
   */
  function onPointerDown(event) {
    const target = event.target;
    if (target instanceof Element && target.closest('.face-rail')) {
      return;
    }
    if (!panEnabled) {
      return;
    }
    viewport.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    viewport.classList.add('is-grabbing');
    if (pointers.size === 2) {
      pinchStartDistance = pointerDistance();
      pinchStartZoom = userZoom;
    }
  }

  /**
   * @param {PointerEvent} event
   * @returns {void}
   */
  function onPointerMove(event) {
    if (!panEnabled || !pointers.has(event.pointerId)) {
      return;
    }

    const previous = pointers.get(event.pointerId);
    if (!previous) {
      return;
    }

    if (pointers.size >= 2 && pinchStartDistance > 0) {
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const distance = pointerDistance();
      setUserZoom(pinchStartZoom * (distance / pinchStartDistance));
      return;
    }

    panX += event.clientX - previous.x;
    panY += event.clientY - previous.y;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    applyTransform();
  }

  /**
   * @param {PointerEvent} event
   * @returns {void}
   */
  function onPointerEnd(event) {
    pointers.delete(event.pointerId);
    if (pointers.size < 2) {
      pinchStartDistance = 0;
    }
    if (pointers.size === 0) {
      viewport.classList.remove('is-grabbing');
    }
  }

  /**
   * @param {WheelEvent} event
   * @returns {void}
   */
  function onWheel(event) {
    const target = event.target;
    if (target instanceof Element && target.closest('.canvas-tools, .face-rail, input, textarea, select')) {
      return;
    }
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.08 : 1 / 1.08;
    setUserZoom(userZoom * factor);
  }

  /**
   * @returns {number}
   */
  function pointerDistance() {
    const points = [...pointers.values()];
    if (points.length < 2) {
      return 0;
    }
    return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
  }

  return {
    setPanEnabled,
    isPanEnabled: () => panEnabled,
    zoomBy(factor) {
      setUserZoom(userZoom * factor);
    },
    resetView() {
      userZoom = 1;
      panX = 0;
      panY = 0;
      applyTransform();
    },
    getUserZoom: () => userZoom,
    applyTransform,
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
