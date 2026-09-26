/**
 * @typedef {{ id: string, projectName: string, savedAt: string }} SavedCard
 * @typedef {{ currentName: string, saved: SavedCard[] }} LibraryModel
 * @typedef {{ onOpen: (id: string) => void, onDelete: (id: string) => void }} LibraryActions
 */

/**
 * Lists cards kept on this device and the one currently open.
 * @param {HTMLDialogElement} dialog
 * @returns {{
 *   open: (model: LibraryModel, actions: LibraryActions) => void,
 *   repaint: (model: LibraryModel) => void,
 *   close: () => void,
 * }}
 * @throws {Error} When the dialog is missing its list.
 */
export function createLibraryDialog(dialog) {
  const list = dialog.querySelector('#library-list');
  const empty = dialog.querySelector('#library-empty');
  const closeButton = dialog.querySelector('#library-close');
  if (
    !(list instanceof HTMLElement) ||
    !(empty instanceof HTMLElement) ||
    !(closeButton instanceof HTMLButtonElement)
  ) {
    throw new Error('[Library] Dialog is missing its card list');
  }

  /** @type {LibraryActions | null} */
  let actions = null;

  closeButton.addEventListener('click', () => dialog.close());
  list.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element) || !actions) {
      return;
    }
    const row = target.closest('[data-card-id]');
    if (!(row instanceof HTMLElement) || !row.dataset.cardId) {
      return;
    }
    if (target.closest('[data-library-delete]')) {
      actions.onDelete(row.dataset.cardId);
      return;
    }
    if (target.closest('[data-library-open]')) {
      actions.onOpen(row.dataset.cardId);
    }
  });

  return {
    /**
     * @param {LibraryModel} model
     * @param {LibraryActions} nextActions
     */
    open(model, nextActions) {
      actions = nextActions;
      paint(model);
      if (!dialog.open) {
        dialog.showModal();
      }
      closeButton.focus();
    },

    /**
     * @param {LibraryModel} model
     */
    repaint(model) {
      paint(model);
    },

    close() {
      if (dialog.open) {
        dialog.close();
      }
    },
  };

  /**
   * @param {LibraryModel} model
   * @returns {void}
   */
  function paint(model) {
    empty.hidden = model.saved.length > 0;
    list.replaceChildren();
    list.append(currentRow(model.currentName));
    model.saved.forEach((card) => {
      list.append(savedRow(card));
    });
  }
}

/**
 * @param {string} name
 * @returns {HTMLElement}
 */
function currentRow(name) {
  const row = document.createElement('div');
  row.className = 'library-row library-current';
  const copy = document.createElement('div');
  copy.className = 'library-copy';
  const title = document.createElement('strong');
  title.textContent = name;
  const meta = document.createElement('span');
  meta.textContent = 'Editing now';
  copy.append(title, meta);
  row.append(copy);
  return row;
}

/**
 * @param {{ id: string, projectName: string, savedAt: string }} card
 * @returns {HTMLElement}
 */
function savedRow(card) {
  const row = document.createElement('div');
  row.className = 'library-row';
  row.dataset.cardId = card.id;
  const copy = document.createElement('div');
  copy.className = 'library-copy';
  const title = document.createElement('strong');
  title.textContent = card.projectName;
  const meta = document.createElement('span');
  meta.textContent = formatSavedAt(card.savedAt);
  copy.append(title, meta);

  const openButton = document.createElement('button');
  openButton.type = 'button';
  openButton.className = 'secondary-button';
  openButton.dataset.libraryOpen = 'true';
  openButton.textContent = 'Open';

  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.className = 'secondary-button danger';
  deleteButton.dataset.libraryDelete = 'true';
  deleteButton.setAttribute('aria-label', `Delete ${card.projectName}`);
  deleteButton.textContent = 'Delete';

  row.append(copy, openButton, deleteButton);
  return row;
}

/**
 * @param {string} iso
 * @returns {string}
 */
function formatSavedAt(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return 'Saved on this device';
  }
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
