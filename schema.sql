-- ============================================================
-- La Cocinita de Vanessa — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================


-- ── customers ───────────────────────────────────────────────
-- One row per person who submits any order request.
-- Matches the column conventions from the reference project.
create table customers (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz      default now(),
  first_name  text,
  last_name   text,
  email       text,
  phone       text,
  order_notes text,
  source      text             default 'web_order',
  email_opt_in boolean         default false
);


-- ── orders ──────────────────────────────────────────────────
-- One row per order request (cart checkout, single-product
-- checkout, or custom order form).
create table orders (
  id               uuid    primary key default gen_random_uuid(),
  created_at       timestamptz         default now(),

  -- Link to customer
  customer_id      uuid    references customers(id),
  order_reference  text,                        -- e.g. LCV-20260512-A3F7

  -- What kind of order
  order_type       text,                        -- 'cart' | 'product' | 'custom'

  -- Items as a JSON string (mirrors orders.order_items in reference project)
  -- cart/product: [{ key, name, size, detail, price, qty }]
  -- custom: [{ name, size, price, qty:1 }]
  order_items      text,

  -- Pricing (base prices only; final price agreed before confirmation)
  order_subtotal   numeric,
  order_total      numeric,

  -- Payment (always 'pending' — due at delivery, no upfront charge)
  payment_status   text    default 'pending',

  -- Delivery logistics
  delivery_date    date,
  delivery_time    text,
  delivery_address text,

  -- Cake customization
  theme_notes      text,   -- colors, theme, decorations, text on cake
  allergies        text,
  occasion         text,   -- custom orders only (birthday, wedding, etc.)
  custom_size      text,   -- custom orders only ('7-inch ($98)' | '10-inch ($135)')

  -- Order lifecycle
  status           text    default 'pending',  -- pending | confirmed | completed | cancelled

  source           text    default 'web_order'
);


-- ── Optional: Row Level Security ────────────────────────────
-- Uncomment after confirming inserts work from the browser.
-- This locks down reads so only authenticated users (Vanessa)
-- can view orders while still allowing anonymous inserts.
--
-- alter table customers enable row level security;
-- alter table orders     enable row level security;
--
-- create policy "Allow anonymous inserts on customers"
--   on customers for insert to anon with check (true);
--
-- create policy "Allow anonymous inserts on orders"
--   on orders for insert to anon with check (true);
--
-- create policy "Allow authenticated reads on customers"
--   on customers for select to authenticated using (true);
--
-- create policy "Allow authenticated reads on orders"
--   on orders for select to authenticated using (true);
