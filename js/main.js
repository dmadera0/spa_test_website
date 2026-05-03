/**
 * Serenity Spa & Wellness — main.js
 * Vanilla JavaScript for all interactive features.
 *
 * Modules:
 *  1. Navigation (sticky, mobile menu, active highlighting)
 *  2. FAQ Accordion
 *  3. Treatment Filter
 *  4. Contact Form Validation
 *  5. Smooth Scroll
 *  6. Utility helpers
 */

(function () {
  'use strict';

  /* ==========================================
     1. NAVIGATION
     ========================================== */

  const nav    = document.querySelector('.nav');
  const toggle = document.querySelector('.nav-toggle');
  const links  = document.querySelector('.nav-links');

  // Sticky shadow on scroll
  if (nav) {
    window.addEventListener('scroll', function () {
      nav.classList.toggle('scrolled', window.scrollY > 10);
    }, { passive: true });
  }

  // Mobile hamburger toggle
  if (toggle && links) {
    toggle.addEventListener('click', function () {
      const isOpen = links.classList.toggle('open');
      toggle.classList.toggle('open', isOpen);
      toggle.setAttribute('aria-expanded', String(isOpen));
      // Prevent body scroll when menu is open
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });

    // Close menu when a link is clicked
    links.querySelectorAll('.nav-link').forEach(function (link) {
      link.addEventListener('click', function () {
        links.classList.remove('open');
        toggle.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      });
    });

    // Close menu on outside click
    document.addEventListener('click', function (e) {
      if (links.classList.contains('open') &&
          !links.contains(e.target) &&
          !toggle.contains(e.target)) {
        links.classList.remove('open');
        toggle.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      }
    });

    // Close on Escape key
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && links.classList.contains('open')) {
        links.classList.remove('open');
        toggle.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
        toggle.focus();
      }
    });
  }

  // Active page highlighting — match current path to nav links
  (function highlightActiveLink() {
    const path = window.location.pathname;
    const filename = path.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-link').forEach(function (link) {
      const href = link.getAttribute('href') || '';
      const linkFile = href.split('/').pop();
      if (
        (filename === linkFile) ||
        (filename === '' && (linkFile === 'index.html' || linkFile === '')) ||
        (filename === 'index.html' && linkFile === 'index.html')
      ) {
        link.classList.add('active');
        link.setAttribute('aria-current', 'page');
      }
    });
  })();


  /* ==========================================
     2. FAQ ACCORDION
     ========================================== */

  function initAccordions() {
    const items = document.querySelectorAll('.accordion-item');
    if (!items.length) return;

    items.forEach(function (item) {
      const trigger = item.querySelector('.accordion-trigger');
      const body    = item.querySelector('.accordion-body');
      if (!trigger || !body) return;

      // Set initial ARIA state
      trigger.setAttribute('aria-expanded', 'false');
      const bodyId = 'accordion-body-' + Math.random().toString(36).slice(2, 8);
      body.id = bodyId;
      trigger.setAttribute('aria-controls', bodyId);

      trigger.addEventListener('click', function () {
        const isOpen = item.classList.contains('open');

        // Close all other open items (one-open-at-a-time)
        items.forEach(function (other) {
          if (other !== item && other.classList.contains('open')) {
            closeItem(other);
          }
        });

        if (isOpen) {
          closeItem(item);
        } else {
          openItem(item);
        }
      });

      // Keyboard: Enter/Space handled by default for button; also support arrow keys
      trigger.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          const next = getAdjacentItem(items, item, 1);
          if (next) next.querySelector('.accordion-trigger').focus();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          const prev = getAdjacentItem(items, item, -1);
          if (prev) prev.querySelector('.accordion-trigger').focus();
        } else if (e.key === 'Home') {
          e.preventDefault();
          items[0].querySelector('.accordion-trigger').focus();
        } else if (e.key === 'End') {
          e.preventDefault();
          items[items.length - 1].querySelector('.accordion-trigger').focus();
        }
      });
    });
  }

  function openItem(item) {
    const body    = item.querySelector('.accordion-body');
    const inner   = item.querySelector('.accordion-body-inner');
    const trigger = item.querySelector('.accordion-trigger');
    item.classList.add('open');
    trigger.setAttribute('aria-expanded', 'true');
    body.style.maxHeight = inner.scrollHeight + 'px';
  }

  function closeItem(item) {
    const body    = item.querySelector('.accordion-body');
    const trigger = item.querySelector('.accordion-trigger');
    item.classList.remove('open');
    trigger.setAttribute('aria-expanded', 'false');
    body.style.maxHeight = '0';
  }

  function getAdjacentItem(items, current, direction) {
    const arr = Array.from(items);
    const idx = arr.indexOf(current);
    return arr[idx + direction] || null;
  }

  initAccordions();


  /* ==========================================
     3. TREATMENT FILTER
     ========================================== */

  function initTreatmentFilter() {
    const filterBar = document.querySelector('.filter-bar');
    const grid      = document.querySelector('.treatments-grid');
    if (!filterBar || !grid) return;

    const buttons = filterBar.querySelectorAll('.filter-btn');
    const cards   = grid.querySelectorAll('.treatment-card');

    filterBar.addEventListener('click', function (e) {
      const btn = e.target.closest('.filter-btn');
      if (!btn) return;

      // Update active button
      buttons.forEach(function (b) {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');

      const filter = btn.dataset.filter || 'all';

      // Show/hide cards with smooth transition
      let visibleCount = 0;
      cards.forEach(function (card) {
        const category = card.dataset.category || '';
        const show = filter === 'all' || category === filter;

        if (show) {
          card.removeAttribute('data-hidden');
          card.style.animation = 'fadeInUp 0.4s ease both';
          visibleCount++;
        } else {
          card.setAttribute('data-hidden', 'true');
        }
      });

      // Announce result to screen readers
      announceToSR(visibleCount + ' treatment' + (visibleCount !== 1 ? 's' : '') + ' shown');
    });

    // Set initial aria-pressed states
    buttons.forEach(function (b) {
      b.setAttribute('aria-pressed', b.classList.contains('active') ? 'true' : 'false');
    });
  }

  initTreatmentFilter();


  /* ==========================================
     4. CONTACT FORM VALIDATION
     ========================================== */

  function initContactForm() {
    const form    = document.querySelector('#contact-form');
    const success = document.querySelector('#form-success');
    if (!form) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (validateForm(form)) {
        // Simulate async submission (no backend needed)
        const submitBtn = form.querySelector('[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending…';

        setTimeout(function () {
          form.style.display = 'none';
          if (success) {
            success.classList.add('visible');
            success.focus();
          }
        }, 900);
      }
    });

    // Live validation on blur
    form.querySelectorAll('[data-validate]').forEach(function (field) {
      field.addEventListener('blur', function () {
        validateField(field);
      });
      field.addEventListener('input', function () {
        // Clear error once user starts correcting
        if (field.classList.contains('error')) {
          clearError(field);
        }
      });
    });
  }

  function validateForm(form) {
    let valid = true;
    form.querySelectorAll('[data-validate]').forEach(function (field) {
      if (!validateField(field)) valid = false;
    });
    return valid;
  }

  function validateField(field) {
    const rules = (field.dataset.validate || '').split('|');
    let errorMsg = '';

    for (const rule of rules) {
      if (rule === 'required' && !field.value.trim()) {
        errorMsg = 'This field is required.';
        break;
      }
      if (rule === 'email' && field.value.trim() && !isValidEmail(field.value.trim())) {
        errorMsg = 'Please enter a valid email address.';
        break;
      }
      if (rule === 'phone' && field.value.trim() && !isValidPhone(field.value.trim())) {
        errorMsg = 'Please enter a valid phone number.';
        break;
      }
      if (rule.startsWith('min:')) {
        const min = parseInt(rule.split(':')[1], 10);
        if (field.value.trim().length < min) {
          errorMsg = 'Please enter at least ' + min + ' characters.';
          break;
        }
      }
    }

    if (errorMsg) {
      showError(field, errorMsg);
      return false;
    }

    clearError(field);
    return true;
  }

  function showError(field, msg) {
    field.classList.add('error');
    field.setAttribute('aria-invalid', 'true');
    const errEl = field.parentElement.querySelector('.form-error');
    if (errEl) {
      errEl.textContent = msg;
      errEl.classList.add('visible');
      field.setAttribute('aria-describedby', errEl.id || '');
    }
  }

  function clearError(field) {
    field.classList.remove('error');
    field.setAttribute('aria-invalid', 'false');
    const errEl = field.parentElement.querySelector('.form-error');
    if (errEl) {
      errEl.classList.remove('visible');
      errEl.textContent = '';
    }
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function isValidPhone(phone) {
    return /^[\d\s\-\+\(\)\.]{7,20}$/.test(phone);
  }

  initContactForm();


  /* ==========================================
     5. SMOOTH SCROLL
     ========================================== */

  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href').slice(1);
      const target   = document.getElementById(targetId);
      if (!target) return;
      e.preventDefault();
      const offset = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-height'), 10) || 72;
      const top = target.getBoundingClientRect().top + window.scrollY - offset - 16;
      window.scrollTo({ top, behavior: 'smooth' });
      target.focus({ preventScroll: true });
    });
  });


  /* ==========================================
     6. UTILITY HELPERS
     ========================================== */

  // Accessible live region for screen reader announcements
  let srRegion;
  function announceToSR(message) {
    if (!srRegion) {
      srRegion = document.createElement('div');
      srRegion.setAttribute('aria-live', 'polite');
      srRegion.setAttribute('aria-atomic', 'true');
      srRegion.className = 'sr-only';
      document.body.appendChild(srRegion);
    }
    srRegion.textContent = '';
    // Small delay so the DOM mutation triggers re-announcement
    requestAnimationFrame(function () {
      srRegion.textContent = message;
    });
  }

  // Intersection Observer for entrance animations (progressive enhancement)
  if ('IntersectionObserver' in window) {
    const observerOptions = {
      rootMargin: '0px 0px -60px 0px',
      threshold:  0.1,
    };

    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.style.animationPlayState = 'running';
          observer.unobserve(entry.target);
        }
      });
    }, observerOptions);

    // Pause animations until elements are in view
    document.querySelectorAll('.animate-fade-in-up').forEach(function (el) {
      el.style.animationPlayState = 'paused';
      observer.observe(el);
    });
  }

})();
