/**
 * Logger Node
 * Log data for debugging and monitoring
 */

import { BaseNode, RegisterNode, NodeExecutionResult } from '@rcrt-builder/node-sdk';

@RegisterNode({
  schema_name: "node.template.v1",
  title: "Logger Node",
  tags: ["node:template", "utility", "logger"],
  context: {
    node_type: "LoggerNode",
    category: "utility",
    icon: "📋",
    color: "#52525b",
    description: "Log data and create audit trails"
  }
})
export class LoggerNode extends BaseNode {
  getMetadata() {
    return {
      type: 'LoggerNode',
      category: 'utility',
      icon: '📋',
      inputs: [
        { id: 'data', type: 'data', description: 'Data to log' },
        { id: 'level', type: 'data', optional: true },
        { id: 'message', type: 'data', optional: true },
        { id: 'metadata', type: 'data', optional: true }
      ],
      outputs: [
        { id: 'passthrough', type: 'data', description: 'Original data passed through' },
        { id: 'log_id', type: 'data' }
      ]
    };
  }
  
  validateConfig(config: any): boolean {
    const validLevels = ['debug', 'info', 'warning', 'error', 'critical'];
    return !config.log_level || validLevels.includes(config.log_level);
  }
  
  async execute(inputs: Record<string, any>): Promise<NodeExecutionResult> {
    const { data, level, message, metadata } = inputs;
    
    const logLevel = level || this.context.config.log_level || 'info';
    const logMessage = message || this.context.config.default_message || 'Data logged';
    
    // Console logging based on level
    this.consoleLog(logLevel, logMessage, data);
    
    // Create log breadcrumb if configured
    let logId = null;
    if (this.context.config.persist_logs !== false) {
      const logBreadcrumb = await this.createBreadcrumb({
        schema_name: 'log.entry.v1',
        title: `Log: ${logMessage}`,
        tags: [
          'log:entry',
          `log:${logLevel}`,
          this.context.workspace,
          `node:${this.context.breadcrumb_id}`
        ],
        context: {
          level: logLevel,
          message: logMessage,
          data: this.sanitizeData(data),
          metadata: {
            ...metadata,
            node_id: this.context.breadcrumb_id,
            flow_id: this.context.config.flow_id,
            timestamp: new Date().toISOString()
          },
          source: {
            type: 'node',
            id: this.context.breadcrumb_id,
            node_type: 'LoggerNode'
          }
        }
      });
      logId = logBreadcrumb.id;
    }
    
    // Performance metrics if enabled
    if (this.context.config.track_performance) {
      const performanceData = {
        data_size_bytes: JSON.stringify(data).length,
        processing_time_ms: 0, // Would need to track actual processing time
        memory_usage: process.memoryUsage?.() || {}
      };
      
      await this.createBreadcrumb({
        schema_name: 'performance.metric.v1',
        title: 'Performance Metric',
        tags: ['performance:metric', this.context.workspace],
        context: performanceData
      });
    }
    
    // Alert on errors if configured
    if (logLevel === 'error' || logLevel === 'critical') {
      if (this.context.config.alert_on_error) {
        await this.createBreadcrumb({
          schema_name: 'alert.triggered.v1',
          title: `Alert: ${logMessage}`,
          tags: ['alert:error', 'priority:high', this.context.workspace],
          context: {
            level: logLevel,
            message: logMessage,
            node_id: this.context.breadcrumb_id,
            alert_type: 'error_logged',
            requires_action: logLevel === 'critical'
          }
        });
      }
    }
    
    return {
      outputs: {
        passthrough: data,
        log_id: logId
      }
    };
  }
  
  private consoleLog(level: string, message: string, data: any) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [Node:${this.context.breadcrumb_id}]`;
    
    switch (level) {
      case 'debug':
        console.debug(`${prefix} ${message}`, data);
        break;
      case 'info':
        console.info(`${prefix} ${message}`, data);
        break;
      case 'warning':
        console.warn(`${prefix} ${message}`, data);
        break;
      case 'error':
        console.error(`${prefix} ${message}`, data);
        break;
      case 'critical':
        console.error(`${prefix} CRITICAL: ${message}`, data);
        break;
      default:
        console.log(`${prefix} ${message}`, data);
    }
  }
  
  private sanitizeData(data: any): any {
    // Remove sensitive data before logging
    if (!data) return data;
    
    const sensitiveKeys = this.context.config.sensitive_keys || [
      'password', 'token', 'secret', 'key', 'credential',
      'api_key', 'apiKey', 'auth', 'authorization'
    ];
    
    if (typeof data === 'object') {
      const sanitized = Array.isArray(data) ? [...data] : { ...data };
      
      for (const key in sanitized) {
        // Check if key contains sensitive terms
        const isNaN = sensitiveKeys.some(term => 
          key.toLowerCase().includes(term.toLowerCase())
        );
        
        if (isNaN) {
          sanitized[key] = '***REDACTED***';
        } else if (typeof sanitized[key] === 'object') {
          sanitized[key] = this.sanitizeData(sanitized[key]);
        }
      }
      
      return sanitized;
    }
    
    return data;
  }
}
