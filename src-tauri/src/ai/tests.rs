use super::*;

#[test]
fn test_qwen_client_creation() {
    // Test successful creation
    let client = QwenClient::new("test-api-key".to_string());
    assert!(client.is_ok());
    
    // Test empty API key
    let client = QwenClient::new("".to_string());
    assert!(client.is_err());
    assert_eq!(client.unwrap_err(), "API key cannot be empty");
    
    // Test whitespace-only API key
    let client = QwenClient::new("   ".to_string());
    assert!(client.is_err());
    assert_eq!(client.unwrap_err(), "API key cannot be empty");
}

#[test]
fn test_qwen_client_endpoint() {
    let client = QwenClient::new("test-api-key".to_string()).unwrap();
    assert_eq!(
        client.endpoint,
        "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation"
    );
}

#[test]
fn test_qwen_client_clone() {
    let client = QwenClient::new("test-api-key".to_string()).unwrap();
    let cloned = client.clone();
    
    assert_eq!(client.endpoint, cloned.endpoint);
}
