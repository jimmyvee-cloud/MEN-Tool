# MEN-Tool AWS CDK (Python)

**VPS / self-hosted staging:** see [STAGING_VPS.md](./STAGING_VPS.md) (reverse proxy, env vars, DynamoDB, frontend build).

---

## Bootstrap (once per account/region)

```bash
cd infra
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cdk bootstrap aws://ACCOUNT/REGION
```

## Deploy

```bash
cdk deploy MenToolStack
```

After deploy:

1. Set a strong JWT secret in SSM (prefer `SecureString`):

   `aws ssm put-parameter --name /men-tool/mentoolstack/jwt_secret --value "$(openssl rand -base64 48)" --type SecureString --overwrite`

2. Point `DYNAMODB_TABLE_NAME` at the stack output table name; omit `DYNAMODB_ENDPOINT_URL` in production.

3. Build and push the API image from [`../backend/Dockerfile`](../backend/Dockerfile) to ECR, then run on Fargate behind an ALB (HTTPS). Grant the task role read/write on the DynamoDB table and `ssm:GetParameter` on the JWT path.

4. Host the PWA on S3 + CloudFront; set `VITE_API_BASE_URL` to the public API URL at build time.
