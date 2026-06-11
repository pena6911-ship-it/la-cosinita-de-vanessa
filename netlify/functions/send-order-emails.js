// Netlify serverless function — sends order confirmation emails via Resend.
// The Resend API key NEVER ships to the browser; it lives in a Netlify env var.
//
// Required Netlify environment variables (Site settings > Environment variables):
//   RESEND_API_KEY  — your Resend API key (starts with "re_")
//   RESEND_FROM     — verified sender, e.g. "La Cocinita de Vanessa <orders@yourdomain.com>"
//   OWNER_EMAIL     — where owner notifications go (default lacosinitadevanessa@gmail.com)
//
// The frontend POSTs the order params (same shape sendOrderEmails already builds):
//   { name, email, phone, orderRef, items, date, time, address, notes }

const LOGO = 'https://cosinitadevanessa.netlify.app/assets/la-cosinita-logo-stamp.png';

function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
// escape, then turn newlines into <br> (order items can be multi-line)
function escMultiline(v) {
  return esc(v).replace(/\r?\n/g, '<br>');
}

function customerHtml(p) {
  return `<img src="${LOGO}" alt="La Cocinita de Vanessa" style="display:block;max-width:200px;margin-bottom:20px;" />
<div style="font-family:system-ui,sans-serif,Arial;font-size:16px;">
<p>Hi ${esc(p.name)},</p>
<p>Thank you for your order! Here's a summary:</p>
<p>Order #: ${esc(p.orderRef)}<br>Items: ${escMultiline(p.items)}<br>Delivery: ${esc(p.date)} at ${esc(p.time || 'TBD')}<br>Address: ${esc(p.address)}</p>
<p>Vanessa will be in touch within 24 hours to confirm details and discuss any customization.</p>
<p>📍 Manhattan &amp; The Bronx only<br>💬 Questions? Reply to this email.</p>
<p>With love,<br>La Cocinita de Vanessa 🎂</p>
</div>`;
}

function ownerHtml(p) {
  return `<img src="${LOGO}" alt="La Cocinita de Vanessa" style="display:block;max-width:200px;margin-bottom:20px;" />
<div style="font-family:system-ui,sans-serif,Arial;font-size:16px;">
<p>New order received!</p>
<p>Customer: ${esc(p.name)} (${esc(p.email)})<br>Phone: ${esc(p.phone)}<br>Order #: ${esc(p.orderRef)}<br>Items: ${escMultiline(p.items)}<br>Delivery: ${esc(p.date)} at ${esc(p.time || 'TBD')}<br>Address: ${esc(p.address)}<br>Notes: ${escMultiline(p.notes || '—')}</p>
</div>`;
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const KEY   = process.env.RESEND_API_KEY;
  const FROM  = process.env.RESEND_FROM;
  const OWNER = process.env.OWNER_EMAIL || 'lacosinitadevanessa@gmail.com';

  if (!KEY || !FROM) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Email not configured: set RESEND_API_KEY and RESEND_FROM' }) };
  }

  let p;
  try { p = JSON.parse(event.body || '{}'); }
  catch (e) { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) }; }

  if (!p.email) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing customer email' }) };
  }

  async function send(to, subject, html) {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [to], subject: subject, html: html, reply_to: OWNER })
    });
    const data = await resp.json().catch(function () { return {}; });
    return { ok: resp.ok, status: resp.status, data: data };
  }

  try {
    const customer = await send(
      p.email,
      'Your order with La Cocinita de Vanessa is confirmed! 🎂',
      customerHtml(p)
    );
    const owner = await send(
      OWNER,
      '🎂 New Order — ' + esc(p.orderRef || ''),
      ownerHtml(p)
    );

    const ok = customer.ok && owner.ok;
    return {
      statusCode: ok ? 200 : 502,
      body: JSON.stringify({ ok: ok, customer: customer.status, owner: owner.status })
    };
  } catch (err) {
    return { statusCode: 502, body: JSON.stringify({ error: String(err) }) };
  }
};
