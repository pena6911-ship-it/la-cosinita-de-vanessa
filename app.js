/* ══ Supabase ══════════════════════════════════════════════ */
const _sb = window.supabase.createClient(
  'https://nqrlxslgstajryimndsx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xcmx4c2xnc3RhanJ5aW1uZHN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwODkyNjcsImV4cCI6MjA5NjY2NTI2N30.40pYlAIXARiKWqBVZGPIpagDCxo7-88pRgDIFLmgAgA'
);
if (window.emailjs) emailjs.init('q62O3cYHsOLIk7497');

function generateOrderRef() {
  var d   = new Date();
  var dt  = d.toISOString().slice(0, 10).replace(/-/g, '');
  var rnd = Math.random().toString(36).substr(2, 4).toUpperCase();
  return 'LCV-' + dt + '-' + rnd;
}

/* ── PRODUCT DATA ── */
let PRODUCTS = {};

let currentProduct = null;
let currentSizeIdx = 0;

/* ── Open product sheet ── */
function openSheet(key) {
  currentProduct = key;
  currentSizeIdx = 0;
  const p = PRODUCTS[key];
  const body = document.getElementById('sheet-body');

  /* Build image */
  let imgHTML = '';
  if (p.img) {
    imgHTML = `<div class="sheet-img-wrap"><img src="${p.img}" alt="${stripHtmlSimple(p.name)}"/></div>`;
  } else {
    imgHTML = `<div class="sheet-img-wrap"><div class="sheet-img-emoji" style="${p.emojiStyle||''}">${p.emoji||'🎂'}</div></div>`;
  }

  /* Build size chips */
  const sizeChips = p.sizes.map((s,i) => `
    <input type="radio" name="sheet-size" id="sz-${i}" class="sz-radio" value="${i}" ${i===0?'checked':''} onchange="sheetSizeChange(${i})"/>
    <label for="sz-${i}" class="sz-label">
      <span class="sz-inch">${s.label}</span>
      <span class="sz-serves">${s.serves||''}</span>
      <span class="sz-price">$${s.price}${p.priceNote?'+':''}</span>
    </label>
  `).join('');

  /* Build serving guide */
  let serveHTML = '';
  if (p.serveGuide && p.serveGuide.length) {
    const rows = p.serveGuide.map(r=>`<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('');
    serveHTML = `
      <div class="serve-toggle" onclick="toggleServeGuide(this)">
        <span>📏 Serving Size Guide</span>
        <span class="serve-toggle-arrow">▾</span>
      </div>
      <table class="serve-table"><tbody>${rows}</tbody></table>
    `;
  }

  /* Flavor select(s) render dynamically per size (a size may ask for several
     flavor picks via size.flavorPicks). Filling rendered alongside. */
  const hasFlavors  = p.flavors  && p.flavors.length  > 0;
  const hasFillings = p.fillings && p.fillings.length > 0;
  let flavorHTML = '';
  if (hasFlavors) flavorHTML += `<div id="sheet-flavor-wrap"></div>`;
  if (hasFillings) {
    flavorHTML += `<div class="flavor-wrap" id="sheet-filling-wrap"${hasFlavors ? '' : ' style="margin-top:16px"'}>
      <span class="sel-label">${hasFlavors ? 'Cake Filling' : 'Filling'}</span>
      <select class="flavor-sel" id="sheet-filling">${p.fillings.map(f=>`<option>${f}</option>`).join('')}</select>
    </div>`;
  }

  /* Gluten-Free checkbox (only if any size has priceGF) */
  let gfHTML = p.hasGF ? `<div class="flavor-wrap" style="margin-top:12px">
    <label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:14px;color:#4A0E2E;font-weight:600">
      <input type="checkbox" id="sheet-gf" style="accent-color:#E91E8C;width:18px;height:18px" onchange="updateSheetPrice()">
      Gluten-Free <span style="color:#E91E8C">+$20</span>
    </label></div>` : '';

  /* Extras checkboxes (from serve_guide.extras) */
  let extrasHTML = (p.extras||[]).map((ex,i)=>`<div class="flavor-wrap" style="margin-top:12px">
    <label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:14px;color:#4A0E2E;font-weight:600">
      <input type="checkbox" id="sheet-extra-${i}" data-price="${ex.price}" style="accent-color:#E91E8C;width:18px;height:18px" onchange="updateSheetPrice()">
      ${ex.label} <span style="color:#E91E8C">+$${ex.price}</span>
    </label></div>`).join('');

  body.innerHTML = `
    ${imgHTML}
    <span class="sheet-badge">${p.badge}</span>
    <h2 class="sheet-name">${p.name}</h2>
    <p class="sheet-desc">${p.desc}</p>

    <div class="sheet-price" id="sheet-price-display">
      $${p.sizes[0].price}${p.priceNote?'<small> & up</small>':''}
    </div>

    <span class="sel-label">Size</span>
    <div class="size-chips">${sizeChips}</div>
    ${serveHTML}
    ${flavorHTML}
    ${gfHTML}
    ${extrasHTML}

    <div class="zone-box">
      <span class="zone-icon">🗺️</span>
      <div class="zone-text">
        <strong>Delivery Zone</strong>
        Manhattan &amp; The Bronx only · 2-hour windows, 9 AM– 6 PM daily · Rush orders available — contact Vanessa first.
      </div>
    </div>

    <button class="add-btn" onclick="addToOrder()">🛒 &nbsp;Add to Cart</button>
    <a href="custom-order.html" class="custom-order-link" onclick="closeSheet()">Need a fully custom design? →</a>
  `;

  renderFlavorSelects();
  applyFillingVisibility();
  document.getElementById('sheet-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

/* Render one flavor dropdown per "pick" for the selected size.
   A size can request multiple picks via size.flavorPicks (e.g. a 3-cake trio). */
function renderFlavorSelects() {
  const p = PRODUCTS[currentProduct];
  const wrap = document.getElementById('sheet-flavor-wrap');
  if (!wrap || !p || !p.flavors || !p.flavors.length) return;
  const hasFillings = p.fillings && p.fillings.length > 0;
  const size = p.sizes[currentSizeIdx] || {};
  const picks = Math.max(1, parseInt(size.flavorPicks, 10) || 1);
  const opts = p.flavors.map(f => `<option>${f}</option>`).join('');
  let html = '';
  for (let i = 0; i < picks; i++) {
    const label = picks > 1 ? `Cake ${i + 1} flavor` : (hasFillings ? 'Cake Flavor' : 'Flavor');
    html += `<div class="flavor-wrap" style="margin-top:16px">
      <span class="sel-label">${label}</span>
      <select class="flavor-sel js-flavor" id="sheet-flavor${i === 0 ? '' : '-' + (i + 1)}">${opts}</select>
    </div>`;
  }
  wrap.innerHTML = html;
}
function collectFlavorValues() {
  return Array.from(document.querySelectorAll('#sheet-flavor-wrap .js-flavor')).map(s => s.value);
}
function closeSheet(e) {
  if (!e || e.target.id==='sheet-overlay') {
    document.getElementById('sheet-overlay').classList.remove('open');
    document.body.style.overflow = '';
  }
}

function sheetSizeChange(idx) {
  currentSizeIdx = idx;
  renderFlavorSelects();
  applyFillingVisibility();
  updateSheetPrice();
}

/* A size has no filling option if Vanessa unchecked "Filling?" for it in the
   admin dashboard, which stores "noFilling":true on that size in the DB. */
function fillingAllowedForSize(size) {
  if (!size) return true;
  return size.noFilling !== true;
}
function applyFillingVisibility() {
  const p = PRODUCTS[currentProduct];
  if (!p) return;
  const w = document.getElementById('sheet-filling-wrap');
  if (!w) return;
  w.style.display = fillingAllowedForSize(p.sizes[currentSizeIdx]) ? '' : 'none';
}
function isFillingVisible() {
  const w = document.getElementById('sheet-filling-wrap');
  return !!w && w.style.display !== 'none';
}

function updateSheetPrice() {
  const p = PRODUCTS[currentProduct];
  const size = p.sizes[currentSizeIdx];
  let price = size.price;
  const gfEl = document.getElementById('sheet-gf');
  if (gfEl && gfEl.checked) {
    price = size.priceGF ? size.priceGF : price + 20;
  }
  document.querySelectorAll('[id^="sheet-extra-"]').forEach(function(cb) {
    if (cb.checked) price += parseFloat(cb.dataset.price) || 0;
  });
  const el = document.getElementById('sheet-price-display');
  if (el) el.innerHTML = `$${price}${p.priceNote?'<small> & up</small>':''}`;
}

function toggleServeGuide(el) {
  el.classList.toggle('open');
}

/* ── CART ── */
let cart = loadCart();
function loadCart() {
  try { return JSON.parse(localStorage.getItem('lcv_cart') || '[]') || []; }
  catch (e) { return []; }
}
function saveCart() {
  try { localStorage.setItem('lcv_cart', JSON.stringify(cart)); } catch (e) {}
  updateCartBadge();
}
function updateCartBadge() {
  var badge = document.getElementById('cart-badge');
  if (!badge) return;
  var totalQty = cart.reduce(function (s, i) { return s + (i.qty || 0); }, 0);
  if (totalQty > 0) { badge.textContent = totalQty; badge.style.display = 'flex'; }
  else { badge.style.display = 'none'; }
}
function setActiveNav() {
  var file = location.pathname.split('/').pop() || 'index.html';
  if (file === '') file = 'index.html';
  document.querySelectorAll('.nav-links a').forEach(function (a) {
    var href = a.getAttribute('href') || '';
    var hrefFile = href.split('#')[0].split('/').pop();
    var active = (file === 'index.html') ? (href === '#shop' || hrefFile === 'index.html') : (hrefFile === file);
    a.classList.toggle('active', active);
  });
}

function getSheetPrice() {
  const p = PRODUCTS[currentProduct];
  const size = p.sizes[currentSizeIdx];
  let price = size.price;
  const gfEl = document.getElementById('sheet-gf');
  if (gfEl && gfEl.checked) {
    price = size.priceGF ? size.priceGF : price + 20;
  }
  document.querySelectorAll('[id^="sheet-extra-"]').forEach(function(cb) {
    if (cb.checked) price += parseFloat(cb.dataset.price) || 0;
  });
  return price;
}

function addToOrder() {
  const p = PRODUCTS[currentProduct];
  const size = p.sizes[currentSizeIdx];
  const flavorText = collectFlavorValues().join(', ');
  const fillingEl = isFillingVisible() ? document.getElementById('sheet-filling') : null;
  const gfEl      = document.getElementById('sheet-gf');
  let detail = '';
  if (flavorText && fillingEl) {
    detail = flavorText + ' · ' + fillingEl.value;
  } else if (flavorText) {
    detail = flavorText;
  } else if (fillingEl) {
    detail = fillingEl.value;
  }
  if (gfEl && gfEl.checked) detail += ' · Gluten-Free (+$20)';
  document.querySelectorAll('[id^="sheet-extra-"]').forEach(function(cb) {
    if (cb.checked) {
      const lbl   = cb.parentElement.textContent.trim().replace(/\+\$[\d.]+[^+]*$/, '').trim();
      const price = parseFloat(cb.dataset.price) || 0;
      detail += ' · ' + lbl + ' (+$' + price + ')';
    }
  });
  const price = getSheetPrice();
  cart.push({
    id:    `${currentProduct}-${(size.id||size.label)}-${Date.now()}`,
    key:   currentProduct,
    badge: p.badge,
    size:  size.label,
    detail,
    price,
    qty:   1
  });
  saveCart();
  renderCart();
  closeSheet();
  showToast(`✓ ${size.label} ${p.badge} added to cart!`);
  setTimeout(() => openCart(), 520);
}
function renderCart() {
  const list   = document.getElementById('cart-items-list');
  const badge  = document.getElementById('cart-badge');
  const footer = document.getElementById('cart-footer');
  const subEl  = document.getElementById('cart-subtotal-num');
  const cntEl  = document.getElementById('cart-items-count');

  const totalQty   = cart.reduce((s, i) => s + i.qty, 0);
  const totalPrice = cart.reduce((s, i) => s + i.price * i.qty, 0);

  /* Nav badge */
  if (totalQty > 0) { badge.textContent = totalQty; badge.style.display = 'flex'; }
  else { badge.style.display = 'none'; }

  /* Footer */
  footer.style.display = cart.length ? '' : 'none';
  subEl.textContent = totalPrice;
  cntEl.textContent = `${totalQty} item${totalQty !== 1 ? 's' : ''} in your order`;

  /* Items list */
  if (cart.length === 0) {
    list.innerHTML = `
      <div class="cart-empty">
        <div class="cart-empty-icon">🛒</div>
        <p>Your cart is empty.<br>Choose a cake to get started!</p>
      </div>`;
    return;
  }

  list.innerHTML = cart.map((item, idx) => `
    <div class="cart-item">
      <div class="cart-item-emoji">${(PRODUCTS[item.key] && PRODUCTS[item.key].emoji) || '🎂'}</div>
      <div class="cart-item-info">
        <div class="cart-item-name">${item.badge} · ${item.size}</div>
        <div class="cart-item-detail" title="${item.detail}">${item.detail}</div>
        <div class="cart-item-row">
          <span class="cart-item-price">$${item.price * item.qty}</span>
          <div class="cart-item-controls">
            <button class="cart-qty-btn" onclick="changeQty(${idx},-1)">−</button>
            <span class="cart-qty-num">${item.qty}</span>
            <button class="cart-qty-btn" onclick="changeQty(${idx},1)">+</button>
            <button class="cart-remove-btn" onclick="removeItem(${idx})" title="Remove">×</button>
          </div>
        </div>
      </div>
    </div>`).join('');
}

function changeQty(idx, delta) {
  cart[idx].qty = Math.max(1, cart[idx].qty + delta);
  saveCart();
  renderCart();
}

function removeItem(idx) {
  cart.splice(idx, 1);
  saveCart();
  renderCart();
  if (cart.length === 0) showToast('Cart cleared ✦');
}

function openCart() { 
  document.getElementById('cart-overlay').classList.add('open');
  document.getElementById('cart-drawer').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeCart() { 
  document.getElementById('cart-overlay').classList.remove('open');
  document.getElementById('cart-drawer').classList.remove('open');
  document.body.style.overflow = '';
}

var currentCheckoutFlow = 'cart';
var _coPayPalRendered = false;

function proceedToCheckout() {
  if (!cart.length) return;
  currentCheckoutFlow = 'cart';
  _coPayPalRendered = false;
  closeCart();

  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 7);
  const minStr = minDate.toISOString().split('T')[0];
  const total  = cart.reduce((s,i) => s + i.price * i.qty, 0);

  const summaryRows = cart.map(item =>
    '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(233,30,140,0.09);font-size:13px;">' +
    '<span><strong>' + item.qty + '×</strong> ' + item.badge + ' ' + item.size + '<br><span style="font-size:11px;color:var(--text-mid)">' + item.detail + '</span></span>' +
    '<span style="font-weight:600;color:#E91E8C;white-space:nowrap;padding-left:10px">$' + (item.price * item.qty) + '</span></div>'
  ).join('');

  const body = document.getElementById('checkout-body');
  body.innerHTML =
    '<div style="margin-bottom:18px;">' +
      '<div class="section-label" style="margin-bottom:4px">✦ Order Summary</div>' +
      summaryRows +
      '<div style="display:flex;justify-content:space-between;padding:12px 0 0;font-size:15px;font-weight:600;">' +
        '<span>Base Total</span><span style="color:#E91E8C">$' + total + '</span>' +
      '</div>' +
    '</div>' +

    '<div class="co-step-label">👤 Your Information</div>' +
    '<div class="co-field-row">' +
      '<div class="co-field"><label>First Name</label><input type="text" id="co-fname" placeholder="María" autocomplete="given-name"/></div>' +
      '<div class="co-field"><label>Last Name</label><input type="text" id="co-lname" placeholder="Rodríguez" autocomplete="family-name"/></div>' +
    '</div>' +
    '<div class="co-field"><label>Email</label><input type="email" id="co-email" placeholder="maria@email.com" autocomplete="email" inputmode="email"/></div>' +
    '<div class="co-field"><label>Phone</label><input type="tel" id="co-phone" placeholder="(555) 000-0000" autocomplete="tel" inputmode="tel"/></div>' +

    '<div class="co-step-label">📅 Delivery Details</div>' +
    '<div class="co-field-row">' +
      '<div class="co-field"><label>Delivery Date</label><input type="date" id="co-date" min="' + minStr + '" value="' + minStr + '"/></div>' +
      '<div class="co-field"><label>Delivery Time</label>' +
        '<select id="co-time"><option>9:00 AM</option><option>10:00 AM</option><option>11:00 AM</option><option>12:00 PM</option><option>1:00 PM</option><option>2:00 PM</option><option>3:00 PM</option><option>4:00 PM</option><option>5:00 PM</option><option>6:00 PM</option></select>' +
      '</div>' +
    '</div>' +
    '<div class="co-field"><label>Delivery Address</label><input type="text" id="co-address" placeholder="123 Main St, Manhattan / Bronx, NY" autocomplete="street-address"/></div>' +

    '<div class="co-step-label">🎨 Theme & Customization Notes</div>' +
    '<div class="co-field"><label>Theme, Colors & Decorations</label><textarea id="co-notes" placeholder="Describe your vision — theme, color palette, decorations, text on cake, style... ¡Inglés o español!"></textarea></div>' +
    '<div class="co-field"><label>Allergies / Dietary Notes <span style="font-size:9px;font-weight:400;letter-spacing:0;text-transform:none">(optional)</span></label><input type="text" id="co-allergies" placeholder="e.g. nut-free, gluten-free, no dairy..."/></div>' +

    '<div class="price-notice">' +
      '<div class="price-notice-title">⚠️ Pricing Notice</div>' +
      '<div class="price-notice-text">The total shown (<strong>$' + total + '</strong>) reflects <strong>base prices only</strong>. Depending on materials, customization, and your required timeframe, there may be an <strong>additional agreed-upon charge</strong> communicated before confirmation and due at delivery.</div>' +
    '</div>' +
    '<div class="ack-wrap">' +
      '<label class="ack-label">' +
        '<input type="checkbox" id="co-ack" onchange="togglePlaceBtn()"/>' +
        '<span>I understand that <strong>$' + total + '</strong> is the base total and additional charges for customization may apply — to be agreed upon before my order is confirmed.</span>' +
      '</label>' +
    '</div>' +
    '<div class="deposit-amount-display" style="margin:14px 0 10px">' +'<span>Deposit due today (50%)</span><strong id="co-deposit-text">$' + (total * 0.5).toFixed(2) + '</strong></div>' +
    '<div id="co-paypal-container" class="paypal-wrapper" style="display:none;"></div>' +
    '<div class="paypal-ack-hint" id="co-paypal-hint">☝️ Check the acknowledgement above to unlock payment</div>' +
    '<div class="secure-badge">🔒 Payments processed securely via PayPal — PCI DSS Compliant</div>' +
    '<div class="co-footer-note">📍 Manhattan & The Bronx only · Vanessa will contact you within 24 hrs.</div>';

  body.scrollTop = 0;
  document.getElementById('checkout-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeCheckout(e) {
  if (!e || e.target.id === 'checkout-overlay' || e.target.classList.contains('sheet-close')) {
    document.getElementById('checkout-overlay').classList.remove('open');
    document.body.style.overflow = '';
  }
}

async function submitCartOrder(paypalDetails) {
  const paypalOrderId = paypalDetails ? paypalDetails.id : null;
  const required = ['co-fname','co-lname','co-email','co-phone','co-date','co-address'];
  let ok = true;
  required.forEach(function(id) {
    const el = document.getElementById(id);
    if (!el || !el.value.trim()) {
      if (el) { el.style.borderColor = '#E91E8C'; el.addEventListener('input', function(){ el.style.borderColor=''; }, {once:true}); }
      ok = false;
    }
  });
  if (!ok) { showToast('Please fill in all required fields ✦'); return; }

  /* Loading state */
  const btn = document.querySelector('#checkout-overlay .place-order-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }

  /* Collect form values */
  const fname    = document.getElementById('co-fname').value.trim();
  const lname    = document.getElementById('co-lname').value.trim();
  const email    = document.getElementById('co-email').value.trim();
  const phone    = document.getElementById('co-phone').value.trim();
  const date     = document.getElementById('co-date').value;
  const timeEl   = document.getElementById('co-time');
  const time     = timeEl ? timeEl.value : '';
  const address  = document.getElementById('co-address').value.trim();
  const notesEl  = document.getElementById('co-notes');
  const notes    = notesEl ? notesEl.value.trim() : '';
  const algEl    = document.getElementById('co-allergies');
  const allergies = algEl ? algEl.value.trim() : '';

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const items    = JSON.stringify(cart.map(i => ({
    key: i.key, name: i.badge, size: i.size, detail: i.detail,
    price: i.price, qty: i.qty
  })));

  try {
    const cartOrderRef = generateOrderRef();
    const { data: customer, error: custErr } = await _sb
      .from('customers')
      .upsert({ first_name: fname, last_name: lname, email, phone, source: 'web_order' }, { onConflict: 'email', ignoreDuplicates: false })
      .select()
      .single();
    if (custErr) throw custErr;

    const { error: orderErr } = await _sb
      .from('orders')
      .insert({
        customer_id:      customer.id,
        order_reference:  cartOrderRef,
        order_type:       'cart',
        order_items:      items,
        order_subtotal:   subtotal,
        order_total:      subtotal,
        payment_status:   paypalOrderId ? 'deposit_paid' : 'pending',
        paypal_order_id:  paypalOrderId,
        delivery_date:    date,
        delivery_time:    time,
        delivery_address: address,
        theme_notes:      notes,
        allergies:        allergies,
        source:           'web_order'
      });
    if (orderErr) throw orderErr;

    const cartItemsSummary = cart.map(i => i.qty + '× ' + i.size + ' ' + i.badge + ' — $' + (i.price * i.qty)).join('\n');
    sendOrderEmails({ name: fname + ' ' + lname, email, phone,
      orderRef: cartOrderRef, items: cartItemsSummary,
      date, time, address, notes });

    document.getElementById('checkout-overlay').classList.remove('open');
    document.body.style.overflow = '';
    cart = [];
    saveCart();
    renderCart();
    document.getElementById('success-modal').classList.add('open');
    document.body.style.overflow = 'hidden';
  } catch (err) {
    console.error('Order error:', err);
    showToast('Something went wrong — please try again or call us directly.');
    if (btn) { btn.disabled = false; btn.textContent = '🎂 Place Order'; }
  }
}


/* ══ Flow 1: Product Checkout Step 2 ══ */
function showCheckoutStep() {
  currentCheckoutFlow = 'product';
  _coPayPalRendered = false;
  var p    = PRODUCTS[currentProduct];
  var size = p.sizes[currentSizeIdx];
  var flavorText = collectFlavorValues().join(', ');
  var fillingEl = isFillingVisible() ? document.getElementById('sheet-filling') : null;
  var dulceEl   = document.getElementById('sheet-dulce');
  var detail = flavorText;
  if (fillingEl) detail += ' · ' + fillingEl.value;
  if (dulceEl && dulceEl.checked) detail += ' · Dulce de Leche (+$5)';
  var price = getSheetPrice();
  var pKey  = currentProduct;

  var minDate = new Date();
  minDate.setDate(minDate.getDate() + 7);
  var minStr = minDate.toISOString().split('T')[0];

  var html = '';
  html += '<button class="checkout-back-btn" onclick="openSheet(\'' + pKey + '\')">&#8592; Back to product</button>';
  html += '<div class="checkout-summary">';
  html +=   '<div class="checkout-summary-left">';
  html +=     '<div class="checkout-summary-name">' + p.badge + ' &middot; ' + size.label + '</div>';
  html +=     '<div class="checkout-summary-detail">' + detail + '</div>';
  html +=   '</div>';
  html +=   '<div class="checkout-summary-price">$' + price + '</div>';
  html += '</div>';

  html += '<div class="co-step-label">&#128100; Your Information</div>';
  html += '<div class="co-field-row">';
  html +=   '<div class="co-field"><label>First Name</label><input type="text" id="co-fname" placeholder="María" autocomplete="given-name"/></div>';
  html +=   '<div class="co-field"><label>Last Name</label><input type="text" id="co-lname" placeholder="Rodríguez" autocomplete="family-name"/></div>';
  html += '</div>';
  html += '<div class="co-field"><label>Email</label><input type="email" id="co-email" placeholder="maria@email.com" autocomplete="email" inputmode="email"/></div>';
  html += '<div class="co-field"><label>Phone</label><input type="tel" id="co-phone" placeholder="(555) 000-0000" autocomplete="tel" inputmode="tel"/></div>';

  html += '<div class="co-step-label">&#128197; Delivery Details</div>';
  html += '<div class="co-field-row">';
  html +=   '<div class="co-field"><label>Delivery Date</label><input type="date" id="co-date" min="' + minStr + '" value="' + minStr + '"/></div>';
  html +=   '<div class="co-field"><label>Delivery Time</label>';
  html +=   '<select id="co-time"><option>9:00 AM</option><option>10:00 AM</option><option>11:00 AM</option><option>12:00 PM</option><option>1:00 PM</option><option>2:00 PM</option><option>3:00 PM</option><option>4:00 PM</option><option>5:00 PM</option><option>6:00 PM</option></select></div>';
  html += '</div>';
  html += '<div class="co-field"><label>Delivery Address</label><input type="text" id="co-address" placeholder="123 Main St, Manhattan / Bronx, NY" autocomplete="street-address"/></div>';

  html += '<div class="co-step-label">&#127912; Theme &amp; Customization Notes</div>';
  html += '<div class="co-field"><label>Theme, Colors &amp; Decorations</label><textarea id="co-notes" placeholder="Describe your vision — theme, color palette, decorations, text on cake, style... ¡Inglés o español!"></textarea></div>';
  html += '<div class="co-field"><label>Allergies / Dietary Notes <span style="font-size:9px;font-weight:400;letter-spacing:0;text-transform:none">(optional)</span></label><input type="text" id="co-allergies" placeholder="e.g. nut-free, gluten-free, no dairy..."/></div>';

  html += '<div class="price-notice">';
  html +=   '<div class="price-notice-title">&#9888;&#65039; Pricing Notice</div>';
  html +=   '<div class="price-notice-text">The price shown (<strong>$' + price + '</strong>) is the <strong>base price</strong>. Depending on materials, customization options, and your required timeframe, there may be an <strong>additional agreed-upon charge</strong> communicated before confirmation and due at delivery.</div>';
  html += '</div>';
  html += '<div class="ack-wrap">';
  html +=   '<label class="ack-label">';
  html +=     '<input type="checkbox" id="co-ack" onchange="togglePlaceBtn()"/>';
  html +=     '<span>I understand that <strong>$' + price + '</strong> is the base price and additional charges for customization may apply — to be agreed upon before my order is confirmed.</span>';
  html +=   '</label>';
  html += '</div>';
  html += '<div class="deposit-amount-display" style="margin:14px 0 10px">' +
           '<span>Deposit due today (50%)</span><strong id="co-deposit-text">$' + (price * 0.5).toFixed(2) + '</strong></div>';
  html += '<div id="co-paypal-container" class="paypal-wrapper" style="display:none;"></div>';
  html += '<div class="paypal-ack-hint" id="co-paypal-hint">&#9757;&#65039; Check the acknowledgement above to unlock payment</div>';
  html += '<div class="secure-badge">&#128274; Payments processed securely via PayPal &mdash; PCI DSS Compliant</div>';
  html += '<div class="co-footer-note">&#128205; Delivery to Manhattan &amp; The Bronx only<br>Vanessa will contact you within 24 hours to confirm.</div>';

  var body = document.getElementById('sheet-body');
  body.innerHTML = html;
  body.scrollTop = 0;
}

function togglePlaceBtn() {
  var ack       = document.getElementById('co-ack');
  var container = document.getElementById('co-paypal-container');
  var hint      = document.getElementById('co-paypal-hint');
  if (!ack) return;
  if (ack.checked) {
    if (container) container.style.display = 'block';
    if (hint)      hint.style.display      = 'none';
    renderCheckoutPayPal();
  } else {
    if (container) container.style.display = 'none';
    if (hint)      hint.style.display      = 'block';
  }
}

function renderCheckoutPayPal() {
  if (_coPayPalRendered) return;
  if (!window.paypal) { console.warn('PayPal SDK not loaded'); return; }
  _coPayPalRendered = true;

  paypal.Buttons({
    style: { layout: 'vertical', color: 'blue', shape: 'rect', label: 'pay' },

    createOrder: function(data, actions) {
      var required = ['co-fname','co-lname','co-email','co-phone','co-date','co-address'];
      var ok = true;
      required.forEach(function(id) {
        var el = document.getElementById(id);
        if (!el || !el.value.trim()) {
          if (el) { el.style.borderColor = '#E91E8C'; el.addEventListener('input', function(){ el.style.borderColor=''; }, {once:true}); }
          ok = false;
        }
      });
      if (!ok) { showToast('Please fill in all required fields ✦'); return Promise.reject(new Error('validation')); }

      var total = currentCheckoutFlow === 'cart'
        ? cart.reduce(function(s,i){ return s + i.price * i.qty; }, 0)
        : getSheetPrice();
      var deposit = (total * 0.5).toFixed(2);

      return actions.order.create({
        purchase_units: [{ description: 'La Cosinita de Vanessa — Deposit (50%)', amount: { currency_code: 'USD', value: deposit } }]
      });
    },

    onApprove: function(data, actions) {
      return actions.order.capture().then(function(details) {
        if (currentCheckoutFlow === 'cart') { submitCartOrder(details); }
        else { submitProductOrder(details); }
      });
    },

    onError: function(err) {
      console.error('PayPal error:', err);
      showToast('Payment error — please try again or contact us directly.');
    },

    onCancel: function() {
      showToast("Payment cancelled — complete payment when you're ready.");
    }
  }).render('#co-paypal-container');
}

async function submitProductOrder(paypalDetails) {
  var paypalOrderId = paypalDetails ? paypalDetails.id : null;
  var required = ['co-fname','co-lname','co-email','co-phone','co-date','co-address'];
  var ok = true;
  required.forEach(function(id) {
    var el = document.getElementById(id);
    if (!el || !el.value.trim()) {
      if (el) { el.style.borderColor = '#E91E8C'; el.addEventListener('input', function(){ el.style.borderColor = ''; }, {once:true}); }
      ok = false;
    }
  });
  if (!ok) { showToast('Please fill in all required fields ✶'); return; }

  /* Loading state handled by PayPal SDK */

  /* Product info from current sheet state */
  var p      = PRODUCTS[currentProduct];
  var size   = p.sizes[currentSizeIdx];
  var flavorText = collectFlavorValues().join(', ');
  var fillingEl = isFillingVisible() ? document.getElementById('sheet-filling') : null;
  var dulceEl   = document.getElementById('sheet-dulce');
  var detail = flavorText;
  if (fillingEl && fillingEl.value) detail += ' · ' + fillingEl.value;
  if (dulceEl && dulceEl.checked) detail += ' · Dulce de Leche (+$5)';
  var price = getSheetPrice();

  /* Collect form values */
  var fname    = document.getElementById('co-fname').value.trim();
  var lname    = document.getElementById('co-lname').value.trim();
  var email    = document.getElementById('co-email').value.trim();
  var phone    = document.getElementById('co-phone').value.trim();
  var date     = document.getElementById('co-date').value;
  var timeEl   = document.getElementById('co-time');
  var time     = timeEl ? timeEl.value : '';
  var address  = document.getElementById('co-address').value.trim();
  var notesEl  = document.getElementById('co-notes');
  var notes    = notesEl ? notesEl.value.trim() : '';
  var algEl    = document.getElementById('co-allergies');
  var allergies = algEl ? algEl.value.trim() : '';

  var items = JSON.stringify([{
    key: currentProduct, name: p.badge, size: size.label,
    detail: detail, price: price, qty: 1
  }]);

  try {
    var prodOrderRef = generateOrderRef();
    var custRes = await _sb
      .from('customers')
      .upsert({ first_name: fname, last_name: lname, email: email, phone: phone, source: 'web_order' }, { onConflict: 'email', ignoreDuplicates: false })
      .select()
      .single();
    if (custRes.error) throw custRes.error;

    var orderRes = await _sb
      .from('orders')
      .insert({
        customer_id:      custRes.data.id,
        order_reference:  prodOrderRef,
        order_type:       'product',
        order_items:      items,
        order_subtotal:   price,
        order_total:      price,
        payment_status:   paypalOrderId ? 'deposit_paid' : 'pending',
        paypal_order_id:  paypalOrderId,
        delivery_date:    date,
        delivery_time:    time,
        delivery_address: address,
        theme_notes:      notes,
        allergies:        allergies,
        source:           'web_order'
      });
    if (orderRes.error) throw orderRes.error;

    var prodItemSummary = size.label + ' ' + p.badge + (detail ? ' — ' + detail : '') + ' — $' + price;
    sendOrderEmails({ name: fname + ' ' + lname, email: email, phone: phone,
      orderRef: prodOrderRef, items: prodItemSummary,
      date: date, time: time, address: address, notes: notes });

    document.getElementById('sheet-overlay').classList.remove('open');
    document.body.style.overflow = '';
    document.getElementById('success-modal').classList.add('open');
    document.body.style.overflow = 'hidden';
  } catch (err) {
    console.error('Order error:', err);
    showToast('Something went wrong — please try again or call us directly.');
    if (btn) { btn.disabled = false; btn.textContent = '🎂 Submit Order Request'; }
  }
}

function toggleCustomAck() {
  var ack       = document.getElementById('custom-ack');
  var container = document.getElementById('paypal-button-container');
  var hint      = document.getElementById('paypal-ack-hint');
  if (!ack) return;
  if (ack.checked) {
    if (container) container.style.display = 'block';
    if (hint)      hint.style.display      = 'none';
  } else {
    if (container) container.style.display = 'none';
    if (hint)      hint.style.display      = 'block';
  }
}


function stripHtmlSimple(s) { return String(s||'').replace(/<[^>]*>/g,''); }

/* ── Load all products from Supabase and render the product grid ── */
async function loadProducts() {
  try {
    const SUPA_URL = 'https://nqrlxslgstajryimndsx.supabase.co';
    const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xcmx4c2xnc3RhanJ5aW1uZHN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwODkyNjcsImV4cCI6MjA5NjY2NTI2N30.40pYlAIXARiKWqBVZGPIpagDCxo7-88pRgDIFLmgAgA';
    const resp = await fetch(
      SUPA_URL + '/rest/v1/products?select=*&order=sort_order.asc',
      { headers: { 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY } }
    );
    if (!resp.ok) return;
    const rows = await resp.json();
    if (!Array.isArray(rows)) return;

    PRODUCTS = {};
    const grid = document.getElementById('product-grid');
    if (!grid) return;
    grid.innerHTML = '';

    rows.forEach(function(row) {
      if (!row.is_available) return;

      /* Normalise serve_guide → {rows, extras} */
      let sg = row.serve_guide, serveGuide = null, extras = [];
      if (sg) {
        if (Array.isArray(sg))   { serveGuide = sg; }
        else if (sg.rows)        { serveGuide = sg.rows; extras = sg.extras || []; }
        else if (sg.extras)      { extras = sg.extras; }
      }

      const hasGF = (row.sizes || []).some(function(s) { return s.priceGF; });

      PRODUCTS[row.key] = {
        name:      row.name,
        badge:     row.badge,
        desc:      row.description,
        img:       row.image_url || null,
        emoji:     row.emoji || '🎂',
        emojiStyle:'',
        type:      row.category,
        sizes:     row.sizes    || [],
        flavors:   row.flavors  || [],
        fillings:  row.fillings || [],
        priceNote: row.price_note || '',
        serveGuide:serveGuide,
        extras:    extras,
        hasGF:     hasGF
      };

      /* Render card DOM element */
      const p = PRODUCTS[row.key];
      const minPrice = p.sizes.length ? p.sizes[0].price : 0;
      const imgPart  = p.img
        ? `<img src="${p.img}" alt="${stripHtmlSimple(p.name)}" style="width:100%;height:100%;object-fit:cover;display:block;"/>`
        : '';
      const emojiPart = `<div class="product-card-emoji" style="${p.emojiStyle}${p.img?';display:none':''}">${p.emoji}</div>`;

      const card = document.createElement('div');
      card.className   = 'product-card reveal';
      card.dataset.key = row.key;
      card.dataset.cat = row.category;
      card.onclick     = function() { openSheet(row.key); };
      card.innerHTML   = `
        <div class="product-card-img">
          ${imgPart}
          ${emojiPart}
          <div class="product-card-badge">${p.badge}</div>
        </div>
        <div class="product-card-body">
          <div class="product-card-name">${p.name}</div>
          <div class="product-card-desc">${stripHtmlSimple(p.desc).slice(0,80)}…</div>
          <div class="product-card-from">From $${minPrice}${p.priceNote?' & up':''}</div>
        </div>`;
      grid.appendChild(card);
      io.observe(card);
    });

    /* Re-apply active category filter */
    const activeBtn = document.querySelector('.cat-pill.active');
    if (activeBtn) {
      const m = activeBtn.getAttribute('onclick').match(/'([^']+)'/);
      const cat = m ? m[1] : 'all';
      document.querySelectorAll('.product-card').forEach(function(c) {
        c.style.display = (cat === 'all' || c.dataset.cat === cat) ? '' : 'none';
      });
    }
  } catch(err) {
    console.warn('loadProducts failed:', err);
  }
}

/* Initialize (each guards itself so app.js is safe on every page) */
if (document.getElementById('cart-items-list')) renderCart();
loadGallery();
loadProducts();
if (location.hash === '#cart' && document.getElementById('cart-drawer')) openCart();
updateCartBadge();
setActiveNav();

/* ── Mobile hamburger menu ── */
function toggleMobileMenu() {
  var nav = document.querySelector('nav');
  if (!nav) return;
  var open = nav.classList.toggle('open');
  var h = nav.querySelector('.nav-hamburger');
  if (h) { h.setAttribute('aria-expanded', open ? 'true' : 'false'); h.textContent = open ? '\u2715' : '\u2630'; }
}
window.toggleMobileMenu = toggleMobileMenu;
document.addEventListener('click', function (e) {
  var nav = document.querySelector('nav');
  if (!nav || !nav.classList.contains('open')) return;
  var clickedLink = e.target.closest && e.target.closest('.nav-links a');
  if (clickedLink || !nav.contains(e.target)) {
    nav.classList.remove('open');
    var h = nav.querySelector('.nav-hamburger');
    if (h) { h.setAttribute('aria-expanded', 'false'); h.textContent = '\u2630'; }
  }
});


/* ── Email confirmations ──
   Switch providers with EMAIL_PROVIDER below.
   'resend'  → posts to the Netlify function (requires a verified domain +
               RESEND_API_KEY / RESEND_FROM env vars in Netlify).
   'emailjs' → the original client-side EmailJS path (active until the domain is ready). */
var EMAIL_PROVIDER = 'emailjs';

function sendOrderEmails(params) {
  if (EMAIL_PROVIDER === 'resend') {
    fetch('/.netlify/functions/send-order-emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    }).catch(function(e){ console.warn('Order emails failed:', e); });
    return;
  }

  /* EmailJS (legacy) */
  var ep = {
    customer_name:    params.name,
    customer_email:   params.email,
    to_email:         params.email,
    customer_phone:   params.phone,
    order_ref:        params.orderRef,
    order_items:      params.items,
    delivery_date:    params.date,
    delivery_time:    params.time || 'TBD',
    delivery_address: params.address,
    notes:            params.notes || '—'
  };
  emailjs.send('service_wa7tjhr', 'template_cntjooa', ep)
    .catch(function(e){ console.warn('Customer email failed:', e); });
  emailjs.send('service_wa7tjhr', 'template_vwweyef',
    Object.assign({}, ep, { to_email: 'lacosinitadevanessa@gmail.com' }))
    .catch(function(e){ console.warn('Owner email failed:', e); });
}

/* ── Category filter ── */
function filterCat(cat, btn) {
  document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.product-card').forEach(card => {
    card.style.display = (cat === 'all' || card.dataset.cat === cat) ? '' : 'none';
  });
}

/* ── Gallery — loads from Supabase ── */
let _galleryItems = [];

async function loadGallery() {
  const grid = document.getElementById('gallery-grid');
  if (!grid) return;
  try {
    const SUPA_URL  = 'https://nqrlxslgstajryimndsx.supabase.co';
    const SUPA_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xcmx4c2xnc3RhanJ5aW1uZHN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwODkyNjcsImV4cCI6MjA5NjY2NTI2N30.40pYlAIXARiKWqBVZGPIpagDCxo7-88pRgDIFLmgAgA';
    const resp = await fetch(
      SUPA_URL + '/rest/v1/gallery?select=id,title,tag,photo_url&order=sort_order.asc,created_at.desc',
      { headers: { 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY } }
    );
    if (!resp.ok) throw new Error('Gallery fetch failed: ' + resp.status);
    const data = await resp.json();

    _galleryItems = Array.isArray(data) ? data : [];

    if (_galleryItems.length === 0) {
      grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;padding:48px 0;color:var(--text-mid);font-size:13px;">Photos coming soon — check back! 📸</p>';
      return;
    }

    grid.innerHTML = _galleryItems.map((item, i) => `
      <div class="gallery-card" onclick="openLightbox(${i})">
        <img src="${item.photo_url}" alt="${escapeHtml(item.title)}"
             style="width:100%;height:100%;object-fit:contain;display:block;"/>
        <div class="gallery-card-overlay">
          <div class="gallery-card-name">${escapeHtml(item.title)}</div>
          ${item.tag ? `<div class="gallery-card-tag">${escapeHtml(item.tag)}</div>` : ''}
        </div>
      </div>`).join('');
  } catch (err) {
    console.error('Gallery load error:', err);
    grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;padding:48px 0;color:var(--text-mid);font-size:13px;">Unable to load gallery right now.</p>';
  }
}

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function openLightbox(i) {
  const c = _galleryItems[i];
  if (!c) return;
  document.getElementById('lb-img').src = c.photo_url;
  document.getElementById('lb-img').alt = c.title;
  document.getElementById('lb-caption').textContent = c.title;
  document.getElementById('lb-sub').textContent = c.tag || '';
  document.getElementById('lightbox').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeLightbox(e) {
  if (!e || e.target.id === 'lightbox' || e.target.classList.contains('lightbox-close')) {
    document.getElementById('lightbox').classList.remove('open');
    document.body.style.overflow = '';
  }
}

/* ── Date min (7-day lead time) ── */
(function () {
  const d = new Date(); d.setDate(d.getDate() + 7);
  const el = document.getElementById('delivery-date');
  if (el) { el.min = el.value = d.toISOString().split('T')[0]; }
})();

/* ── Deposit amount helper ── */
function getDepositAmount() {
  var checked = document.querySelector('input[name="cust-sz"]:checked');
  var price   = checked ? parseFloat(checked.value) : 25;
  return (price * 0.5).toFixed(2);
}
function updateDepositDisplay() {
  var el = document.getElementById('deposit-amount-text');
  if (el) el.textContent = '$' + getDepositAmount();
}
document.querySelectorAll('input[name="cust-sz"]').forEach(function(inp) {
  inp.addEventListener('change', updateDepositDisplay);
});

/* ── PayPal button init ── */
(function initPayPal() {
  if (!window.paypal) { console.warn('PayPal SDK not loaded'); return; }
  if (!document.getElementById('paypal-button-container')) return;
  paypal.Buttons({
    style: { layout: 'vertical', color: 'blue', shape: 'rect', label: 'pay' },

    createOrder: function(data, actions) {
      var required = ['fname','lname','email','phone','delivery-date','address','address-city','address-zip'];
      var ok = true;
      required.forEach(function(id) {
        var el = document.getElementById(id);
        if (!el || !el.value.trim()) {
          if (el) { el.style.borderColor = '#E91E8C'; el.addEventListener('input', function(){ el.style.borderColor=''; }, {once:true}); }
          ok = false;
        }
      });
      if (!ok) { showToast('Please fill in all required fields ✦'); return Promise.reject(new Error('validation')); }
      return actions.order.create({
        purchase_units: [{ description: 'La Cosinita de Vanessa — Custom Cake Deposit (50%)', amount: { currency_code: 'USD', value: getDepositAmount() } }]
      });
    },

    onApprove: function(data, actions) {
      return actions.order.capture().then(function(details) {
        handleSubmit(details);
      });
    },

    onError: function(err) {
      console.error('PayPal error:', err);
      showToast('Payment error — please try again or call us directly.');
    },

    onCancel: function() {
      showToast("Payment cancelled — complete payment when you're ready.");
    }
  }).render('#paypal-button-container');
})();

/* ── Custom-order reference photo upload (Supabase Storage) ── */
async function uploadReferenceImages(orderRef) {
  const input = document.getElementById('reference-photos');
  if (!input || !input.files || !input.files.length) return [];
  const files = Array.from(input.files).slice(0, 5);
  const urls = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    if (!f.type || f.type.indexOf('image/') !== 0) continue;
    const ext = ((f.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')) || 'jpg';
    const path = orderRef + '/' + Date.now() + '-' + i + '.' + ext;
    try {
      const up = await _sb.storage.from('order-references').upload(path, f, { cacheControl: '3600', upsert: false });
      if (up.error) { console.warn('Reference upload failed:', up.error); continue; }
      const pub = _sb.storage.from('order-references').getPublicUrl(path);
      if (pub.data && pub.data.publicUrl) urls.push(pub.data.publicUrl);
    } catch (e) { console.warn('Reference upload error:', e); }
  }
  return urls;
}
function previewRefPhotos() {
  const input = document.getElementById('reference-photos');
  const box = document.getElementById('ref-photo-preview');
  if (!input || !box) return;
  let files = Array.from(input.files || []);
  if (files.length > 5) { showToast('Up to 5 photos — extra ones will be skipped.'); files = files.slice(0, 5); }
  box.innerHTML = files.map(function (f) {
    var n = f.name.length > 18 ? f.name.slice(0, 16) + '…' : f.name;
    return '<span class="ref-thumb">🖼️ ' + n + '</span>';
  }).join('');
}

/* ── Custom order form submit (called by PayPal onApprove) ── */
async function handleSubmit(paypalDetails) {
  const paypalOrderId = paypalDetails ? paypalDetails.id : null;

  const fname     = document.getElementById('fname').value.trim();
  const lname     = document.getElementById('lname').value.trim();
  const email     = document.getElementById('email').value.trim();
  const phone     = document.getElementById('phone').value.trim();
  const date      = document.getElementById('delivery-date').value;
  const timeEl    = document.getElementById('delivery-time');
  const time      = timeEl ? timeEl.value : '';
  const address   = document.getElementById('address').value.trim();
  const addrApt   = (document.getElementById('address-apt')  || {value:''}).value.trim();
  const addrCity  = document.getElementById('address-city').value.trim();
  const addrState = document.getElementById('address-state').value.trim();
  const addrZip   = document.getElementById('address-zip').value.trim();
  const fullAddress = [address, addrApt, addrCity, addrState, addrZip].filter(Boolean).join(', ');
  const notesEl   = document.getElementById('custom-notes') || document.getElementById('instructions');
  const notes     = notesEl ? notesEl.value.trim() : '';
  const allergies = (document.getElementById('allergies') || {value: ''}).value.trim();
  const occasion  = (document.getElementById('occasion')  || {value: ''}).value.trim();
  const sizeEl    = document.querySelector('input[name="cust-sz"]:checked');
  const size      = sizeEl ? sizeEl.value : '';
  const deposit   = getDepositAmount();

  try {
    const customOrderRef = generateOrderRef();
    const refImages = await uploadReferenceImages(customOrderRef);
    const { data: cust, error: custErr } = await _sb
      .from('customers')
      .upsert({ first_name: fname, last_name: lname, email: email, phone: phone, source: 'web_order' }, { onConflict: 'email', ignoreDuplicates: false })
      .select('id')
      .single();
    if (custErr) throw custErr;

    const { error: orderErr } = await _sb
      .from('orders')
      .insert({
        customer_id:      cust.id,
        order_reference:  customOrderRef,
        order_type:       'custom',
        order_items:      JSON.stringify([{ type: 'custom', occasion: occasion, size: size, notes: notes }]),
        order_subtotal:   parseFloat(size) || null,
        order_total:      parseFloat(size) || null,
        delivery_date:    date,
        delivery_time:    time,
        delivery_address: fullAddress,
        theme_notes:      notes,
        allergies:        allergies,
        payment_status:   paypalOrderId ? 'deposit_paid' : 'pending',
        paypal_order_id:  paypalOrderId,
        reference_images: refImages,
        source:           'web_order'
      });
    if (orderErr) throw orderErr;

    sendOrderEmails({ name: fname + ' ' + lname, email: email, phone: phone,
      orderRef: customOrderRef,
      items: 'Custom Cake — ' + (size ? size + ' inch base ($' + size + ')' : 'size TBD') + '\nDeposit paid: $' + deposit + ' (PayPal ' + (paypalOrderId || 'N/A') + ')',
      date: date, time: time, address: fullAddress,
      notes: notes + (refImages.length ? '\nReference photos: ' + refImages.join('  ') : '') });

    document.getElementById('success-modal').classList.add('open');
    document.body.style.overflow = 'hidden';
  } catch (err) {
    console.error('Order error:', err);
    showToast('Something went wrong — please try again or call us directly.');
  }
}

function closeModal(e) {
  if (!e || e.target.id === 'success-modal' || e.target.tagName === 'BUTTON') {
    document.getElementById('success-modal').classList.remove('open');
    document.body.style.overflow = '';
    if (!e || e.target.tagName === 'BUTTON') window.scrollTo({top: 0, behavior: 'smooth'});
  }
}

/* ── Toast ── */
let _tt;
function showToast(msg) {
  clearTimeout(_tt);
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  _tt = setTimeout(() => t.classList.remove('show'), 3400);
}

/* ── Scroll reveal ── */
const io = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); } });
}, {threshold: 0.1});
document.querySelectorAll('.reveal').forEach(el => io.observe(el));

/* ── SES fix: expose all inline-handler functions to window ── */
window.openSheet          = openSheet;
window.closeSheet         = closeSheet;
window.sheetSizeChange    = sheetSizeChange;
window.updateSheetPrice   = updateSheetPrice;
window.toggleServeGuide   = toggleServeGuide;
window.addToOrder         = addToOrder;
window.renderCart         = renderCart;
window.changeQty          = changeQty;
window.removeItem         = removeItem;
window.openCart           = openCart;
window.closeCart          = closeCart;
window.proceedToCheckout  = proceedToCheckout;
window.closeCheckout      = closeCheckout;
window.submitCartOrder    = submitCartOrder;
window.showCheckoutStep   = showCheckoutStep;
window.togglePlaceBtn     = togglePlaceBtn;
window.submitProductOrder = submitProductOrder;
window.toggleCustomAck    = toggleCustomAck;
window.previewRefPhotos   = previewRefPhotos;
window.filterCat          = filterCat;
window.loadGallery        = loadGallery;
window.loadProducts