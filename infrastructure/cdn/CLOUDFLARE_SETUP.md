# Cloudflare CDN Configuration for Nova Rewards

## Overview
- Cloudflare provides DDoS protection, caching, and edge computing capabilities
- Automatic certificate issuance via Cloudflare SSL/TLS
- Rate limiting and WAF protection
- Analytics and performance monitoring

## Configure using Terraform

See: terraform/cdn.tf

## Key Settings:

### Cache Rules:
- HTML/CSS/JS: Cache 30 days
- Images (PNG/JPG/SVG): Cache 365 days
- API responses: No cache (bypass cache for /api/*)
- Staging domain: No cache

### Security Features:
- DDoS Protection: Automatic
- WAF (Web Application Firewall): Enabled
- Rate Limiting: 10 requests per 10 seconds per IP
- Security Headers: Enabled (HSTS, X-Content-Type-Options, etc.)
- TLS Version: Minimum TLS 1.2

### Performance:
- Minification: Enabled (JS, CSS, HTML)
- HTTP/2: Enabled
- Brotli Compression: Enabled
- Email Obfuscation: Enabled

### Staging Environment:
- Always bypass cache for staging.nova-rewards.com
- Enable page rules for testing
- Monitor performance metrics

### Production Environment:
- Full caching enabled
- 3 day record cache
- Origin pull cache expiration: 1 week

## DNS Configuration:
- nova-rewards.com CNAME → nova-rewards.herokuapp.com (or your origin)
- staging.nova-rewards.com CNAME → staging-nova-rewards.herokuapp.com
- All traffic proxied through Cloudflare (orange cloud)

## Monitoring:
- Enable Cloudflare Analytics
- Set up log streaming to Datadog
- Configure alerts for DDoS events
- Monitor cache hit rates and performance
