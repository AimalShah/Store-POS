# Use better-sqlite3 instead of sql.js

The PRD (Offline POS System) requires transaction-safe writes with no data loss on crash or power cut and names better-sqlite3 as the database layer. v2 deliberately used sql.js to avoid native-module build pain (documented in README), but sql.js persists by flushing the entire in-memory file on a 50ms debounce — a power cut mid-write can lose or corrupt the last sale. We migrate to better-sqlite3 in Phase 1: the server's db wrapper (`server/db.js`) already mimics its `prepare`/`get`/`all`/`run`/`transaction` API, and electron-builder ships Windows x64 prebuilds, so the swap is contained to the server layer.

Considered option: staying on sql.js — rejected because it fails the durability NFR.
