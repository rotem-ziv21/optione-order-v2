-- Enable foreign key from quotes to auth.users
ALTER TABLE quotes
ADD CONSTRAINT quotes_created_by_fkey
FOREIGN KEY (created_by) REFERENCES auth.users(id);
