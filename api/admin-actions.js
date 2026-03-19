/**
 * Netlify Function: admin-actions
 * Handles admin write operations:
 *   POST {action: 'add-family-allocation', ...}
 *   POST {action: 'delete-family-allocation', id}
 *   POST {action: 'add-blocked-dates', dates}
 *   POST {action: 'remove-blocked-date', date}
 *   POST {action: 'mark-returning-guest', confNumber}
 *   POST {action: 'delete-booking', confNumber, type}
 */

const { getStore } = require('@netlify/blobs');
const { v4: uuid } = require('uuid');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'sugarcrest2026!';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-admin-password',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  if (event.httpMethod !== 'POST')   return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };

  const password = event.headers['x-admin-password'];
  if (password !== ADMIN_PASSWORD) {
    return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const store = getStore({ name: 'sugarcrest-bookings', consistency: 'strong' });

  try {
    switch (body.action) {

      /* ── Add family allocation ── */
      case 'add-family-allocation': {
        const { startDate, endDate, note } = body;
        if (!startDate || !endDate) throw new Error('startDate and endDate required');
        const allocations = await store.get('family/allocations', { type: 'json' }).catch(() => []);
        const newAlloc = { id: uuid(), startDate, endDate, note: note || '', createdAt: new Date().toISOString() };
        allocations.push(newAlloc);
        await store.setJSON('family/allocations', allocations);
        return ok({ allocation: newAlloc });
      }

      /* ── Delete family allocation ── */
      case 'delete-family-allocation': {
        const { id } = body;
        if (!id) throw new Error('id required');
        const allocations = await store.get('family/allocations', { type: 'json' }).catch(() => []);
        const filtered = allocations.filter(a => a.id !== id);
        await store.setJSON('family/allocations', filtered);
        return ok({ deleted: id });
      }

      /* ── Add blocked dates (owner personal use) ── */
      case 'add-blocked-dates': {
        const { startDate, endDate, label } = body;
        if (!startDate) throw new Error('startDate required');
        const blocked = await store.get('admin/blocked-dates', { type: 'json' }).catch(() => []);
        const newBlock = { id: uuid(), startDate, endDate: endDate || startDate, label: label || 'Owner block', createdAt: new Date().toISOString() };
        blocked.push(newBlock);
        await store.setJSON('admin/blocked-dates', blocked);
        return ok({ blocked: newBlock });
      }

      /* ── Remove blocked date block ── */
      case 'remove-blocked-date': {
        const { id } = body;
        if (!id) throw new Error('id required');
        const blocked = await store.get('admin/blocked-dates', { type: 'json' }).catch(() => []);
        await store.setJSON('admin/blocked-dates', blocked.filter(b => b.id !== id));
        return ok({ deleted: id });
      }

      /* ── Mark returning guest ── */
      case 'mark-returning-guest': {
        const { confNumber, value } = body;
        if (!confNumber) throw new Error('confNumber required');
        // Update the booking record
        const key = `booking/${confNumber}`;
        const record = await store.get(key, { type: 'json' }).catch(() => null);
        if (!record) throw new Error('Booking not found');
        record.returningGuest = value !== false;
        record.returningGuestMarkedAt = new Date().toISOString();
        await store.setJSON(key, record);
        // Also update the index entry
        const idx = await store.get('index/public', { type: 'json' }).catch(() => []);
        const updated = idx.map(b => b.conf === confNumber ? { ...b, returningGuest: record.returningGuest } : b);
        await store.setJSON('index/public', updated);
        return ok({ updated: confNumber });
      }

      default:
        return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: `Unknown action: ${body.action}` }) };
    }
  } catch (err) {
    console.error('[admin-actions]', err.message);
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: err.message }) };
  }
};

function ok(data) {
  return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ success: true, ...data }) };
}
