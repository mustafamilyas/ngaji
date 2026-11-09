-- Usernames are lowercase from now on (multi-org-and-onboarding task 10.4).
-- If two users differ only by case, the unique index on "username" makes this
-- statement fail and the migration abort; resolve those accounts by hand first.
UPDATE "User" SET "username" = lower("username") WHERE "username" <> lower("username");
