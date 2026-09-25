-- Phone numbers are stored as exactly 10 digits.
-- Existing values like '+91-98450-00001' keep their last 10 digits; anything shorter is cleared.
UPDATE "Employee"
SET "phone" = CASE
    WHEN length(regexp_replace("phone", '[^0-9]', '', 'g')) >= 10
      THEN right(regexp_replace("phone", '[^0-9]', '', 'g'), 10)
    ELSE NULL
  END
WHERE "phone" IS NOT NULL AND "phone" !~ '^[0-9]{10}$';

ALTER TABLE "Employee"
  ADD CONSTRAINT "Employee_phone_10_digits" CHECK ("phone" IS NULL OR "phone" ~ '^[0-9]{10}$');
