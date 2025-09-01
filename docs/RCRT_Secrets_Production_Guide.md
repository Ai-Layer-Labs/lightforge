# RCRT Secrets Service Production Guide

## Overview
RCRT's secrets service uses envelope encryption with a KEK (Key Encryption Key) to protect sensitive data at rest. This guide covers proper KEK management for production deployments.

## How Envelope Encryption Works

```
User Secret → Encrypted with DEK → Store Encrypted Secret
                     ↓
              DEK encrypted with KEK → Store Encrypted DEK
```

- **DEK (Data Encryption Key)**: Unique per secret, encrypts the actual secret value
- **KEK (Key Encryption Key)**: Master key that encrypts/decrypts DEKs
- **Benefit**: Rotating the KEK doesn't require re-encrypting all secrets

## Setting Up the KEK

### 1. Generate a Secure KEK

```bash
# Generate a cryptographically secure 32-byte key
openssl rand -base64 32

# Example output: 
# xKj3n9vP2qR8wT5yL6mN0aB4cD7eF1gH2iJ3kL4mN5o=
```

**IMPORTANT**: 
- Save this key securely - losing it means losing access to all secrets
- Never commit this to version control
- Never log or expose this key

### 2. Configure RCRT Server

#### Development
```bash
# Set directly in shell
export LOCAL_KEK_BASE64="xKj3n9vP2qR8wT5yL6mN0aB4cD7eF1gH2iJ3kL4mN5o="

# Or use .env file (add .env to .gitignore!)
echo 'LOCAL_KEK_BASE64="xKj3n9vP2qR8wT5yL6mN0aB4cD7eF1gH2iJ3kL4mN5o="' >> .env

# Start RCRT
cargo run --bin rcrt-server
```

#### Docker
```dockerfile
# Dockerfile
FROM rust:latest
# ... build steps ...

# DON'T hardcode the KEK!
# Pass it at runtime instead
```

```bash
# Run with KEK from environment
docker run -e LOCAL_KEK_BASE64="$LOCAL_KEK_BASE64" rcrt-server

# Or use Docker secrets (recommended)
echo "$LOCAL_KEK_BASE64" | docker secret create rcrt_kek -
docker service create \
  --secret rcrt_kek \
  --env LOCAL_KEK_BASE64_FILE=/run/secrets/rcrt_kek \
  rcrt-server
```

#### Docker Compose
```yaml
# docker-compose.yml
version: '3.8'

services:
  rcrt:
    image: rcrt-server
    environment:
      # Option 1: From .env file (development)
      LOCAL_KEK_BASE64: ${LOCAL_KEK_BASE64}
    
    # Option 2: Using Docker secrets (production)
    secrets:
      - rcrt_kek
    environment:
      LOCAL_KEK_BASE64_FILE: /run/secrets/rcrt_kek

secrets:
  rcrt_kek:
    external: true  # Created separately
```

#### Kubernetes
```yaml
# kek-secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: rcrt-kek
  namespace: rcrt-system
type: Opaque
data:
  # Base64 encode the already base64 KEK (double encoding for k8s)
  LOCAL_KEK_BASE64: eEtqM245dlAycVI4d1Q1eUw2bU4wYUI0Y0Q3ZUYxZ0gyaUoza0w0bU41bz0=
---
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: rcrt-server
spec:
  template:
    spec:
      containers:
      - name: rcrt
        image: rcrt-server:latest
        env:
        - name: LOCAL_KEK_BASE64
          valueFrom:
            secretKeyRef:
              name: rcrt-kek
              key: LOCAL_KEK_BASE64
```

## Production Best Practices

### 1. Use a Key Management Service (KMS)

Instead of `LOCAL_KEK_BASE64`, use a cloud KMS for better security:

#### AWS KMS
```bash
# Create a KMS key
aws kms create-key --description "RCRT KEK"

# Set in RCRT (hypothetical - would need RCRT support)
export AWS_KMS_KEY_ID="arn:aws:kms:us-east-1:123456789:key/abc-123"
export AWS_REGION="us-east-1"
```

#### Azure Key Vault
```bash
# Create key vault and key
az keyvault create --name rcrt-vault --resource-group rcrt-rg
az keyvault key create --vault-name rcrt-vault --name rcrt-kek

# Set in RCRT (hypothetical)
export AZURE_KEY_VAULT_URL="https://rcrt-vault.vault.azure.net/"
export AZURE_KEY_NAME="rcrt-kek"
```

#### HashiCorp Vault
```bash
# Store KEK in Vault
vault kv put secret/rcrt/kek value="$LOCAL_KEK_BASE64"

# Retrieve at startup
export LOCAL_KEK_BASE64=$(vault kv get -field=value secret/rcrt/kek)
```

### 2. KEK Rotation Strategy

```bash
#!/bin/bash
# kek-rotation.sh

# 1. Generate new KEK
NEW_KEK=$(openssl rand -base64 32)

# 2. Store new KEK alongside old (grace period)
export LOCAL_KEK_BASE64="$NEW_KEK"
export LOCAL_KEK_BASE64_OLD="$OLD_KEK"

# 3. Restart RCRT with both keys
# RCRT should try new key first, fall back to old

# 4. Re-encrypt all DEKs with new KEK (background job)
# This would need RCRT API support

# 5. After all secrets migrated, remove old KEK
unset LOCAL_KEK_BASE64_OLD
```

### 3. Backup and Recovery

```bash
# backup-kek.sh
#!/bin/bash

# Encrypt KEK with GPG for backup
echo "$LOCAL_KEK_BASE64" | gpg --encrypt --recipient security@company.com > kek-backup.gpg

# Split into multiple parts (Shamir's Secret Sharing)
echo "$LOCAL_KEK_BASE64" | ssss-split -t 3 -n 5 > kek-shares.txt
# Need 3 of 5 shares to reconstruct

# Store shares in different locations:
# - Share 1: AWS Secrets Manager
# - Share 2: Azure Key Vault  
# - Share 3: On-premise HSM
# - Share 4: Offline cold storage
# - Share 5: Security team vault
```

### 4. Monitoring and Alerting

```yaml
# prometheus-rules.yaml
groups:
- name: rcrt-secrets
  rules:
  - alert: KEKNotConfigured
    expr: rcrt_kek_configured == 0
    for: 1m
    annotations:
      summary: "RCRT KEK not configured"
      description: "Secrets service will not work without KEK"
  
  - alert: SecretDecryptionFailures
    expr: rate(rcrt_secret_decrypt_failures[5m]) > 0.1
    annotations:
      summary: "High secret decryption failure rate"
      description: "Possible KEK misconfiguration"
```

## Deployment Checklist

### Pre-Production
- [ ] Generate strong KEK using cryptographic randomness
- [ ] Store KEK in secure location (KMS, Vault, etc.)
- [ ] Document KEK backup and recovery procedure
- [ ] Test KEK rotation procedure
- [ ] Set up monitoring for KEK availability

### Production Deployment
- [ ] Configure KEK via secure environment variable
- [ ] Verify secrets service is working: `curl -X POST /secrets`
- [ ] Test secret creation and decryption
- [ ] Enable audit logging for secret access
- [ ] Set up alerts for decryption failures

### Post-Deployment
- [ ] Remove any temporary KEK storage
- [ ] Verify backups are encrypted and distributed
- [ ] Schedule regular KEK rotation (quarterly)
- [ ] Document who has access to KEK recovery shares

## Security Considerations

### DO:
- ✅ Use hardware security modules (HSM) when possible
- ✅ Rotate KEK regularly (at least annually)
- ✅ Use different KEKs for different environments
- ✅ Implement key escrow for recovery
- ✅ Log all KEK access (but never log the key itself)
- ✅ Use envelope encryption (DEK + KEK)

### DON'T:
- ❌ Hardcode KEK in source code
- ❌ Log or print KEK values
- ❌ Use the same KEK across environments
- ❌ Store KEK in plain text files
- ❌ Transmit KEK over unencrypted channels
- ❌ Share KEK via email or chat

## Example Production Setup Script

```bash
#!/bin/bash
# setup-rcrt-secrets.sh

set -euo pipefail

# Check if running in production
if [[ "${ENVIRONMENT}" != "production" ]]; then
  echo "ERROR: This script is for production only"
  exit 1
fi

# Retrieve KEK from secure source
echo "Retrieving KEK from vault..."
if command -v vault &> /dev/null; then
  # HashiCorp Vault
  export LOCAL_KEK_BASE64=$(vault kv get -field=kek secret/rcrt/production)
elif [[ -n "${AWS_REGION:-}" ]]; then
  # AWS Secrets Manager
  export LOCAL_KEK_BASE64=$(aws secretsmanager get-secret-value \
    --secret-id rcrt-kek-production \
    --query SecretString --output text)
elif [[ -f "/run/secrets/rcrt_kek" ]]; then
  # Docker/K8s secret
  export LOCAL_KEK_BASE64=$(cat /run/secrets/rcrt_kek)
else
  echo "ERROR: No secure KEK source available"
  exit 1
fi

# Validate KEK format
if [[ ! "$LOCAL_KEK_BASE64" =~ ^[A-Za-z0-9+/]{43}=$ ]]; then
  echo "ERROR: Invalid KEK format"
  exit 1
fi

echo "KEK configured successfully"

# Test secrets service
echo "Testing secrets service..."
TEST_RESPONSE=$(curl -s -X POST http://localhost:8081/secrets \
  -H "Content-Type: application/json" \
  -d '{"name":"test","value":"test","scope_type":"global"}' || echo "FAILED")

if [[ "$TEST_RESPONSE" == "FAILED" ]] || [[ "$TEST_RESPONSE" == *"error"* ]]; then
  echo "ERROR: Secrets service test failed"
  exit 1
fi

echo "✅ RCRT secrets service is operational"

# Clean up test secret
TEST_ID=$(echo "$TEST_RESPONSE" | jq -r .id)
curl -X DELETE "http://localhost:8081/secrets/$TEST_ID"

# Log successful setup (without exposing KEK)
echo "Production secrets service initialized at $(date -Iseconds)" >> /var/log/rcrt-setup.log
```

## Troubleshooting

### Common Issues

1. **"LOCAL_KEK_BASE64 missing" error**
   - Ensure environment variable is set
   - Check variable name spelling
   - Verify no quotes issues in .env file

2. **"Invalid KEK format" error**
   - KEK must be exactly 32 bytes, base64 encoded
   - Should be 44 characters ending with '='
   - Regenerate with: `openssl rand -base64 32`

3. **Secrets work locally but not in production**
   - Different KEK between environments
   - KEK not properly passed to container
   - Check environment variable interpolation

4. **Cannot decrypt after restart**
   - KEK was changed or lost
   - Need to restore from backup
   - Check if old KEK in logs/configs

### Recovery Procedures

```bash
# If KEK is lost but you have backups
gpg --decrypt kek-backup.gpg

# If using Shamir's shares
ssss-combine -t 3
# Enter 3 of the 5 shares

# Emergency re-encryption (if old KEK compromised)
# This would need custom tooling:
./migrate-secrets.sh --old-kek "$OLD_KEK" --new-kek "$NEW_KEK"
```

## Integration with RCRT SDK

The TypeScript SDK automatically uses the configured secrets service:

```typescript
// Secrets are encrypted at rest using the configured KEK
const vault = await client.createSecretVault(workspace, {
  API_KEY: 'secret-value'  // Encrypted with DEK, DEK encrypted with KEK
});

// Decryption happens transparently
const secrets = await client.getSecretsFromVault(vaultId, 'audit reason');
// Returns decrypted values
```

## Compliance and Auditing

For regulatory compliance (GDPR, HIPAA, PCI-DSS):

1. **Audit all KEK access**
2. **Implement key lifecycle management**
3. **Document key custody chain**
4. **Regular key rotation**
5. **Secure key destruction**

```sql
-- Example audit query
SELECT 
  timestamp,
  action,
  user_id,
  reason
FROM secret_access_log
WHERE timestamp > NOW() - INTERVAL '30 days'
ORDER BY timestamp DESC;
```

## Conclusion

Proper KEK management is critical for RCRT's secrets service. Follow these practices:
1. Never expose the KEK
2. Use KMS in production
3. Implement proper rotation
4. Maintain secure backups
5. Monitor continuously

With proper setup, RCRT provides bank-grade encryption for your secrets while maintaining the flexibility of the breadcrumb system.
