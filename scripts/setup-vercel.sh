#!/bin/bash

# Nova-Rewards Vercel Setup Script
# This script helps configure Vercel deployment for the Nova-Rewards frontend
# Usage: bash scripts/setup-vercel.sh

set -e

echo "🚀 Nova-Rewards Vercel Setup"
echo "=============================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo -e "${YELLOW}⚠️  Vercel CLI not found. Installing...${NC}"
    npm install -g vercel
fi

echo -e "${BLUE}Step 1: Vercel Project Setup${NC}"
echo "This will link your GitHub repository to Vercel."
echo "You'll need to:"
echo "  1. Log in to your Vercel account"
echo "  2. Select or create a new project"
echo "  3. Configure the root directory to: novaRewards/frontend"
echo ""
read -p "Press Enter to continue..."

vercel link --cwd novaRewards/frontend

echo ""
echo -e "${BLUE}Step 2: Environment Variables${NC}"
echo "You need to set environment variables in Vercel for both Preview and Production."
echo ""
echo "Preview Environment Variables:"
echo "  NEXT_PUBLIC_API_URL=https://api-preview.nova-rewards.xyz"
echo "  NEXT_PUBLIC_HORIZON_URL=https://horizon-testnet.stellar.org"
echo "  NEXT_PUBLIC_ISSUER_PUBLIC=<your-testnet-issuer-public-key>"
echo "  NEXT_PUBLIC_STELLAR_NETWORK=testnet"
echo "  NEXT_PUBLIC_MULTISIG_CONTRACT_ID=<your-testnet-contract-id>"
echo ""
echo "Production Environment Variables:"
echo "  NEXT_PUBLIC_API_URL=https://api.nova-rewards.xyz"
echo "  NEXT_PUBLIC_HORIZON_URL=https://horizon.stellar.org"
echo "  NEXT_PUBLIC_ISSUER_PUBLIC=<your-mainnet-issuer-public-key>"
echo "  NEXT_PUBLIC_STELLAR_NETWORK=public"
echo "  NEXT_PUBLIC_MULTISIG_CONTRACT_ID=<your-mainnet-contract-id>"
echo ""
echo "To set these:"
echo "  1. Go to Vercel Dashboard → Project Settings → Environment Variables"
echo "  2. Add each variable and select the appropriate environment (Preview/Production)"
echo ""
read -p "Press Enter after setting environment variables..."

echo ""
echo -e "${BLUE}Step 3: GitHub Secrets${NC}"
echo "You need to add GitHub secrets for automated deployments."
echo ""
echo "Required secrets:"
echo "  VERCEL_TOKEN - Get from: https://vercel.com/account/tokens"
echo "  VERCEL_ORG_ID - Found in Vercel project settings"
echo "  VERCEL_PROJECT_ID - Found in Vercel project settings"
echo ""
echo "To add secrets:"
echo "  1. Go to GitHub → Settings → Secrets and variables → Actions"
echo "  2. Click 'New repository secret'"
echo "  3. Add each secret"
echo ""
read -p "Press Enter after adding GitHub secrets..."

echo ""
echo -e "${BLUE}Step 4: Custom Domain${NC}"
echo "Configure your custom domain in Vercel."
echo ""
echo "To add custom domain:"
echo "  1. Go to Vercel Dashboard → Project Settings → Domains"
echo "  2. Add domain: app.nova-rewards.xyz"
echo "  3. Vercel will provide DNS configuration"
echo "  4. Update DNS records at your domain registrar"
echo "  5. Wait for DNS propagation (up to 48 hours)"
echo ""
read -p "Press Enter after configuring custom domain..."

echo ""
echo -e "${BLUE}Step 5: Branch Protection Rules${NC}"
echo "Configure GitHub branch protection for the main branch."
echo ""
echo "To set up branch protection:"
echo "  1. Go to GitHub → Settings → Branches"
echo "  2. Click 'Add rule'"
echo "  3. Branch name pattern: main"
echo "  4. Enable:"
echo "     - Require a pull request before merging"
echo "     - Require status checks to pass before merging"
echo "     - Require branches to be up to date before merging"
echo "     - Require code reviews before merging (1 review)"
echo "  5. Select required status checks:"
echo "     - CI"
echo "     - Vercel Preview Deployment"
echo "  6. Save"
echo ""
read -p "Press Enter after configuring branch protection..."

echo ""
echo -e "${GREEN}✅ Vercel Setup Complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Create a test PR to verify preview deployment"
echo "  2. Merge PR to main to verify production deployment"
echo "  3. Test custom domain: https://app.nova-rewards.xyz"
echo "  4. Monitor deployments in Vercel Dashboard"
echo ""
echo "Documentation:"
echo "  - VERCEL_SETUP.md - Detailed setup guide"
echo "  - DEPLOYMENT_CHECKLIST.md - Deployment checklist"
echo ""
