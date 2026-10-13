/**
 * Hours & Contact Editor (hours-editor.js)
 * ------------------------------------------------------------
 * Edits the business contact details and weekly opening hours on contact.html.
 * Times are shown as <input type="time"> (24h "HH:MM") in the form and stored
 * on the page as display strings like "9:00am" — see timeToInput()/inputToDisplay().
 *
 * ⚠️ KNOWN LIMITATION: the selectors used here (`[data-phone]`, `[data-day]`,
 * `.open-time` ...) don't exist in the live contact.html yet, and each save
 * generates only a fragment. The Lambda now rejects fragment saves (HTTP 422)
 * instead of wiping the live Contact page. Note the two forms also both write
 * contact.html, so a full fix needs to update the page in place.
 * See README "Known limitations".
 */

const HoursEditor = {
  contactInfo: {},
  businessHours: {},

  async init() {
    await this.loadContactInfo();
    this.setupForms();
  },

  // Load contact information
  async loadContactInfo() {
    try {
      const response = await AdminAuth.request('/admin/api/content?file=contact.html');
      if (!response) return;

      const html = await response.text();
      this.parseContactInfo(html);
      this.renderContactForm();
      this.renderHoursForm();
    } catch (error) {
      console.error('Failed to load contact info:', error);
      AdminUI.showToast('Failed to load contact info', 'error');
    }
  },

  // Parse contact info from HTML
  parseContactInfo(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    this.contactInfo = {
      businessName: doc.querySelector('.business-name')?.textContent || 'Serenity Spa & Wellness',
      phone: doc.querySelector('[data-phone]')?.textContent || '',
      email: doc.querySelector('[data-email]')?.textContent || '',
      address: doc.querySelector('[data-address]')?.textContent || '',
      city: doc.querySelector('[data-city]')?.textContent || '',
      state: doc.querySelector('[data-state]')?.textContent || '',
      zip: doc.querySelector('[data-zip]')?.textContent || ''
    };

    const hoursTable = doc.querySelector('.hours-table tbody');
    if (hoursTable) {
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      days.forEach(day => {
        const row = hoursTable.querySelector(`[data-day="${day}"]`);
        if (row) {
          this.businessHours[day] = {
            open: row.querySelector('.open-time')?.textContent || '9:00am',
            close: row.querySelector('.close-time')?.textContent || '5:00pm'
          };
        }
      });
    }
  },

  // Render contact form
  renderContactForm() {
    const form = document.getElementById('contact-form');
    if (!form) return;

    form['businessName'].value = this.contactInfo.businessName;
    form['phone'].value = this.contactInfo.phone;
    form['email'].value = this.contactInfo.email;
    form['address'].value = this.contactInfo.address;
    form['city'].value = this.contactInfo.city;
    form['state'].value = this.contactInfo.state;
    form['zip'].value = this.contactInfo.zip;
  },

  // Render hours form
  renderHoursForm() {
    const list = document.getElementById('hours-list');
    if (!list) return;

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    list.innerHTML = days.map(day => {
      const hours = this.businessHours[day] || { open: '9:00am', close: '5:00pm' };
      return `
        <div class="form-row">
          <div class="form-group">
            <label>${day}</label>
            <input type="time" name="open_${day.toLowerCase()}" value="${this.timeToInput(hours.open)}">
          </div>
          <div class="form-group">
            <label>&nbsp;</label>
            <input type="time" name="close_${day.toLowerCase()}" value="${this.timeToInput(hours.close)}">
          </div>
        </div>
      `;
    }).join('');
  },

  // Convert display time to input time
  timeToInput(timeStr) {
    const match = timeStr.match(/(\d{1,2}):(\d{2})(am|pm)/i);
    if (!match) return '09:00';

    let hour = parseInt(match[1]);
    const min = match[2];
    const period = match[3].toLowerCase();

    if (period === 'pm' && hour !== 12) hour += 12;
    if (period === 'am' && hour === 12) hour = 0;

    return `${String(hour).padStart(2, '0')}:${min}`;
  },

  // Convert input time to display time
  inputToDisplay(timeStr) {
    const [hour, min] = timeStr.split(':');
    let h = parseInt(hour);
    const period = h >= 12 ? 'pm' : 'am';
    if (h > 12) h -= 12;
    if (h === 0) h = 12;

    return `${h}:${min}${period}`;
  },

  // Setup forms
  setupForms() {
    const contactForm = document.getElementById('contact-form');
    const hoursForm = document.getElementById('hours-form');

    if (contactForm) {
      contactForm.addEventListener('submit', (e) => this.handleContactSubmit(e));
    }

    if (hoursForm) {
      hoursForm.addEventListener('submit', (e) => this.handleHoursSubmit(e));
    }
  },

  // Handle contact form submission
  async handleContactSubmit(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    this.contactInfo = {
      businessName: formData.get('businessName'),
      phone: formData.get('phone'),
      email: formData.get('email'),
      address: formData.get('address'),
      city: formData.get('city'),
      state: formData.get('state'),
      zip: formData.get('zip')
    };

    await this.saveContactInfo();
  },

  // Handle hours form submission
  async handleHoursSubmit(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    days.forEach(day => {
      const open = formData.get(`open_${day.toLowerCase()}`);
      const close = formData.get(`close_${day.toLowerCase()}`);
      this.businessHours[day] = {
        open: this.inputToDisplay(open),
        close: this.inputToDisplay(close)
      };
    });

    await this.saveHours();
  },

  // Save contact info
  saveContactInfo() {
    return AdminUI.saveFile('contact.html', this.generateContactHTML(), 'contact information');
  },

  // Save hours
  saveHours() {
    return AdminUI.saveFile('contact.html', this.generateHoursHTML(), 'business hours');
  },

  // Generate contact HTML
  generateContactHTML() {
    const info = this.contactInfo;
    return `
      <div class="contact-info">
        <h2 class="business-name">${this.escapeHtml(info.businessName)}</h2>
        <p data-phone>${this.escapeHtml(info.phone)}</p>
        <p data-email>${this.escapeHtml(info.email)}</p>
        <p data-address>${this.escapeHtml(info.address)}</p>
        <p data-city>${this.escapeHtml(info.city)}</p>
        <p data-state>${this.escapeHtml(info.state)}</p>
        <p data-zip>${this.escapeHtml(info.zip)}</p>
      </div>
    `;
  },

  // Generate hours HTML
  generateHoursHTML() {
    const hours = this.businessHours;
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    return `
      <table class="hours-table">
        <tbody>
          ${days.map(day => {
            const h = hours[day] || { open: '9:00am', close: '5:00pm' };
            return `
              <tr data-day="${day}">
                <td>${day}</td>
                <td class="open-time">${h.open}</td>
                <td>–</td>
                <td class="close-time">${h.close}</td>
              </tr>
            `;
          }).join('\n')}
        </tbody>
      </table>
    `;
  },

  escapeHtml(text) {
    return AdminUI.escapeHtml(text);
  }
};

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => HoursEditor.init());
} else {
  HoursEditor.init();
}
