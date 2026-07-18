// CloudWatch Log Groups for centralized logging and retention policies
resource "aws_cloudwatch_log_group" "nova_rewards_info" {
  name              = "/nova-rewards/info"
  retention_in_days = 30
}

resource "aws_cloudwatch_log_group" "nova_rewards_error" {
  name              = "/nova-rewards/error"
  retention_in_days = 90
}
