
CREATE DATABASE search;
\connect search;
CREATE EXTENSION vector;
CREATE TABLE sources (
    id VARCHAR(2048) PRIMARY KEY,
    uri VARCHAR(2048) NOT NULL,
    title VARCHAR(100),
    author VARCHAR(500),
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