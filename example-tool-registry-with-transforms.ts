// Example: How to update ToolRegistry to include LLM transform hints

// In rcrt-visual-builder/packages/tools/src/registry.ts

private async createCatalogBreadcrumb(): Promise<void> {
  try {
    const catalogBreadcrumb = await this.client.createBreadcrumb({
      schema_name: 'tool.catalog.v1',
      title: `${this.workspace} Tool Catalog`,
      tags: [this.workspace, 'tool:catalog'],
      context: {
        workspace: this.workspace,
        tools: this.catalog,
        totalTools: this.catalog.length,
        activeTools: this.catalog.filter(t => t.status === 'active').length,
        lastUpdated: new Date().toISOString()
      },
      // NEW: Add LLM hints for context view transformation
      llm_hints: {
        transform: {
          // Create a concise tool summary
          tool_summary: {
            type: 'template',
            template: `You have {{context.activeTools}} tools available:
{{#each context.tools}}
- {{name}} ({{category}}): {{description}}
{{/each}}

To use a tool, create a tool.request.v1 breadcrumb with:
- tool: the tool name
- input: tool-specific parameters
- requestId: unique identifier`
          },
          // Extract just tool names for quick reference
          available_tools: {
            type: 'extract',
            value: '$.tools[*].name'
          },
          // Group by category
          tools_by_category: {
            type: 'jq',
            query: '.tools | group_by(.category) | map({key: .[0].category, value: map(.name)}) | from_entries'
          }
        },
        // Only show transformed fields in context view
        mode: 'replace'
      }
    });
    
    this.catalogBreadcrumbId = catalogBreadcrumb.id;
    console.log(`[ToolRegistry] Created catalog with LLM transform hints: ${this.catalogBreadcrumbId}`);
  } catch (error) {
    console.error('[ToolRegistry] Failed to create catalog breadcrumb:', error);
  }
}

// Similar update for updateCatalog method
private async updateCatalog(): Promise<void> {
  // ... existing code ...
  
  const updatePayload = {
    title: `${this.workspace} Tool Catalog`,
    context: {
      workspace: this.workspace,
      tools: this.catalog,
      totalTools: this.catalog.length,
      activeTools: this.catalog.filter(t => t.status === 'active').length,
      lastUpdated: new Date().toISOString()
    },
    // Include the same LLM hints
    llm_hints: {
      transform: {
        tool_summary: {
          type: 'template',
          template: `You have {{context.activeTools}} tools available:
{{#each context.tools}}
- {{name}} ({{category}}): {{description}}
{{/each}}

To use a tool, create a tool.request.v1 breadcrumb.`
        },
        available_tools: {
          type: 'extract',
          value: '$.tools[*].name'
        }
      },
      mode: 'replace'
    }
  };
  
  // ... rest of update logic ...
}
