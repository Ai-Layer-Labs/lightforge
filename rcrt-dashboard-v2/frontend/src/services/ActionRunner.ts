/**
 * ActionRunner - Executes actions defined in UI breadcrumbs
 * Supports: api.call, setState, navigate, sequence
 */

import { StateManager } from './StateManager';
import { resolveTemplateObject, TemplateContext } from '../utils/TemplateEngine';

export type ActionType = 'api.call' | 'setState' | 'navigate' | 'sequence' | 'log' | 'completeFirstLaunch';

export interface BaseAction {
  action: ActionType;
}

export interface CompleteFirstLaunchAction extends BaseAction {
  action: 'completeFirstLaunch';
  navigate_to?: string;
}

export interface ApiCallAction extends BaseAction {
  action: 'api.call';
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  endpoint: string; // Can contain templates
  auth?: boolean;
  body?: any; // Can contain templates
  headers?: Record<string, string>;
  on_success?: Action;
  on_error?: Action;
}

export interface SetStateAction extends BaseAction {
  action: 'setState';
  state_ref?: string;
  updates: Record<string, any>; // Can contain templates
  merge?: boolean;
  on_complete?: Action;
}

export interface NavigateAction extends BaseAction {
  action: 'navigate';
  to: string; // Can contain templates
  replace?: boolean;
  state?: any;
}

export interface SequenceAction extends BaseAction {
  action: 'sequence';
  steps: Action[];
  stop_on_error?: boolean;
}

export interface LogAction extends BaseAction {
  action: 'log';
  message: string;
  data?: any;
}

export type Action = ApiCallAction | SetStateAction | NavigateAction | SequenceAction | LogAction | CompleteFirstLaunchAction;

export interface ActionContext {
  state?: any;
  data?: any;
  item?: any;
  props?: any;
  args?: any;
  response?: any;
}

export class ActionRunner {
  private authenticatedFetch: (url: string, options?: RequestInit) => Promise<Response>;
  private stateManager: StateManager;
  private navigate: (to: string, options?: any) => void;
  private defaultStateRef?: string;
  private namedActions: Record<string, Action>;

  constructor(
    authenticatedFetch: (url: string, options?: RequestInit) => Promise<Response>,
    stateManager: StateManager,
    navigate: (to: string, options?: any) => void,
    defaultStateRef?: string,
    namedActions?: Record<string, Action>
  ) {
    this.authenticatedFetch = authenticatedFetch;
    this.stateManager = stateManager;
    this.navigate = navigate;
    this.defaultStateRef = defaultStateRef;
    this.namedActions = namedActions || {};
  }

  /**
   * Set named actions from page definition
   */
  setNamedActions(actions: Record<string, Action>) {
    this.namedActions = actions;
  }

  /**
   * Execute an action with context
   */
  async execute(action: Action | string, context: ActionContext = {}): Promise<any> {
    console.log('🎬 Executing with context.args:', context.args);
    
    // If action is a string, look it up in named actions
    if (typeof action === 'string') {
      const actionName = action;
      const actionDef = this.namedActions[actionName];
      
      if (!actionDef) {
        console.error('❌ Named action not found:', actionName);
        console.log('Available actions:', Object.keys(this.namedActions));
        return null;
      }
      
      console.log('🎬 Executing named action:', actionName, '→', actionDef, 'with args:', context.args);
      // CRITICAL: Pass the full context including args!
      return await this.execute(actionDef, context);
    }

    console.log('🎬 Executing action:', action.action, action);

    try {
      // Check if this is a built-in action type
      const builtInTypes = ['api.call', 'setState', 'navigate', 'sequence', 'log', 'completeFirstLaunch'];
      
      if (builtInTypes.includes(action.action)) {
        // Execute built-in action
        switch (action.action) {
          case 'api.call':
            return await this.executeApiCall(action, context);
          
          case 'setState':
            return await this.executeSetState(action, context);
          
          case 'navigate':
            return this.executeNavigate(action, context);
          
          case 'sequence':
            return await this.executeSequence(action, context);
          
          case 'log':
            return this.executeLog(action, context);
          
          case 'completeFirstLaunch':
            return this.executeCompleteFirstLaunch(action, context);
        }
      }
      
      // Otherwise, treat action.action as a named action reference
      const actionName = action.action;
      const actionDef = this.namedActions[actionName];
      
      if (!actionDef) {
        console.error('❌ Named action not found:', actionName);
        console.log('Available actions:', Object.keys(this.namedActions));
        return null;
      }
      
      console.log('🎬 Executing named action:', actionName, '→', actionDef, 'with args:', context.args);
      // Merge args from both the reference and the context
      const mergedContext = {
        ...context,
        args: { ...(action as any).args, ...context.args }, // Context args override action args
      };
      return await this.execute(actionDef, mergedContext);
      
    } catch (error) {
      console.error('❌ Action execution failed:', error);
      throw error;
    }
  }

  /**
   * Execute API call action
   */
  private async executeApiCall(action: ApiCallAction, context: ActionContext): Promise<any> {
    // Resolve templates in endpoint and body
    const templateContext: TemplateContext = context;
    const endpoint = resolveTemplateObject(action.endpoint, templateContext);
    const body = action.body ? resolveTemplateObject(action.body, templateContext) : undefined;
    const headers = action.headers ? resolveTemplateObject(action.headers, templateContext) : {};

    console.log('🌐 API Call:', action.method, endpoint, body);

    const options: RequestInit = {
      method: action.method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await this.authenticatedFetch(endpoint, options);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API call failed:', response.status, errorText);
      
      if (action.on_error) {
        const errorContext = { ...context, error: { status: response.status, message: errorText } };
        return await this.execute(action.on_error, errorContext);
      }
      
      throw new Error(`API call failed: ${response.status} ${errorText}`);
    }

    const responseData = await response.json();
    console.log('✅ API call successful:', responseData);

    // Execute success callback if defined
    if (action.on_success) {
      const successContext = { ...context, response: responseData };
      return await this.execute(action.on_success, successContext);
    }

    return responseData;
  }

  /**
   * Execute setState action
   */
  private async executeSetState(action: SetStateAction, context: ActionContext): Promise<any> {
    const stateRef = action.state_ref || this.defaultStateRef;
    
    if (!stateRef) {
      throw new Error('No state_ref specified and no default state ref');
    }

    // Resolve templates in updates
    const templateContext: TemplateContext = context;
    const updates = resolveTemplateObject(action.updates, templateContext);

    console.log('📝 Setting state:', stateRef, updates);
    console.log('📝 Updates detail:', JSON.stringify(updates, null, 2));

    const newState = await this.stateManager.updateState(stateRef, updates, action.merge ?? true);

    if (!newState) {
      throw new Error('Failed to update state');
    }

    // Execute completion callback if defined
    if (action.on_complete) {
      const completeContext = { ...context, state: newState.context };
      return await this.execute(action.on_complete, completeContext);
    }

    return newState;
  }

  /**
   * Execute navigate action
   */
  private executeNavigate(action: NavigateAction, context: ActionContext): void {
    const templateContext: TemplateContext = context;
    const to = resolveTemplateObject(action.to, templateContext);

    console.log('🧭 Navigating to:', to);

    this.navigate(to, { replace: action.replace, state: action.state });
  }

  /**
   * Execute sequence action
   */
  private async executeSequence(action: SequenceAction, context: ActionContext): Promise<any> {
    console.log('📚 Executing sequence of', action.steps.length, 'actions');

    let lastResult: any = null;
    let sequenceContext = { ...context };

    for (let i = 0; i < action.steps.length; i++) {
      const step = action.steps[i];
      console.log(`  Step ${i + 1}/${action.steps.length}:`, step.action);

      try {
        lastResult = await this.execute(step, sequenceContext);
        
        // Update context with result for next step
        sequenceContext = { ...sequenceContext, previousResult: lastResult };
      } catch (error) {
        console.error(`❌ Sequence step ${i + 1} failed:`, error);
        
        if (action.stop_on_error ?? true) {
          throw error;
        }
      }
    }

    return lastResult;
  }

  /**
   * Execute log action (for debugging)
   */
  private executeLog(action: LogAction, context: ActionContext): void {
    const templateContext: TemplateContext = context;
    const message = resolveTemplateObject(action.message, templateContext);
    const data = action.data ? resolveTemplateObject(action.data, templateContext) : undefined;

    console.log('📋 Log:', message, data);
  }

  /**
   * Execute completeFirstLaunch action
   */
  private executeCompleteFirstLaunch(action: CompleteFirstLaunchAction, context: ActionContext): void {
    console.log('✅ Marking first launch as complete');
    localStorage.setItem('rcrt-first-launch-completed', 'true');
    
    if (action.navigate_to) {
      const templateContext: TemplateContext = context;
      const to = resolveTemplateObject(action.navigate_to, templateContext);
      console.log('🧭 Navigating to:', to);
      this.navigate(to, { replace: true });
    }
  }
}

