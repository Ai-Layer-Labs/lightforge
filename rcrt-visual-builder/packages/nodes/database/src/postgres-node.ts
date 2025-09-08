/**
 * PostgreSQL Query Node
 * Execute queries against PostgreSQL databases
 */

import { BaseNode, RegisterNode, NodeExecutionResult } from '@rcrt-builder/node-sdk';
import { Pool, PoolConfig } from 'pg';

@RegisterNode({
  schema_name: "node.template.v1",
  title: "PostgreSQL Query Node",
  tags: ["node:template", "database", "postgres"],
  context: {
    node_type: "PostgresNode",
    category: "database",
    icon: "🐘",
    color: "#336791",
    description: "Execute PostgreSQL queries"
  }
})
export class PostgresNode extends BaseNode {
  private pool: Pool | null = null;
  private connectionConfig: PoolConfig | null = null;
  
  getMetadata() {
    return {
      type: 'PostgresNode',
      category: 'database',
      icon: '🐘',
      inputs: [
        { id: 'query', type: 'data', schema: 'sql.query.v1' },
        { id: 'params', type: 'data', schema: 'sql.params.v1', optional: true },
        { id: 'credentials', type: 'data', schema: 'secrets.credentials.v1', optional: true }
      ],
      outputs: [
        { id: 'results', type: 'data', schema: 'sql.results.v1' },
        { id: 'row_count', type: 'data' },
        { id: 'metadata', type: 'data' }
      ]
    };
  }
  
  validateConfig(config: any): boolean {
    // Either connection string in config or credentials will be provided at runtime
    return true;
  }
  
  async execute(inputs: Record<string, any>): Promise<NodeExecutionResult> {
    const { query, params = [], credentials } = inputs;
    
    if (!query) {
      return {
        outputs: {
          results: [],
          row_count: 0,
          metadata: { error: 'No query provided' }
        }
      };
    }
    
    try {
      // Initialize pool if needed
      await this.ensureConnection(credentials);
      
      if (!this.pool) {
        throw new Error('Failed to establish database connection');
      }
      
      // Execute query with timing
      const startTime = Date.now();
      const result = await this.pool.query(query, params);
      const executionTime = Date.now() - startTime;
      
      // Log query execution to RCRT
      await this.createBreadcrumb({
        schema_name: 'database.query.v1',
        title: 'Query Executed',
        tags: ['database:postgres', 'query:log', this.context.workspace],
        context: {
          query: this.sanitizeQuery(query),
          row_count: result.rowCount,
          execution_time_ms: executionTime,
          node_id: this.context.breadcrumb_id,
          timestamp: new Date().toISOString()
        }
      });
      
      // Process results based on query type
      const queryType = this.detectQueryType(query);
      const processedResults = this.processResults(result, queryType);
      
      return {
        outputs: {
          results: processedResults,
          row_count: result.rowCount || 0,
          metadata: {
            query_type: queryType,
            execution_time_ms: executionTime,
            fields: result.fields?.map(f => ({
              name: f.name,
              dataTypeID: f.dataTypeID,
              format: f.format
            })),
            command: result.command,
            timestamp: new Date().toISOString()
          }
        }
      };
    } catch (error: any) {
      // Log error to RCRT
      await this.createBreadcrumb({
        schema_name: 'database.error.v1',
        title: 'Query Failed',
        tags: ['database:postgres', 'error', this.context.workspace],
        context: {
          error: error.message,
          error_code: error.code,
          query: this.sanitizeQuery(query),
          node_id: this.context.breadcrumb_id,
          timestamp: new Date().toISOString()
        }
      });
      
      return {
        outputs: {
          results: [],
          row_count: 0,
          metadata: {
            error: error.message,
            error_code: error.code,
            timestamp: new Date().toISOString()
          }
        }
      };
    }
  }
  
  private async ensureConnection(credentials?: any) {
    // If we have credentials, update connection
    if (credentials) {
      const connectionString = credentials.POSTGRES_CONNECTION || 
                              credentials.DATABASE_URL ||
                              credentials.PG_CONNECTION_STRING;
      
      if (connectionString && connectionString !== this.connectionConfig?.connectionString) {
        // Close existing pool if different connection
        if (this.pool) {
          await this.pool.end();
          this.pool = null;
        }
        
        this.connectionConfig = { connectionString };
        this.pool = new Pool(this.connectionConfig);
      }
    }
    
    // If no pool yet, try config
    if (!this.pool && this.context.config.connection_string) {
      this.connectionConfig = { 
        connectionString: this.context.config.connection_string 
      };
      this.pool = new Pool(this.connectionConfig);
    }
    
    // Test connection
    if (this.pool) {
      try {
        await this.pool.query('SELECT 1');
      } catch (error) {
        this.pool = null;
        throw error;
      }
    }
  }
  
  private detectQueryType(query: string): string {
    const normalizedQuery = query.trim().toUpperCase();
    
    if (normalizedQuery.startsWith('SELECT')) return 'SELECT';
    if (normalizedQuery.startsWith('INSERT')) return 'INSERT';
    if (normalizedQuery.startsWith('UPDATE')) return 'UPDATE';
    if (normalizedQuery.startsWith('DELETE')) return 'DELETE';
    if (normalizedQuery.startsWith('CREATE')) return 'CREATE';
    if (normalizedQuery.startsWith('DROP')) return 'DROP';
    if (normalizedQuery.startsWith('ALTER')) return 'ALTER';
    if (normalizedQuery.startsWith('WITH')) return 'CTE';
    
    return 'OTHER';
  }
  
  private processResults(result: any, queryType: string): any {
    switch (queryType) {
      case 'SELECT':
      case 'CTE':
        // Return rows for SELECT queries
        return result.rows;
        
      case 'INSERT':
        // Return inserted rows if RETURNING clause is used
        return result.rows.length > 0 ? result.rows : { inserted: result.rowCount };
        
      case 'UPDATE':
        // Return updated rows if RETURNING clause is used
        return result.rows.length > 0 ? result.rows : { updated: result.rowCount };
        
      case 'DELETE':
        // Return deleted rows if RETURNING clause is used
        return result.rows.length > 0 ? result.rows : { deleted: result.rowCount };
        
      case 'CREATE':
      case 'DROP':
      case 'ALTER':
        // DDL operations
        return { 
          success: true, 
          command: result.command,
          message: `${result.command} completed successfully`
        };
        
      default:
        // Return raw result for other query types
        return {
          command: result.command,
          rowCount: result.rowCount,
          rows: result.rows
        };
    }
  }
  
  private sanitizeQuery(query: string): string {
    // Truncate long queries and remove sensitive patterns
    let sanitized = query.substring(0, 500);
    
    // Remove potential passwords or secrets
    sanitized = sanitized.replace(/password\s*=\s*'[^']*'/gi, "password='***'");
    sanitized = sanitized.replace(/secret\s*=\s*'[^']*'/gi, "secret='***'");
    sanitized = sanitized.replace(/token\s*=\s*'[^']*'/gi, "token='***'");
    
    if (query.length > 500) {
      sanitized += '... (truncated)';
    }
    
    return sanitized;
  }
  
  async destroy() {
    // Clean up database connection
    if (this.pool) {
      try {
        await this.pool.end();
      } catch (error) {
        console.error('Error closing database pool:', error);
      }
      this.pool = null;
    }
    
    // Log cleanup
    await this.createBreadcrumb({
      schema_name: 'database.cleanup.v1',
      title: 'Database Connection Closed',
      tags: ['database:postgres', 'cleanup', this.context.workspace],
      context: {
        node_id: this.context.breadcrumb_id,
        timestamp: new Date().toISOString()
      }
    });
  }
}
