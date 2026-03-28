# Vercel Deployment Setup Guide

This guide walks through setting up automated preview and production deployments for Nova-Rewards frontend on Vercel.

## Prerequisites

- Vercel account (https://vercel.com)
- GitHub repository connected to Vercel
- Admin access to the GitHub repository

## Step 1: Create Vercel Project

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New..." → "Project"
3. Select the Nova-Rewards GitHub repository
4. Configure project settings:
   - **Framework Preset**: Next.js
   - **Root Directory**: `novaRewards/frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
   - **Install Command**: `npm install`

## Step 2: Configure Environment Variables

### In Vercel Project Settings

1. Go to **Settings** → **Environment Variables**
2. Add the following variables for **Preview** environment:

```
NEXT_PUBLIC_API_URL=https://api-preview.nova-rewards.xyz
NEXT_PUBLIC_HORIZON_URL=https://horizon-testnet.stellar.org
NEXT_PUBLIC_ISSUER_PUBLIC=<your-testnet-issuer-public-key>
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_MULTISIG_CONTRACT_ID=<your-testnet-contract-id>
```

3. Add the following variables for **Production** environment:

```
NEXT_PUBLIC_API_URL=https://api.nova-rewards.xyz
NEXT_PUBLIC_HORIZON_URL=https://horizon.stellar.org
NEXT_PUBLIC_ISSUER_PUBLIC=<your-mainnet-issuer-public-key>
NEXT_PUBLIC_STELLAR_NETWORK=public
NEXT_PUBLIC_MULTISIG_CONTRACT_ID=<your-mainnet-contract-id>
```

**Note**: Mark variables as "Sensitive" if they contain sensitive data.

## Step 3: Configure Custom Domain

1. Go to **Settings** → **Domains**
2. Add custom domain: `app.nova-rewards.xyz`
3. Vercel automatically provisions SSL certificate via Let's Encrypt
4. Update DNS records at your domain registrar:
   - Add CNAME record pointing to Vercel's domain
   - Vercel provides exact DNS configuration in the UI

### DNS Configuration Example

```
Type: CNAME
Name: app
Value: cname.vercel-dns.com
```

## Step 4: Configure Edge Network Caching

Caching is configured in `vercel.json` with the following headers:

- **Static assets** (`/static/*`): `Cache-Control: public, max-age=31536000, immutable`
- **Next.js static files** (`/_next/static/*`): `Cache-Control: public, max-age=31536000, immutable`

This configuration:
- Caches hashed assets for 1 year (31536000 seconds)
- Uses `immutable` flag to prevent revalidation
- Leverages Vercel's Edge Network for global distribution

## Step 5: GitHub Integration & Branch Protection

### Set Up GitHub Secrets

1. Go to GitHub repository **Settings** → **Secrets and variables** → **Actions**
2. Add the following secrets:

```
VERCEL_TOKEN=<your-vercel-token>
VERCEL_ORG_ID=<your-vercel-org-id>
VERCEL_PROJECT_ID=<your-vercel-project-id>
```

**How to get these values:**
- `VERCEL_TOKEN`: Go to Vercel **Settings** → **Tokens** → Create new token
- `VERCEL_ORG_ID`: Found in Vercel project URL or Settings
- `VERCEL_PROJECT_ID`: Found in Vercel project URL or Settings

### Configure Branch Protection Rules

1. Go to GitHub repository **Settings** → **Branches**
2. Click **Add rule** under "Branch protection rules"
3. Configure for `main` branch:
   - **Branch name pattern**: `main`
   - **Require a pull request before merging**: ✓
   - **Require status checks to pass before merging**: ✓
   - **Require branches to be up to date before merging**: ✓
   - **Require code reviews before merging**: ✓ (recommended: 1 review)

4. Under **Require status checks to pass before merging**, add:
   - `Vercel Preview Deployment` (from `.github/workflows/vercel-preview.yml`)
   - `CI` (existing backend tests)

5. **Require deployment to succeed**: ✓
   - Select `Vercel (Preview)` as required deployment environment

## Step 6: Verify Deployment Workflows

### Preview Deployments

- Triggered on: Pull requests to `main`
- Workflow: `.github/workflows/vercel-preview.yml`
- Creates preview URL automatically
- Comments on PR with deployment link
- Must pass before merging (branch protection rule)

### Production Deployments

- Triggered on: Push to `main`
- Workflow: `.github/workflows/vercel-production.yml`
- Deploys to `app.nova-rewards.xyz`
- Automatic SSL via Let's Encrypt

## Step 7: Monitor Deployments

### Vercel Dashboard

- View all deployments: **Deployments** tab
- Check build logs: Click on any deployment
- Monitor performance: **Analytics** tab
- View error logs: **Logs** tab

### GitHub Actions

- View workflow runs: **Actions** tab
- Check PR status checks: PR page → "Checks" section
- View deployment status: PR page → "Deployments" section

## Environment Variables Reference

| Variable | Preview | Production | Description |
|----------|---------|------------|-------------|
| `NEXT_PUBLIC_API_URL` | `https://api-preview.nova-rewards.xyz` | `https://api.nova-rewards.xyz` | Backend API endpoint |
| `NEXT_PUBLIC_HORIZON_URL` | `https://horizon-testnet.stellar.org` | `https://horizon.stellar.org` | Stellar Horizon API |
| `NEXT_PUBLIC_ISSUER_PUBLIC` | Testnet issuer | Mainnet issuer | NOVA asset issuer public key |
| `NEXT_PUBLIC_STELLAR_NETWORK` | `testnet` | `public` | Stellar network |
| `NEXT_PUBLIC_MULTISIG_CONTRACT_ID` | Testnet contract | Mainnet contract | Soroban contract ID |

## Troubleshooting

### Build Fails

1. Check **Build Logs** in Vercel dashboard
2. Verify environment variables are set correctly
3. Ensure `npm run build` works locally: `cd novaRewards/frontend && npm run build`
4. Check Node.js version compatibility (Next.js 14 requires Node 18+)

### Preview URL Not Working

1. Verify PR status checks pass
2. Check Vercel deployment status
3. Review build logs for errors
4. Ensure all environment variables are set for Preview environment

### Custom Domain Not Resolving

1. Verify DNS records are correctly configured
2. Wait up to 48 hours for DNS propagation
3. Check domain registrar settings
4. Verify SSL certificate is provisioned (green checkmark in Vercel)

### Cache Not Working

1. Verify `vercel.json` headers are correctly configured
2. Check browser DevTools → Network tab for `Cache-Control` headers
3. Clear browser cache and test again
4. Verify hashed asset filenames (should contain hash in filename)

## Rollback Procedure

If production deployment has issues:

1. Go to Vercel **Deployments** tab
2. Find the previous stable deployment
3. Click **Promote to Production**
4. Verify rollback completed successfully

## Next Steps

1. Test preview deployment by creating a test PR
2. Verify production deployment after merging to main
3. Monitor analytics and performance metrics
4. Set up alerts for deployment failures (optional)
5. Document any custom configurations in team wiki

## Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Vercel Environment Variables](https://vercel.com/docs/projects/environment-variables)
- [Vercel Custom Domains](https://vercel.com/docs/concepts/projects/domains)
- [GitHub Actions with Vercel](https://vercel.com/docs/concepts/git/vercel-for-github)
