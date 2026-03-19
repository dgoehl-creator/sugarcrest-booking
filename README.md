# SugarCrest Booking System

Premium vacation rental booking for **SugarCrest Lakehouse** on Sugar Lake, Minnesota.

## Pages

| Page | URL | Description |
|------|-----|-------------|
| Landing | `/` | Public property page + availability calendar |
| Booking | `/booking.html` | Booking form + Stripe payment |
| Family | `/family.html` | **Private** — friends & family booking ($500 flat) |
| Confirmation | `/confirmation.html` | Post-payment success page |
| Admin | `/admin.html` | Password-protected dashboard |

## Two-Track Booking System

**Public Track** (`/booking.html`)
- Rate: $1,500/night
- Min stay: 3 nights off-season, 5 nights Memorial Day–Labor Day
- Full payment at booking via Stripe
- Calendar shows only publicly available dates

**Friends & Family Track** (`/family.html`)
- Rate: $500 flat (any length stay)
- Only shows dates Dave has pre-allocated in admin
- Family-allocated dates are **hidden** from the public calendar
- Not linked publicly — share the URL privately

## Deploy to Netlify

### Step 1: Create the repo
```bash
cd /Users/max/.openclaw/workspace/sugarcrest
git init
git add .
git commit -m "Initial SugarCrest booking system"
git remote add origin https://github.com/dgoehl-creator/sugarcrest-booking.git
git push -u origin main
```

### Step 2: Connect to Netlify
1. Go to [app.netlify.com](https://app.netlify.com)
2. **Add new site → Import from Git → GitHub**
3. Select repo: `dgoehl-creator/sugarcrest-booking`
4. Build settings:
   - Publish directory: `.` (dot = root)
   - Functions directory: `api`
   - Build command: *(leave blank)*
5. Click **Deploy site**

### Step 3: Set environment variables in Netlify
Go to **Site Settings → Environment Variables** and add:

| Key | Value |
|-----|-------|
| `STRIPE_SECRET_KEY` | `sk_live_51D7n2gB...` |
| `ADMIN_PASSWORD` | `sugarcrest2026!` |
| `SMTP_HOST` | `127.0.0.1` |
| `SMTP_PORT` | `1025` |
| `SMTP_USER` | `maxdev1968@proton.me` |
| `SMTP_PASS` | `UH0H2A0Hzq21584dNp-3zA` |
| `OWNER_EMAIL` | `dgoehl@gmail.com` |

> ⚠️ **SMTP Note:** Proton Bridge runs on your local machine. For production email on Netlify (serverless), you'll need an SMTP relay like [Mailgun](https://mailgun.com), [Resend](https://resend.com), or [SendGrid](https://sendgrid.com). Resend has a free tier and is very easy to set up. Update `save-booking.js` SMTP config accordingly.

### Step 4: Custom domain
In Netlify → Domain Management → Add custom domain: `sugarcrest.com`

## Squarespace Embedding

The booking pages are iframe-safe. To embed on Squarespace:
1. Add an **Embed Block** or **Code Block** to your Squarespace page
2. Use: `<iframe src="https://your-netlify-url.netlify.app/booking.html" width="100%" height="900px" frameborder="0" style="border:none;"></iframe>`
3. Navigation is hidden automatically when embedded

## Admin Dashboard

URL: `/admin.html`  
Password: `sugarcrest2026!`

Features:
- **Dashboard**: Stats overview, upcoming bookings
- **Public Bookings**: All paid bookings, mark returning guests
- **F&F Bookings**: Family/friends bookings (purple-coded, separate table)
- **Family Allocations**: Add/remove date windows available on `/family.html`
- **Blocked Dates**: Block dates for personal use (hidden from public calendar)

## Legal Agreement

- Version: `v1.0` (placeholder text — replace before going live)
- Acceptance recorded: timestamp + guest name + IP address + version
- Stored in: Stripe PaymentIntent metadata + Netlify Blobs booking record
- Emailed to: guest (with full agreement text) + owner (BCC on every booking)

## Data Storage

Uses **Netlify Blobs** (free, built-in key-value store):
- `booking/{CONF-NUMBER}` — public booking records
- `booking-family/{CONF-NUMBER}` — F&F booking records
- `index/public` — running index for admin dashboard
- `index/family` — running F&F index
- `family/allocations` — Dave's pre-allocated family windows
- `admin/blocked-dates` — manually blocked date ranges

## Files

```
sugarcrest/
├── index.html          ← Public landing page
├── booking.html        ← Public booking form + Stripe
├── family.html         ← Private F&F booking page
├── confirmation.html   ← Post-payment confirmation
├── admin.html          ← Admin dashboard
├── css/styles.css      ← All styles
├── js/
│   ├── calendar.js     ← Availability calendar + shared helpers
│   ├── booking.js      ← Stripe integration + legal agreement modal
│   └── admin.js        ← Admin dashboard logic
├── api/
│   ├── create-payment-intent.js  ← Stripe PaymentIntent creation
│   ├── save-booking.js           ← Save booking + send emails
│   ├── get-bookings.js           ← Fetch bookings / availability
│   └── admin-actions.js          ← Admin write operations
├── netlify.toml        ← Netlify config
├── package.json        ← Dependencies
└── README.md           ← This file
```
