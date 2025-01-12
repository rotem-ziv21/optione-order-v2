-- Create user_profiles table if not exists
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    role TEXT DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add super admin role for rotemziv7766@gmail.com
INSERT INTO user_profiles (id, role)
SELECT id, 'super_admin'
FROM auth.users
WHERE email = 'rotemziv7766@gmail.com'
ON CONFLICT (id) DO UPDATE SET role = 'super_admin';

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own profile
DROP POLICY IF EXISTS "Users can read their own profile" ON user_profiles;
CREATE POLICY "Users can read their own profile"
ON user_profiles
FOR SELECT
TO authenticated
USING (
    id = auth.uid()
    OR 
    auth.email() = 'rotemziv7766@gmail.com'
);

-- Create trigger to automatically create profile for new users
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_profiles (id)
  VALUES (new.id);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop if exists and create trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Grant permissions
GRANT ALL ON user_profiles TO authenticated;
