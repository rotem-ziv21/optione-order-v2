-- בדיקה אם טבלת business_webhooks קיימת
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'business_webhooks') THEN
        -- יצירת טבלת business_webhooks אם היא לא קיימת
        CREATE TABLE business_webhooks (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            business_id UUID REFERENCES businesses(id) NOT NULL,
            url TEXT NOT NULL,
            on_order_created BOOLEAN DEFAULT FALSE,
            on_order_paid BOOLEAN DEFAULT FALSE,
            on_product_purchased BOOLEAN DEFAULT FALSE,
            product_id UUID REFERENCES products(id),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    ELSE
        -- הוספת עמודות חדשות לטבלה קיימת
        BEGIN
            ALTER TABLE business_webhooks 
            ADD COLUMN IF NOT EXISTS on_product_purchased BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) NULL;
        EXCEPTION WHEN duplicate_column THEN
            -- התעלם משגיאת עמודה כפולה
        END;
    END IF;
END
$$;

-- בדיקה אם טבלת webhook_logs קיימת
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'webhook_logs') THEN
        -- יצירת טבלת webhook_logs אם היא לא קיימת
        CREATE TABLE webhook_logs (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            webhook_id UUID REFERENCES business_webhooks(id) NOT NULL,
            order_id TEXT,
            product_id UUID REFERENCES products(id),
            request_payload JSONB,
            response_status INTEGER,
            response_body TEXT,
            sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
    END IF;
END
$$;
