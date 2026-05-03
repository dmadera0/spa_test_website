# AWS S3 + CloudFront Deployment Guide

Complete step-by-step instructions for hosting Serenity Spa & Wellness as a static website on AWS.

---

## Prerequisites

Before starting, ensure you have:

- [ ] An AWS account ([aws.amazon.com](https://aws.amazon.com))
- [ ] AWS CLI installed: [docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html](https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html)
- [ ] AWS CLI configured with credentials: `aws configure`
- [ ] A domain name (optional, for custom domain)
- [ ] AWS Certificate Manager (ACM) SSL cert in `us-east-1` (required for CloudFront HTTPS)

### Verify AWS CLI Setup
```bash
aws sts get-caller-identity
# Should return your account ID, user ARN, and user ID
```

---

## Step 1 — Create S3 Bucket

```bash
# Set your bucket name (must be globally unique; use your domain or company name)
BUCKET_NAME="serenity-spa-wellness-site"
REGION="us-west-2"   # Change to your preferred region

# Create the bucket
aws s3api create-bucket \
  --bucket "$BUCKET_NAME" \
  --region "$REGION" \
  --create-bucket-configuration LocationConstraint="$REGION"
```

> **Note:** If deploying in `us-east-1`, omit the `--create-bucket-configuration` flag.

### Disable Block Public Access

By default, S3 blocks all public access. For CloudFront + OAC (recommended), you can keep this enabled. For simpler direct S3 public hosting, disable it:

```bash
# Option A: Keep blocked (use with CloudFront OAC — recommended)
# No command needed; leave defaults.

# Option B: Allow public access (simpler, less secure)
aws s3api put-public-access-block \
  --bucket "$BUCKET_NAME" \
  --public-access-block-configuration \
    "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false"
```

### Enable Static Website Hosting

```bash
aws s3 website "s3://$BUCKET_NAME" \
  --index-document index.html \
  --error-document index.html
```

### Apply Bucket Policy (Option B — direct public access only)

```bash
cat > /tmp/bucket-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::${BUCKET_NAME}/*"
    }
  ]
}
EOF

aws s3api put-bucket-policy \
  --bucket "$BUCKET_NAME" \
  --policy file:///tmp/bucket-policy.json
```

---

## Step 2 — Upload Files to S3

### Full Site Sync (recommended)

```bash
# Sync all files to S3
aws s3 sync . "s3://$BUCKET_NAME/" \
  --delete \
  --exclude ".git/*" \
  --exclude "*.sh" \
  --exclude "*.md" \
  --exclude "node_modules/*" \
  --exclude ".gitignore" \
  --exclude "package*.json"
```

> `--delete` removes files from S3 that no longer exist locally. Remove it on first deploy if you prefer a safer push.

### Set Cache Headers for Performance

```bash
# HTML files: short cache (they change often)
aws s3 cp . "s3://$BUCKET_NAME/" \
  --recursive \
  --exclude "*" \
  --include "*.html" \
  --content-type "text/html; charset=utf-8" \
  --cache-control "public, max-age=3600"

# CSS: longer cache (fingerprint filenames for cache-busting in production)
aws s3 cp css/ "s3://$BUCKET_NAME/css/" \
  --recursive \
  --content-type "text/css; charset=utf-8" \
  --cache-control "public, max-age=86400"

# JavaScript
aws s3 cp js/ "s3://$BUCKET_NAME/js/" \
  --recursive \
  --content-type "application/javascript; charset=utf-8" \
  --cache-control "public, max-age=86400"

# Images (if any)
aws s3 cp images/ "s3://$BUCKET_NAME/images/" \
  --recursive \
  --cache-control "public, max-age=2592000"
```

### Verify Upload

```bash
aws s3 ls "s3://$BUCKET_NAME/" --recursive
```

---

## Step 3 — Create CloudFront Distribution

CloudFront gives you HTTPS, global CDN caching, and custom domains. This is the recommended approach for production.

### Via AWS Console (easiest)

1. Go to **CloudFront** → **Create Distribution**
2. **Origin domain**: Select your S3 bucket from the dropdown
3. **Origin access**: Select **Origin access control settings (recommended)**
   - Create a new OAC or select existing
   - Copy the policy and apply it to your S3 bucket when prompted
4. **Viewer protocol policy**: `Redirect HTTP to HTTPS`
5. **Cache behavior**:
   - Allowed HTTP methods: `GET, HEAD`
   - Cache policy: `CachingOptimized` (for static sites)
   - Compress objects automatically: ✅ Yes
6. **Default root object**: `index.html`
7. **Custom error responses** (important for SPA behavior):
   - HTTP error code: `403` → Response page: `/index.html`, HTTP response code: `200`
   - HTTP error code: `404` → Response page: `/index.html`, HTTP response code: `200`
8. **Alternate domain names (CNAMEs)**: Add your custom domain (e.g., `www.serenity-spa.com`)
9. **Custom SSL certificate**: Select your ACM certificate (must be in `us-east-1`)
10. Click **Create Distribution**

### Via AWS CLI

```bash
# Create a basic CloudFront distribution (minimal config)
CF_ORIGIN="$BUCKET_NAME.s3-website-$REGION.amazonaws.com"

aws cloudfront create-distribution \
  --origin-domain-name "$CF_ORIGIN" \
  --default-root-object "index.html" \
  --query 'Distribution.{Id:Id,DomainName:DomainName}' \
  --output json
```

> For production, use a full distribution config JSON. See [AWS docs](https://docs.aws.amazon.com/cloudfront/latest/APIReference/API_CreateDistribution.html).

### Note the Distribution Details

```bash
# Get your CloudFront domain and distribution ID
aws cloudfront list-distributions \
  --query 'DistributionList.Items[].{Id:Id,Domain:DomainName,Status:Status}' \
  --output table
```

Save the distribution ID — you'll need it for cache invalidation:
```bash
export CF_DISTRIBUTION_ID="E1234567890ABC"  # Replace with your actual ID
```

---

## Step 4 — Configure Custom Domain (Optional)

### 4a. Get an SSL Certificate (ACM)

```bash
# Request a certificate — MUST be in us-east-1 for CloudFront
aws acm request-certificate \
  --domain-name "serenity-spa.com" \
  --subject-alternative-names "www.serenity-spa.com" \
  --validation-method DNS \
  --region us-east-1
```

Follow DNS validation instructions in the ACM console.

### 4b. Configure Route 53 (or your DNS provider)

**If using Route 53:**
```bash
# Get your CloudFront domain (e.g., d1234abcdef.cloudfront.net)
CF_DOMAIN=$(aws cloudfront get-distribution \
  --id "$CF_DISTRIBUTION_ID" \
  --query 'Distribution.DomainName' \
  --output text)

# Create a hosted zone (if not already done)
aws route53 create-hosted-zone \
  --name "serenity-spa.com" \
  --caller-reference "$(date +%s)"

# Add ALIAS record pointing to CloudFront
# (Use the Route 53 console for an easy ALIAS record, or use change-resource-record-sets)
```

**If using another DNS provider:**
- Add a `CNAME` record: `www` → your CloudFront domain (e.g., `d1234abcdef.cloudfront.net`)
- For the apex domain (`serenity-spa.com`), use ALIAS or ANAME if your provider supports it

---

## Step 5 — Deploy Updates

### Quick file update

```bash
# After editing files locally:
aws s3 sync . "s3://$BUCKET_NAME/" \
  --delete \
  --exclude ".git/*" \
  --exclude "*.sh" \
  --exclude "*.md" \
  --exclude "node_modules/*" \
  --exclude ".gitignore" \
  --exclude "package*.json"
```

### Invalidate CloudFront Cache

After uploading, CloudFront continues serving cached content until it expires. Invalidate to serve the new files immediately:

```bash
# Invalidate all files (/*) — first 1,000 invalidation paths per month are free
aws cloudfront create-invalidation \
  --distribution-id "$CF_DISTRIBUTION_ID" \
  --paths "/*"

# Or invalidate specific files only
aws cloudfront create-invalidation \
  --distribution-id "$CF_DISTRIBUTION_ID" \
  --paths "/index.html" "/css/styles.css"
```

Check invalidation status:
```bash
aws cloudfront list-invalidations \
  --distribution-id "$CF_DISTRIBUTION_ID" \
  --query 'InvalidationList.Items[0].{Id:Id,Status:Status,CreateTime:CreateTime}'
```

---

## Automated Deployment Script

Create `aws-deploy.sh` in your project root:

```bash
#!/usr/bin/env bash
# aws-deploy.sh — Automated S3 + CloudFront deployment

set -euo pipefail

# ---- Configuration — edit these ----
BUCKET_NAME="serenity-spa-wellness-site"
CF_DISTRIBUTION_ID="E1234567890ABC"   # Replace with yours
REGION="us-west-2"
# ---- End configuration ----

echo "▶ Syncing files to s3://$BUCKET_NAME..."
aws s3 sync . "s3://$BUCKET_NAME/" \
  --delete \
  --region "$REGION" \
  --exclude ".git/*" \
  --exclude "*.sh" \
  --exclude "*.md" \
  --exclude "node_modules/*" \
  --exclude ".gitignore" \
  --exclude "package*.json" \
  --exclude "knowledge-base.md"

echo "▶ Setting cache headers for HTML files..."
aws s3 cp . "s3://$BUCKET_NAME/" \
  --recursive \
  --exclude "*" \
  --include "*.html" \
  --content-type "text/html; charset=utf-8" \
  --cache-control "public, max-age=3600" \
  --metadata-directive REPLACE \
  --region "$REGION"

echo "▶ Invalidating CloudFront cache..."
INVALIDATION_ID=$(aws cloudfront create-invalidation \
  --distribution-id "$CF_DISTRIBUTION_ID" \
  --paths "/*" \
  --query 'Invalidation.Id' \
  --output text)
echo "   Invalidation ID: $INVALIDATION_ID"

echo "▶ Waiting for invalidation to complete..."
aws cloudfront wait invalidation-completed \
  --distribution-id "$CF_DISTRIBUTION_ID" \
  --id "$INVALIDATION_ID"

echo "✅ Deployment complete!"
echo "   URL: https://$(aws cloudfront get-distribution \
    --id "$CF_DISTRIBUTION_ID" \
    --query 'Distribution.DomainName' \
    --output text)"
```

Make it executable:
```bash
chmod +x aws-deploy.sh
./aws-deploy.sh
```

---

## Cost Estimation

For a small spa website with ~5,000 monthly visitors:

| Service | Usage | Est. Monthly Cost |
|---------|-------|-------------------|
| S3 Storage | ~5 MB files | ~$0.01 |
| S3 Requests | ~50,000 GET requests | ~$0.02 |
| CloudFront Data Transfer | ~1 GB out | ~$0.09 |
| CloudFront Requests | ~50,000 HTTPS requests | ~$0.01 |
| Route 53 Hosted Zone | 1 zone | $0.50 |
| **Total** | | **~$0.65/month** |

> AWS Free Tier covers the first 12 months generously. Actual costs may vary.
> CloudFront has a perpetual free tier: 1 TB data transfer + 10M requests/month.

---

## Troubleshooting

### ❌ `403 Forbidden` when accessing site

**Cause:** S3 public access is blocked or bucket policy is missing.

**Fix:**
```bash
# Check public access block settings
aws s3api get-public-access-block --bucket "$BUCKET_NAME"

# Re-apply bucket policy
aws s3api put-bucket-policy --bucket "$BUCKET_NAME" --policy file:///tmp/bucket-policy.json
```

### ❌ `404 Not Found` for pages

**Cause:** CloudFront doesn't know to redirect unknown paths to `index.html`.

**Fix:** In CloudFront console → Error Pages → Add custom error response:
- Error code: 404 → Response path: `/index.html` → HTTP 200

### ❌ Changes not showing after upload

**Cause:** CloudFront is serving cached files.

**Fix:**
```bash
aws cloudfront create-invalidation \
  --distribution-id "$CF_DISTRIBUTION_ID" \
  --paths "/*"
```

### ❌ `HTTPS redirect not working`

**Cause:** CloudFront viewer protocol policy is not set to redirect.

**Fix:** In CloudFront → Behaviors → Edit → "Viewer protocol policy" → Set to `Redirect HTTP to HTTPS`

### ❌ `aws: command not found`

**Fix:** Install or reinstall the AWS CLI:
```bash
# macOS
brew install awscli

# Or download from AWS
curl "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o "AWSCLIV2.pkg"
sudo installer -pkg AWSCLIV2.pkg -target /
```

### ❌ `AccessDenied` when creating bucket or syncing

**Cause:** IAM user lacks S3/CloudFront permissions.

**Fix:** Add the following IAM policy to your deploying user:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket",
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:PutBucketPolicy",
        "s3:GetBucketPolicy",
        "s3:PutBucketWebsite"
      ],
      "Resource": [
        "arn:aws:s3:::YOUR_BUCKET_NAME",
        "arn:aws:s3:::YOUR_BUCKET_NAME/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "cloudfront:CreateInvalidation",
        "cloudfront:GetDistribution",
        "cloudfront:ListDistributions"
      ],
      "Resource": "*"
    }
  ]
}
```

---

## Security Best Practices

1. **Never commit AWS credentials** — `.gitignore` already excludes `.env` and credential files
2. **Use IAM roles** instead of long-term access keys for CI/CD pipelines
3. **Enable CloudFront security headers** via a Lambda@Edge or CloudFront Function:
   - `Strict-Transport-Security`
   - `X-Content-Type-Options: nosniff`
   - `X-Frame-Options: DENY`
   - `Content-Security-Policy`
4. **Enable S3 access logging** for audit trails
5. **Enable CloudFront access logs** for traffic analysis
6. **Rotate access keys** every 90 days
7. **Use CloudFront WAF** if you add a form backend (prevents spam/DoS)

---

## Maintenance Checklist

**Monthly:**
- [ ] Review CloudFront access logs for unusual traffic
- [ ] Check AWS Cost Explorer for unexpected charges
- [ ] Test all pages and forms in multiple browsers

**Quarterly:**
- [ ] Review and rotate AWS access keys
- [ ] Test booking form flow end-to-end
- [ ] Update treatment prices if changed
- [ ] Review and update FAQ content

**Annually:**
- [ ] Review SSL certificate expiration (ACM auto-renews if DNS validated)
- [ ] Review CloudFront pricing and distribution settings
- [ ] Audit IAM permissions for principle of least privilege
