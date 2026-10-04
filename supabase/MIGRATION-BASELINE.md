# Existing project migration baseline

The first 19 ordered files in `migrations/` mirror the existing SQL setup scripts. They are registered as already applied to the linked project because its live schema already contains the corresponding tables, columns, policies, functions, and triggers. This records migration history only; it does not re-run the SQL. Later timestamped files contain new schema changes and must be reviewed before deployment.

`promote-owner.sql` is intentionally excluded because it changes account data rather than defining the shared schema.

Going forward, create a new timestamped SQL file in `migrations/` for each schema change, inspect `pnpm run supabase:migrations`, then apply pending files with `pnpm run supabase:push`.
