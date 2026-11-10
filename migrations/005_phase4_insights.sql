-- Phase 4 schema. Additive only: insight history is derived from existing rows.
-- INS-3 requires peak-window planning to be optional, so the switch lives with
-- the other daily controls. It defaults on, matching the phase requirement;
-- turning it off clears suggested start times on the next scheduling pass.
ALTER TABLE settings ADD COLUMN peak_windows_enabled INTEGER NOT NULL DEFAULT 1
  CHECK (peak_windows_enabled IN (0, 1));
