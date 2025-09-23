# RCRT Server Transform Implementation Guide

## Overview

This guide shows how to implement `llm_hints` transform support in the RCRT server, allowing breadcrumbs to define their own LLM-optimized views.

## Implementation Location

In `crates/rcrt-server/src/main.rs` or a new module `crates/rcrt-server/src/transforms.rs`

## Step 1: Define Transform Types

```rust
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TransformMode {
    Replace,
    Merge,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum TransformRule {
    #[serde(rename = "template")]
    Template { template: String },
    
    #[serde(rename = "extract")]
    Extract { value: String }, // JSONPath
    
    #[serde(rename = "jq")]
    Jq { query: String },
    
    #[serde(rename = "literal")]
    Literal { literal: Value },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LlmHints {
    pub transform: Option<HashMap<String, TransformRule>>,
    pub include: Option<Vec<String>>,
    pub exclude: Option<Vec<String>>,
    pub mode: Option<TransformMode>,
}
```

## Step 2: Transform Engine

```rust
use handlebars::Handlebars;
use jsonpath_lib as jsonpath;

pub struct TransformEngine {
    handlebars: Handlebars<'static>,
}

impl TransformEngine {
    pub fn new() -> Self {
        let mut handlebars = Handlebars::new();
        handlebars.set_strict_mode(false);
        Self { handlebars }
    }

    pub fn apply_llm_hints(&self, context: &Value, hints: &LlmHints) -> Result<Value, String> {
        let mut result = context.clone();

        // Apply include/exclude filters first
        if let Some(include) = &hints.include {
            result = self.filter_fields(&result, include, true)?;
        }
        if let Some(exclude) = &hints.exclude {
            result = self.filter_fields(&result, exclude, false)?;
        }

        // Apply transforms
        if let Some(transforms) = &hints.transform {
            let transformed = self.apply_transforms(&result, transforms)?;
            
            match hints.mode.as_ref().unwrap_or(&TransformMode::Replace) {
                TransformMode::Replace => result = json!(transformed),
                TransformMode::Merge => {
                    if let Value::Object(mut obj) = result {
                        if let Value::Object(trans_obj) = transformed {
                            obj.extend(trans_obj);
                        }
                        result = Value::Object(obj);
                    }
                }
            }
        }

        Ok(result)
    }

    fn apply_transforms(
        &self,
        context: &Value,
        transforms: &HashMap<String, TransformRule>
    ) -> Result<Value, String> {
        let mut result = json!({});
        
        for (key, rule) in transforms {
            let value = match rule {
                TransformRule::Template { template } => {
                    self.apply_template(context, template)?
                },
                TransformRule::Extract { value: path } => {
                    self.extract_path(context, path)?
                },
                TransformRule::Jq { query } => {
                    self.apply_jq(context, query)?
                },
                TransformRule::Literal { literal } => {
                    literal.clone()
                },
            };
            
            if let Value::Object(ref mut obj) = result {
                obj.insert(key.clone(), value);
            }
        }
        
        Ok(result)
    }

    fn apply_template(&self, context: &Value, template: &str) -> Result<Value, String> {
        let data = json!({ "context": context });
        self.handlebars
            .render_template(template, &data)
            .map(|s| json!(s))
            .map_err(|e| e.to_string())
    }

    fn extract_path(&self, context: &Value, path: &str) -> Result<Value, String> {
        jsonpath::select(context, path)
            .map_err(|e| format!("JSONPath error: {:?}", e))
            .map(|values| {
                if values.len() == 1 {
                    values[0].clone()
                } else {
                    json!(values)
                }
            })
    }

    fn apply_jq(&self, _context: &Value, _query: &str) -> Result<Value, String> {
        // JQ implementation would require jq-rs crate
        // For now, return error
        Err("JQ transforms not yet implemented".to_string())
    }

    fn filter_fields(&self, value: &Value, fields: &[String], include: bool) -> Result<Value, String> {
        match value {
            Value::Object(obj) => {
                let mut result = serde_json::Map::new();
                for (key, val) in obj {
                    let should_include = fields.contains(key);
                    if (include && should_include) || (!include && !should_include) {
                        result.insert(key.clone(), val.clone());
                    }
                }
                Ok(Value::Object(result))
            }
            _ => Ok(value.clone())
        }
    }
}
```

## Step 3: Update get_breadcrumb_context

```rust
async fn get_breadcrumb_context(
    State(state): State<AppState>,
    auth: AuthContext,
    axum::extract::Path(id): axum::extract::Path<Uuid>
) -> Result<Json<BreadcrumbContextView>, (axum::http::StatusCode, String)> {
    let Some(mut view) = state.db
        .get_breadcrumb_context_for(auth.owner_id, Some(auth.agent_id), id)
        .await
        .map_err(internal_error)?
    else {
        return Err((axum::http::StatusCode::NOT_FOUND, "not found".into()));
    };

    // Apply LLM hints if present
    if let Some(hints_value) = view.context.get("llm_hints") {
        if let Ok(hints) = serde_json::from_value::<LlmHints>(hints_value.clone()) {
            let engine = TransformEngine::new();
            match engine.apply_llm_hints(&view.context, &hints) {
                Ok(transformed) => {
                    view.context = transformed;
                }
                Err(e) => {
                    tracing::warn!("Failed to apply llm_hints: {}", e);
                    // Continue with original context
                }
            }
        }
    }

    Ok(Json(view))
}
```

## Step 4: Add Dependencies

In `crates/rcrt-server/Cargo.toml`:

```toml
[dependencies]
handlebars = "5.1"
jsonpath-lib = "0.3"
# Optional: jq-rs = "0.4" for JQ support
```

## Step 5: Test Cases

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_template_transform() {
        let engine = TransformEngine::new();
        let context = json!({
            "items": [
                {"name": "Alice", "age": 30},
                {"name": "Bob", "age": 25}
            ]
        });
        
        let hints = LlmHints {
            transform: Some(HashMap::from([(
                "summary".to_string(),
                TransformRule::Template {
                    template: "{{context.items.length}} users".to_string()
                }
            )])),
            mode: Some(TransformMode::Replace),
            ..Default::default()
        };
        
        let result = engine.apply_llm_hints(&context, &hints).unwrap();
        assert_eq!(result, json!({"summary": "2 users"}));
    }

    #[test]
    fn test_extract_transform() {
        let engine = TransformEngine::new();
        let context = json!({
            "tools": [
                {"name": "openrouter"},
                {"name": "file-storage"}
            ]
        });
        
        let hints = LlmHints {
            transform: Some(HashMap::from([(
                "tool_names".to_string(),
                TransformRule::Extract {
                    value: "$.tools[*].name".to_string()
                }
            )])),
            mode: Some(TransformMode::Replace),
            ..Default::default()
        };
        
        let result = engine.apply_llm_hints(&context, &hints).unwrap();
        assert_eq!(result["tool_names"], json!(["openrouter", "file-storage"]));
    }
}
```

## Step 6: Caching (Optional)

```rust
use std::sync::Arc;
use tokio::sync::RwLock;
use lru::LruCache;

pub struct TransformCache {
    cache: Arc<RwLock<LruCache<Uuid, (Value, std::time::Instant)>>>,
    ttl: std::time::Duration,
}

impl TransformCache {
    pub fn new(capacity: usize, ttl_seconds: u64) -> Self {
        Self {
            cache: Arc::new(RwLock::new(LruCache::new(capacity))),
            ttl: std::time::Duration::from_secs(ttl_seconds),
        }
    }
    
    pub async fn get(&self, id: &Uuid) -> Option<Value> {
        let cache = self.cache.read().await;
        if let Some((value, timestamp)) = cache.get(id) {
            if timestamp.elapsed() < self.ttl {
                return Some(value.clone());
            }
        }
        None
    }
    
    pub async fn put(&self, id: Uuid, value: Value) {
        let mut cache = self.cache.write().await;
        cache.put(id, (value, std::time::Instant::now()));
    }
}
```

## Benefits

1. **Token Efficiency** - LLMs see only necessary data
2. **Flexibility** - Each breadcrumb controls its view
3. **Performance** - Caching reduces transform overhead
4. **Extensibility** - Easy to add new transform types

## Next Steps

1. Implement basic transforms (template, extract)
2. Test with bootstrap data
3. Add caching layer
4. Consider JQ support
5. Add metrics/monitoring
