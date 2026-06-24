# AWS setup for Contentful Audit Logs

This guide walks through connecting your **existing** Contentful audit export bucket to the app. Contentful writes daily files like:

`contentful-audit-{organizationId}-20260314T040157827Z.json`

You do **not** need to make the bucket public. A small Lambda + API Gateway reads from S3 on behalf of the browser.

---

## What you need before starting

- An AWS account ([aws.amazon.com](https://aws.amazon.com))
- AWS CLI installed and configured (`aws configure`) — optional but recommended for Step 2
- Contentful Audit Logs enabled and writing to your S3 bucket
- At least one `contentful-audit-*.json` file already in the bucket

---

## Part A — S3 bucket (verify, don’t recreate)

If Contentful is already exporting audit logs, **your bucket exists**. This step is about confirming settings, not building something new.

### A1. Sign in and open S3

1. Go to [https://console.aws.amazon.com](https://console.aws.amazon.com)
2. Sign in to the account that owns the audit export bucket
3. In the top search bar, type **S3** and click **S3** (Simple Storage Service)

### A2. Find your bucket

1. You’ll see a list of buckets — look for the one Contentful writes to (your org admin or Contentful setup docs will name it)
2. Click the **bucket name** (not the checkbox)

You should land on the bucket overview with tabs: **Objects**, **Properties**, **Permissions**, etc.

### A3. Confirm audit files are present

1. Click the **Objects** tab
2. Browse folders if needed — files may be at the root or under a prefix
3. Look for names starting with `contentful-audit-` and ending in `.json`
4. Click one file → **Open** or **Download** to confirm it’s valid JSON

If you see files here, S3 is done. Move to Part B.

### A4. Confirm the bucket is private (security check)

1. Click the **Permissions** tab
2. Under **Block public access (bucket settings)**, click **Edit**
3. Ensure **all four** checkboxes are **checked** (Block all public access)
4. Save if you changed anything

Under **Bucket policy**, there should be **no** `"Principal": "*"` rule granting public read.

### A5. Note the bucket name

Copy the exact bucket name (e.g. `my-company-contentful-audit`). You’ll need it for Lambda.

**You do not need:**

- CORS on the bucket (browser never talks to S3 directly)
- A public bucket policy
- AWS access keys in the Contentful app

---

## Part B — Deploy the API (Lambda + API Gateway)

The AWS Deploy plugin’s **IaC server is not connected** in this workspace, but the repo includes a SAM template that deploys everything in one command.

### Option 1 — One-command deploy (recommended)

**Prerequisites:** [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html) and AWS CLI configured.

From the repo root:

```bash
cd aws
sam build
sam deploy --guided
```

When prompted:

| Prompt | What to enter |
|--------|----------------|
| Stack name | `contentful-audit-api` |
| AWS Region | Region for Lambda/API (e.g. `us-east-1`) — can differ from bucket region |
| S3BucketName | Your bucket name from Part A |
| S3BucketRegion | **Region where the bucket lives** (e.g. `us-east-2`) — run `aws s3api get-bucket-location --bucket YOUR-BUCKET` |
| AllowedOrigin | `https://app.contentful.com` |
| Confirm changes | `y` |
| Allow SAM CLI IAM role creation | `y` |
| Save arguments to config | `y` |

SAM creates:

- Lambda function with read-only S3 access
- HTTP API with CORS for Contentful
- IAM role (no manual policy editing)

When deploy finishes, copy the **ApiUrl** from the output:

```
Outputs
ApiUrl = https://abc123.execute-api.us-east-1.amazonaws.com
```

Set in your app `.env`:

```
VITE_AUDIT_API_URL=https://abc123.execute-api.us-east-1.amazonaws.com
```

Test:

```bash
curl "https://YOUR-API-URL/logs"
curl "https://YOUR-API-URL/logs/entries?key=contentful-audit-YOUR-FILE.json"
```

### Option 2 — Manual console deploy

Use this if you prefer clicking through the AWS Console.

#### B1. Create the Lambda function

1. Console search → **Lambda** → **Create function**
2. **Author from scratch**
3. Function name: `contentful-audit-proxy`
4. Runtime: **Node.js 20.x**
5. Architecture: **arm64**
6. Create function

#### B2. Upload the code

From repo root:

```bash
mkdir -p lambda/dist
cp lambda/handler.mjs lambda/dist/
cd lambda/dist
npm init -y
npm install @aws-sdk/client-s3
zip -r ../audit-proxy.zip .
```

In Lambda → **Code** → **Upload from** → **.zip file** → select `lambda/audit-proxy.zip`.

Set **Handler** to `handler.handler` (Runtime settings → Edit).

#### B3. Environment variables

Lambda → **Configuration** → **Environment variables** → Edit:

| Key | Value |
|-----|-------|
| `S3_BUCKET_NAME` | your bucket name |
| `S3_BUCKET_REGION` | AWS region of the bucket (e.g. `us-east-2`) — **must match** where Contentful writes |
| `ALLOWED_ORIGIN` | `https://app.contentful.com` |

#### B4. IAM permissions for S3 read

Lambda → **Configuration** → **Permissions** → click the **execution role** name.

In IAM → **Add permissions** → **Create inline policy** → JSON:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["s3:ListBucket", "s3:GetObject"],
    "Resource": [
      "arn:aws:s3:::YOUR-BUCKET-NAME",
      "arn:aws:s3:::YOUR-BUCKET-NAME/*"
    ]
  }]
}
```

Replace `YOUR-BUCKET-NAME`, review, name it `audit-log-s3-read`, create.

#### B5. Create HTTP API

1. Console search → **API Gateway** → **Create API**
2. Choose **HTTP API** → Build
3. **Integrations** → Add integration → **Lambda** → select `contentful-audit-proxy`
4. **Routes** — add:
   - `GET /logs`
   - `GET /logs/entries`
5. **CORS** → Configure:
   - Access-Control-Allow-Origin: `https://app.contentful.com`
   - Methods: GET, OPTIONS
   - Headers: Content-Type
6. Create and note the **Invoke URL**

#### B6. Connect routes to Lambda

For each route, ensure the integration points to your Lambda. API Gateway usually adds `lambda:InvokeFunction` permission automatically.

---

## Part C — Connect the Contentful app

1. Copy `.env.example` → `.env` if you haven’t already
2. Add:

   ```
   VITE_AUDIT_API_URL=https://YOUR-API-URL
   ```

3. Restart dev server: `npm start`
4. In the app, open the **Audit Log** tab
5. You should see a date dropdown and events from yesterday’s file (or the newest export)

For production bundle upload, set `VITE_AUDIT_API_URL` **before** `npm run build` / `npm run upload`.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Empty file list | Wrong bucket name or no `contentful-audit-*` files | Check Lambda env var and S3 Objects tab |
| 403 from API | Missing IAM policy | Verify `ListBucket` on bucket ARN and `GetObject` on `/*` |
| CORS error in browser | API Gateway CORS or wrong origin | Match `https://app.contentful.com`; for local dev add `http://localhost:3013` |
| 502 "must be addressed using the specified endpoint" | Lambda S3 client region ≠ bucket region | Set `S3BucketRegion` to the bucket's actual region |
| 502 from Lambda | Missing `@aws-sdk/client-s3` in zip | Rebuild zip per B2 |
| Wrong default date | Filename date parsing | Handler supports `contentful-audit-*-YYYYMMDD` format |

---

## How the AWS Deploy plugin helps

The plugin provides:

- **Documentation search** — used here for S3 Block Public Access and serverless patterns
- **Serverless skill** — Lambda + API Gateway best practices
- **SAM/CDK generation** — `aws/template.yaml` in this repo
- **Pricing / architecture** — ask in chat for cost estimates

The **IaC MCP server** (`awsiac`) is currently errored in this workspace. If you enable it in Cursor Settings → MCP, future deploys can be driven interactively. Until then, use `sam deploy` above or the manual console steps.

---

## Architecture

```
Contentful (audit export) ──writes──► S3 bucket (private)
                                           ▲
                                           │ IAM read
                                           │
Browser (Contentful app) ──fetch──► API Gateway ──► Lambda
```
