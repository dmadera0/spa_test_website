# 🌿 Serenity Spa & Wellness Website

![Status](https://img.shields.io/badge/status-production%20ready-brightgreen)
![License](https://img.shields.io/badge/license-proprietary-blue)
![Pages](https://img.shields.io/badge/pages-6-informational)
![Size](https://img.shields.io/badge/gzip-25--35%20KB-success)
![Accessibility](https://img.shields.io/badge/WCAG-2.1%20AA-brightgreen)
![Admin](https://img.shields.io/badge/admin-OAuth%202.0-purple)

A **production-ready, zero-dependency static website** for a fictional Portland spa — with a **fully integrated OAuth-protected admin panel** for live content management. Built with pure HTML5, CSS3, and vanilla JavaScript on the frontend; AWS Cognito, Lambda, and API Gateway on the backend.

**[🚀 Live Demo](https://d3otg5fszt3roj.cloudfront.net/)** • **[🔐 Admin Panel](https://d3otg5fszt3roj.cloudfront.net/admin/)** • **[📖 Admin Setup Guide](README-admin.md)** • **[💬 Knowledge Base](knowledge-base.md)**

---

## 📋 Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Admin Panel](#admin-panel)
- [Local Setup](#local-setup)
- [Customization](#customization)
- [Deployment](#deployment)
- [Performance](#performance)
- [What I Built](#what-i-built)
- [Portfolio Highlights](#portfolio-highlights)

---

## Overview

This project demonstrates a **complete, professional spa website** ready for AWS S3 + CloudFront hosting — plus a **password-protected admin panel** that lets non-technical staff edit live content without touching code.

It's also designed as a **test bed for AI/RAG customer service agents** with a structured 50-question knowledge base in `knowledge-base.md`.

**Project Goals:**
✅ Zero external dependencies on the frontend  
✅ Mobile-first responsive design  
✅ WCAG 2.1 AA accessibility compliance  
✅ AWS S3 + CloudFront optimized  
✅ Google OAuth staff authentication (Cognito)  
✅ Live content editing via Lambda API  
✅ Automated CloudFront invalidation on save  

---

## Key Features

| Feature | Details |
|---------|---------|
| **Pages** | 6 fully responsive pages (index, treatments, services, about, contact, faq) |
| **Design** | Purple-primary spa aesthetic, mobile-first, smooth animations |
| **Navigation** | Sticky header with hamburger mobile menu, keyboard accessible |
| **Forms** | Booking form with real-time validation, no backend required |
| **Interactivity** | FAQ accordions (one-open), treatment filter, smooth scrolling |
| **Accessibility** | WCAG 2.1 AA: ARIA labels, keyboard nav, focus styles, semantic HTML |
| **Performance** | ~35 KB gzipped, no external assets |
| **Admin Panel** | Google OAuth login, 8 editor pages, live S3 + CloudFront updates |
| **Hosting** | AWS S3 + CloudFront (cache headers, automated invalidation) |

---

## Tech Stack

```
Frontend (Main Website):
├── HTML5 (semantic structure, accessibility)
├── CSS3 (Grid, Flexbox, custom properties, mobile-first)
└── Vanilla JavaScript (~400 lines, no frameworks)

Frontend (Admin Panel):
├── HTML5 + CSS3 + Vanilla JS (matching no-framework approach)
├── Google OAuth 2.0 via Cognito Hosted UI
└── JWT token auth with protected routes

Backend (Admin API):
├── AWS Lambda (Node.js 20) — content CRUD handler
├── AWS API Gateway (HTTP API) — JWT-authorized routes
├── AWS Cognito — User Pool + Google identity provider
└── IAM Role — scoped S3 + CloudFront permissions

Infrastructure:
├── AWS S3 (static file hosting)
├── CloudFront (CDN, HTTPS, global distribution, auto-invalidation)
└── Route 53 (optional DNS management)
```

---

## Admin Panel

The admin panel at `/admin/` allows Serenity Spa staff to edit live website content without code. All changes write directly to S3 and automatically clear the CloudFront cache.

### Authentication

Sign-in is handled by **Google OAuth 2.0** via AWS Cognito:

```
Staff clicks "Sign in with Google"
    → Redirects to Cognito Hosted UI
    → Cognito authenticates via Google
    → Returns authorization code
    → Exchanges code for JWT (id_token)
    → JWT stored in localStorage
    → All API calls include Bearer token
    → API Gateway validates JWT against Cognito
    → Lambda executes if token is valid
```

Only email addresses added to the Cognito User Pool can access the admin panel. Unauthorized Google accounts are rejected at the Cognito level.

### Editor Pages

| Page | What You Can Edit |
|------|------------------|
| Dashboard | Overview and navigation hub |
| Treatments | Names, descriptions, categories, duration, prices |
| Pricing | Membership tiers, monthly prices, benefit lists |
| Hours & Contact | Business hours, phone, email, address |
| Team | Staff profiles, roles, bios |
| FAQ | Questions and answers by category |
| Knowledge Base | RAG Q&A pairs with tags and metadata |

### API Endpoints

All endpoints require `Authorization: Bearer <id_token>`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/admin/api/content?file={name}` | Read file from S3 |
| `PUT` | `/admin/api/content` | Write file + invalidate CloudFront |
| `GET` | `/admin/api/me` | Return authenticated user info |

### Setup

See **[README-admin.md](README-admin.md)** for the complete setup guide, including Google Cloud Console OAuth credential instructions and `setup.sh` deployment automation.

---

## Local Setup

### ⚡ Quickest: Direct in Browser
```bash
open index.html
```

### ✨ Recommended: Local HTTP Server

```bash
# Node.js
npm install && npm start
# → http://localhost:8080

# Python
python3 -m http.server 8080

# PHP
php -S localhost:8080
```

---

## Customization

### 1️⃣ Update Business Info

Search-and-replace across all HTML files:

| Find | Replace with |
|------|------|
| `Serenity Spa & Wellness` | Your business name |
| `2847 Wellness Drive, Portland, OR 97214` | Your address |
| `(555) 123-4567` | Your phone |
| `hello@serenity-spa.com` | Your email |
| `1999` | Your founding year |

### 2️⃣ Change Brand Colors

Edit `css/styles.css` — find the `:root` block:

```css
:root {
  --clr-primary:       #6b5b95;   /* Main brand color */
  --clr-primary-dark:  #4a3f6b;   /* Hover states */
  --clr-primary-light: #9b8bc4;   /* Accents */
  --clr-accent:        #c9b99a;   /* Warm complement */
}
```

### 3️⃣ Update Prices

**`treatments.html`** — each treatment card:
```html
<span class="treatment-card-price">$85 · $125</span>
```

### 4️⃣ Update Team Members

**`about.html`** — team section:
```html
<div class="team-name">Your Name</div>
<div class="team-role">Your Role</div>
<p class="team-bio">Your bio text...</p>
```

### 5️⃣ Update Hours

**`contact.html`** — hours table section. Also update footer hours in all 6 pages.

### 6️⃣ Add Real Images

```bash
mkdir images/
# Add .jpg or .webp files, then replace .visual-block divs:
```
```html
<img src="images/treatment-room.webp"
     alt="Treatment room"
     loading="lazy"
     width="600" height="450" />
```

### 7️⃣ Add Analytics

Add before `</head>` in each HTML file:
```html
<script async src="https://www.googletagmanager.com/gtag/js?id=G-YOUR_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-YOUR_ID');
</script>
```

### 8️⃣ Connect Real Form Backend

```html
<!-- Formspree (easiest) -->
<form id="contact-form" action="https://formspree.io/f/YOUR_ID" method="POST">
```

---

## Deployment

### 🚀 Quick Deploy (Single File)

```bash
aws s3 cp index.html s3://serenity-spa-wellness-site/index.html \
  --content-type "text/html; charset=utf-8" \
  --cache-control "public, max-age=3600"

aws cloudfront create-invalidation \
  --distribution-id E394G7D2J8ETX3 \
  --paths "/index.html"
```

### 🔄 Full Site Sync

```bash
aws s3 sync . s3://serenity-spa-wellness-site/ \
  --delete \
  --exclude ".git/*" \
  --exclude "*.sh" \
  --exclude "*.md" \
  --exclude "node_modules/*"

aws cloudfront create-invalidation \
  --distribution-id E394G7D2J8ETX3 \
  --paths "/*"
```

### 🔐 Deploy Admin Panel

```bash
# First-time setup (Cognito + Lambda + API Gateway):
chmod +x setup.sh && ./setup.sh

# Update admin frontend only:
aws s3 sync admin/ s3://serenity-spa-wellness-site/admin/ --delete
aws cloudfront create-invalidation \
  --distribution-id E394G7D2J8ETX3 \
  --paths "/admin/*"
```

---

## Performance

| Metric | Value |
|--------|-------|
| **Page Size (gzipped)** | 25–35 KB |
| **Requests (initial load)** | 3–5 (HTML, CSS, JS only) |
| **Time to Interactive** | ~1.2s on 3G |
| **Lighthouse Score** | 95–100 across all metrics |
| **Admin API latency** | ~200ms (Lambda cold start ~800ms) |

---

## Browser Support

| Browser | Support |
|---------|---------|
| Chrome 90+ | ✅ Full |
| Firefox 88+ | ✅ Full |
| Safari 14+ | ✅ Full |
| Edge 90+ | ✅ Full |
| iOS Safari 14+ | ✅ Full |
| IE 11 | ❌ Not supported |

---

## Accessibility (WCAG 2.1 AA)

- ✅ All interactive elements keyboard accessible
- ✅ FAQ accordions: Arrow keys, Home, End
- ✅ ARIA labels on nav, forms, accordions, filters
- ✅ Live regions for dynamic content
- ✅ `aria-expanded` on accordion triggers
- ✅ Form errors linked via `aria-describedby`
- ✅ Sufficient color contrast (≥ 4.5:1)
- ✅ Semantic HTML5 landmarks throughout

---

## What I Built

### Code Stats

| Layer | Lines |
|-------|-------|
| HTML (6 pages) | ~5,573 |
| CSS | 2,053 |
| JavaScript (main site) | 410 |
| JavaScript (admin panel) | ~1,200 |
| Lambda (Node.js) | ~150 |
| Shell scripts | ~280 |
| **Total** | **~9,700** |

Zero npm dependencies on the frontend. Zero frameworks.

### Main Website Components

1. **Sticky Navigation** — Scroll shadow, active page detection, hamburger with Escape/click-outside
2. **FAQ Accordions** — One-open, keyboard nav (arrows, Home, End), ARIA states
3. **Treatment Filter** — Real-time category filtering, aria-pressed, screen reader announcements
4. **Contact Form** — Real-time validation (required, email, phone, min-length), no backend
5. **Responsive Grid** — CSS Grid & Flexbox, breakpoints at 480px, 768px, 1024px+
6. **Knowledge Base** — 50 structured Q&A pairs ready for RAG/vector DB

### Admin Panel Components

1. **Google OAuth Flow** — Cognito Hosted UI → authorization code → JWT exchange → localStorage
2. **Protected Routes** — JWT validation on every page load, redirect to login on expiry
3. **Lambda Content API** — File whitelist, S3 read/write, CloudFront invalidation on every save
4. **8 Editor Pages** — Treatments, pricing, hours, team, FAQ, knowledge base
5. **Live Saves** — Every change writes to S3 and invalidates the CloudFront edge cache instantly
6. **Toast Notifications** — Save success/error feedback throughout

### Pages

| Page | Purpose | Key Features |
|------|---------|--------------|
| `index.html` | Landing | Hero, treatments preview, testimonials, CTA |
| `treatments.html` | Catalog | 12 treatments, category filter |
| `services.html` | Memberships | 4 pricing tiers, comparison table |
| `about.html` | Company | History, 8-person team, values |
| `contact.html` | Booking | Validated form, hours, map placeholder |
| `faq.html` | Q&A | 25 collapsible questions, 5 categories |

---

## Portfolio Highlights

✨ **Zero Frontend Dependencies**  
No npm packages, no frameworks, no build step. Pure web fundamentals throughout.

🔐 **Full OAuth 2.0 Implementation**  
Google sign-in via AWS Cognito — authorization code flow, JWT validation, protected routes, token expiry handling. Real-world authentication pattern.

🛠️ **End-to-End Content Management**  
Admin writes directly to S3 via a JWT-protected Lambda API. CloudFront cache is programmatically invalidated on every save. Staff edits are live in seconds.

♿ **Accessibility First**  
WCAG 2.1 AA compliant — keyboard navigation, ARIA labels, semantic HTML, screen reader support.

📱 **Mobile-First Responsive**  
Hamburger menu, touch-friendly UI, tested across screen sizes.

☁️ **Production AWS Infrastructure**  
S3 + CloudFront + API Gateway + Lambda + Cognito + IAM — complete IaC via `setup.sh`.

📚 **AI-Ready Knowledge Base**  
50 structured Q&A pairs with metadata (id, category, tags) ready for RAG/vector DB integration.

---

## File Structure

```
spa_test_website/
├── index.html               ← Landing page
├── treatments.html          ← Treatment catalog + filter
├── services.html            ← Memberships + pricing
├── about.html               ← Story, team, values
├── contact.html             ← Booking form + hours
├── faq.html                 ← 25+ FAQ accordions
├── css/
│   └── styles.css           ← Main stylesheet
├── js/
│   └── main.js              ← Main site JavaScript
├── admin/                   ← Admin panel (OAuth protected)
│   ├── index.html           ← Login page (Google OAuth)
│   ├── dashboard.html       ← Editor hub
│   ├── treatments-editor.html
│   ├── pricing-editor.html
│   ├── hours-editor.html
│   ├── team-editor.html
│   ├── faq-editor.html
│   ├── knowledge-base-editor.html
│   ├── css/
│   │   └── admin-styles.css
│   └── js/
│       ├── admin-config.js  ← Auto-generated by setup.sh
│       ├── admin-auth.js    ← Cognito JWT auth
│       ├── admin-main.js    ← Shared UI utilities
│       └── *-editor.js      ← Per-page editor logic
├── lambda/
│   ├── index.js             ← Lambda handler (S3 + CF)
│   └── package.json
├── knowledge-base.md        ← 50 Q&As for RAG systems
├── aws-deploy.md            ← Main site AWS setup guide
├── README-admin.md          ← Admin panel setup guide
├── package.json
└── .gitignore
```

> `setup.sh` and `aws-deploy.sh` are excluded from git (contain credentials).

---

## License & Attribution

**Serenity Spa & Wellness** is a fictional business created for portfolio demonstration.

This code is open for reference and learning. Credit appreciated but not required.

```
Built with: HTML5, CSS3, Vanilla JavaScript, Node.js
Auth:       AWS Cognito + Google OAuth 2.0
Deployed:   AWS S3 + CloudFront + Lambda + API Gateway
```

---

## Questions?

📧 Contact: [Your Portfolio Email]  
🔗 Portfolio: [Your Portfolio URL]  
💼 LinkedIn: [Your LinkedIn]
