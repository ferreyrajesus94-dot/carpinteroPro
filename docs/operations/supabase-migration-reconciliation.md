# Supabase migration reconciliation

## Context

The linked Supabase project was created with timestamp-based migration versions, while the repository later canonicalized the same historical schema into numeric local migrations.

After SDD 1 (`tenant-rls-security`), the remote ledger has:

- `0001` matched locally and remotely.
- `0020` and `0021` applied forward-only and marked as applied remotely.
- `20260501113753_0018_recipe_pieces.sql` recovered as a real remote migration.
- Older timestamp versions from `20260414220158` through `20260429235652` that correspond to historical schema already represented by numeric migrations.

## Repository strategy

This repo keeps numeric migrations `0002` through `0019` as the executable local development history.

The timestamp files from `202604...` are **comment-only placeholders**. They exist only to acknowledge remote migration ledger entries and keep future `supabase migration list --linked` output understandable.

Do not add executable SQL to these placeholder files. Doing so would duplicate historical DDL during local resets because the numeric migrations already create the schema.

## Remote ledger strategy

To fully clean `supabase migration list --linked`, the remaining remote step is to mark local numeric migrations `0002` through `0019` as applied in the remote ledger.

That command mutates Supabase migration metadata and must be approved separately:

```bash
supabase migration repair --linked --status applied \
  0002 0003 0004 0005 0006 0007 0008 0009 \
  0010 0011 0012 0013 0014 0015 0016 0017 0018 0019
```

Do **not** run `supabase db push --linked` before this reconciliation is complete, because Supabase would see old numeric migrations as pending and may try to replay duplicate schema DDL against remote.

## Future rule

All new migrations after this reconciliation should use normal Supabase timestamped migration filenames. Do not create new numeric migrations.
