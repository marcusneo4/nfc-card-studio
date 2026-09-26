/**
 * @param {HTMLDialogElement} dialog
 * @returns {{ open: () => void }}
 */
export function createShortcutsHelp(dialog) {
  dialog.querySelector('#shortcuts-close')?.addEventListener('click', () => dialog.close());
  return {
    open() {
      if (!dialog.open) {
        dialog.showModal();
      }
    },
  };
}
