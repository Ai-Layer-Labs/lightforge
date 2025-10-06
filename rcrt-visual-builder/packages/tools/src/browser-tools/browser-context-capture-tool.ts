/**
 * Browser Context Capture Tool
 * 
 * Purpose: Maintains browser.page.context.v1 breadcrumbs for current webpage
 * Pattern: Same as context-builder-tool - event-driven, config-based
 * 
 * Flow:
 * 1. Extension exposes capture API via chrome.runtime
 * 2. Tool auto-triggers on navigation events OR manual requests
 * 3. Fetches page data from extension
 * 4. Updates/creates browser.page.context.v1 breadcrumb
 * 5. Agents subscribe to browser.page.context.v1
 */

import { RCRTTool, ToolExecutionContext } from '../index.js';
import { RcrtClientEnhanced } from '@rcrt-builder/sdk';

export class BrowserContextCaptureTool implements RCRTTool {
  name = 'browser-context-capture';
  description = 'Captures current browser page context and maintains browser.page.context.v1 breadcrumb for agent consumption';
  category = 'browser';
  version = '1.0.0';
  
  // 🎯 THE RCRT WAY: Tool subscribes to events (like agents!)
  subscriptions = {
    selectors: [
      {
        comment: 'Manual capture requests',
        schema_name: 'browser.capture-request.v1',
        any_tags: ['browser:capture']
      },
      {
        comment: 'Auto-capture on navigation',
        schema_name: 'browser.navigation.v1',
        any_tags: ['browser:navigation']
      }
    ]
  };
  
  // Track the living breadcrumb ID
  private liveBreadcrumbId: string | null = null;
  private currentVersion: number = 1;
  
  inputSchema = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['capture', 'pause', 'resume'],
        description: 'Action to perform: capture page, pause tracking, or resume tracking'
      },
      extension_id: {
        type: 'string',
        description: 'Chrome extension ID to communicate with'
      },
      tab_id: {
        type: 'number',
        description: 'Optional: specific tab ID to capture (defaults to active tab)'
      },
      trigger_event: {
        type: 'object',
        description: 'Event that triggered this capture (auto-passed by tools-runner)'
      }
    }
  };
  
  outputSchema = {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      action: { type: 'string' },
      breadcrumb_id: { type: 'string' },
      version: { type: 'number' },
      page_title: { type: 'string' },
      page_url: { type: 'string' },
      interactive_elements_count: { type: 'number' },
      content_length: { type: 'number' },
      error: { type: 'string' }
    }
  };
  
  examples = [
    {
      title: 'Manual capture request',
      input: {
        action: 'capture',
        extension_id: 'chrome-extension-id'
      },
      output: {
        success: true,
        action: 'captured',
        breadcrumb_id: 'uuid-of-browser-context',
        version: 5,
        page_title: 'GitHub - RCRT Documentation',
        page_url: 'https://github.com/RCRT/docs',
        interactive_elements_count: 23,
        content_length: 4523
      },
      explanation: 'Captures current page and updates browser.page.context.v1 breadcrumb'
    },
    {
      title: 'Auto-triggered by navigation',
      input: {
        trigger_event: {
          schema_name: 'browser.navigation.v1',
          context: { url: 'https://github.com/RCRT/docs' }
        }
      },
      output: {
        success: true,
        action: 'captured',
        breadcrumb_id: 'uuid-of-browser-context',
        version: 6,
        page_title: 'GitHub - RCRT Documentation'
      },
      explanation: 'Automatically captures page when navigation event is detected'
    }
  ];
  
  async execute(input: any, context: ToolExecutionContext): Promise<any> {
    const { rcrtClient } = context;
    
    if (!rcrtClient) {
      return { success: false, error: 'rcrtClient required' };
    }
    
    const action = input.action || 'capture';
    
    try {
      switch (action) {
        case 'capture':
          return await this.capturePageContext(rcrtClient, input, context);
        
        case 'pause':
          return { success: true, action: 'paused', message: 'Page context tracking paused' };
        
        case 'resume':
          return await this.capturePageContext(rcrtClient, input, context);
        
        default:
          return { success: false, error: `Unknown action: ${action}` };
      }
    } catch (error: any) {
      console.error('❌ browser-context-capture error:', error);
      return { 
        success: false, 
        error: error.message || 'Unknown error',
        action
      };
    }
  }
  
  private async capturePageContext(
    client: RcrtClientEnhanced,
    input: any,
    context: ToolExecutionContext
  ): Promise<any> {
    console.log('📸 Capturing browser page context...');
    
    // For now, we'll simulate the capture since we need the extension to expose an API
    // In production, this would communicate with the extension
    
    // Check if we already have a living breadcrumb
    await this.ensureLiveBreadcrumb(client, context);
    
    // Get page data (placeholder - will be replaced with extension communication)
    const pageData = await this.getPageDataFromExtension(input.extension_id, input.tab_id);
    
    // Process and structure the data
    const structuredContext = this.structurePageContext(pageData);
    
    // Update the living breadcrumb
    const result = await this.updateLiveBreadcrumb(client, structuredContext);
    
    console.log(`✅ Browser context captured and updated (v${result.version})`);
    
    return {
      success: true,
      action: 'captured',
      breadcrumb_id: this.liveBreadcrumbId,
      version: result.version,
      page_title: pageData.title,
      page_url: pageData.url,
      interactive_elements_count: Object.keys(pageData.dom?.interactiveElements || {}).length,
      content_length: pageData.content?.mainText?.length || 0
    };
  }
  
  private async ensureLiveBreadcrumb(
    client: RcrtClientEnhanced,
    context: ToolExecutionContext
  ): Promise<void> {
    if (this.liveBreadcrumbId) return;
    
    // Search for existing browser.page.context.v1 breadcrumb
    const existing = await client.searchBreadcrumbs({
      schema_name: 'browser.page.context.v1',
      tag: context.workspace
    });
    
    if (existing.length > 0) {
      // Use most recent
      const latest = existing.sort((a, b) => 
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      )[0];
      
      this.liveBreadcrumbId = latest.id;
      this.currentVersion = latest.version;
      console.log(`✅ Using existing browser context breadcrumb: ${this.liveBreadcrumbId}`);
    } else {
      // Create initial breadcrumb
      const created = await this.createInitialBreadcrumb(client, context);
      this.liveBreadcrumbId = created.id;
      this.currentVersion = 1;
      console.log(`🆕 Created browser context breadcrumb: ${this.liveBreadcrumbId}`);
    }
  }
  
  private async createInitialBreadcrumb(
    client: RcrtClientEnhanced,
    context: ToolExecutionContext
  ) {
    return await client.createBreadcrumb({
      schema_name: 'browser.page.context.v1',
      title: 'Browser: Loading...',
      tags: [
        'browser:context',
        'browser:active-tab',
        'extension:chrome',
        context.workspace
      ],
      context: {
        url: 'about:blank',
        domain: 'loading',
        title: 'Loading...',
        viewport: { width: 0, height: 0, scrollX: 0, scrollY: 0, devicePixelRatio: 1 },
        dom: { rootId: '', map: {}, interactiveElements: {} },
        content: { mainText: '', headings: [], links: [], images: [] },
        meta: { description: '', keywords: [], ogTitle: '', ogImage: '', ogDescription: '' },
        session: {
          capturedAt: new Date().toISOString(),
          workspace: context.workspace
        }
      }
    });
  }
  
  private async updateLiveBreadcrumb(
    client: RcrtClientEnhanced,
    pageContext: any
  ) {
    if (!this.liveBreadcrumbId) {
      throw new Error('No live breadcrumb ID');
    }
    
    try {
      await client.updateBreadcrumb(
        this.liveBreadcrumbId,
        this.currentVersion,
        {
          title: `Browser: ${pageContext.title.slice(0, 50)}`,
          context: pageContext,
          tags: [
            'browser:context',
            'browser:active-tab',
            'extension:chrome',
            `url:${pageContext.domain}`
          ]
        }
      );
      
      this.currentVersion++;
      
      return { version: this.currentVersion, breadcrumbId: this.liveBreadcrumbId };
      
    } catch (error: any) {
      if (error.message?.includes('version_mismatch') || error.message?.includes('412')) {
        // Refetch current version and retry
        console.warn('⚠️ Version conflict, refetching...');
        const current = await client.getBreadcrumb(this.liveBreadcrumbId);
        this.currentVersion = current.version;
        
        // Retry
        return await this.updateLiveBreadcrumb(client, pageContext);
      }
      throw error;
    }
  }
  
  private structurePageContext(pageData: any) {
    const interactiveCount = Object.keys(pageData.dom?.interactiveElements || {}).length;
    const headingCount = pageData.content?.headings?.length || 0;
    const linkCount = pageData.content?.links?.length || 0;
    
    return {
      ...pageData,
      
      // LLM hints for optimal consumption (same pattern as context-builder!)
      llm_hints: {
        mode: "merge",
        transform: {
          summary: {
            type: "template",
            template: `The user is viewing '${pageData.title}' at ${pageData.domain}. The page has ${headingCount} sections and ${linkCount} links.`
          },
          interactive_summary: {
            type: "template",
            template: `There are ${interactiveCount} interactive elements on this page that the user can click or interact with.`
          },
          page_text: {
            type: "extract",
            value: "$.content.mainText"
          },
          page_structure: {
            type: "literal",
            literal: {
              headings: pageData.content?.headings || [],
              key_links: (pageData.content?.links || []).slice(0, 10),
              forms_present: (pageData.content?.forms || []).length > 0
            }
          }
        },
        exclude: [
          "dom.map",
          "session.extensionId",
          "session.tabId",
          "session.windowId"
        ]
      }
    };
  }
  
  /**
   * Get page data from Chrome extension
   * For now this is a placeholder - will be implemented via:
   * 1. Native messaging (for Node.js ↔ Extension communication)
   * 2. Or local HTTP endpoint in extension
   * 3. Or shared storage mechanism
   */
  private async getPageDataFromExtension(
    extensionId?: string,
    tabId?: number
  ): Promise<any> {
    // TODO: Implement actual extension communication
    // Options:
    // 1. Chrome Native Messaging (requires manifest host registration)
    // 2. Local WebSocket server in extension
    // 3. Shared file system (extension writes, tool reads)
    // 4. HTTP endpoint in extension background
    
    console.log('📞 Requesting page data from extension...');
    
    // For MVP: Return placeholder that tools-runner can populate
    // The extension will need to update the breadcrumb directly for now
    return {
      url: 'placeholder://waiting-for-extension',
      domain: 'placeholder',
      title: 'Page context will be updated by extension',
      viewport: { width: 1920, height: 1080, scrollX: 0, scrollY: 0, devicePixelRatio: 1 },
      dom: { rootId: '', map: {}, interactiveElements: {} },
      content: {
        mainText: 'Extension will populate this on page navigation',
        headings: [],
        links: [],
        images: []
      },
      meta: {
        description: '',
        keywords: [],
        ogTitle: '',
        ogImage: '',
        ogDescription: ''
      }
    };
  }
  
  async initialize(context: ToolExecutionContext): Promise<void> {
    console.log('🚀 BrowserContextCaptureTool: Initializing...');
    
    // Ensure living breadcrumb exists
    await this.ensureLiveBreadcrumb(context.rcrtClient, context);
    
    console.log('✅ BrowserContextCaptureTool: Ready');
  }
}

// Export singleton instance (same pattern as contextBuilderTool)
export const browserContextCaptureTool = new BrowserContextCaptureTool();
