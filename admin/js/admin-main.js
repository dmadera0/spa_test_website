/**
 * Admin UI helpers (admin-main.js)
 * ------------------------------------------------------------
 * Small utilities shared by every admin page:
 *   - toast notifications
 *   - highlighting the current page in the sidebar nav
 *   - escapeHtml() for safely rendering user-entered text
 *   - saveFile() — the one place that PUTs content to the Lambda API
 *
 * Load order on each page: admin-config.js → admin-auth.js → admin-main.js → <page>-editor.js
 */

const AdminUI = {
  // Brief message in the corner. type: 'info' | 'success' | 'error'
  showToast(message, type = 'info', duration = 3000) {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.textContent = message;
    toast.className = `toast show ${type}`;

    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => toast.classList.remove('show'), duration);
  },

  init() {
    this.updateActiveNav();
  },

  // Mark the sidebar link for the current page as active.
  updateActiveNav() {
    const filename = window.location.pathname.split('/').pop() || 'dashboard.html';
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.toggle('active', link.getAttribute('href') === filename);
    });
  },

  // Escape text before inserting it with innerHTML (prevents broken markup / XSS).
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
  },

  /**
   * Save a whole file through the admin API (PUT /admin/api/content).
   * Shows progress/success/error toasts and surfaces the server's error
   * message when there is one. Returns true on success.
   */
  async saveFile(file, content, label) {
    this.showToast(`Saving ${label}...`, 'info');
    try {
      const response = await AdminAuth.request('/admin/api/content', {
        method: 'PUT',
        body: JSON.stringify({ file, content })
      });
      if (!response) return false; // redirected to login

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      this.showToast(`${label[0].toUpperCase()}${label.slice(1)} saved!`, 'success');
      return true;
    } catch (error) {
      console.error(`Failed to save ${label}:`, error);
      this.showToast(`Failed to save ${label}: ${error.message}`, 'error', 6000);
      return false;
    }
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => AdminUI.init());
} else {
  AdminUI.init();
}
