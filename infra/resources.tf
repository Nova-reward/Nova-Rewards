# Pull sensitive values stored in Secrets Manager.
# Store a JSON secret at var.app_secret_name with keys:
#   db_password, db_username, redis_auth_token
data "aws_secretsmanager_secret_version" "app" {
  secret_id = var.app_secret_name
}

locals {
  app_secrets = jsondecode(data.aws_secretsmanager_secret_version.app.secret_string)
}

module "vpc" {
  source = "./modules/vpc"

  app_name           = var.app_name
  environment        = var.environment
  vpc_cidr           = var.vpc_cidr
  availability_zones = var.availability_zones
}

module "iam" {
  source = "./modules/iam"

  app_name    = var.app_name
  environment = var.environment
}

module "rds" {
  source = "./modules/rds"

  app_name           = var.app_name
  environment        = var.environment
  subnet_ids         = module.vpc.private_subnet_ids
  vpc_id             = module.vpc.vpc_id
  db_name            = var.db_name
  db_instance_class  = var.db_instance_class
  db_username        = local.app_secrets["db_username"]
  db_password        = local.app_secrets["db_password"]
  ec2_sg_id          = module.ec2.ec2_sg_id
}

module "elasticache" {
  source = "./modules/elasticache"

  app_name        = var.app_name
  environment     = var.environment
  subnet_ids      = module.vpc.private_subnet_ids
  vpc_id          = module.vpc.vpc_id
  node_type       = var.redis_node_type
  auth_token      = local.app_secrets["redis_auth_token"]
  ec2_sg_id       = module.ec2.ec2_sg_id
}

module "ec2" {
  source = "./modules/ec2"

  app_name            = var.app_name
  environment         = var.environment
  vpc_id              = module.vpc.vpc_id
  public_subnet_ids   = module.vpc.public_subnet_ids
  private_subnet_ids  = module.vpc.private_subnet_ids
  instance_type       = var.instance_type
  asg_min             = var.asg_min
  asg_max             = var.asg_max
  asg_desired         = var.asg_desired
  app_port            = var.app_port
  certificate_arn     = var.certificate_arn
  instance_profile    = module.iam.instance_profile_name
  rds_endpoint        = module.rds.endpoint
  redis_endpoint      = module.elasticache.endpoint
  app_secret_name     = var.app_secret_name
}
