/**
 * Netlify Function: save-booking
 * Saves confirmed booking to Netlify Blobs + sends confirmation email via Proton SMTP.
 *
 * Storage strategy:
 *   - Netlify Blobs (key: booking/{confNumber}) for all public bookings
 *   - Netlify Blobs (key: booking-family/{confNumber}) for F&F bookings
 *   - Netlify Blobs (key: index/all) — running index of booking keys for fast listing
 *
 * Email: Sends confirmation + full agreement copy via nodemailer → Proton Bridge SMTP
 */

const { getStore }  = require('@netlify/blobs');
const nodemailer    = require('nodemailer');
const { v4: uuid }  = require('uuid');

const AGREEMENT_VER = 'v1.0';

/* ── SMTP config — all values from Netlify environment variables ── */
const SMTP_CONFIG = {
  host:   process.env.SMTP_HOST || 'smtp.mailgun.org',
  port:   parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: { rejectUnauthorized: false }
};

const OWNER_EMAIL = process.env.OWNER_EMAIL || 'dgoehl@gmail.com';
const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  if (event.httpMethod !== 'POST')    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };

  let booking;
  try {
    booking = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  // Capture IP for agreement log
  const clientIp = event.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || event.headers['x-real-ip']
    || 'unknown';

  // Enrich agreement record
  if (booking.agreement) {
    booking.agreement.ipAddress = clientIp;
  } else {
    booking.agreement = { version: AGREEMENT_VER, acceptedAt: booking.createdAt, ipAddress: clientIp };
  }

  const bookingId  = uuid();
  const storeKey   = booking.type === 'family'
    ? `booking-family/${booking.confirmationNumber}`
    : `booking/${booking.confirmationNumber}`;

  try {
    /* ── 1. Save to Netlify Blobs ── */
    const store = getStore({ name: 'sugarcrest-bookings', consistency: 'strong' });

    const record = { ...booking, bookingId, savedAt: new Date().toISOString() };
    await store.setJSON(storeKey, record);

    // Update running index
    try {
      const indexKey = booking.type === 'family' ? 'index/family' : 'index/public';
      const existing = await store.get(indexKey, { type: 'json' }).catch(() => []);
      const index = Array.isArray(existing) ? existing : [];
      index.unshift({
        key:       storeKey,
        conf:      booking.confirmationNumber,
        guest:     booking.guestName,
        checkIn:   booking.checkIn,
        checkOut:  booking.checkOut,
        amount:    booking.amountPaid,
        createdAt: record.savedAt,
        type:      booking.type,
      });
      await store.setJSON(indexKey, index.slice(0, 500)); // keep last 500
    } catch (indexErr) {
      console.warn('Index update failed (non-fatal):', indexErr.message);
    }

  } catch (blobErr) {
    console.error('[save-booking] Blob save failed:', blobErr.message);
    // Don't fail the whole request — payment already succeeded
    // We'll still send the email
  }

  /* ── 2. Send confirmation email to guest ── */
  try {
    await sendConfirmationEmail(booking, clientIp);
  } catch (emailErr) {
    console.error('[save-booking] Email failed (non-fatal):', emailErr.message);
    // Non-fatal — booking is saved, don't error out
  }

  /* ── 3. Notify owner ── */
  try {
    await sendOwnerNotification(booking);
  } catch (ownerErr) {
    console.warn('[save-booking] Owner notification failed (non-fatal):', ownerErr.message);
  }

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({ success: true, bookingId })
  };
};

/* ════════════════════════════════════════════════
   CONFIRMATION EMAIL (guest)
   ════════════════════════════════════════════════ */
async function sendConfirmationEmail(booking, clientIp) {
  const transporter = nodemailer.createTransport(SMTP_CONFIG);

  const isFamily   = booking.type === 'family';
  const guestEmail = booking.guestEmail;
  if (!guestEmail) return;

  const agreementDate = booking.agreement?.acceptedAt
    ? new Date(booking.agreement.acceptedAt).toLocaleString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
      })
    : new Date().toLocaleString('en-US');

  const subject = isFamily
    ? `SugarCrest Family Booking Confirmed — ${booking.confirmationNumber}`
    : `SugarCrest Booking Confirmed + Your Rental Agreement — ${booking.confirmationNumber}`;

  const formatMoney = (n) => `$${Number(n).toLocaleString('en-US')}`;
  const formatDateNice = (str) => {
    if (!str) return '—';
    const [y,m,d] = str.split('-').map(Number);
    return new Date(y, m-1, d).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${subject}</title>
<style>
  body { font-family: -apple-system, 'Inter', Arial, sans-serif; background: #f5f4f2; margin: 0; padding: 0; color: #2d2d2d; }
  .wrap { max-width: 620px; margin: 32px auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,.08); }
  .header { background: ${isFamily ? 'linear-gradient(135deg,#2d1b69,#6b33c4)' : 'linear-gradient(135deg,#0e3a45,#1a5c6b)'}; padding: 40px 40px 32px; text-align: center; }
  .header h1 { color: #fff; font-size: 1.6rem; margin: 0 0 8px; }
  .header p  { color: rgba(255,255,255,.75); font-size: .9rem; margin: 0; }
  .conf-badge { display: inline-block; background: rgba(255,255,255,.15); border: 1px solid rgba(255,255,255,.3); color: #fff; padding: 6px 18px; border-radius: 40px; font-size: .8rem; font-weight: 700; letter-spacing: .05em; margin-bottom: 16px; }
  .body  { padding: 36px 40px; }
  .greeting { font-size: 1.05rem; margin-bottom: 24px; }
  .detail-box { background: #f8f6f3; border-radius: 12px; padding: 24px; margin-bottom: 24px; }
  .detail-row { display: flex; justify-content: space-between; padding: 9px 0; border-bottom: 1px solid #e8e4df; font-size: .92rem; }
  .detail-row:last-child { border-bottom: none; }
  .detail-label { color: #888; }
  .detail-value { font-weight: 600; text-align: right; }
  .total-row .detail-value { color: ${isFamily ? '#6b33c4' : '#1a5c6b'}; font-size: 1.1rem; }
  .checkin-box { background: ${isFamily ? '#f5f0ff' : '#e8f4f7'}; border-left: 4px solid ${isFamily ? '#6b33c4' : '#1a5c6b'}; padding: 16px 20px; border-radius: 0 8px 8px 0; margin-bottom: 24px; font-size: .9rem; }
  .checkin-box strong { display: block; margin-bottom: 4px; color: ${isFamily ? '#6b33c4' : '#1a5c6b'}; }
  .section-title { font-size: .75rem; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #aaa; margin: 28px 0 12px; }
  .agreement-box { border: 1.5px solid #e0dbd5; border-radius: 12px; padding: 20px 24px; font-size: .82rem; line-height: 1.7; color: #555; max-height: 400px; overflow-y: auto; }
  .agreement-box h4 { color: #1a5c6b; font-size: .88rem; margin: 14px 0 5px; }
  .agreement-accept { background: #f0f7f9; border: 1px solid #b8dde6; border-radius: 8px; padding: 14px 18px; font-size: .85rem; margin-top: 20px; }
  .footer { padding: 24px 40px; background: #f8f6f3; text-align: center; font-size: .8rem; color: #aaa; border-top: 1px solid #e8e4df; }
  .footer a { color: #1a5c6b; }
  @media (max-width: 480px) {
    .body, .header, .footer { padding-left: 24px; padding-right: 24px; }
    .detail-row { flex-direction: column; gap: 2px; }
    .detail-value { text-align: left; }
  }
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <div class="conf-badge">${booking.confirmationNumber}</div>
    <h1>🏡 You're Booked at SugarCrest!</h1>
    <p>Sugar Lake, Minnesota · Premium Lakehouse</p>
  </div>
  <div class="body">
    <p class="greeting">Hi ${escapeHtml(booking.guestName)},</p>
    <p style="margin-bottom:24px;color:#555;">
      ${isFamily
        ? "Your family &amp; friends booking is confirmed. We can't wait to host you at SugarCrest!"
        : "Your booking is confirmed and payment has been processed. We look forward to welcoming you to SugarCrest!"
      }
    </p>

    <div class="detail-box">
      <div class="detail-row"><span class="detail-label">Confirmation #</span><span class="detail-value" style="font-family:monospace;">${booking.confirmationNumber}</span></div>
      <div class="detail-row"><span class="detail-label">Check-In</span><span class="detail-value">${formatDateNice(booking.checkIn)}</span></div>
      <div class="detail-row"><span class="detail-label">Check-Out</span><span class="detail-value">${formatDateNice(booking.checkOut)}</span></div>
      <div class="detail-row"><span class="detail-label">Duration</span><span class="detail-value">${booking.nights} nights</span></div>
      <div class="detail-row"><span class="detail-label">Guests</span><span class="detail-value">${booking.guestCount || '—'}</span></div>
      ${booking.returningGuest ? `<div class="detail-row"><span class="detail-label">Status</span><span class="detail-value" style="color:#e8a020;">⭐ Returning Guest</span></div>` : ''}
      <div class="detail-row total-row"><span class="detail-label">Total Paid</span><span class="detail-value">${formatMoney(booking.amountPaid)}</span></div>
    </div>

    <div class="checkin-box">
      <strong>📍 Check-In Instructions</strong>
      Check-in begins at <strong>4:00 PM</strong> on your arrival date.
      Check-out is by <strong>11:00 AM</strong> on your departure date.
      Detailed arrival instructions will be sent closer to your stay.
    </div>

    ${booking.specialRequests ? `
    <div class="section-title">Your Special Requests</div>
    <div style="background:#fffdf5;border:1px solid #f5c860;border-radius:8px;padding:14px 18px;font-size:.9rem;margin-bottom:20px;">
      ${escapeHtml(booking.specialRequests)}
    </div>` : ''}

    ${booking.returningGuest ? `
    <div style="background:#fffdf5;border:1px solid #f5c860;border-radius:8px;padding:14px 18px;font-size:.9rem;margin-bottom:20px;">
      ⭐ <strong>Returning guest flag noted.</strong> We'll be in touch to discuss your personalized rate.
    </div>` : ''}

    <div class="section-title">Questions?</div>
    <p style="font-size:.88rem;color:#555;margin-bottom:24px;">
      Reply to this email or contact us at <a href="mailto:dgoehl@gmail.com" style="color:#1a5c6b;">dgoehl@gmail.com</a>.
    </p>

    <hr style="border:none;border-top:1px solid #e8e4df;margin:28px 0;">

    <div class="section-title">Your Rental Agreement (Copy)</div>
    <p style="font-size:.82rem;color:#888;margin-bottom:12px;">
      You accepted this agreement on <strong>${agreementDate}</strong>${clientIp !== 'unknown' ? ` from IP address <code>${clientIp}</code>` : ''}.
      Agreement version: <strong>${AGREEMENT_VER}</strong>
    </p>

    <div class="agreement-box">
      ${getAgreementText()}
    </div>

    <div class="agreement-accept">
      ✅ <strong>${escapeHtml(booking.guestName)}</strong> accepted this agreement on <strong>${agreementDate}</strong>
      ${clientIp !== 'unknown' ? `<br>📍 IP Address: <code>${clientIp}</code>` : ''}
      <br>📋 Agreement Version: <strong>${AGREEMENT_VER}</strong>
    </div>
  </div>
  <div class="footer">
    <strong>SugarCrest</strong> · Sugar Lake, Minnesota<br>
    <a href="https://sugarcrest.com">sugarcrest.com</a> ·
    <a href="mailto:dgoehl@gmail.com">dgoehl@gmail.com</a>
    <br><br>
    This email was sent because you completed a booking at SugarCrest.
  </div>
</div>
</body>
</html>
  `.trim();

  await transporter.sendMail({
    from:    '"SugarCrest" <maxdev1968@proton.me>',
    to:      guestEmail,
    bcc:     OWNER_EMAIL,           // Owner gets a copy of every booking
    subject,
    html,
    text: buildPlainText(booking, agreementDate, clientIp)
  });
}

/* ── Owner notification (brief) ── */
async function sendOwnerNotification(booking) {
  const transporter = nodemailer.createTransport(SMTP_CONFIG);
  const isFamily    = booking.type === 'family';
  const formatMoney = (n) => `$${Number(n).toLocaleString('en-US')}`;

  await transporter.sendMail({
    from:    '"SugarCrest Bookings" <maxdev1968@proton.me>',
    to:      OWNER_EMAIL,
    subject: `[SugarCrest] ${isFamily ? '👨‍👩‍👧 F&F' : '📅 New'} Booking — ${booking.guestName} | ${booking.checkIn} – ${booking.checkOut}`,
    text: [
      `NEW ${isFamily ? 'FAMILY' : 'PUBLIC'} BOOKING`,
      `Confirmation: ${booking.confirmationNumber}`,
      `Guest: ${booking.guestName} <${booking.guestEmail}> | ${booking.guestPhone || 'no phone'}`,
      `Dates: ${booking.checkIn} → ${booking.checkOut} (${booking.nights} nights)`,
      `Guests: ${booking.guestCount || '?'}`,
      `Amount: ${formatMoney(booking.amountPaid)}`,
      `Returning: ${booking.returningGuest ? 'YES ⭐' : 'No'}`,
      booking.specialRequests ? `Special requests: ${booking.specialRequests}` : '',
      `Agreement accepted: ${booking.agreement?.acceptedAt || '?'} | IP: ${booking.agreement?.ipAddress || '?'}`,
      `Payment ID: ${booking.paymentIntentId}`,
    ].filter(Boolean).join('\n')
  });
}

/* ── Agreement full text (plain HTML for email) ── */
function getAgreementText() {
  return `
<p><em>⚠️ PLACEHOLDER — Dave Goehl will replace with final rental agreement before going live.</em></p>
<h4>1. Parties</h4>
<p>This Vacation Rental Agreement is between SugarCrest LLC ("Owner/Host") and the Guest completing this booking.</p>
<h4>2. Check-In / Check-Out</h4>
<p>Check-in: 4:00 PM. Check-out: 11:00 AM. Early/late by request only.</p>
<h4>3. Payment</h4>
<p>Full payment due at booking. No refunds for early departure.</p>
<h4>4. Cancellation</h4>
<p>60+ days: full refund minus $250 fee. 30–60 days: 50% refund. Under 30 days: no refund.</p>
<h4>5. Occupancy</h4>
<p>Maximum 18 guests. Exceeding this limit results in immediate termination without refund.</p>
<h4>6. Minimum Stay</h4>
<p>3 nights (off-season). 5 nights (Memorial Day – Labor Day).</p>
<h4>7. Rules</h4>
<p>No smoking indoors. No pets without written approval. Quiet hours 10 PM – 8 AM. No fireworks. No illegal substances. All watercraft and water activities must comply with Minnesota DNR regulations.</p>
<h4>8. Damage & Liability</h4>
<p>Guest assumes full responsibility for damage caused during stay. Owner not liable for accidents or injuries on premises.</p>
<h4>9. Water Activities</h4>
<p>All water activities at Guest's own risk. Life jackets required per MN DNR rules.</p>
<h4>10. Governing Law</h4>
<p>Minnesota law governs. Disputes in Kandiyohi County courts.</p>
<p style="font-size:.78rem;color:#aaa;margin-top:12px;">Agreement Version: ${AGREEMENT_VER} · SugarCrest LLC · Sugar Lake, MN</p>
  `.trim();
}

function buildPlainText(booking, agreementDate, clientIp) {
  return [
    `SUGARCREST BOOKING CONFIRMATION`,
    `Confirmation #: ${booking.confirmationNumber}`,
    ``,
    `Guest: ${booking.guestName}`,
    `Email: ${booking.guestEmail}`,
    `Check-In: ${booking.checkIn} (after 4:00 PM)`,
    `Check-Out: ${booking.checkOut} (by 11:00 AM)`,
    `Nights: ${booking.nights}`,
    `Guests: ${booking.guestCount || '—'}`,
    `Total Paid: $${Number(booking.amountPaid).toLocaleString('en-US')}`,
    ``,
    `RENTAL AGREEMENT ACCEPTANCE`,
    `You accepted the SugarCrest Rental Agreement (${AGREEMENT_VER}) on:`,
    `${agreementDate}`,
    clientIp !== 'unknown' ? `IP Address: ${clientIp}` : '',
    ``,
    `Full agreement text available at: https://sugarcrest.com/booking`,
    ``,
    `Questions? dgoehl@gmail.com`,
    `SugarCrest · Sugar Lake, Minnesota · sugarcrest.com`,
  ].filter(s => s !== undefined).join('\n');
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
