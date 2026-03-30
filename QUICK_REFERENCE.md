# Nova-Rewards Vercel Deployment - Quick Reference

## One-Time Setup

```bash
# 1. Run setup script
bash scripts/setup-vercel.sh

# 2. Add GitHub secrets
# Go to: GitHub → Settings → Secrets and variables → Actions
# Add: VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID

# 3. Configure branch protection
# Go to: GitHub → Settings → Branches
# Add rule for 'main' with required status checks
```

## Daily Workflow

```bash
# Create feature branch
git checkout -b feature/my-feature

# Make changes
# Test locally
cd novaRewards/frontend
npm run dev

# Commit and push
git add .
git commit -m "feat: description"
git push origin feature/my-feature

# Create PR on GitHub
# → Vercel Preview Deployment triggered
# → Test preview URL
# → Get code review
# → Merge PR
# → Vercel Production Deployment triggered
```

## Environment Variables

### Preview (Testnet)
```
NEXT_PUBLIC_API_URL=https://api-preview.nova-rewards.xyz
NEXT_PUBLIC_HORIZON_URL=https://horizon-testnet.stellar.org
NEXT_PUBLIC_STELLAR_NETWORK=testnet
```

### Production (Mainnet)
```
NEXT_PUBLIC_API_URL=https://api.nova-rewards.xyz
NEXT_PUBLIC_HORIZON_URL=https://horizon.stellar.org
NEXT_PUBLIC_STELLAR_NETWORK=public
```

## Useful Links

| Task | Link |
|------|------|
| Vercel Dashboard | https://vercel.com/dashboard |
| GitHub Actions | https://github.com/nova-rewards/actions |
| Vercel Tokens | https://vercel.com/account/tokens |
| Domain Settings | https://vercel.com/dashboard/[project]/settings/domains |
| Environment Variables | https://vercel.com/dashboard/[project]/settings/environment-variables |

## Status Checks

| Check | Trigger | Required |
|-------|---------|----------|
| CI | Push/PR | ✅ Yes |
| Frontend Build | Push/PR | ✅ Yes |
| Vercel Preview | PR only | ✅ Yes |
| Vercel Production | Push to main | ℹ️ Info |

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Build fails | Check Vercel logs, verify env vars |
| Preview URL 404 | Wait for deployment, check status |
| Domain not resolving | Check DNS, wait 48h for propagation |
| Cache not working | Clear browser cache, hard refresh |
| Deployment stuck | Check GitHub Actions, retry from Vercel |

## Rollback

```bash
# 1. Go to Vercel Dashboard → Deployments
# 2. Find previous stable deployment
# 3. Click "Promote to Production"
# 4. Verify rollback completed
```

## Performance Targets

| Metric | Target |
|--------|--------|
| Build Time | < 2 minutes |
| First Contentful Paint | < 100ms |
| Bundle Size (gzipped) | < 200KB |
| Lighthouse Score | > 90 |

## Key Files

| File | Purpose |
|------|---------|
| `vercel.json` | Vercel configuration & caching |
| `.vercelignore` | Files to ignore in deployment |
| `.github/workflows/vercel-preview.yml` | PR deployment workflow |
| `.github/workflows/vercel-production.yml` | Production deployment workflow |
| `VERCEL_SETUP.md` | Detailed setup guide |
| `DEPLOYMENT_GUIDE.md` | Complete deployment guide |
| `DEPLOYMENT_CHECKLIST.md` | Pre-deployment checklist |

## Commands

```bash
# Test build locally
npm run build

# Start production build
npm run start

# View Vercel logs
vercel logs

# List environment variables
vercel env list

# Promote deployment
vercel promote <url>

# Rollback deployment
vercel rollback
```

## Support

- 📖 Read: VERCEL_SETUP.md
- 📋 Check: DEPLOYMENT_CHECKLIST.md
- 🚀 Follow: DEPLOYMENT_GUIDE.md
- 💬 Ask: DevOps team

---

**Last Updated**: March 28, 2026
