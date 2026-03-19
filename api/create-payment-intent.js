/**
 * Netlify Function: create-payment-intent
 * Creates a Stripe PaymentIntent server-side.
 * Called by booking.html and family.html before confirming payment.
 */

const Stripe = require('stripe');

// ⚠️ Set STRIPE_SECRET_KEY in Netlify environment variables — never hardcode here
const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_SECRET) {
  console.error('[create-payment-intent] STRIPE_SECRET_KEY env var not set');
}

exports.handler = async (event) => {
  // CORS headers — allow Squarespace embed + direct access
  const headers = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { amount, booking } = body;

  if (!amount || typeof amount !== 'number' || amount < 1) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid amount' }) };
  }

  // Sanity check: minimum sensible amounts
  const MIN_AMOUNT = 500;   // $5 minimum (Stripe minimum)
  const MAX_AMOUNT = 200000; // $200k hard cap
  if (amount < MIN_AMOUNT || amount > MAX_AMOUNT) {
    return {
      statusCode: 400, headers,
      body: JSON.stringify({ error: `Amount must be between $${MIN_AMOUNT/100} and $${MAX_AMOUNT/100}` })
    };
  }

  try {
    const stripe = Stripe(STRIPE_SECRET);

    // Capture client IP for agreement audit trail
    const clientIp = event.headers['x-forwarded-for']?.split(',')[0]?.trim()
      || event.headers['x-real-ip']
      || 'unknown';

    const description = booking?.type === 'family'
      ? `SugarCrest F&F Booking — ${booking?.guestName || 'Guest'} | ${booking?.checkIn || ''} – ${booking?.checkOut || ''}`
      : `SugarCrest Booking — ${booking?.guestName || 'Guest'} | ${booking?.checkIn || ''} – ${booking?.checkOut || ''} (${booking?.nights || '?'} nights)`;

    const paymentIntent = await stripe.paymentIntents.create({
      amount:      amount * 100,          // Stripe uses cents
      currency:    'usd',
      description,
      receipt_email: booking?.guestEmail || undefined,
      metadata: {
        guest_name:         booking?.guestName  || '',
        guest_email:        booking?.guestEmail || '',
        guest_phone:        booking?.guestPhone || '',
        check_in:           booking?.checkIn    || '',
        check_out:          booking?.checkOut   || '',
        nights:             String(booking?.nights || ''),
        guest_count:        String(booking?.guestCount || ''),
        booking_type:       booking?.type || 'public',
        returning_guest:    String(booking?.returningGuest || false),
        // Agreement audit
        agreement_version:  booking?.agreement?.version || 'v1.0',
        agreement_accepted: booking?.agreement?.acceptedAt || '',
        agreement_ip:       clientIp,
        special_requests:   (booking?.specialRequests || '').substring(0, 500),
      }
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ clientSecret: paymentIntent.client_secret })
    };

  } catch (err) {
    console.error('[create-payment-intent] Stripe error:', err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message || 'Payment initialization failed' })
    };
  }
};
