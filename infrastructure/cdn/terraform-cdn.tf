# Terraform configuration for CDN setup with CloudFront and Cloudflare

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

# ==================== CloudFront Distribution ====================

resource "aws_cloudfront_distribution" "nova_rewards_cdn" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "Nova Rewards CDN"
  default_root_object = "index.html"
  http_version        = "http2and3"

  origin {
    domain_name = var.origin_domain
    origin_id   = "nova-rewards-origin"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    allowed_methods  = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "nova-rewards-origin"

    forwarded_values {
      query_string = true
      headers      = ["*"]

      cookies {
        forward = "all"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400

    # Enable compression
    compress = true
  }

  # Static assets caching (1 year)
  ordered_cache_behavior {
    path_pattern     = "/static/*"
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "nova-rewards-origin"

    forwarded_values {
      query_string = false

      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 31536000  # 1 year
    max_ttl                = 31536000

    compress = true
  }

  # API endpoints - no cache
  ordered_cache_behavior {
    path_pattern     = "/api/*"
    allowed_methods  = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "nova-rewards-origin"

    forwarded_values {
      query_string = true
      headers      = ["*"]

      cookies {
        forward = "all"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 0
    max_ttl                = 0
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = var.use_cloudflare_only ? false : true
    acm_certificate_arn            = var.use_cloudflare_only ? null : var.acm_certificate_arn
    ssl_support_method             = var.use_cloudflare_only ? null : "sni-only"
    minimum_protocol_version       = var.use_cloudflare_only ? null : "TLSv1.2_2021"
  }

  custom_error_response {
    error_code            = 404
    error_caching_min_ttl = 300
    response_code         = 200
    response_page_path    = "/index.html"
  }

  custom_error_response {
    error_code            = 403
    error_caching_min_ttl = 300
    response_code         = 200
    response_page_path    = "/index.html"
  }

  tags = {
    Name        = "nova-rewards-cdn"
    Environment = var.environment
  }
}

# ==================== Cloudflare Configuration ====================

resource "cloudflare_zone" "nova_rewards" {
  account_id = var.cloudflare_account_id
  zone       = var.domain_name
  plan       = "pro"

  depends_on = [aws_cloudfront_distribution.nova_rewards_cdn]
}

resource "cloudflare_record" "apex" {
  zone_id = cloudflare_zone.nova_rewards.id
  name    = "@"
  type    = "CNAME"
  value   = aws_cloudfront_distribution.nova_rewards_cdn.domain_name
  proxied = true
  ttl     = 1
}

resource "cloudflare_record" "www" {
  zone_id = cloudflare_zone.nova_rewards.id
  name    = "www"
  type    = "CNAME"
  value   = aws_cloudfront_distribution.nova_rewards_cdn.domain_name
  proxied = true
  ttl     = 1
}

# ==================== Cache Rules ====================

resource "cloudflare_cache_rules" "static_assets" {
  zone_id = cloudflare_zone.nova_rewards.id

  rules {
    description = "Cache static assets for 1 year"
    action      = "set_cache_settings"
    expression  = "(cf.mime_type matches \"image/.*\" or cf.mime_type matches \".*font.*\") and (cf.path contains \"/static\" or cf.path contains \"/assets\")"

    action_parameters {
      cache              = true
      respect_server_ttl = true
      min_ttl            = 31536000
      max_ttl            = 31536000
    }

    position = 1
  }
}

resource "cloudflare_cache_rules" "api_no_cache" {
  zone_id = cloudflare_zone.nova_rewards.id

  rules {
    description = "Bypass cache for API endpoints"
    action      = "set_cache_settings"
    expression  = "cf.path contains \"/api\""

    action_parameters {
      cache = false
    }

    position = 2
  }
}

# ==================== WAF Rules ====================

resource "cloudflare_waf_rule" "owasp_crs" {
  zone_id  = cloudflare_zone.nova_rewards.id
  group_id = "62d9e6f34acf41efa64ba159"  # OWASP CRS
  mode     = "challenge"
}

# ==================== Rate Limiting ====================

resource "cloudflare_rate_limit" "api_rate_limit" {
  zone_id = cloudflare_zone.nova_rewards.id

  disabled    = false
  description = "Rate limit API endpoints"
  match {
    request {
      url {
        path {
          matches = "/api/*"
        }
      }
    }
  }
  threshold = 100
  period    = 10
  action {
    mode    = "challenge"
    timeout = 86400
  }
}

# ==================== Security Headers ====================

resource "cloudflare_page_rules" "security_headers" {
  zone_id = cloudflare_zone.nova_rewards.id

  rules {
    targets = ["*nova-rewards.com/*"]
    actions = [
      {
        id    = "security_header"
        value = "max-age=31536000; includeSubDomains; preload"
      }
    ]
    priority = 1
  }
}

# ==================== Outputs ====================

output "cloudfront_domain_name" {
  value       = aws_cloudfront_distribution.nova_rewards_cdn.domain_name
  description = "CloudFront distribution domain name"
}

output "cloudfront_distribution_id" {
  value       = aws_cloudfront_distribution.nova_rewards_cdn.id
  description = "CloudFront distribution ID"
}

output "cloudflare_zone_id" {
  value       = cloudflare_zone.nova_rewards.id
  description = "Cloudflare zone ID"
}

output "cloudflare_nameservers" {
  value       = cloudflare_zone.nova_rewards.name_servers
  description = "Cloudflare nameservers"
}
