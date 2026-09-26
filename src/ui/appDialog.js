/**
 * @typedef {Object} DialogRequest
 * @property {string} eyebrow
 * @property {string} title
 * @property {string} copy
 * @property {string} confirmLabel
 * @property {string} [cancelLabel]
 * @property {string} [altLabel]
 * @property {string} [inputValue]
 * @property {string} [inputLabel]
 * @property {boolean} [danger]
 */

/**
 * Generic modal used for confirms, rename, and destructive choices.
 * @param {HTMLDialogElement} dialog
 * @returns {{
 *   confirm: (request: DialogRequest) => Promise<'confirm' | 'alt' | 'cancel'>,
 *   prompt: (request: DialogRequest) => Promise<string | null>,
 * }}
 */
export function createAppDialog(dialog) {
  const eyebrow = dialog.querySelector('#app-dialog-eyebrow');
  const title = dialog.querySelector('#app-dialog-title');
  const copy = dialog.querySelector('#app-dialog-copy');
  const input = dialog.querySelector('#app-dialog-input');
  const inputWrap = dialog.querySelector('#app-dialog-field');
  const cancelButton = dialog.querySelector('#app-dialog-cancel');
  const altButton = dialog.querySelector('#app-dialog-alt');
  const confirmButton = dialog.querySelector('#app-dialog-confirm');

  if (
    !(eyebrow instanceof HTMLElement) ||
    !(title instanceof HTMLElement) ||
    !(copy instanceof HTMLElement) ||
    !(input instanceof HTMLInputElement) ||
    !(inputWrap instanceof HTMLElement) ||
    !(cancelButton instanceof HTMLButtonElement) ||
    !(altButton instanceof HTMLButtonElement) ||
    !(confirmButton instanceof HTMLButtonElement)
  ) {
    throw new Error('[AppDialog] Dialog is missing required fields');
  }

  return { confirm, prompt };

  /**
   * @param {DialogRequest} request
   * @returns {Promise<'confirm' | 'alt' | 'cancel'>}
   */
  function confirm(request) {
    return new Promise((resolve) => {
      paint(request, false);
      const finish = (result) => {
        cleanup();
        dialog.close();
        resolve(result);
      };
      const onCancel = () => finish('cancel');
      const onAlt = () => finish('alt');
      const onConfirm = () => finish('confirm');
      const onClose = () => finish('cancel');

      cancelButton.addEventListener('click', onCancel, { once: true });
      altButton.addEventListener('click', onAlt, { once: true });
      confirmButton.addEventListener('click', onConfirm, { once: true });
      dialog.addEventListener('close', onClose, { once: true });

      function cleanup() {
        cancelButton.removeEventListener('click', onCancel);
        altButton.removeEventListener('click', onAlt);
        confirmButton.removeEventListener('click', onConfirm);
        dialog.removeEventListener('close', onClose);
      }

      if (!dialog.open) {
        dialog.showModal();
      }
      confirmButton.focus();
    });
  }

  /**
   * @param {DialogRequest} request
   * @returns {Promise<string | null>}
   */
  function prompt(request) {
    return new Promise((resolve) => {
      paint(request, true);
      const finish = (value) => {
        cleanup();
        dialog.close();
        resolve(value);
      };
      const onCancel = () => finish(null);
      const onConfirm = () => finish(input.value.trim());
      const onClose = () => finish(null);
      const onKey = (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          onConfirm();
        }
      };

      cancelButton.addEventListener('click', onCancel, { once: true });
      confirmButton.addEventListener('click', onConfirm, { once: true });
      dialog.addEventListener('close', onClose, { once: true });
      input.addEventListener('keydown', onKey);

      function cleanup() {
        cancelButton.removeEventListener('click', onCancel);
        confirmButton.removeEventListener('click', onConfirm);
        dialog.removeEventListener('close', onClose);
        input.removeEventListener('keydown', onKey);
      }

      if (!dialog.open) {
        dialog.showModal();
      }
      input.focus();
      input.select();
    });
  }

  /**
   * @param {DialogRequest} request
   * @param {boolean} showInput
   * @returns {void}
   */
  function paint(request, showInput) {
    eyebrow.textContent = request.eyebrow;
    title.textContent = request.title;
    copy.textContent = request.copy;
    cancelButton.textContent = request.cancelLabel ?? 'Cancel';
    confirmButton.textContent = request.confirmLabel;
    confirmButton.classList.toggle('danger-action', Boolean(request.danger));
    altButton.hidden = !request.altLabel;
    altButton.textContent = request.altLabel ?? '';
    inputWrap.hidden = !showInput;
    input.value = request.inputValue ?? '';
    input.setAttribute('aria-label', request.inputLabel ?? 'Value');
  }
}
