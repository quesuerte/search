use std::time::{SystemTime,UNIX_EPOCH};
use std::sync::atomic::{AtomicU32, Ordering};
use pulsar::{producer, proto, Error as PulsarError, Producer, Pulsar, SerializeMessage, TokioExecutor};
use std::sync::mpsc::{Sender, Receiver, channel};
use rocket::serde::json::serde_json;
use rocket::{Data, Request, Response};
use rocket::fairing::{Fairing, Info, Kind};
use serde::Serialize;
use gethostname::gethostname;
use tokio::runtime::Runtime;
use std::thread;

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

pub struct QueueAppender {
    host: String,
    log_sender: Sender<LogRecord>,
    id_counter: IdCounter,
}

impl QueueAppender {
    // pub async fn build(broker: String, topic_name: String) -> Result<Self,PulsarError> {
    //     let host = gethostname().into_string()
    //     .map_err(|e| PulsarError::Custom(format!("Failed to retrieve hostname from underlying system: {:#?}", e)))?;
    //     let (tx, rx) = channel();
    //     let addr = format!("pulsar://{}",broker);
    //     producer_thread(addr, topic_name, host.clone(), rx).await?;
    //     Ok(Self {
    //         host,
    //         log_sender: tx,
    //         id_counter: IdCounter::new(),
    //     })
    // }
    pub fn build(broker: String, topic_name: String) -> Result<Self,PulsarError> {
        let host = gethostname().into_string()
        .map_err(|e| PulsarError::Custom(format!("Failed to retrieve hostname from underlying system: {:#?}", e)))?;
        let (tx, rx) = channel();
        let addr = format!("pulsar://{}",broker);
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .map_err(|e| PulsarError::Custom(format!("Failed to open new async runtime: {}", e.to_string())))?;
        let mut producer = rt.block_on(create_producer(addr,topic_name,host.clone()))?;
        thread::spawn(move || {
            while let Ok(msg) = rx.recv() {
                match rt.block_on({
                    producer
                    .send_non_blocking(msg)
                }) {
                    Ok(v) => match rt.block_on(v) {
                        Ok(_) => (),
                        Err(e) => {
                            eprintln!("Message not received: {}",e.to_string());
                            continue;
                        }
                    },
                    Err(e) => {
                        eprintln!("Failed to send message to Pulsar: {}",e.to_string());
                        continue;
                    },
                }
            }
        });
        Ok(Self {
            host,
            log_sender: tx,
            id_counter: IdCounter::new(),
        })
    }
    fn log_to_pulsar(&self, log: LogRecord) {
        let tx = self.log_sender.clone();
        tx.send(log).unwrap_or_else(|e| 
            eprintln!("Failed to send message to internal receiver: {}", e.to_string()));
    }
}
// async fn producer_thread(addr: String, topic: String, host: String, rx: Receiver<LogRecord>) -> Result<(),PulsarError> {
//     let (statustx, statusrx) = channel();
//     tokio::spawn(async move {
//         let mut producer = match create_producer(addr,topic,host).await {
//             Ok(v) => {
//                 statustx.send(Ok(())).expect("Pulsar worker disconnected, kill process");
//                 v             
//             },
//             Err(e) => {
//                 statustx.send(Err(e)).expect("Pulsar worker disconnected, kill process");
//                 return;
//             },
//         };
//         while let Ok(msg) = rx.recv() {
//             match producer
//             .send_non_blocking(msg)
//             .await {
//                 Ok(v) => match v.await {
//                     Ok(_) => (),
//                     Err(e) => {
//                         eprintln!("Message not received: {}",e.to_string());
//                         continue;
//                     }
//                 },
//                 Err(e) => {
//                     eprintln!("Failed to send message to Pulsar: {}",e.to_string());
//                     continue;
//                 },
//             }
//         }
//         println!("Closing log producer");
//     });
//     statusrx.recv().map_err(|e| PulsarError::Custom(e.to_string()))?
// }

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
        self.log_to_pulsar(record);
    }

    async fn on_response<'r>(&self, request: &'r Request<'_>, response: &mut Response<'r>) {
        let id = *request.local_cache(|| 0);
        let record = LogRecord::new(id,get_time(),self.host.clone(),request,Some(response));
        self.log_to_pulsar(record);
    }
}



fn get_time() -> i64 {
    SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .unwrap_or_else(|e| e.duration())
    .as_millis() as i64 // Convert to milliseconds
}
