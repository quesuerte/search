#[macro_use] extern crate rocket;
use rocket::{serde::json::Json,
            figment::{value::{Map, Value}, 
            util::map}};
use rocket_db_pools::{Connection,Database};
use tokio::io::AsyncRead;

mod response;
mod backend;
use backend::postgres::PostgresBackend;
use response::{search,
    pdf_stream,
    QueryResponse,
    PdfStreamResponse,
    ServerError,
    Query,
    OllamaConfig};

#[get("/")]
async fn index() -> String {
    "Healthy".to_string()
}

#[get("/pdf/<id>")]
async fn get_pdf<'r>(db: Connection<PostgresBackend>, id: &str) -> Result<PdfStreamResponse<Box<dyn AsyncRead + Unpin + Send>>,ServerError> {
    Ok(pdf_stream(db, id).await.map_err(|e| ServerError::new(e.to_string()))?)
}

#[post("/semantic", format = "application/json", data = "<input>")]
async fn semantic_search(db: Connection<PostgresBackend>, ollama: &OllamaConfig, input: Json<Query<'_>>) -> Result<Json<QueryResponse>,ServerError> {
    Ok(Json(search(db, input.query, Some(ollama)).await.map_err(|e| ServerError::new(e.to_string()))?))
}

#[post("/keyword", format = "application/json", data = "<input>")]
async fn keyword_search(db: Connection<PostgresBackend>, input: Json<Query<'_>>) -> Result<Json<QueryResponse>,ServerError> {
    Ok(Json(search(db, input.query, None).await.map_err(|e| ServerError::new(e.to_string()))?))
}

#[launch]
fn rocket() -> _ {
    // BACKEND_USER
    // BACKEND_PASS
    // BACKEND_HOST
    // BACKEND_PORT
    // BACKEND_DB
    // BACKEND_POOL_SIZE
    // BACKEND_POOL_TIMEOUT
    // OLLAMA_PROTO
    // OLLAMA_HOST
    // OLLAMA_PORT
    // OLLAMA_MODEL
    let db: Map<_, Value> = map! {
        "url" => "postgres://postgres:admin@localhost:5432/postgres".into(),
        "pool_size" => 10.into(),
        "timeout" => 5.into(),
    };

    let figment = rocket::Config::figment()
        .merge(("databases", map!["main" => db]));


    let ollama_con = OllamaConfig::new("http://localhost:11434".to_owned(),"all-minilm".to_owned());
    rocket::custom(figment)
    //rocket::build()
    .mount("/", routes![index,semantic_search,keyword_search,get_pdf])
    .manage(ollama_con)
    .attach(PostgresBackend::init())
}

#[cfg(test)]
mod tests {
    use super::*;
    use testcontainers::{core::{IntoContainerPort, WaitFor}, runners::AsyncRunner, GenericImage, ImageExt};
    use std::time::Duration;
    use std::path::Path;
    use rocket::local::asynchronous::Client;
    use futures::try_join;

    #[rocket::async_test]
    async fn test_async_endpoint() {
        let protocol = "http";
        let model = "all-minilm".to_string();
        let ollama_port = 11434;
        let ollama_con_future = GenericImage::new("ollama/ollama", "latest")
            .with_wait_for(WaitFor::Duration { length: Duration::from_secs(20) })
            .with_exposed_port(ollama_port.tcp())
            .with_entrypoint("bash")
            .with_cmd(vec!["-c",format!("ollama serve & pid=$!; sleep 5; ollama pull {model}; wait $pid").as_str()])
            .start();
        

        let pg_port = 5432;
        let pg_con_future = GenericImage::new("pgvector/pgvector", "pg17")
            .with_wait_for(WaitFor::Duration { length: Duration::from_secs(20) })
            .with_exposed_port(pg_port.tcp())
            .with_env_var("POSTGRES_PASSWORD", "admin")
            .with_copy_to("/docker-entrypoint-initdb.d/a.sql", Path::new("./postgres.sql"))
            .with_copy_to("/docker-entrypoint-initdb.d/b.sql", Path::new("./fakedata.sql"))
            .start();

        let (pg_con, ollama_con) = try_join!(
            pg_con_future,
            ollama_con_future
        ).expect("Failed to start ollama and postgres");
        
        let pg_host_f = pg_con.get_host();
        let pg_port_f = pg_con.get_host_port_ipv4(pg_port.tcp());
        let ollama_host_f = ollama_con.get_host();
        let ollama_port_f = ollama_con.get_host_port_ipv4(ollama_port.tcp());

        let (pg_host, pg_port, ollama_host, ollama_port) = try_join!(
            pg_host_f,
            pg_port_f,
            ollama_host_f,
            ollama_port_f
        ).expect("Failed to retrieve connection information for containers");

        let db: Map<_, Value> = map! {
            "url" => format!("postgres://postgres:admin@{}:{}/postgres",pg_host,pg_port).into(),
            "pool_size" => 10.into(),
            "timeout" => 5.into(),
        };
    
        let figment = rocket::Config::figment()
            .merge(("databases", map!["main" => db]));
        
        let ollama_con = OllamaConfig::new(format!("{protocol}://{ollama_host}:{ollama_port}"),model);
        let rocket_instance = rocket::custom(figment)
        //rocket::build()
        .mount("/", routes![index,semantic_search,keyword_search,get_pdf])
        .manage(ollama_con)
        .attach(PostgresBackend::init());

        let client = Client::tracked(rocket_instance).await.expect("valid rocket instance");
        let response = client.get("/").dispatch().await;
        assert!(response.status().code == 200)
        // assertions...
    }
}