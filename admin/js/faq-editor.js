// FAQ Editor
// Handles editing FAQ questions and answers

const FAQEditor = {
  faqItems: [],
  filteredItems: [],

  async init() {
    await this.loadFAQ();
    this.setupForm();
  },

  // Load FAQ items
  async loadFAQ() {
    try {
      const response = await AdminAuth.request('/admin/api/content?file=faq.html');
      if (!response) return;

      const html = await response.text();
      this.parseFAQ(html);
      this.renderFAQList();
    } catch (error) {
      console.error('Failed to load FAQ:', error);
      AdminUI.showToast('Failed to load FAQ', 'error');
    }
  },

  // Parse FAQ from HTML
  parseFAQ(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const items = doc.querySelectorAll('[data-faq-id]');

    this.faqItems = Array.from(items).map(item => ({
      id: item.getAttribute('data-faq-id'),
      category: item.getAttribute('data-category') || 'general',
      question: item.querySelector('.faq-question')?.textContent || '',
      answer: item.querySelector('.faq-answer')?.textContent || ''
    }));

    this.filteredItems = [...this.faqItems];
  },

  // Render FAQ list
  renderFAQList() {
    const list = document.getElementById('faq-list');
    if (!list) return;

    if (this.filteredItems.length === 0) {
      list.innerHTML = '<p style="text-align: center; color: #999;">No FAQ items found.</p>';
      return;
    }

    list.innerHTML = this.filteredItems.map((item, idx) => `
      <div class="list-item">
        <div class="list-item-info">
          <h4>${this.escapeHtml(item.question)}</h4>
          <p>${this.escapeHtml(item.answer.substring(0, 120))}...</p>
          <p style="margin-top: 0.5rem; font-size: 0.85rem; color: #999;">Category: ${this.getCategoryLabel(item.category)}</p>
        </div>
        <div class="list-item-actions">
          <button class="btn btn-secondary" onclick="FAQEditor.editItem(${this.faqItems.indexOf(item)})">Edit</button>
          <button class="btn btn-danger" onclick="FAQEditor.deleteItem(${this.faqItems.indexOf(item)})">Delete</button>
        </div>
      </div>
    `).join('');
  },

  // Filter by category
  filterByCategory(category) {
    if (category) {
      this.filteredItems = this.faqItems.filter(item => item.category === category);
    } else {
      this.filteredItems = [...this.faqItems];
    }
    this.renderFAQList();
  },

  // Setup form
  setupForm() {
    const form = document.getElementById('faq-form');
    if (form) {
      form.addEventListener('submit', (e) => this.handleFormSubmit(e));
    }
  },

  // Handle form submission
  async handleFormSubmit(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const newItem = {
      id: `faq-${Date.now()}`,
      category: formData.get('category'),
      question: formData.get('question'),
      answer: formData.get('answer')
    };

    this.faqItems.push(newItem);
    this.filteredItems = [...this.faqItems];
    await this.saveFAQ();
    e.target.reset();
    this.renderFAQList();
  },

  // Edit item
  editItem(idx) {
    const item = this.faqItems[idx];
    if (!item) return;

    const form = document.getElementById('faq-form');
    form.dataset.itemIdx = idx;
    form['category'].value = item.category;
    form['question'].value = item.question;
    form['answer'].value = item.answer;

    form.scrollIntoView({ behavior: 'smooth' });
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.textContent = 'Update FAQ';

    form.onsubmit = async (e) => {
      e.preventDefault();
      item.category = form['category'].value;
      item.question = form['question'].value;
      item.answer = form['answer'].value;

      await this.saveFAQ();
      form.reset();
      submitBtn.textContent = 'Add FAQ';
      form.onsubmit = (e) => this.handleFormSubmit(e);
      this.filterByCategory(document.getElementById('category-filter').value);
    };
  },

  // Delete item
  deleteItem(idx) {
    if (confirm('Are you sure you want to delete this FAQ item?')) {
      this.faqItems.splice(idx, 1);
      this.filteredItems = this.filteredItems.filter(item => item.id !== this.faqItems[idx]?.id);
      this.saveFAQ();
      this.renderFAQList();
    }
  },

  // Save FAQ
  async saveFAQ() {
    try {
      AdminUI.showToast('Saving FAQ...', 'info');

      const response = await AdminAuth.request('/admin/api/content', {
        method: 'PUT',
        body: JSON.stringify({
          file: 'faq.html',
          content: this.generateFAQHTML()
        })
      });

      if (!response || !response.ok) {
        throw new Error('Save failed');
      }

      AdminUI.showToast('FAQ saved successfully!', 'success');
    } catch (error) {
      console.error('Failed to save FAQ:', error);
      AdminUI.showToast('Failed to save FAQ', 'error');
    }
  },

  // Generate FAQ HTML
  generateFAQHTML() {
    const categories = ['booking', 'treatments', 'pricing', 'health', 'policies'];
    return categories.map(cat => {
      const items = this.faqItems.filter(item => item.category === cat);
      return `
        <div class="faq-section" data-category="${cat}">
          ${items.map(item => `
            <div class="faq-item" data-faq-id="${item.id}" data-category="${item.category}">
              <h4 class="faq-question">${this.escapeHtml(item.question)}</h4>
              <p class="faq-answer">${this.escapeHtml(item.answer)}</p>
            </div>
          `).join('\n')}
        </div>
      `;
    }).join('\n');
  },

  // Get category label
  getCategoryLabel(cat) {
    const labels = {
      booking: 'Booking & Appointments',
      treatments: 'Treatments & Services',
      pricing: 'Pricing & Membership',
      health: 'Health & Wellness',
      policies: 'Business Policies'
    };
    return labels[cat] || cat;
  },

  // Escape HTML
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => FAQEditor.init());
} else {
  FAQEditor.init();
}
