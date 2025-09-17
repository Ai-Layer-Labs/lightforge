/**
 * RCRT Super Agent Chat Manager
 * Handles chat interface and communication with the super agent
 */

import { dashboardState } from './state.js';
import { apiClient } from './api-client.js';

export class SuperAgentChatManager {
    constructor() {
        this.conversationId = this.generateConversationId();
        this.userId = 'dashboard-user';
        this.isCollapsed = false;
        this.messageHistory = [];
        this.eventSource = null;
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.setupSSEListener();
        this.setupResizeHandler();
        this.loadExistingMessages();
        
        // Cleanup on page unload
        window.addEventListener('beforeunload', () => {
            if (this.eventSource) {
                this.eventSource.close();
            }
        });
        
        console.log('💬 Simple Chat Manager initialized with live SSE feed');
    }
    
    setupEventListeners() {
        // Enter key to send message
        const chatInput = document.getElementById('chatInput');
        if (chatInput) {
            chatInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        }
    }
    
    setupResizeHandler() {
        const chatInterface = document.getElementById('chatInterfaceBottom');
        const resizeHandle = document.getElementById('chatResizeHandle');
        let isResizing = false;
        let startY = 0;
        let startHeight = 0;
        
        if (resizeHandle && chatInterface) {
            resizeHandle.addEventListener('mousedown', (e) => {
                isResizing = true;
                startY = e.clientY;
                startHeight = parseInt(document.defaultView.getComputedStyle(chatInterface).height, 10);
                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
                e.preventDefault();
            });
            
            const handleMouseMove = (e) => {
                if (!isResizing) return;
                const newHeight = startHeight - (e.clientY - startY);
                const clampedHeight = Math.max(120, Math.min(600, newHeight));
                chatInterface.style.height = clampedHeight + 'px';
            };
            
            const handleMouseUp = () => {
                isResizing = false;
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }
    
    async loadExistingMessages() {
        try {
            // Clear existing messages first
            const messagesContainer = document.getElementById('chatMessages');
            if (messagesContainer) {
                messagesContainer.innerHTML = '';
            }
            
            // Load recent user messages and responses
            const userMessages = dashboardState.breadcrumbs.filter(b => 
                b.tags?.includes('user:message') && b.tags?.includes('workspace:chat')
            ).slice(-10);
            
            const userResponses = dashboardState.breadcrumbs.filter(b => 
                b.tags?.includes('user:response') && b.tags?.includes('workspace:chat')
            ).slice(-10);
            
            // Combine and sort by timestamp (chronological order)
            const allMessages = [...userMessages, ...userResponses]
                .sort((a, b) => new Date(a.updated_at) - new Date(b.updated_at));
            
            console.log(`💬 Loading ${allMessages.length} messages (${userMessages.length} user, ${userResponses.length} responses)`);
            
            // Display existing messages in chronological order
            for (const message of allMessages) {
                try {
                    const fullMessage = await apiClient.loadBreadcrumbDetails(message.id);
                    const isUserMessage = message.tags.includes('user:message');
                    const content = isUserMessage ? 
                        fullMessage.context.message || fullMessage.title :
                        fullMessage.context.agent_response || fullMessage.context.response || fullMessage.title;
                    
                    this.addMessageToChat(
                        isUserMessage ? 'user' : 'agent', 
                        content, 
                        fullMessage.updated_at
                    );
                } catch (error) {
                    console.warn(`Failed to load message ${message.id}:`, error);
                }
            }
            
            console.log(`💬 Loaded ${allMessages.length} existing messages`);
            
        } catch (error) {
            console.warn('Failed to load existing messages:', error);
        }
    }
    
    setupSSEListener() {
        // Direct SSE connection like the extension
        this.connectToSSE();
        
        // Fallback: also listen to dashboard breadcrumb updates
        dashboardState.subscribe('breadcrumbs', () => {
            this.checkForNewMessages();
        });
    }
    
    connectToSSE() {
        const streamUrl = '/api/events/stream';
        console.log('📡 Chat: Connecting to RCRT event stream:', streamUrl);
        
        this.eventSource = new EventSource(streamUrl);
        
        this.eventSource.onopen = () => {
            console.log('✅ Chat: Connected to RCRT event stream');
        };
        
        this.eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleSSEEvent(data);
            } catch (error) {
                console.warn('Chat: Failed to parse SSE event:', error);
            }
        };
        
        this.eventSource.onerror = (error) => {
            console.error('Chat: SSE error:', error);
            
            // Auto-reconnect after delay
            setTimeout(() => {
                if (this.eventSource?.readyState === EventSource.CLOSED) {
                    console.log('🔄 Chat: Reconnecting to SSE...');
                    this.connectToSSE();
                }
            }, 5000);
        };
    }
    
    async handleSSEEvent(eventData) {
        // Only handle user message and response breadcrumbs
        if (eventData.type === 'breadcrumb.created' || eventData.type === 'breadcrumb.updated') {
            if ((eventData.tags?.includes('user:message') || eventData.tags?.includes('user:response')) &&
                eventData.tags?.includes('workspace:chat')) {
                
                console.log('💬 Chat SSE: New message breadcrumb:', eventData.breadcrumb_id);
                
                // Get full breadcrumb details
                try {
                    const fullMessage = await apiClient.loadBreadcrumbDetails(eventData.breadcrumb_id);
                    
                    // Check if we already have this message
                    if (this.messageHistory.some(m => m.breadcrumb_id === eventData.breadcrumb_id)) {
                        return; // Already displayed
                    }
                    
                    const isUserMessage = eventData.tags.includes('user:message');
                    const content = isUserMessage ? 
                        fullMessage.context.message || fullMessage.title :
                        fullMessage.context.agent_response || fullMessage.context.response || fullMessage.title;
                    
                    this.addMessageToChat(
                        isUserMessage ? 'user' : 'agent', 
                        content, 
                        fullMessage.updated_at
                    );
                    
                    // Mark as processed
                    this.messageHistory[this.messageHistory.length - 1].breadcrumb_id = eventData.breadcrumb_id;
                    
                    console.log(`💬 Chat SSE: Added ${isUserMessage ? 'user' : 'agent'} message`);
                    
                } catch (error) {
                    console.warn('Chat SSE: Failed to load message details:', error);
                }
            }
        }
    }
    
    async sendMessage() {
        const chatInput = document.getElementById('chatInput');
        const message = chatInput.value.trim();
        
        if (!message) return;
        
        // Clear input
        chatInput.value = '';
        
        try {
            // Create simple user message breadcrumb
            const userMessageBreadcrumb = await apiClient.createBreadcrumb({
                schema_name: 'user.message.v1',
                title: `User: ${message.substring(0, 50)}`,
                tags: ['user:message', 'workspace:chat'],
                context: {
                    message: message,
                    user_id: this.userId,
                    conversation_id: this.conversationId,
                    timestamp: new Date().toISOString()
                }
            });
            
            console.log('💬 User message sent as breadcrumb:', userMessageBreadcrumb.id);
            
        } catch (error) {
            console.error('Failed to send chat message:', error);
        }
    }
    
    addMessageToChat(sender, content, timestamp = null) {
        const messagesContainer = document.getElementById('chatMessages');
        if (!messagesContainer) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${sender}`;
        
        const time = timestamp ? new Date(timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
        
        const senderName = sender === 'user' ? '👤 You' : 
                          sender === 'agent' ? '🤖 Super Agent' : 
                          '🔧 System';
        
        messageDiv.innerHTML = `
            <div class="message-header">
                <span class="message-sender ${sender}">${senderName}</span>
                <span class="message-time">${time}</span>
            </div>
            <div class="message-content">${this.formatMessage(content)}</div>
        `;
        
        messagesContainer.appendChild(messageDiv);
        
        // Auto-scroll to bottom (show latest messages)
        setTimeout(() => {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }, 100);
        
        // Store in history
        this.messageHistory.push({
            sender,
            content,
            timestamp: timestamp || new Date().toISOString()
        });
    }
    
    // NO MORE HARDCODED INDICATORS - Chat window only displays breadcrumbs
    
    async checkForNewMessages() {
        try {
            // Get current breadcrumbs
            const currentBreadcrumbs = dashboardState.breadcrumbs || [];
            
            // Find new user messages and responses
            const newMessages = currentBreadcrumbs.filter(b => 
                (b.tags?.includes('user:message') || b.tags?.includes('user:response')) &&
                b.tags?.includes('workspace:chat') &&
                !this.messageHistory.some(m => m.breadcrumb_id === b.id)
            );
            
            if (newMessages.length > 0) {
                console.log(`💬 Found ${newMessages.length} new messages`);
                
                // Sort by timestamp
                newMessages.sort((a, b) => new Date(a.updated_at) - new Date(b.updated_at));
                
                for (const message of newMessages) {
                    try {
                        const fullMessage = await apiClient.loadBreadcrumbDetails(message.id);
                        const isUserMessage = message.tags.includes('user:message');
                        const content = isUserMessage ? 
                            fullMessage.context.message || fullMessage.title :
                            fullMessage.context.agent_response || fullMessage.context.response || fullMessage.title;
                        
                        this.addMessageToChat(
                            isUserMessage ? 'user' : 'agent', 
                            content, 
                            fullMessage.updated_at
                        );
                        
                        // Mark as processed
                        this.messageHistory[this.messageHistory.length - 1].breadcrumb_id = message.id;
                        
                        console.log(`💬 Added ${isUserMessage ? 'user' : 'agent'} message to chat:`, message.id);
                    } catch (error) {
                        console.warn(`Failed to load message ${message.id}:`, error);
                    }
                }
            }
            
        } catch (error) {
            console.warn('Failed to check for new messages:', error);
        }
    }
    
    formatMessage(content) {
        // Basic message formatting
        if (typeof content === 'object') {
            return `<pre>${JSON.stringify(content, null, 2)}</pre>`;
        }
        
        // Convert URLs to links
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const formatted = content.replace(urlRegex, '<a href="$1" target="_blank">$1</a>');
        
        // Convert line breaks
        return formatted.replace(/\n/g, '<br>');
    }
    
    toggleChatInterface() {
        const chatInterface = document.getElementById('chatInterfaceBottom');
        const mainContainer = document.querySelector('.main-container');
        const toggleBtn = document.getElementById('chatToggleBtn');
        
        this.isCollapsed = !this.isCollapsed;
        
        if (this.isCollapsed) {
            chatInterface.classList.add('collapsed');
            mainContainer.classList.add('chat-collapsed');
            toggleBtn.textContent = '▲ Show';
        } else {
            chatInterface.classList.remove('collapsed');
            mainContainer.classList.remove('chat-collapsed');
            toggleBtn.textContent = '▼ Hide';
        }
    }
    
    clearChatHistory() {
        const messagesContainer = document.getElementById('chatMessages');
        if (messagesContainer) {
            messagesContainer.innerHTML = '';
        }
        
        this.messageHistory = [];
        this.conversationId = this.generateConversationId();
        
        console.log('💬 Chat history cleared, new conversation ID:', this.conversationId);
    }
    
    generateConversationId() {
        return 'conv-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }
    
    // ============ MODULE INTEGRATION ============
    
    static getInstance() {
        if (!SuperAgentChatManager.instance) {
            SuperAgentChatManager.instance = new SuperAgentChatManager();
        }
        return SuperAgentChatManager.instance;
    }
}

// Create singleton instance
export const superAgentChat = SuperAgentChatManager.getInstance();
