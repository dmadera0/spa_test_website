/**
 * Team Editor (team-editor.js)
 * ------------------------------------------------------------
 * Lists, adds, edits and deletes staff profiles, then saves about.html.
 *
 * ⚠️ KNOWN LIMITATION: this editor reads `[data-member-id]` / `.member-name`,
 * but the live about.html uses `<article class="team-card">` with
 * `.team-name` / `.team-role` / `.team-bio`, so the list loads empty. It also
 * saves a fragment rather than the full page — the Lambda now rejects that
 * (HTTP 422) instead of wiping the live About page. See README "Known limitations".
 */

const TeamEditor = {
  teamMembers: [],
  editingIdx: null, // index of the member being edited, null when adding

  async init() {
    await this.loadTeam();
    this.setupForm();
  },

  async loadTeam() {
    try {
      const response = await AdminAuth.request('/admin/api/content?file=about.html');
      if (!response) return;
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      this.parseTeam(await response.text());
      this.renderTeamList();
    } catch (error) {
      console.error('Failed to load team:', error);
      AdminUI.showToast('Failed to load team', 'error');
    }
  },

  parseTeam(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const members = doc.querySelectorAll('[data-member-id]');

    this.teamMembers = Array.from(members).map(member => ({
      id: member.getAttribute('data-member-id'),
      emoji: member.querySelector('.member-emoji')?.textContent.trim() || '🧖',
      name: member.querySelector('.member-name')?.textContent.trim() || '',
      role: member.querySelector('.member-role')?.textContent.trim() || '',
      bio: member.querySelector('.member-bio')?.textContent.trim() || ''
    }));
  },

  renderTeamList() {
    const list = document.getElementById('team-list');
    if (!list) return;

    if (this.teamMembers.length === 0) {
      list.innerHTML = '<p style="text-align: center; color: #999;">No team members found.</p>';
      return;
    }

    const esc = AdminUI.escapeHtml;
    list.innerHTML = this.teamMembers.map((m, idx) => `
      <div class="list-item">
        <div class="list-item-info">
          <h4>${esc(m.emoji)} ${esc(m.name)}</h4>
          <p style="font-weight: 500; color: var(--primary); margin: 0.25rem 0;">${esc(m.role)}</p>
          <p>${esc(m.bio.substring(0, 100))}...</p>
        </div>
        <div class="list-item-actions">
          <button class="btn btn-secondary" onclick="TeamEditor.editMember(${idx})">Edit</button>
          <button class="btn btn-danger" onclick="TeamEditor.deleteMember(${idx})">Delete</button>
        </div>
      </div>
    `).join('');
  },

  setupForm() {
    const form = document.getElementById('team-form');
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
      name: formData.get('name'),
      role: formData.get('role'),
      bio: formData.get('bio'),
      emoji: formData.get('emoji') || '🧖'
    };

    if (this.editingIdx !== null) {
      Object.assign(this.teamMembers[this.editingIdx], data);
    } else {
      this.teamMembers.push({ id: `member-${Date.now()}`, ...data });
    }

    if (await this.saveTeam()) form.reset();
    this.renderTeamList();
  },

  editMember(idx) {
    const m = this.teamMembers[idx];
    if (!m) return;

    const form = document.getElementById('team-form');
    // form.elements avoids clashing with built-in <form> properties like form.name.
    const fields = form.elements;
    fields['name'].value = m.name;
    fields['role'].value = m.role;
    fields['bio'].value = m.bio;
    fields['emoji'].value = m.emoji;

    this.editingIdx = idx;
    form.querySelector('button[type="submit"]').textContent = 'Update Member';
    form.scrollIntoView({ behavior: 'smooth' });
  },

  exitEditMode() {
    this.editingIdx = null;
    const btn = document.querySelector('#team-form button[type="submit"]');
    if (btn) btn.textContent = 'Add Member';
  },

  async deleteMember(idx) {
    if (!confirm('Are you sure you want to delete this team member?')) return;
    this.teamMembers.splice(idx, 1);
    this.exitEditMode();
    this.renderTeamList();
    await this.saveTeam();
  },

  saveTeam() {
    return AdminUI.saveFile('about.html', this.generateTeamHTML(), 'team');
  },

  generateTeamHTML() {
    const esc = AdminUI.escapeHtml;
    return this.teamMembers.map(m => `
      <div class="team-member" data-member-id="${esc(m.id)}">
        <div class="member-emoji">${esc(m.emoji)}</div>
        <h3 class="member-name">${esc(m.name)}</h3>
        <p class="member-role">${esc(m.role)}</p>
        <p class="member-bio">${esc(m.bio)}</p>
      </div>
    `).join('\n');
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => TeamEditor.init());
} else {
  TeamEditor.init();
}
