# Nova-Rewards Deployment Guide

Complete guide for deploying Nova-Rewards frontend to Vercel with automated preview and production deployments.

## Quick Start

```bash
# Run the setup script
bash scripts/setup-vercel.sh
```

## Architecture Overview

```
GitHub Repository
    ↓
    ├─ Pull Request → Vercel Preview Deployment
    │  ├─ Runs: vercel-preview.yml
    │  ├─ Creates: Preview URL
    │  ├─ Status Check: Required for merge
    │  └─ Comment: PR with deployment link
    │
    └─ Push to main → Vercel Production Deployment
       ├─ Runs: vercel-production.yml
       ├─ Deploys to: app.nova-rewards.xyz
       ├─ SSL: Automatic via Let's Encrypt
       └─ Cache: Edge Network with 1-year immutable assets
```

## Deployment Workflow

### 1. Development

```bash
# Create feature branch
git checkout -b feature/my-feature

# Make changes and test locally
cd novaRewards/frontend
npm run dev

# Build locally to verify
npm run build
```

### 2. Create Pull Request

```bash
# Push changes
git push origin feature/my-feature

# Create PR on GitHub
# This triggers: vercel-preview.yml
```

**What happens:**
- GitHub Actions runs `vercel-preview.yml`
- Vercel builds and deploys preview
- PR gets status check: "Vercel Preview Deployment"
- PR gets comment with preview URL
- Preview URL must pass before merging (branch protection)

### 3. Review & Merge

```bash
# Review changes
# Test preview deployment
# Get code review approval

# Merge PR to main
# This triggers: vercel-production.yml
```

**What happens:**
- GitHub Actions runs `vercel-production.yml`
- Vercel builds and deploys to production
- Deployment goes to: app.nova-rewards.xyz
- SSL certificate automatically provisioned
- Edge Network caches static assets

## Environment Configuration

### Preview Environment

Used for pull request deployments and testing.

```env
NEXT_PUBLIC_API_URL=https://api-preview.nova-rewards.xyz
NEXT_PUBLIC_HORIZON_URL=https://horizon-testnet.stellar.org
NEXT_PUBLIC_ISSUER_PUBLIC=<testnet-issuer-public-key>
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_MULTISIG_CONTRACT_ID=<testnet-contract-id>
```

### Production Environment

Used for main branch deployments.

```env
NEXT_PUBLIC_API_URL=https://api.nova-rewards.xyz
NEXT_PUBLIC_HORIZON_URL=https://horizon.stellar.org
NEXT_PUBLIC_ISSUER_PUBLIC=<mainnet-issuer-public-key>
NEXT_PUBLIC_STELLAR_NETWORK=public
NEXT_PUBLIC_MULTISIG_CONTRACT_ID=<mainnet-contract-id>
```

## Caching Strategy

### Static Assets (1 Year, Immutable)

```
/static/*
/_next/static/*
```

**Cache Header:**
```
Cache-Control: public, max-age=31536000, immutable
```

**Benefits:**
- Hashed filenames ensure cache busting
- 1-year TTL reduces server load
- Immutable flag prevents revalidation
- Vercel Edge Network serves globally

### Dynamic Content

Next.js automatically handles:
- HTML pages: Revalidated on each request
- API routes: No caching by default
- ISR (Incremental Static Regeneration): Configurable per page

## Monitoring & Observability

### Vercel Dashboard

1. **Deployments Tab**
   - View all deployments
   - Check build logs
   - Monitor build times
   - View deployment status

2. **Analytics Tab**
   - Page performance metrics
   - Core Web Vitals
   - Traffic patterns
   - Error rates

3. **Logs Tab**
   - Build logs
   - Runtime logs
   - Error logs
   - Request logs

### GitHub Actions

1. **Actions Tab**
   - View workflow runs
   - Check job status
   - Review logs
   - Monitor execution time

2. **PR Status Checks**
   - CI status
   - Vercel Preview Deployment status
   - Required checks for merge

## Troubleshooting

### Build Fails

**Check:**
1. Vercel build logs
2. Environment variables are set
3. `npm run build` works locally
4. Node.js version (Next.js 14 requires Node 18+)

**Fix:**
```bash
# Test build locally
cd novaRewards/frontend
npm install
npm run build
```

### Preview URL Not Working

**Check:**
1. Vercel deployment status
2. Build logs for errors
3. Environment variables for Preview
4. PR status checks pass

**Fix:**
1. Check Vercel dashboard for deployment errors
2. Verify Preview environment variables
3. Retry deployment from Vercel dashboard

### Custom Domain Not Resolving

**Check:**
1. DNS records configured correctly
2. DNS propagation status
3. SSL certificate provisioned
4. Domain registrar settings

**Fix:**
```bash
# Check DNS propagation
nslookup app.nova-rewards.xyz

# Verify SSL certificate
curl -I https://app.nova-rewards.xyz
```

### Cache Not Working

**Check:**
1. Browser DevTools → Network tab
2. Response headers for `Cache-Control`
3. Asset filenames contain hash
4. `vercel.json` headers configured

**Fix:**
1. Clear browser cache
2. Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
3. Check `vercel.json` configuration
4. Verify hashed asset filenames

## Rollback Procedure

If production deployment has issues:

1. **Identify Issue**
   - Check Vercel dashboard
   - Review deployment logs
   - Check error tracking

2. **Rollback**
   - Go to Vercel Deployments tab
   - Find previous stable deployment
   - Click "Promote to Production"
   - Verify rollback completed

3. **Investigate**
   - Review changes in failed deployment
   - Check environment variables
   - Test locally
   - Create fix PR

4. **Redeploy**
   - Merge fix PR to main
   - Verify new deployment succeeds

## Performance Optimization

### Build Time

- **Target**: < 2 minutes
- **Monitor**: Vercel dashboard
- **Optimize**: 
  - Minimize dependencies
  - Use dynamic imports
  - Enable SWC minification

### Runtime Performance

- **Target**: < 100ms First Contentful Paint
- **Monitor**: Vercel Analytics
- **Optimize**:
  - Image optimization
  - Code splitting
  - Lazy loading
  - Edge caching

### Bundle Size

- **Target**: < 200KB (gzipped)
- **Monitor**: Build logs
- **Optimize**:
  - Tree shaking
  - Remove unused dependencies
  - Dynamic imports
  - Code splitting

## Security

### Environment Variables

- ✅ Use `NEXT_PUBLIC_*` only for public data
- ✅ Never commit `.env` files
- ✅ Use GitHub Secrets for sensitive data
- ✅ Rotate tokens regularly

### SSL/TLS

- ✅ Automatic via Let's Encrypt
- ✅ Renewed automatically
- ✅ HTTPS enforced
- ✅ HSTS headers configured

### Branch Protection

- ✅ Require PR reviews
- ✅ Require status checks
- ✅ Require branches up to date
- ✅ Require code reviews

## Team Responsibilities

### DevOps/Infrastructure

- [ ] Set up Vercel project
- [ ] Configure environment variables
- [ ] Set up custom domain
- [ ] Configure branch protection
- [ ] Monitor deployments
- [ ] Handle rollbacks

### Development Team

- [ ] Follow deployment workflow
- [ ] Test preview deployments
- [ ] Review deployment logs
- [ ] Report deployment issues
- [ ] Follow code review process

### Project Manager

- [ ] Track deployment status
- [ ] Communicate deployment schedule
- [ ] Coordinate with team
- [ ] Document deployment process

## Useful Commands

```bash
# Test build locally
cd novaRewards/frontend
npm run build

# Start production build locally
npm run start

# Check environment variables
vercel env list

# View deployment logs
vercel logs

# Promote deployment to production
vercel promote <deployment-url>

# Rollback to previous deployment
vercel rollback
```

## Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Let's Encrypt](https://letsencrypt.org/)

## Support

For deployment issues:

1. Check Vercel dashboard
2. Review GitHub Actions logs
3. Check VERCEL_SETUP.md
4. Contact DevOps team

## Changelog

### v1.0.0 (Initial Setup)

- ✅ Vercel project configuration
- ✅ Environment variables setup
- ✅ Custom domain configuration
- ✅ GitHub Actions workflows
- ✅ Branch protection rules
- ✅ Edge Network caching
- ✅ Documentation

---

**Last Updated**: March 28, 2026
**Maintained By**: DevOps Team
