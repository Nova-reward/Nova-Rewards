terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.40"
    }
  }

  backend "s3" {
    bucket         = "nova-rewards-tf-state"
    key            = "nova-rewards/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "nova-rewards-tf-locks"
  }
}
