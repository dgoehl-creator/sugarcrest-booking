/**
 * SugarCrest — Booking Form + Stripe Integration
 * Handles booking.html and family.html payment flows.
 * Includes: legal agreement modal, timestamped acceptance, Stripe Elements.
 */

'use strict';

const STRIPE_PK     = 'pk_live_E3eE5XSpwy9lOoHfnL478nfU';
const AGREEMENT_VER = 'v1.0';

/* ════════════════════════════════════════════════
   LEGAL AGREEMENT MODAL
   Shared by both booking.html and family.html
   ════════════════════════════════════════════════ */
const AGREEMENT_HTML = `
<div id="agreement-modal" style="
  display:none; position:fixed; inset:0; z-index:10000;
  background:rgba(0,0,0,.6); backdrop-filter:blur(4px);
  align-items:center; justify-content:center; padding:20px;
" role="dialog" aria-modal="true" aria-labelledby="agreement-title">
  <div style="
    background:#fff; border-radius:16px; max-width:680px; width:100%;
    max-height:90vh; display:flex; flex-direction:column;
    box-shadow:0 20px 60px rgba(0,0,0,.25);
  ">
    <div style="
      padding:28px 32px 20px; border-bottom:1px solid #e0dbd5;
      display:flex; align-items:center; justify-content:space-between; flex-shrink:0;
    ">
      <div>
        <h2 id="agreement-title" style="font-size:1.25rem;color:#1a5c6b;margin-bottom:4px;">SugarCrest Booking Terms &amp; Rental Agreement</h2>
        <p style="font-size:.78rem;color:#aaa;margin:0;">Version ${AGREEMENT_VER} · Placeholder — Dave will replace with final terms</p>
      </div>
      <button id="agreement-close" aria-label="Close" style="
        background:none; border:none; font-size:1.5rem; cursor:pointer;
        color:#888; line-height:1; padding:4px 8px; border-radius:8px;
      ">&times;</button>
    </div>
          <div style="padding:28px 32px; overflow-y:auto; flex:1; font-size:.9rem; line-height:1.75; color:#2d2d2d;">

      <h3 style="color:#1a5c6b;margin:20px 0 8px;">SHORT TERM RENTAL AGREEMENT</h3>
      <p>This Short Term Rental Agreement ("Agreement") is made by and between Sugarcrest, LLLP ("Sugarcrest") and Guest as of the date of Guest's booking.</p>

      <h3 style="color:#1a5c6b;margin:20px 0 8px;">Property</h3>
      <p>37857 North Sugar Lake Road, Cohasset, MN 55721. The Property includes two furnished cabins, including linens, towels, and standard kitchen serving ware and utensils.</p>

      <h3 style="color:#1a5c6b;margin:20px 0 8px;">Rental Party &amp; Maximum Occupancy</h3>
      <p>The rental party shall consist of up to 16 adults. The maximum number of overnight guests is limited to 16 persons. An additional charge of $100 per person per night for guests exceeding 16 will be assessed.</p>

      <h3 style="color:#1a5c6b;margin:20px 0 8px;">Rental Term</h3>
      <p>Check-in: <strong>4:00 PM Central Time</strong>. Check-out: <strong>11:00 AM Central Time</strong>.</p>

      <h3 style="color:#1a5c6b;margin:20px 0 8px;">Cancellation Policy</h3>
      <ul style="padding-left:20px;margin-bottom:12px;">
        <li><strong>100% refund</strong> if canceled 120+ days prior to Check-in</li>
        <li><strong>75% refund</strong> if canceled 90–119 days prior to Check-in</li>
        <li><strong>50% refund</strong> if canceled 60–89 days prior to Check-in</li>
        <li><strong>No refund</strong> if canceled 59 or fewer days prior to Check-in</li>
      </ul>
      <p>Guest is encouraged to purchase trip cancellation insurance at <a href="https://www.insuremytrip.com" target="_blank" style="color:#1a5c6b;">insuremytrip.com</a> or <a href="https://www.vacationrentalinsurance.com" target="_blank" style="color:#1a5c6b;">vacationrentalinsurance.com</a>.</p>

      <h3 style="color:#1a5c6b;margin:20px 0 8px;">Payment</h3>
      <p>Full payment via Stripe. Booking is confirmed upon receipt of payment.</p>

      <h3 style="color:#1a5c6b;margin:20px 0 8px;">EXHIBIT A — RENTAL RULES</h3>

      <h4 style="margin:16px 0 6px;">No Indoor Smoking</h4>
      <p>Smoking is NOT allowed inside the cabins or any other facilities on the property. Guest agrees to pay not less than $450 for odor abatement if smoking occurs inside. Cigarette butts from outdoor smoking shall be disposed of properly in black receptacles near both cabins.</p>

      <h4 style="margin:16px 0 6px;">Rental Party Use Only</h4>
      <p>Guests may not exceed the overnight occupancy limit. People other than those in the rental Party may not visit or stay overnight without Owner's prior permission. Failure to obtain approval will result in additional charges and/or removal from the property.</p>

      <h4 style="margin:16px 0 6px;">Indemnification and Hold Harmless</h4>
      <p>Guest and rental Party shall be solely responsible for any property damage, accident, illness, injury, or death arising out of use of the property. Guest and each member of the rental Party hereby agree to indemnify and hold Sugarcrest and its agent(s) harmless from any and all claims. Guest and each member of the rental Party assume the risk of injury related to weather, falling trees, and any activities on the property including all lake/swimming/dock/beach areas.</p>

      <h4 style="margin:16px 0 6px;">Proper Use and Care</h4>
      <p>Guests are expected to use the Property, cabins, appliances, furnishings, lake toys, and recreational items in good condition and return them to their original location prior to departure.</p>

      <h4 style="margin:16px 0 6px;">Damage to Property</h4>
      <p>All property must be left undamaged. Sugarcrest reserves the right to withhold fees from the damage deposit and/or file a damage claim for any damage caused during the stay.</p>

      <h4 style="margin:16px 0 6px;">Pets</h4>
      <p>Maximum two non-aggressive breed pets permitted on a case-by-case, Owner-approved basis. Pets must be kept on property, cleaned up after, and wiped down before entering cabins if wet or dirty.</p>

      <h4 style="margin:16px 0 6px;">Housekeeping</h4>
      <p>No daily housekeeping service. Linens and bath towels are included, but daily maid service is not included in the rental rate.</p>

      <h4 style="margin:16px 0 6px;">Garbage</h4>
      <p>All garbage must be stowed in proper garbage or recycling receptacles and emptied into the large garbage cans in the Main House laundry room.</p>

      <h4 style="margin:16px 0 6px;">Duffer Golf Course</h4>
      <p>Use is at Guest's own risk. No children under age 12 without adult supervision. Guest is responsible for any damage caused by golf course use. Sugarcrest assumes no liability for any injuries.</p>

      <h4 style="margin:16px 0 6px;">Owner's Property</h4>
      <p>The Garages and storage shed (Sissieville) are off-limits. The Property may contain the Owner's private items or closets not available for use. Use of Owner's private property without permission may result in a damage claim.</p>

      <h4 style="margin:16px 0 6px;">Mechanical Failures</h4>
      <p>Sugarcrest cannot guarantee against mechanical failures of any systems or appliances. Guest agrees to notify Sugarcrest as soon as possible of any defective or non-working units. Sugarcrest will make every reasonable effort to repair or replace them quickly.</p>

      <h4 style="margin:16px 0 6px;">Water and Septic</h4>
      <p>The cabins are on well and septic systems. <strong>DO NOT FLUSH anything other than toilet paper.</strong> No feminine products should be flushed at any time. Violations may result in additional fees including fees to pump and repair septic systems.</p>

      <h4 style="margin:16px 0 6px;">Fireplace and Fire Pit</h4>
      <p>Outdoor fires should be contained in the fire pit to the southwest of the main cabin. When using the indoor fireplace, open the damper before starting and close it after the fire is fully extinguished. Do not leave fires unattended. Fully extinguish all fires before retiring or leaving the Property.</p>

      <h4 style="margin:16px 0 6px;">Aquatic Invasive Species (AIS)</h4>
      <p>Under Minnesota law, it is illegal to transport aquatic plants, prohibited invasive animals, or water to and from water bodies. Watercraft must be properly decontaminated if coming from an AIS-affected water. For more information: <a href="https://www.dnr.state.mn.us/invasives/ais/index.html" target="_blank" style="color:#1a5c6b;">MN DNR AIS Information</a>.</p>

      <p style="margin-top:24px;padding:16px;background:#f0f7f5;border-radius:8px;font-weight:600;color:#1a5c6b;">
        By checking the agreement box and submitting payment, Guest acknowledges and accepts this Short Term Rental Agreement and all Rental Rules, and agrees to assume sole responsibility for the rental Party's adherence to said Agreement and Rules.
      </p>

      <p style="margin-top:16px;padding:12px;background:#f8f6f3;border-radius:8px;font-size:.82rem;color:#888;">
        Agreement Version: <strong>2026-v1.0</strong> · Last Updated: March 2026 ·
        Questions? Contact <a href="mailto:dgoehl@gmail.com" style="color:#1a5c6b;">dgoehl@gmail.com</a>
      </p>
    </div>
    <div style="padding:20px 32px;border-top:1px solid #e0dbd5;flex-shrink:0;text-align:right;">
      <button id="agreement-accept-btn" class="btn btn-teal btn-sm">I've Read the Agreement</button>
    </div>
  </div>
</div>
`;

function injectAgreementModal() {
  if (document.getElementById('agreement-modal')) return;
  const div = document.createElement('div');
  div.innerHTML = AGREEMENT_HTML;
  document.body.appendChild(div.firstElementChild);

  const modal   = document.getElementById('agreement-modal');
  const closeBtn = document.getElementById('agreement-close');
  const acceptBtn = document.getElementById('agreement-accept-btn');

  closeBtn?.addEventListener('click', () => closeAgreementModal());
  acceptBtn?.addEventListener('click', () => {
    closeAgreementModal();
    // Auto-check the agreement checkbox if not already checked
    const cb = document.getElementById('agree-terms') || document.getElementById('family-agree-terms');
    if (cb && !cb.checked) {
      cb.checked = true;
      cb.dispatchEvent(new Event('change'));
    }
  });

  modal.addEventListener('click', e => {
    if (e.target === modal) closeAgreementModal();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeAgreementModal();
  });
}

function openAgreementModal(e) {
  if (e) { e.preventDefault(); e.stopPropagation(); }
  const modal = document.getElementById('agreement-modal');
  if (modal) { modal.style.display = 'flex'; document.body.style.overflow = 'hidden'; }
}

function closeAgreementModal() {
  const modal = document.getElementById('agreement-modal');
  if (modal) { modal.style.display = 'none'; document.body.style.overflow = ''; }
}

/* ════════════════════════════════════════════════
   PUBLIC BOOKING PAGE  (booking.html)
   ════════════════════════════════════════════════ */
(function initBookingPage() {
  if (!document.getElementById('booking-form')) return;

  // Inject agreement modal
  injectAgreementModal();

  const stripe   = Stripe(STRIPE_PK);
  const elements = stripe.elements({
    fonts: [{ cssSrc: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500&display=swap' }]
  });

  /* ── Stripe Card Element ── */
  const cardElement = elements.create('card', {
    style: {
      base: {
        fontFamily: "'Inter', sans-serif", fontSize: '15px', color: '#2d2d2d',
        '::placeholder': { color: '#bbbbbb' }, iconColor: '#1a5c6b',
      },
      invalid: { color: '#c0392b', iconColor: '#c0392b' }
    }
  });

  const cardWrap = document.getElementById('card-element');
  if (cardWrap) {
    cardElement.mount('#card-element');
    cardElement.on('change', e => {
      document.getElementById('card-errors').textContent = e.error ? e.error.message : '';
    });
    cardElement.on('focus', () => document.querySelector('.stripe-element-wrap')?.classList.add('focused'));
    cardElement.on('blur',  () => document.querySelector('.stripe-element-wrap')?.classList.remove('focused'));
  }

  /* ── Agreement link ── */
  document.querySelectorAll('.agreement-link').forEach(link => {
    link.addEventListener('click', openAgreementModal);
  });

  /* ── Agreement checkbox validation ── */
  const agreeCheckbox = document.getElementById('agree-terms');
  const payBtn        = document.getElementById('pay-btn');

  function updatePayBtnState() {
    if (!payBtn) return;
    const agreed  = agreeCheckbox?.checked;
    const hasTotal = window._bookingTotal > 0;
    payBtn.disabled = !(agreed && hasTotal);
    if (agreed && hasTotal) {
      payBtn.textContent = `Pay ${formatCurrency(window._bookingTotal)} — Confirm Booking`;
    } else if (!agreed) {
      payBtn.textContent = 'Please accept the rental agreement to continue';
    }
  }

  agreeCheckbox?.addEventListener('change', updatePayBtnState);

  /* ── URL params from index.html CTA ── */
  const params = new URLSearchParams(window.location.search);
  const paramCI = params.get('checkin');
  const paramCO = params.get('checkout');

  /* ── Date pickers ── */
  const checkInInput  = document.getElementById('checkin');
  const checkOutInput = document.getElementById('checkout');
  const today = new Date(); today.setHours(0,0,0,0);
  const todayStr = dateKey(today);

  if (checkInInput)  checkInInput.min  = todayStr;
  if (checkOutInput) checkOutInput.min = todayStr;
  if (paramCI && checkInInput)  checkInInput.value  = paramCI;
  if (paramCO && checkOutInput) checkOutInput.value = paramCO;

  function updatePriceSummary() {
    const ci = checkInInput?.value;
    const co = checkOutInput?.value;
    const nightsEl   = document.getElementById('summary-nights');
    const rateEl     = document.getElementById('summary-rate');
    const totalEl    = document.getElementById('summary-total');
    const totalAmtEl = document.getElementById('summary-total-amount');
    const minWarnEl  = document.getElementById('min-stay-warning');

    if (!ci || !co) {
      if (nightsEl)   nightsEl.textContent   = '—';
      if (totalAmtEl) totalAmtEl.textContent = '—';
      window._bookingTotal  = 0;
      window._bookingNights = 0;
      updatePayBtnState();
      return;
    }

    const checkIn  = parseDate(ci);
    const checkOut = parseDate(co);
    const nights   = Math.round((checkOut - checkIn) / 86400000);

    if (nights <= 0) {
      if (nightsEl)   nightsEl.textContent   = '—';
      if (totalAmtEl) totalAmtEl.textContent = '—';
      window._bookingTotal  = 0;
      updatePayBtnState();
      return;
    }

    const minStay = getMinStay(checkIn);
    if (minWarnEl) {
      if (nights < minStay) {
        const season = isHighSeason(checkIn) ? 'summer (Memorial Day – Labor Day)' : 'off-season';
        minWarnEl.textContent = `⚠️ Minimum stay is ${minStay} nights during ${season}.`;
        minWarnEl.style.display = 'block';
        window._bookingTotal = 0;
        updatePayBtnState();
        return;
      }
      minWarnEl.style.display = 'none';
    }

    const total = nights * NIGHTLY_RATE;
    if (nightsEl)   nightsEl.textContent   = `${nights} nights`;
    if (rateEl)     rateEl.textContent     = `${formatCurrency(NIGHTLY_RATE)}/night`;
    if (totalEl)    totalEl.textContent    = formatCurrency(total);
    if (totalAmtEl) totalAmtEl.textContent = formatCurrency(total);

    window._bookingTotal  = total;
    window._bookingNights = nights;
    window._checkIn  = ci;
    window._checkOut = co;
    updatePayBtnState();
  }

  checkInInput?.addEventListener('change', () => {
    if (!checkInInput.value) return;
    const ci = parseDate(checkInInput.value);
    const minStay = getMinStay(ci);
    const minCo = addDays(ci, minStay);
    if (checkOutInput) {
      checkOutInput.min = dateKey(minCo);
      if (checkOutInput.value && parseDate(checkOutInput.value) < minCo) {
        checkOutInput.value = dateKey(minCo);
      }
    }
    updatePriceSummary();
  });
  checkOutInput?.addEventListener('change', updatePriceSummary);
  updatePriceSummary();

  /* ── Returning guest note ── */
  const returningCheck = document.getElementById('returning-guest');
  const returningNote  = document.getElementById('returning-guest-note');
  returningCheck?.addEventListener('change', () => {
    returningNote?.classList.toggle('show', returningCheck.checked);
  });

  /* ── Form submission ── */
  const form = document.getElementById('booking-form');
  form?.addEventListener('submit', async e => {
    e.preventDefault();
    if (!validateBookingForm()) return;

    const agreementTimestamp = new Date().toISOString();
    setPayLoading(true, 'public');

    try {
      const bookingData = collectBookingData(agreementTimestamp);

      // 1. Create PaymentIntent
      const intentRes = await fetch('/.netlify/functions/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: window._bookingTotal, booking: bookingData })
      });
      if (!intentRes.ok) {
        const err = await intentRes.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to initialize payment. Please try again.');
      }
      const { clientSecret } = await intentRes.json();

      // 2. Confirm payment
      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
          billing_details: {
            name:    bookingData.guestName,
            email:   bookingData.guestEmail,
            phone:   bookingData.guestPhone,
            address: { line1: bookingData.guestAddress }
          }
        }
      });
      if (stripeError) throw new Error(stripeError.message);

      // 3. Save booking + send email
      const confNumber = generateConfirmationNumber();
      await fetch('/.netlify/functions/save-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...bookingData,
          paymentIntentId:    paymentIntent.id,
          amountPaid:         window._bookingTotal,
          confirmationNumber: confNumber,
          type:               'public',
          createdAt:          new Date().toISOString()
        })
      });

      // 4. Redirect
      const p = new URLSearchParams({
        conf:     confNumber,
        name:     bookingData.guestName,
        email:    bookingData.guestEmail,
        checkin:  bookingData.checkIn,
        checkout: bookingData.checkOut,
        nights:   bookingData.nights,
        total:    window._bookingTotal,
        guests:   bookingData.guestCount,
        type:     'public'
      });
      window.location.href = `/confirmation.html?${p}`;

    } catch (err) {
      document.getElementById('card-errors').textContent = err.message;
      showToast(err.message, 'error');
      setPayLoading(false, 'public');
    }
  });

  function collectBookingData(agreementTimestamp) {
    return {
      guestName:       document.getElementById('guest-name')?.value?.trim(),
      guestEmail:      document.getElementById('guest-email')?.value?.trim(),
      guestPhone:      document.getElementById('guest-phone')?.value?.trim(),
      guestAddress:    document.getElementById('guest-address')?.value?.trim(),
      guestCount:      document.getElementById('guest-count')?.value,
      checkIn:         window._checkIn,
      checkOut:        window._checkOut,
      nights:          window._bookingNights,
      specialRequests: document.getElementById('special-requests')?.value?.trim(),
      returningGuest:  document.getElementById('returning-guest')?.checked || false,
      agreement: {
        version:       AGREEMENT_VER,
        acceptedAt:    agreementTimestamp,
        guestName:     document.getElementById('guest-name')?.value?.trim(),
        // IP collected server-side
      }
    };
  }

  function validateBookingForm() {
    const required = ['guest-name', 'guest-email', 'guest-phone', 'checkin', 'checkout'];
    let valid = true;
    required.forEach(id => {
      const el = document.getElementById(id);
      if (el && !el.value.trim()) {
        el.style.borderColor = '#c0392b';
        valid = false;
        el.addEventListener('input', () => el.style.borderColor = '', { once: true });
      }
    });
    if (!document.getElementById('agree-terms')?.checked) {
      showToast('You must accept the Rental Agreement to proceed.', 'error');
      return false;
    }
    if (!window._bookingTotal || window._bookingTotal <= 0) {
      showToast('Please select valid check-in and check-out dates.', 'error');
      return false;
    }
    if (!valid) showToast('Please fill in all required fields.', 'error');
    return valid;
  }
})();


/* ════════════════════════════════════════════════
   FAMILY BOOKING PAGE  (family.html)
   ════════════════════════════════════════════════ */
(function initFamilyPage() {
  if (!document.getElementById('family-form')) return;

  injectAgreementModal();

  const FAMILY_RATE = 500;
  const stripe      = Stripe(STRIPE_PK);
  const elements    = stripe.elements();

  const cardElement = elements.create('card', {
    style: {
      base: {
        fontFamily: "'Inter', sans-serif", fontSize: '15px', color: '#2d2d2d',
        '::placeholder': { color: '#bbbbbb' }, iconColor: '#6b33c4',
      },
      invalid: { color: '#c0392b', iconColor: '#c0392b' }
    }
  });

  const cardWrap = document.getElementById('family-card-element');
  if (cardWrap) {
    cardElement.mount('#family-card-element');
    cardElement.on('change', e => {
      document.getElementById('family-card-errors').textContent = e.error ? e.error.message : '';
    });
    cardElement.on('focus', () => cardWrap.closest('.stripe-element-wrap')?.classList.add('focused'));
    cardElement.on('blur',  () => cardWrap.closest('.stripe-element-wrap')?.classList.remove('focused'));
  }

  /* ── Agreement link ── */
  document.querySelectorAll('.agreement-link').forEach(link => {
    link.addEventListener('click', openAgreementModal);
  });

  /* ── Agreement + date selection gate the submit btn ── */
  const agreeCheckbox = document.getElementById('family-agree-terms');
  const payBtn        = document.getElementById('family-pay-btn');

  function updateFamilyBtn() {
    if (!payBtn) return;
    const agreed   = agreeCheckbox?.checked;
    const hasDate  = !!window._selectedAllocation;
    payBtn.disabled = !(agreed && hasDate);
    if (!agreed) payBtn.textContent = 'Please accept the rental agreement to continue';
    else if (!hasDate) payBtn.textContent = 'Select a date above to continue';
    else payBtn.textContent = 'Pay $500 — Confirm Booking';
  }

  agreeCheckbox?.addEventListener('change', updateFamilyBtn);

  /* ── Load family available dates ── */
  async function loadFamilyDates() {
    const grid = document.getElementById('family-dates-grid');
    if (!grid) return;

    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:20px;color:#aaa;">
      <div class="spinner" style="border-color:rgba(107,51,196,.2);border-top-color:#6b33c4;margin:0 auto 12px;"></div>
      Loading available dates…
    </div>`;

    try {
      const res  = await fetch('/.netlify/functions/get-bookings?type=family-allocations');
      if (!res.ok) throw new Error();
      const data = await res.json();
      const allocations = (data.allocations || []);

      const today = new Date(); today.setHours(0,0,0,0);
      const future = allocations.filter(a => parseDate(a.startDate) >= today);

      if (!future.length) {
        grid.innerHTML = `<div class="alert alert-info" style="grid-column:1/-1">
          ℹ️ No dates are currently available for family booking. Contact Dave for upcoming availability.
        </div>`;
        return;
      }

      grid.innerHTML = future.map(a => `
        <div class="family-date-card" data-alloc-id="${a.id}"
             data-start="${a.startDate}" data-end="${a.endDate}">
          <div style="font-weight:700;color:#6b33c4;margin-bottom:4px;font-size:1rem;">
            ${formatDateRange(a.startDate, a.endDate)}
          </div>
          <div style="font-size:.82rem;color:#888;">
            ${getNightCount(a.startDate, a.endDate)} nights · Check-in 4 PM
          </div>
          ${a.note ? `<div style="font-size:.78rem;color:#aaa;margin-top:6px;font-style:italic;">${escapeHtml(a.note)}</div>` : ''}
        </div>
      `).join('');

      grid.querySelectorAll('.family-date-card').forEach(card => {
        card.addEventListener('click', () => {
          grid.querySelectorAll('.family-date-card').forEach(c => c.classList.remove('selected'));
          card.classList.add('selected');
          window._selectedAllocation = {
            id:        card.dataset.allocId,
            startDate: card.dataset.start,
            endDate:   card.dataset.end,
          };
          // Update selected display
          const selEl = document.getElementById('family-selected-dates');
          if (selEl) selEl.textContent = formatDateRange(card.dataset.start, card.dataset.end);
          updateFamilyBtn();
        });
      });

    } catch {
      grid.innerHTML = `<div class="alert alert-error" style="grid-column:1/-1">
        ⚠️ Could not load available dates. Please contact Dave directly.
      </div>`;
    }
  }

  loadFamilyDates();

  /* ── Family form submission ── */
  const familyForm = document.getElementById('family-form');
  familyForm?.addEventListener('submit', async e => {
    e.preventDefault();

    if (!window._selectedAllocation) {
      showToast('Please select a date range above.', 'error'); return;
    }
    if (!document.getElementById('family-agree-terms')?.checked) {
      showToast('You must accept the Rental Agreement to proceed.', 'error'); return;
    }
    if (!validateFamilyForm()) return;

    const agreementTimestamp = new Date().toISOString();
    setPayLoading(true, 'family');

    try {
      const bookingData = {
        guestName:  document.getElementById('family-name')?.value?.trim(),
        guestEmail: document.getElementById('family-email')?.value?.trim(),
        guestPhone: document.getElementById('family-phone')?.value?.trim(),
        guestCount: document.getElementById('family-guests')?.value,
        message:    document.getElementById('family-message')?.value?.trim(),
        checkIn:    window._selectedAllocation.startDate,
        checkOut:   window._selectedAllocation.endDate,
        nights:     getNightCount(window._selectedAllocation.startDate, window._selectedAllocation.endDate),
        allocation: window._selectedAllocation,
        type:       'family',
        amountPaid: FAMILY_RATE,
        agreement: {
          version:    AGREEMENT_VER,
          acceptedAt: agreementTimestamp,
          guestName:  document.getElementById('family-name')?.value?.trim(),
        }
      };

      const intentRes = await fetch('/.netlify/functions/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: FAMILY_RATE, booking: bookingData })
      });
      if (!intentRes.ok) {
        const err = await intentRes.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to initialize payment.');
      }
      const { clientSecret } = await intentRes.json();

      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
          billing_details: {
            name:  bookingData.guestName,
            email: bookingData.guestEmail,
            phone: bookingData.guestPhone,
          }
        }
      });
      if (stripeError) throw new Error(stripeError.message);

      const confNumber = generateConfirmationNumber();
      await fetch('/.netlify/functions/save-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...bookingData,
          paymentIntentId:    paymentIntent.id,
          confirmationNumber: confNumber,
          createdAt:          new Date().toISOString()
        })
      });

      const p = new URLSearchParams({
        conf:     confNumber,
        name:     bookingData.guestName,
        email:    bookingData.guestEmail,
        checkin:  bookingData.checkIn,
        checkout: bookingData.checkOut,
        nights:   bookingData.nights,
        total:    FAMILY_RATE,
        guests:   bookingData.guestCount,
        type:     'family'
      });
      window.location.href = `/confirmation.html?${p}`;

    } catch (err) {
      document.getElementById('family-card-errors').textContent = err.message;
      showToast(err.message, 'error');
      setPayLoading(false, 'family');
    }
  });

  function validateFamilyForm() {
    const required = ['family-name', 'family-email', 'family-phone'];
    let valid = true;
    required.forEach(id => {
      const el = document.getElementById(id);
      if (el && !el.value.trim()) {
        el.style.borderColor = '#c0392b'; valid = false;
        el.addEventListener('input', () => el.style.borderColor = '', { once: true });
      }
    });
    if (!valid) showToast('Please fill in all required fields.', 'error');
    return valid;
  }
})();


/* ── Shared helpers ── */
function setPayLoading(loading, type) {
  const btnId = type === 'family' ? 'family-pay-btn' : 'pay-btn';
  const btn   = document.getElementById(btnId);
  if (!btn) return;
  if (loading) {
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div>&nbsp; Processing payment…';
  } else {
    btn.disabled = false;
    btn.textContent = type === 'family'
      ? 'Pay $500 — Confirm Booking'
      : (window._bookingTotal ? `Pay ${formatCurrency(window._bookingTotal)} — Confirm Booking` : 'Confirm Booking');
  }
}

function formatDateRange(start, end) {
  const s = parseDate(start);
  const e = parseDate(end);
  const opts = { month: 'short', day: 'numeric' };
  if (s.getFullYear() !== e.getFullYear()) {
    return `${s.toLocaleDateString('en-US', { ...opts, year: 'numeric' })} – ${e.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`;
  }
  return `${s.toLocaleDateString('en-US', opts)} – ${e.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`;
}

function getNightCount(start, end) {
  return Math.round((parseDate(end) - parseDate(start)) / 86400000);
}

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
