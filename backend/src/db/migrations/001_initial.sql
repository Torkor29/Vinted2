-- Vinted Bot - Initial Schema

-- Table utilisateurs
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT UNIQUE NOT NULL,
    telegram_username VARCHAR(255),
    telegram_first_name VARCHAR(255),
    is_premium BOOLEAN DEFAULT FALSE,
    max_filters INTEGER DEFAULT 5,
    notification_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Table filtres de recherche
CREATE TABLE IF NOT EXISTS filters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,

    -- Criteres de recherche
    search_text VARCHAR(500),
    catalog_ids INTEGER[],
    brand_ids INTEGER[],
    size_ids INTEGER[],
    color_ids INTEGER[],
    material_ids INTEGER[],
    status_ids INTEGER[],
    price_from DECIMAL(10,2),
    price_to DECIMAL(10,2),
    currency VARCHAR(3) DEFAULT 'EUR',

    -- Filtres avances
    country_ids INTEGER[],
    city_ids INTEGER[],
    shipping_options INTEGER[],
    is_unisex BOOLEAN,

    -- Tri et monitoring
    sort_by VARCHAR(50) DEFAULT 'newest_first',
    scan_interval_seconds INTEGER DEFAULT 3,

    -- Detection pepites
    pepite_enabled BOOLEAN DEFAULT TRUE,
    pepite_threshold DECIMAL(3,2) DEFAULT 0.30,

    last_scanned_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_filters_user ON filters(user_id);
CREATE INDEX IF NOT EXISTS idx_filters_active ON filters(is_active) WHERE is_active = TRUE;

-- Table articles detectes
CREATE TABLE IF NOT EXISTS articles (
    id SERIAL PRIMARY KEY,
    vinted_id BIGINT UNIQUE NOT NULL,
    filter_id UUID REFERENCES filters(id) ON DELETE SET NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,

    title VARCHAR(500),
    description TEXT,
    price DECIMAL(10,2),
    currency VARCHAR(3) DEFAULT 'EUR',
    brand_name VARCHAR(255),
    size_name VARCHAR(100),
    condition_name VARCHAR(100),
    color_names VARCHAR(255),
    category_name VARCHAR(255),

    photo_url TEXT,
    photo_urls TEXT[],
    vinted_url TEXT NOT NULL,

    seller_username VARCHAR(255),
    seller_rating DECIMAL(3,2),
    seller_country VARCHAR(100),

    -- Analyse prix
    estimated_market_price DECIMAL(10,2),
    price_difference_pct DECIMAL(5,2),
    is_pepite BOOLEAN DEFAULT FALSE,

    -- Statut
    is_notified BOOLEAN DEFAULT FALSE,
    is_sold BOOLEAN DEFAULT FALSE,
    is_reserved BOOLEAN DEFAULT FALSE,

    detected_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_articles_vinted ON articles(vinted_id);
CREATE INDEX IF NOT EXISTS idx_articles_user ON articles(user_id);
CREATE INDEX IF NOT EXISTS idx_articles_filter ON articles(filter_id);
CREATE INDEX IF NOT EXISTS idx_articles_pepite ON articles(is_pepite) WHERE is_pepite = TRUE;
CREATE INDEX IF NOT EXISTS idx_articles_detected ON articles(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_filter_detected ON articles(filter_id, detected_at DESC);

-- Table achats (tracking financier)
CREATE TABLE IF NOT EXISTS purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    article_id INTEGER REFERENCES articles(id) ON DELETE SET NULL,

    title VARCHAR(500) NOT NULL,
    brand_name VARCHAR(255),
    category_name VARCHAR(255),
    vinted_url TEXT,
    photo_url TEXT,

    -- Finance achat
    purchase_price DECIMAL(10,2) NOT NULL,
    shipping_cost DECIMAL(10,2) DEFAULT 0,
    total_cost DECIMAL(10,2) GENERATED ALWAYS AS (purchase_price + shipping_cost) STORED,

    -- Finance revente
    is_sold BOOLEAN DEFAULT FALSE,
    sold_price DECIMAL(10,2),
    sold_shipping_cost DECIMAL(10,2),
    sold_platform_fee DECIMAL(10,2),
    sold_date TIMESTAMP,

    -- Calculs automatiques
    profit DECIMAL(10,2) GENERATED ALWAYS AS (
        CASE WHEN is_sold AND sold_price IS NOT NULL
        THEN sold_price - purchase_price - shipping_cost - COALESCE(sold_platform_fee, 0)
        ELSE NULL END
    ) STORED,
    profit_pct DECIMAL(5,2) GENERATED ALWAYS AS (
        CASE WHEN is_sold AND sold_price IS NOT NULL AND (purchase_price + shipping_cost) > 0
        THEN ((sold_price - purchase_price - shipping_cost - COALESCE(sold_platform_fee, 0)) / (purchase_price + shipping_cost)) * 100
        ELSE NULL END
    ) STORED,

    status VARCHAR(50) DEFAULT 'purchased',
    notes TEXT,

    purchased_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchases_user ON purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases(status);

-- Table prix moyens (cache pour detection pepites)
CREATE TABLE IF NOT EXISTS price_references (
    id SERIAL PRIMARY KEY,
    search_key VARCHAR(500) NOT NULL,
    catalog_id INTEGER,
    brand_id INTEGER,
    size_id VARCHAR(100),
    condition_id INTEGER,

    avg_price DECIMAL(10,2),
    median_price DECIMAL(10,2),
    min_price DECIMAL(10,2),
    max_price DECIMAL(10,2),
    sample_count INTEGER,

    calculated_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '6 hours'
);

CREATE INDEX IF NOT EXISTS idx_price_ref_key ON price_references(search_key);
CREATE INDEX IF NOT EXISTS idx_price_ref_expiry ON price_references(expires_at);
CREATE INDEX IF NOT EXISTS idx_price_ref_lookup ON price_references(catalog_id, brand_id, size_id);

-- Table migrations tracking
CREATE TABLE IF NOT EXISTS _migrations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    applied_at TIMESTAMP DEFAULT NOW()
);
