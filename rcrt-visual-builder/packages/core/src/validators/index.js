import { z } from 'zod';
import * as schemas from '../schemas';
// Validator utility class
export class SchemaValidator {
    static schemaMap = new Map([
        // Node schemas
        ['node.template.v1', schemas.NodeTemplateV1Schema],
        ['node.instance.v1', schemas.NodeInstanceV1Schema],
        ['node.registry.v1', schemas.NodeRegistryV1Schema],
        ['node.update.v1', schemas.NodeUpdateV1Schema],
        // Flow schemas
        ['flow.definition.v1', schemas.FlowDefinitionV1Schema],
        ['flow.execution.v1', schemas.FlowExecutionStateV1Schema],
        // Agent schemas
        ['agent.def.v1', schemas.AgentDefinitionV1Schema],
        ['agent.memory.v1', schemas.AgentMemoryV1Schema],
        ['agent.metrics.v1', schemas.AgentMetricsV1Schema],
        // Workspace schemas
        ['workspace.def.v1', schemas.WorkspaceDefinitionV1Schema],
        ['tools.catalog.v1', schemas.ToolsCatalogV1Schema],
        ['secrets.vault.v1', schemas.SecretsVaultV1Schema],
        ['secrets.request.v1', schemas.SecretsRequestV1Schema],
        ['secrets.credentials.v1', schemas.SecretsCredentialsV1Schema],
        ['secrets.access.v1', schemas.SecretsAccessV1Schema],
        // UI schemas
        ['ui.component.v1', schemas.UIComponentV1Schema],
        ['ui.instance.v1', schemas.UIInstanceV1Schema],
        // LLM schemas
        ['llm.messages.v1', schemas.LLMMessagesV1Schema],
        ['llm.response.v1', schemas.LLMResponseV1Schema],
        ['llm.tool_calls.v1', schemas.LLMToolCallsV1Schema],
    ]);
    /**
     * Validate a breadcrumb against its schema
     */
    static validate(breadcrumb) {
        const schemaName = breadcrumb.schema_name;
        if (!schemaName) {
            return { success: false, error: 'Missing schema_name' };
        }
        const schema = this.schemaMap.get(schemaName);
        if (!schema) {
            return { success: false, error: `Unknown schema: ${schemaName}` };
        }
        try {
            const data = schema.parse(breadcrumb);
            return { success: true, data };
        }
        catch (error) {
            if (error instanceof z.ZodError) {
                return {
                    success: false,
                    error: `Validation failed: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
                };
            }
            return { success: false, error: String(error) };
        }
    }
    /**
     * Register a custom schema
     */
    static registerSchema(name, schema) {
        this.schemaMap.set(name, schema);
    }
    /**
     * Check if a schema is registered
     */
    static hasSchema(name) {
        return this.schemaMap.has(name);
    }
    /**
     * Get all registered schema names
     */
    static getSchemaNames() {
        return Array.from(this.schemaMap.keys());
    }
}
// Export helper functions
export function validateBreadcrumb(breadcrumb) {
    return SchemaValidator.validate(breadcrumb).success;
}
export function assertValidBreadcrumb(breadcrumb) {
    const result = SchemaValidator.validate(breadcrumb);
    if (!result.success) {
        throw new Error(result.error);
    }
}
export function parseBreadcrumb(breadcrumb) {
    const result = SchemaValidator.validate(breadcrumb);
    if (!result.success) {
        throw new Error(result.error);
    }
    return result.data;
}
//# sourceMappingURL=index.js.map