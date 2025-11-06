use anyhow::Result;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

/// Entity extractor using regex-based keyword extraction for hybrid search
/// Extracts relevant keywords and entities from text to improve search accuracy
pub struct EntityExtractor {
    /// Important RCRT domain terms
    domain_terms: HashSet<String>,
    /// Regex for extracting schemas (e.g., "tool.code.v1")
    schema_pattern: Regex,
    /// Regex for extracting code identifiers
    identifier_pattern: Regex,
}

impl EntityExtractor {
    /// Initialize entity extractor (model_path and tokenizer_path kept for API compatibility but unused)
    pub fn new(_model_path: &str, _tokenizer_path: &str) -> Result<Self> {
        // RCRT-specific domain terms to extract
        let domain_terms = vec![
            // Core concepts
            "breadcrumb", "breadcrumbs", "agent", "agents", "tool", "tools",
            "context", "embedding", "embeddings", "semantic", "vector",
            "schema", "schemas", "secret", "secrets", "tag", "tags",
            
            // Actions
            "create", "search", "execute", "configure", "update", "delete",
            "publish", "subscribe", "trigger", "respond",
            
            // Technologies
            "deno", "typescript", "rust", "postgresql", "onnx", "gliner",
            "docker", "jwt", "api", "sse", "pgvector",
            
            // Features
            "permission", "permissions", "ui_schema", "bootstrap", "schedule",
            "workflow", "catalog", "config", "definition",
            
            // Components
            "database", "frontend", "backend", "dashboard", "runner",
        ]
        .into_iter()
        .map(|s| s.to_lowercase())
        .collect();
        
        // Regex for schemas (e.g., "tool.code.v1", "user.message.v1")
        let schema_pattern = Regex::new(r"\b[a-z_]+(?:\.[a-z_]+)+\.v\d+\b")?;
        
        // Regex for code identifiers (camelCase, snake_case, kebab-case)
        let identifier_pattern = Regex::new(r"\b(?:[a-z][a-z0-9_-]*|[a-z][a-zA-Z0-9]+)\b")?;
        
        Ok(Self {
            domain_terms,
            schema_pattern,
            identifier_pattern,
        })
    }
    
    /// Extract entities and keywords from text
    /// Returns empty result for empty text
    pub fn extract(&self, text: &str) -> Result<ExtractedEntities> {
        if text.is_empty() {
            return Ok(ExtractedEntities::default());
        }
        
        let text_lower = text.to_lowercase();
        let mut entities: HashMap<String, Vec<String>> = HashMap::new();
        let mut keywords = Vec::new();
        
        // Extract schemas (high priority)
        for cap in self.schema_pattern.captures_iter(&text_lower) {
            let schema = cap.get(0).unwrap().as_str().to_string();
            entities
                .entry("schema".to_string())
                .or_default()
                .push(schema.clone());
            keywords.push(schema);
        }
        
        // Extract domain terms
        for term in &self.domain_terms {
            if text_lower.contains(term) {
                entities
                    .entry("concept".to_string())
                    .or_default()
                    .push(term.clone());
                keywords.push(term.clone());
            }
        }
        
        // Extract identifiers (lower priority - only keep unique ones)
        for cap in self.identifier_pattern.captures_iter(&text_lower) {
            let identifier = cap.get(0).unwrap().as_str();
            // Filter out common words and very short identifiers
            if identifier.len() >= 4 && self.domain_terms.contains(identifier) {
                keywords.push(identifier.to_string());
            }
        }
        
        // Deduplicate keywords
        keywords.sort();
        keywords.dedup();
        
        Ok(ExtractedEntities { entities, keywords })
    }
}

/// Result of entity extraction
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ExtractedEntities {
    /// Entities grouped by type (e.g., {"tool": ["openrouter", "calculator"], "action": ["create"]})
    pub entities: HashMap<String, Vec<String>>,
    /// High-confidence keywords for search (lowercased, deduplicated)
    pub keywords: Vec<String>,
}

