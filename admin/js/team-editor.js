// Team Editor
// Handles editing team member profiles

const TeamEditor = {
  teamMembers: [],

  async init() {
    await this.loadTeam();
    this.setupForm();
  },

  // Load team members
  async loadTeam() {
    try {
      const response = await AdminAuth.request('/admin/api/content?file=about.html');
      if (!response) return;

      const html = await response.text();
      this.parseTeam(html);
      this.renderTeamList();
    } catch (error) {
      console.error('Failed to load team:', error);
      AdminUI.showToast('Failed to load team', 'error');
    }
  },

  // Parse team members
  parseTeam(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const members = doc.querySelectorAll('[data-member-id]');

    this.teamMembers = Array.from(members).map(member => ({
      id: member.getAttribute('data-member-id'),
      emoji: member.querySelector('.member-emoji')?.textContent || '🧖',
      name: member.querySelector('.member-name')?.textContent || '',
      role: member.querySelector('.member-role')?.textContent || '',
      bio: member.querySelector('.member-bio')?.textContent || ''
    }));
  },

  // Render team list
  renderTeamList() {
    const list = document.getElementById('team-list');
    if (!list) return;

    if (this.teamMembers.length === 0) {
      list.innerHTML = '<p style="text-align: center; color: #999;">No team members found.</p>';
      return;
    }

    list.innerHTML = this.teamMembers.map((member, idx) => `
      <div class="list-item">
        <div class="list-item-info">
          <h4>${member.emoji} ${this.escapeHtml(member.name)}</h4>
          <p style="font-weight: 500; color: var(--primary); margin: 0.25rem 0;">${this.escapeHtml(member.role)}</p>
          <p>${this.escapeHtml(member.bio.substring(0, 100))}...</p>
        </div>
        <div class="list-item-actions">
          <button class="btn btn-secondary" onclick="TeamEditor.editMember(${idx})">Edit</button>
          <button class="btn btn-danger" onclick="TeamEditor.deleteMember(${idx})">Delete</button>
        </div>
      </div>
    `).join('');
  },

  // Setup form
  setupForm() {
    const form = document.getElementById('team-form');
    if (form) {
      form.addEventListener('submit', (e) => this.handleFormSubmit(e));
    }
  },

  // Handle form submission
  async handleFormSubmit(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const newMember = {
      id: `member-${Date.now()}`,
      name: formData.get('name'),
      role: formData.get('role'),
      bio: formData.get('bio'),
      emoji: formData.get('emoji') || '🧖'
    };

    this.teamMembers.push(newMember);
    await this.saveTeam();
    e.target.reset();
    this.renderTeamList();
  },

  // Edit member
  editMember(idx) {
    const member = this.teamMembers[idx];
    if (!member) return;

    const form = document.getElementById('team-form');
    form.dataset.memberIdx = idx;
    form['name'].value = member.name;
    form['role'].value = member.role;
    form['bio'].value = member.bio;
    form['emoji'].value = member.emoji;

    form.scrollIntoView({ behavior: 'smooth' });
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.textContent = 'Update Member';

    form.onsubmit = async (e) => {
      e.preventDefault();
      member.name = form['name'].value;
      member.role = form['role'].value;
      member.bio = form['bio'].value;
      member.emoji = form['emoji'].value;

      await this.saveTeam();
      form.reset();
      submitBtn.textContent = 'Add Member';
      form.onsubmit = (e) => this.handleFormSubmit(e);
      this.renderTeamList();
    };
  },

  // Delete member
  deleteMember(idx) {
    if (confirm('Are you sure you want to delete this team member?')) {
      this.teamMembers.splice(idx, 1);
      this.saveTeam();
      this.renderTeamList();
    }
  },

  // Save team
  async saveTeam() {
    try {
      AdminUI.showToast('Saving team...', 'info');

      const response = await AdminAuth.request('/admin/api/content', {
        method: 'PUT',
        body: JSON.stringify({
          file: 'about.html',
          content: this.generateTeamHTML()
        })
      });

      if (!response || !response.ok) {
        throw new Error('Save failed');
      }

      AdminUI.showToast('Team saved successfully!', 'success');
    } catch (error) {
      console.error('Failed to save team:', error);
      AdminUI.showToast('Failed to save team', 'error');
    }
  },

  // Generate team HTML
  generateTeamHTML() {
    return this.teamMembers.map(member => `
      <div class="team-member" data-member-id="${member.id}">
        <div class="member-emoji">${member.emoji}</div>
        <h3 class="member-name">${this.escapeHtml(member.name)}</h3>
        <p class="member-role">${this.escapeHtml(member.role)}</p>
        <p class="member-bio">${this.escapeHtml(member.bio)}</p>
      </div>
    `).join('\n');
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
  document.addEventListener('DOMContentLoaded', () => TeamEditor.init());
} else {
  TeamEditor.init();
}
