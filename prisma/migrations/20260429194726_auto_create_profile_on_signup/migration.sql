-- 1. Add foreign key from public.users(id) to auth.users(id).
--    Cascading delete keeps the profile row in sync if the auth user is removed.
ALTER TABLE "public"."users"
  ADD CONSTRAINT "users_id_fkey"
  FOREIGN KEY ("id") REFERENCES "auth"."users"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- 2. Trigger function: insert a public.users row whenever auth.users gains a row.
--    SECURITY DEFINER so the function runs with elevated privileges, allowing
--    the auth schema's trigger to write into public.
CREATE OR REPLACE FUNCTION "public"."handle_new_auth_user"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO "public"."users" ("id", "created_at", "updated_at")
  VALUES (NEW.id, NOW(), NOW())
  ON CONFLICT ("id") DO NOTHING;
  RETURN NEW;
END;
$$;

-- 3. Attach the trigger to auth.users so every signup gets a profile row.
DROP TRIGGER IF EXISTS "on_auth_user_created" ON "auth"."users";
CREATE TRIGGER "on_auth_user_created"
AFTER INSERT ON "auth"."users"
FOR EACH ROW
EXECUTE FUNCTION "public"."handle_new_auth_user"();

-- 4. Backfill any existing auth.users rows that don't yet have a profile row.
INSERT INTO "public"."users" ("id", "created_at", "updated_at")
SELECT u.id, NOW(), NOW()
FROM "auth"."users" u
LEFT JOIN "public"."users" p ON p.id = u.id
WHERE p.id IS NULL;
