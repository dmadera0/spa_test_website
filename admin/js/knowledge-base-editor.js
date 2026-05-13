// Knowledge Base Editor
// Handles editing RAG-formatted Q&A entries

const KnowledgeBaseEditor = {
  kbItems: [],
  filteredItems: [],

  async init() {
    await this.loadKnowledgeBase();
    this.setupForm();
  },

  // Load knowledge base
  async loadKnowledgeBase() {
    try {
      const response = await AdminAuth.request('/admin/api/content?file=knowledge-base.md');
      if (!response) return;

      const text = await response.text();
      this.parseKnowledgeBase(text);
      this.renderKBList();
    } catch (error) {
      console.error('Failed to load knowledge base:', error);
      AdminUI.showToast('Failed to load knowledge base', 'error');
    }
  },

  // Parse knowledge base from markdown
  parseKnowledgeBase(text) {
    const entries = text.split('\n---\n').filter(entry => entry.trim());

    this.kbItems = entries.map((entry, idx) => {
      const lines = entry.trim().split('\n');
      const item = { id: `kb-${idx}` };

      lines.forEach(line => {
        if (line.startsWith('id:')) item.id = line.replace('id:', '').trim();
        if (line.startsWith('category:')) item.category = line.replace('category:', '').trim();
        if (line.startsWith('question:')) item.question = line.replace('question:', '').trim();
        if (line.startsWith('answer:')) item.answer = line.replace('answer:', '').trim();
        if (line.startsWith('tags:')) item.tags = line.replace('tags:', '').trim().split(',').map(t => t.trim());
      });

      return item;
    });

    this.filteredItems = [...this.kbItems];
  },

  // Render KB list
  renderKBList() {
    const list = document.getElementById('kb-list');
    if (!list) return;

    if (this.filteredItems.length === 0) {
      list.innerHTML = '<p style="text-align: center; color: #999;">No knowledge base entries found.</p>';
      return;
    }

    list.innerHTML = this.filteredItems.map((item, idx) => {
      const actualIdx = this.kbItems.indexOf(item);
      return `
        <div class="list-item">
          <div class="list-item-info">
            <h4>${this.escapeHtml(item.question)}</h4>
            <p>${this.escapeHtml(item.answer?.substring(0, 100) || 'No answer')}...</p>
            <p style="margin-top: 0.5rem; font-size: 0.85rem; color: #999;">
              Category: ${this.escapeHtml(item.category || 'uncategorized')}
              ${item.tags ? `• Tags: ${item.tags.join(', ')}` : ''}
            </p>
          </div>
          <div class="list-item-actions">
            <button class="btn btn-secondary" onclick="KnowledgeBaseEditor.editItem(${actualIdx})">Edit</button>
            <button class="btn btn-danger" onclick="KnowledgeBaseEditor.deleteItem(${actualIdx})">Delete</button>
          </div>
        </div>
      `;
    }).join('');
  },

  // Filter by category
  filterByCategory(category) {
    if (category) {
      this.filteredItems = this.kbItems.filter(item => item.category === category);
    } else {
      this.filteredItems = [...this.kbItems];
    }
    this.renderKBList();
  },

  // Setup form
  setupForm() {
    const form = document.getElementById('kb-form');
    if (form) {
      form.addEventListener('submit', (e) => this.handleFormSubmit(e));
    }
  },

  // Handle form submission
  async handleFormSubmit(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const newItem = {
      id: `kb-${Date.now()}`,
      category: formData.get('category'),
      question: formData.get('question'),
      answer: formData.get('answer'),
      tags: formData.get('tags') ? formData.get('tags').split(',').map(t => t.trim()) : []
    };

    this.kbItems.push(newItem);
    this.filteredItems = [...this.kbItems];
    await this.saveKnowledgeBase();
    e.target.reset();
    this.renderKBList();
  },

  // Edit item
  editItem(idx) {
    const item = this.kbItems[idx];
    if (!item) return;

    const form = document.getElementById('kb-form');
    form.dataset.itemIdx = idx;
    form['category'].value = item.category || '';
    form['question'].value = item.question || '';
    form['answer'].value = item.answer || '';
    form['tags'].value = item.tags ? item.tags.join(', ') : '';

    form.scrollIntoView({ behavior: 'smooth' });
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.textContent = 'Update Entry';

    form.onsubmit = async (e) => {
      e.preventDefault();
      item.category = form['category'].value;
      item.question = form['question'].value;
      item.answer = form['answer'].value;
      item.tags = form['tags'].value ? form['tags'].value.split(',').map(t => t.trim()) : [];

      await this.saveKnowledgeBase();
      form.reset();
      submitBtn.textContent = 'Add Entry';
      form.onsubmit = (e) => this.handleFormSubmit(e);
      this.filterByCategory(document.getElementById('category-filter').value);
    };
  },

  // Delete item
  deleteItem(idx) {
    if (confirm('Are you sure you want to delete this knowledge base entry?')) {
      this.kbItems.splice(idx, 1);
      this.filteredItems = this.filteredItems.filter(item => item.id !== this.kbItems[idx]?.id);
      this.saveKnowledgeBase();
      this.renderKBList();
    }
  },

  // Save knowledge base
  async saveKnowledgeBase() {
    try {
      AdminUI.showToast('Saving knowledge base...', 'info');

      const response = await AdminAuth.request('/admin/api/content', {
        method: 'PUT',
        body: JSON.stringify({
          file: 'knowledge-base.md',
          content: this.generateKnowledgeBaseMarkdown()
        })
      });

      if (!response || !response.ok) {
        throw new Error('Save failed');
      }

      AdminUI.showToast('Knowledge base saved successfully!', 'success');
    } catch (error) {
      console.error('Failed to save knowledge base:', error);
      AdminUI.showToast('Failed to save knowledge base', 'error');
    }
  },

  // Generate knowledge base markdown
  generateKnowledgeBaseMarkdown() {
    return this.kbItems.map(item => `
id: ${item.id}
category: ${item.category}
question: ${item.question}
answer: ${item.answer}
tags: ${item.tags ? item.tags.join(', ') : ''}
    `.trim()).join('\n---\n');
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
  document.addEventListener('DOMContentLoaded', () => KnowledgeBaseEditor.init());
} else {
  KnowledgeBaseEditor.init();
}
