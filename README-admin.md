# Serenity Spa — Admin Panel

Password-protected content management system for Serenity Spa & Wellness staff. Authenticated via **Google OAuth + AWS Cognito**. All edits write directly to S3 and auto-clear the CloudFront cache.

---

## Architecture

```
Browser (Admin Staff)
    │
    ▼
CloudFront (/admin/*)
    │
    ├── S3 (admin HTML/CSS/JS — static pages)
    │
    └── API Gateway (HTTPS)
            │ JWT Authorization (Cognito)
            ▼
        Lambda (serenity-spa-admin-api)
            │
            ├── S3 GetObject / PutObject (website files)
            └── CloudFront CreateInvalidation
```

**Stack:**
- Frontend: Pure HTML/CSS/JS (no framework)
- Auth: AWS Cognito User Pool + Google OAuth 2.0
- API: AWS API Gateway (HTTP API) + JWT Authorizer
- Backend: AWS Lambda (Node.js 20)
- Storage: S3 (same bucket as main website)
- CDN: CloudFront (auto-invalidated on save)

---

## Prerequisites

Before running `setup.sh`:

1. **Main website deployed** — run `aws-deploy.sh` first
2. **AWS CLI v2** configured (`aws configure`)
3. **Node.js 20+** installed
4. **jq** installed (`brew install jq`)
5. **Google OAuth credentials** — see steps below

---

## Step 1 — Get Google OAuth Credentials

You need a Google Cloud OAuth 2.0 client to allow staff to sign in with Google.

### 1.1 Create a Google Cloud Project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Click **Select a project** → **New Project**
3. Name it `serenity-spa-admin` → click **Create**

### 1.2 Enable the Google Identity API

1. In the left sidebar, go to **APIs & Services** → **Library**
2. Search for **"Google Identity"** or **"People API"**
3. Click **Enable**

### 1.3 Configure the OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Choose **External** → click **Create**
3. Fill in:
   - **App name:** `Serenity Spa Admin`
   - **User support email:** your email
   - **Developer contact email:** your email
4. Click **Save and Continue** through all steps
5. Under **Test users**, add any email addresses that need admin access during testing

### 1.4 Create OAuth 2.0 Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **+ Create Credentials** → **OAuth client ID**
3. Choose **Web application**
4. Name it `Serenity Spa Admin Panel`
5. Under **Authorized redirect URIs**, add (**after setup.sh runs**, you'll know the Cognito domain):
   ```
   https://<cognito-domain>.auth.us-west-2.amazoncognito.com/oauth2/idpresponse
   ```
   > The exact URI is printed at the end of setup.sh output.
6. Click **Create**
7. Copy the **Client ID** and **Client Secret**

---

## Step 2 — Configure and Run setup.sh

Open `setup.sh` and fill in the required values at the top:

```bash
BUCKET_NAME="serenity-spa-wellness-site"   # Your S3 bucket (already set)
CF_DISTRIBUTION_ID="E394G7D2J8ETX3"        # Your CloudFront ID (already set)
ADMIN_EMAIL="your-email@example.com"        # Primary admin Google email
GOOGLE_CLIENT_ID="YOUR_CLIENT_ID"          # From Step 1.4
GOOGLE_CLIENT_SECRET="YOUR_CLIENT_SECRET"  # From Step 1.4
```

Then run:

```bash
chmod +x setup.sh
./setup.sh
```

The script will:
1. Create Cognito User Pool with Google OAuth
2. Create app client with callback URLs
3. Invite your admin email
4. Create IAM role (S3 + CloudFront permissions)
5. Package and deploy Lambda function
6. Create API Gateway with JWT authorizer
7. Inject Cognito config into frontend files
8. Deploy admin pages to S3
9. Invalidate CloudFront cache

**Runtime:** ~3–5 minutes.

---

## Step 3 — Add Redirect URI to Google Cloud

After setup.sh completes, it prints a line like:

```
Next: In Google Cloud Console, add this Authorized Redirect URI:
      https://serenity-spa-XXXX.auth.us-west-2.amazoncognito.com/oauth2/idpresponse
```

1. Go back to **Google Cloud Console** → **Credentials** → your OAuth client
2. Under **Authorized redirect URIs**, add the URI printed by setup.sh
3. Click **Save**

---

## Step 4 — Test Sign In

Visit your admin panel:

```
https://<cloudfront-domain>/admin/
```

Click **Sign in with Google** and authenticate with the admin email address.

---

## Admin Pages

| Page | URL | Purpose |
|------|-----|---------|
| Login | `/admin/` | Google OAuth sign-in |
| Dashboard | `/admin/dashboard.html` | Overview and navigation |
| Treatments | `/admin/treatments-editor.html` | Edit treatment cards |
| Pricing | `/admin/pricing-editor.html` | Edit membership tiers |
| Hours & Contact | `/admin/hours-editor.html` | Edit hours and contact info |
| Team | `/admin/team-editor.html` | Edit staff profiles |
| FAQ | `/admin/faq-editor.html` | Edit Q&A by category |
| Knowledge Base | `/admin/knowledge-base-editor.html` | Edit RAG Q&A entries |

---

## API Endpoints

All endpoints require `Authorization: Bearer <id_token>` header.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/admin/api/content?file={name}` | Read file from S3 |
| `PUT` | `/admin/api/content` | Write file to S3 + invalidate CF |
| `GET` | `/admin/api/me` | Return authenticated user info |

**Allowed files:** `index.html`, `treatments.html`, `services.html`, `about.html`, `contact.html`, `faq.html`, `knowledge-base.md`

**PUT body:**
```json
{
  "file": "treatments.html",
  "content": "<updated HTML content here>"
}
```

---

## Adding or Removing Admin Users

### Add a user

```bash
aws cognito-idp admin-create-user \
  --user-pool-id <POOL_ID> \
  --username new-staff@serenityspa.com \
  --user-attributes "Name=email,Value=new-staff@serenityspa.com" "Name=email_verified,Value=true" \
  --message-action SUPPRESS \
  --region us-west-2
```

### Remove a user

```bash
aws cognito-idp admin-delete-user \
  --user-pool-id <POOL_ID> \
  --username staff@serenityspa.com \
  --region us-west-2
```

---

## Updating Lambda Code

After changing `lambda/index.js`:

```bash
cd lambda
npm install --production
zip -rq ../lambda-update.zip .
cd ..

aws lambda update-function-code \
  --function-name serenity-spa-admin-api \
  --zip-file fileb://lambda-update.zip \
  --region us-west-2

rm lambda-update.zip
```

---

## Updating Admin Frontend

After changing admin HTML/CSS/JS:

```bash
aws s3 sync admin/ s3://serenity-spa-wellness-site/admin/ \
  --delete \
  --region us-west-2

aws cloudfront create-invalidation \
  --distribution-id E394G7D2J8ETX3 \
  --paths "/admin/*"
```

---

## File Structure

```
admin/
├── index.html                     # Login page
├── dashboard.html                 # Admin dashboard
├── treatments-editor.html         # Treatments editor
├── pricing-editor.html            # Pricing editor
├── hours-editor.html              # Hours & contact editor
├── team-editor.html               # Team members editor
├── faq-editor.html                # FAQ editor
├── knowledge-base-editor.html     # Knowledge base editor
├── css/
│   └── admin-styles.css           # Admin panel styles
└── js/
    ├── admin-config.js            # Auto-generated by setup.sh
    ├── admin-auth.js              # Cognito auth & API requests
    ├── admin-main.js              # Shared UI utilities
    ├── treatments-editor.js
    ├── pricing-editor.js
    ├── hours-editor.js
    ├── team-editor.js
    ├── faq-editor.js
    └── knowledge-base-editor.js

lambda/
├── index.js                       # Lambda handler
└── package.json

setup.sh                           # Full deployment automation
README-admin.md                    # This file
```

---

## Security Notes

- Admin HTML files are served with `Cache-Control: no-store` — never cached in browsers
- JWT tokens expire after 1 hour (Cognito default); users are redirected to login
- The Lambda file whitelist prevents access to any file outside the allowed list
- IAM role has minimum permissions: S3 read/write on the bucket, CloudFront invalidation on the one distribution
- All API calls require a valid Cognito JWT — API Gateway rejects unauthenticated requests before Lambda is invoked

---

## Cost Estimate

| Service | Usage | Est. Monthly Cost |
|---------|-------|-------------------|
| Lambda | ~100 invocations/mo | < $0.01 |
| API Gateway | ~100 requests/mo | < $0.01 |
| Cognito | Up to 50,000 MAU free | $0.00 |
| CloudFront invalidations | ~50/mo (first 1,000 free) | $0.00 |
| **Total** | | **< $0.05/month** |
