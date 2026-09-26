import { createCardCanvas, createViewportController } from './canvas/createCardCanvas.js';
import { createObjectSnapping } from './canvas/objectSnapping.js';
import { CARD_BACKGROUND, MAX_USER_ZOOM, MIN_USER_ZOOM, SAFE_INSET_PX } from './constants.js';
import { createProjectId, parseCardDocument, serializeDocument } from './domain/document.js';
import { applyProfileToCanvas, createEmptyProfile, normalizeProfile, profileHasIdentity, relinkPrintedText } from './domain/profile.js';
import { printIssues } from './domain/printCheck.js';
import { qrHealthNote, smallestQrPx } from './domain/qrHealth.js';
import { countUnsafeObjects } from './domain/safeArea.js';
import { canvasHasUserContent, snapshotHasContent, snapshotLinksProfile } from './domain/serialize.js';
import { buildVCard } from './domain/vcard.js';
import { contactDownloadName, createDownloadStem, faceDownloadName, readPrintedIdentity, resolveDownloadIdentity, sheetDownloadName } from './export/downloadName.js';
import { downloadBlob, exportActiveFace, exportBothFaces, shareFiles } from './export/exportPng.js';
import { renderPrintSheet } from './export/printSheet.js';
import { captureActiveFace, createCardState, switchFace } from './state/cardState.js';
import { createHistoryManager } from './state/history.js';
import { archiveCard, listCardSummaries, peekSavedCard, removeSavedCard } from './state/library.js';
import {
  applyImportedDocument,
  hasCompletedOnboarding,
  markOnboardingComplete,
  restoreCardDocument,
  saveCardDocument,
} from './state/persistence.js';
import './style.css';
import { addContactIcon } from './tools/icons.js';
import {
  alignSelectionToCard,
  addEllipse,
  addEmailField,
  addImageObject,
  addLogoObject,
  addNameField,
  addPhoneField,
  addRectangle,
  addText,
  addTitleField,
  COLOR_PRESETS,
  deleteSelection,
  duplicateSelection,
  flipSelection,
  FONTS,
  cropSelectedImage,
  getBackgroundFillZoom,
  getSelectionTransform,
  isTextObject,
  moveSelectionLayer,
  nudgeSelection,
  setBackgroundFillZoom,
  setCanvasBackgroundColor,
  setBackgroundImage,
  setSelectedImageScale,
  setSelectionCardRole,
  setSelectionCornerRadius,
  setSelectionFill,
  setSelectionFont,
  setSelectionOpacity,
  setSelectionStroke,
  setSelectionStrokeWidth,
  setSelectionText,
  setSelectionTextProperty,
  setSelectionTransform,
  toggleSelectionItalic,
  toggleSelectionLock,
} from './tools/objects.js';
import { removeSelectedImageBackground } from './tools/imageProcessing.js';
import { buildQrPayload, canBuildQrPayload, syncQrObjects } from './tools/qr.js';
import { applyCardTemplate, isFrontTemplate, matchingBackName } from './tools/templates.js';
import { createAppDialog } from './ui/appDialog.js';
import { createFaceRail } from './ui/faceRail.js';
import { createFlipPreview } from './ui/flipPreview.js';
import { createImageCropper } from './ui/imageCrop.js';
import { createLayerList } from './ui/layers.js';
import { createLibraryDialog } from './ui/libraryDialog.js';
import { createOnboarding } from './ui/onboarding.js';
import { createShareModal } from './ui/shareModal.js';
import { createShortcutsHelp } from './ui/shortcuts.js';
import { createTapPreview } from './ui/tapPreview.js';

const canvasElement = document.querySelector('#card-canvas');
const viewport = document.querySelector('#viewport');
const stage = document.querySelector('#stage');
const safeGuide = document.querySelector('#safe-guide');
const verticalGuide = document.querySelector('#guide-x');
const horizontalGuide = document.querySelector('#guide-y');
const sidebar = document.querySelector('#sidebar');
const sidebarToggle = document.querySelector('#sidebar-toggle');
const sidebarBackdrop = document.querySelector('#sidebar-backdrop');
const shareDialog = document.querySelector('#share-dialog');
const cropDialog = document.querySelector('#crop-dialog');
const appDialog = document.querySelector('#app-dialog');
const onboardingDialog = document.querySelector('#onboarding-dialog');
const tapDialog = document.querySelector('#tap-dialog');
const flipDialog = document.querySelector('#flip-dialog');
const shortcutsDialog = document.querySelector('#shortcuts-dialog');
const libraryDialog = document.querySelector('#library-dialog');
const statusEl = document.querySelector('#status');

if (
  !(canvasElement instanceof HTMLCanvasElement) ||
  !(viewport instanceof HTMLElement) ||
  !(stage instanceof HTMLElement) ||
  !(safeGuide instanceof HTMLElement) ||
  !(verticalGuide instanceof HTMLElement) ||
  !(horizontalGuide instanceof HTMLElement) ||
  !(sidebar instanceof HTMLElement) ||
  !(sidebarToggle instanceof HTMLButtonElement) ||
  !(sidebarBackdrop instanceof HTMLButtonElement) ||
  !(shareDialog instanceof HTMLDialogElement) ||
  !(cropDialog instanceof HTMLDialogElement) ||
  !(appDialog instanceof HTMLDialogElement) ||
  !(onboardingDialog instanceof HTMLDialogElement) ||
  !(tapDialog instanceof HTMLDialogElement) ||
  !(flipDialog instanceof HTMLDialogElement) ||
  !(shortcutsDialog instanceof HTMLDialogElement) ||
  !(libraryDialog instanceof HTMLDialogElement) ||
  !(statusEl instanceof HTMLElement)
) {
  throw new Error('[App] Required layout elements are missing');
}

safeGuide.style.inset = `${SAFE_INSET_PX}px`;

const canvas = createCardCanvas(canvasElement);
stage.append(safeGuide);
createObjectSnapping(canvas, verticalGuide, horizontalGuide);

const state = createCardState();
const shareModal = createShareModal(shareDialog);
const imageCropper = createImageCropper(cropDialog);
const appModal = createAppDialog(appDialog);
const tapPreview = createTapPreview(tapDialog);
const flipPreview = createFlipPreview(flipDialog);
const shortcutsHelp = createShortcutsHelp(shortcutsDialog);
const libraryUi = createLibraryDialog(libraryDialog);
const onboarding = createOnboarding(onboardingDialog, {
  templates: [
    { id: 'editorial', label: 'Editorial', hint: 'Elegant type' },
    { id: 'signal', label: 'Signal', hint: 'Bold contrast' },
    { id: 'minimal', label: 'Minimal', hint: 'Quiet confidence' },
    { id: 'orchid', label: 'Orchid', hint: 'Creative profile' },
    { id: 'luxe', label: 'Luxe', hint: 'Refined classic' },
    { id: 'grid', label: 'Grid', hint: 'Tech forward' },
    { id: 'studio', label: 'Studio', hint: 'Bright & bold' },
    { id: 'monogram', label: 'Monogram', hint: 'Personal mark' },
  ],
});
const mobileQuery = window.matchMedia('(max-width: 1088px)');
let nudgeStep = 1;
let exportBusy = false;
let statusTimer = 0;
let saveTimer = 0;
let persistenceReady = false;
let profileSyncing = false;
/** @type {import('./domain/profile.js').CardProfile} */
let profile = createEmptyProfile();
let appliedProfile = createEmptyProfile();
/** @type {Record<'front' | 'back', { entries: string[], index: number } | null>} */
const historyStacks = { front: null, back: null };
/** @type {import('fabric').FabricObject | null} */
let clipboardObject = null;
/** @type {ReturnType<typeof createHistoryManager> | null} */
let history = null;
/** @type {ReturnType<typeof createLayerList> | null} */
let layerList = null;
/** @type {ReturnType<typeof createFaceRail> | null} */
let faceRail = null;

const header = document.querySelector('header');
if (header instanceof HTMLElement) {
  const headerObserver = new ResizeObserver(() => {
    document.documentElement.style.setProperty('--header-h', `${header.offsetHeight}px`);
  });
  headerObserver.observe(header);
}

const viewportController = createViewportController(viewport, stage, canvas, (zoom) => {
  const label = document.querySelector('#zoom-label');
  const zoomOut = document.querySelector('#zoom-out');
  const zoomIn = document.querySelector('#zoom-in');
  if (label) {
    label.textContent = `${Math.round(zoom * 100)}%`;
  }
  if (zoomOut instanceof HTMLButtonElement) {
    zoomOut.disabled = zoom <= MIN_USER_ZOOM + 0.001;
  }
  if (zoomIn instanceof HTMLButtonElement) {
    zoomIn.disabled = zoom >= MAX_USER_ZOOM - 0.001;
  }
});

try {
  history = createHistoryManager(canvas, onDocumentChanged);
  layerList = createLayerList(mustElement('#layer-list'), canvas, {
    onMutate() {
      history?.record();
      syncInspector();
    },
  });
  faceRail = createFaceRail((face) => {
    void changeFace(face);
  });
  populateFonts();
  populateColorPresets();
  syncSidebarForViewport();
  syncInspector();
  bindChrome();
  bindTools();
  bindInspector();
  bindProfile();
  bindKeys();
  void initializeDocument();
} catch (error) {
  const message = error instanceof Error ? `${error.message}` : 'The studio failed to start';
  document.documentElement.dataset.bootError = message;
  if (statusEl) {
    statusEl.textContent = message;
    statusEl.classList.remove('hidden');
  }
}

canvas.on('selection:created', syncInspector);
canvas.on('selection:updated', syncInspector);
canvas.on('selection:cleared', syncInspector);
canvas.on('object:modified', syncInspector);
canvas.on('text:changed', syncInspector);
canvas.on('object:moving', syncInspector);
canvas.on('object:scaling', syncInspector);
canvas.on('object:rotating', showRotationBadge);
canvas.on('object:modified', hideRotationBadge);
canvas.on('mouse:up', hideRotationBadge);

mobileQuery.addEventListener('change', syncSidebarForViewport);

/**
 * @param {string} message
 * @returns {void}
 */
function setStatus(message) {
  statusEl.textContent = message;
  statusEl.classList.remove('hidden');
  window.clearTimeout(statusTimer);
  statusTimer = window.setTimeout(() => {
    statusEl.classList.add('hidden');
  }, 4000);
}

/**
 * @param {unknown} error
 * @returns {void}
 */
function reportError(error) {
  const message = error instanceof Error ? error.message : 'Something went wrong';
  setStatus(message);
}

/**
 * Restores the last design after all controllers are ready.
 * @returns {Promise<void>}
 */
async function initializeDocument() {
  try {
    const restored = await restoreCardDocument(canvas, state);
    profile = restored.profile;
    appliedProfile = { ...profile };
    paintProfileFields();
    paintProjectName();
    syncFaceControls();
    history?.reset();
    syncInspector();
    viewportController.applyTransform();
    const hasDesign = canvasHasUserContent(canvas) || snapshotHasContent(state.snapshots.front) || snapshotHasContent(state.snapshots.back);
    if (restored.restored && hasDesign) {
      setStatus('Your last design was restored');
    } else if (!hasCompletedOnboarding()) {
      await runOnboarding();
    }
    persistenceReady = true;
    onDocumentChanged();
    refreshFaceThumbs();
  } catch (error) {
    persistenceReady = true;
    reportError(error);
  }
}

/**
 * Updates history controls and schedules local persistence.
 * @returns {void}
 */
function onDocumentChanged() {
  syncHistoryControls();
  if (!persistenceReady) {
    return;
  }
  const indicator = document.querySelector('#save-indicator');
  if (indicator) {
    indicator.textContent = 'Saving…';
  }
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    try {
      saveCardDocument(canvas, state, profile);
      if (indicator) {
        indicator.textContent = 'Saved locally';
      }
      faceRail?.paintLive(state.activeFace, canvas);
    } catch (error) {
      if (indicator) {
        indicator.textContent = 'Save failed';
      }
      reportError(error);
    }
  }, 450);
}

/**
 * @returns {void}
 */
function syncHistoryControls() {
  const undoButton = document.querySelector('#undo-action');
  const redoButton = document.querySelector('#redo-action');
  if (undoButton instanceof HTMLButtonElement) {
    undoButton.disabled = !history?.canUndo();
  }
  if (redoButton instanceof HTMLButtonElement) {
    redoButton.disabled = !history?.canRedo();
  }
}

/**
 * @returns {void}
 */
function populateFonts() {
  const select = document.querySelector('#font-select');
  if (!(select instanceof HTMLSelectElement)) {
    return;
  }
  FONTS.forEach((font) => {
    const option = document.createElement('option');
    option.value = font;
    option.textContent = font;
    option.style.fontFamily = font;
    select.append(option);
  });
}

/**
 * @returns {void}
 */
function populateColorPresets() {
  const group = document.querySelector('#color-presets');
  if (!(group instanceof HTMLElement)) {
    return;
  }
  COLOR_PRESETS.forEach((color) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'color-swatch';
    button.style.backgroundColor = color;
    button.dataset.color = color;
    button.setAttribute('aria-label', `Use color ${color}`);
    group.append(button);
  });
}

/**
 * @returns {string}
 */
function currentFill() {
  const input = document.querySelector('#color-input');
  if (input instanceof HTMLInputElement && input.value) {
    return input.value;
  }
  return '#1A1A1A';
}

/**
 * @returns {void}
 */
function syncInspector() {
  paintQrHealth();
  paintSafeArea();
  paintPrintCheck();
  const object = canvas.getActiveObject();
  const fontSelect = document.querySelector('#font-select');
  const fontSize = document.querySelector('#font-size');
  const fontWeight = document.querySelector('#font-weight');
  const charSpacing = document.querySelector('#char-spacing');
  const charSpacingValue = document.querySelector('#char-spacing-value');
  const colorInput = document.querySelector('#color-input');
  const opacityInput = document.querySelector('#opacity-input');
  const opacityValue = document.querySelector('#opacity-value');
  const backgroundColorInput = document.querySelector('#background-color');
  const scaleSection = document.querySelector('#image-scale-section');
  const selectionLabel = document.querySelector('#selection-label');
  const typeEmpty = document.querySelector('#type-empty');
  const typeControls = document.querySelector('#type-controls');
  const arrangeEmpty = document.querySelector('#arrange-empty');
  const arrangeControls = document.querySelector('#arrange-controls');
  const lockButton = document.querySelector('#lock-object');
  const transform = getSelectionTransform(canvas);
  const textSelected = Boolean(object && isTextObject(object));
  const fillSelected = Boolean(object && (textSelected || object.type === 'rect' || object.type === 'ellipse'));
  const imageSelected = Boolean(object && object.type === 'image');

  if (selectionLabel) {
    selectionLabel.textContent = object ? selectionName(object.type) : 'Nothing selected';
  }
  if (typeEmpty instanceof HTMLElement && typeControls instanceof HTMLElement) {
    typeEmpty.hidden = textSelected;
    typeControls.hidden = !textSelected;
  }
  if (arrangeEmpty instanceof HTMLElement && arrangeControls instanceof HTMLElement) {
    arrangeEmpty.hidden = Boolean(object);
    arrangeControls.hidden = !object;
  }

  if (fontSelect instanceof HTMLSelectElement) {
    fontSelect.disabled = !textSelected;
    if (textSelected && typeof object.fontFamily === 'string') {
      fontSelect.value = object.fontFamily;
    }
  }

  if (fontSize instanceof HTMLInputElement) {
    fontSize.disabled = !textSelected;
    fontSize.value = textSelected ? String(Math.round(object.fontSize ?? 64)) : '64';
  }
  if (fontWeight instanceof HTMLSelectElement) {
    fontWeight.disabled = !textSelected;
    fontWeight.value = textSelected ? String(object.fontWeight ?? 400) : '400';
  }
  if (charSpacing instanceof HTMLInputElement && charSpacingValue instanceof HTMLOutputElement) {
    const spacing = textSelected ? Number(object.charSpacing ?? 0) : 0;
    charSpacing.disabled = !textSelected;
    charSpacing.value = String(spacing);
    charSpacingValue.value = String(spacing);
  }

  if (colorInput instanceof HTMLInputElement) {
    colorInput.disabled = !fillSelected;
    if (fillSelected && typeof object.fill === 'string' && /^#[0-9a-fA-F]{6}$/.test(object.fill)) {
      colorInput.value = object.fill;
    }
  }

  if (opacityInput instanceof HTMLInputElement && opacityValue instanceof HTMLOutputElement) {
    const percent = Math.round((object?.opacity ?? 1) * 100);
    opacityInput.disabled = !object;
    opacityInput.value = String(percent);
    opacityValue.value = `${percent}%`;
  }

  if (
    backgroundColorInput instanceof HTMLInputElement &&
    typeof canvas.backgroundColor === 'string' &&
    /^#[0-9a-fA-F]{6}$/.test(canvas.backgroundColor)
  ) {
    backgroundColorInput.value = canvas.backgroundColor;
  }

  if (scaleSection instanceof HTMLElement) {
    scaleSection.hidden = !imageSelected;
  }

  const textContent = document.querySelector('#text-content');
  if (textContent instanceof HTMLTextAreaElement) {
    textContent.disabled = !textSelected;
    if (document.activeElement !== textContent) {
      textContent.value = textSelected && typeof object.text === 'string' ? object.text : '';
    }
  }
  const textRole = document.querySelector('#text-role');
  if (textRole instanceof HTMLSelectElement) {
    textRole.disabled = !textSelected;
    textRole.value = textSelected && typeof object.cardRole === 'string' ? object.cardRole : '';
  }
  const italicToggle = document.querySelector('#italic-toggle');
  if (italicToggle instanceof HTMLButtonElement) {
    italicToggle.disabled = !textSelected;
    italicToggle.setAttribute('aria-pressed', String(textSelected && object.fontStyle === 'italic'));
  }
  const lineHeight = document.querySelector('#line-height');
  const lineHeightValue = document.querySelector('#line-height-value');
  if (lineHeight instanceof HTMLInputElement && lineHeightValue instanceof HTMLOutputElement) {
    const height = textSelected ? Number(object.lineHeight ?? 1) : 1;
    lineHeight.disabled = !textSelected;
    lineHeight.value = String(Math.round(height * 100));
    lineHeightValue.value = height.toFixed(2);
  }

  const shapeSelected = Boolean(object && (object.type === 'rect' || object.type === 'ellipse' || object.type === 'circle'));
  const strokeSection = document.querySelector('#stroke-section');
  if (strokeSection instanceof HTMLElement) {
    strokeSection.hidden = !shapeSelected;
  }
  const strokeColor = document.querySelector('#stroke-color');
  const strokeWidth = document.querySelector('#stroke-width');
  if (strokeColor instanceof HTMLInputElement) {
    strokeColor.disabled = !shapeSelected;
    if (shapeSelected && typeof object.stroke === 'string' && /^#[0-9a-fA-F]{6}$/.test(object.stroke)) {
      strokeColor.value = object.stroke;
    }
  }
  if (strokeWidth instanceof HTMLInputElement) {
    strokeWidth.disabled = !shapeSelected;
    strokeWidth.value = shapeSelected ? String(Math.round(object.strokeWidth ?? 0)) : '0';
  }
  const cornerRow = document.querySelector('#corner-radius-row');
  const cornerRadius = document.querySelector('#corner-radius');
  const cornerValue = document.querySelector('#corner-radius-value');
  const isRect = Boolean(object && object.type === 'rect');
  if (cornerRow instanceof HTMLElement) {
    cornerRow.hidden = !isRect;
  }
  if (cornerRadius instanceof HTMLInputElement && cornerValue instanceof HTMLOutputElement) {
    const radius = isRect ? Number(object.rx ?? 0) : 0;
    cornerRadius.disabled = !isRect;
    cornerRadius.value = String(radius);
    cornerValue.value = String(Math.round(radius));
  }

  const emptyCanvas = document.querySelector('#empty-canvas');
  if (emptyCanvas instanceof HTMLElement) {
    emptyCanvas.hidden = canvasHasUserContent(canvas);
  }

  document.querySelectorAll('[data-when="image"]').forEach((element) => {
    if (element instanceof HTMLElement) {
      element.hidden = !imageSelected;
    }
  });
  document.querySelectorAll('[data-when="fill"]').forEach((element) => {
    if (element instanceof HTMLElement) {
      element.hidden = getBackgroundFillZoom(canvas) === null;
    }
  });
  layerList?.render();
  if (imageSelected) {
    paintImageZoom(clamp(Math.round((object.scaleX ?? 1) * 100), 10, 400));
  }
  paintFillZoom(getBackgroundFillZoom(canvas));

  if (lockButton instanceof HTMLButtonElement) {
    const locked = Boolean(object?.lockMovementX);
    lockButton.disabled = !object;
    lockButton.setAttribute('aria-pressed', String(locked));
    lockButton.textContent = locked ? 'Unlock' : 'Lock';
  }

  document.querySelectorAll('[data-transform]').forEach((input) => {
    if (!(input instanceof HTMLInputElement)) {
      return;
    }
    input.disabled = !transform;
    if (transform && input.dataset.transform && input.dataset.transform in transform) {
      input.value = String(transform[input.dataset.transform]);
    }
  });

  document.querySelectorAll('[data-text-align]').forEach((button) => {
    if (button instanceof HTMLButtonElement) {
      button.disabled = !textSelected;
      button.setAttribute('aria-pressed', String(textSelected && button.dataset.textAlign === (object.textAlign ?? 'left')));
    }
  });
}

/**
 * Shows a live degree readout beside the rotation pointer.
 * @param {{ target?: import('fabric').FabricObject, e?: Event }} event
 * @returns {void}
 */
function showRotationBadge(event) {
  const badge = document.querySelector('#rotation-badge');
  if (!(badge instanceof HTMLOutputElement) || !event.target) {
    return;
  }
  const pointerEvent = event.e;
  if (pointerEvent instanceof MouseEvent || pointerEvent instanceof PointerEvent) {
    badge.style.left = `${pointerEvent.clientX + 16}px`;
    badge.style.top = `${pointerEvent.clientY - 38}px`;
  }
  const angle = Math.round(((event.target.angle ?? 0) + 360) % 360);
  badge.value = `${angle}°`;
  badge.hidden = false;
  syncInspector();
}

/**
 * @returns {void}
 */
function hideRotationBadge() {
  const badge = document.querySelector('#rotation-badge');
  if (badge instanceof HTMLOutputElement) {
    badge.hidden = true;
  }
}

/**
 * @param {string | undefined} type
 * @returns {string}
 */
function selectionName(type) {
  const names = {
    'i-text': 'Text selected',
    text: 'Text selected',
    textbox: 'Text selected',
    image: 'Image selected',
    rect: 'Shape selected',
    ellipse: 'Shape selected',
    circle: 'Shape selected',
  };
  return names[type] ?? 'Object selected';
}

/**
 * @returns {void}
 */
function bindChrome() {
  sidebarToggle.addEventListener('click', () => {
    setSidebarOpen(sidebar.dataset.open !== 'true');
  });
  sidebarBackdrop.addEventListener('click', () => {
    setSidebarOpen(false);
  });

  document.querySelector('.tool-tabs')?.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const tab = target.closest('[data-tool-tab]')?.getAttribute('data-tool-tab');
    if (tab) {
      selectToolTab(tab);
    }
  });

  document.querySelector('#undo-action')?.addEventListener('click', () => {
    void runHistoryAction('undo');
  });
  document.querySelector('#redo-action')?.addEventListener('click', () => {
    void runHistoryAction('redo');
  });

  document.querySelector('#face-front')?.addEventListener('click', () => {
    void changeFace('front');
  });
  document.querySelector('#face-back')?.addEventListener('click', () => {
    void changeFace('back');
  });

  document.querySelector('#pan-toggle')?.addEventListener('click', () => {
    const next = !viewportController.isPanEnabled();
    viewportController.setPanEnabled(next);
    const button = document.querySelector('#pan-toggle');
    if (button instanceof HTMLButtonElement) {
      button.setAttribute('aria-pressed', String(next));
    }
    syncInspector();
  });

  document.querySelector('#zoom-in')?.addEventListener('click', () => viewportController.zoomBy(1.25));
  document.querySelector('#zoom-out')?.addEventListener('click', () => viewportController.zoomBy(1 / 1.25));
  document.querySelector('#zoom-reset')?.addEventListener('click', () => viewportController.resetView());

  const exportToggle = document.querySelector('#export-toggle');
  const exportMenu = document.querySelector('#export-menu');
  exportToggle?.addEventListener('click', () => {
    if (!(exportMenu instanceof HTMLElement) || !(exportToggle instanceof HTMLButtonElement)) {
      return;
    }
    const open = exportMenu.classList.toggle('hidden') === false;
    exportToggle.setAttribute('aria-expanded', String(open));
  });
  exportMenu?.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const action = target.closest('[data-export]')?.getAttribute('data-export');
    if (!action) {
      return;
    }
    closeExportMenu();
    void runExport(action);
  });
  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Node)) {
      return;
    }
    if (exportMenu instanceof HTMLElement && exportToggle instanceof HTMLElement && !exportMenu.contains(target) && !exportToggle.contains(target)) {
      closeExportMenu();
    }
    if (projectMenu instanceof HTMLElement && projectToggle instanceof HTMLElement && !projectMenu.contains(target) && !projectToggle.contains(target)) {
      closeProjectMenu();
    }
  });

  document.querySelector('#preview-flip')?.addEventListener('click', () => {
    void openFlipPreview();
  });

  const projectToggle = document.querySelector('#project-toggle');
  const projectMenu = document.querySelector('#project-menu');
  projectToggle?.addEventListener('click', () => {
    if (!(projectMenu instanceof HTMLElement) || !(projectToggle instanceof HTMLButtonElement)) {
      return;
    }
    const open = projectMenu.classList.toggle('hidden') === false;
    projectToggle.setAttribute('aria-expanded', String(open));
  });
  projectMenu?.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const action = target.closest('[data-project]')?.getAttribute('data-project');
    if (!action) {
      return;
    }
    closeProjectMenu();
    void runProjectAction(action);
  });

  document.querySelector('#empty-open-you')?.addEventListener('click', () => {
    selectToolTab('you');
    setSidebarOpen(true);
  });
  document.querySelector('#empty-open-add')?.addEventListener('click', () => {
    selectToolTab('add');
    setSidebarOpen(true);
  });

  document.querySelector('#guides-toggle')?.addEventListener('change', (event) => {
    const input = event.target;
    if (input instanceof HTMLInputElement) {
      safeGuide.hidden = !input.checked;
    }
  });

  window.visualViewport?.addEventListener('resize', () => viewportController.applyTransform());
  window.addEventListener('orientationchange', () => {
    window.requestAnimationFrame(() => viewportController.applyTransform());
  });
}

/**
 * @param {string} tab
 * @returns {void}
 */
function selectToolTab(tab) {
  sidebar.dataset.activeTab = tab;
  sidebar.querySelectorAll('[data-tool-tab]').forEach((button) => {
    button.setAttribute('aria-selected', String(button.getAttribute('data-tool-tab') === tab));
  });
  sidebar.querySelectorAll('[data-tool-panel]').forEach((panel) => {
    panel.toggleAttribute('hidden', panel.getAttribute('data-tool-panel') !== tab);
  });
}

/**
 * @param {'undo' | 'redo'} action
 * @returns {Promise<void>}
 */
async function runHistoryAction(action) {
  if (!history) {
    return;
  }
  try {
    const changed = action === 'undo' ? await history.undo() : await history.redo();
    if (changed) {
      syncInspector();
      setStatus(action === 'undo' ? 'Change undone' : 'Change restored');
    }
  } catch (error) {
    reportError(error);
  }
}

/**
 * @param {boolean} open
 * @returns {void}
 */
function setSidebarOpen(open) {
  sidebar.dataset.open = String(open);
  sidebarToggle.setAttribute('aria-expanded', String(open));
  sidebar.toggleAttribute('inert', !open);
  const showBackdrop = open && mobileQuery.matches;
  sidebarBackdrop.hidden = !showBackdrop;
  sidebarBackdrop.dataset.open = String(showBackdrop);
}

/**
 * @returns {void}
 */
function syncSidebarForViewport() {
  if (mobileQuery.matches) {
    setSidebarOpen(false);
    return;
  }
  setSidebarOpen(true);
  sidebarBackdrop.hidden = true;
}

/**
 * @returns {void}
 */
function closeExportMenu() {
  document.querySelector('#export-menu')?.classList.add('hidden');
  document.querySelector('#export-toggle')?.setAttribute('aria-expanded', 'false');
}

/**
 * @returns {void}
 */
function closeProjectMenu() {
  document.querySelector('#project-menu')?.classList.add('hidden');
  document.querySelector('#project-toggle')?.setAttribute('aria-expanded', 'false');
}

/**
 * @param {'front' | 'back'} face
 * @returns {Promise<void>}
 */
async function changeFace(face) {
  if (face === state.activeFace) {
    return;
  }
  try {
    viewportController.setPanEnabled(false);
    document.querySelector('#pan-toggle')?.setAttribute('aria-pressed', 'false');
    if (history) {
      historyStacks[state.activeFace] = history.exportStack();
    }
    faceRail?.paintLive(state.activeFace, canvas);
    await switchFace(canvas, state, face);
    faceRail?.paintLive(state.activeFace, canvas);
    syncFaceControls();
    if (historyStacks[face]) {
      history?.importStack(historyStacks[face]);
    } else {
      history?.reset();
    }
    syncInspector();
    setStatus(`${face === 'front' ? 'Front' : 'Back'} face`);
  } catch (error) {
    reportError(error);
  }
}

/**
 * @returns {void}
 */
function syncFaceControls() {
  const isFront = state.activeFace === 'front';
  document.querySelector('#face-front')?.setAttribute('aria-pressed', String(isFront));
  document.querySelector('#face-back')?.setAttribute('aria-pressed', String(!isFront));
  faceRail?.setActive(state.activeFace);
  const faceLabel = document.querySelector('#face-label');
  if (faceLabel) {
    faceLabel.textContent = isFront ? 'Front face' : 'Back face';
  }
}

/**
 * @returns {void}
 */
function bindTools() {
  document.querySelector('.template-list')?.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const template = target.closest('[data-template]')?.getAttribute('data-template');
    if (!template) {
      return;
    }
    void applyTemplateChoice(template);
  });

  document.querySelector('#add-text')?.addEventListener('click', () => {
    exitPan();
    addText(canvas, 'Text', { left: 80, top: 80, fontSize: 64, fill: currentFill() });
    syncInspector();
  });
  document.querySelector('#add-name')?.addEventListener('click', () => {
    exitPan();
    addNameField(canvas, currentFill(), profile.fullName || 'Name');
    syncInspector();
  });
  document.querySelector('#add-title')?.addEventListener('click', () => {
    exitPan();
    addTitleField(canvas, currentFill(), profile.title || 'Title');
    syncInspector();
  });
  document.querySelector('#add-email')?.addEventListener('click', () => {
    exitPan();
    addEmailField(canvas, currentFill(), profile.email || 'name@email.com');
    syncInspector();
  });
  document.querySelector('#add-phone')?.addEventListener('click', () => {
    exitPan();
    addPhoneField(canvas, currentFill(), profile.phone || '+65 8123 4567');
    syncInspector();
  });
  document.querySelector('#add-qr-tool')?.addEventListener('click', () => {
    void addOrRefreshQr();
  });
  document.querySelector('#add-icon-phone')?.addEventListener('click', () => {
    exitPan();
    addContactIcon(canvas, 'phone', currentFill());
    syncInspector();
  });
  document.querySelector('#add-icon-email')?.addEventListener('click', () => {
    exitPan();
    addContactIcon(canvas, 'email', currentFill());
    syncInspector();
  });
  document.querySelector('#add-icon-web')?.addEventListener('click', () => {
    exitPan();
    addContactIcon(canvas, 'web', currentFill());
    syncInspector();
  });
  document.querySelector('#add-rect')?.addEventListener('click', () => {
    exitPan();
    addRectangle(canvas, currentFill());
    syncInspector();
  });
  document.querySelector('#add-ellipse')?.addEventListener('click', () => {
    exitPan();
    addEllipse(canvas, currentFill());
    syncInspector();
  });

  const logoInput = document.querySelector('#logo-input');
  const imageInput = document.querySelector('#image-input');
  const backgroundInput = document.querySelector('#background-input');
  const imageDropzone = document.querySelector('#image-dropzone');
  document.querySelector('#add-logo')?.addEventListener('click', () => {
    if (logoInput instanceof HTMLInputElement) {
      logoInput.click();
    }
  });
  document.querySelector('#add-image')?.addEventListener('click', () => {
    if (imageInput instanceof HTMLInputElement) {
      imageInput.click();
    }
  });
  document.querySelector('#set-background')?.addEventListener('click', () => {
    if (backgroundInput instanceof HTMLInputElement) {
      backgroundInput.click();
    }
  });
  logoInput?.addEventListener('change', (event) => {
    void importImage(event, 'logo');
  });
  imageInput?.addEventListener('change', (event) => {
    void importImage(event, 'object');
  });
  backgroundInput?.addEventListener('change', (event) => {
    void importImage(event, 'background');
  });
  imageDropzone?.addEventListener('click', () => {
    if (imageInput instanceof HTMLInputElement) {
      imageInput.click();
    }
  });
  imageDropzone?.addEventListener('dragover', (event) => {
    event.preventDefault();
    imageDropzone.classList.add('is-dragging');
  });
  imageDropzone?.addEventListener('dragleave', () => {
    imageDropzone.classList.remove('is-dragging');
  });
  imageDropzone?.addEventListener('drop', (event) => {
    event.preventDefault();
    imageDropzone.classList.remove('is-dragging');
    const file = event.dataTransfer?.files[0];
    if (file) {
      void importImageFile(file, 'object');
    }
  });
}

/**
 * @param {Event} event
 * @param {'object' | 'background' | 'logo'} mode
 * @returns {Promise<void>}
 */
async function importImage(event, mode) {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || !input.files?.[0]) {
    return;
  }
  const file = input.files[0];
  input.value = '';
  await importImageFile(file, mode);
}

/**
 * @param {File} file
 * @param {'object' | 'background' | 'logo'} mode
 * @returns {Promise<void>}
 */
async function importImageFile(file, mode) {
  if (!file.type.startsWith('image/')) {
    reportError(new Error('[ImageImport] Choose a PNG, JPG, WebP, or SVG image'));
    return;
  }
  try {
    exitPan();
    if (mode === 'background') {
      await setBackgroundImage(canvas, file);
      setStatus('Background image added');
    } else if (mode === 'logo') {
      await addLogoObject(canvas, file);
      setStatus('Logo added');
    } else {
      await addImageObject(canvas, file);
      setStatus('Image added');
    }
    history?.record();
    syncInspector();
  } catch (error) {
    reportError(error);
  }
}

/**
 * @returns {void}
 */
function exitPan() {
  if (!viewportController.isPanEnabled()) {
    return;
  }
  viewportController.setPanEnabled(false);
  document.querySelector('#pan-toggle')?.setAttribute('aria-pressed', 'false');
}

/**
 * @returns {void}
 */
function bindInspector() {
  document.querySelector('#text-content')?.addEventListener('input', (event) => {
    const input = event.target;
    if (input instanceof HTMLTextAreaElement) {
      setSelectionText(canvas, input.value);
    }
  });
  document.querySelector('#text-content')?.addEventListener('change', () => history?.record());
  document.querySelector('#text-role')?.addEventListener('change', (event) => {
    const select = event.target;
    if (select instanceof HTMLSelectElement) {
      setSelectionCardRole(canvas, select.value);
      history?.record();
    }
  });
  document.querySelector('#italic-toggle')?.addEventListener('click', () => {
    const italic = toggleSelectionItalic(canvas);
    if (italic === null) {
      return;
    }
    history?.record();
    syncInspector();
  });
  document.querySelector('#line-height')?.addEventListener('input', (event) => {
    const input = event.target;
    const output = document.querySelector('#line-height-value');
    if (input instanceof HTMLInputElement) {
      const height = Number(input.value) / 100;
      setSelectionTextProperty(canvas, 'lineHeight', height);
      if (output instanceof HTMLOutputElement) {
        output.value = height.toFixed(2);
      }
    }
  });
  document.querySelector('#line-height')?.addEventListener('change', () => history?.record());
  document.querySelector('#stroke-color')?.addEventListener('input', (event) => {
    const input = event.target;
    if (input instanceof HTMLInputElement) {
      setSelectionStroke(canvas, input.value);
    }
  });
  document.querySelector('#stroke-color')?.addEventListener('change', () => history?.record());
  document.querySelector('#stroke-width')?.addEventListener('change', (event) => {
    const input = event.target;
    if (input instanceof HTMLInputElement) {
      setSelectionStrokeWidth(canvas, Number(input.value));
      history?.record();
    }
  });
  document.querySelector('#corner-radius')?.addEventListener('input', (event) => {
    const input = event.target;
    const output = document.querySelector('#corner-radius-value');
    if (input instanceof HTMLInputElement) {
      setSelectionCornerRadius(canvas, Number(input.value));
      if (output instanceof HTMLOutputElement) {
        output.value = input.value;
      }
    }
  });
  document.querySelector('#corner-radius')?.addEventListener('change', () => history?.record());

  document.querySelector('#font-select')?.addEventListener('change', (event) => {
    const select = event.target;
    if (select instanceof HTMLSelectElement) {
      setSelectionFont(canvas, select.value);
      history?.record();
    }
  });

  document.querySelector('#color-input')?.addEventListener('input', (event) => {
    const input = event.target;
    if (input instanceof HTMLInputElement) {
      setSelectionFill(canvas, input.value);
    }
  });
  document.querySelector('#color-input')?.addEventListener('change', () => history?.record());

  document.querySelector('#font-size')?.addEventListener('change', (event) => {
    const input = event.target;
    if (input instanceof HTMLInputElement) {
      const size = clamp(Number(input.value), 8, 300);
      setSelectionTextProperty(canvas, 'fontSize', size);
      history?.record();
      syncInspector();
    }
  });

  document.querySelector('#font-weight')?.addEventListener('change', (event) => {
    const select = event.target;
    if (select instanceof HTMLSelectElement) {
      setSelectionTextProperty(canvas, 'fontWeight', Number(select.value));
      history?.record();
    }
  });

  document.querySelector('[data-tool-panel="type"]')?.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const alignment = target.closest('[data-text-align]')?.getAttribute('data-text-align');
    if (alignment) {
      setSelectionTextProperty(canvas, 'textAlign', alignment);
      history?.record();
      syncInspector();
    }
  });

  document.querySelector('#char-spacing')?.addEventListener('input', (event) => {
    const input = event.target;
    const output = document.querySelector('#char-spacing-value');
    if (input instanceof HTMLInputElement) {
      setSelectionTextProperty(canvas, 'charSpacing', Number(input.value));
      if (output instanceof HTMLOutputElement) {
        output.value = input.value;
      }
    }
  });
  document.querySelector('#char-spacing')?.addEventListener('change', () => history?.record());

  document.querySelector('#color-presets')?.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const color = target.closest('[data-color]')?.getAttribute('data-color');
    if (!color) {
      return;
    }
    const input = document.querySelector('#color-input');
    if (input instanceof HTMLInputElement) {
      input.value = color;
    }
    setSelectionFill(canvas, color);
    history?.record();
  });

  document.querySelector('#nudge-pad')?.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    if (target.id === 'nudge-step') {
      nudgeStep = nudgeStep === 1 ? 10 : 1;
      target.textContent = `${nudgeStep} px`;
      target.setAttribute('aria-pressed', String(nudgeStep === 10));
      target.setAttribute('aria-label', nudgeStep === 10 ? 'Use 1 pixel nudge' : 'Use 10 pixel nudge');
      return;
    }
    const raw = target.closest('[data-nudge]')?.getAttribute('data-nudge');
    if (!raw) {
      return;
    }
    const [x, y] = raw.split(',').map(Number);
    if (nudgeSelection(canvas, x * nudgeStep, y * nudgeStep)) {
      history?.record();
    }
  });

  bindRange('#image-scale', (percent, shouldRecord) => commitImageZoom(percent, shouldRecord));
  bindRange('#canvas-image-scale', (percent, shouldRecord) => commitImageZoom(percent, shouldRecord));
  document.querySelector('#image-zoom-out')?.addEventListener('click', () => stepImageZoom(-10));
  document.querySelector('#image-zoom-in')?.addEventListener('click', () => stepImageZoom(10));
  bindRange('#fill-zoom', (percent, shouldRecord) => commitFillZoom(percent, shouldRecord));
  bindRange('#fill-zoom-side', (percent, shouldRecord) => commitFillZoom(percent, shouldRecord));
  document.querySelector('#fill-zoom-out')?.addEventListener('click', () => stepFillZoom(-10));
  document.querySelector('#fill-zoom-in')?.addEventListener('click', () => stepFillZoom(10));
  document.querySelector('#crop-image')?.addEventListener('click', openImageCrop);

  document.querySelector('#opacity-input')?.addEventListener('input', (event) => {
    const input = event.target;
    const output = document.querySelector('#opacity-value');
    if (input instanceof HTMLInputElement) {
      const percent = Number(input.value);
      setSelectionOpacity(canvas, percent / 100);
      if (output instanceof HTMLOutputElement) {
        output.value = `${percent}%`;
      }
    }
  });
  document.querySelector('#opacity-input')?.addEventListener('change', () => history?.record());

  document.querySelector('#background-color')?.addEventListener('input', (event) => {
    const input = event.target;
    if (input instanceof HTMLInputElement) {
      setCanvasBackgroundColor(canvas, input.value);
    }
  });
  document.querySelector('#background-color')?.addEventListener('change', () => history?.record());
  document.querySelector('#clear-background-image')?.addEventListener('click', () => {
    const input = document.querySelector('#background-color');
    const color = input instanceof HTMLInputElement ? input.value : '#f3efe6';
    setCanvasBackgroundColor(canvas, color);
    history?.record();
    setStatus('Solid background applied');
  });

  document.querySelector('#duplicate-object')?.addEventListener('click', () => {
    void duplicateActiveObject();
  });
  document.querySelector('#delete-object')?.addEventListener('click', removeActiveObject);
  document.querySelector('#lock-object')?.addEventListener('click', () => {
    const locked = toggleSelectionLock(canvas);
    if (locked === null) {
      return;
    }
    history?.record();
    syncInspector();
    setStatus(locked ? 'Object locked' : 'Object unlocked');
  });
  document.querySelector('#bring-forward')?.addEventListener('click', () => {
    if (moveSelectionLayer(canvas, 'forward')) {
      history?.record();
      setStatus('Moved forward');
    }
  });
  document.querySelector('#send-backward')?.addEventListener('click', () => {
    if (moveSelectionLayer(canvas, 'backward')) {
      history?.record();
      setStatus('Moved backward');
    }
  });
  document.querySelector('#bring-front')?.addEventListener('click', () => {
    if (moveSelectionLayer(canvas, 'front')) {
      history?.record();
      setStatus('Moved to front');
    }
  });
  document.querySelector('#send-back')?.addEventListener('click', () => {
    if (moveSelectionLayer(canvas, 'back')) {
      history?.record();
      setStatus('Moved to back');
    }
  });
  document.querySelectorAll('[data-transform]').forEach((input) => {
    input.addEventListener('change', (event) => {
      const field = event.target;
      const aspectLock = document.querySelector('#aspect-lock');
      if (!(field instanceof HTMLInputElement) || !field.dataset.transform) {
        return;
      }
      const preserveAspectRatio = aspectLock instanceof HTMLInputElement && aspectLock.checked;
      if (setSelectionTransform(canvas, field.dataset.transform, Number(field.value), preserveAspectRatio)) {
        history?.record();
        syncInspector();
      }
    });
  });
  document.querySelector('#flip-horizontal')?.addEventListener('click', () => {
    if (flipSelection(canvas, 'horizontal')) {
      history?.record();
      syncInspector();
    }
  });
  document.querySelector('#flip-vertical')?.addEventListener('click', () => {
    if (flipSelection(canvas, 'vertical')) {
      history?.record();
      syncInspector();
    }
  });
  document.querySelector('#remove-background')?.addEventListener('click', () => {
    void runBackgroundRemoval();
  });
  document.querySelector('.alignment-grid')?.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const alignment = target.closest('[data-align-object]')?.getAttribute('data-align-object');
    if (alignment && alignSelectionToCard(canvas, alignment)) {
      history?.record();
      syncInspector();
    }
  });
}

/**
 * @param {string} selector
 * @param {(percent: number, shouldRecord: boolean) => void} apply
 * @returns {void}
 */
function bindRange(selector, apply) {
  const input = document.querySelector(selector);
  if (!(input instanceof HTMLInputElement)) {
    return;
  }
  input.addEventListener('input', () => apply(Number(input.value), false));
  input.addEventListener('change', () => apply(Number(input.value), true));
}

/**
 * Expands or contracts the selected image.
 * @param {number} percent
 * @param {boolean} shouldRecord
 * @returns {void}
 */
function commitImageZoom(percent, shouldRecord) {
  const next = clamp(percent, 10, 400);
  if (!setSelectedImageScale(canvas, next / 100)) {
    setStatus('Select an image to zoom it in or out');
    return;
  }
  paintImageZoom(next);
  paintQrHealth();
  if (shouldRecord) {
    history?.record();
  }
}

/**
 * @param {number} delta
 * @returns {void}
 */
function stepImageZoom(delta) {
  const object = canvas.getActiveObject();
  if (!object || object.type !== 'image') {
    setStatus('Select an image to zoom it in or out');
    return;
  }
  commitImageZoom(clamp(Math.round((object.scaleX ?? 1) * 100) + delta, 10, 400), true);
}

/**
 * @param {number} percent
 * @returns {void}
 */
function paintImageZoom(percent) {
  const controls = [
    ['#image-scale', '#image-scale-value'],
    ['#canvas-image-scale', '#canvas-image-scale-value'],
  ];
  controls.forEach(([inputId, outputId]) => {
    const input = document.querySelector(inputId);
    const output = document.querySelector(outputId);
    if (input instanceof HTMLInputElement && document.activeElement !== input) {
      input.value = String(percent);
    }
    if (output) {
      output.textContent = `${percent}%`;
    }
  });
}

/**
 * Expands or contracts the card photo fill.
 * @param {number} percent
 * @param {boolean} shouldRecord
 * @returns {void}
 */
function commitFillZoom(percent, shouldRecord) {
  const next = clamp(percent, 50, 300);
  if (!setBackgroundFillZoom(canvas, next / 100)) {
    setStatus('Add a photo fill, then zoom it in or out here');
    paintFillZoom(null);
    return;
  }
  paintFillZoom(next / 100);
  if (shouldRecord) {
    history?.record();
  }
}

/**
 * @param {number} delta
 * @returns {void}
 */
function stepFillZoom(delta) {
  const current = getBackgroundFillZoom(canvas);
  if (current === null) {
    setStatus('Add a photo fill, then zoom it in or out here');
    return;
  }
  commitFillZoom(clamp(Math.round(current * 100) + delta, 50, 300), true);
}

/**
 * @param {number | null} zoom
 * @returns {void}
 */
function paintFillZoom(zoom) {
  const enabled = zoom !== null;
  const percent = enabled ? clamp(Math.round(zoom * 100), 50, 300) : 100;
  ['#fill-zoom', '#fill-zoom-side'].forEach((id) => {
    const input = document.querySelector(id);
    if (!(input instanceof HTMLInputElement)) {
      return;
    }
    input.disabled = !enabled;
    if (document.activeElement !== input) {
      input.value = String(percent);
    }
  });
  const label = enabled ? `${percent}%` : 'Add fill';
  ['#fill-zoom-value', '#fill-zoom-side-value'].forEach((id) => {
    const output = document.querySelector(id);
    if (output) {
      output.textContent = label;
    }
  });
}

/**
 * Opens the crop dialog for the selected image.
 * @returns {void}
 */
function openImageCrop() {
  const object = canvas.getActiveObject();
  if (!object || object.type !== 'image' || typeof object.getOriginalSize !== 'function' || typeof object.getSrc !== 'function') {
    setStatus('Select an image on the card, then crop it');
    return;
  }

  const size = object.getOriginalSize();
  try {
    imageCropper.open({
      src: object.getSrc(),
      naturalWidth: size.width,
      naturalHeight: size.height,
      crop: {
        x: object.cropX || 0,
        y: object.cropY || 0,
        width: object.width || size.width,
        height: object.height || size.height,
      },
      onApply(crop) {
        if (!cropSelectedImage(canvas, crop)) {
          setStatus('Select an image on the card, then crop it');
          return;
        }
        history?.record();
        syncInspector();
        setStatus('Image cropped');
      },
      onError(error) {
        reportError(error);
      },
    });
  } catch (error) {
    reportError(error);
  }
}

/**
 * Removes the selected image background with progress feedback.
 * @returns {Promise<void>}
 */
async function runBackgroundRemoval() {
  const selected = canvas.getActiveObject();
  if (!selected || selected.type !== 'image') {
    setStatus('Select an image on the card, then remove its background');
    return;
  }

  const button = document.querySelector('#remove-background');
  const progressRow = document.querySelector('#background-removal-progress');
  const meter = document.querySelector('#background-removal-meter');
  const label = document.querySelector('#background-removal-label');
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }

  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  if (progressRow instanceof HTMLElement) {
    progressRow.hidden = false;
  }

  try {
    await removeSelectedImageBackground(canvas, (progress, message) => {
      if (meter instanceof HTMLProgressElement) {
        meter.value = progress;
      }
      if (label instanceof HTMLElement) {
        label.textContent = message;
      }
    });
    history?.record();
    syncInspector();
    setStatus('Background removed');
  } catch (error) {
    reportError(error);
  } finally {
    button.disabled = false;
    button.removeAttribute('aria-busy');
    window.setTimeout(() => {
      if (progressRow instanceof HTMLElement) {
        progressRow.hidden = true;
      }
    }, 1200);
  }
}

/**
 * @returns {Promise<void>}
 */
async function duplicateActiveObject() {
  try {
    if (await duplicateSelection(canvas)) {
      history?.record();
      syncInspector();
      setStatus('Object duplicated');
    }
  } catch (error) {
    reportError(error);
  }
}

/**
 * @returns {void}
 */
function removeActiveObject() {
  if (!deleteSelection(canvas)) {
    return;
  }
  history?.record();
  syncInspector();
  setStatus('Object deleted');
}

/**
 * @returns {void}
 */
function bindKeys() {
  window.addEventListener('keydown', (event) => {
    const target = event.target;
    if (target instanceof HTMLElement && (target.closest('input, select, textarea') || target.isContentEditable)) {
      return;
    }
    const active = canvas.getActiveObject();
    if (active?.isEditing) {
      return;
    }

    const commandKey = event.ctrlKey || event.metaKey;
    if (commandKey && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      void runHistoryAction(event.shiftKey ? 'redo' : 'undo');
      return;
    }
    if (commandKey && event.key.toLowerCase() === 'y') {
      event.preventDefault();
      void runHistoryAction('redo');
      return;
    }
    if (commandKey && event.key.toLowerCase() === 'd') {
      event.preventDefault();
      void duplicateActiveObject();
      return;
    }
    if (commandKey && event.key.toLowerCase() === 'c' && active) {
      event.preventDefault();
      void copyActiveObject();
      return;
    }
    if (commandKey && event.key.toLowerCase() === 'v' && clipboardObject) {
      event.preventDefault();
      void pasteClipboardObject();
      return;
    }
    if ((event.key === 'Delete' || event.key === 'Backspace') && active) {
      event.preventDefault();
      removeActiveObject();
      return;
    }
    if (event.key === 'Escape' && active) {
      canvas.discardActiveObject();
      canvas.requestRenderAll();
      syncInspector();
      return;
    }
    if (event.key === '[') {
      event.preventDefault();
      void changeFace('front');
      return;
    }
    if (event.key === ']') {
      event.preventDefault();
      void changeFace('back');
      return;
    }
    if (event.key === '?' || (event.shiftKey && event.key === '/')) {
      event.preventDefault();
      shortcutsHelp.open();
      return;
    }

    const vectors = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const vector = vectors[event.key];
    if (!vector) {
      return;
    }
    const step = event.shiftKey ? 10 : nudgeStep;
    const moved = nudgeSelection(canvas, vector[0] * step, vector[1] * step);
    if (moved) {
      event.preventDefault();
      history?.record();
    }
  });
}

/**
 * @returns {Promise<void>}
 */
async function copyActiveObject() {
  const activeObject = canvas.getActiveObject();
  if (!activeObject) {
    return;
  }
  clipboardObject = await activeObject.clone();
  setStatus('Object copied');
}

/**
 * @returns {Promise<void>}
 */
async function pasteClipboardObject() {
  if (!clipboardObject) {
    return;
  }
  const pastedObject = await clipboardObject.clone();
  pastedObject.set({
    left: (clipboardObject.left ?? 0) + 24,
    top: (clipboardObject.top ?? 0) + 24,
    evented: true,
  });
  canvas.add(pastedObject);
  canvas.setActiveObject(pastedObject);
  pastedObject.setCoords();
  canvas.requestRenderAll();
  clipboardObject.set({
    left: pastedObject.left,
    top: pastedObject.top,
  });
  history?.record();
  syncInspector();
  setStatus('Object pasted');
}

/**
 * @param {string} action
 * @returns {Promise<void>}
 */
async function runExport(action) {
  if (exportBusy) {
    return;
  }
  exportBusy = true;
  setStatus('Exporting');
  try {
    if (action === 'download-current') {
      const names = downloadFilenames();
      const face = await exportActiveFace(canvas, names[state.activeFace]);
      downloadBlob(face.blob, face.name);
      setStatus(`Downloaded ${face.name}`);
      return;
    }
    if (action === 'share-current') {
      const names = downloadFilenames();
      const face = await exportActiveFace(canvas, names[state.activeFace]);
      await presentShare([face]);
      return;
    }
    if (action === 'download-both') {
      const names = downloadFilenames();
      const both = await exportBothFaces(canvas, state, names);
      const sheet = await renderPrintSheet(both.front.blob, both.back.blob);
      const sheetName = sheetDownloadName(names.stem);
      downloadBlob(sheet.blob, sheetName);
      const issues = currentPrintIssues();
      const warning = issues.length > 0 ? ` ${issues[0]}` : '';
      setStatus(`Downloaded ${sheetName} — both faces at actual size.${warning}`);
      return;
    }
    if (action === 'share-both') {
      const both = await exportBothFaces(canvas, state, downloadFilenames());
      await presentShare([both.front, both.back]);
      return;
    }
    if (action === 'preview') {
      await openFlipPreview();
      return;
    }
    if (action === 'vcard') {
      downloadContactCard();
    }
  } catch (error) {
    reportError(error);
  } finally {
    exportBusy = false;
    syncInspector();
  }
}

/**
 * @param {{ name: string, blob: Blob }[]} items
 * @returns {Promise<void>}
 */
async function presentShare(items) {
  const result = await shareFiles(items);
  if (result === 'shared') {
    setStatus('Shared card image');
    return;
  }
  if (result === 'cancelled') {
    setStatus('Share cancelled');
    return;
  }
  shareModal.open(items);
  setStatus('Share sheet unavailable. Use the save dialog.');
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

/**
 * @param {string} selector
 * @returns {HTMLElement}
 */
function mustElement(selector) {
  const element = document.querySelector(selector);
  if (!(element instanceof HTMLElement)) {
    throw new Error(`[App] Missing required element ${selector}`);
  }
  return element;
}

/**
 * @returns {void}
 */
function bindProfile() {
  const fields = [
    ['#profile-name', 'fullName'],
    ['#profile-title', 'title'],
    ['#profile-company', 'company'],
    ['#profile-email', 'email'],
    ['#profile-phone', 'phone'],
    ['#profile-website', 'website'],
    ['#profile-linkedin', 'linkedin'],
    ['#profile-instagram', 'instagram'],
  ];
  fields.forEach(([selector, key]) => {
    document.querySelector(selector)?.addEventListener('input', (event) => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement)) {
        return;
      }
      profile = { ...profile, [key]: input.value };
      paintNfcPayload();
      onDocumentChanged();
    });
  });
  document.querySelector('[data-tool-panel="you"]')?.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const mode = target.closest('[data-qr-mode]')?.getAttribute('data-qr-mode');
    if (mode === 'vcard' || mode === 'website') {
      if (mode === profile.qrMode) {
        return;
      }
      profile = { ...profile, qrMode: mode };
      paintProfileFields();
      void refreshPrintedQr();
    }
  });
  document.querySelector('#apply-profile')?.addEventListener('click', () => {
    void applyProfileToDesign();
  });
  document.querySelector('#add-qr')?.addEventListener('click', () => {
    void addOrRefreshQr();
  });
  document.querySelector('#preview-tap')?.addEventListener('click', () => {
    tapPreview.open(profile, downloadContactCard);
  });
  document.querySelector('#download-vcard')?.addEventListener('click', downloadContactCard);
  document.querySelector('#copy-payload')?.addEventListener('click', () => {
    void copyChipPayload();
  });
  document.querySelector('#document-input')?.addEventListener('change', (event) => {
    void importDesignFile(event);
  });
}

/**
 * @returns {void}
 */
function paintProfileFields() {
  const values = {
    '#profile-name': profile.fullName,
    '#profile-title': profile.title,
    '#profile-company': profile.company,
    '#profile-email': profile.email,
    '#profile-phone': profile.phone,
    '#profile-website': profile.website,
    '#profile-linkedin': profile.linkedin,
    '#profile-instagram': profile.instagram,
  };
  Object.entries(values).forEach(([selector, value]) => {
    const input = document.querySelector(selector);
    if (input instanceof HTMLInputElement && document.activeElement !== input) {
      input.value = value;
    }
  });
  document.querySelectorAll('[data-qr-mode]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.getAttribute('data-qr-mode') === profile.qrMode));
  });
  paintNfcPayload();
}

/**
 * Shows the exact record a writer app should store on the tag.
 * @returns {void}
 */
function paintNfcPayload() {
  const preview = document.querySelector('#payload-preview');
  const size = document.querySelector('#payload-size');
  const fit = document.querySelector('#payload-fit');
  if (!(preview instanceof HTMLElement) || !(size instanceof HTMLElement) || !(fit instanceof HTMLElement)) {
    return;
  }
  if (!canBuildQrPayload(profile)) {
    preview.textContent = profile.qrMode === 'website'
      ? 'Add a website to build the chip payload.'
      : 'Add a name, email, or phone to build the chip payload.';
    size.textContent = '0 bytes';
    fit.textContent = '';
    return;
  }

  const payload = buildQrPayload(profile);
  const bytes = new TextEncoder().encode(payload).length;
  preview.textContent = payload;
  size.textContent = `${bytes} bytes`;
  fit.textContent = payloadFitNote(bytes, profile.qrMode);
}

/**
 * @param {number} bytes
 * @param {'vcard' | 'website'} mode
 * @returns {string}
 */
/**
 * Refreshes the visible face immediately and the stored face in the background.
 * @returns {void}
 */
function refreshFaceThumbs() {
  faceRail?.setActive(state.activeFace);
  faceRail?.paintLive(state.activeFace, canvas);
  const otherFace = state.activeFace === 'front' ? 'back' : 'front';
  void faceRail?.paintSnapshot(otherFace, state.snapshots[otherFace]).catch((error) => {
    reportError(error);
  });
}

/**
 * @param {'front' | 'back'} face
 * @returns {ReadonlyArray<Record<string, unknown>>}
 */
function objectsForFace(face) {
  if (face === state.activeFace) {
    return canvas.getObjects();
  }
  const snapshot = state.snapshots[face];
  return snapshot && Array.isArray(snapshot.objects) ? snapshot.objects : [];
}

/**
 * @returns {string[]}
 */
function currentPrintIssues() {
  return printIssues(objectsForFace('front'), objectsForFace('back'));
}

/**
 * Shows trim and QR problems in the export menu before a print file is saved.
 * @returns {void}
 */
function paintPrintCheck() {
  const note = document.querySelector('#print-check');
  if (!(note instanceof HTMLElement)) {
    return;
  }
  const issues = currentPrintIssues();
  note.hidden = issues.length === 0;
  note.textContent = issues.join(' ');
}

/**
 * Marks the 3 mm guide when print content crosses the trim zone.
 * @returns {void}
 */
function paintSafeArea() {
  const note = safeGuide.querySelector('span');
  if (!(note instanceof HTMLElement)) {
    return;
  }
  const unsafeCount = countUnsafeObjects(canvas.getObjects());
  if (unsafeCount === 0) {
    delete safeGuide.dataset.unsafe;
    note.textContent = '3 mm safe area';
    return;
  }
  safeGuide.dataset.unsafe = 'true';
  note.textContent = unsafeCount === 1
    ? '1 object is outside the 3 mm safe area'
    : `${unsafeCount} objects are outside the 3 mm safe area`;
}

/**
 * @returns {void}
 */
function paintQrHealth() {
  const note = document.querySelector('#qr-health');
  if (!(note instanceof HTMLElement)) {
    return;
  }
  const frontPx = qrPxForFace('front');
  const backPx = qrPxForFace('back');
  const message = qrHealthNote(frontPx, backPx);
  note.textContent = message;
  note.classList.toggle('is-warning', message.includes('under'));
}

/**
 * @param {'front' | 'back'} face
 * @returns {number | null}
 */
function qrPxForFace(face) {
  if (face === state.activeFace) {
    return smallestQrPx(canvas.getObjects());
  }
  const snapshot = state.snapshots[face];
  const objects = snapshot && Array.isArray(snapshot.objects) ? snapshot.objects : [];
  return smallestQrPx(objects);
}

/**
 * @param {number} bytes
 * @param {'vcard' | 'website'} mode
 * @returns {string}
 */
function payloadFitNote(bytes, mode) {
  if (mode === 'website') {
    return 'Write this as a URL record. A link fits every common NFC tag.';
  }
  if (bytes <= 120) {
    return 'Fits a small NTAG213 tag as a contact record.';
  }
  if (bytes <= 460) {
    return 'Too large for NTAG213. Use an NTAG215, or switch the QR to a website link.';
  }
  return 'Too large for most tags. Switch the QR to a website link and write that shorter record.';
}

/**
 * @returns {Promise<void>}
 */
async function copyChipPayload() {
  if (!canBuildQrPayload(profile)) {
    setStatus(profile.qrMode === 'website'
      ? 'Add a website before copying the chip payload'
      : 'Add a name, email, or phone before copying the chip payload');
    return;
  }
  const payload = buildQrPayload(profile);
  const copied = await writePayloadToClipboard(payload);
  if (copied) {
    setStatus('Chip payload copied');
    return;
  }
  if (selectPayloadText()) {
    setStatus('Clipboard blocked. The payload is selected — press Ctrl+C');
    return;
  }
  setStatus('Could not copy the chip payload');
}

/**
 * @param {string} payload
 * @returns {Promise<boolean>}
 */
async function writePayloadToClipboard(payload) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(payload);
      return true;
    }
  } catch {
    // The page can lose focus in an embedded browser. Try the older copy path.
  }
  return copyWithExecCommand(payload);
}

/**
 * @param {string} payload
 * @returns {boolean}
 */
function copyWithExecCommand(payload) {
  const field = document.createElement('textarea');
  field.value = payload;
  field.setAttribute('readonly', '');
  field.style.position = 'fixed';
  field.style.top = '0';
  field.style.left = '0';
  field.style.opacity = '0';
  document.body.appendChild(field);
  field.focus();
  field.select();
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }
  field.remove();
  return copied;
}

/**
 * @returns {boolean}
 */
function selectPayloadText() {
  const preview = document.querySelector('#payload-preview');
  if (!(preview instanceof HTMLElement)) {
    return false;
  }
  const range = document.createRange();
  range.selectNodeContents(preview);
  const selection = window.getSelection();
  if (!selection) {
    return false;
  }
  selection.removeAllRanges();
  selection.addRange(range);
  return true;
}

/**
 * @returns {void}
 */
function paintProjectName() {
  const label = document.querySelector('#project-name');
  if (label) {
    label.textContent = state.projectName || 'Untitled card';
  }
}

/**
 * Writes the profile onto every linked face and refreshes QR codes that are already placed.
 * @returns {Promise<void>}
 */
async function applyProfileToDesign() {
  if (profileSyncing) {
    return;
  }
  profileSyncing = true;
  let textUpdates = 0;
  let qrUpdates = 0;
  let faces = 0;
  try {
    exitPan();
    await forEachProfileFace((face) => faceLinksProfile(face), async () => {
      const linked = relinkPrintedText(canvas, appliedProfile);
      const textCount = applyProfileToCanvas(canvas, profile);
      const qrCount = await refreshQrOnLiveFace();
      if (linked + textCount + qrCount > 0) {
        history?.record();
        faces += 1;
      }
      textUpdates += textCount + linked;
      qrUpdates += qrCount;
    });
    if (textUpdates + qrUpdates === 0) {
      setStatus('No linked fields yet. Add a template or mark text as an NFC field');
      return;
    }
    appliedProfile = { ...profile };
    if (faces > 1 && qrUpdates > 0) {
      setStatus('Both sides updated, including the QR');
      return;
    }
    if (faces > 1) {
      setStatus('Both sides updated from your details');
      return;
    }
    if (qrUpdates > 0) {
      setStatus('Card text and QR updated');
      return;
    }
    setStatus('Card text updated from your details');
  } catch (error) {
    reportError(error);
  } finally {
    profileSyncing = false;
  }
}

/**
 * Rewrites QR images that are already on a face so they match the current payload.
 * @returns {Promise<void>}
 */
async function refreshPrintedQr() {
  if (profileSyncing) {
    return;
  }
  profileSyncing = true;
  let qrUpdates = 0;
  try {
    await forEachProfileFace((face) => faceHasQr(face), async () => {
      const qrCount = await refreshQrOnLiveFace();
      if (qrCount > 0) {
        history?.record();
      }
      qrUpdates += qrCount;
    });
    if (qrUpdates > 0) {
      setStatus(profile.qrMode === 'website' ? 'QR now encodes your website' : 'QR now encodes the contact card');
    }
  } catch (error) {
    reportError(error);
  } finally {
    profileSyncing = false;
  }
}

/**
 * @returns {Promise<number>}
 */
async function refreshQrOnLiveFace() {
  const hasQr = canvas.getObjects().some((object) => object.cardKind === 'qr' || object.cardKind === 'qr-slot');
  if (!hasQr || !canBuildQrPayload(profile)) {
    return 0;
  }
  return syncQrObjects(canvas, profile);
}

/**
 * Visits each matching face, then returns to the face the user was editing.
 * @param {(face: 'front' | 'back') => boolean} shouldVisit
 * @param {() => Promise<void>} mutate
 * @returns {Promise<void>}
 */
async function forEachProfileFace(shouldVisit, mutate) {
  const returnFace = state.activeFace;
  const stage = document.querySelector('#stage');
  if (stage instanceof HTMLElement) {
    stage.dataset.syncing = 'true';
  }
  try {
    for (const face of ['front', 'back']) {
      if (!shouldVisit(face)) {
        continue;
      }
      if (state.activeFace !== face) {
        rememberHistory();
        await switchFace(canvas, state, face);
        restoreHistory(face);
      }
      await mutate();
      faceRail?.paintLive(state.activeFace, canvas);
    }
  } finally {
    if (state.activeFace !== returnFace) {
      rememberHistory();
      await switchFace(canvas, state, returnFace);
      restoreHistory(returnFace);
    }
    if (stage instanceof HTMLElement) {
      delete stage.dataset.syncing;
    }
    syncFaceControls();
    syncInspector();
  }
}

/**
 * @param {'front' | 'back'} face
 * @returns {boolean}
 */
function faceLinksProfile(face) {
  if (face === state.activeFace) {
    return canvas.getObjects().some((object) => object.cardRole || object.cardKind === 'qr' || object.cardKind === 'qr-slot');
  }
  return snapshotLinksProfile(state.snapshots[face]);
}

/**
 * @param {'front' | 'back'} face
 * @returns {boolean}
 */
function faceHasQr(face) {
  if (face === state.activeFace) {
    return canvas.getObjects().some((object) => object.cardKind === 'qr' || object.cardKind === 'qr-slot');
  }
  const snapshot = state.snapshots[face];
  if (!snapshot || !Array.isArray(snapshot.objects)) {
    return false;
  }
  return snapshot.objects.some((object) => {
    if (!object || typeof object !== 'object' || !('cardKind' in object)) {
      return false;
    }
    return object.cardKind === 'qr' || object.cardKind === 'qr-slot';
  });
}

/**
 * @returns {void}
 */
function rememberHistory() {
  if (history) {
    historyStacks[state.activeFace] = history.exportStack();
  }
}

/**
 * @param {'front' | 'back'} face
 * @returns {void}
 */
function restoreHistory(face) {
  if (historyStacks[face]) {
    history?.importStack(historyStacks[face]);
    return;
  }
  history?.reset();
}

/**
 * @returns {Promise<void>}
 */
async function addOrRefreshQr() {
  try {
    exitPan();
    if (!canBuildQrPayload(profile)) {
      setStatus(profile.qrMode === 'website'
        ? 'Add a website in You before placing a QR code'
        : 'Add a name, email, or phone in You before placing a QR code');
      selectToolTab('you');
      return;
    }
    await syncQrObjects(canvas, profile);
    history?.record();
    syncInspector();
    setStatus(profile.qrMode === 'website' ? 'Website QR placed' : 'Contact QR placed');
  } catch (error) {
    reportError(error);
  }
}

/**
 * @returns {void}
 */
function downloadContactCard() {
  try {
    const card = buildVCard(profile);
    const filename = contactDownloadName(downloadFilenames().stem);
    downloadBlob(new Blob([card], { type: 'text/vcard' }), filename);
    setStatus(`Downloaded ${filename}`);
  } catch (error) {
    reportError(error);
  }
}

/**
 * Names this click's files from the printed name and the subtitle under it.
 * @returns {{ stem: string, front: string, back: string }}
 */
function downloadFilenames() {
  const otherFace = state.activeFace === 'front' ? 'back' : 'front';
  const live = readPrintedIdentity(canvas.getObjects());
  const storedObjects = state.snapshots[otherFace]?.objects;
  const stored = readPrintedIdentity(Array.isArray(storedObjects) ? storedObjects : []);
  const identity = resolveDownloadIdentity({
    nameText: live.nameText || stored.nameText,
    subtext: live.subtext || stored.subtext,
  }, profile);
  const stem = createDownloadStem(identity);
  return {
    stem,
    front: faceDownloadName(stem, 'front'),
    back: faceDownloadName(stem, 'back'),
  };
}

/**
 * @param {string} templateName
 * @returns {Promise<void>}
 */
async function applyTemplateChoice(templateName) {
  try {
    exitPan();
    let sides = 'active';
    if (canvasHasUserContent(canvas) || snapshotHasContent(state.snapshots.front) || snapshotHasContent(state.snapshots.back)) {
      const choice = await appModal.confirm({
        eyebrow: 'Template',
        title: 'Replace this design?',
        copy: isFrontTemplate(templateName)
          ? 'This replaces the current side. You can also write a matching tap-and-QR back.'
          : 'This replaces the current side.',
        confirmLabel: 'This side',
        altLabel: isFrontTemplate(templateName) ? 'Both sides' : undefined,
        cancelLabel: 'Keep current',
      });
      if (choice === 'cancel') {
        return;
      }
      sides = choice === 'alt' ? 'both' : 'active';
    } else if (isFrontTemplate(templateName)) {
      sides = 'both';
    }
    await applyTemplateToSides(templateName, sides);
  } catch (error) {
    reportError(error);
  }
}

/**
 * @param {string} templateName
 * @param {'active' | 'both'} sides
 * @returns {Promise<void>}
 */
async function applyTemplateToSides(templateName, sides) {
  if (sides === 'both' && isFrontTemplate(templateName)) {
    const returnFace = state.activeFace;
    if (state.activeFace !== 'front') {
      await switchFace(canvas, state, 'front');
    }
    applyCardTemplate(canvas, templateName);
    applyProfileToCanvas(canvas, profile);
    captureActiveFace(canvas, state);
    await switchFace(canvas, state, 'back');
    applyCardTemplate(canvas, matchingBackName(templateName));
    applyProfileToCanvas(canvas, profile);
    try {
      await syncQrObjects(canvas, profile);
    } catch (error) {
      reportError(error);
    }
    captureActiveFace(canvas, state);
    await switchFace(canvas, state, returnFace);
    historyStacks.front = null;
    historyStacks.back = null;
  } else {
    applyCardTemplate(canvas, templateName);
    applyProfileToCanvas(canvas, profile);
    if (canvas.getObjects().some((object) => object.cardKind === 'qr' || object.cardKind === 'qr-slot')) {
      try {
        await syncQrObjects(canvas, profile);
      } catch (error) {
        reportError(error);
      }
    }
  }
  history?.reset();
  syncFaceControls();
  syncInspector();
  setStatus(`${templateName.replace(/-/g, ' ')} applied`);
}

/**
 * @returns {Promise<void>}
 */
async function runOnboarding() {
  const result = await onboarding.open();
  markOnboardingComplete();
  if (!result) {
    return;
  }
  profile = normalizeProfile(result.profile);
  paintProfileFields();
  selectToolTab('you');
  await applyTemplateToSides(result.template, 'both');
  onDocumentChanged();
  setStatus('Your card is ready. Edit any field, then export.');
}

/**
 * @param {string} action
 * @returns {Promise<void>}
 */
async function runProjectAction(action) {
  try {
    if (action === 'rename') {
      const nextName = await appModal.prompt({
        eyebrow: 'Project',
        title: 'Rename this card',
        copy: 'The name is saved with the design on this device.',
        confirmLabel: 'Save name',
        inputValue: state.projectName,
        inputLabel: 'Card name',
      });
      if (!nextName) {
        return;
      }
      state.projectName = nextName;
      paintProjectName();
      onDocumentChanged();
      return;
    }
    if (action === 'new') {
      const choice = await appModal.confirm({
        eyebrow: 'Project',
        title: 'Start a new card?',
        copy: 'This card stays in My cards. The canvas starts blank, and your details stay so you can apply them to a new layout.',
        confirmLabel: 'New card',
        cancelLabel: 'Keep editing',
        danger: true,
      });
      if (choice !== 'confirm') {
        return;
      }
      const archived = archiveCurrentIfNeeded();
      startBlankCard();
      const dropped = archived?.droppedName ? ` The oldest saved card, ${archived.droppedName}, was removed.` : '';
      setStatus(`New card started.${archived ? ' The last one is in My cards.' : ''}${dropped}`);
      return;
    }
    if (action === 'library') {
      openCardLibrary();
      return;
    }
    if (action === 'import') {
      const input = document.querySelector('#document-input');
      if (input instanceof HTMLInputElement) {
        input.click();
      }
      return;
    }
    if (action === 'export') {
      const documentState = serializeDocument(canvas, state, profile);
      downloadBlob(
        new Blob([JSON.stringify(documentState)], { type: 'application/json' }),
        `${(state.projectName || 'nfc-card').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`,
      );
      setStatus('Design JSON downloaded');
      return;
    }
    if (action === 'shortcuts') {
      shortcutsHelp.open();
    }
  } catch (error) {
    reportError(error);
  }
}

/**
 * A blank untitled card is not worth keeping. Anything designed or renamed is.
 * @returns {boolean}
 */
function cardShouldBeKept() {
  const hasDesign = canvasHasUserContent(canvas)
    || snapshotHasContent(state.snapshots.front)
    || snapshotHasContent(state.snapshots.back);
  const named = Boolean(state.projectName?.trim()) && state.projectName !== 'Untitled card';
  return hasDesign || named;
}

/**
 * @returns {{ droppedName: string | null } | null}
 */
function archiveCurrentIfNeeded() {
  if (!cardShouldBeKept()) {
    return null;
  }
  return archiveCard(serializeDocument(canvas, state, profile));
}

/**
 * @returns {void}
 */
function startBlankCard() {
  canvas.discardActiveObject();
  canvas.clear();
  canvas.backgroundColor = CARD_BACKGROUND;
  canvas.requestRenderAll();
  state.snapshots.front = null;
  state.snapshots.back = null;
  state.activeFace = 'front';
  state.projectName = 'Untitled card';
  state.projectId = createProjectId();
  historyStacks.front = null;
  historyStacks.back = null;
  history?.reset();
  paintProjectName();
  syncFaceControls();
  syncInspector();
  onDocumentChanged();
  refreshFaceThumbs();
}

const libraryActions = {
  /**
   * @param {string} id
   */
  onOpen(id) {
    void openSavedCard(id);
  },
  /**
   * @param {string} id
   */
  onDelete(id) {
    void deleteSavedCard(id);
  },
};

/**
 * @returns {{ currentName: string, saved: Array<{ id: string, projectName: string, savedAt: string }> }}
 */
function libraryModel() {
  return {
    currentName: state.projectName || 'Untitled card',
    saved: listCardSummaries().filter((card) => card.id !== state.projectId),
  };
}

/**
 * @returns {void}
 */
function openCardLibrary() {
  libraryUi.open(libraryModel(), libraryActions);
}

/**
 * @param {string} id
 * @returns {Promise<void>}
 */
async function openSavedCard(id) {
  try {
    const incoming = peekSavedCard(id);
    if (!incoming || incoming.id === state.projectId) {
      libraryUi.repaint(libraryModel());
      setStatus('That card is no longer saved');
      return;
    }
    const archived = cardShouldBeKept()
      ? archiveCard(serializeDocument(canvas, state, profile))
      : null;
    profile = await applyImportedDocument(incoming, canvas, state);
    appliedProfile = { ...profile };
    removeSavedCard(incoming.id);
    historyStacks.front = null;
    historyStacks.back = null;
    history?.reset();
    paintProfileFields();
    paintProjectName();
    syncFaceControls();
    syncInspector();
    onDocumentChanged();
    refreshFaceThumbs();
    libraryUi.close();
    const dropped = archived?.droppedName
      ? ` The oldest saved card, ${archived.droppedName}, was removed.`
      : '';
    setStatus(`Opened ${incoming.projectName}${dropped}`);
  } catch (error) {
    reportError(error);
  }
}

/**
 * @param {string} id
 * @returns {Promise<void>}
 */
async function deleteSavedCard(id) {
  const card = listCardSummaries().find((item) => item.id === id);
  const choice = await appModal.confirm({
    eyebrow: 'My cards',
    title: `Delete ${card?.projectName || 'this card'}?`,
    copy: 'This removes it from this device. The card you are editing stays open.',
    confirmLabel: 'Delete card',
    cancelLabel: 'Keep it',
    danger: true,
  });
  if (choice !== 'confirm') {
    return;
  }
  try {
    removeSavedCard(id);
    libraryUi.repaint(libraryModel());
    setStatus('Saved card deleted');
  } catch (error) {
    reportError(error);
  }
}

/**
 * @param {Event} event
 * @returns {Promise<void>}
 */
async function importDesignFile(event) {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || !input.files?.[0]) {
    return;
  }
  const file = input.files[0];
  input.value = '';
  try {
    const documentState = parseCardDocument(await file.text());
    profile = await applyImportedDocument(documentState, canvas, state);
    appliedProfile = { ...profile };
    removeSavedCard(documentState.id);
    historyStacks.front = null;
    historyStacks.back = null;
    history?.reset();
    paintProfileFields();
    paintProjectName();
    syncFaceControls();
    syncInspector();
    onDocumentChanged();
    refreshFaceThumbs();
    setStatus(`Imported ${documentState.projectName}`);
  } catch (error) {
    reportError(error);
  }
}

/**
 * @returns {Promise<void>}
 */
async function openFlipPreview() {
  if (exportBusy) {
    return;
  }
  exportBusy = true;
  setStatus('Rendering preview');
  try {
    const backEmpty = state.activeFace === 'back'
      ? !canvasHasUserContent(canvas)
      : !snapshotHasContent(state.snapshots.back);
    if (backEmpty && profileHasIdentity(profile)) {
      const choice = await appModal.confirm({
        eyebrow: 'Back is empty',
        title: 'Add a tap-and-QR back?',
        copy: 'Recipients need a QR when they cannot tap. We can generate a matching back from your details without changing the front.',
        confirmLabel: 'Add matching back',
        cancelLabel: 'Preview anyway',
      });
      if (choice === 'confirm') {
        await fillEmptyBack();
      }
    }
    const both = await exportBothFaces(canvas, state);
    flipPreview.open({ front: both.front.blob, back: both.back.blob });
    setStatus('Preview ready');
  } catch (error) {
    reportError(error);
  } finally {
    exportBusy = false;
  }
}

/**
 * Writes a coordinated QR back without replacing the front design.
 * @returns {Promise<void>}
 */
async function fillEmptyBack() {
  const returnFace = state.activeFace;
  captureActiveFace(canvas, state);
  if (state.activeFace !== 'back') {
    await switchFace(canvas, state, 'back');
  }
  applyCardTemplate(canvas, 'editorial-back');
  applyProfileToCanvas(canvas, profile);
  await syncQrObjects(canvas, profile);
  captureActiveFace(canvas, state);
  if (returnFace !== state.activeFace) {
    await switchFace(canvas, state, returnFace);
  }
  historyStacks.back = null;
  history?.reset();
  syncFaceControls();
  syncInspector();
}

