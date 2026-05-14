-- ─────────────────────────────────────────────────────────────────
-- La Cocinita de Vanessa — Products table
-- Run in Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS products (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  key           text        UNIQUE NOT NULL,       -- 'signature' | 'leches' | 'chocoflan' etc.
  name          text        NOT NULL,              -- display name (HTML ok, e.g. "Tres Leches <em>Cake</em>")
  badge         text,                              -- short label shown on card badge
  description   text,                              -- full product description shown in sheet
  emoji         text,                              -- fallback emoji when no photo
  category      text        NOT NULL,              -- 'whole' | 'leches' | 'chocoflan' | 'shooters' | 'flan' | 'cheesecake'
  sizes         jsonb       NOT NULL DEFAULT '[]', -- [{id, label, price, priceGF, serves}]
  flavors       jsonb       NOT NULL DEFAULT '[]', -- ["Vanilla", "Chocolate", ...]
  fillings      jsonb       NOT NULL DEFAULT '[]', -- ["Piña (Pineapple)", "Dulce de Leche", ...]
  serve_guide   jsonb,                             -- [["7\" Regular", "Serves 10–12"], ...]
  price_note    text,                              -- e.g. "& up" appended after base price
  image_url     text,                              -- public URL from Supabase Storage
  sort_order    int         NOT NULL DEFAULT 0,    -- lower = shown first in catalog
  is_available  boolean     NOT NULL DEFAULT true, -- false = hidden from storefront
  created_at    timestamptz DEFAULT now()
);

-- ── RLS ──────────────────────────────────────────────────────────
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Public can read available products (storefront)
CREATE POLICY "Public can view available products"
ON products FOR SELECT TO anon
USING (is_available = true);

-- Authenticated users (Vanessa via admin) can do everything
CREATE POLICY "Authenticated users can manage products"
ON products FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

-- ── Seed current catalog ─────────────────────────────────────────
INSERT INTO products (key, name, badge, description, emoji, category, sizes, flavors, fillings, serve_guide, price_note, sort_order) VALUES

('signature',
 'La Cocinita <em>Signature Cake</em>',
 'Signature',
 'Our handcrafted Dominican-style whole cake, beautifully frosted and decorated. Perfect for birthdays, anniversaries, and every celebration in between. Select your size and flavor below.',
 null,
 'whole',
 '[{"id":"sig-7","label":"7\"","price":98,"priceGF":118,"serves":"10–12"},{"id":"sig-10","label":"10\"","price":135,"priceGF":155,"serves":"25–30"}]',
 '["Vanilla","Chocolate","Strawberry","Oreo","Pistachio","Lemon Cake","Carrot Cake","Red Velvet","Pumpkin Spice","Piña"]',
 '["Piña (Pineapple)","Dulce de Leche","Strawberry","Chinola (Passion Fruit)","Chocolate Ganache","Cream Cheese Filling"]',
 '[["7\" Regular","Serves 10–12"],["7\" Extra Tall","Serves 16–18"],["7\" Double Height","Serves 20–24"],["10\" Regular","Serves 25–30"],["10\" Extra Tall","Serves 30–36"],["10\" Double Height","Serves 50–60"]]',
 null,
 1),

('leches',
 'Tres Leches <em>Cake</em>',
 'Tres Leches',
 'New York''s finest Tres Leches — light, incredibly moist, soaked in three milks and made fresh to order. Available in multiple sizes and a variety of fillings.',
 '🍰',
 'leches',
 '[{"id":"tl-6","label":"6\"","price":65,"priceGF":85,"serves":"6–8"},{"id":"tl-7","label":"7\"","price":75,"priceGF":95,"serves":"10–12"},{"id":"tl-8","label":"8\"","price":85,"priceGF":105,"serves":"14–16"},{"id":"tl-9","label":"9\"","price":95,"priceGF":115,"serves":"18–22"},{"id":"tl-10","label":"10\"","price":110,"priceGF":130,"serves":"25–30"},{"id":"tl-hsh","label":"Half Sheet","price":150,"priceGF":170,"serves":"40–50"}]',
 '[]',
 '["Piña (Pineapple)","Dulce de Leche","Strawberry","Chinola (Passion Fruit)","Chocolate Ganache","Cream Cheese Filling"]',
 null,
 null,
 2),

('chocoflan',
 '<em>Chocoflan</em>',
 'Chocoflan',
 'The legendary ''Impossible Cake'' — rich chocolate cake magically topped with a silky Dominican flan. A showstopper at any celebration.',
 '🍫',
 'chocoflan',
 '[{"id":"cf-7","label":"7\"","price":75,"serves":"10–12"},{"id":"cf-10","label":"10\"","price":110,"serves":"25–30"}]',
 '[]',
 '[]',
 null,
 null,
 3),

('shooters',
 'Tres Leches <em>Shooters</em>',
 'Shooters',
 'Individual Tres Leches cups — perfect for parties and events. Sold by the dozen in your choice of flavor. Add Fresh Fruits for an extra touch.',
 '🥤',
 'shooters',
 '[{"id":"sh-doz","label":"1 Dozen","price":45,"serves":"12 guests"}]',
 '["Vanilla","Chocolate","Strawberry","Oreo","Pistachio","Lemon","Carrot Cake","Red Velvet","Pumpkin Spice","Piña","Chinola (Passion Fruit)","Dulce de Leche"]',
 '[]',
 null,
 '& up',
 4),

('flan',
 'Flan <em>Dozen</em>',
 'Flan',
 'Silky, creamy Dominican-style mini flan treats — sold by the dozen. A rich, velvety dessert perfect for any occasion.',
 '🍮',
 'flan',
 '[{"id":"fl-doz","label":"1 Dozen","price":40,"serves":"12 guests"}]',
 '[]',
 '[]',
 null,
 null,
 5),

('cheesecake',
 '<em>Cheesecake</em>',
 'Cheesecake',
 'Rich, creamy cheesecake sold by the dozen. Choose your flavor — price may vary based on design and filling.',
 '🧁',
 'cheesecake',
 '[{"id":"cc-reg","label":"Regular","price":40,"serves":"1 Dozen"},{"id":"cc-oreo","label":"Oreo","price":40,"serves":"1 Dozen"},{"id":"cc-str","label":"Strawberry","price":45,"serves":"1 Dozen"}]',
 '[]',
 '[]',
 null,
 '& up',
 6);
