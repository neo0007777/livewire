# LiveWire Backend (Supabase)

This directory contains the database schema, security policies, RPC functions, and Edge Functions powering the LiveWire broadcasting platform.

---

## Architecture Overview

- **PostgreSQL Database**: Hosts user profiles, stream sessions, realtime chat, follower graph, and in-app notifications.
- **Row Level Security (RLS)**: Strictly isolates user records and validates role permissions on all database tables.
- **RPC Functions**:
  - `start_stream(title)`: Automatically provisions a unique room name and transitions creator to active live status.
  - `end_stream(stream_id)`: Atomically concludes the broadcast, resets viewer count, and triggers automated highlights generation.
  - `generate_stream_highlights(stream_id)`: Aggregates chat volume into 30-second windows and generates post-event analytics.
  - `toggle_follow(creator_id)`: Manages follow relationships and dispatches activity notifications.
  - `report_viewer_count(stream_id, count)`: Heartbeat function recording peak viewer presence.
- **Edge Function (`livekit-token`)**: Issues secure LiveKit SFU access tokens with identity verification.

---

## Setup & Deployment Guide

### 1. Linking Supabase Project
From the repository root:
```bash
npx supabase link --project-ref <YOUR_PROJECT_REF>
```

### 2. Applying Database Migrations
Deploy all migration files (`/backend/supabase/migrations/`):
```bash
npx supabase db push
```

### 3. Deploying Edge Function
Deploy the `livekit-token` Edge Function:
```bash
npx supabase functions deploy livekit-token --no-verify-jwt
```

Set the required environment secrets for the function:
```bash
npx supabase secrets set LIVEKIT_API_KEY="<YOUR_LIVEKIT_API_KEY>"
npx supabase secrets set LIVEKIT_API_SECRET="<YOUR_LIVEKIT_API_SECRET>"
```

### 4. Configuring Application Settings (`private.app_config`)
Run the following SQL snippet in the Supabase Dashboard SQL Editor to connect automated database webhooks with n8n:
```sql
update private.app_config 
   set value = 'https://<your-n8n-instance>.app.n8n.cloud' 
 where key = 'n8n_base_url';

update private.app_config 
   set value = '<YOUR_N8N_WEBHOOK_SECRET>' 
 where key = 'n8n_webhook_secret';
```

