/**
 * Treatments Editor (treatments-editor.js)
 * ------------------------------------------------------------
 * Lists, adds, edits and deletes spa treatments, then saves treatments.html
 * through the admin API.
 *
 * ⚠️ KNOWN LIMITATION: this editor reads cards marked with
 * `data-treatment-id` / `.treatment-name`, but the live treatments.html uses
 * `<article class="treatment-card">` with an <h3> and free-text prices, so the
 * list loads empty. It also generates a fragment of cards rather than a full
 * page — the Lambda now rejects that (HTTP 422) instead of overwriting the
 * live page. See "Known limitations" in README.md for the planned fix.
 */

const TreatmentsEditor = {
  treatments: [],
  editingIdx: null, // index of the treatment being edited, null when adding

  async init() {
    await this.loadTreatments();
    this.setupForm();
  },

  async loadTreatments() {
    try {
      const response = await AdminAuth.request('/admin/api/content?file=treatments.html');
      if (!response) return;
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      this.parseTreatments(await response.text());
      this.renderTreatmentsList();
    } catch (error) {
      console.error('Failed to load treatments:', error);
      AdminUI.showToast('Failed to load treatments', 'error');
    }
  },

  // Pull treatment data out of the page's HTML using DOMParser (no regex scraping).
  parseTreatments(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const cards = doc.querySelectorAll('[data-treatment-id]');

    this.treatments = Array.from(cards).map(card => ({
      id: card.getAttribute('data-treatment-id'),
      category: card.getAttribute('data-category'),
      name: card.querySelector('.treatment-name')?.textContent.trim() || '',
      description: card.querySelector('.treatment-description')?.textContent.trim() || '',
      duration: parseInt(card.getAttribute('data-duration'), 10) || 60,
      price: parseFloat(card.getAttribute('data-price')) || 0
    }));
  },

  renderTreatmentsList() {
    const list = document.getElementById('treatments-list');
    if (!list) return;

    if (this.treatments.length === 0) {
      list.innerHTML = '<p style="text-align: center; color: #999;">No treatments found.</p>';
      return;
    }

    const esc = AdminUI.escapeHtml;
    list.innerHTML = this.treatments.map((t, idx) => `
      <div class="list-item">
        <div class="list-item-info">
          <h4>${esc(t.name)}</h4>
          <p>${esc(t.description.substring(0, 100))}...</p>
          <p style="margin-top: 0.5rem; font-size: 0.85rem; color: #999;">
            ${t.duration}min • $${t.price.toFixed(2)} • ${esc(this.getCategoryLabel(t.category))}
          </p>
        </div>
        <div class="list-item-actions">
          <button class="btn btn-secondary" onclick="TreatmentsEditor.editTreatment(${idx})">Edit</button>
          <button class="btn btn-danger" onclick="TreatmentsEditor.deleteTreatment(${idx})">Delete</button>
        </div>
      </div>
    `).join('');
  },

  setupForm() {
    const form = document.getElementById('new-treatment-form');
    if (!form) return;
    // A single submit handler covers both add and update (see editingIdx).
    // Previously "edit" also set form.onsubmit, so both handlers fired and
    // updating a treatment added a duplicate copy.
    form.addEventListener('submit', (e) => this.handleFormSubmit(e));
    form.addEventListener('reset', () => this.exitEditMode()); // "Clear" button
  },

  async handleFormSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);

    const data = {
      name: formData.get('name'),
      category: formData.get('category'),
      description: formData.get('description'),
      duration: parseInt(formData.get('duration'), 10),
      price: parseFloat(formData.get('price'))
    };

    if (this.editingIdx !== null) {
      Object.assign(this.treatments[this.editingIdx], data);
    } else {
      this.treatments.push({ id: `treatment-${Date.now()}`, ...data });
    }

    if (await this.saveTreatments()) form.reset();
    this.renderTreatmentsList();
  },

  editTreatment(idx) {
    const t = this.treatments[idx];
    if (!t) return;

    const form = document.getElementById('new-treatment-form');
    // Use form.elements: `form.name` is the <form>'s own name attribute, not the "name" input.
    const fields = form.elements;
    fields['name'].value = t.name;
    fields['category'].value = t.category;
    fields['description'].value = t.description;
    fields['duration'].value = t.duration;
    fields['price'].value = t.price.toFixed(2);

    this.editingIdx = idx;
    form.querySelector('button[type="submit"]').textContent = 'Update Treatment';
    form.scrollIntoView({ behavior: 'smooth' });
  },

  exitEditMode() {
    this.editingIdx = null;
    const btn = document.querySelector('#new-treatment-form button[type="submit"]');
    if (btn) btn.textContent = 'Add Treatment';
  },

  async deleteTreatment(idx) {
    if (!confirm('Are you sure you want to delete this treatment?')) return;
    this.treatments.splice(idx, 1);
    this.exitEditMode();
    this.renderTreatmentsList();
    await this.saveTreatments();
  },

  saveTreatments() {
    return AdminUI.saveFile('treatments.html', this.generateTreatmentsHTML(), 'treatments');
  },

  // Markup for the cards (a fragment — see KNOWN LIMITATION at the top).
  generateTreatmentsHTML() {
    const esc = AdminUI.escapeHtml;
    return this.treatments.map(t => `
      <div class="treatment-card" data-treatment-id="${esc(t.id)}" data-category="${esc(t.category)}" data-duration="${t.duration}" data-price="${t.price}">
        <h3 class="treatment-name">${esc(t.name)}</h3>
        <p class="treatment-description">${esc(t.description)}</p>
        <div class="treatment-meta">
          <span>${t.duration} min</span>
          <span>$${t.price.toFixed(2)}</span>
        </div>
      </div>
    `).join('\n');
  },

  getCategoryLabel(cat) {
    const labels = { massage: 'Massage', skin: 'Skin Care', wellness: 'Wellness' };
    return labels[cat] || cat;
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => TreatmentsEditor.init());
} else {
  TreatmentsEditor.init();
}
