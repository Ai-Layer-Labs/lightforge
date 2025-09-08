/**
 * Brave Search Node
 * Search the web using Brave Search API
 */

import { BaseNode, RegisterNode, NodeExecutionResult } from '@rcrt-builder/node-sdk';

@RegisterNode({
  schema_name: "node.template.v1",
  title: "Brave Search Node",
  tags: ["node:template", "search", "brave"],
  context: {
    node_type: "BraveSearchNode",
    category: "search",
    icon: "🔍",
    color: "#fb542b",
    description: "Search the web with Brave Search"
  }
})
export class BraveSearchNode extends BaseNode {
  getMetadata() {
    return {
      type: 'BraveSearchNode',
      category: 'search',
      icon: '🔍',
      inputs: [
        { id: 'query', type: 'data', schema: 'search.query.v1' },
        { id: 'credentials', type: 'data', schema: 'secrets.credentials.v1' },
        { id: 'options', type: 'data', schema: 'search.options.v1', optional: true }
      ],
      outputs: [
        { id: 'results', type: 'data', schema: 'search.results.v1' },
        { id: 'metadata', type: 'data', schema: 'search.metadata.v1' }
      ]
    };
  }
  
  validateConfig(config: any): boolean {
    return true; // API key comes from credentials input
  }
  
  async execute(inputs: Record<string, any>): Promise<NodeExecutionResult> {
    const { query, credentials, options = {} } = inputs;
    
    // Get query string
    const queryString = typeof query === 'string' ? query : query?.query || query?.text || '';
    
    if (!queryString) {
      return {
        outputs: {
          results: [],
          metadata: { error: 'No search query provided' }
        }
      };
    }
    
    // Get API key from credentials input
    const apiKey = credentials?.BRAVE_SEARCH_API_KEY || credentials?.brave_api_key;
    if (!apiKey) {
      throw new Error('BRAVE_SEARCH_API_KEY not provided in credentials');
    }
    
    try {
      // Build search parameters
      const searchParams = new URLSearchParams({
        q: queryString,
        count: String(options.count || this.context.config.default_count || 10),
        ...this.buildSearchParams(options)
      });
      
      // Call Brave Search API
      const response = await fetch(
        `https://api.search.brave.com/res/v1/web/search?${searchParams}`,
        {
          method: 'GET',
          headers: {
            'X-Subscription-Token': apiKey,
            'Accept': 'application/json'
          }
        }
      );
      
      if (!response.ok) {
        throw new Error(`Brave Search API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Process and format results
      const formattedResults = this.formatResults(data);
      
      // Store search history as breadcrumb for audit/analysis
      await this.createBreadcrumb({
        schema_name: 'search.history.v1',
        title: `Search: ${queryString}`,
        tags: ['search:history', 'brave', this.context.workspace],
        context: {
          query: queryString,
          results_count: formattedResults.length,
          options,
          timestamp: new Date().toISOString(),
          node_id: this.context.breadcrumb_id
        }
      });
      
      return {
        outputs: {
          results: formattedResults,
          metadata: {
            query: queryString,
            total: data.web?.total || 0,
            count: formattedResults.length,
            source: 'brave',
            search_time_ms: data.query?.response_time,
            language: data.query?.language,
            country: data.query?.country,
            safe_search: data.query?.safe_search,
            timestamp: new Date().toISOString()
          }
        }
      };
    } catch (error: any) {
      // Log error
      await this.createBreadcrumb({
        schema_name: 'search.error.v1',
        title: 'Search Failed',
        tags: ['search:error', 'brave', this.context.workspace],
        context: {
          query: queryString,
          error: error.message,
          timestamp: new Date().toISOString(),
          node_id: this.context.breadcrumb_id
        }
      });
      
      return {
        outputs: {
          results: [],
          metadata: {
            query: queryString,
            error: error.message,
            source: 'brave',
            timestamp: new Date().toISOString()
          }
        }
      };
    }
  }
  
  private buildSearchParams(options: any): Record<string, string> {
    const params: Record<string, string> = {};
    
    // Language
    if (options.language || this.context.config.default_language) {
      params.lang = options.language || this.context.config.default_language;
    }
    
    // Country
    if (options.country || this.context.config.default_country) {
      params.country = options.country || this.context.config.default_country;
    }
    
    // Safe search
    if (options.safe_search !== undefined) {
      params.safesearch = options.safe_search ? 'strict' : 'off';
    } else if (this.context.config.safe_search !== undefined) {
      params.safesearch = this.context.config.safe_search ? 'strict' : 'off';
    }
    
    // Freshness
    if (options.freshness) {
      params.freshness = options.freshness; // pd, pw, pm, py (past day/week/month/year)
    }
    
    // Result types
    if (options.result_types) {
      params.result_filter = options.result_types.join(',');
    }
    
    // Offset for pagination
    if (options.offset) {
      params.offset = String(options.offset);
    }
    
    return params;
  }
  
  private formatResults(data: any): any[] {
    const results = [];
    
    // Web results
    if (data.web?.results) {
      for (const result of data.web.results) {
        results.push({
          type: 'web',
          title: result.title,
          url: result.url,
          description: result.description,
          snippet: result.snippet,
          favicon: result.profile?.img,
          language: result.language,
          published_date: result.age,
          extra_snippets: result.extra_snippets,
          thumbnail: result.thumbnail?.src
        });
      }
    }
    
    // News results if available
    if (data.news?.results) {
      for (const news of data.news.results) {
        results.push({
          type: 'news',
          title: news.title,
          url: news.url,
          description: news.description,
          source: news.source,
          published_date: news.age,
          thumbnail: news.thumbnail?.src
        });
      }
    }
    
    // Videos if available
    if (data.videos?.results) {
      for (const video of data.videos.results) {
        results.push({
          type: 'video',
          title: video.title,
          url: video.url,
          description: video.description,
          duration: video.duration,
          views: video.views,
          creator: video.creator,
          publisher: video.publisher,
          thumbnail: video.thumbnail?.src
        });
      }
    }
    
    // Discussions (forums, reddit, etc)
    if (data.discussions?.results) {
      for (const discussion of data.discussions.results) {
        results.push({
          type: 'discussion',
          title: discussion.title,
          url: discussion.url,
          description: discussion.description,
          forum: discussion.forum_name,
          comments: discussion.num_comments,
          score: discussion.score,
          published_date: discussion.age
        });
      }
    }
    
    return results;
  }
}
