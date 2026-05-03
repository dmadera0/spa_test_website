# Serenity Spa & Wellness Website

A complete, production-ready static website for **Serenity Spa & Wellness** — Portland's premier day spa. Built with pure HTML5, CSS3, and vanilla JavaScript. No frameworks, no dependencies, no build step.

---

## Features

| Feature | Details |
|---------|---------|
| Pages | 6 fully responsive pages |
| Design | Purple-primary spa aesthetic, mobile-first |
| Navigation | Sticky header, hamburger mobile menu |
| Forms | Contact/booking form with JS validation |
| Accordions | FAQ with one-open-at-a-time behavior |
| Filter | Treatment catalog filterable by category |
| Accessibility | WCAG 2.1 AA compliant (ARIA labels, keyboard nav) |
| Hosting | Optimized for AWS S3 + CloudFront static hosting |

---

## File Structure

```
spa_test_website/
├── index.html          ← Landing page
├── treatments.html     ← Treatment catalog + filter
├── services.html       ← Memberships + pricing
├── about.html          ← Story, team, values, stats
├── contact.html        ← Booking form + hours
├── faq.html            ← 25+ FAQ accordions
├── css/
│   └── styles.css      ← Single stylesheet (~1,000 lines)
├── js/
│   └── main.js         ← Single script (~280 lines)
├── knowledge-base.md   ← 50 Q&A for AI/RAG integration
├── aws-deploy.md       ← Step-by-step AWS deployment guide
├── aws-deploy.sh       ← Automated deployment shell script
├── package.json        ← npm scripts for local dev & deploy
├── .gitignore
└── README.md
```

---

## Quick Start — Local Development

### Option 1: Direct browser (simplest)
```bash
open index.html   # macOS
# or double-click index.html in Finder/Explorer
```
> Note: Some browsers block local file links. Use Option 2 for full fidelity.

### Option 2: Local HTTP server (recommended)
```bash
# Using Node.js http-server
npm install
npm start
# Opens http://localhost:8080
```

```bash
# Using Python (no install needed)
python3 -m http.server 8080
# Visit http://localhost:8080
```

```bash
# Using PHP (if available)
php -S localhost:8080
```

---

## Customization Guide

### 1. Change Business Information

Search-and-replace across all HTML files:

| Find | Replace with |
|------|------|
| `Serenity Spa & Wellness` | Your business name |
| `2847 Wellness Drive, Portland, OR 97214` | Your address |
| `(555) 123-4567` | Your phone number |
| `hello@serenity-spa.com` | Your email address |
| `1999` | Your founding year |

### 2. Change Colors

Edit **`css/styles.css`** — find the `:root` block at the top:

```css
:root {
  --clr-primary:       #6b5b95;   /* ← Change this to your brand color */
  --clr-primary-dark:  #4a3f6b;   /* ← Darker variant (buttons hover) */
  --clr-primary-light: #9b8bc4;   /* ← Lighter variant */
  --clr-accent:        #c9b99a;   /* ← Warm accent color */
}
```

Use a tool like [coolors.co](https://coolors.co) to generate matching palettes.

### 3. Update Treatment Prices

In **`treatments.html`**, find each `<article class="treatment-card">` and update the price in:
```html
<span class="treatment-card-price">$85 · $125</span>
```

Also update the price list in **`faq.html`** (under "What are your treatment prices?").

### 4. Update Team Members

In **`about.html`**, find the team section and edit each `<article class="team-card">`:
```html
<div class="team-name">First Last</div>
<div class="team-role">Role / Specialty</div>
<p class="team-bio">Bio text here...</p>
```

Change the emoji in `.team-avatar` to represent gender/appearance as needed.

### 5. Update Business Hours

In **`contact.html`**, find the hours table section. Also update the footer hours in all pages.

### 6. Add Real Images

The site currently uses emoji as visual placeholders. To add real images:

1. Create an `images/` directory
2. Add your image files (`.jpg`, `.webp` recommended)
3. Replace `.visual-block` elements with `<img>` tags:

```html
<!-- Replace this: -->
<div class="visual-block">
  <div class="visual-emoji">🛁</div>
</div>

<!-- With this: -->
<img src="images/treatment-room.webp" 
     alt="Serenity Spa treatment room"
     loading="lazy"
     width="600" height="450" />
```

Use `loading="lazy"` for all images except the hero to optimize load time.

### 7. Add Google Analytics

Add before `</head>` in each HTML file:
```html
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
```

### 8. Connect a Real Form Backend

The contact form currently shows a simulated success message. To send real emails:

**Option A — Formspree (easiest, free tier available)**
```html
<form id="contact-form" action="https://formspree.io/f/YOUR_FORM_ID" method="POST">
```

**Option B — AWS SES + Lambda**
Point the JS fetch call in `main.js` to your Lambda function URL.

**Option C — Netlify Forms**
Add `netlify` attribute to the form if deploying on Netlify.

---

## Deployment

See [aws-deploy.md](aws-deploy.md) for the complete AWS S3 + CloudFront deployment guide.

For a quick deploy to AWS:
```bash
# Make the script executable and run it
chmod +x aws-deploy.sh
./aws-deploy.sh
```

---

## Performance Notes

- All CSS is in a single file (no render-blocking external sheets)
- All JavaScript is deferred to end of `<body>`
- No external fonts loaded (uses system font stack)
- No external CDN dependencies whatsoever
- Emoji used instead of image files = zero image HTTP requests on first load
- Total page weight (HTML + CSS + JS): ~80–120 KB uncompressed; ~25–35 KB gzipped

---

## Browser Support

| Browser | Support |
|---------|---------|
| Chrome 90+ | ✅ Full |
| Firefox 88+ | ✅ Full |
| Safari 14+ | ✅ Full |
| Edge 90+ | ✅ Full |
| iOS Safari 14+ | ✅ Full |
| Android Chrome | ✅ Full |
| IE 11 | ❌ Not supported |

---

## Accessibility

- All interactive elements keyboard-accessible
- ARIA labels on navigation, forms, accordions, filter buttons
- Screen reader live regions for dynamic content (filter results)
- Sufficient color contrast (WCAG AA)
- Focus styles preserved
- Semantic HTML5 landmarks (`<header>`, `<nav>`, `<main>`, `<footer>`)
- `alt` text and `aria-hidden` used appropriately
- `aria-expanded` on accordion triggers
- `aria-current="page"` on active nav links

---

## License

This project is proprietary to Serenity Spa & Wellness. Not for redistribution.
