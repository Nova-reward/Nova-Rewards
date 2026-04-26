#!/bin/bash

# Secret Rotation Script
# Rotates database credentials, API keys, and other secrets

set -e

VAULT_ADDR=${VAULT_ADDR:-"http://vault:8200"}
VAULT_TOKEN=${VAULT_TOKEN}
ROTATION_INTERVAL=${ROTATION_INTERVAL:-86400}  # Default 24 hours

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

# Rotate database credentials
rotate_db_credentials() {
    local db_path=$1
    
    log "Rotating database credentials for: $db_path"
    
    vault read -format=json "$db_path" | jq '.data' > /tmp/old_creds.json
    
    # Rotate by requesting new credentials
    vault read -format=json "database/creds/${db_path##*/}" > /tmp/new_creds.json
    
    log "Database credentials rotated successfully"
}

# Rotate API keys
rotate_api_keys() {
    local secret_path=$1
    
    log "Rotating API keys for: $secret_path"
    
    # Get current secret
    current=$(vault kv get -format=json "$secret_path")
    
    # Generate new API key (example - adjust based on your API)
    new_key=$(openssl rand -hex 32)
    
    # Update secret
    vault kv put "$secret_path" api_key="$new_key" \
        rotated_at="$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
        rotation_version="$(echo $current | jq -r '.data.data.rotation_version | tonumber + 1')"
    
    log "API keys rotated successfully"
}

# Rotate environment-specific secrets
rotate_env_secrets() {
    local env=$1
    local secrets_path="secret/data/$env"
    
    log "Rotating secrets for environment: $env"
    
    # Get list of all secrets for this environment
    secrets=$(vault kv list -format=json "$secrets_path" 2>/dev/null | jq -r '.data.keys[]' || echo "")
    
    if [ -z "$secrets" ]; then
        log "No secrets found for environment: $env"
        return
    fi
    
    for secret in $secrets; do
        if [[ "$secret" == *".next-rotate" ]]; then
            next_rotation=$(vault kv get -field=next_rotate "$secrets_path/$secret" 2>/dev/null || echo "")
            
            if [[ -z "$next_rotation" ]] || [[ "$(date +%s)" -ge "$(date -d "$next_rotation" +%s)" ]]; then
                log "Rotating secret: $secret"
                
                new_value=$(openssl rand -base64 32)
                next_rotate=$(date -d "+30 days" -u +'%Y-%m-%dT%H:%M:%SZ')
                
                vault kv put "$secrets_path/$secret" \
                    value="$new_value" \
                    rotated_at="$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
                    next_rotate="$next_rotate"
                
                log "Secret rotated: $secret"
            fi
        fi
    done
}

# Main rotation function
main() {
    log "Starting secret rotation service"
    log "Vault Address: $VAULT_ADDR"
    log "Rotation Interval: $ROTATION_INTERVAL seconds"
    log "Poll Interval: 300 seconds"
    
    # Set up Vault
    export VAULT_ADDR
    export VAULT_TOKEN
    
    while true; do
        log "Beginning rotation cycle..."
        
        {
            # Rotate database credentials
            for db_path in "database/creds/postgres" "database/creds/mysql"; do
                rotate_db_credentials "$db_path" || log "Failed to rotate $db_path"
            done
            
            # Rotate API keys
            for api_key_path in "secret/api-keys/sendgrid" "secret/api-keys/stripe"; do
                rotate_api_keys "$api_key_path" || log "Failed to rotate $api_key_path"
            done
            
            # Rotate environment-specific secrets
            for env in "staging" "production"; do
                rotate_env_secrets "$env" || log "Failed to rotate secrets for $env"
            done
            
            log "Rotation cycle completed successfully"
        } || {
            log "Rotation cycle failed with exit code $?"
        }
        
        log "Next rotation in $ROTATION_INTERVAL seconds"
        sleep "$ROTATION_INTERVAL"
    done
}

main "$@"
