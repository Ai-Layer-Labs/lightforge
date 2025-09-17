async function execute(triggerBreadcrumb, context) {
  console.log('📁 File Manager Agent activated!');
  
  const userMessage = triggerBreadcrumb.context?.content || triggerBreadcrumb.title || '';
  const conversationId = triggerBreadcrumb.context?.conversation_id || 'file-manager-chat';
  
  try {
    // Analyze user request to determine what file operation they want
    const request = userMessage.toLowerCase();
    let response = '';
    let actionTaken = 'info';
    
    if (request.includes('list') || request.includes('show') || request.includes('files')) {
      // List all stored files
      console.log('📋 Listing stored files...');
      
      const listResult = await context.invokeTool('file-storage', {
        action: 'list'
      });
      
      if (listResult.success && listResult.files) {
        const files = listResult.files;
        const totalFiles = files.length;
        const totalSize = files.reduce((sum, f) => sum + (f.size_bytes || 0), 0);
        
        // Group files by type
        const fileTypes = {};
        files.forEach(file => {
          const type = file.file_type || 'unknown';
          if (!fileTypes[type]) fileTypes[type] = [];
          fileTypes[type].push(file);
        });
        
        response = `📁 **File Storage Summary**\n\n`;
        response += `**Total Files:** ${totalFiles}\n`;
        response += `**Total Size:** ${Math.round(totalSize / 1024)} KB\n\n`;
        
        response += `**Files by Type:**\n`;
        Object.entries(fileTypes).forEach(([type, typeFiles]) => {
          response += `• **${type.toUpperCase()}:** ${typeFiles.length} files\n`;
          typeFiles.slice(0, 3).forEach(file => {
            response += `  - ${file.filename} (${Math.round(file.size_bytes / 1024)} KB)\n`;
          });
          if (typeFiles.length > 3) {
            response += `  - ... and ${typeFiles.length - 3} more\n`;
          }
        });
        
        actionTaken = 'list_files';
      } else {
        response = `❌ Failed to list files: ${listResult.error || 'Unknown error'}`;
        actionTaken = 'error';
      }
      
    } else if (request.includes('javascript') || request.includes('js') || request.includes('agent')) {
      // List JavaScript files specifically
      console.log('🔍 Searching for JavaScript files...');
      
      const jsResult = await context.invokeTool('agent-loader', {
        action: 'list-agent-files'
      });
      
      if (jsResult.success && jsResult.files) {
        const jsFiles = jsResult.files;
        
        response = `💻 **JavaScript Files**\n\n`;
        response += `Found ${jsFiles.length} JavaScript files:\n\n`;
        
        jsFiles.forEach(file => {
          const isAgentCode = file.is_agent_code ? '🤖 ' : '📄 ';
          response += `${isAgentCode}**${file.filename}**\n`;
          response += `  - Size: ${Math.round(file.size_bytes / 1024)} KB\n`;
          response += `  - ID: \`${file.id}\`\n`;
          response += `  - Created: ${new Date(file.created_at).toLocaleString()}\n\n`;
        });
        
        if (jsFiles.length > 0) {
          response += `💡 *Tip: You can load any of these as agents using the agent-loader tool!*`;
        }
        
        actionTaken = 'list_js_files';
      } else {
        response = `❌ Failed to list JavaScript files: ${jsResult.error || 'Unknown error'}`;
        actionTaken = 'error';
      }
      
    } else if (request.includes('help') || request.includes('what') || request.includes('how')) {
      // Provide help information
      response = `🤖 **File Manager Agent - Help**\n\n`;
      response += `I can help you manage your stored files! Here's what I can do:\n\n`;
      response += `📋 **Commands:**\n`;
      response += `• "list files" - Show all stored files with statistics\n`;
      response += `• "show javascript" - List all JavaScript files\n`;
      response += `• "help" - Show this help message\n\n`;
      response += `🛠️ **File Tools Available:**\n`;
      response += `• **file-storage** - Store, retrieve, list, and delete files\n`;
      response += `• **agent-loader** - Convert JavaScript files into executable agents\n\n`;
      response += `💡 **Pro Tip:** I was created using these same tools! My code is stored as a file and loaded as an agent definition.`;
      
      actionTaken = 'help';
      
    } else {
      // Default response with file system status
      console.log('📊 Getting file system status...');
      
      const statusResult = await context.invokeTool('file-storage', {
        action: 'list'
      });
      
      if (statusResult.success) {
        const fileCount = statusResult.files?.length || 0;
        const jsFiles = statusResult.files?.filter(f => f.file_type === 'js').length || 0;
        
        response = `👋 Hello! I'm your **File Manager Agent**.\n\n`;
        response += `📊 **Current Status:**\n`;
        response += `• ${fileCount} files stored\n`;
        response += `• ${jsFiles} JavaScript files\n\n`;
        response += `You said: "${userMessage}"\n\n`;
        response += `💬 Try asking me to:\n`;
        response += `• "list files" - See all your files\n`;
        response += `• "show javascript files" - See JS files\n`;
        response += `• "help" - Get detailed help\n`;
        
        actionTaken = 'status';
      } else {
        response = `👋 Hello! I'm your File Manager Agent. I had trouble accessing the file system, but I'm ready to help you manage your files!`;
        actionTaken = 'greeting';
      }
    }
    
    // Create response breadcrumb
    await context.rcrtClient.createBreadcrumb({
      schema_name: 'agent.response.v1',
      title: 'File Manager Response',
      tags: ['agent:response', 'file:manager', 'chat:response', 'workspace:agents'],
      context: {
        agent_name: 'File Manager Agent',
        conversation_id: conversationId,
        response_to: triggerBreadcrumb.id,
        content: response,
        action_taken: actionTaken,
        user_request: userMessage,
        timestamp: new Date().toISOString(),
        capabilities: ['file-listing', 'file-analysis', 'help-system', 'tool-integration']
      }
    });
    
    console.log('✅ File Manager Agent completed successfully');
    return { 
      response, 
      action: actionTaken,
      success: true 
    };
    
  } catch (error) {
    console.error('❌ File Manager Agent error:', error);
    
    const errorResponse = `❌ **Error:** ${error.message}\n\nI encountered an issue while processing your request. Please try again or ask for help.`;
    
    // Create error response breadcrumb
    await context.rcrtClient.createBreadcrumb({
      schema_name: 'agent.response.v1',
      title: 'File Manager Error',
      tags: ['agent:response', 'agent:error', 'file:manager', 'workspace:agents'],
      context: {
        agent_name: 'File Manager Agent',
        conversation_id: conversationId,
        response_to: triggerBreadcrumb.id,
        content: errorResponse,
        error: error.message,
        user_request: userMessage,
        timestamp: new Date().toISOString()
      }
    });
    
    return { 
      response: errorResponse, 
      error: error.message,
      success: false 
    };
  }
}

