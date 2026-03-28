# Nova-Rewards Vercel Deployment Checklist

Complete this checklist to ensure proper Vercel deployment setup.

## Pre-Deployment

- [ ] Vercel account created
- [ ] GitHub repository connected to Vercel
- [ ] Admin access to GitHub repository confirmed
- [ ] Domain registered (e.g., `app.nova-rewards.xyz`)
- [ ] Stellar testnet and mainnet accounts configured
- [ ] Soroban contract IDs obtained for both networks

## Vercel Project Setup

- [ ] Vercel project created from GitHub repository
- [ ] Root directory set to `novaRewards/frontend`
- [ ] Framework preset set to Next.js
- [ ] Build command set to `npm run build`
- [ ] Output directory set to `.next`
- [ ] Install command set to `npm install`

## Environment Variables - Preview

- [ ] `NEXT_PUBLIC_API_URL` = `https://api-preview.nova-rewards.xyz`
- [ ] `NEXT_PUBLIC_HORIZON_URL` = `https://horizon-testnet.stellar.org`
- [ ] `NEXT_PUBLIC_ISSUER_PUBLIC` = testnet issuer public key
- [ ] `NEXT_PUBLIC_STELLAR_NETWORK` = `testnet`
- [ ] `NEXT_PUBLIC_MULTISIG_CONTRACT_ID` = testnet contract ID

## Environment Variables - Production

- [ ] `NEXT_PUBLIC_API_URL` = `https://api.nova-rewards.xyz`
- [ ] `NEXT_PUBLIC_HORIZON_URL` = `https://horizon.stellar.org`
- [ ] `NEXT_PUBLIC_ISSUER_PUBLIC` = mainnet issuer public key
- [ ] `NEXT_PUBLIC_STELLAR_NETWORK` = `public`
- [ ] `NEXT_PUBLIC_MULTISIG_CONTRACT_ID` = mainnet contract ID

## Custom Domain Configuration

- [ ] Custom domain added to Vercel project
- [ ] SSL certificate provisioned (green checkmark visible)
- [ ] DNS records configured at domain registrar
- [ ] DNS propagation verified (can take up to 48 hours)
- [ ] HTTPS working on custom domain

## Edge Network Caching

- [ ] `vercel.json` created with cache headers
- [ ] Static assets caching configured (1 year, immutable)
- [ ] Next.js static files caching configured (1 year, immutable)
- [ ] Cache headers verified in browser DevTools

## GitHub Integration

- [ ] `VERCEL_TOKEN` secret added to GitHub
- [ ] `VERCEL_ORG_ID` secret added to GitHub
- [ ] `VERCEL_PROJECT_ID` secret added to GitHub
- [ ] `.github/workflows/vercel-preview.yml` created
- [ ] `.github/workflows/vercel-production.yml` created
- [ ] Workflows visible in GitHub Actions tab

## Branch Protection Rules

- [ ] Branch protection rule created for `main`
- [ ] Require pull request before merging: enabled
- [ ] Require status checks to pass: enabled
- [ ] Vercel Preview Deployment status check required
- [ ] CI status check required
- [ ] Require branches up to date: enabled
- [ ] Require code reviews: enabled (1 review minimum)
- [ ] Require deployment to succeed: enabled

## Testing

- [ ] Create test PR to verify preview deployment
- [ ] Verify preview URL works and loads correctly
- [ ] Verify environment variables are correct in preview
- [ ] Verify PR status checks pass
- [ ] Verify PR comment with deployment URL appears
- [ ] Merge PR to main
- [ ] Verify production deployment triggered
- [ ] Verify production deployment completes successfully
- [ ] Verify custom domain works: `https://app.nova-rewards.xyz`
- [ ] Verify SSL certificate is valid
- [ ] Test cache headers in browser DevTools

## Monitoring & Maintenance

- [ ] Set up Vercel analytics monitoring
- [ ] Configure error tracking/alerts (optional)
- [ ] Document deployment process for team
- [ ] Create runbook for rollback procedures
- [ ] Schedule regular deployment reviews
- [ ] Monitor build times and performance metrics

## Documentation

- [ ] `VERCEL_SETUP.md` reviewed and shared with team
- [ ] `DEPLOYMENT_CHECKLIST.md` completed
- [ ] Team trained on deployment process
- [ ] Rollback procedures documented
- [ ] Emergency contacts identified

## Sign-Off

- [ ] Deployment lead: _________________ Date: _______
- [ ] DevOps/Infrastructure: _________________ Date: _______
- [ ] Project manager: _________________ Date: _______

## Notes

```
[Add any additional notes or observations here]
```
