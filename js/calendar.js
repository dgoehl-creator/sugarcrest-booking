/**
 * SugarCrest — Availability Calendar
 * Renders a two-month interactive calendar showing available / booked dates.
 * Handles high-season (Memorial Day – Labor Day) minimum stay logic.
 */

'use strict';

/* ── Constants ── */
const NIGHTLY_RATE  = 1500;
const MIN_STAY_HIGH = 5;
const MIN_STAY_OFF  = 3;

/**
 * Calculate Memorial Day (last Monday of May) for a given year.
 */
function getMemorialDay(year) {
  const lastDay = new Date(year, 5, 0); // May 31
  const dow = lastDay.getDay();
  const offset = dow === 1 ? 0 : (dow === 0 ? -6 : 1 - dow);
  return new Date(year, 4, lastDay.getDate() + offset);
}

/**
 * Calculate Labor Day (first Monday of September) for a given year.
 */
function getLaborDay(year) {
  const d = new Date(year, 8, 1); // Sep 1
  const dow = d.getDay();
  const offset = dow === 1 ? 0 : (dow === 0 ? 1 : 8 - dow);
  return new Date(year, 8, 1 + offset);
}

/**
 * Returns true if the date falls within high season.
 */
function isHighSeason(date) {
  const year = date.getFullYear();
  const mem  = getMemorialDay(year);
  const lab  = getLaborDay(year);
  return date >= mem && date <= lab;
}

/**
 * Returns minimum stay (nights) for a given check-in date.
 */
function getMinStay(checkInDate) {
  return isHighSeason(checkInDate) ? MIN_STAY_HIGH : MIN_STAY_OFF;
}

/**
 * Format a Date as YYYY-MM-DD string (local time, no UTC shift).
 */
function dateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Parse YYYY-MM-DD to local Date (avoids UTC midnight issues).
 */
function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Add N days to a Date, returns new Date.
 */
function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

/**
 * SugarCrest Calendar class.
 * Usage: new SugarCrestCalendar(containerEl, { bookedDates, onSelect })
 *
 * bookedDates: array of "YYYY-MM-DD" strings (all booked/blocked dates).
 * onSelect: callback({ checkIn, checkOut, nights, minStay, total })
 */
class SugarCrestCalendar {
  constructor(container, options = {}) {
    this.container   = typeof container === 'string' ? document.querySelector(container) : container;
    this.bookedDates = new Set(options.bookedDates || []);
    this.blockedByFamily = new Set(options.blockedByFamily || []); // family-allocated dates hidden from public
    this.onSelect    = options.onSelect || null;
    this.selectionMode = options.selectionMode || 'range'; // 'range' | 'single'

    this.today      = new Date(); this.today.setHours(0,0,0,0);
    this.viewYear   = this.today.getFullYear();
    this.viewMonth  = this.today.getMonth(); // 0-indexed

    this.checkIn    = null;
    this.checkOut   = null;
    this.hoverDate  = null;
    this.step       = 'checkin'; // 'checkin' | 'checkout'

    this.render();
  }

  /* ── Compute fully blocked dates (booked + family) ── */
  isBlocked(dateStr) {
    return this.bookedDates.has(dateStr) || this.blockedByFamily.has(dateStr);
  }

  /* ── Render full calendar widget ── */
  render() {
    this.container.innerHTML = `
      <div class="calendar-header">
        <button class="calendar-nav-btn" id="cal-prev">&#8249;</button>
        <span class="calendar-title" id="cal-title"></span>
        <button class="calendar-nav-btn" id="cal-next">&#8250;</button>
      </div>
      <div class="calendar-months" id="cal-months"></div>
      <div class="calendar-legend">
        <div class="calendar-legend-item"><div class="legend-dot legend-available"></div> Available</div>
        <div class="calendar-legend-item"><div class="legend-dot legend-booked"></div> Unavailable</div>
        <div class="calendar-legend-item"><div class="legend-dot legend-selected"></div> Selected</div>
      </div>
    `;

    this.container.querySelector('#cal-prev').addEventListener('click', () => this.navigate(-1));
    this.container.querySelector('#cal-next').addEventListener('click', () => this.navigate(1));

    this.renderMonths();
  }

  navigate(dir) {
    this.viewMonth += dir;
    if (this.viewMonth > 11) { this.viewMonth = 0; this.viewYear++; }
    if (this.viewMonth < 0)  { this.viewMonth = 11; this.viewYear--; }
    this.renderMonths();
  }

  renderMonths() {
    const title = document.getElementById('cal-title');
    const months = document.getElementById('cal-months');
    if (!title || !months) return;

    const m1 = { year: this.viewYear, month: this.viewMonth };
    let m2month = this.viewMonth + 1;
    let m2year  = this.viewYear;
    if (m2month > 11) { m2month = 0; m2year++; }
    const m2 = { year: m2year, month: m2month };

    const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    title.textContent = `${MONTH_NAMES[m1.month]} ${m1.year}`;

    months.innerHTML = `
      <div class="calendar-month">${this.renderMonth(m1)}</div>
      <div class="calendar-month">${this.renderMonth(m2)}</div>
    `;

    // Attach events
    months.querySelectorAll('.calendar-day[data-date]').forEach(el => {
      el.addEventListener('click',      () => this.handleClick(el.dataset.date));
      el.addEventListener('mouseenter', () => this.handleHover(el.dataset.date));
      el.addEventListener('mouseleave', () => { this.hoverDate = null; this.renderMonths(); });
    });
  }

  renderMonth({ year, month }) {
    const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const DAY_HEADERS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

    const firstDay   = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    let html = `<h4>${MONTH_NAMES[month]} ${year}</h4>
      <div class="calendar-grid">
        ${DAY_HEADERS.map(d => `<div class="calendar-day-header">${d}</div>`).join('')}
    `;

    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) {
      html += `<div class="calendar-day empty"></div>`;
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const key  = dateKey(date);
      const classes = this.getDayClasses(date, key);
      html += `<div class="calendar-day ${classes}" data-date="${key}">${d}</div>`;
    }

    html += `</div>`;
    return html;
  }

  getDayClasses(date, key) {
    const classes = [];
    const isPast  = date < this.today;

    if (isPast) { classes.push('past'); return classes.join(' '); }
    if (this.isBlocked(key)) { classes.push('booked'); return classes.join(' '); }
    if (dateKey(date) === dateKey(this.today)) classes.push('today');

    classes.push('available');

    // Selection state
    const isCheckIn  = this.checkIn  && dateKey(this.checkIn)  === key;
    const isCheckOut = this.checkOut && dateKey(this.checkOut) === key;
    const hover = this.hoverDate ? parseDate(this.hoverDate) : null;

    if (isCheckIn)  classes.push('selected-start');
    if (isCheckOut) classes.push('selected-end');

    // In-range highlight
    if (this.checkIn && !this.checkOut && hover && date > this.checkIn && date <= hover) {
      classes.push('in-range');
    }
    if (this.checkIn && this.checkOut && date > this.checkIn && date < this.checkOut) {
      classes.push('in-range');
    }

    return classes.join(' ');
  }

  handleClick(dateStr) {
    const date = parseDate(dateStr);
    if (date < this.today || this.isBlocked(dateStr)) return;

    if (this.step === 'checkin' || (this.checkIn && this.checkOut)) {
      this.checkIn  = date;
      this.checkOut = null;
      this.step = 'checkout';
    } else {
      // checkout step
      if (date <= this.checkIn) {
        // Clicked before or on check-in — restart
        this.checkIn = date;
        this.checkOut = null;
        this.step = 'checkout';
      } else {
        // Validate minimum stay
        const nights  = Math.round((date - this.checkIn) / 86400000);
        const minStay = getMinStay(this.checkIn);
        if (nights < minStay) {
          this.showMinStayWarning(minStay);
          return;
        }
        // Check for blocked dates in range
        if (this.hasBlockedInRange(this.checkIn, date)) {
          this.showBlockedInRangeWarning();
          return;
        }
        this.checkOut = date;
        this.step = 'checkin';
        this.fireSelect();
      }
    }
    this.renderMonths();
  }

  handleHover(dateStr) {
    if (this.step === 'checkout' && this.checkIn) {
      this.hoverDate = dateStr;
      this.renderMonths();
    }
  }

  hasBlockedInRange(start, end) {
    const d = addDays(start, 1);
    while (d < end) {
      if (this.isBlocked(dateKey(d))) return true;
      d.setDate(d.getDate() + 1);
    }
    return false;
  }

  showMinStayWarning(minStay) {
    const msg = `Minimum stay is ${minStay} nights${minStay === 5 ? ' during summer (Memorial Day – Labor Day)' : ''}.`;
    if (typeof showToast === 'function') showToast(msg, 'error');
    else alert(msg);
  }

  showBlockedInRangeWarning() {
    const msg = 'Selected range includes unavailable dates. Please choose a different period.';
    if (typeof showToast === 'function') showToast(msg, 'error');
    else alert(msg);
  }

  fireSelect() {
    if (!this.checkIn || !this.checkOut || !this.onSelect) return;
    const nights  = Math.round((this.checkOut - this.checkIn) / 86400000);
    const minStay = getMinStay(this.checkIn);
    const total   = nights * NIGHTLY_RATE;
    this.onSelect({ checkIn: this.checkIn, checkOut: this.checkOut, nights, minStay, total });
  }

  /** Programmatically set dates (e.g. from URL params) */
  setDates(checkInStr, checkOutStr) {
    if (!checkInStr || !checkOutStr) return;
    this.checkIn  = parseDate(checkInStr);
    this.checkOut = parseDate(checkOutStr);
    this.step = 'checkin';
    this.fireSelect();
    this.renderMonths();
  }

  /** Update booked dates (after fetch) */
  setBookedDates(dates) {
    this.bookedDates = new Set(dates);
    this.renderMonths();
  }

  /** Update family-blocked dates */
  setFamilyDates(dates) {
    this.blockedByFamily = new Set(dates);
    this.renderMonths();
  }

  reset() {
    this.checkIn  = null;
    this.checkOut = null;
    this.step = 'checkin';
    this.renderMonths();
  }
}

/* ── Shared helpers used across pages ── */
function showToast(message, type = '') {
  let toast = document.getElementById('global-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'global-toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.className = `toast ${type}`;
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => toast.classList.remove('show'), 4000);
}

function formatDate(date) {
  if (!date) return '—';
  return date.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount);
}

function generateConfirmationNumber() {
  const prefix = 'SC';
  const rand   = Math.random().toString(36).substring(2, 8).toUpperCase();
  const ts     = Date.now().toString(36).slice(-4).toUpperCase();
  return `${prefix}-${rand}-${ts}`;
}

// Expose globals
window.SugarCrestCalendar = SugarCrestCalendar;
window.getMinStay         = getMinStay;
window.isHighSeason       = isHighSeason;
window.dateKey            = dateKey;
window.parseDate          = parseDate;
window.addDays            = addDays;
window.formatDate         = formatDate;
window.formatCurrency     = formatCurrency;
window.showToast          = showToast;
window.generateConfirmationNumber = generateConfirmationNumber;
window.NIGHTLY_RATE       = NIGHTLY_RATE;
