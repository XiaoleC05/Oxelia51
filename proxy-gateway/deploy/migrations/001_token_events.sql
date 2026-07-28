CREATE DATABASE IF NOT EXISTS oxelia51;

CREATE TABLE IF NOT EXISTS oxelia51.token_events (
    event_id String,
    project_id String,
    session_id String,
    provider LowCardinality(String),
    model String,
    prompt_tokens UInt32,
    completion_tokens UInt32,
    total_tokens UInt32,
    cost_usd Float64,
    duration_ms UInt32,
    timestamp DateTime64(3),
    api_key_hash FixedString(64)
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (project_id, timestamp);
