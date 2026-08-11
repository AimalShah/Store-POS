# v3 starts from a fresh database, no migration

v3 moves to better-sqlite3 and a new schema (PINs, payment breakdowns, stock movements, shifts). Rather than migrating existing sql.js-era data, v3 initializes a new `pos-v3.sqlite` with a `schema_version` table and seeds only admin, default settings, and the Walk-in customer. The v2 data is development data with no production value, and a clean schema avoids carrying legacy columns forward. The first-run wizard (admin PIN + store name) bootstraps the fresh install.

Considered option: migrating the v2 sqlite file in place — rejected because the data has no production value and migrations would carry dead legacy columns into the new schema.
