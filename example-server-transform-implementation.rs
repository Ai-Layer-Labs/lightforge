// Example: How RCRT server could implement dynamic context transforms
// This would go in crates/rcrt-core/src/db.rs or a new transforms module

use serde_json::{json, Value};
use handlebars::Handlebars;
use jq_rs::run as jq_run;

/// Apply LLM hints to transform breadcrumb context
fn apply_llm_hints(breadcrumb: &Breadcrumb) -> Option<Value> {
    let hints = breadcrumb.context.get("llm_hints")?;
    let transform_rules = hints.get("transform")?;
    let mode = hints.get("mode").and_then(|m| m.as_str()).unwrap_or("merge");
    
    let mut result = if mode == "replace" {
        json!({})
    } else {
        breadcrumb.context.clone()
    };
    
    // Apply each transform rule
    for (key, rule) in transform_rules.as_object()? {
        if let Some(transformed) = apply_transform_rule(&breadcrumb.context, rule) {
            result[key] = transformed;
        }
    }
    
    // Apply include/exclude if present
    if let Some(includes) = hints.get("include").and_then(|i| i.as_array()) {
        let mut filtered = json!({});
        for field in includes {
            if let Some(field_name) = field.as_str() {
                if let Some(value) = breadcrumb.context.get(field_name) {
                    filtered[field_name] = value.clone();
                }
            }
        }
        if mode == "replace" {
            result = filtered;
        } else {
            result = merge_json(result, filtered);
        }
    }
    
    Some(result)
}

/// Apply a single transform rule
fn apply_transform_rule(context: &Value, rule: &Value) -> Option<Value> {
    let rule_type = rule.get("type")?.as_str()?;
    
    match rule_type {
        "literal" => rule.get("literal").cloned(),
        
        "template" => {
            let template = rule.get("template")?.as_str()?;
            let handlebars = Handlebars::new();
            let rendered = handlebars.render_template(template, &json!({ "context": context })).ok()?;
            Some(Value::String(rendered))
        },
        
        "extract" => {
            let path = rule.get("value")?.as_str()?;
            if path.starts_with("$.") {
                // Simple JSONPath extraction
                extract_jsonpath(context, path)
            } else {
                None
            }
        },
        
        "jq" => {
            let query = rule.get("query")?.as_str()?;
            let result = jq_run(query, &context.to_string()).ok()?;
            serde_json::from_str(&result).ok()
        },
        
        _ => None
    }
}

/// Updated get_breadcrumb_context method
impl Database {
    async fn get_breadcrumb_context_conn(&self, conn: &mut PgConnection, id: Uuid) -> Result<Option<BreadcrumbContextView>> {
        let rec = sqlx::query_as::<_, DbBreadcrumb>(
            r#"select id, owner_id, title, context, tags, schema_name, visibility::text as visibility, 
               sensitivity::text as sensitivity, version, checksum, ttl, created_at, updated_at, 
               created_by, updated_by, size_bytes, embedding
            from breadcrumbs where id = $1"#,
        )
        .bind(id)
        .fetch_optional(&mut *conn)
        .await?;
        
        Ok(rec.map(|r| {
            // Check for inline transform hints
            let transformed_context = if let Some(transformed) = apply_llm_hints(&r) {
                transformed
            } else if let Some(schema) = &r.schema_name {
                // Check for schema transform breadcrumb
                if let Ok(Some(transform_bc)) = self.find_schema_transform(schema).await {
                    apply_schema_transform(&r.context, &transform_bc.context).unwrap_or(r.context)
                } else {
                    // Apply default transforms by schema
                    apply_default_transform(schema, &r.context)
                }
            } else {
                r.context
            };
            
            BreadcrumbContextView {
                id: r.id,
                title: r.title,
                context: transformed_context,
                tags: r.tags,
                version: r.version,
                updated_at: r.updated_at,
            }
        }))
    }
    
    /// Find schema.transform.v1 breadcrumb for a given schema
    async fn find_schema_transform(&self, target_schema: &str) -> Result<Option<Breadcrumb>> {
        let transform = sqlx::query_as::<_, DbBreadcrumb>(
            r#"select * from breadcrumbs 
            where schema_name = 'schema.transform.v1' 
            and tags @> ARRAY[$1]
            and context->>'target_schema' = $2
            order by updated_at desc
            limit 1"#,
        )
        .bind(format!("target:{}", target_schema))
        .bind(target_schema)
        .fetch_optional(&self.pool)
        .await?;
        
        Ok(transform.map(Into::into))
    }
}

/// Default transforms for common schemas (fallback if no hints/transforms found)
fn apply_default_transform(schema: &str, context: &Value) -> Value {
    match schema {
        "tool.catalog.v1" => {
            // Default tool catalog transform
            if let Some(tools) = context.get("tools").and_then(|t| t.as_array()) {
                json!({
                    "available_tools": tools.iter()
                        .filter_map(|t| t.get("name").and_then(|n| n.as_str()))
                        .collect::<Vec<_>>()
                        .join(", "),
                    "tool_count": tools.len(),
                    "usage": "Create tool.request.v1 breadcrumb to invoke tools"
                })
            } else {
                context.clone()
            }
        },
        
        "file.storage.v1" => {
            // Remove large content fields
            let mut cleaned = context.clone();
            if let Some(obj) = cleaned.as_object_mut() {
                obj.remove("content");
                obj.insert("content_omitted".to_string(), json!(true));
            }
            cleaned
        },
        
        _ => context.clone()
    }
}
