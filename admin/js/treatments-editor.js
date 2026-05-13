// Treatments Editor
// Handles loading and editing spa treatments

const TreatmentsEditor = {
  treatments: [],

  async init() {
    await this.loadTreatments();
    this.setupForm();
  },

  // Load treatments from API
  async loadTreatments() {
    try {
      const response = await AdminAuth.request('/admin/api/content?file=treatments.html');
      if (!response) return;

      const html = await response.text();
      this.parseTreatments(html);
      this.renderTreatmentsList();
    } catch (error) {
      console.error('Failed to load treatments:', error);
      AdminUI.showToast('Failed to load treatments', 'error');
    }
  },

  // Parse treatments from HTML
  parseTreatments(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const cards = doc.querySelectorAll('[data-treatment-id]');

    this.treatments = Array.from(cards).map(card => ({
      id: card.getAttribute('data-treatment-id'),
      category: card.getAttribute('data-category'),
      name: card.querySelector('.treatment-name')?.textContent || '',
      description: card.querySelector('.treatment-description')?.textContent || '',
      duration: parseInt(card.getAttribute('data-duration')) || 60,
      price: parseFloat(card.getAttribute('data-price')) || 0
    }));
  },

  // Render treatments list
  renderTreatmentsList() {
    const list = document.getElementById('treatments-list');
    if (!list) return;

    if (this.treatments.length === 0) {
      list.innerHTML = '<p style="text-align: center; color: #999;">No treatments found.</p>';
      return;
    }

    list.innerHTML = this.treatments.map((treatment, idx) => `
      <div class="list-item">
        <div class="list-item-info">
          <h4>${this.escapeHtml(treatment.name)}</h4>
          <p>${this.escapeHtml(treatment.description.substring(0, 100))}...</p>
          <p style="margin-top: 0.5rem; font-size: 0.85rem; color: #999;">
            ${treatment.duration}min • $${treatment.price.toFixed(2)} • ${this.getCategoryLabel(treatment.category)}
          </p>
        </div>
        <div class="list-item-actions">
          <button class="btn btn-secondary" onclick="TreatmentsEditor.editTreatment(${idx})">Edit</button>
          <button class="btn btn-danger" onclick="TreatmentsEditor.deleteTreatment(${idx})">Delete</button>
        </div>
      </div>
    `).join('');
  },

  // Setup form handling
  setupForm() {
    const form = document.getElementById('new-treatment-form');
    if (form) {
      form.addEventListener('submit', (e) => this.handleFormSubmit(e));
    }
  },

  // Handle form submission
  async handleFormSubmit(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const newTreatment = {
      id: `treatment-${Date.now()}`,
      name: formData.get('name'),
      category: formData.get('category'),
      description: formData.get('description'),
      duration: parseInt(formData.get('duration')),
      price: parseFloat(formData.get('price'))
    };

    this.treatments.push(newTreatment);
    await this.saveTreatments();
    e.target.reset();
    this.renderTreatmentsList();
  },

  // Edit treatment
  editTreatment(idx) {
    const treatment = this.treatments[idx];
    if (!treatment) return;

    const form = document.getElementById('new-treatment-form');
    form.name.value = treatment.name;
    form.category.value = treatment.category;
    form.description.value = treatment.description;
    form.duration.value = treatment.duration;
    form.price.value = treatment.price.toFixed(2);

    form.scrollIntoView({ behavior: 'smooth' });

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.textContent = 'Update Treatment';

    form.onsubmit = async (e) => {
      e.preventDefault();
      treatment.name = form.name.value;
      treatment.category = form.category.value;
      treatment.description = form.description.value;
      treatment.duration = parseInt(form.duration.value);
      treatment.price = parseFloat(form.price.value);

      await this.saveTreatments();
      form.reset();
      submitBtn.textContent = 'Add Treatment';
      form.onsubmit = (e) => this.handleFormSubmit(e);
      this.renderTreatmentsList();
    };
  },

  // Delete treatment
  deleteTreatment(idx) {
    if (confirm('Are you sure you want to delete this treatment?')) {
      this.treatments.splice(idx, 1);
      this.saveTreatments();
      this.renderTreatmentsList();
    }
  },

  // Save treatments to API
  async saveTreatments() {
    try {
      AdminUI.showToast('Saving treatments...', 'info');

      const response = await AdminAuth.request('/admin/api/content', {
        method: 'PUT',
        body: JSON.stringify({
          file: 'treatments.html',
          content: this.generateTreatmentsHTML()
        })
      });

      if (!response || !response.ok) {
        throw new Error('Save failed');
      }

      AdminUI.showToast('Treatments saved successfully!', 'success');
    } catch (error) {
      console.error('Failed to save treatments:', error);
      AdminUI.showToast('Failed to save treatments', 'error');
    }
  },

  // Generate HTML for treatments
  generateTreatmentsHTML() {
    return this.treatments.map(t => `
      <div class="treatment-card" data-treatment-id="${t.id}" data-category="${t.category}" data-duration="${t.duration}" data-price="${t.price}">
        <h3 class="treatment-name">${this.escapeHtml(t.name)}</h3>
        <p class="treatment-description">${this.escapeHtml(t.description)}</p>
        <div class="treatment-meta">
          <span>${t.duration} min</span>
          <span>$${t.price.toFixed(2)}</span>
        </div>
      </div>
    `).join('\n');
  },

  // Get category label
  getCategoryLabel(cat) {
    const labels = { massage: 'Massage', skin: 'Skin Care', wellness: 'Wellness' };
    return labels[cat] || cat;
  },

  // Escape HTML
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => TreatmentsEditor.init());
} else {
  TreatmentsEditor.init();
}
