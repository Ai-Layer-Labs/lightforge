//! LLM Hints Transform Engine
//! Processes llm_hints to create optimized context views for LLM consumption

use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::collections::HashMap;
use handlebars::Handlebars;
use jsonpath_lib as jsonpath;

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
    
    #[serde(rename = "format")]
    Format { format: String }, // Simple {field} replacement
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LlmHints {
    #[serde(default)]  // Empty vec if missing
    pub exclude: Vec<String>,
    pub transform: Option<HashMap<String, TransformRule>>,
    pub mode: Option<TransformMode>,
}

pub struct TransformEngine {
    handlebars: Handlebars<'static>,
}

impl TransformEngine {
    pub fn new() -> Self {
        let mut handlebars = Handlebars::new();
        handlebars.set_strict_mode(false);
        Self { handlebars }
    }

    /// Apply LLM hints to transform a context value
    pub fn apply_llm_hints(&self, context: &Value, hints: &LlmHints) -> Result<Value, String> {
        let mut result = context.clone();

        // Apply exclude filter (required field)
        if !hints.exclude.is_empty() {
            result = self.filter_fields(&result, &hints.exclude, false)?;
        }

        // Apply transforms
        if let Some(transforms) = &hints.transform {
            let transformed = self.apply_transforms(&result, transforms)?;
            
            match hints.mode.as_ref().unwrap_or(&TransformMode::Replace) {
                TransformMode::Replace => result = transformed,
                TransformMode::Merge => {
                    // Check if both are objects for merging
                    match (&result, &transformed) {
                        (Value::Object(_), Value::Object(_)) => {
                            // Both are objects, we can merge
                            if let Value::Object(mut base) = result.clone() {
                                if let Value::Object(trans) = transformed {
                                    base.extend(trans);
                                    result = Value::Object(base);
                                }
                            }
                        }
                        _ => {
                            // Not both objects, just replace
                            result = transformed;
                        }
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
                TransformRule::Format { format } => {
                    self.apply_format(context, format)?
                },
            };
            
            if let Value::Object(ref mut obj) = result {
                obj.insert(key.clone(), value);
            }
        }
        
        Ok(result)
    }

    fn apply_template(&self, context: &Value, template: &str) -> Result<Value, String> {
        // Wrap context for handlebars
        let data = json!({ "context": context });
        
        self.handlebars
            .render_template(template, &data)
            .map(|s| json!(s))
            .map_err(|e| format!("Template error: {}", e))
    }

    fn extract_path(&self, context: &Value, path: &str) -> Result<Value, String> {
        let mut selector = jsonpath::selector(context);
        match selector(path) {
            Ok(values) => {
                if values.is_empty() {
                    Ok(Value::Null)
                } else if values.len() == 1 {
                    Ok(values[0].clone())
                } else {
                    // Multiple values, return as array
                    Ok(json!(values))
                }
            }
            Err(e) => Err(format!("JSONPath error: {:?}", e))
        }
    }

    fn apply_jq(&self, _context: &Value, _query: &str) -> Result<Value, String> {
        // JQ implementation would require jq-rs crate
        // For now, return error with helpful message
        Err("JQ transforms not yet implemented. Use 'template' or 'extract' instead.".to_string())
    }

    fn apply_format(&self, context: &Value, format_str: &str) -> Result<Value, String> {
        // Simple {field} and {nested.field} replacement
        let mut result = format_str.to_string();
        
        // Find all {field} patterns
        let mut start = 0;
        while let Some(open_pos) = result[start..].find('{') {
            let abs_open = start + open_pos;
            if let Some(close_pos) = result[abs_open..].find('}') {
                let abs_close = abs_open + close_pos;
                let field_path = &result[abs_open + 1..abs_close];
                
                // Extract value using JSONPath
                let json_path = format!("$.{}", field_path);
                match self.extract_path(context, &json_path) {
                    Ok(value) => {
                        let replacement = match value {
                            Value::String(s) => s,
                            Value::Number(n) => n.to_string(),
                            Value::Bool(b) => b.to_string(),
                            Value::Null => String::new(),
                            _ => value.to_string(),
                        };
                        
                        result.replace_range(abs_open..=abs_close, &replacement);
                        start = abs_open + replacement.len();
                    }
                    Err(_) => {
                        // Field not found, leave placeholder or replace with empty
                        result.replace_range(abs_open..=abs_close, "");
                        start = abs_open;
                    }
                }
            } else {
                break;
            }
        }
        
        Ok(json!(result))
    }

    fn filter_fields(&self, value: &Value, fields: &[String], include: bool) -> Result<Value, String> {
        match value {
            Value::Object(obj) => {
                let mut result = serde_json::Map::new();
                
                for (key, val) in obj {
                    // Check if this exact field should be processed
                    let exact_match = fields.iter().any(|f| f == key);
                    
                    // Check if this field has nested exclusions
                    let has_nested = fields.iter().any(|f| f.starts_with(&format!("{}.", key)));
                    
                    if include {
                        // Include mode: only keep fields in the list
                        if exact_match {
                            result.insert(key.clone(), val.clone());
                        }
                    } else {
                        // Exclude mode: keep fields NOT in the list
                        if !exact_match {
                            if has_nested {
                                // This field has nested exclusions, process recursively
                                let nested_fields: Vec<String> = fields.iter()
                                    .filter(|f| f.starts_with(&format!("{}.", key)))
                                    .map(|f| f.strip_prefix(&format!("{}.", key)).unwrap().to_string())
                                    .collect();
                                
                                let filtered_val = self.filter_fields(val, &nested_fields, include)?;
                                result.insert(key.clone(), filtered_val);
                            } else {
                                // No nested exclusions, keep as-is
                                result.insert(key.clone(), val.clone());
                            }
                        }
                    }
                }
                Ok(Value::Object(result))
            }
            _ => Ok(value.clone())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_template_transform() {
        let engine = TransformEngine::new();
        let context = json!({
            "name": "TestUser",
            "count": 5
        });
        
        let hints = LlmHints {
            exclude: vec![],  // No exclusions
            transform: Some(HashMap::from([(
                "summary".to_string(),
                TransformRule::Template {
                    template: "User: {{context.name}} (count: {{context.count}})".to_string()
                }
            )])),
            mode: Some(TransformMode::Replace),
        };
        
        let result = engine.apply_llm_hints(&context, &hints).unwrap();
        assert_eq!(result["summary"], json!("User: TestUser (count: 5)"));
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
            exclude: vec![],  // No exclusions
            transform: Some(HashMap::from([(
                "tool_names".to_string(),
                TransformRule::Extract {
                    value: "$.tools[*].name".to_string()
                }
            )])),
            mode: Some(TransformMode::Replace),
        };
        
        let result = engine.apply_llm_hints(&context, &hints).unwrap();
        assert_eq!(result["tool_names"], json!(["openrouter", "file-storage"]));
    }

    #[test]
    fn test_literal_transform() {
        let engine = TransformEngine::new();
        let context = json!({"some": "data"});
        
        let hints = LlmHints {
            exclude: vec![],  // No exclusions
            transform: Some(HashMap::from([(
                "instruction".to_string(),
                TransformRule::Literal {
                    literal: json!("Use the tools to help the user")
                }
            )])),
            mode: Some(TransformMode::Replace),
        };
        
        let result = engine.apply_llm_hints(&context, &hints).unwrap();
        assert_eq!(result["instruction"], json!("Use the tools to help the user"));
    }

    #[test]
    fn test_exclude_fields() {
        let engine = TransformEngine::new();
        let context = json!({
            "name": "Test",
            "internal_id": "12345",
            "metadata": {
                "public": "yes",
                "internal_id": "secret"
            }
        });
        
        let hints = LlmHints {
            exclude: vec!["internal_id".to_string(), "metadata.internal_id".to_string()],
            transform: None,
            mode: None,
        };
        
        let result = engine.apply_llm_hints(&context, &hints).unwrap();
        assert_eq!(result, json!({
            "name": "Test",
            "metadata": {
                "public": "yes"
            }
        }));
    }

    #[test]
    fn test_merge_mode() {
        let engine = TransformEngine::new();
        let context = json!({
            "existing": "data",
            "items": ["a", "b", "c"]
        });
        
        let hints = LlmHints {
            exclude: vec![],  // No exclusions
            transform: Some(HashMap::from([(
                "count".to_string(),
                TransformRule::Literal {
                    literal: json!(3)
                }
            )])),
            mode: Some(TransformMode::Merge),
        };
        
        let result = engine.apply_llm_hints(&context, &hints).unwrap();
        assert_eq!(result["existing"], json!("data"));
        assert_eq!(result["items"], json!(["a", "b", "c"]));
        assert_eq!(result["count"], json!(3));
    }

    #[test]
    fn test_format_transform() {
        let engine = TransformEngine::new();
        let context = json!({
            "content": "Hello, world!",
            "timestamp": "2025-11-03T00:44:43Z",
            "source": "browser-extension"
        });
        
        let hints = LlmHints {
            exclude: vec![],  // No exclusions
            transform: Some(HashMap::from([(
                "formatted".to_string(),
                TransformRule::Format {
                    format: "User ({timestamp}): {content}".to_string()
                }
            )])),
            mode: Some(TransformMode::Replace),
        };
        
        let result = engine.apply_llm_hints(&context, &hints).unwrap();
        assert_eq!(result["formatted"], json!("User (2025-11-03T00:44:43Z): Hello, world!"));
    }
    
    #[test]
    fn test_exclude_only() {
        let engine = TransformEngine::new();
        let context = json!({
            "keep": "yes",
            "remove": "no",
            "also_keep": "yes"
        });
        
        let hints = LlmHints {
            exclude: vec!["remove".to_string()],
            transform: None,
            mode: None,
        };
        
        let result = engine.apply_llm_hints(&context, &hints).unwrap();
        assert_eq!(result, json!({"keep": "yes", "also_keep": "yes"}));
    }
    
    #[test]
    fn test_empty_exclude_shows_all() {
        let engine = TransformEngine::new();
        let context = json!({"field1": "val1", "field2": "val2"});
        
        let hints = LlmHints {
            exclude: vec![],  // Empty = show all
            transform: None,
            mode: None,
        };
        
        let result = engine.apply_llm_hints(&context, &hints).unwrap();
        assert_eq!(result, context);
    }
}
