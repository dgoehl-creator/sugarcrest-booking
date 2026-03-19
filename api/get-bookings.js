/**
 * Netlify Function: get-bookings
 * Returns bookings for the admin dashboard, or family allocations for family.html.
 *
 * Query params:
 *   ?type=public           → all public bookings (requires admin auth)
 *   ?type=family           → all F&F bookings (requires admin auth)
 *   ?type=all              → both (requires admin auth)
 *   ?type=family-allocations → family date allocations (public, for family.html)
 *   ?type=availability     → returns booked + family-allocated dates (for public calendar)
 */

const { getStore } = require('@netlify/blobs');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'sugarcrest2026!';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-admin-password',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  if (event.httpMethod !== 'GET')    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };

  const type = event.queryStringParameters?.type || 'public';

  /* ── Public endpoints (no auth required) ── */

  // family.html: returns pre-allocated family dates (not booked, just allocated)
  if (type === 'family-allocations') {
    return await getFamilyAllocations();
  }

  // Public calendar: returns all blocked dates (booked + family-allocated)
  if (type === 'availability') {
    return await getAvailabilityDates();
  }

  /* ── Admin endpoints (password required) ── */
  const password = event.headers['x-admin-password'] || event.queryStringParameters?.pw;
  if (password !== ADMIN_PASSWORD) {
    return {
      statusCode: 401,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Unauthorized' })
    };
  }

  try {
    const store = getStore({ name: 'sugarcrest-bookings', consistency: 'strong' });

    if (type === 'public' || type === 'all') {
      const publicIndex = await store.get('index/public', { type: 'json' }).catch(() => []);
      if (type === 'public') {
        return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ bookings: publicIndex || [] }) };
      }
      // type=all: also get family
      const familyIndex = await store.get('index/family', { type: 'json' }).catch(() => []);
      return {
        statusCode: 200, headers: CORS_HEADERS,
        body: JSON.stringify({ bookings: publicIndex || [], familyBookings: familyIndex || [] })
      };
    }

    if (type === 'family') {
      const familyIndex = await store.get('index/family', { type: 'json' }).catch(() => []);
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ familyBookings: familyIndex || [] }) };
    }

    if (type === 'family-allocations-admin') {
      const allocations = await store.get('family/allocations', { type: 'json' }).catch(() => []);
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ allocations: allocations || [] }) };
    }

    if (type === 'blocked-dates') {
      const blocked = await store.get('admin/blocked-dates', { type: 'json' }).catch(() => []);
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ blockedDates: blocked || [] }) };
    }

    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Unknown type' }) };

  } catch (err) {
    console.error('[get-bookings] Error:', err.message);
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};

/* ── Get family allocations (public, for family.html) ── */
async function getFamilyAllocations() {
  try {
    const store = getStore({ name: 'sugarcrest-bookings', consistency: 'strong' });
    const allocations = await store.get('family/allocations', { type: 'json' }).catch(() => []);
    const bookings    = await store.get('index/family', { type: 'json' }).catch(() => []);

    // Filter out already-booked allocations
    const bookedIds = new Set((bookings || []).map(b => b.allocationId).filter(Boolean));
    const available = (allocations || []).filter(a => !bookedIds.has(a.id));

    return {
      statusCode: 200, headers: CORS_HEADERS,
      body: JSON.stringify({ allocations: available })
    };
  } catch (err) {
    console.error('[get-bookings/family-allocations]', err.message);
    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ allocations: [] }) };
  }
}

/* ── Get all blocked dates for public calendar ── */
async function getAvailabilityDates() {
  try {
    const store = getStore({ name: 'sugarcrest-bookings', consistency: 'strong' });

    const [publicIdx, familyIdx, blockedDates, familyAllocs] = await Promise.all([
      store.get('index/public',         { type: 'json' }).catch(() => []),
      store.get('index/family',         { type: 'json' }).catch(() => []),
      store.get('admin/blocked-dates',  { type: 'json' }).catch(() => []),
      store.get('family/allocations',   { type: 'json' }).catch(() => []),
    ]);

    const allBlocked = new Set();

    // Add all public booking date ranges
    for (const b of (publicIdx || [])) {
      expandDateRange(b.checkIn, b.checkOut).forEach(d => allBlocked.add(d));
    }

    // Add all family booking date ranges (they count as booked too)
    for (const b of (familyIdx || [])) {
      expandDateRange(b.checkIn, b.checkOut).forEach(d => allBlocked.add(d));
    }

    // Add manual blocked dates
    for (const d of (blockedDates || [])) {
      if (d.date) allBlocked.add(d.date);
      if (d.startDate && d.endDate) {
        expandDateRange(d.startDate, d.endDate).forEach(dd => allBlocked.add(dd));
      }
    }

    // Family-allocated dates are hidden from public calendar
    const familyDates = new Set();
    for (const a of (familyAllocs || [])) {
      expandDateRange(a.startDate, a.endDate).forEach(d => {
        allBlocked.add(d);
        familyDates.add(d);
      });
    }

    return {
      statusCode: 200, headers: CORS_HEADERS,
      body: JSON.stringify({
        bookedDates:  [...allBlocked],
        familyDates:  [...familyDates],   // these are the family-allocated ones (subset of booked)
      })
    };
  } catch (err) {
    console.error('[get-bookings/availability]', err.message);
    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ bookedDates: [], familyDates: [] }) };
  }
}

/* ── Expand a date range to array of YYYY-MM-DD strings (inclusive check-in, exclusive check-out) ── */
function expandDateRange(startStr, endStr) {
  if (!startStr || !endStr) return [];
  const dates = [];
  const [sy, sm, sd] = startStr.split('-').map(Number);
  const [ey, em, ed] = endStr.split('-').map(Number);
  const start = new Date(sy, sm-1, sd);
  const end   = new Date(ey, em-1, ed);
  const cur = new Date(start);
  while (cur < end) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth()+1).padStart(2,'0');
    const d = String(cur.getDate()).padStart(2,'0');
    dates.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}
