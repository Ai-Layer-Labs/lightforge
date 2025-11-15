/**
 * Context Viewer - Format agent.context.v1 for debugging
 * Shows what the LLM actually received in a readable format
 */

import { useState } from 'react';
import { ChevronDown, ChevronRight, Copy, Check, Brain, FileText, Package, Clock, Hash } from 'lucide-react';
import type { Breadcrumb } from '../lib/types';

interface ContextViewerProps {
  breadcrumb: Breadcrumb;
}

interface ParsedSection {
  title: string;
  content: string;
  type: 'text' | 'json' | 'list';
}

export function ContextViewer({ breadcrumb }: ContextViewerProps) {
  const [copied, setCopied] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['summary']));

  // Extract context data
  const context = breadcrumb.context;
  const formattedContext = context?.formatted_context;

  // Parse the formatted context intelligently
  const { parsedContext, sections, metadata } = parseFormattedContext(formattedContext, context);

  const toggleSection = (title: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(title)) {
        next.delete(title);
      } else {
        next.add(title);
      }
      return next;
    });
  };

  const copyToClipboard = async (text?: string) => {
    try {
      const toCopy = text || (
        parsedContext 
          ? JSON.stringify(parsedContext, null, 2)
          : formattedContext || ''
      );
      await navigator.clipboard.writeText(toCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white">
      {/* Header with Metadata */}
      <div className="p-4 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-400" />
            <h3 className="text-lg font-bold">LLM Context</h3>
          </div>
          <button
            onClick={() => copyToClipboard()}
            className="flex items-center gap-2 px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors"
          >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Copied!' : 'Copy All'}
          </button>
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <MetadataItem 
            icon={<Package className="w-3 h-3" />}
            label="Consumer"
            value={metadata.consumer_id}
          />
          <MetadataItem 
            icon={<Hash className="w-3 h-3" />}
            label="Tokens"
            value={metadata.token_estimate?.toLocaleString()}
          />
          <MetadataItem 
            icon={<FileText className="w-3 h-3" />}
            label="Breadcrumbs"
            value={metadata.breadcrumb_count}
          />
          <MetadataItem 
            icon={<Clock className="w-3 h-3" />}
            label="Assembled"
            value={metadata.assembled_at ? new Date(metadata.assembled_at).toLocaleTimeString() : 'Unknown'}
          />
        </div>
      </div>

      {/* Content - Collapsible Sections */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {parsedContext && typeof parsedContext === 'object' && !Array.isArray(parsedContext) ? (
          /* JSON Object - show as key-value sections */
          Object.entries(parsedContext).map(([key, value]) => (
            <CollapsibleSection
              key={key}
              title={formatSectionTitle(key)}
              content={value}
              isExpanded={expandedSections.has(key)}
              onToggle={() => toggleSection(key)}
              onCopy={() => copyToClipboard(typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value))}
            />
          ))
        ) : sections.length > 0 ? (
          /* Text with === SECTIONS === markers */
          <>
            {sections.map((section, idx) => (
              <CollapsibleSection
                key={idx}
                title={section.title}
                content={section.content}
                type={section.type}
                isExpanded={expandedSections.has(section.title)}
                onToggle={() => toggleSection(section.title)}
                onCopy={() => copyToClipboard(section.content)}
              />
            ))}
          </>
        ) : (
          /* Fallback: show raw formatted_context */
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-400">Full Context</span>
              <button
                onClick={() => copyToClipboard(formattedContext as string)}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                Copy
              </button>
            </div>
            <pre className="text-xs text-gray-300 whitespace-pre-wrap overflow-x-auto font-mono leading-relaxed">
              {formattedContext || 'No formatted context available'}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper component for metadata items
function MetadataItem({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | number }) {
  return (
    <div className="flex items-center gap-2 text-gray-400">
      {icon}
      <div className="flex flex-col">
        <span className="text-gray-500 text-[10px] uppercase">{label}</span>
        <span className="text-white font-semibold">{value || 'N/A'}</span>
      </div>
    </div>
  );
}

// Collapsible section component
function CollapsibleSection({ 
  title, 
  content, 
  type = 'text',
  isExpanded, 
  onToggle, 
  onCopy 
}: { 
  title: string; 
  content: any; 
  type?: string;
  isExpanded: boolean; 
  onToggle: () => void; 
  onCopy: () => void;
}) {
  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
          <span className="font-semibold text-blue-400">{title}</span>
          <span className="text-xs text-gray-500">
            ({formatContentLength(content)})
          </span>
        </div>
        {isExpanded && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCopy();
            }}
            className="text-xs text-gray-400 hover:text-blue-400 transition-colors"
          >
            Copy
          </button>
        )}
      </button>
      
      {isExpanded && (
        <div className="p-4 bg-gray-900 border-t border-gray-700">
          {renderContent(content, type)}
        </div>
      )}
    </div>
  );
}

// Parse formatted_context intelligently
function parseFormattedContext(formattedContext: any, fullContext: any) {
  const metadata = {
    consumer_id: fullContext?.consumer_id || 'unknown',
    token_estimate: fullContext?.token_estimate,
    breadcrumb_count: fullContext?.breadcrumb_count || fullContext?.sources_assembled,
    assembled_at: fullContext?.assembled_at,
    trigger_event_id: fullContext?.trigger_event_id
  };

  // If formattedContext is not a string, return as-is
  if (typeof formattedContext !== 'string') {
    return { parsedContext: formattedContext, sections: [], metadata };
  }

  // Try to parse as JSON first
  if (formattedContext.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(formattedContext);
      return { parsedContext: parsed, sections: [], metadata };
    } catch {
      // Not valid JSON, continue to text parsing
    }
  }

  // Parse markdown-style sections (=== TITLE ===)
  const sections: ParsedSection[] = [];
  const sectionRegex = /===\s+(.+?)\s+===\n([\s\S]*?)(?=\n===|\n---\n|\Z)/g;
  const textSections = formattedContext.split(/\n---\n/);
  
  // Try regex-based section parsing first
  let match;
  const regexSections: ParsedSection[] = [];
  while ((match = sectionRegex.exec(formattedContext)) !== null) {
    regexSections.push({
      title: match[1].trim(),
      content: match[2].trim(),
      type: detectContentType(match[2].trim())
    });
  }

  if (regexSections.length > 0) {
    return { parsedContext: null, sections: regexSections, metadata };
  }

  // Fallback: split by --- separators
  if (textSections.length > 1) {
    textSections.forEach((section, idx) => {
      const trimmed = section.trim();
      if (trimmed) {
        // Check if first line can be a title
        const lines = trimmed.split('\n');
        const potentialTitle = lines[0];
        const isTitle = potentialTitle.length < 100 && !potentialTitle.includes(':');
        
        sections.push({
          title: isTitle ? potentialTitle : `Section ${idx + 1}`,
          content: isTitle ? lines.slice(1).join('\n').trim() : trimmed,
          type: detectContentType(trimmed)
        });
      }
    });
  }

  // If no sections found, treat whole thing as one section
  if (sections.length === 0 && formattedContext) {
    sections.push({
      title: 'Full Context',
      content: formattedContext,
      type: detectContentType(formattedContext)
    });
  }

  return { parsedContext: null, sections, metadata };
}

// Detect content type
function detectContentType(content: string): 'text' | 'json' | 'list' {
  const trimmed = content.trim();
  
  // Check if it's JSON
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      JSON.parse(trimmed);
      return 'json';
    } catch {
      // Not valid JSON
    }
  }
  
  // Check if it's a list (multiple lines starting with • or -)
  const lines = trimmed.split('\n');
  const listLines = lines.filter(l => /^\s*[•\-\*]\s/.test(l));
  if (listLines.length > lines.length * 0.5) {
    return 'list';
  }
  
  return 'text';
}

// Render content based on type
function renderContent(content: any, type: string) {
  if (typeof content === 'object' && content !== null) {
    // JSON content
    return (
      <pre className="text-xs text-gray-300 whitespace-pre-wrap overflow-x-auto font-mono leading-relaxed">
        {JSON.stringify(content, null, 2)}
      </pre>
    );
  }

  const stringContent = String(content);

  if (type === 'json') {
    try {
      const parsed = JSON.parse(stringContent);
      return (
        <pre className="text-xs text-gray-300 whitespace-pre-wrap overflow-x-auto font-mono leading-relaxed">
          {JSON.stringify(parsed, null, 2)}
        </pre>
      );
    } catch {
      // Fall through to text
    }
  }

  if (type === 'list') {
    const lines = stringContent.split('\n');
    return (
      <ul className="space-y-1 text-sm text-gray-300">
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*')) {
            return (
              <li key={idx} className="flex gap-2">
                <span className="text-blue-400">•</span>
                <span>{trimmed.substring(1).trim()}</span>
              </li>
            );
          }
          return trimmed ? <li key={idx} className="ml-4">{trimmed}</li> : null;
        }).filter(Boolean)}
      </ul>
    );
  }

  // Default text rendering
  return (
    <pre className="text-xs text-gray-300 whitespace-pre-wrap overflow-x-auto font-mono leading-relaxed">
      {stringContent}
    </pre>
  );
}

// Format section title for display
function formatSectionTitle(key: string): string {
  // Convert camelCase or snake_case to Title Case
  const formatted = key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
    .trim();
  
  return formatted || key;
}

// Format content length for display
function formatContentLength(content: any): string {
  if (typeof content === 'object' && content !== null) {
    if (Array.isArray(content)) {
      return `${content.length} items`;
    }
    return `${Object.keys(content).length} keys`;
  }
  
  const text = String(content);
  const lines = text.split('\n').length;
  const chars = text.length;
  
  if (chars < 100) {
    return `${chars} chars`;
  } else if (chars < 1000) {
    return `${lines} lines`;
  } else {
    return `${(chars / 1000).toFixed(1)}K chars`;
  }
}





