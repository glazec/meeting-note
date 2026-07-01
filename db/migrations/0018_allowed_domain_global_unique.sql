CREATE UNIQUE INDEX IF NOT EXISTS "allowed_domains_domain_unique" ON "allowed_domains" USING btree ("domain");
