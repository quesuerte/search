#[macro_use] extern crate rocket;
use rocket::{figment::{util::map, value::{Map, Value}}, http::Method, serde::json::Json};
use rocket_db_pools::{Connection,Database};
use rocket_cors::{AllowedOrigins, CorsOptions};
use tokio::io::AsyncRead;
use std::{env,net::IpAddr};
use gethostname::gethostname;
use tokio::sync::mpsc::unbounded_channel;

mod fairing;
mod response;
mod backend;
use fairing::{QueueAppender,BackgroundLogger};
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
async fn get_pdf(db: Connection<PostgresBackend>, id: &str, client_ip: IpAddr) -> Result<PdfStreamResponse<Box<dyn AsyncRead + Unpin + Send>>,ServerError> {
    Ok(pdf_stream(db, id, client_ip.to_string()).await?)
}

#[post("/semantic", format = "application/json", data = "<input>")]
async fn semantic_search(db: Connection<PostgresBackend>, ollama: &OllamaConfig, input: Json<Query<'_>>) -> Result<Json<QueryResponse>,ServerError> {
    Ok(Json(search(db, input.query, Some(ollama)).await?))
}

#[post("/keyword", format = "application/json", data = "<input>")]
async fn keyword_search(db: Connection<PostgresBackend>, input: Json<Query<'_>>) -> Result<Json<QueryResponse>,ServerError> {
    Ok(Json(search(db, input.query, None).await?))
}

#[rocket::main]
async fn main() -> Result<(), rocket::Error> {
    // Postgres connection parameters
    let pg_user = env::var("BACKEND_USER").unwrap_or("postgres".to_string());
    let pg_pass = env::var("BACKEND_PASS").unwrap_or("admin".to_string());
    let pg_host = env::var("BACKEND_HOST").unwrap_or("localhost".to_string());
    let pg_port: i32 = env::var("BACKEND_PORT").unwrap_or(5432.to_string()).parse().unwrap();
    let pg_db = env::var("BACKEND_DB").unwrap_or("search".to_string());
    let pg_pool_size: i32 = env::var("BACKEND_POOL_SIZE").unwrap_or(10.to_string()).parse().unwrap();
    let pg_pool_timeout: i32 = env::var("BACKEND_POOL_TIMEOUT").unwrap_or(5.to_string()).parse().unwrap();

    // Ollama connection parameters
    let ollama_proto = env::var("OLLAMA_PROTO").unwrap_or("http".to_string());
    let ollama_host = env::var("OLLAMA_HOST").unwrap_or("localhost".to_string());
    let ollama_port: i32 = env::var("OLLAMA_PORT").unwrap_or(11434.to_string()).parse().unwrap();
    let ollama_model = env::var("OLLAMA_MODEL").unwrap_or("all-minilm".to_string());

    // Kafka connection parameters
    let broker = env::var("BROKER_HOST").unwrap_or("localhost".to_string());
    let topic = env::var("BROKER_TOPIC").unwrap_or("search_log".to_string());

    let db: Map<_, Value> = map! {
        "url" => format!("postgres://{pg_user}:{pg_pass}@{pg_host}:{pg_port}/{pg_db}").into(),
        "pool_size" => pg_pool_size.into(),
        "timeout" => pg_pool_timeout.into(),
    };

    let figment = rocket::Config::figment()
        .merge(("databases", map!["main" => db]));

    let cors = CorsOptions::default()
        .allowed_origins(AllowedOrigins::all())
        .allowed_methods(
            vec![Method::Get, Method::Post]
                .into_iter()
                .map(From::from)
                .collect(),
        )
        .allow_credentials(true);
    let ollama_con = OllamaConfig::new(format!("{ollama_proto}://{ollama_host}:{ollama_port}"),ollama_model);
    let host = gethostname().into_string().expect("Could not retrieve hostname from underlying system");

    // Pulsar configuration, if pulsar is available
    let (tx, rx) = unbounded_channel();
    let pulsar_appender = QueueAppender::new(host.clone(),tx);
    let log_background_result =  BackgroundLogger::build(broker,topic,host,rx).await;

    let rocket_config = rocket::custom(figment)
    .mount("/", routes![index,semantic_search,keyword_search,get_pdf])
    .manage(ollama_con)
    .attach(PostgresBackend::init())
    .attach(cors.to_cors().unwrap());
    match log_background_result {
        Ok(log_background) => {
            rocket_config.attach(pulsar_appender)
            .attach(log_background).launch().await?;
        },
        Err(e) => {
            eprintln!("Could not connect to Pulsar ({e}), starting without Pulsar appender");
            rocket_config.launch().await?;
        }
    }
    
    Ok(())
}

/* 
$env:BACKEND_USER="search_readonly"
$env:BACKEND_PASS="test_password"
$env:BACKEND_HOST="ubuntu"
$env:OLLAMA_HOST="ubuntu"
*/

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
        let pg_con_future = GenericImage::new("timescale/timescaledb", "latest-pg17")
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