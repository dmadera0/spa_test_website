/**
 * FAQ Editor (faq-editor.js)
 * ------------------------------------------------------------
 * Lists, filters, adds, edits and deletes FAQ entries, then saves faq.html.
 *
 * ⚠️ KNOWN LIMITATION: this editor reads `[data-faq-id]` / `.faq-question`,
 * but the live faq.html uses `.accordion-item` / `.accordion-trigger`, so the
 * list loads empty. It also saves a fragment rather than the full page — the
 * Lambda now rejects that (HTTP 422) instead of wiping the live FAQ page.
 * See README "Known limitations".
 */

const FAQ_CATEGORIES = {
  booking: 'Booking & Appointments',
  treatments: 'Treatments & Services',
  pricing: 'Pricing & Membership',
  health: 'Health & Wellness',
  policies: 'Business Policies'
};

const FAQEditor = {
  faqItems: [],      // all entries
  filteredItems: [], // entries shown after the category filter
  editingIdx: null,  // index into faqItems while editing, null when adding

  async init() {
    await this.loadFAQ();
    this.setupForm();
  },

  async loadFAQ() {
    try {
      const response = await AdminAuth.request('/admin/api/content?file=faq.html');
      if (!response) return;
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      this.parseFAQ(await response.text());
      this.renderFAQList();
    } catch (error) {
      console.error('Failed to load FAQ:', error);
      AdminUI.showToast('Failed to load FAQ', 'error');
    }
  },

  parseFAQ(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const items = doc.querySelectorAll('[data-faq-id]');

    this.faqItems = Array.from(items).map(item => ({
      id: item.getAttribute('data-faq-id'),
      category: item.getAttribute('data-category') || 'general',
      question: item.querySelector('.faq-question')?.textContent.trim() || '',
      answer: item.querySelector('.faq-answer')?.textContent.trim() || ''
    }));

    this.filteredItems = [...this.faqItems];
  },

  renderFAQList() {
    const list = document.getElementById('faq-list');
    if (!list) return;

    if (this.filteredItems.length === 0) {
      list.innerHTML = '<p style="text-align: center; color: #999;">No FAQ items found.</p>';
      return;
    }

    const esc = AdminUI.escapeHtml;
    list.innerHTML = this.filteredItems.map(item => {
      const idx = this.faqItems.indexOf(item); // index in the full list, not the filtered one
      return `
        <div class="list-item">
          <div class="list-item-info">
            <h4>${esc(item.question)}</h4>
            <p>${esc(item.answer.substring(0, 120))}...</p>
            <p style="margin-top: 0.5rem; font-size: 0.85rem; color: #999;">Category: ${esc(FAQ_CATEGORIES[item.category] || item.category)}</p>
          </div>
          <div class="list-item-actions">
            <button class="btn btn-secondary" onclick="FAQEditor.editItem(${idx})">Edit</button>
            <button class="btn btn-danger" onclick="FAQEditor.deleteItem(${idx})">Delete</button>
          </div>
        </div>
      `;
    }).join('');
  },

  filterByCategory(category) {
    this.filteredItems = category
      ? this.faqItems.filter(item => item.category === category)
      : [...this.faqItems];
    this.renderFAQList();
  },

  refreshList() {
    const filter = document.getElementById('category-filter');
    this.filterByCategory(filter ? filter.value : '');
  },

  setupForm() {
    const form = document.getElementById('faq-form');
    if (!form) return;
    // One submit handler for add + update (fixes duplicate entries on edit).
    form.addEventListener('submit', (e) => this.handleFormSubmit(e));
    form.addEventListener('reset', () => this.exitEditMode()); // "Clear" button
  },

  async handleFormSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);

    const data = {
      category: formData.get('category'),
      question: formData.get('question'),
      answer: formData.get('answer')
    };

    if (this.editingIdx !== null) {
      Object.assign(this.faqItems[this.editingIdx], data);
    } else {
      this.faqItems.push({ id: `faq-${Date.now()}`, ...data });
    }

    if (await this.saveFAQ()) form.reset();
    this.refreshList();
  },

  editItem(idx) {
    const item = this.faqItems[idx];
    if (!item) return;

    const form = document.getElementById('faq-form');
    form.elements['category'].value = item.category;
    form.elements['question'].value = item.question;
    form.elements['answer'].value = item.answer;

    this.editingIdx = idx;
    form.querySelector('button[type="submit"]').textContent = 'Update FAQ';
    form.scrollIntoView({ behavior: 'smooth' });
  },

  exitEditMode() {
    this.editingIdx = null;
    const btn = document.querySelector('#faq-form button[type="submit"]');
    if (btn) btn.textContent = 'Add FAQ';
  },

  // Previously this removed the item, then filtered the *visible* list using the
  // id of the item that slid into the deleted slot — hiding the wrong entry.
  // Rebuilding the filtered list from the source of truth avoids that.
  async deleteItem(idx) {
    if (!confirm('Are you sure you want to delete this FAQ item?')) return;
    this.faqItems.splice(idx, 1);
    this.exitEditMode();
    this.refreshList();
    await this.saveFAQ();
  },

  saveFAQ() {
    return AdminUI.saveFile('faq.html', this.generateFAQHTML(), 'FAQ');
  },

  // Groups entries into one section per category.
  generateFAQHTML() {
    const esc = AdminUI.escapeHtml;
    return Object.keys(FAQ_CATEGORIES).map(cat => {
      const items = this.faqItems.filter(item => item.category === cat);
      return `
        <div class="faq-section" data-category="${cat}">
          ${items.map(item => `
            <div class="faq-item" data-faq-id="${esc(item.id)}" data-category="${esc(item.category)}">
              <h4 class="faq-question">${esc(item.question)}</h4>
              <p class="faq-answer">${esc(item.answer)}</p>
            </div>
          `).join('\n')}
        </div>
      `;
    }).join('\n');
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => FAQEditor.init());
} else {
  FAQEditor.init();
}
