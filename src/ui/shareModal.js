/**
 * @typedef {{ name: string, blob: Blob }} SharePreview
 */

/**
 * Controls the fallback dialog used when the Web Share API cannot save files.
 * @param {HTMLDialogElement} dialog
 * @returns {{ open: (items: SharePreview[]) => void }}
 */
export function createShareModal(dialog) {
  const previews = dialog.querySelector('#share-previews');
  const closeButton = dialog.querySelector('#share-close');
  if (!(previews instanceof HTMLElement) || !(closeButton instanceof HTMLButtonElement)) {
    throw new Error('[ShareModal] Dialog is missing its preview list or close button');
  }

  /** @type {string[]} */
  let objectUrls = [];

  dialog.addEventListener('close', () => {
    objectUrls.forEach((url) => URL.revokeObjectURL(url));
    objectUrls = [];
    previews.replaceChildren();
  });

  closeButton.addEventListener('click', () => {
    dialog.close();
  });

  return {
    /**
     * @param {SharePreview[]} items
     */
    open(items) {
      if (dialog.open) {
        dialog.close();
      }

      items.forEach((item) => {
        const url = URL.createObjectURL(item.blob);
        objectUrls.push(url);
        previews.append(createPreview(item.name, url));
      });
      dialog.showModal();
      closeButton.focus();
    },
  };
}

/**
 * @param {string} name
 * @param {string} url
 * @returns {HTMLElement}
 */
function createPreview(name, url) {
  const figure = document.createElement('figure');
  figure.className = 'share-preview';

  const image = document.createElement('img');
  image.src = url;
  image.alt = `${name} preview`;

  const caption = document.createElement('figcaption');
  caption.textContent = name;

  const download = document.createElement('a');
  download.href = url;
  download.download = name;
  download.textContent = `Download ${name}`;

  figure.append(image, caption, download);
  return figure;
}
