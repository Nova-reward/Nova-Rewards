storage "file" {
  path = "/vault/data"
}

listener "tcp" {
  address       = "0.0.0.0:8200"
  tls_cert_file = "/vault/config/certs/vault.crt"
  tls_key_file  = "/vault/config/certs/vault.key"
}

api_addr = "http://0.0.0.0:8200"
cluster_addr = "https://0.0.0.0:8201"
ui = true

seal "transit" {
  address            = "http://vault:8200"
  disable_renewal    = "false"
  key_name           = "autounseal"
  mount_path         = "transit/"
  tls_skip_verify    = "true"
}

default_lease_duration = "168h"
max_lease_duration = "720h"

log_level = "info"
