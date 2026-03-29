provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "nova-rewards"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}
