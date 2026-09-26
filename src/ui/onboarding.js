/**
 * First-run studio that collects identity before a template is chosen.
 * @param {HTMLDialogElement} dialog
 * @param {{
 *   templates: { id: string, label: string, hint: string }[],
 * }} options
 * @returns {{
 *   open: () => Promise<{ profile: import('../domain/profile.js').CardProfile, template: string } | null>,
 * }}
 */
export function createOnboarding(dialog, options) {
  const form = dialog.querySelector('#onboarding-form');
  const steps = [...dialog.querySelectorAll('[data-onboard-step]')];
  const backButton = dialog.querySelector('#onboarding-back');
  const nextButton = dialog.querySelector('#onboarding-next');
  const grid = dialog.querySelector('#onboarding-templates');
  if (
    !(form instanceof HTMLFormElement) ||
    !(backButton instanceof HTMLButtonElement) ||
    !(nextButton instanceof HTMLButtonElement) ||
    !(grid instanceof HTMLElement)
  ) {
    throw new Error('[Onboarding] Dialog is missing its form');
  }

  let step = 0;
  /** @type {string} */
  let selectedTemplate = options.templates[0]?.id ?? 'editorial';

  grid.replaceChildren();
  options.templates.forEach((template) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `template-card template-${template.id}`;
    button.dataset.template = template.id;
    button.innerHTML = `<span>${template.label}</span><i>${template.hint}</i>`;
    button.setAttribute('aria-pressed', String(template.id === selectedTemplate));
    grid.append(button);
  });

  grid.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const template = target.closest('[data-template]')?.getAttribute('data-template');
    if (!template) {
      return;
    }
    selectedTemplate = template;
    grid.querySelectorAll('[data-template]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.getAttribute('data-template') === template));
    });
  });

  return { open };

  /**
   * @returns {Promise<{ profile: import('../domain/profile.js').CardProfile, template: string } | null>}
   */
  function open() {
    return new Promise((resolve) => {
      step = 0;
      paint();
      const finish = (value) => {
        cleanup();
        if (dialog.open) {
          dialog.close();
        }
        resolve(value);
      };
      const onNext = () => {
        if (step === 1 && !readProfile().fullName && !readProfile().email) {
          form.reportValidity();
          const nameInput = form.querySelector('#onboard-name');
          if (nameInput instanceof HTMLInputElement) {
            nameInput.setCustomValidity('Add your name or email so the tap payload is useful');
            nameInput.reportValidity();
            nameInput.setCustomValidity('');
          }
          return;
        }
        if (step >= steps.length - 1) {
          finish({ profile: readProfile(), template: selectedTemplate });
          return;
        }
        step += 1;
        paint();
      };
      const onBack = () => {
        if (step === 0) {
          finish(null);
          return;
        }
        step -= 1;
        paint();
      };
      const onClose = () => finish(null);
      const onSubmit = (event) => {
        event.preventDefault();
        onNext();
      };

      nextButton.addEventListener('click', onNext);
      backButton.addEventListener('click', onBack);
      form.addEventListener('submit', onSubmit);
      dialog.addEventListener('close', onClose);

      function cleanup() {
        nextButton.removeEventListener('click', onNext);
        backButton.removeEventListener('click', onBack);
        form.removeEventListener('submit', onSubmit);
        dialog.removeEventListener('close', onClose);
      }

      if (!dialog.open) {
        dialog.showModal();
      }
    });
  }

  /**
   * @returns {void}
   */
  function paint() {
    steps.forEach((section, index) => {
      section.toggleAttribute('hidden', index !== step);
    });
    backButton.textContent = step === 0 ? 'Skip for now' : 'Back';
    nextButton.textContent = step === steps.length - 1 ? 'Create card' : 'Continue';
  }

  /**
   * @returns {import('../domain/profile.js').CardProfile}
   */
  function readProfile() {
    return {
      fullName: inputValue('#onboard-name'),
      title: inputValue('#onboard-title'),
      company: inputValue('#onboard-company'),
      email: inputValue('#onboard-email'),
      phone: inputValue('#onboard-phone'),
      website: inputValue('#onboard-website'),
      linkedin: '',
      instagram: '',
      qrMode: 'vcard',
    };
  }

  /**
   * @param {string} selector
   * @returns {string}
   */
  function inputValue(selector) {
    const field = form.querySelector(selector);
    return field instanceof HTMLInputElement ? field.value.trim() : '';
  }
}
