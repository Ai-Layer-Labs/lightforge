/**
 * File Storage Tool for RCRT
 * Stores files as breadcrumbs with base64 encoding
 * Can be used by agents to manage JavaScript code and other files
 */

import { RCRTTool, ToolExecutionContext } from '../index.js';

export class FileStorageTool implements RCRTTool {
  name = 'file-storage';
  description = 'Store and retrieve files as RCRT breadcrumbs with base64 encoding';
  category = 'storage';
  version = '1.0.0';
  
  get inputSchema() {
    return {
      type: 'object',
      properties: {
        action: { 
          type: 'string', 
          enum: ['store', 'retrieve', 'list', 'delete'],
          description: 'Action to perform'
        },
        // For store action
        filename: { 
          type: 'string', 
          description: 'Name of the file (required for store)' 
        },
        content: { 
          type: 'string', 
          description: 'File content (text or base64 encoded binary)' 
        },
        mime_type: { 
          type: 'string', 
          description: 'MIME type of the file',
          default: 'text/plain'
        },
        encoding: {
          type: 'string',
          enum: ['text', 'base64'],
          description: 'Content encoding',
          default: 'text'
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Additional tags for the file',
          default: []
        },
        // For retrieve/delete actions
        file_id: {
          type: 'string',
          description: 'Breadcrumb ID of the file (required for retrieve/delete)'
        },
        // For list action
        file_type: {
          type: 'string',
          description: 'Filter by file type (javascript, json, text, etc.)'
        }
      },
      required: ['action']
    };
  }
  
  get outputSchema() {
    return {
      type: 'object',
      properties: {
        action: { type: 'string' },
        success: { type: 'boolean' },
        file_id: { type: 'string', description: 'Breadcrumb ID of stored file' },
        filename: { type: 'string' },
        content: { type: 'string', description: 'File content (for retrieve)' },
        files: { 
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              filename: { type: 'string' },
              mime_type: { type: 'string' },
              size_bytes: { type: 'number' },
              created_at: { type: 'string' }
            }
          },
          description: 'List of files (for list action)'
        },
        error: { type: 'string' }
      },
      required: ['action', 'success']
    };
  }

  async execute(input: any, context: ToolExecutionContext): Promise<any> {
    try {
      switch (input.action) {
        case 'store':
          return await this.storeFile(input, context);
        case 'retrieve':
          return await this.retrieveFile(input, context);
        case 'list':
          return await this.listFiles(input, context);
        case 'delete':
          return await this.deleteFile(input, context);
        default:
          throw new Error(`Unknown action: ${input.action}`);
      }
    } catch (error) {
      return {
        action: input.action,
        success: false,
        error: error.message
      };
    }
  }

  private async storeFile(input: any, context: ToolExecutionContext): Promise<any> {
    if (!input.filename || !input.content) {
      throw new Error('filename and content are required for store action');
    }

    const fileExtension = input.filename.split('.').pop()?.toLowerCase() || '';
    const isJavaScript = fileExtension === 'js' || input.mime_type === 'application/javascript';
    const isJSON = fileExtension === 'json' || input.mime_type === 'application/json';
    
    // Determine tags based on file type
    const fileTags = [
      'file:storage',
      `file:${fileExtension}`,
      ...(input.tags || [])
    ];
    
    if (isJavaScript) {
      fileTags.push('file:javascript', 'code:javascript');
      if (input.filename.includes('agent')) {
        fileTags.push('agent:code', 'agent:definition');
      }
    }
    
    if (isJSON) {
      fileTags.push('file:json', 'data:json');
    }

    // Calculate size
    const contentBytes = input.encoding === 'base64' 
      ? Buffer.from(input.content, 'base64').length
      : Buffer.from(input.content, 'utf8').length;

    // Create file breadcrumb
    const result = await context.rcrtClient.createBreadcrumb({
      schema_name: 'file.storage.v1',
      title: `File: ${input.filename}`,
      tags: fileTags,
      context: {
        filename: input.filename,
        mime_type: input.mime_type || 'text/plain',
        encoding: input.encoding || 'text',
        content: input.content,
        size_bytes: contentBytes,
        uploaded_by: context.agentId,
        uploaded_at: new Date().toISOString(),
        file_type: fileExtension,
        checksum: this.calculateChecksum(input.content)
      }
    });

    console.log(`📁 Stored file: ${input.filename} (${contentBytes} bytes) as breadcrumb ${result.id}`);

    return {
      action: 'store',
      success: true,
      file_id: result.id,
      filename: input.filename,
      size_bytes: contentBytes,
      mime_type: input.mime_type || 'text/plain'
    };
  }

  private async retrieveFile(input: any, context: ToolExecutionContext): Promise<any> {
    if (!input.file_id) {
      throw new Error('file_id is required for retrieve action');
    }

    const fileBreadcrumb = await context.rcrtClient.getBreadcrumb(input.file_id);
    
    if (!fileBreadcrumb.context?.filename) {
      throw new Error('Not a valid file breadcrumb');
    }

    console.log(`📁 Retrieved file: ${fileBreadcrumb.context.filename}`);

    return {
      action: 'retrieve',
      success: true,
      file_id: input.file_id,
      filename: fileBreadcrumb.context.filename,
      content: fileBreadcrumb.context.content,
      mime_type: fileBreadcrumb.context.mime_type,
      encoding: fileBreadcrumb.context.encoding,
      size_bytes: fileBreadcrumb.context.size_bytes
    };
  }

  private async listFiles(input: any, context: ToolExecutionContext): Promise<any> {
    const searchTags = ['file:storage'];
    
    if (input.file_type) {
      searchTags.push(`file:${input.file_type}`);
    }

    const fileBreadcrumbs = await context.rcrtClient.searchBreadcrumbs({
      tags: searchTags
    });

    const files = fileBreadcrumbs
      .filter(b => b.schema_name === 'file.storage.v1')
      .map(b => ({
        id: b.id,
        filename: b.context?.filename || 'unknown',
        mime_type: b.context?.mime_type || 'unknown',
        size_bytes: b.context?.size_bytes || 0,
        file_type: b.context?.file_type || 'unknown',
        created_at: b.created_at || new Date().toISOString()
      }));

    console.log(`📁 Listed ${files.length} files`);

    return {
      action: 'list',
      success: true,
      files,
      total_count: files.length
    };
  }

  private async deleteFile(input: any, context: ToolExecutionContext): Promise<any> {
    if (!input.file_id) {
      throw new Error('file_id is required for delete action');
    }

    // Get file info before deletion
    const fileBreadcrumb = await context.rcrtClient.getBreadcrumb(input.file_id);
    const filename = fileBreadcrumb.context?.filename || 'unknown';

    // Delete the file breadcrumb
    await context.rcrtClient.deleteBreadcrumb(input.file_id);

    console.log(`📁 Deleted file: ${filename}`);

    return {
      action: 'delete',
      success: true,
      file_id: input.file_id,
      filename
    };
  }

  private calculateChecksum(content: string): string {
    // Simple checksum for content verification
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }
}

/**
 * Agent Definition Loader Tool
 * Loads JavaScript files as agent definitions
 */
export class AgentLoaderTool implements RCRTTool {
  name = 'agent-loader';
  description = 'Load JavaScript files as executable agent definitions';
  category = 'agents';
  version = '1.0.0';
  
  get inputSchema() {
    return {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['load-agent', 'update-agent', 'list-agent-files'],
          description: 'Action to perform'
        },
        file_id: {
          type: 'string',
          description: 'Breadcrumb ID of JavaScript file (required for load-agent, update-agent)'
        },
        agent_name: {
          type: 'string',
          description: 'Name for the agent (required for load-agent)'
        },
        agent_entity_id: {
          type: 'string',
          description: 'Agent entity to link to',
          default: '00000000-0000-0000-0000-0000000000aa'
        },
        triggers: {
          type: 'object',
          description: 'Agent trigger configuration',
          default: { "selector": { "any_tags": ["chat:message"] } }
        },
        existing_agent_id: {
          type: 'string',
          description: 'Existing agent definition ID to update (for update-agent)'
        }
      },
      required: ['action']
    };
  }
  
  get outputSchema() {
    return {
      type: 'object',
      properties: {
        action: { type: 'string' },
        success: { type: 'boolean' },
        agent_definition_id: { type: 'string' },
        agent_name: { type: 'string' },
        javascript_loaded: { type: 'boolean' },
        code_preview: { type: 'string' },
        error: { type: 'string' }
      }
    };
  }

  async execute(input: any, context: ToolExecutionContext): Promise<any> {
    try {
      switch (input.action) {
        case 'load-agent':
          return await this.loadAgentFromFile(input, context);
        case 'update-agent':
          return await this.updateAgentFromFile(input, context);
        case 'list-agent-files':
          return await this.listAgentFiles(input, context);
        default:
          throw new Error(`Unknown action: ${input.action}`);
      }
    } catch (error) {
      return {
        action: input.action,
        success: false,
        error: error.message
      };
    }
  }

  private async loadAgentFromFile(input: any, context: ToolExecutionContext): Promise<any> {
    if (!input.file_id || !input.agent_name) {
      throw new Error('file_id and agent_name are required');
    }

    // Get the JavaScript file
    const fileBreadcrumb = await context.rcrtClient.getBreadcrumb(input.file_id);
    
    if (!fileBreadcrumb.context?.content) {
      throw new Error('File breadcrumb has no content');
    }

    // Decode content if base64
    let jsCode = fileBreadcrumb.context.content;
    if (fileBreadcrumb.context.encoding === 'base64') {
      jsCode = Buffer.from(jsCode, 'base64').toString('utf8');
    }

    // Create agent definition breadcrumb
    const agentDefinition = await context.rcrtClient.createBreadcrumb({
      schema_name: 'agent.definition.v1',
      title: `${input.agent_name} Agent`,
      tags: ['agent:definition', 'workspace:agents', `agent:${input.agent_name}`, 'loaded:from-file'],
      context: {
        agent_name: input.agent_name,
        agent_entity_id: input.agent_entity_id || '00000000-0000-0000-0000-0000000000aa',
        description: `Agent loaded from file: ${fileBreadcrumb.context.filename}`,
        version: '1.0.0',
        category: 'file-loaded',
        source_file_id: input.file_id,
        source_filename: fileBreadcrumb.context.filename,
        
        triggers: input.triggers || [{
          selector: {
            any_tags: ['chat:message']
          }
        }],
        
        capabilities: {
          can_create: true,
          can_modify: false,
          can_use_tools: true,
          can_create_agents: false,
          max_execution_time: 30000
        },
        
        execution: {
          type: 'javascript',
          code: jsCode,
          loaded_from_file: true,
          file_checksum: fileBreadcrumb.context.checksum
        }
      }
    });

    console.log(`🤖 Loaded agent ${input.agent_name} from file ${fileBreadcrumb.context.filename}`);

    return {
      action: 'load-agent',
      success: true,
      agent_definition_id: agentDefinition.id,
      agent_name: input.agent_name,
      javascript_loaded: true,
      code_preview: jsCode.substring(0, 200) + (jsCode.length > 200 ? '...' : ''),
      source_file: fileBreadcrumb.context.filename
    };
  }

  private async updateAgentFromFile(input: any, context: ToolExecutionContext): Promise<any> {
    if (!input.file_id || !input.existing_agent_id) {
      throw new Error('file_id and existing_agent_id are required');
    }

    // Get the JavaScript file
    const fileBreadcrumb = await context.rcrtClient.getBreadcrumb(input.file_id);
    
    // Decode content if base64
    let jsCode = fileBreadcrumb.context.content;
    if (fileBreadcrumb.context.encoding === 'base64') {
      jsCode = Buffer.from(jsCode, 'base64').toString('utf8');
    }

    // Get existing agent definition
    const existingAgent = await context.rcrtClient.getBreadcrumb(input.existing_agent_id);

    // Update agent definition with new code
    const updatedContext = {
      ...existingAgent.context,
      execution: {
        ...existingAgent.context?.execution,
        code: jsCode,
        updated_from_file: true,
        file_checksum: fileBreadcrumb.context.checksum,
        last_file_update: new Date().toISOString()
      },
      source_file_id: input.file_id,
      source_filename: fileBreadcrumb.context.filename
    };

    await context.rcrtClient.updateBreadcrumb(input.existing_agent_id, existingAgent.version, {
      context: updatedContext
    });

    console.log(`🤖 Updated agent from file ${fileBreadcrumb.context.filename}`);

    return {
      action: 'update-agent',
      success: true,
      agent_definition_id: input.existing_agent_id,
      javascript_loaded: true,
      code_preview: jsCode.substring(0, 200) + (jsCode.length > 200 ? '...' : ''),
      source_file: fileBreadcrumb.context.filename
    };
  }

  private async listAgentFiles(input: any, context: ToolExecutionContext): Promise<any> {
    // Search for JavaScript files that could be agent code
    const jsFiles = await context.rcrtClient.searchBreadcrumbs({
      tags: ['file:javascript', 'file:storage']
    });

    const agentFiles = jsFiles
      .filter(b => b.schema_name === 'file.storage.v1')
      .map(b => ({
        id: b.id,
        filename: b.context?.filename || 'unknown.js',
        mime_type: b.context?.mime_type || 'application/javascript',
        size_bytes: b.context?.size_bytes || 0,
        created_at: b.created_at || new Date().toISOString(),
        is_agent_code: b.tags?.includes('agent:code') || false
      }));

    console.log(`📁 Found ${agentFiles.length} JavaScript files`);

    return {
      action: 'list-agent-files',
      success: true,
      files: agentFiles,
      total_count: agentFiles.length
    };
  }

  private async deleteFile(input: any, context: ToolExecutionContext): Promise<any> {
    if (!input.file_id) {
      throw new Error('file_id is required for delete action');
    }

    const fileBreadcrumb = await context.rcrtClient.getBreadcrumb(input.file_id);
    const filename = fileBreadcrumb.context?.filename || 'unknown';

    await context.rcrtClient.deleteBreadcrumb(input.file_id);

    console.log(`📁 Deleted file: ${filename}`);

    return {
      action: 'delete',
      success: true,
      file_id: input.file_id,
      filename
    };
  }
}
