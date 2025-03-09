use sqlx::{postgres::PgRow, PgPool, Row};
use super::embeddings::OllamaWrapper;
use crate::response::OllamaConfig;
use rocket_db_pools::sqlx;
use rocket_db_pools::Database;
use rocket_db_pools::Connection;
use pgvector::Vector;

#[derive(Database)]
#[database("main")]
pub struct PostgresBackend(PgPool);

pub async fn backend_search(mut db: Connection<PostgresBackend>, input: &str, semantic: Option<&OllamaConfig>) -> Result<Vec<PgRow>, sqlx::Error> {
    let limit = 5;
    // Embed query ...
    let query = match semantic.is_some() {
        true => "SELECT a.id, a.page, b.uri, b.title, b.author, b.summary, a.embedding <=> $1 AS rank \
                FROM semantic_search a \
                INNER JOIN sources b ON a.id = b.id \
                ORDER BY rank \
                LIMIT $2",
        false => "SELECT a.id, a.page, b.uri, b.title, b.author, b.summary, ts_rank(a.ts, websearch_to_tsquery('english', $1)) AS rank \
                 FROM keyword_search a INNER JOIN sources b ON a.id = b.id \
                 WHERE a.ts @@ websearch_to_tsquery('english', $1 ) \
                 ORDER BY rank DESC LIMIT $2"
    };
    match semantic {
        Some(ollama_conf) => {
            let ollama = OllamaWrapper::build(ollama_conf.url().to_string(),ollama_conf.model().to_string())
            .map_err(|e| sqlx::Error::Io(std::io::Error::new(std::io::ErrorKind::Other, e)))?;
            let embedding = ollama.gen_emb(input).await
            .map_err(|e| sqlx::Error::Io(std::io::Error::new(std::io::ErrorKind::Other, e)))?;
            // We have to force pgvector package to earlier version to avoid conflicts with new traits
            Ok(sqlx::query(query)
                .bind(Vector::from(embedding))
                .bind(limit)
                .fetch_all(&mut **db)
                .await?)
        },
        // This query doesn't work for strings with spaces in them??
        None => Ok(sqlx::query(query)
        .bind(input)
        .bind(limit)
        .fetch_all(&mut **db)
        .await?)
    }
}
pub async fn get_pdf_uri(mut db: Connection<PostgresBackend>, id: &str) -> Result<String,sqlx::Error> {
    let row: PgRow = sqlx::query("SELECT uri as uri FROM sources WHERE id = $1")
        .bind(id)
        .fetch_one(&mut **db)
        .await?.into();
    Ok(row.get(0))
}

#[cfg(test)]
mod tests {
    // use super::*;
    // use testcontainers::{core::{wait::LogWaitStrategy, IntoContainerPort, WaitFor}, runners::AsyncRunner, GenericImage, ImageExt};
    // use std::path::Path;

    #[tokio::test]
    async fn test_postgres() {
        return;
        // let protocol = "http";
        // let model = "all-minilm".to_string();
        // let ollama_port = 11434;
        // let container = GenericImage::new("ollama/ollama", "latest")
        //     .with_wait_for(WaitFor::Duration { length: Duration::from_secs(20) })
        //     .with_exposed_port(ollama_port.tcp())
        //     .with_entrypoint("bash")
        //     .with_cmd(vec!["-c",format!("ollama serve & pid=$!; sleep 5; ollama pull {model}; wait $pid").as_str()])
        //     .start()
        //     .await
        //     .expect("Failed to start Ollama");
        // let container_host = container.get_host().await.expect("Could not get hostname for Ollama container");
        // let container_port = container.get_host_port_ipv4(ollama_port.tcp()).await.expect("Could not get port for ollama container");

        // let pg_port = 5432;
        // let container = GenericImage::new("pgvector/pgvector", "pg17")
        //     .with_wait_for(WaitFor::Log(LogWaitStrategy::stdout("UTC [1] LOG:  database system is ready to accept connections")))
        //     .with_exposed_port(pg_port.tcp())
        //     .with_copy_to("/docker-entrypoint-initdb.d/a.sql", Path::new("../../postgres.sql"))
        //     .with_copy_to("/docker-entrypoint-initdb.d/b.sql", Path::new("../../fakedata.sql"))
        //     .start()
        //     .await
        //     .expect("Failed to start postgres");
        // let container_host = container.get_host().await.expect("Could not get hostname for Postgres container");
        // let container_port = container.get_host_port_ipv4(pg_port.tcp()).await.expect("Could not get port for Postgres container");
        // Connection::from(value)
        
        //assert_eq!(embedding.len(), 384);
    }
}



