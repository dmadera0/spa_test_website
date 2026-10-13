/**
 * Knowledge Base Editor (knowledge-base-editor.js)
 * ------------------------------------------------------------
 * Edits knowledge-base.md — the Q&A file that feeds the AI chat assistant.
 *
 * File format (one entry per block, blocks separated by a line of "---"):
 *
 *   id: KB001
 *   category: booking
 *   question: How do I book an appointment?
 *   answer: You can book online, by phone, or in person...
 *   tags: [booking, appointment, contact]
 *
 * The file also starts with a "#" comment header and contains "## CATEGORY ..."
 * section headings. On load we keep the header and pick out only the Q&A blocks;
 * on save we write the header back, then regenerate the category headings and
 * entries so the file stays in the same shape the RAG pipeline expects.
 */

const KB_FILE = 'knowledge-base.md';

// Order + display names for categories (must match the <select> options in the HTML).
const KB_CATEGORIES = {
  booking: 'Booking & Appointments',
  treatments: 'Treatments & Services',
  pricing: 'Pricing & Membership',
  health: 'Health & Wellness',
  policies: 'Business Policies'
};

const KnowledgeBaseEditor = {
  kbItems: [],       // every entry in the file
  filteredItems: [], // what's shown after the category filter
  header: '',        // the "#" comment block at the top of the file
  editingIdx: null,  // index into kbItems while editing, null when adding

  async init() {
    await this.loadKnowledgeBase();
    this.setupForm();
  },

  async loadKnowledgeBase() {
    try {
      const response = await AdminAuth.request(`/admin/api/content?file=${KB_FILE}`);
      if (!response) return;
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      this.parseKnowledgeBase(await response.text());
      this.renderKBList();
    } catch (error) {
      console.error('Failed to load knowledge base:', error);
      AdminUI.showToast('Failed to load knowledge base', 'error');
    }
  },

  // Turn the markdown file into an array of { id, category, question, answer, tags }.
  parseKnowledgeBase(text) {
    const blocks = text.replace(/\r\n/g, '\n').split(/\n---\n/);

    // Everything before the first separator is the file's comment header.
    this.header = blocks[0].trim().startsWith('#') ? blocks[0].trim() : '';

    this.kbItems = blocks
      .filter(block => /^id:/m.test(block)) // skip the header and "## CATEGORY" blocks
      .map(block => {
        const item = { id: '', category: '', question: '', answer: '', tags: [] };
        block.trim().split('\n').forEach(line => {
          const match = line.match(/^(id|category|question|answer|tags):\s*(.*)$/);
          if (!match) return;
          const [, key, value] = match;
          item[key] = key === 'tags' ? this.parseTags(value) : value.trim();
        });
        return item;
      });

    this.filteredItems = [...this.kbItems];
  },

  // "[a, b, c]" or "a, b, c" → ['a', 'b', 'c']
  parseTags(value) {
    return value.replace(/^\[|\]$/g, '')
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);
  },

  renderKBList() {
    const list = document.getElementById('kb-list');
    if (!list) return;

    if (this.filteredItems.length === 0) {
      list.innerHTML = '<p style="text-align: center; color: #999;">No knowledge base entries found.</p>';
      return;
    }

    const esc = AdminUI.escapeHtml;
    list.innerHTML = this.filteredItems.map(item => {
      // Buttons use the index in the full list, not the filtered list.
      const idx = this.kbItems.indexOf(item);
      return `
        <div class="list-item">
          <div class="list-item-info">
            <h4>${esc(item.id)} — ${esc(item.question)}</h4>
            <p>${esc((item.answer || 'No answer').substring(0, 100))}...</p>
            <p style="margin-top: 0.5rem; font-size: 0.85rem; color: #999;">
              Category: ${esc(KB_CATEGORIES[item.category] || item.category || 'uncategorized')}
              ${item.tags.length ? `• Tags: ${esc(item.tags.join(', '))}` : ''}
            </p>
          </div>
          <div class="list-item-actions">
            <button class="btn btn-secondary" onclick="KnowledgeBaseEditor.editItem(${idx})">Edit</button>
            <button class="btn btn-danger" onclick="KnowledgeBaseEditor.deleteItem(${idx})">Delete</button>
          </div>
        </div>
      `;
    }).join('');
  },

  filterByCategory(category) {
    this.filteredItems = category
      ? this.kbItems.filter(item => item.category === category)
      : [...this.kbItems];
    this.renderKBList();
  },

  refreshList() {
    const filter = document.getElementById('category-filter');
    this.filterByCategory(filter ? filter.value : '');
  },

  setupForm() {
    const form = document.getElementById('kb-form');
    if (!form) return;
    // One submit handler handles both "add" and "update" (see editingIdx).
    form.addEventListener('submit', (e) => this.handleFormSubmit(e));
    // The "Clear" button resets the form — also leave edit mode.
    form.addEventListener('reset', () => this.exitEditMode());
  },

  async handleFormSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);

    const data = {
      category: formData.get('category'),
      question: formData.get('question').trim(),
      answer: formData.get('answer').replace(/\s*\n\s*/g, ' ').trim(), // one line per field in the file
      tags: this.parseTags(formData.get('tags') || '')
    };

    if (this.editingIdx !== null) {
      Object.assign(this.kbItems[this.editingIdx], data);
    } else {
      this.kbItems.push({ id: this.nextId(), ...data });
    }

    if (await this.saveKnowledgeBase()) {
      form.reset(); // also triggers exitEditMode()
    }
    this.refreshList();
  },

  // Next sequential id in the existing "KB050" style.
  nextId() {
    const max = this.kbItems.reduce((n, item) => {
      const num = parseInt((item.id.match(/\d+/) || ['0'])[0], 10);
      return Math.max(n, num);
    }, 0);
    return `KB${String(max + 1).padStart(3, '0')}`;
  },

  editItem(idx) {
    const item = this.kbItems[idx];
    if (!item) return;

    const form = document.getElementById('kb-form');
    form['category'].value = item.category;
    form['question'].value = item.question;
    form['answer'].value = item.answer;
    form['tags'].value = item.tags.join(', ');

    this.editingIdx = idx;
    form.querySelector('button[type="submit"]').textContent = 'Update Entry';
    form.scrollIntoView({ behavior: 'smooth' });
  },

  exitEditMode() {
    this.editingIdx = null;
    const btn = document.querySelector('#kb-form button[type="submit"]');
    if (btn) btn.textContent = 'Add Entry';
  },

  async deleteItem(idx) {
    if (!confirm('Are you sure you want to delete this knowledge base entry?')) return;
    this.kbItems.splice(idx, 1);
    this.exitEditMode(); // indexes shifted, so any in-progress edit is no longer valid
    this.refreshList();
    await this.saveKnowledgeBase();
  },

  saveKnowledgeBase() {
    return AdminUI.saveFile(KB_FILE, this.generateKnowledgeBaseMarkdown(), 'knowledge base');
  },

  // Rebuild the full markdown file: header, then entries grouped by category.
  generateKnowledgeBaseMarkdown() {
    const parts = [];
    if (this.header) parts.push(this.header);

    // Known categories first (in a fixed order), then any unexpected ones.
    const categories = [
      ...Object.keys(KB_CATEGORIES),
      ...new Set(this.kbItems.map(i => i.category).filter(c => !(c in KB_CATEGORIES)))
    ];

    categories.forEach((cat, n) => {
      const items = this.kbItems.filter(item => item.category === cat);
      if (!items.length) return;

      const label = (KB_CATEGORIES[cat] || cat).toUpperCase();
      parts.push(`\n## CATEGORY ${n + 1}: ${label} (${items.length} Q&As)`);

      items.forEach(item => {
        parts.push([
          `id: ${item.id}`,
          `category: ${item.category}`,
          `question: ${item.question}`,
          `answer: ${item.answer}`,
          `tags: [${item.tags.join(', ')}]`
        ].join('\n'));
      });
    });

    return parts.join('\n\n---\n') + '\n';
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => KnowledgeBaseEditor.init());
} else {
  KnowledgeBaseEditor.init();
}
