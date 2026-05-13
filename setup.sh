#!/usr/bin/env bash
# =============================================================
# setup.sh — Serenity Spa Admin Panel Setup
# Creates Cognito User Pool, API Gateway, Lambda, and IAM role
#
# Usage:
#   chmod +x setup.sh
#   ./setup.sh
#
# Prerequisites:
#   - AWS CLI v2 configured (aws configure)
#   - Node.js 20+ installed
#   - jq installed (brew install jq)
#   - S3 bucket and CloudFront distribution already deployed
#     (run aws-deploy.sh first)
# =============================================================

set -euo pipefail

# ---- Configuration — edit these ----
BUCKET_NAME="serenity-spa-wellness-site"
CF_DISTRIBUTION_ID="E394G7D2J8ETX3"
REGION="us-west-2"
ADMIN_EMAIL="dmadera0@gmail.com"        # Primary admin email
GOOGLE_CLIENT_ID=""                     # From Google Cloud Console
GOOGLE_CLIENT_SECRET=""                 # From Google Cloud Console

# Names (no changes needed)
POOL_NAME="serenity-spa-admin-pool"
CLIENT_NAME="serenity-spa-admin-client"
LAMBDA_NAME="serenity-spa-admin-api"
ROLE_NAME="serenity-spa-admin-lambda-role"
API_NAME="serenity-spa-admin-api"
# ------------------------------------

# Colors
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log()  { echo -e "${BLUE}▶${NC} $1"; }
ok()   { echo -e "${GREEN}✅${NC} $1"; }
warn() { echo -e "${YELLOW}⚠️${NC}  $1"; }
err()  { echo -e "${RED}❌${NC} $1"; exit 1; }

# Verify dependencies
if ! command -v aws &>/dev/null; then err "AWS CLI not installed."; fi
if ! command -v jq &>/dev/null; then err "jq not installed. Run: brew install jq"; fi
if ! command -v node &>/dev/null; then err "Node.js not installed."; fi

# Verify AWS credentials
log "Verifying AWS credentials..."
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ok "AWS account: $ACCOUNT_ID"

# Validate required config
if [ -z "$GOOGLE_CLIENT_ID" ] || [ -z "$GOOGLE_CLIENT_SECRET" ]; then
  err "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set. See README-admin.md for instructions."
fi

# ---- Step 1: Create Cognito User Pool ----
log "Creating Cognito User Pool: $POOL_NAME..."

POOL_ID=$(aws cognito-idp create-user-pool \
  --pool-name "$POOL_NAME" \
  --region "$REGION" \
  --auto-verified-attributes email \
  --username-attributes email \
  --admin-create-user-config '{"AllowAdminCreateUserOnly":true}' \
  --query 'UserPool.Id' \
  --output text)

ok "User Pool created: $POOL_ID"

# ---- Step 2: Configure Google as Identity Provider ----
log "Configuring Google OAuth identity provider..."

aws cognito-idp create-identity-provider \
  --user-pool-id "$POOL_ID" \
  --provider-name Google \
  --provider-type Google \
  --provider-details "client_id=$GOOGLE_CLIENT_ID,client_secret=$GOOGLE_CLIENT_SECRET,authorize_scopes=email openid profile" \
  --attribute-mapping "email=email,name=name" \
  --region "$REGION" > /dev/null

ok "Google OAuth configured"

# ---- Step 3: Create App Client ----
log "Creating Cognito App Client..."

CALLBACK_URL="https://$(aws cloudfront get-distribution \
  --id "$CF_DISTRIBUTION_ID" \
  --query 'Distribution.DomainName' \
  --output text)/admin/"

CLIENT_ID=$(aws cognito-idp create-user-pool-client \
  --user-pool-id "$POOL_ID" \
  --client-name "$CLIENT_NAME" \
  --generate-secret \
  --supported-identity-providers Google \
  --allowed-o-auth-flows code \
  --allowed-o-auth-scopes "email" "openid" "profile" \
  --allowed-o-auth-flows-user-pool-client \
  --callback-ur-ls "$CALLBACK_URL" \
  --logout-ur-ls "${CALLBACK_URL}index.html" \
  --region "$REGION" \
  --query 'UserPoolClient.ClientId' \
  --output text)

ok "App Client created: $CLIENT_ID"

# ---- Step 4: Create Cognito Domain ----
COGNITO_DOMAIN="serenity-spa-${ACCOUNT_ID}"
log "Creating Cognito hosted UI domain: $COGNITO_DOMAIN..."

aws cognito-idp create-user-pool-domain \
  --domain "$COGNITO_DOMAIN" \
  --user-pool-id "$POOL_ID" \
  --region "$REGION" > /dev/null

COGNITO_DOMAIN_URL="${COGNITO_DOMAIN}.auth.${REGION}.amazoncognito.com"
ok "Cognito domain: $COGNITO_DOMAIN_URL"

# ---- Step 5: Invite admin user ----
log "Inviting admin user: $ADMIN_EMAIL..."

aws cognito-idp admin-create-user \
  --user-pool-id "$POOL_ID" \
  --username "$ADMIN_EMAIL" \
  --user-attributes "Name=email,Value=$ADMIN_EMAIL" "Name=email_verified,Value=true" \
  --message-action SUPPRESS \
  --region "$REGION" > /dev/null

ok "Admin user created"

# ---- Step 6: Create IAM Role for Lambda ----
log "Creating IAM role: $ROLE_NAME..."

TRUST_POLICY='{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "lambda.amazonaws.com" },
    "Action": "sts:AssumeRole"
  }]
}'

ROLE_ARN=$(aws iam create-role \
  --role-name "$ROLE_NAME" \
  --assume-role-policy-document "$TRUST_POLICY" \
  --query 'Role.Arn' \
  --output text)

# Attach basic Lambda execution policy
aws iam attach-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# Create and attach custom S3 + CloudFront policy
CUSTOM_POLICY=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject"],
      "Resource": "arn:aws:s3:::${BUCKET_NAME}/*"
    },
    {
      "Effect": "Allow",
      "Action": "cloudfront:CreateInvalidation",
      "Resource": "arn:aws:cloudfront::${ACCOUNT_ID}:distribution/${CF_DISTRIBUTION_ID}"
    }
  ]
}
EOF
)

aws iam put-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-name "serenity-spa-s3-cf-access" \
  --policy-document "$CUSTOM_POLICY"

ok "IAM role created: $ROLE_ARN"

# Wait for IAM role propagation
log "Waiting for IAM role to propagate (10s)..."
sleep 10

# ---- Step 7: Package and deploy Lambda ----
log "Installing Lambda dependencies..."
cd lambda
npm install --production --silent
zip -rq ../lambda-deploy.zip . 2>/dev/null
cd ..

log "Creating Lambda function: $LAMBDA_NAME..."

LAMBDA_ARN=$(aws lambda create-function \
  --function-name "$LAMBDA_NAME" \
  --runtime nodejs20.x \
  --role "$ROLE_ARN" \
  --handler index.handler \
  --zip-file fileb://lambda-deploy.zip \
  --environment "Variables={S3_BUCKET_NAME=${BUCKET_NAME},CF_DISTRIBUTION_ID=${CF_DISTRIBUTION_ID},ADMIN_ORIGIN=*}" \
  --timeout 30 \
  --memory-size 256 \
  --region "$REGION" \
  --query 'FunctionArn' \
  --output text)

rm -f lambda-deploy.zip
ok "Lambda deployed: $LAMBDA_ARN"

# ---- Step 8: Create HTTP API Gateway ----
log "Creating API Gateway: $API_NAME..."

API_ID=$(aws apigatewayv2 create-api \
  --name "$API_NAME" \
  --protocol-type HTTP \
  --cors-configuration "AllowOrigins=*,AllowMethods=GET,PUT,OPTIONS,AllowHeaders=Authorization,Content-Type" \
  --region "$REGION" \
  --query 'ApiId' \
  --output text)

# ---- Step 9: Create Cognito JWT Authorizer ----
log "Creating Cognito JWT Authorizer..."

USER_POOL_ARN="arn:aws:cognito-idp:${REGION}:${ACCOUNT_ID}:userpool/${POOL_ID}"

AUTHORIZER_ID=$(aws apigatewayv2 create-authorizer \
  --api-id "$API_ID" \
  --authorizer-type JWT \
  --identity-source '$request.header.Authorization' \
  --name "CognitoAuthorizer" \
  --jwt-configuration "Audience=${CLIENT_ID},Issuer=https://cognito-idp.${REGION}.amazonaws.com/${POOL_ID}" \
  --region "$REGION" \
  --query 'AuthorizerId' \
  --output text)

ok "Authorizer created: $AUTHORIZER_ID"

# ---- Step 10: Create Lambda Integration ----
log "Creating Lambda integration..."

INTEGRATION_ID=$(aws apigatewayv2 create-integration \
  --api-id "$API_ID" \
  --integration-type AWS_PROXY \
  --integration-uri "$LAMBDA_ARN" \
  --payload-format-version "2.0" \
  --region "$REGION" \
  --query 'IntegrationId' \
  --output text)

# ---- Step 11: Create routes ----
log "Creating API routes..."

for ROUTE in "GET /admin/api/content" "PUT /admin/api/content" "GET /admin/api/me"; do
  aws apigatewayv2 create-route \
    --api-id "$API_ID" \
    --route-key "$ROUTE" \
    --authorization-type JWT \
    --authorizer-id "$AUTHORIZER_ID" \
    --target "integrations/$INTEGRATION_ID" \
    --region "$REGION" > /dev/null
done

# Add OPTIONS routes (no auth needed for preflight)
for ROUTE in "OPTIONS /admin/api/content" "OPTIONS /admin/api/me"; do
  aws apigatewayv2 create-route \
    --api-id "$API_ID" \
    --route-key "$ROUTE" \
    --target "integrations/$INTEGRATION_ID" \
    --region "$REGION" > /dev/null
done

ok "Routes created"

# ---- Step 12: Deploy API stage ----
log "Deploying API Gateway stage..."

STAGE_ID=$(aws apigatewayv2 create-stage \
  --api-id "$API_ID" \
  --stage-name prod \
  --auto-deploy \
  --region "$REGION" \
  --query 'StageName' \
  --output text)

API_ENDPOINT=$(aws apigatewayv2 get-api \
  --api-id "$API_ID" \
  --region "$REGION" \
  --query 'ApiEndpoint' \
  --output text)

ok "API deployed: $API_ENDPOINT"

# ---- Step 13: Grant API Gateway permission to invoke Lambda ----
log "Granting API Gateway invoke permission..."

aws lambda add-permission \
  --function-name "$LAMBDA_NAME" \
  --statement-id "api-gateway-invoke" \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*" \
  --region "$REGION" > /dev/null

ok "Lambda invoke permission granted"

# ---- Step 14: Inject config into admin frontend ----
log "Updating admin frontend configuration..."

CONFIG_JS=$(cat <<EOF
// Admin Panel Configuration (auto-generated by setup.sh)
const ADMIN_CONFIG = {
  apiEndpoint: '${API_ENDPOINT}/prod',
  cognitoClientId: '${CLIENT_ID}',
  cognitoDomain: '${COGNITO_DOMAIN_URL}',
  callbackUrl: '${CALLBACK_URL}'
};
EOF
)

echo "$CONFIG_JS" > admin/js/admin-config.js

# Inject config into admin-auth.js values
log "Patching admin-auth.js with Cognito config..."
sed -i '' \
  -e "s|clientId: ''|clientId: '${CLIENT_ID}'|" \
  -e "s|redirectUri: ''|redirectUri: '${CALLBACK_URL}'|" \
  -e "s|cognitoDomain: ''|cognitoDomain: '${COGNITO_DOMAIN_URL}'|" \
  admin/js/admin-auth.js

ok "Admin frontend configuration updated"

# ---- Step 15: Deploy admin frontend to S3 ----
log "Deploying admin panel to S3..."

aws s3 sync admin/ "s3://$BUCKET_NAME/admin/" \
  --delete \
  --region "$REGION" \
  --exclude ".DS_Store"

# Set cache headers for admin HTML
aws s3 cp admin/ "s3://$BUCKET_NAME/admin/" \
  --recursive \
  --region "$REGION" \
  --exclude "*" \
  --include "*.html" \
  --content-type "text/html; charset=utf-8" \
  --cache-control "no-store" \
  --metadata-directive REPLACE \
  --quiet

ok "Admin panel deployed to S3"

# ---- Step 16: Invalidate CloudFront ----
log "Clearing CloudFront cache for /admin/*..."

aws cloudfront create-invalidation \
  --distribution-id "$CF_DISTRIBUTION_ID" \
  --paths "/admin/*" \
  --query 'Invalidation.Id' \
  --output text > /dev/null

ok "CloudFront cache cleared"

# ---- Done ----
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
ok "Admin Panel Setup Complete!"
echo ""
echo "  Cognito Pool:    $POOL_ID"
echo "  Cognito Client:  $CLIENT_ID"
echo "  Cognito Domain:  $COGNITO_DOMAIN_URL"
echo "  API Endpoint:    $API_ENDPOINT/prod"
echo "  Lambda:          $LAMBDA_NAME"
echo "  Admin URL:       ${CALLBACK_URL}"
echo ""
warn "Next: In Google Cloud Console, add this Authorized Redirect URI:"
echo "      https://${COGNITO_DOMAIN_URL}/oauth2/idpresponse"
echo ""
warn "Save these values — you'll need them if you redeploy:"
echo "  POOL_ID=$POOL_ID"
echo "  CLIENT_ID=$CLIENT_ID"
echo "  API_ENDPOINT=$API_ENDPOINT/prod"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
