-- Create system_logs table
CREATE TABLE IF NOT EXISTS system_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  action VARCHAR(255) NOT NULL,
  details TEXT,
  user_email VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS system_logs_created_at_idx ON system_logs(created_at);
CREATE INDEX IF NOT EXISTS system_logs_user_email_idx ON system_logs(user_email);

-- Add RLS policies
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;

-- Only admin can view logs
CREATE POLICY system_logs_admin_access ON system_logs
  FOR ALL
  TO authenticated
  USING (
    auth.email() IN ('rotemziv7766@gmail.com', 'rotem@optionecrm.com')
  );
