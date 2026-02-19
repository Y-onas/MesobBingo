-- Add SMS text field to deposits table
ALTER TABLE "deposits" ADD COLUMN "sms_text" text;

-- Add comment for clarity
COMMENT ON COLUMN "deposits"."sms_text" IS 'SMS message text from payment provider (CBE, Telebirr, etc.)';
