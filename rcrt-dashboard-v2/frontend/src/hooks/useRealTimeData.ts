import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDashboard } from '../stores/DashboardStore';
import { useAuthentication } from './useAuthentication';
import { Breadcrumb, Agent, Tool, Secret, SelectorSubscription } from '../types/rcrt';
import { convertToRenderNode, discoverConnections } from '../utils/dataTransforms';

/**
 * Hook for managing real-time data integration with RCRT
 * Handles initial data loading, SSE connection, and real-time updates
 */
export function useRealTimeData() {
  const { 
    setNodes, 
    setConnections, 
    addNode, 
    updateNode, 
    deleteNode,
    setEventStreamConnected,
    incrementEventCount,
    setLoading
  } = useDashboard();
  
  const { isAuthenticated, authToken, authenticatedFetch } = useAuthentication();
  const queryClient = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);
  
  // Don't load data until authenticated
  const canLoadData = isAuthenticated;
  
  // ============ INITIAL DATA LOADING ============
  
  // Load breadcrumbs
  const breadcrumbsQuery = useQuery({
    queryKey: ['breadcrumbs'],
    queryFn: async (): Promise<Breadcrumb[]> => {
      console.log('📋 Loading breadcrumbs from RCRT...');
      const response = await authenticatedFetch('/api/breadcrumbs');
      if (!response.ok) {
        throw new Error(`Failed to load breadcrumbs: ${response.statusText}`);
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: canLoadData,
  });
  
  // Load agents
  const agentsQuery = useQuery({
    queryKey: ['agents'],
    queryFn: async (): Promise<Agent[]> => {
      console.log('🤖 Loading agents from RCRT...');
      const response = await authenticatedFetch('/api/agents');
      if (!response.ok) {
        throw new Error(`Failed to load agents: ${response.statusText}`);
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
    enabled: canLoadData,
  });
  
  // Load secrets
  const secretsQuery = useQuery({
    queryKey: ['secrets'],
    queryFn: async (): Promise<Secret[]> => {
      console.log('🔐 Loading secrets from RCRT...');
      const response = await authenticatedFetch('/api/secrets');
      if (!response.ok) {
        throw new Error(`Failed to load secrets: ${response.statusText}`);
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
    enabled: canLoadData,
  });
  
  // Load tools directly from tool.code.v1 breadcrumbs (RCRT WAY - no aggregation!)
  const toolsQuery = useQuery({
    queryKey: ['tools', breadcrumbsQuery.data],
    queryFn: async (): Promise<Tool[]> => {
      console.log('🛠️ Loading tools directly from tool.code.v1 breadcrumbs...');
      
      // Query all tool.code.v1 breadcrumbs with workspace:tools tag
      const searchParams = new URLSearchParams({
        schema_name: 'tool.code.v1',
        tag: 'workspace:tools'
      });
      
      const response = await authenticatedFetch(`/api/breadcrumbs?${searchParams.toString()}`);
      if (!response.ok) {
        throw new Error(`Failed to load tools: ${response.statusText}`);
      }
      
      const toolBreadcrumbs = await response.json();
      console.log(`✅ Found ${toolBreadcrumbs.length} tool.code.v1 breadcrumbs`);
      
      // Fetch full context for each tool (to get ui_schema, etc.)
      const tools = await Promise.all(
        toolBreadcrumbs.map(async (tb: any) => {
          try {
            const fullResponse = await authenticatedFetch(`/api/breadcrumbs/${tb.id}/full`);
            if (!fullResponse.ok) return null;
            
            const fullTool = await fullResponse.json();
            const ctx = fullTool.context;
            
            return {
              id: tb.id,  // Use breadcrumb ID (not just name)
              name: ctx.name,
              description: ctx.description || fullTool.description,
              category: ctx.category || 'general',
              status: tb.tags?.includes('approved') ? 'active' : 'pending',
              version: ctx.version || fullTool.semantic_version || '1.0.0',
              capabilities: ctx.capabilities || { async: true },
              inputSchema: ctx.input_schema,
              outputSchema: ctx.output_schema,
              lastSeen: fullTool.updated_at,
              breadcrumb: fullTool  // Keep full breadcrumb for editing
            };
          } catch (error) {
            console.warn(`Failed to load tool ${tb.id}:`, error);
            return null;
          }
        })
      );
      
      const validTools = tools.filter(t => t !== null);
      console.log(`✅ Loaded ${validTools.length} tools directly from tool.code.v1`);
      return validTools;
    },
    staleTime: 5 * 60 * 1000,
    enabled: canLoadData,
  });

  // Load subscription data for dynamic connections
  const subscriptionsQuery = useQuery({
    queryKey: ['subscriptions'],
    queryFn: async (): Promise<SelectorSubscription[]> => {
      console.log('📡 Loading subscription data from RCRT...');
      try {
        // Note: This endpoint returns subscriptions for the authenticated agent
        // In a real implementation, we'd need to aggregate subscriptions from all agents
        const response = await authenticatedFetch('/api/subscriptions/selectors');
        if (!response.ok) {
          console.warn(`Subscription API returned ${response.status}, proceeding without subscription data`);
          return [];
        }
        const subscriptions = await response.json();
        console.log(`Loaded ${subscriptions.length} subscription selectors`);
        return subscriptions;
      } catch (error) {
        console.warn('Failed to load subscription data, proceeding without it:', error);
        return [];
      }
    },
    staleTime: 2 * 60 * 1000, // Shorter stale time for more dynamic data
    enabled: canLoadData,
  });
  
  // ============ DATA PROCESSING ============
  
  // Process loaded data into render nodes
  useEffect(() => {
    if (breadcrumbsQuery.data && agentsQuery.data && secretsQuery.data && toolsQuery.data) {
      // Async function inside useEffect
      const processDataAndConnections = async () => {
        console.log('🔄 Processing loaded data into render nodes...');
        
        // Filter out tool.code.v1 breadcrumbs (already represented in tool catalog)
        // Also filter out tool config requests
        const regularBreadcrumbs = breadcrumbsQuery.data.filter(b => 
          // Keep tool catalog visible as it's an important system breadcrumb
          // Filter out tool.code.v1 since they're shown via tool catalog
          b.schema_name !== 'tool.code.v1' &&
          // Filter out tool config requests which are just status breadcrumbs
          !b.tags?.includes('tool:config:request') &&
          !b.schema_name?.includes('tool.config.request')
        );
        
        const allNodes = [
          // Convert regular breadcrumbs to nodes
          ...regularBreadcrumbs.map(breadcrumb => 
            convertToRenderNode('breadcrumb', breadcrumb)
          ),
          
          // Convert actual tools from catalog to tool nodes
          ...toolsQuery.data.map(tool => 
            convertToRenderNode('tool', tool)
          ),
          
          // Convert agents to nodes
          ...agentsQuery.data.map(agent => 
            convertToRenderNode('agent', agent)
          ),
          
          // Convert secrets to nodes
          ...secretsQuery.data.map(secret => 
            convertToRenderNode('secret', secret)
          ),
        ];
        
        // Update nodes in store with initial data
        setNodes(allNodes);
        
        // Load full context for breadcrumbs to get created_by, schema_name, and full context
        console.log('🔗 Loading full breadcrumb context for connection discovery...');
        const enhancedBreadcrumbs = await loadFullContextForConnections(regularBreadcrumbs);
        console.log('✅ Enhanced breadcrumbs loaded');
        
        // DEBUG: Check which breadcrumbs have created_by
        const breadcrumbsWithCreatedBy = enhancedBreadcrumbs.filter(b => b.created_by);
        console.log(`📊 Breadcrumbs with created_by: ${breadcrumbsWithCreatedBy.length}/${enhancedBreadcrumbs.length}`);
        if (breadcrumbsWithCreatedBy.length > 0) {
          console.log('  Sample:', breadcrumbsWithCreatedBy[0].title, '→ agent:', breadcrumbsWithCreatedBy[0].created_by);
        }
        
        // Update nodes with enhanced data (now with full context)
        const enhancedNodes = [
          // Convert enhanced breadcrumbs to nodes
          ...enhancedBreadcrumbs.map(breadcrumb => 
            convertToRenderNode('breadcrumb', breadcrumb)
          ),
          
          // Convert actual tools from catalog to tool nodes
          ...toolsQuery.data.map(tool => 
            convertToRenderNode('tool', tool)
          ),
          
          // Convert agents to nodes
          ...agentsQuery.data.map(agent => 
            convertToRenderNode('agent', agent)
          ),
          
          // Convert secrets to nodes
          ...secretsQuery.data.map(secret => 
            convertToRenderNode('secret', secret)
          ),
        ];
        
        // Update nodes with enhanced data
        setNodes(enhancedNodes);
        
        // Discover connections with enhanced data that includes created_by and full context
        const connections = discoverConnections({
          breadcrumbs: enhancedBreadcrumbs, // Use enhanced breadcrumbs
          agents: agentsQuery.data,
          secrets: secretsQuery.data,
          tools: toolsQuery.data,
          subscriptions: subscriptionsQuery.data || [],
        });
        
        setConnections(connections);
        
        console.log(`✅ Loaded ${allNodes.length} nodes and ${connections.length} connections`);
        console.log(`📊 Data breakdown: ${regularBreadcrumbs.length} breadcrumbs, ${toolsQuery.data.length} tools (from catalog), ${agentsQuery.data.length} agents, ${secretsQuery.data.length} secrets`);
        console.log('🛠️ Tools from catalog:', toolsQuery.data.map(t => ({ name: t.name, category: t.category, status: t.status })));
        
        // Mark initial load complete
        setLoading('initialLoad', false);
      };
      
      // Execute async processing
      processDataAndConnections().catch(error => {
        console.error('❌ Error processing data and connections:', error);
        setLoading('initialLoad', false);
      });
    }
  }, [breadcrumbsQuery.data, agentsQuery.data, secretsQuery.data, toolsQuery.data, setNodes, setConnections, setLoading]);
  
  // ============ ENHANCED DATA LOADING FOR CONNECTIONS ============
  
  const loadFullContextForConnections = async (breadcrumbs: Breadcrumb[]): Promise<Breadcrumb[]> => {
    console.log('🔗 Loading full context for connection discovery...');
    
    // Identify breadcrumbs that are likely to have important connections or special types
    const importantBreadcrumbs = breadcrumbs.filter(b => 
      // Tool-related breadcrumbs
      b.tags?.some(tag => 
        tag.includes('tool:') || 
        tag.includes('config') ||
        tag.includes('response') ||
        tag.includes('request')
      ) ||
      // Agent-related breadcrumbs (IMPORTANT: includes agent definitions)
      b.tags?.some(tag => 
        tag.includes('agent:') ||
        tag.includes('agent')
      ) ||
      // Chat/conversation breadcrumbs
      b.title?.toLowerCase().includes('chat') ||
      b.title?.toLowerCase().includes('response') ||
      b.title?.toLowerCase().includes('agent')
    );
    
    console.log(`🔍 Loading full context for ${importantBreadcrumbs.length} important breadcrumbs...`);
    
    // Create a map to store enhanced breadcrumbs
    const enhancedBreadcrumbsMap = new Map<string, Breadcrumb>();
    
    // Load full context for these breadcrumbs in parallel
    const fullContextPromises = importantBreadcrumbs.map(async (breadcrumb) => {
      try {
        const response = await authenticatedFetch(`/api/breadcrumbs/${breadcrumb.id}/full`);
        if (response.ok) {
          const fullData = await response.json();
          // Create new enhanced breadcrumb object
          enhancedBreadcrumbsMap.set(breadcrumb.id, {
            ...breadcrumb,
            ...fullData, // This includes schema_name, context, created_by, etc.
          });
          return true;
        }
      } catch (error) {
        console.warn(`Failed to load context for ${breadcrumb.id}:`, error);
      }
      return false;
    });
    
    const results = await Promise.all(fullContextPromises);
    const successCount = results.filter(Boolean).length;
    
    console.log(`✅ Loaded full context for ${successCount}/${importantBreadcrumbs.length} breadcrumbs`);
    
    // Return enhanced breadcrumbs array
    return breadcrumbs.map(b => enhancedBreadcrumbsMap.get(b.id) || b);
  };
  
  // ============ REAL-TIME SSE INTEGRATION ============
  
  useEffect(() => {
    // Don't connect until authenticated
    if (!isAuthenticated || !authToken) {
      console.log('⏳ Waiting for authentication before connecting SSE...');
      return;
    }
    
    console.log('📡 Setting up authenticated real-time SSE connection...');
    
    // Create SSE connection via proxy with token as query parameter
    const sseUrl = `/events/stream?token=${encodeURIComponent(authToken)}`;
    const eventSource = new EventSource(sseUrl);
    eventSourceRef.current = eventSource;
    
    eventSource.onopen = () => {
      console.log('✅ SSE connection established');
      setEventStreamConnected(true);
    };
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📨 SSE event received:', data.type, data);
        
        // Increment event counter
        incrementEventCount();
        
        // Handle different event types
        handleSSEEvent(data);
        
      } catch (error) {
        console.error('Failed to parse SSE event:', error);
      }
    };
    
    eventSource.onerror = (error) => {
      console.error('❌ SSE connection error:', error);
      setEventStreamConnected(false);
      
      // Attempt to reconnect after delay
      setTimeout(() => {
        if (eventSourceRef.current?.readyState === EventSource.CLOSED) {
          console.log('🔄 Attempting SSE reconnection...');
          // The useEffect will run again and create a new connection
        }
      }, 5000);
    };
    
    // Cleanup on unmount
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setEventStreamConnected(false);
    };
  }, [isAuthenticated, authToken, setEventStreamConnected, incrementEventCount]);
  
  // ============ SSE EVENT HANDLING ============
  
  const handleSSEEvent = (eventData: any) => {
    // Handle different event structures
    if (eventData.type === 'ping') {
      console.log('📡 SSE ping received');
      return;
    }
    
    // If it has a type field, use the nested data structure
    if (eventData.type && eventData.data) {
      switch (eventData.type) {
        case 'breadcrumb.created':
          handleBreadcrumbCreated(eventData.data);
          break;
          
        case 'breadcrumb.updated':
          handleBreadcrumbUpdated(eventData.data);
          break;
          
        case 'breadcrumb.deleted':
          handleBreadcrumbDeleted(eventData.data);
          break;
          
        default:
          console.log('🔍 Unknown SSE event type:', eventData.type);
      }
    }
    // If it has breadcrumb_id, it's likely a direct breadcrumb update
    else if (eventData.breadcrumb_id || eventData.id) {
      console.log('📨 Direct breadcrumb update detected');
      handleBreadcrumbUpdated(eventData);
    }
    else {
      console.log('🔍 Unknown SSE event structure:', eventData);
    }
  };
  
  const handleBreadcrumbCreated = (eventData: any) => {
    console.log('➕ New breadcrumb created event:', eventData);
    
    // Extract breadcrumb data from SSE event
    const breadcrumb = {
      id: eventData.breadcrumb_id || eventData.id,
      title: eventData.title || 'New breadcrumb',
      tags: eventData.tags || [],
      schema_name: eventData.schema_name,
      version: eventData.version || 1,
      updated_at: eventData.updated_at || new Date().toISOString(),
      context: eventData.context || {},
    };
    
    console.log('➕ Processing new breadcrumb:', breadcrumb.title);
    
    // Convert to render node and add to store
    const renderNode = convertToRenderNode('breadcrumb', breadcrumb);
    addNode(renderNode);
    
    // Invalidate queries to ensure consistency
    queryClient.invalidateQueries({ queryKey: ['breadcrumbs'] });
    
    // Show real-time notification
    showRealTimeNotification(breadcrumb);
  };
  
  const handleBreadcrumbUpdated = (eventData: any) => {
    console.log('✏️ Breadcrumb updated event:', eventData);
    
    // Check if we have valid event data
    if (!eventData) {
      console.warn('⚠️ Breadcrumb updated event has no data');
      return;
    }
    
    // Extract breadcrumb info
    const breadcrumbId = eventData.breadcrumb_id || eventData.id;
    const title = eventData.title || eventData.context?.title || 'Updated breadcrumb';
    
    if (breadcrumbId) {
      console.log('✏️ Breadcrumb updated:', title, `(ID: ${breadcrumbId})`);
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['breadcrumbs'] });
    } else {
      console.warn('⚠️ Breadcrumb updated event missing ID:', eventData);
    }
  };
  
  const handleBreadcrumbDeleted = (breadcrumbId: string) => {
    console.log('🗑️ Breadcrumb deleted:', breadcrumbId);
    
    // Remove from store
    deleteNode(breadcrumbId);
    
    // Invalidate queries
    queryClient.invalidateQueries({ queryKey: ['breadcrumbs'] });
  };
  
  const showRealTimeNotification = (breadcrumb: Breadcrumb) => {
    // Handle different schema types for real-time visualization
    switch (breadcrumb.schema_name) {
      case 'chat.message.v1':
        console.log('💬 Live chat message:', breadcrumb.context?.content);
        // TODO: Show chat bubble animation
        break;
        
      case 'agent.thinking.v1':
        console.log('🧠 Agent thinking:', breadcrumb.context?.agent_id);
        // TODO: Show thinking indicator
        break;
        
      case 'agent.response.v1':
        console.log('🤖 Agent response:', breadcrumb.context?.content);
        // TODO: Show response animation
        break;
        
      case 'tool.response.v1':
        console.log('🛠️ Tool response:', breadcrumb.context?.tool);
        // TODO: Show tool response flow
        break;
        
      default:
        console.log('📋 Generic breadcrumb created:', breadcrumb.title);
    }
  };
  
  // ============ RETURN LOADING STATES ============
  
  return {
    loading: {
      breadcrumbs: breadcrumbsQuery.isLoading,
      agents: agentsQuery.isLoading,
      secrets: secretsQuery.isLoading,
      tools: toolsQuery.isLoading,
      initialLoad: breadcrumbsQuery.isLoading || agentsQuery.isLoading || secretsQuery.isLoading || toolsQuery.isLoading,
    },
    error: breadcrumbsQuery.error || agentsQuery.error || secretsQuery.error || toolsQuery.error,
    data: {
      breadcrumbs: breadcrumbsQuery.data || [],
      agents: agentsQuery.data || [],
      secrets: secretsQuery.data || [],
      tools: toolsQuery.data || [],
    }
  };
}
