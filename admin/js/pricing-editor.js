// Pricing Editor
// Handles editing membership tiers and pricing

const PricingEditor = {
  pricingTiers: [],
  faqItems: [],

  async init() {
    await this.loadPricing();
    await this.loadPricingFAQ();
    this.setupForm();
  },

  // Load pricing tiers
  async loadPricing() {
    try {
      const response = await AdminAuth.request('/admin/api/content?file=pricing.html');
      if (!response) return;

      const html = await response.text();
      this.parsePricing(html);
      this.renderPricingTiers();
    } catch (error) {
      console.error('Failed to load pricing:', error);
      AdminUI.showToast('Failed to load pricing', 'error');
    }
  },

  // Parse pricing from HTML
  parsePricing(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const tiers = doc.querySelectorAll('[data-tier-id]');

    this.pricingTiers = Array.from(tiers).map(tier => ({
      id: tier.getAttribute('data-tier-id'),
      name: tier.querySelector('.tier-name')?.textContent || '',
      price: parseFloat(tier.getAttribute('data-price')) || 0,
      description: tier.querySelector('.tier-description')?.textContent || '',
      benefits: Array.from(tier.querySelectorAll('.tier-benefit')).map(b => b.textContent)
    }));
  },

  // Load pricing FAQ
  async loadPricingFAQ() {
    try {
      const response = await AdminAuth.request('/admin/api/content?file=faq.html');
      if (!response) return;

      const html = await response.text();
      this.parseFAQ(html, 'pricing');
      this.renderPricingFAQ();
    } catch (error) {
      console.error('Failed to load FAQ:', error);
    }
  },

  // Parse FAQ items
  parseFAQ(html, category) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const section = doc.querySelector(`[data-category="${category}"]`);

    if (section) {
      this.faqItems = Array.from(section.querySelectorAll('[data-faq-id]')).map(item => ({
        id: item.getAttribute('data-faq-id'),
        category: category,
        question: item.querySelector('.faq-question')?.textContent || '',
        answer: item.querySelector('.faq-answer')?.textContent || ''
      }));
    }
  },

  // Render pricing tiers
  renderPricingTiers() {
    const list = document.getElementById('pricing-tiers');
    if (!list) return;

    if (this.pricingTiers.length === 0) {
      list.innerHTML = '<p style="text-align: center; color: #999;">No pricing tiers found.</p>';
      return;
    }

    list.innerHTML = this.pricingTiers.map((tier, idx) => `
      <div class="list-item">
        <div class="list-item-info">
          <h4>${this.escapeHtml(tier.name)}</h4>
          <p>${this.escapeHtml(tier.description)}</p>
          <p style="margin-top: 0.5rem; font-weight: bold; color: var(--primary);">$${tier.price.toFixed(2)}/month</p>
        </div>
        <div class="list-item-actions">
          <button class="btn btn-secondary" onclick="PricingEditor.editTier(${idx})">Edit</button>
        </div>
      </div>
    `).join('');
  },

  // Render pricing FAQ
  renderPricingFAQ() {
    const list = document.getElementById('pricing-faq');
    if (!list) return;

    if (this.faqItems.length === 0) {
      list.innerHTML = '<p style="text-align: center; color: #999;">No FAQ items found.</p>';
      return;
    }

    list.innerHTML = this.faqItems.map((item, idx) => `
      <div class="list-item">
        <div class="list-item-info">
          <h4>${this.escapeHtml(item.question)}</h4>
          <p>${this.escapeHtml(item.answer.substring(0, 120))}...</p>
        </div>
        <div class="list-item-actions">
          <button class="btn btn-secondary" onclick="PricingEditor.editFAQItem(${idx})">Edit</button>
        </div>
      </div>
    `).join('');
  },

  // Setup form
  setupForm() {
    const form = document.getElementById('pricing-form');
    if (form) {
      form.addEventListener('submit', (e) => this.handleFormSubmit(e));
    }
  },

  // Handle form submission
  async handleFormSubmit(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const benefits = formData.get('tierBenefits')
      .split('\n')
      .map(b => b.trim())
      .filter(b => b.length > 0);

    const tierIdx = parseInt(e.target.dataset.tierIdx || '-1');
    const tierData = {
      name: formData.get('tierName'),
      price: parseFloat(formData.get('tierPrice')),
      description: formData.get('tierDescription'),
      benefits: benefits
    };

    if (tierIdx >= 0) {
      Object.assign(this.pricingTiers[tierIdx], tierData);
    }

    await this.savePricing();
    this.resetForm();
    this.renderPricingTiers();
  },

  // Edit tier
  editTier(idx) {
    const tier = this.pricingTiers[idx];
    if (!tier) return;

    const form = document.getElementById('pricing-form');
    form.dataset.tierIdx = idx;
    form['tierName'].value = tier.name;
    form['tierPrice'].value = tier.price.toFixed(2);
    form['tierDescription'].value = tier.description;
    form['tierBenefits'].value = tier.benefits.join('\n');

    form.scrollIntoView({ behavior: 'smooth' });
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.textContent = 'Update Tier';
  },

  // Edit FAQ item
  editFAQItem(idx) {
    AdminUI.showToast('FAQ editing redirects to FAQ page for better editing', 'info');
    // Could also allow inline editing here
  },

  // Save pricing
  async savePricing() {
    try {
      AdminUI.showToast('Saving pricing...', 'info');

      const response = await AdminAuth.request('/admin/api/content', {
        method: 'PUT',
        body: JSON.stringify({
          file: 'pricing.html',
          content: this.generatePricingHTML()
        })
      });

      if (!response || !response.ok) {
        throw new Error('Save failed');
      }

      AdminUI.showToast('Pricing saved successfully!', 'success');
    } catch (error) {
      console.error('Failed to save pricing:', error);
      AdminUI.showToast('Failed to save pricing', 'error');
    }
  },

  // Generate pricing HTML
  generatePricingHTML() {
    return this.pricingTiers.map(tier => `
      <div class="pricing-tier" data-tier-id="${tier.id}" data-price="${tier.price}">
        <h3 class="tier-name">${this.escapeHtml(tier.name)}</h3>
        <div class="tier-price">$${tier.price.toFixed(2)}<span>/month</span></div>
        <p class="tier-description">${this.escapeHtml(tier.description)}</p>
        <ul class="tier-benefits">
          ${tier.benefits.map(b => `<li class="tier-benefit">${this.escapeHtml(b)}</li>`).join('\n')}
        </ul>
      </div>
    `).join('\n');
  },

  // Reset form
  resetForm() {
    const form = document.getElementById('pricing-form');
    form.reset();
    form.dataset.tierIdx = '-1';
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.textContent = 'Update Tier';
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
  document.addEventListener('DOMContentLoaded', () => PricingEditor.init());
} else {
  PricingEditor.init();
}
