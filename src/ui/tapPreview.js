import { profileDisplayName, profileInitials } from '../domain/profile.js';
import { normalizeUrl, whatsappUrl } from '../domain/vcard.js';

/**
 * Phone-frame preview of the digital card a tap would open.
 * @param {HTMLDialogElement} dialog
 * @returns {{ open: (profile: import('../domain/profile.js').CardProfile, onSaveContact: () => void) => void }}
 */
export function createTapPreview(dialog) {
  const initials = dialog.querySelector('#tap-initials');
  const name = dialog.querySelector('#tap-name');
  const role = dialog.querySelector('#tap-role');
  const company = dialog.querySelector('#tap-company');
  const actions = dialog.querySelector('#tap-actions');
  const closeButton = dialog.querySelector('#tap-close');
  if (
    !(initials instanceof HTMLElement) ||
    !(name instanceof HTMLElement) ||
    !(role instanceof HTMLElement) ||
    !(company instanceof HTMLElement) ||
    !(actions instanceof HTMLElement) ||
    !(closeButton instanceof HTMLButtonElement)
  ) {
    throw new Error('[TapPreview] Dialog is missing its card frame');
  }

  closeButton.addEventListener('click', () => dialog.close());

  return {
    /**
     * @param {import('../domain/profile.js').CardProfile} profile
     * @param {() => void} onSaveContact
     */
    open(profile, onSaveContact) {
      initials.textContent = profileInitials(profile);
      name.textContent = profileDisplayName(profile);
      role.textContent = profile.title || 'Add a title';
      company.textContent = profile.company || 'Add a company';
      actions.replaceChildren();

      const links = [
        profile.phone ? { href: `tel:${profile.phone}`, label: 'Call', kind: 'link' } : null,
        profile.email ? { href: `mailto:${profile.email}`, label: 'Email', kind: 'link' } : null,
        profile.phone && whatsappUrl(profile.phone)
          ? { href: whatsappUrl(profile.phone), label: 'WhatsApp', kind: 'link' }
          : null,
        profile.website
          ? { href: normalizeUrl(profile.website), label: 'Website', kind: 'link' }
          : null,
        profile.linkedin
          ? { href: normalizeUrl(profile.linkedin), label: 'LinkedIn', kind: 'link' }
          : null,
        profile.instagram
          ? { href: normalizeUrl(profile.instagram), label: 'Instagram', kind: 'link' }
          : null,
        { href: '#save', label: 'Save contact', kind: 'save' },
      ].filter(Boolean);

      links.forEach((item) => {
        if (!item) {
          return;
        }
        if (item.kind === 'save') {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'tap-action tap-action-primary';
          button.textContent = item.label;
          button.addEventListener('click', onSaveContact);
          actions.append(button);
          return;
        }
        const anchor = document.createElement('a');
        anchor.className = 'tap-action';
        anchor.href = item.href;
        anchor.target = '_blank';
        anchor.rel = 'noreferrer';
        anchor.textContent = item.label;
        actions.append(anchor);
      });

      if (!dialog.open) {
        dialog.showModal();
      }
      closeButton.focus();
    },
  };
}
