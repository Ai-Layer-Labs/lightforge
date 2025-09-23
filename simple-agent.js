async function execute(triggerBreadcrumb, context) {
  console.log('🤖 Simple Demo Agent activated!');
  
  const userMessage = triggerBreadcrumb.context?.content || triggerBreadcrumb.title || '';
  const response = `Hello! I'm a demo agent loaded from a file. You said: "${userMessage}"`;
  
  await context.rcrtClient.createBreadcrumb({
    schema_name: 'agent.response.v1',
    title: 'Demo Agent Response',
    tags: ['agent:response', 'demo:agent', 'file:loaded'],
    context: {
      agent_name: 'Demo File Agent',
      content: response,
      response_to: triggerBreadcrumb.id,
      loaded_from_file: true
    }
  });
  
  return { response, success: true };
}


