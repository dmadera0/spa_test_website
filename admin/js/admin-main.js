// Admin Main Module
// Handles admin page interactions, navigation, and toast notifications

const AdminUI = {
  // Show toast notification
  showToast(message, type = 'info', duration = 3000) {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.textContent = message;
    toast.className = `toast show ${type}`;

    setTimeout(() => {
      toast.classList.remove('show');
    }, duration);
  },

  // Set active navigation link
  setActiveNav(href) {
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('href') === href) {
        link.classList.add('active');
      }
    });
  },

  // Initialize on page load
  init() {
    this.updateActiveNav();
  },

  // Update active nav based on current page
  updateActiveNav() {
    const filename = window.location.pathname.split('/').pop() || 'dashboard.html';
    const navLinks = document.querySelectorAll('.nav-link');

    navLinks.forEach(link => {
      const href = link.getAttribute('href');
      if (href === filename || (filename === '' && href === 'dashboard.html')) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => AdminUI.init());
} else {
  AdminUI.init();
}
