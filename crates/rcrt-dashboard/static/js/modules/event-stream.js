/**
 * RCRT Dashboard Event Stream Manager
 * Handles SSE connections and real-time event processing
 */

import { dashboardState } from './state.js';
import { apiClient } from './api-client.js';

export class EventStreamManager {
    constructor() {
        this.eventSource = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 5000;
        
        this.init();
    }
    
    init() {
        this.connectEventStream();
        this.setupEventFilters();
    }
    
    async connectEventStream() {
        if (dashboardState.eventSource) {
            dashboardState.eventSource.close();
        }
        
        try {
            console.log('🚀 Initializing RCRT SSE connection...');
            
            // Get JWT token for authentication
            const token = await apiClient.getAuthToken();
            
            // Use dashboard proxy for security compliance
            const streamUrl = '/api/events/stream';
            console.log('🔐 Using secure dashboard proxy for RCRT SSE');
            
            dashboardState.eventSource = new EventSource(streamUrl);
            
            dashboardState.eventSource.onopen = () => {
                console.log('EventSource connection opened: 🔐 Secure Dashboard Proxy');
                this.updateStreamStatus(true, '🔐 Secure Proxy Connected');
                this.reconnectAttempts = 0;
                
                this.addEventToLog({
                    type: 'system',
                    message: '🔐 Connected via secure dashboard proxy (CORS compliant)',
                    timestamp: new Date().toISOString(),
                    connection_type: 'secure_proxy'
                });
            };
            
            dashboardState.eventSource.onmessage = (event) => {
                this.handleEventMessage(event);
            };
            
            dashboardState.eventSource.onerror = (event) => {
                console.error('EventSource error:', event);
                this.handleConnectionError();
            };
            
        } catch (error) {
            console.error('Failed to connect to event stream:', error);
            this.updateStreamStatus(false, 'Failed to connect');
            this.addEventToLog({
                type: 'system',
                message: 'Failed to initialize event stream: ' + error.message,
                timestamp: new Date().toISOString()
            });
        }
    }
    
    handleEventMessage(event) {
        console.log('EventSource message received:', event.data);
        
        if (dashboardState.streamPaused) {
            console.log('Stream paused, ignoring event');
            return;
        }
        
        try {
            const data = JSON.parse(event.data);
            console.log('Parsed event data:', data);
            
            // Filter out ping events if hiding is enabled
            if (dashboardState.hidePings && data.type === 'ping') {
                console.log('Ping event filtered out');
                return;
            }
            
            this.addEventToLog(data);
        } catch (e) {
            console.error('Failed to parse event data:', e, 'Raw data:', event.data);
            // Add the raw data as a system event
            this.addEventToLog({
                type: 'system',
                message: 'Received unparseable event: ' + event.data,
                timestamp: new Date().toISOString()
            });
        }
    }
    
    handleConnectionError() {
        this.updateStreamStatus(false, 'Connection error');
        
        this.addEventToLog({
            type: 'system',
            message: 'EventSource error occurred',
            timestamp: new Date().toISOString()
        });
        
        // Implement exponential backoff for reconnection
        if (this.reconnectAttempts < this.maxReconnectAttempts && !dashboardState.streamPaused) {
            const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
            this.reconnectAttempts++;
            
            console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
            
            setTimeout(async () => {
                if (!dashboardState.streamPaused) {
                    await this.connectEventStream();
                }
            }, delay);
        }
    }
    
    updateStreamStatus(connected, statusText) {
        const indicator = document.getElementById('streamStatus');
        const text = document.getElementById('streamStatusText');
        
        if (indicator) indicator.classList.toggle('connected', connected);
        if (text) text.textContent = statusText;
    }
    
    addEventToLog(eventData) {
        console.log('Adding event to log:', eventData);
        const timestamp = new Date(eventData.timestamp || eventData.ts || Date.now()).toLocaleTimeString();
        const eventType = eventData.type || 'unknown';
        
        // Limit log size
        if (dashboardState.eventLog.length >= dashboardState.maxEventLogSize) {
            dashboardState.eventLog.shift();
        }
        
        const logEntry = {
            ...eventData,
            displayTime: timestamp,
            rawEventData: JSON.stringify(eventData)
        };
        
        dashboardState.eventLog.push(logEntry);
        console.log('Event log now has', dashboardState.eventLog.length, 'events');
        
        this.renderEventLog();
    }
    
    renderEventLog() {
        console.log('Rendering event log with', dashboardState.eventLog.length, 'events');
        const eventList = document.getElementById('eventList');
        if (!eventList) return;
        
        // Filter events based on current filters
        const filteredEvents = dashboardState.eventLog.filter(event => {
            return this.shouldShowEvent(event);
        });
        
        console.log('Filtered events count:', filteredEvents.length);
        
        if (filteredEvents.length === 0) {
            const message = dashboardState.hidePings ? 'No non-ping events yet...' : 'No events yet...';
            eventList.innerHTML = `<div class="event-item ping"><div class="event-details">${message}</div></div>`;
            return;
        }
        
        eventList.innerHTML = filteredEvents.map(event => this.renderEventItem(event)).reverse().join('');
        
        // Auto-scroll to top since newest events are at top
        if (dashboardState.autoScroll) {
            setTimeout(() => {
                eventList.scrollTop = 0;
            }, 10);
        }
    }
    
    renderEventItem(event) {
        const eventType = event.type || 'unknown';
        const schema = event.schema_name || '';
        
        let eventClass = eventType.replace(/\./g, '-');
        if (schema === 'tool.request.v1') {
            eventClass += ' tool-request';
        } else if (schema === 'tool.response.v1') {
            eventClass += ' tool-response';
        }
        
        let details = '';
        let action = '';
        
        if (eventType === 'ping') {
            details = `Heartbeat ${event.counter || ''}`;
            if (event.source) details += ` (${event.source})`;
        } else if (eventType.includes('breadcrumb')) {
            action = eventType.split('.')[1] || 'unknown';
            details = this.generateEnhancedEventDetails(event, action);
        } else if (eventType === 'system') {
            details = event.message || 'System event';
        }

        const hasExpandableData = event.context || (event.rawEventData && event.rawEventData.length > 200);
        const isLLMEvent = (schema === 'tool.request.v1' || schema === 'tool.response.v1') && 
                          event.context?.tool && ['openrouter', 'ollama_local'].includes(event.context.tool);

        return `
            <div class="event-item ${eventClass}">
                ${!isLLMEvent ? `
                    <div class="event-header">
                        <span class="event-type ${action || eventType}">${eventType}</span>
                        <span class="event-time">${event.displayTime}</span>
                    </div>
                ` : `
                    <div class="event-header" style="justify-content: flex-end;">
                        <span class="event-time">${event.displayTime}</span>
                    </div>
                `}
                <div class="event-details">${details}</div>
                ${!isLLMEvent && event.breadcrumb_id ? `<div class="event-id">ID: ${event.breadcrumb_id}</div>` : ''}
                ${hasExpandableData ? `
                    <div class="event-expand">
                        <button class="btn-small" onclick="toggleEventDetails('${event.breadcrumb_id || Date.now()}', this)" style="font-size: 0.7rem; padding: 0.2rem 0.5rem; margin-top: 0.3rem;">
                            📋 Show Details
                        </button>
                        <div class="event-full-details" style="display: none; margin-top: 0.5rem; padding: 0.5rem; background: rgba(0,0,0,0.3); border-radius: 4px; font-family: monospace; font-size: 0.7rem; max-height: 300px; overflow-y: auto;">
                            <pre style="margin: 0; white-space: pre-wrap; color: rgba(255,255,255,0.9);">${this.escapeHtml(JSON.stringify(event.context || JSON.parse(event.rawEventData || '{}'), null, 2))}</pre>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }
    
    generateEnhancedEventDetails(event, action) {
        const schema = event.schema_name || '';
        
        // Enhanced event details for chat-like display
        if (schema === 'tool.request.v1' && event.context) {
            const tool = event.context.tool || 'unknown';
            
            if (tool === 'openrouter' || tool === 'ollama_local') {
                const input = event.context.input || {};
                if (input.messages && Array.isArray(input.messages)) {
                    const userMsg = input.messages.find(m => m.role === 'user');
                    if (userMsg) {
                        return `
                            <div class="chat-message user-message">
                                <div class="message-header">👤 <strong>User</strong></div>
                                <div class="message-content">"${this.escapeHtml(userMsg.content)}"</div>
                            </div>
                            <div class="message-meta">
                                🧠 ${input.model || 'Unknown model'} • 📊 Max: ${input.max_tokens || 'N/A'} tokens
                            </div>
                        `;
                    }
                }
                return `🛠️ ${tool} tool request (no message content)`;
            } else {
                return `🛠️ <strong>${tool}</strong> tool request`;
            }
        }
        
        if (schema === 'tool.response.v1' && event.context) {
            const tool = event.context.tool || 'unknown';
            const status = event.context.status || 'unknown';
            const executionTime = event.context.execution_time_ms;
            
            if ((tool === 'openrouter' || tool === 'ollama_local') && event.context.output) {
                const output = event.context.output;
                
                if (status === 'success' && output.content) {
                    return `
                        <div class="chat-message ai-message">
                            <div class="message-header">🤖 <strong>AI</strong> <span style="color: rgba(255,255,255,0.6);">(${tool})</span></div>
                            <div class="message-content">"${this.escapeHtml(output.content)}"</div>
                        </div>
                        <div class="message-meta">
                            ⚡ ${executionTime || 'N/A'}ms • 🧠 ${output.model || 'Unknown'} • 
                            📈 ${output.usage?.total_tokens || 'N/A'} tokens • 
                            💰 ${typeof output.cost_estimate === 'number' ? '$' + output.cost_estimate.toFixed(6) : 'N/A'}
                        </div>
                    `;
                } else {
                    return `
                        <div class="chat-message error-message">
                            <div class="message-header">❌ <strong>Error</strong> <span style="color: rgba(255,255,255,0.6);">(${tool})</span></div>
                            <div class="message-content">${this.escapeHtml(event.context.error || 'Unknown error')}</div>
                        </div>
                        <div class="message-meta">
                            ⚡ ${executionTime || 'N/A'}ms • Status: ${status}
                        </div>
                    `;
                }
            }
        }
        
        // Default event display
        let details = `${action.toUpperCase()}`;
        if (event.breadcrumb_id) {
            details += `: ${event.breadcrumb_id.toString().substring(0, 8)}...`;
        }
        if (event.title) {
            details += `<br><strong>Title:</strong> ${this.escapeHtml(event.title.toString())}`;
        }
        if (event.tags && Array.isArray(event.tags)) {
            details += `<br><strong>Tags:</strong> ${event.tags.join(', ')}`;
        }
        
        return details;
    }
    
    shouldShowEvent(event) {
        if (dashboardState.eventFilters.has('all')) {
            return true;
        }
        
        const eventType = event.type || 'unknown';
        const schema = event.schema_name || '';
        const tags = event.tags || [];
        
        if (dashboardState.eventFilters.has('tool') && (
            eventType.includes('tool') || 
            schema.includes('tool.') ||
            tags.some(tag => tag.includes('tool'))
        )) {
            return true;
        }
        
        if (dashboardState.eventFilters.has('agent') && (
            eventType.includes('agent') || 
            schema.includes('agent.') ||
            tags.some(tag => tag.includes('agent'))
        )) {
            return true;
        }
        
        if (dashboardState.eventFilters.has('ui') && (
            eventType.includes('ui') || 
            schema.includes('ui.') ||
            tags.some(tag => tag.includes('ui'))
        )) {
            return true;
        }
        
        if (dashboardState.eventFilters.has('ping') && eventType === 'ping') {
            return true;
        }
        
        return false;
    }
    
    setupEventFilters() {
        // Make global functions available for HTML onclick handlers
        window.toggleEventFilter = (filterType) => {
            const button = document.getElementById('filter' + filterType.charAt(0).toUpperCase() + filterType.slice(1));
            
            if (filterType === 'all') {
                dashboardState.eventFilters.clear();
                dashboardState.eventFilters.add('all');
                
                document.querySelectorAll('[id^="filter"]').forEach(btn => {
                    btn.classList.remove('btn-primary');
                });
                button?.classList.add('btn-primary');
            } else {
                if (dashboardState.eventFilters.has('all')) {
                    dashboardState.eventFilters.clear();
                    document.getElementById('filterAll')?.classList.remove('btn-primary');
                }
                
                if (dashboardState.eventFilters.has(filterType)) {
                    dashboardState.eventFilters.delete(filterType);
                    button?.classList.remove('btn-primary');
                } else {
                    dashboardState.eventFilters.add(filterType);
                    button?.classList.add('btn-primary');
                }
                
                if (dashboardState.eventFilters.size === 0) {
                    dashboardState.eventFilters.add('all');
                    document.getElementById('filterAll')?.classList.add('btn-primary');
                }
            }
            
            this.renderEventLog();
        };
        
        window.pauseStream = () => {
            dashboardState.streamPaused = !dashboardState.streamPaused;
            const btn = document.getElementById('pauseBtn');
            
            if (dashboardState.streamPaused) {
                btn.textContent = 'Resume';
                btn.style.background = 'rgba(255, 107, 107, 0.1)';
                btn.style.borderColor = 'rgba(255, 107, 107, 0.3)';
                btn.style.color = '#ff6b6b';
                this.updateStreamStatus(false, 'Paused');
            } else {
                btn.textContent = 'Pause';
                btn.style.background = 'rgba(0, 245, 255, 0.1)';
                btn.style.borderColor = 'rgba(0, 245, 255, 0.3)';
                btn.style.color = '#00f5ff';
                if (dashboardState.eventSource && dashboardState.eventSource.readyState === EventSource.OPEN) {
                    this.updateStreamStatus(true, 'Connected');
                }
            }
        };
        
        window.clearEventLog = () => {
            dashboardState.eventLog = [];
            this.renderEventLog();
        };
        
        window.toggleEventDetails = (eventId, button) => {
            const detailsDiv = button.nextElementSibling;
            const isVisible = detailsDiv.style.display !== 'none';
            
            if (isVisible) {
                detailsDiv.style.display = 'none';
                button.textContent = '📋 Show Details';
                button.style.background = 'rgba(0, 245, 255, 0.1)';
            } else {
                detailsDiv.style.display = 'block';
                button.textContent = '📋 Hide Details';
                button.style.background = 'rgba(0, 245, 255, 0.2)';
            }
        };
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    async reconnectStream() {
        console.log('Manual reconnect triggered');
        if (dashboardState.eventSource) {
            dashboardState.eventSource.close();
        }
        this.updateStreamStatus(false, 'Reconnecting...');
        this.reconnectAttempts = 0;
        await new Promise(resolve => setTimeout(resolve, 1000));
        await this.connectEventStream();
    }
}
