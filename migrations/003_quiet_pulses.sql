-- Quiet-hour check-ins are real slots: they render as a card, never escalate,
-- and must never turn into a missed pulse (which would reset the combo).
ALTER TABLE pulse ADD COLUMN quiet INTEGER NOT NULL DEFAULT 0 CHECK (quiet IN (0, 1));
