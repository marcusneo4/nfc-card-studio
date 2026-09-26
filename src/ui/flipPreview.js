/**
 * CSS 3D flip of both printed faces.
 * @param {HTMLDialogElement} dialog
 * @returns {{
 *   open: (faces: { front: Blob, back: Blob }) => void,
 *   close: () => void,
 * }}
 */
export function createFlipPreview(dialog) {
  const stage = dialog.querySelector('#flip-card');
  const frontImage = dialog.querySelector('#flip-front');
  const backImage = dialog.querySelector('#flip-back');
  const flipButton = dialog.querySelector('#flip-toggle');
  const closeButton = dialog.querySelector('#flip-close');
  if (
    !(stage instanceof HTMLElement) ||
    !(frontImage instanceof HTMLImageElement) ||
    !(backImage instanceof HTMLImageElement) ||
    !(flipButton instanceof HTMLButtonElement) ||
    !(closeButton instanceof HTMLButtonElement)
  ) {
    throw new Error('[FlipPreview] Dialog is missing the card stage');
  }

  /** @type {string[]} */
  let urls = [];
  let showingBack = false;

  flipButton.addEventListener('click', () => {
    showingBack = !showingBack;
    stage.classList.toggle('is-flipped', showingBack);
    flipButton.textContent = showingBack ? 'Show front' : 'Show back';
  });
  closeButton.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', release);

  return { open, close: () => dialog.close() };

  /**
   * @param {{ front: Blob, back: Blob }} faces
   * @returns {void}
   */
  function open(faces) {
    release();
    showingBack = false;
    stage.classList.remove('is-flipped');
    flipButton.textContent = 'Show back';
    const frontUrl = URL.createObjectURL(faces.front);
    const backUrl = URL.createObjectURL(faces.back);
    urls = [frontUrl, backUrl];
    frontImage.src = frontUrl;
    backImage.src = backUrl;
    if (!dialog.open) {
      dialog.showModal();
    }
    flipButton.focus();
  }

  /**
   * @returns {void}
   */
  function release() {
    urls.forEach((url) => URL.revokeObjectURL(url));
    urls = [];
    frontImage.removeAttribute('src');
    backImage.removeAttribute('src');
  }
}
