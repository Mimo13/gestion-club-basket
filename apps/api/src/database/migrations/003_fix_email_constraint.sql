ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_format_check;
ALTER TABLE users
  ADD CONSTRAINT users_email_format_check CHECK (email ~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$');
