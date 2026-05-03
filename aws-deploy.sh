#!/usr/bin/env bash
# =============================================================
# aws-deploy.sh — Serenity Spa & Wellness
# Automated S3 + CloudFront deployment script
#
# Usage:
#   chmod +x aws-deploy.sh
#   ./aws-deploy.sh
#
# Requires: AWS CLI v2 configured with appropriate IAM permissions
# =============================================================

set -euo pipefail

# ---- Configuration — edit these before first deploy ----
BUCKET_NAME="serenity-spa-wellness-site"   # Must be globally unique
CF_DISTRIBUTION_ID=""                       # Set after creating CloudFront distribution
REGION="us-west-2"                          # AWS region for S3 bucket
# --------------------------------------------------------

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No color

log()  { echo -e "${BLUE}▶${NC} $1"; }
ok()   { echo -e "${GREEN}✅${NC} $1"; }
warn() { echo -e "${YELLOW}⚠️${NC} $1"; }
err()  { echo -e "${RED}❌${NC} $1"; exit 1; }

# Verify AWS CLI is installed and configured
if ! command -v aws &>/dev/null; then
  err "AWS CLI not found. Install it: https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html"
fi

log "Verifying AWS credentials..."
if ! aws sts get-caller-identity --output text &>/dev/null; then
  err "AWS credentials not configured. Run: aws configure"
fi
ok "AWS credentials verified"

# Verify bucket name is set
if [ -z "$BUCKET_NAME" ]; then
  err "BUCKET_NAME is not set in this script."
fi

# ---- Step 1: Sync files to S3 ----
log "Syncing files to s3://$BUCKET_NAME/ ..."

aws s3 sync . "s3://$BUCKET_NAME/" \
  --delete \
  --region "$REGION" \
  --exclude ".git/*" \
  --exclude "aws-deploy.sh" \
  --exclude "aws-deploy.md" \
  --exclude "README.md" \
  --exclude "knowledge-base.md" \
  --exclude "node_modules/*" \
  --exclude ".gitignore" \
  --exclude "package*.json" \
  --exclude ".DS_Store" \
  --exclude "*.tmp"

ok "Files synced to S3"

# ---- Step 2: Set cache headers for HTML ----
log "Setting cache headers for HTML files..."

aws s3 cp . "s3://$BUCKET_NAME/" \
  --recursive \
  --region "$REGION" \
  --exclude "*" \
  --include "*.html" \
  --content-type "text/html; charset=utf-8" \
  --cache-control "public, max-age=3600, must-revalidate" \
  --metadata-directive REPLACE \
  --quiet

ok "HTML cache headers applied (max-age=1h)"

# ---- Step 3: Set cache headers for CSS/JS ----
log "Setting cache headers for CSS/JS..."

aws s3 cp css/ "s3://$BUCKET_NAME/css/" \
  --recursive \
  --region "$REGION" \
  --content-type "text/css; charset=utf-8" \
  --cache-control "public, max-age=86400" \
  --metadata-directive REPLACE \
  --quiet

aws s3 cp js/ "s3://$BUCKET_NAME/js/" \
  --recursive \
  --region "$REGION" \
  --content-type "application/javascript; charset=utf-8" \
  --cache-control "public, max-age=86400" \
  --metadata-directive REPLACE \
  --quiet

ok "CSS/JS cache headers applied (max-age=24h)"

# ---- Step 4: CloudFront invalidation ----
if [ -n "$CF_DISTRIBUTION_ID" ]; then
  log "Creating CloudFront invalidation for /*..."

  INVALIDATION_ID=$(aws cloudfront create-invalidation \
    --distribution-id "$CF_DISTRIBUTION_ID" \
    --paths "/*" \
    --query 'Invalidation.Id' \
    --output text)

  ok "Invalidation created: $INVALIDATION_ID"
  log "Waiting for invalidation to complete (this may take 1–3 minutes)..."

  aws cloudfront wait invalidation-completed \
    --distribution-id "$CF_DISTRIBUTION_ID" \
    --id "$INVALIDATION_ID"

  ok "CloudFront cache invalidated"

  CF_DOMAIN=$(aws cloudfront get-distribution \
    --id "$CF_DISTRIBUTION_ID" \
    --query 'Distribution.DomainName' \
    --output text)

  echo ""
  ok "Deployment complete!"
  echo -e "   ${GREEN}🌐 Live at: https://$CF_DOMAIN${NC}"
else
  warn "CF_DISTRIBUTION_ID is not set — skipping CloudFront invalidation."
  warn "Set up CloudFront and add the distribution ID to this script."

  S3_URL="http://$BUCKET_NAME.s3-website-$REGION.amazonaws.com"
  ok "Files available at: $S3_URL (HTTP only, no CDN)"
fi

echo ""
log "Deployment summary:"
echo "  Bucket: s3://$BUCKET_NAME"
echo "  Region: $REGION"
echo "  Files synced: $(aws s3 ls s3://$BUCKET_NAME/ --recursive | wc -l | tr -d ' ') objects"
