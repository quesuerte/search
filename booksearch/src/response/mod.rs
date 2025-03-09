use super::backend::postgres::{PostgresBackend,backend_search,get_pdf_uri};
use rocket::{response::Responder,
    request,
    request::{FromRequest, Outcome},
    serde::{Serialize,Deserialize},
    Request,
    response,
    Response,
    http::{ContentType, Header}};
use rocket_db_pools::{Connection,sqlx::Row};
use tokio_util::compat::FuturesAsyncReadCompatExt;
use futures::stream::TryStreamExt;
use tokio::io::AsyncRead;

// 1. Define a struct to hold your custom configuration value
pub struct OllamaConfig {
    url: String,
    model: String,
    // Add any other config values you need
}

impl OllamaConfig {
    pub fn new(url: String, model: String) -> Self {
        Self {
            url,
            model
        }
    }
    pub fn url(&self) -> &str {
        &self.url
    }
    pub fn model(&self) -> &str {
        &self.model
    }
}

// 2. Create a guard to extract this configuration in your handlers
#[rocket::async_trait]
impl<'r> FromRequest<'r> for &'r OllamaConfig {
    type Error = ();

    async fn from_request(request: &'r Request<'_>) -> request::Outcome<Self, Self::Error> {
        // Get the custom config from managed state
        match request.rocket().state::<OllamaConfig>() {
            Some(config) => Outcome::Success(config),
            None => Outcome::Error((rocket::http::Status::InternalServerError, ())),
        }
    }
}

#[derive(Deserialize)]
#[serde(crate = "rocket::serde")]
pub struct Query<'r> {
    pub query: &'r str,
}

#[derive(Debug, Serialize, Responder)]
#[response(status = 500, content_type = "application/json")]
pub struct ServerError {
    message: String   
}

impl ServerError {
    pub fn new(message: String) -> Self {
        Self {message}
    }
}

// Implementing reponse wrapper for streamed PDF file. Wrapper is needed to specify the file name and content type for proper HTTP response.
#[derive(Debug)]
pub struct PdfStreamResponse<T: AsyncRead + Unpin + Send + 'static> {
    pub stream: T,
    pub id: String,
}

impl<'r, T: AsyncRead + Unpin + Send + 'static> Responder<'r,'r> for PdfStreamResponse<T> {
    fn respond_to(self, _: &Request) -> response::Result<'r> {
        Response::build()
        .header(ContentType::PDF)
        .header(Header::new("Content-Disposition", format!("inline; filename=\"{}.pdf\"", self.id)))
        .streamed_body(self.stream)
        .ok()
    }
}

// Struct containing results from backend database converted into a HTTP friendly format.
#[derive(Serialize)]
pub struct QueryResponse {
    results: Vec<RowResponse>
}

#[derive(Serialize)]
struct RowResponse {
    id: String,
    page: i32,
    title: String,
    author: String,
    summary: String,
    rank: Rank,
}

#[derive(Serialize)]
enum Rank {
    Keyword(f32),
    Semantic(f64),
}

pub async fn search(db: Connection<PostgresBackend>, query: &str, semantic: Option<&OllamaConfig>) -> Result<QueryResponse,sqlx::Error> {
    let rows = backend_search(db, query, semantic).await
    .map_err(|e| sqlx::Error::Io(std::io::Error::new(std::io::ErrorKind::Other, e)))?;
    let mut results = Vec::new();
    for row in rows {
        let id: String = row.get("id");
        let page: i32 = row.get("page");
        let title: String = row.try_get("title").unwrap_or(id.clone());
        let author: String = row.try_get("author").unwrap_or_default();
        let summary: String = row.try_get("summary").unwrap_or_default();
        let rank = match row.try_get::<f32, &str>("rank") { // Try getting as i64 first
            Ok(rank_f32) => Rank::Keyword(rank_f32 as f32), // Convert to i32
            Err(_) => match row.try_get::<f64, &str>("rank") { // If i64 fails, try f64
                Ok(rank_f64) => Rank::Semantic(rank_f64 as f64), // Convert to f32
                Err(e) => return Err(sqlx::Error::TypeNotFound{ type_name: format!("Could not parse rank column into i32 or f64: {}", e.to_string())})
            }
        };
        results.push(RowResponse{id,page,title,author,summary,rank});
    }
    Ok(QueryResponse{results})
}

pub async fn pdf_stream<'r>(db: Connection<PostgresBackend>, id: &str) -> Result<PdfStreamResponse<Box<dyn AsyncRead + Unpin + Send>>, std::io::Error> {
    let file_url = get_pdf_uri(db, id).await
    .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?; // Replace with your actual file URL

    let download = reqwest::get(file_url)
        .await.map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))? // await server response
        .error_for_status().map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?; // generate an error if server didn't respond OK
    
    let async_read_stream = download
    .bytes_stream()
    .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))
    .into_async_read()
    .compat();

    Ok(PdfStreamResponse{
        stream: Box::new(async_read_stream),
        id: id.to_string(),
    })
}