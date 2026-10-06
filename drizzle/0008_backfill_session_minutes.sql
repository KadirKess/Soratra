-- Custom SQL migration file, put your code below! --

-- Backfill reading_sessions.minutes from the legacy time_range buckets.
-- Values mirror the old timeRangeToMinutes() midpoint map. Runs before
-- migration 0009 makes minutes NOT NULL and drops time_range.
-- The bucket strings use en-dash (U+2013), matching the old CHECK constraint.
UPDATE "reading_sessions" SET "minutes" = CASE "time_range"
  WHEN '< 15 min' THEN 10
  WHEN '15–30'    THEN 22
  WHEN '30–45'    THEN 37
  WHEN '45–60'    THEN 52
  WHEN '1–1.5h'   THEN 75
  WHEN '1.5–2h'   THEN 105
  WHEN '2–4h'     THEN 180
  WHEN '4–6h'     THEN 300
  WHEN '6–8h'     THEN 420
  WHEN '8h+'      THEN 540
  ELSE 30
END
WHERE "minutes" IS NULL;
