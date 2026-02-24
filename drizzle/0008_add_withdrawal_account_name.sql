-- Add account holder name to withdrawals table for security
-- This ensures we know exactly who the money is being sent to

ALTER TABLE withdrawals 
ADD COLUMN IF NOT EXISTS account_holder_name TEXT;

-- Add comment for documentation
COMMENT ON COLUMN withdrawals.account_holder_name IS 'Full name of the account holder for withdrawal verification';
