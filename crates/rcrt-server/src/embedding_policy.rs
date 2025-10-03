//! Embedding Policy
//! Determines which breadcrumb schemas should have embeddings

/// Check if a schema should have embeddings for vector search
pub fn should_embed_schema(schema: Option<&str>) -> bool {
    match schema {
        // ALWAYS embed user-facing content (for semantic search)
        Some("user.message.v1") => true,
        Some("agent.response.v1") => true,
        Some("tool.response.v1") => true,
        Some("document.v1") => true,
        Some("code.snippet.v1") => true,
        Some("workflow.result.v1") => true,
        Some("agent.def.v1") => true,
        
        // NEVER embed system/stats breadcrumbs (no semantic value)
        Some("system.hygiene.v1") => false,
        Some("system.metrics.v1") => false,
        Some("system.context-metrics.v1") => false,
        
        // Context/catalog: YES (for discovery/reference)
        Some("agent.context.v1") => true,
        Some("tool.catalog.v1") => true,
        Some("context.config.v1") => true,
        
        // Default: EMBED if unsure (better safe than missing semantic search)
        _ => true
    }
}

/// Get embedding or fallback
pub fn get_or_fallback_embedding(
    text: String,
    schema: Option<&str>
) -> Option<Vec<f32>> {
    if !should_embed_schema(schema) {
        tracing::debug!("Skipping embedding for schema: {:?}", schema);
        return None;
    }
    
    // Try to embed
    match super::embed_text(text) {
        Ok(vec) => Some(vec),
        Err(e) => {
            tracing::warn!("Embedding failed for schema {:?}: {}. Using zero vector.", schema, e);
            // Zero vector won't match searches but won't break queries
            Some(vec![0.0; 384])
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_user_content_gets_embedded() {
        assert!(should_embed_schema(Some("user.message.v1")));
        assert!(should_embed_schema(Some("agent.response.v1")));
        assert!(should_embed_schema(Some("document.v1")));
    }
    
    #[test]
    fn test_system_breadcrumbs_skip_embedding() {
        assert!(!should_embed_schema(Some("system.hygiene.v1")));
        assert!(!should_embed_schema(Some("system.metrics.v1")));
    }
    
    #[test]
    fn test_unknown_schemas_default_to_embed() {
        assert!(should_embed_schema(Some("custom.schema.v1")));
        assert!(should_embed_schema(None));
    }
}

