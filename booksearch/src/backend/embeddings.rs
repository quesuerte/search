use ollama_rs::error::OllamaError;
use ollama_rs::Ollama;
use ollama_rs::generation::embeddings::request::GenerateEmbeddingsRequest;
use url::ParseError;

pub struct OllamaWrapper {
    ollama: Ollama,
    emb_model: String,
}

impl OllamaWrapper {
    pub fn build(url: String, model: String) -> Result<Self,ParseError> {
        let ollama = Ollama::try_new(url)?;
        let emb_model = model;
        Ok(Self {ollama, emb_model})
    }
    pub async fn gen_emb(&self, input: &str) -> Result<Vec<f32>, OllamaError> {
        let request = GenerateEmbeddingsRequest::new(self.emb_model.clone(), input.into());
        let res = self.ollama.generate_embeddings(request).await?;
        Ok(res.embeddings[0].clone())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use testcontainers::{core::{IntoContainerPort, WaitFor}, runners::AsyncRunner, GenericImage, ImageExt};
    use std::time::Duration;

    #[tokio::test]
    async fn test_ollama() {
        let protocol = "http";
        let model = "all-minilm".to_string();
        let ollama_port = 11434;
        let container = GenericImage::new("ollama/ollama", "latest")
            .with_wait_for(WaitFor::Duration { length: Duration::from_secs(20) })
            .with_exposed_port(ollama_port.tcp())
            .with_entrypoint("bash")
            .with_cmd(vec!["-c",format!("ollama serve & pid=$!; sleep 5; ollama pull {model}; wait $pid").as_str()])
            .start()
            .await
            .expect("Failed to start Ollama");
        let container_host = container.get_host().await.expect("Could not get hostname for Ollama container");
        let container_port = container.get_host_port_ipv4(ollama_port.tcp()).await.expect("Could not get port for ollama container");
        let ollama = OllamaWrapper::build(format!("{protocol}://{container_host}:{container_port}"),model).expect("OllamaWrapper failed to create connection to Ollama");
        let embedding = ollama.gen_emb("hello").await.expect("Encountered error when generating embedding");
        assert_eq!(embedding.len(), 384);
    }
}