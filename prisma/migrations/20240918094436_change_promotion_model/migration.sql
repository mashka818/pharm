-- Step 1: Add new columns with default values or as nullable first
ALTER TABLE "promotions"
ADD COLUMN "description" TEXT NULL,
ADD COLUMN "favicon" TEXT NULL;

-- Step 2: Update existing rows with default values (if needed)
UPDATE "promotions" 
SET "description" = 'Default description', 
    "favicon" = 'default_favicon.png';

-- Step 3: Alter the columns to be non-nullable after updating existing data
ALTER TABLE "promotions"
ALTER COLUMN "description" SET NOT NULL,
ALTER COLUMN "favicon" SET NOT NULL;

-- Step 4: Add the new primary key (if needed) before dropping the old one
-- You could add a new primary key column here

-- Step 5: Drop the old primary key constraint and id column (if applicable)
ALTER TABLE "promotions"
DROP CONSTRAINT "promotions_pkey",
DROP COLUMN "id";
