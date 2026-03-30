# Admin policy - full access
path "*" {
  capabilities = ["create", "read", "update", "delete", "list", "sudo"]
}

---

# Application policy - read and list only
path "secret/data/*" {
  capabilities = ["read", "list"]
}

path "cubbyhole/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

path "auth/token/renew-self" {
  capabilities = ["update"]
}

---

# Database policy - manage database credentials
path "database/config/*" {
  capabilities = ["read", "list"]
}

path "database/creds/*" {
  capabilities = ["read"]
}

path "database/static-creds/*" {
  capabilities = ["read"]
}

---

# PKI policy - manage certificates
path "pki/issue/*" {
  capabilities = ["create", "update"]
}

path "pki/certs" {
  capabilities = ["list"]
}

path "pki_int/issue/*" {
  capabilities = ["create", "update"]
}

---

# AWS policy - manage AWS credentials
path "aws/creds/*" {
  capabilities = ["read"]
}

path "aws/config/*" {
  capabilities = ["read"]
}

---

# Secret rotation policy
path "secret/data/*" {
  capabilities = ["read", "update", "list"]
}

path "secret/metadata/*" {
  capabilities = ["read", "list", "delete"]
}

path "auth/token/renew-self" {
  capabilities = ["update"]
}

path "sys/leases/renew" {
  capabilities = ["update"]
}
