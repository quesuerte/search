CREATE DATABASE logs;
\connect logs;

CREATE TABLE search_requests_raw (
    id INTEGER NOT NULL,
    action_time BIGINT NOT NULL,
    host VARCHAR(253) NOT NULL,
    remote VARCHAR(260) NOT NULL,
    method VARCHAR(7) NOT NULL,
    route  VARCHAR(2048) NOT NULL,
    request_headers TEXT NOT NULL,
    status VARCHAR(256),
    response_headers TEXT
);

CREATE TABLE search_requests (
    id INTEGER NOT NULL,
    action_time TIMESTAMPTZ NOT NULL,
    host VARCHAR(253) NOT NULL,
    remote VARCHAR(260) NOT NULL,
    method VARCHAR(7) NOT NULL,
    route  VARCHAR(2048) NOT NULL,
    request_headers TEXT NOT NULL,
    status VARCHAR(10),
    response_headers TEXT
);

CREATE OR REPLACE FUNCTION replicate_hypertable() RETURNS trigger
   LANGUAGE plpgsql AS
$$BEGIN 
   INSERT INTO search_requests (id, action_time, host, remote, method, route, request_headers, status, response_headers)
   VALUES (NEW.id,TO_TIMESTAMP(NEW.action_time), NEW.host,NEW.remote, NEW.method,NEW.route,NEW.request_headers,NEW.status,NEW.response_headers);
   RETURN NULL; 
END;$$;

CREATE TRIGGER fix_sink
   BEFORE INSERT ON search_requests_raw FOR EACH ROW 
   EXECUTE PROCEDURE replicate_hypertable();

SELECT create_hypertable('search_requests', by_range('action_time'));

CREATE USER log_writer WITH PASSWORD 'test_password';
GRANT CONNECT ON DATABASE logs TO log_writer;
GRANT USAGE ON SCHEMA public TO log_writer;
GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA public TO log_writer;

CREATE DATABASE search;
\connect search;
--CREATE EXTENSION IF NOT EXISTS vectorscale CASCADE;
CREATE EXTENSION vector;
CREATE TABLE sources (
    id VARCHAR(2048) PRIMARY KEY,
    source VARCHAR(2048) NOT NULL,
    uri VARCHAR(2048) NOT NULL,
    title VARCHAR(2048),
    author VARCHAR(2048),
    summary VARCHAR(2048),
    title_embedding VECTOR(384),
    summary_embedding VECTOR(384)
);
CREATE INDEX ON sources USING hnsw (title_embedding vector_cosine_ops);
CREATE INDEX ON sources USING hnsw (summary_embedding vector_cosine_ops);
CREATE INDEX ON sources USING gin(to_tsvector('english', title));
CREATE INDEX ON sources USING gin(to_tsvector('english', summary));


CREATE TABLE semantic_search (
    id VARCHAR(2048),
    page INTEGER,
    chunk INTEGER,
    embedding VECTOR(384),
    CONSTRAINT fk_sem_source FOREIGN KEY (id)
    REFERENCES sources(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);
CREATE INDEX ON semantic_search USING hnsw (embedding vector_cosine_ops);

CREATE TABLE keyword_search (
    id VARCHAR(2048),
    page INTEGER,
    ts TSVECTOR,
    CONSTRAINT fk_key_source FOREIGN KEY (id)
    REFERENCES sources(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);
CREATE INDEX ON keyword_search USING gin(ts);


CREATE USER search_readonly WITH PASSWORD 'test_password';
GRANT CONNECT ON DATABASE search TO search_readonly;
GRANT USAGE ON SCHEMA public TO search_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO search_readonly;