-- Phase 3 follow-up: link a brain dump to the task it is about, so the accepted
-- step can be a shrunken version of that task (PDD §8.3 flow step 5, REF-2).
-- A separate migration keeps 003 safe on a database that already ran it.
ALTER TABLE brain_dump ADD COLUMN source_task_id INTEGER REFERENCES task(id);
