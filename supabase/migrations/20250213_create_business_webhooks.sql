-- Create the business_webhooks table
CREATE TABLE IF NOT EXISTS business_webhooks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    on_order_created BOOLEAN DEFAULT false,
    on_order_paid BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Add RLS policies
ALTER TABLE business_webhooks ENABLE ROW LEVEL SECURITY;

-- Allow users to see their own business's webhooks
CREATE POLICY "Users can view their own business webhooks"
    ON business_webhooks
    FOR SELECT
    USING (
        business_id IN (
            SELECT business_id FROM business_staff WHERE user_id = auth.uid()
        )
    );

-- Allow users to insert webhooks for their own business
CREATE POLICY "Users can insert webhooks for their own business"
    ON business_webhooks
    FOR INSERT
    WITH CHECK (
        business_id IN (
            SELECT business_id FROM business_staff WHERE user_id = auth.uid()
        )
    );

-- Allow users to update their own business's webhooks
CREATE POLICY "Users can update their own business webhooks"
    ON business_webhooks
    FOR UPDATE
    USING (
        business_id IN (
            SELECT business_id FROM business_staff WHERE user_id = auth.uid()
        )
    );

-- Allow users to delete their own business's webhooks
CREATE POLICY "Users can delete their own business webhooks"
    ON business_webhooks
    FOR DELETE
    USING (
        business_id IN (
            SELECT business_id FROM business_staff WHERE user_id = auth.uid()
        )
    );

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_business_webhooks_updated_at
    BEFORE UPDATE
    ON business_webhooks
    FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
