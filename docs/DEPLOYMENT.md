# RAAS IN TAAL — PRODUCTION DEPLOYMENT GUIDE

**Target Framework:** Next.js 15 (Node.js 20+ runtime)  
**Hosting Platforms:** Vercel / Railway / AWS ECS / Ubuntu VPS (PM2)  
**Database:** Supabase (Cloud PostgreSQL) or persistent containerized storage.

---

## 1. Prerequisites
- **Node.js:** `v20.x` or `v22.x` (LTS recommended)
- **Package Manager:** `npm` (with `package-lock.json`)
- **Payment Provider:** Active PhonePe Merchant Account (Production Merchant ID, Salt Key, and Salt Index)
- **Email Service:** Resend API Key (`re_...`) or Brevo SMTP credentials with verified sender domain (`tickets@raasintaal.com`)
- **Database:** Supabase PostgreSQL instance (Free or Pro tier)

---

## 2. Environment Variables Configuration

Copy `.env.example` to `.env.local` (local) or configure variables in your hosting environment dashboard (Vercel / Railway / AWS):

| Variable Name | Environment | Required | Description |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_APP_URL` | All | Yes | Public URL of the app (e.g. `https://raasintaal.com`) |
| `NEXT_PUBLIC_API_BASE_URL` | Client | Optional | Custom backend origin if frontend is decoupled. Leave empty for same-origin. |
| `NEXT_PUBLIC_SUPABASE_URL` | All | Optional | Supabase project URL (`https://xyz.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client | Optional | Supabase public anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | Optional | Supabase private service role key |
| `PHONEPE_ENV` | Server | Yes | `PRODUCTION` (or `SANDBOX` for testing) |
| `PHONEPE_MERCHANT_ID` | Server | Yes | PhonePe Merchant ID |
| `PHONEPE_SALT_KEY` | Server | Yes | PhonePe Salt Key (Secret) |
| `PHONEPE_SALT_INDEX` | Server | Yes | Salt Key Index (usually `1`) |
| `PHONEPE_HOST_URL` | Server | Yes | `https://api.phonepe.com/apis/pg` (Prod) |
| `EMAIL_PROVIDER` | Server | Yes | `resend` |
| `EMAIL_API_KEY` | Server | Yes | Resend API Key (`re_...`) |
| `EMAIL_FROM_ADDRESS` | Server | Yes | Verified sender email (e.g. `passes@raasintaal.com`) |
| `EMAIL_FROM_NAME` | Server | Yes | Display name (`Raas in Taal - Chaos and Chill`) |
| `ADMIN_SECRET_KEY` | Server | Yes | 32+ character random secret for admin auth and HMAC tokens |
| `STAFF_PIN` | Server | Yes | 6-digit gate scanner PIN (default: `202618`) |
| `EVENT_MAX_ATTENDEES` | Server | Yes | Capacity limit (default: `500`) |
| `RESERVATION_EXPIRY_MINUTES`| Server | Yes | Temporary reservation timeout in minutes (`10`) |

> [!CAUTION]
> Never set `SUPABASE_SERVICE_ROLE_KEY`, `PHONEPE_SALT_KEY`, or `ADMIN_SECRET_KEY` with a `NEXT_PUBLIC_` prefix. These must remain exclusively on the server runtime.

---

## 3. Database Migration (Supabase PostgreSQL)

When connecting to Supabase:
1. Open your Supabase Project Dashboard → **SQL Editor**.
2. Run the SQL script located at:
   [supabase/migrations/20261009000000_initial_schema.sql](file:///c:/Users/DIKSHANT%20KUMAR/Desktop/raas%20in%20taal/supabase/migrations/20261009000000_initial_schema.sql)
3. This creates all tables (`orders`, `passes`, `check_ins`, `customers`), indexes, constraints, and Row-Level Security (RLS) policies.

---

## 4. Build & Deployment Steps

### Option A: Vercel (Recommended for Next.js)
1. Push repository to GitHub/GitLab.
2. In Vercel, click **Add New Project** → **Import Git Repository**.
3. Framework Preset: **Next.js**.
4. Configure all environment variables from Section 2.
5. Deploy. Vercel automatically runs `npm run build` and sets up CDN routing and serverless function routes.

### Option B: Standalone Node.js / Ubuntu VPS (PM2)
```bash
# 1. Clone & install dependencies
git clone <repo_url> /var/www/raas-in-taal
cd /var/www/raas-in-taal
npm ci

# 2. Configure environment
cp .env.example .env.local
nano .env.local

# 3. Build production bundle
npm run build

# 4. Start with PM2
pm2 start npm --name "raas-in-taal" -- start -p 3000
pm2 save
pm2 startup
```

---

## 5. Health Check & Smoke Test Procedure

After deployment, perform these verification checks:
1. **Homepage:** Access `https://your-domain.com/` — check that photography, countdown, and ticket cards load.
2. **Booking Flow:** Navigate to `/checkout?category=couple`. Verify that ticket details, pricing summary, and attendee input fields load instantly.
3. **API Health:** Run `curl https://your-domain.com/api/auth/me`. Expected output: `{"authenticated":false}` (HTTP 401).
4. **Scanner Health:** Open `/scanner` on mobile. Enter the configured `STAFF_PIN` (`202618`). Confirm the camera viewfinder initializes cleanly.
5. **Admin Access:** Open `/admin`. Enter your `ADMIN_SECRET_KEY`. Confirm that live stats, ticket counts, and attendee charts render.

---

## 6. Rollback Procedures & Common Troubleshooting

### If a deployment fails:
- **Vercel:** Navigate to Deployments → find the last successful build → click **Promote to Production** (instant zero-downtime rollback).
- **PM2 / VPS:** Run `git checkout <previous_commit> && npm run build && pm2 restart raas-in-taal`.

### Common Issues:
1. **Camera permission blocked on `/scanner`:**
   - HTML5 QR Scanner requires HTTPS. Ensure your domain has an active SSL certificate.
2. **PhonePe Checksum Failed (`X-VERIFY`):**
   - Verify that `PHONEPE_SALT_KEY` and `PHONEPE_SALT_INDEX` match exactly what is registered in the PhonePe merchant portal.
3. **Tickets not delivered via email:**
   - Verify domain SPF and DKIM records in Resend to ensure tickets do not hit customer spam filters.
