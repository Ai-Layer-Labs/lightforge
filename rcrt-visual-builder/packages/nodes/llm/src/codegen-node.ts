/**
 * Code Generator LLM Node
 * Generates code in various programming languages
 */

import { RegisterNode, NodeMetadata, NodeExecutionResult } from '@rcrt-builder/node-sdk';
import { LLMNode } from './base-llm-node';

@RegisterNode({
  schema_name: 'node.template.v1',
  title: 'Code Generator LLM Node',
  tags: ['node:template', 'llm', 'code'],
  context: {
    node_type: 'CodeGenLLMNode',
    category: 'llm',
    icon: '💻',
    color: '#0072f5',
  },
})
export class CodeGenLLMNode extends LLMNode {
  getMetadata(): NodeMetadata {
    const base = super.getMetadata();
    return {
      ...base,
      type: 'CodeGenLLMNode',
      icon: '💻',
      color: '#0072f5',
      description: 'Generates code in various programming languages',
      outputs: [
        ...base.outputs,
        {
          id: 'code',
          type: 'data',
          description: 'Generated code',
        },
        {
          id: 'language_metadata',
          type: 'data',
          description: 'Language and code metadata',
          optional: true,
        },
      ],
    };
  }
  
  validateConfig(config: any): boolean {
    if (!super.validateConfig(config)) {
      return false;
    }
    
    // Language is required
    if (!config.language) {
      return false;
    }
    
    // Validate language is supported
    const supportedLanguages = [
      'typescript', 'javascript', 'python', 'rust', 'go', 
      'java', 'c++', 'c#', 'ruby', 'php', 'swift', 'kotlin',
      'sql', 'html', 'css', 'json', 'yaml', 'toml', 'markdown',
    ];
    
    if (!supportedLanguages.includes(config.language.toLowerCase())) {
      console.warn(`Unsupported language: ${config.language}. Proceeding anyway.`);
    }
    
    return true;
  }
  
  async execute(inputs: Record<string, any>): Promise<NodeExecutionResult> {
    // Prepare code generation prompt
    const language = this.context.config.language;
    const styleGuide = this.context.config.style_guide || '';
    const framework = this.context.config.framework || '';
    const includeComments = this.context.config.include_comments !== false;
    const includeTests = this.context.config.include_tests || false;
    const includeDocumentation = this.context.config.include_documentation || false;
    
    // Build system prompt for code generation
    let systemPrompt = this.buildCodeGenPrompt(
      language,
      styleGuide,
      framework,
      includeComments,
      includeTests,
      includeDocumentation
    );
    
    // Override system prompt
    const originalPrompt = this.context.config.system_prompt;
    this.context.config.system_prompt = this.context.config.system_prompt_template
      ? this.context.config.system_prompt_template
          .replace('{language}', language)
          .replace('{style_guide}', styleGuide)
          .replace('{framework}', framework)
      : systemPrompt;
    
    // Execute base LLM
    const result = await super.execute(inputs);
    
    // Restore original prompt
    this.context.config.system_prompt = originalPrompt;
    
    // Extract and process code
    if (result.outputs.response) {
      const content = result.outputs.response.content;
      const codeBlocks = this.extractCodeBlocks(content, language);
      
      // Set code output
      result.outputs.code = codeBlocks.length > 0 
        ? codeBlocks[0].code 
        : this.cleanCode(content);
      
      // Add code metadata
      result.outputs.language_metadata = {
        language,
        framework,
        code_blocks: codeBlocks,
        has_comments: this.hasComments(result.outputs.code),
        has_tests: includeTests && this.hasTests(result.outputs.code, language),
        line_count: result.outputs.code.split('\n').length,
        char_count: result.outputs.code.length,
      };
      
      // Add to response metadata
      result.outputs.response.metadata = {
        ...result.outputs.response.metadata,
        code_generation: {
          language,
          framework,
          style_guide: styleGuide ? 'custom' : 'default',
          blocks_extracted: codeBlocks.length,
        },
      };
    }
    
    return result;
  }
  
  private buildCodeGenPrompt(
    language: string,
    styleGuide: string,
    framework: string,
    includeComments: boolean,
    includeTests: boolean,
    includeDocumentation: boolean
  ): string {
    let prompt = `You are an expert ${language} programmer.`;
    
    if (framework) {
      prompt += ` You specialize in ${framework}.`;
    }
    
    prompt += `\n\nGenerate clean, efficient, and maintainable ${language} code.`;
    
    if (styleGuide) {
      prompt += `\n\nFollow these style guidelines:\n${styleGuide}`;
    } else {
      prompt += `\n\nFollow ${language} best practices and conventions.`;
    }
    
    if (includeComments) {
      prompt += '\n\nInclude helpful inline comments explaining complex logic.';
    } else {
      prompt += '\n\nMinimize comments, code should be self-documenting.';
    }
    
    if (includeTests) {
      prompt += '\n\nInclude unit tests for the generated code.';
    }
    
    if (includeDocumentation) {
      prompt += '\n\nInclude comprehensive documentation/docstrings.';
    }
    
    prompt += '\n\nReturn the code in a markdown code block with proper language tag.';
    
    return prompt;
  }
  
  private extractCodeBlocks(content: string, language: string): Array<{
    language: string;
    code: string;
  }> {
    const blocks: Array<{ language: string; code: string }> = [];
    
    // Match markdown code blocks
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let match;
    
    while ((match = codeBlockRegex.exec(content)) !== null) {
      blocks.push({
        language: match[1] || language,
        code: match[2].trim(),
      });
    }
    
    return blocks;
  }
  
  private cleanCode(content: string): string {
    // Remove common artifacts
    let cleaned = content
      .replace(/^Here'?s?\s+(the\s+)?code:?\s*/i, '')
      .replace(/^```\w*\n?/, '')
      .replace(/\n?```$/, '')
      .trim();
    
    // Remove explanation text before/after code
    const lines = cleaned.split('\n');
    const codeLines: string[] = [];
    let inCode = false;
    
    for (const line of lines) {
      // Detect start of code (common patterns)
      if (!inCode && (
        line.match(/^(function|class|def|interface|type|const|let|var|import|export|package|using|namespace)/i) ||
        line.match(/^[{(<\[]/) ||
        line.match(/^\s*(public|private|protected|static)/)
      )) {
        inCode = true;
      }
      
      if (inCode) {
        codeLines.push(line);
      }
    }
    
    return codeLines.length > 0 ? codeLines.join('\n') : cleaned;
  }
  
  private hasComments(code: string): boolean {
    // Check for common comment patterns
    return !!(
      code.match(/\/\/.*$/m) ||  // Single-line comments
      code.match(/\/\*[\s\S]*?\*\//) ||  // Multi-line comments
      code.match(/#.*$/m) ||  // Python/Ruby comments
      code.match(/"""[\s\S]*?"""/) ||  // Python docstrings
      code.match(/--.*$/m)  // SQL comments
    );
  }
  
  private hasTests(code: string, language: string): boolean {
    // Check for test patterns based on language
    const testPatterns: Record<string, RegExp> = {
      typescript: /\b(describe|it|test|expect)\s*\(/,
      javascript: /\b(describe|it|test|expect)\s*\(/,
      python: /\b(def test_|class Test|unittest|pytest|assert)\b/,
      rust: /#\[test\]|#\[cfg\(test\)\]/,
      go: /func Test\w+\(t \*testing\.T\)/,
      java: /@Test|assertEquals|assertTrue/,
    };
    
    const pattern = testPatterns[language.toLowerCase()];
    return pattern ? pattern.test(code) : false;
  }
}
