# n8n Automation Workflows (Phase 3)

This directory contains the 4 production-ready n8n workflows for the LiveWire real-time live event broadcast platform.

---

## Workflows Included

| File | Event Trigger | Description |
|---|---|---|
| [`01-stream-live-notify-followers.json`](./01-stream-live-notify-followers.json) | Webhook `/webhook/stream-live` | Fired when a creator goes live. Idempotently notifies all followers (in-app inbox + Expo push). |
| [`02-viewer-milestone-alert.json`](./02-viewer-milestone-alert.json) | Webhook `/webhook/viewer-milestone` | Fired when viewer milestones (2, 10, 50, 100, 500) are reached. Alerts the creator once per milestone. |
| [`03-stream-ended-highlights.json`](./03-stream-ended-highlights.json) | Webhook `/webhook/stream-ended` | Fired on stream conclusion or stale-stream timeout. Computes busiest 30s chat moments + AI recap (Claude API with rule fallback). |
| [`04-daily-digest.json`](./04-daily-digest.json) | Cron (09:00 AM) + Manual Trigger | Aggregates the top 5 broadcasts from the past 24 hours and delivers a daily digest to all platform users. |

---

## Setup & Deployment Guide

### 1. Import Workflows into n8n
1. In your n8n dashboard (n8n Cloud or self-hosted Docker), click **Workflows** → **Add Workflow** → **Import from file...**
2. Select each `.json` file from this folder.
3. Save the workflow.

---

### 2. Configure Credentials in n8n
Create the following 3 credentials in n8n (Settings → Credentials):

1. **Supabase Postgres** (`Postgres` credential type):
   - **Host:** Supabase Session Pooler host (e.g. `aws-0-<region>.pooler.supabase.com`)
   - **Port:** `5432` (or `6543`)
   - **Database:** `postgres`
   - **User:** `postgres.<project-ref>`
   - **Password:** Your Supabase DB password
   - **SSL:** `require` (check *Allow Unauthorized Certificates* if connecting through a pooler)

2. **Webhook Secret** (`Header Auth` credential type):
   - **Name:** `Webhook Secret`
   - **Header Name:** `x-webhook-secret`
   - **Value:** Your chosen secret (e.g. generated via `openssl rand -hex 24`)

3. **Anthropic API** (`Header Auth` credential type — optional for Workflow 3 AI recaps):
   - **Name:** `Anthropic API`
   - **Header Name:** `x-api-key`
   - **Value:** Your Anthropic API key (`sk-ant-...`)

---

### 3. Connect Supabase Triggers to n8n
Run the following SQL snippet in your **Supabase Dashboard SQL Editor** to point database triggers to your n8n webhook URLs:

```sql
update private.app_config 
   set value = 'https://<your-n8n-subdomain>.app.n8n.cloud' 
 where key = 'n8n_base_url';

update private.app_config 
   set value = '<YOUR_N8N_WEBHOOK_SECRET>' 
 where key = 'n8n_webhook_secret';
```

---

### 4. Activate Workflows
Toggle the **Active** switch to **ON** for all 4 workflows in n8n. Production webhook URLs (`/webhook/...`) only listen when active.

