import { isTextObject } from '../tools/objects.js';

/**
 * Renders a selectable layer stack for the active face.
 * @param {HTMLElement} list
 * @param {import('fabric').Canvas} canvas
 * @param {{ onMutate: () => void }} hooks
 * @returns {{ render: () => void }}
 */
export function createLayerList(list, canvas, hooks) {
  list.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const item = target.closest('[data-layer-index]');
    if (!(item instanceof HTMLElement) || item.dataset.layerIndex === undefined) {
      return;
    }
    const object = canvas.getObjects()[Number(item.dataset.layerIndex)];
    if (!object) {
      return;
    }
    if (target.closest('[data-layer-visibility]')) {
      object.set({ visible: object.visible === false });
      canvas.requestRenderAll();
      hooks.onMutate();
      render();
      return;
    }
    canvas.setActiveObject(object);
    canvas.requestRenderAll();
    hooks.onMutate();
  });

  return { render };

  /**
   * @returns {void}
   */
  function render() {
    const objects = canvas.getObjects();
    const active = canvas.getActiveObject();
    list.replaceChildren();
    if (objects.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'layer-empty';
      empty.textContent = 'No layers on this side yet.';
      list.append(empty);
      return;
    }

    objects.slice().reverse().forEach((object) => {
      const index = objects.indexOf(object);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'layer-row';
      button.dataset.layerIndex = String(index);
      button.setAttribute('aria-pressed', String(object === active));

      const visibility = document.createElement('span');
      visibility.dataset.layerVisibility = 'true';
      visibility.className = 'layer-eye';
      visibility.textContent = object.visible === false ? '○' : '●';
      visibility.title = object.visible === false ? 'Show layer' : 'Hide layer';

      const copy = document.createElement('span');
      copy.className = 'layer-copy';
      const title = document.createElement('strong');
      title.textContent = layerTitle(object);
      const meta = document.createElement('i');
      meta.textContent = layerMeta(object);
      copy.append(title, meta);

      button.append(visibility, copy);
      list.append(button);
    });
  }
}

/**
 * @param {import('fabric').FabricObject} object
 * @returns {string}
 */
function layerTitle(object) {
  const roleNames = {
    name: 'Name',
    title: 'Title',
    company: 'Company',
    email: 'Email',
    phone: 'Phone',
    website: 'Website',
    monogram: 'Monogram',
    contactPair: 'Contact line',
  };
  if (typeof object.cardRole === 'string' && roleNames[object.cardRole]) {
    return roleNames[object.cardRole];
  }
  if (object.cardKind === 'qr' || object.cardKind === 'qr-slot') {
    return 'QR code';
  }
  if (object.cardKind === 'icon') {
    return 'Icon';
  }
  if (isTextObject(object) && typeof object.text === 'string' && object.text.trim()) {
    return object.text.replace(/\s+/g, ' ').slice(0, 28);
  }
  const names = {
    image: 'Image',
    rect: 'Rectangle',
    ellipse: 'Ellipse',
    circle: 'Circle',
  };
  return names[object.type] ?? 'Object';
}

/**
 * @param {import('fabric').FabricObject} object
 * @returns {string}
 */
function layerMeta(object) {
  const bits = [];
  if (object.lockMovementX) {
    bits.push('Locked');
  }
  if (object.visible === false) {
    bits.push('Hidden');
  }
  bits.push(object.type ?? 'layer');
  return bits.join(' · ');
}
