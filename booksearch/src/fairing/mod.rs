use std::time::{SystemTime,UNIX_EPOCH};
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use pulsar::{producer, proto, Error as PulsarError, Producer, Pulsar, SerializeMessage, TokioExecutor};
use tokio::sync::mpsc::{UnboundedReceiver,UnboundedSender};
use std::sync::Arc;
use rocket::serde::json::serde_json;
use rocket::{Data, Request, Response, Rocket, Orbit};
use rocket::fairing::{Fairing, Info, Kind};
use serde::Serialize;


struct IdCounter {
    count: AtomicU32,
}

impl IdCounter {
    fn new() -> Self {
        IdCounter {
            count: AtomicU32::new(0),
        }
    }

    fn get_id(&self) -> u32 {
        // Increments and returns the new value
        self.count.fetch_add(1, Ordering::SeqCst)
    }
}

pub struct BackgroundLogger {
    shutdown: Arc<AtomicBool>,
}

impl BackgroundLogger {
    pub async fn build(broker: String, topic_name: String, host: String, rx: UnboundedReceiver<LogRecord>) -> Result<Self,PulsarError> {
        let shutdown = Arc::new(AtomicBool::new(false));
        let addr = format!("pulsar://{}",broker);
        let mut producer = create_producer(addr,topic_name,host.clone()).await?;
        let thread_shutdown = shutdown.clone();
        let mut receiver = rx;
        tokio::spawn(async move {
            while !thread_shutdown.load(Ordering::Relaxed) {
                let msg = match receiver.recv().await {
                    Some(m) => m,
                    None => {
                        eprintln!("Logging system disconnected. If this does not correspond with a shutdown, something went horribly wrong.");
                        return;
                    }
                };
                match send_msg(&mut producer,msg).await{
                    Ok(_) => (),
                    Err(e) => eprintln!("Failed to send message to Pulsar: {}",e.to_string()),
                };
            }
            receiver.close();
            while let Some(msg) = receiver.recv().await {
                match send_msg(&mut producer,msg).await{
                    Ok(_) => (),
                    Err(e) => eprintln!("Failed to send message to Pulsar: {}",e.to_string()),
                };
            }
        });
        Ok(Self { shutdown })
    }
}

async fn send_msg(producer: &mut Producer<TokioExecutor>, msg: LogRecord) -> Result<(),PulsarError> {
    producer
        .send_non_blocking(msg).await?.await.map(|_| ())
}

#[rocket::async_trait]
impl Fairing for BackgroundLogger {
    fn info(&self) -> Info {
        Info {
            name: "Shutdown Handler",
            kind: Kind::Shutdown,
        }
    }

    async fn on_shutdown(&self, _rocket: &Rocket<Orbit>) {
        println!("Server shutting down, notifying background thread...");
        self.shutdown.store(true, Ordering::Relaxed);
    }
}

pub struct QueueAppender {
    host: String,
    log_sender: UnboundedSender<LogRecord>,
    id_counter: IdCounter,
}

impl QueueAppender {
    pub fn new(host: String, tx: UnboundedSender<LogRecord>) -> Self {
        Self {
            host,
            log_sender: tx,
            id_counter: IdCounter::new(),
        }
    }
    async fn log_to_pulsar(&self, log: LogRecord) {
        let tx = self.log_sender.clone();
        tx.send(log).unwrap_or_else(|e| 
            eprintln!("Failed to send message to internal receiver: {}", e.to_string()));
    }
}

async fn create_producer(addr: String, topic: String, host: String) -> Result<Producer<TokioExecutor>,PulsarError> {
    let pulsar: Pulsar<_> = Pulsar::builder(addr, TokioExecutor).build().await?;
    Ok(pulsar
        .producer()
        .with_topic(topic)
        .with_name(format!("Rust producer: {}",host))
        .with_options(producer::ProducerOptions {
            schema: Some(proto::Schema {
                r#type: proto::schema::Type::Json as i32,
                schema_data: LOG_SCHEMA.as_bytes().to_vec(),
                ..Default::default()
            }),
            ..Default::default()
        })
        .build()
        .await?)
}

const LOG_SCHEMA: &str = "{ \"type\": \"record\",
\"name\": \"LogEntry\",
\"namespace\": \"default\",
\"fields\": [
{ \"name\": \"id\", \"type\": \"int\" },
{ \"name\": \"action_time\", \"type\": \"long\" },
{ \"name\": \"host\", \"type\": \"string\" },
{ \"name\": \"remote\", \"type\": \"string\" },
{ \"name\": \"method\", \"type\": \"string\" },
{ \"name\": \"route\", \"type\": \"string\" },
{ \"name\": \"request_headers\", \"type\": \"string\" },
{ \"name\": \"status\", \"type\": [\"null\", \"string\"], \"default\": null },
{ \"name\": \"response_headers\", \"type\": [\"null\", \"string\"], \"default\": null }
]}";
//{ \"name\": \"action_time\", \"type\": {\"type\":\"long\", \"logicalType\": \"timestamp-millis\"} },

#[derive(Serialize)]
pub struct LogRecord {
    id: u32,
    action_time: i64,
    host: String,
    remote: String,
    method: String,
    route: String,
    request_headers: String,
    status: Option<String>,
    response_headers: Option<String>,
}

impl LogRecord {
    fn new(id: u32, action_time: i64, host: String, request: &Request, response: Option<&Response>) -> Self {
        Self {
            id,
            action_time,
            host,
            remote: match request.remote() {
                Some(r) => r.to_string(),
                None => "Unknown".to_string()
            },
            method: request.method().to_string(),
            route: match request.route() {
                Some(r) => r.uri.to_string(),
                None => "Unknown".to_string()
            },
            request_headers: request
            .headers()
            .iter()
            .fold("".to_string(), 
            |cur, next| cur + "\n" + &format!("{}: {}",next.name(),next.value())
            ),
            status: response.map(|r| r.status().to_string()),
            response_headers: response.map(|r| r.headers()
            .iter()
            .fold("".to_string(), 
            |cur, next| cur + "\n" + &format!("{}: {}",next.name(),next.value())))
        }
    }
}

impl SerializeMessage for LogRecord {
    fn serialize_message(input: Self) -> Result<producer::Message, PulsarError> {
        let payload = serde_json::to_vec(&input).map_err(|e| PulsarError::Custom(e.to_string()))?;
        Ok(producer::Message {
            payload,
            // This is necessary for the underlying sink to be able to retrieve the correct schema to parse the input
            schema_version: Some(vec![0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x04]),
            ..Default::default()
        })
    }
}

#[rocket::async_trait]
impl Fairing for QueueAppender {
    // This is a request and response fairing named "GET/POST Counter".
    fn info(&self) -> Info {
        Info {
            name: "Kafka logging appender",
            kind: Kind::Request | Kind::Response
        }
    }

    // Increment the counter for `GET` and `POST` requests.
    async fn on_request(&self, request: &mut Request<'_>, _: &mut Data<'_>) {
        let id = self.id_counter.get_id();
        request.local_cache(|| id);
        let record = LogRecord::new(id,get_time(),self.host.clone(),request,None);
        self.log_to_pulsar(record).await;
    }

    async fn on_response<'r>(&self, request: &'r Request<'_>, response: &mut Response<'r>) {
        let id = *request.local_cache(|| 0);
        let record = LogRecord::new(id,get_time(),self.host.clone(),request,Some(response));
        self.log_to_pulsar(record).await;
    }
}



fn get_time() -> i64 {
    SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .unwrap_or_else(|e| e.duration())
    .as_millis() as i64 // Convert to milliseconds
}
