# Knowledge Base Breadcrumbs

This directory contains `knowledge.v1` breadcrumbs that are loaded during bootstrap and made available to LLMs via semantic search.

## Purpose

Knowledge breadcrumbs are designed to teach LLMs about the RCRT system, how to use it, and best practices. When a user asks the chat agent questions, the Rust context-builder performs semantic search and includes relevant knowledge breadcrumbs in the agent's context.

## How It Works

### 1. Bootstrap Phase
- During `setup.sh` → `bootstrap.js` execution
- All `*.json` files in this directory are uploaded as breadcrumbs
- Each knowledge breadcrumb gets stored in the database with full-text search capabilities

### 2. Embedding & Indexing
- PostgreSQL with pgvector extension automatically generates embeddings
- The content is indexed for semantic similarity search
- Embeddings are based on ONNX models (fast, local, no API calls)

### 3. Context Assembly (Semantic Search)
When a user sends a message like "How do I create a tool?":

1. **User message arrives** → Triggers context builder
2. **Rust context-builder** assembles context from:
   - Recent messages in the session (user + agent conversation)
   - Tool catalog (available tools)
   - **Knowledge base via semantic search** ← This is where your knowledge breadcrumbs come in!
3. **Agent receives context** including relevant knowledge
4. **Agent responds** using the knowledge to provide accurate, detailed answers

### 4. Blacklist (What's Excluded)
The context-builder uses a **blacklist approach**, meaning it includes everything EXCEPT:
- `system.health.v1` - System health metrics
- `system.metric.v1` - Performance metrics
- `tool.config.v1` - Tool configuration settings
- `secret.v1` - Secrets (never exposed)
- `system.startup.v1` - System startup events

**✅ `knowledge.v1` is NOT blacklisted** - It will always be available for semantic search!

## Creating Knowledge Breadcrumbs

### Template Structure

```json
{
  "schema_name": "knowledge.v1",
  "title": "Your Knowledge Title",
  "tags": ["knowledge", "topic-category", "workspace:system"],
  "context": {
    "topic": "topic-identifier",
    "audience": "LLM agents and developers",
    "version": "1.0.0",
    "last_updated": "2025-11-02",
    "content": {
      "summary": "Brief overview",
      "detailed_sections": {
        "section_name": {
          "description": "What this section covers",
          "information": "Detailed content here",
          "examples": ["example1", "example2"]
        }
      },
      "best_practices": [
        "Practice 1",
        "Practice 2"
      ],
      "common_mistakes": [
        {
          "mistake": "What not to do",
          "why": "Explanation",
          "correct_approach": "What to do instead"
        }
      ]
    }
  }
}
```

### Content Guidelines

1. **Be Comprehensive** - Include everything an LLM needs to know
2. **Use Examples** - Show concrete examples with code
3. **Explain Why** - Don't just say what to do, explain reasoning
4. **Include Mistakes** - Document common errors and how to avoid them
5. **Reference Real Code** - Point to actual files as examples
6. **Use Structure** - Organize information hierarchically for semantic search
7. **Keep Updated** - Update version and last_updated when making changes

### Topics to Cover

Good candidates for knowledge breadcrumbs:
- **How-to guides** (like how-to-create-tools.json)
- **System architecture** explanations
- **Best practices** for specific tasks
- **Common patterns** and their use cases
- **API references** with examples
- **Troubleshooting guides** for common issues
- **Integration guides** for external services

## Semantic Search Optimization

### What Makes Good Search Content?

1. **Natural Language** - Write as if explaining to a person
2. **Keywords** - Include terms users might search for
3. **Context** - Provide enough context for relevance matching
4. **Specificity** - Be specific about what the knowledge covers
5. **Completeness** - Include related concepts and variations

### Example: Search Query → Knowledge Match

**User asks:** "How do I make a tool that calls OpenRouter?"

**Semantic search finds:**
- `how-to-create-tools.json` - Matches "create", "tool"
  - Section on "secrets_management" - Matches "OpenRouter"
  - Section on "complete_working_example" - Provides template
  - Section on "api_tools" - References openrouter.json

**Result:** Agent gets complete, accurate instructions!

## File Organization

```
knowledge/
├── README.md                    # This file
├── how-to-create-tools.json    # Comprehensive tool creation guide
├── [future-topic].json         # Add more knowledge as needed
└── ...
```

## Adding New Knowledge

1. **Create the JSON file** in this directory
2. **Follow the schema** (`knowledge.v1`)
3. **Run bootstrap**: `cd bootstrap-breadcrumbs && node bootstrap.js`
4. **Test semantic search**: Ask the chat agent about the topic
5. **Verify in logs**: Check that knowledge appears in context

## Testing Knowledge Breadcrumbs

### Verify Upload
```bash
# Run bootstrap
cd bootstrap-breadcrumbs && node bootstrap.js

# Check database
docker compose exec db psql -U postgres -d rcrt \
  -c "SELECT id, title FROM breadcrumbs WHERE schema_name = 'knowledge.v1';"
```

### Test Semantic Search
1. Open the chat extension
2. Ask a question related to your knowledge topic
3. Check agent-runner logs to see if knowledge was included in context
4. Verify the agent's response uses the knowledge correctly

### Debug Context Assembly
```bash
# Watch context-builder logs
docker compose logs context-builder -f

# You should see:
# "Assembled context with X breadcrumbs"
# Including knowledge.v1 breadcrumbs when relevant
```

## Best Practices

### ✅ DO
- Keep knowledge focused on a single topic
- Include plenty of examples
- Update when the system changes
- Reference actual code files
- Explain the "why" behind best practices
- Include both simple and advanced examples

### ❌ DON'T
- Put secrets or credentials in knowledge
- Include outdated information
- Make knowledge too broad (split into multiple files)
- Forget to test after adding knowledge
- Skip version tracking

## Maintenance

### When to Update Knowledge

- System architecture changes
- New features are added
- Best practices evolve
- Common mistakes are discovered
- User feedback indicates confusion

### Versioning

Update the `version` and `last_updated` fields when modifying knowledge:
```json
"version": "1.1.0",  // Increment for changes
"last_updated": "2025-11-02"  // Current date
```

## Future Enhancements

Potential improvements to the knowledge system:
- **Confidence scoring** - Rate how well knowledge matches queries
- **Usage tracking** - Track which knowledge is most valuable
- **Feedback loops** - Let agents rate knowledge helpfulness
- **Knowledge graphs** - Link related knowledge breadcrumbs
- **Multi-language** - Support knowledge in different languages

## Related Documentation

- `docs/BLACKLIST_APPROACH.md` - Context builder philosophy
- `docs/CONTEXT_BUILDER_RUST.md` - Context assembly details
- `docs/TOOL_CODE_V1_SCHEMA.md` - Tool schema reference
- `crates/rcrt-context-builder/` - Context builder source code

