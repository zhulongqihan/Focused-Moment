use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;

#[cfg(test)]
mod tests;

/// Qwen API client for text generation
#[derive(Debug, Clone)]
pub struct QwenClient {
    api_key: String,
    client: Client,
    pub(crate) endpoint: String,
}

/// Request payload for Qwen API
#[derive(Debug, Serialize)]
struct QwenRequest {
    model: String,
    input: QwenInput,
    parameters: QwenParameters,
}

#[derive(Debug, Serialize)]
struct QwenInput {
    messages: Vec<QwenMessage>,
}

#[derive(Debug, Serialize)]
struct QwenMessage {
    role: String,
    content: String,
}

#[derive(Debug, Serialize)]
struct QwenParameters {
    result_format: String,
}

/// Response from Qwen API
#[derive(Debug, Deserialize)]
struct QwenResponse {
    output: QwenOutput,
    #[allow(dead_code)]
    usage: QwenUsage,
}

#[derive(Debug, Deserialize)]
struct QwenOutput {
    text: Option<String>,
    choices: Option<Vec<QwenChoice>>,
}

#[derive(Debug, Deserialize)]
struct QwenChoice {
    message: QwenResponseMessage,
}

#[derive(Debug, Deserialize)]
struct QwenResponseMessage {
    content: String,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct QwenUsage {
    total_tokens: u32,
}

impl QwenClient {
    /// Create a new QwenClient with the given API key
    pub fn new(api_key: String) -> Result<Self, String> {
        if api_key.trim().is_empty() {
            return Err("API key cannot be empty".to_string());
        }

        let client = Client::builder()
            .timeout(Duration::from_secs(10))
            .build()
            .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

        Ok(Self {
            api_key,
            client,
            endpoint: "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation".to_string(),
        })
    }

    /// Generate text using Qwen API
    pub async fn generate_text(&self, prompt: String) -> Result<String, String> {
        let request = QwenRequest {
            model: "qwen-turbo".to_string(),
            input: QwenInput {
                messages: vec![QwenMessage {
                    role: "user".to_string(),
                    content: prompt,
                }],
            },
            parameters: QwenParameters {
                result_format: "message".to_string(),
            },
        };

        let response = self
            .client
            .post(&self.endpoint)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await
            .map_err(|e| format!("Failed to send request: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            return Err(format!("API request failed with status {}: {}", status, error_text));
        }

        let qwen_response: QwenResponse = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse response: {}", e))?;

        // Extract text from response
        let text = if let Some(choices) = qwen_response.output.choices {
            choices
                .first()
                .map(|choice| choice.message.content.clone())
                .ok_or_else(|| "No choices in response".to_string())?
        } else if let Some(text) = qwen_response.output.text {
            text
        } else {
            return Err("No text content in response".to_string());
        };

        Ok(text)
    }
}
