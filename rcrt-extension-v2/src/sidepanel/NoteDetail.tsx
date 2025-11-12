/**
 * Note Detail Component
 * Shows note content with tabs for Summary, Insights, ELI5
 */

import { useState, useEffect } from 'react';
import { 
  ArrowLeft, ExternalLink, Clock, Trash2, Download, 
  Share2, Search, Loader, Brain 
} from 'lucide-react';
import type { RCRTClient } from '../lib/rcrt-client';
import type { Breadcrumb } from '../lib/types';
import { markdownToHtml } from '../lib/markdown';
import { formatDate } from '../lib/text-utils';
import { ContextViewer } from './ContextViewer';

interface NoteDetailProps {
  noteId: string;
  client: RCRTClient;
  onBack: () => void;
}

type DetailTab = 'content' | 'summary' | 'insights' | 'eli5' | 'context' | 'raw';

export function NoteDetail({ noteId, client, onBack }: NoteDetailProps) {
  const [note, setNote] = useState<Breadcrumb | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [summary, setSummary] = useState<string>('');
  const [insights, setInsights] = useState<string[]>([]);
  const [eli5, setEli5] = useState<string>('');
  const [activeTab, setActiveTab] = useState<DetailTab>('content');
  const [loading, setLoading] = useState(true);
  const [loadingRelated, setLoadingRelated] = useState(true);

  useEffect(() => {
    loadNote();
    loadRelatedBreadcrumbs();

    // Subscribe to updates for this note
    const unsubscribe = client.subscribeToSSE(
      {
        any_tags: [`note:${noteId}`]
      },
      (event) => {
        // Defensive check for SSE events
        if (!event || !event.breadcrumb) {
          return;
        }

        const bc = event.breadcrumb;
        
        if (bc.schema_name === 'note.tags.v1') {
          setTags(bc.context.tags || []);
        } else if (bc.schema_name === 'note.summary.v1') {
          setSummary(bc.context.summary || '');
        } else if (bc.schema_name === 'note.insights.v1') {
          setInsights(bc.context.insights || []);
        } else if (bc.schema_name === 'note.eli5.v1') {
          setEli5(bc.context.eli5 || '');
        }
      }
    );

    return () => {
      unsubscribe.then(fn => fn());
    };
  }, [noteId, client]);

  const loadNote = async () => {
    try {
      setLoading(true);
      const breadcrumb = await client.getBreadcrumb(noteId);
      setNote(breadcrumb);
    } catch (error) {
      console.error('[NoteDetail] Failed to load note:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRelatedBreadcrumbs = async () => {
    try {
      setLoadingRelated(true);
      const results = await client.searchBreadcrumbs({
        any_tags: [`note:${noteId}`]
      });

      results.forEach(bc => {
        if (bc.schema_name === 'note.tags.v1') {
          setTags(bc.context.tags || []);
        } else if (bc.schema_name === 'note.summary.v1') {
          setSummary(bc.context.summary || '');
        } else if (bc.schema_name === 'note.insights.v1') {
          setInsights(bc.context.insights || []);
        } else if (bc.schema_name === 'note.eli5.v1') {
          setEli5(bc.context.eli5 || '');
        }
      });
    } catch (error) {
      console.error('[NoteDetail] Failed to load related breadcrumbs:', error);
    } finally {
      setLoadingRelated(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this note?')) return;

    try {
      await client.deleteBreadcrumb(noteId);
      onBack();
    } catch (error) {
      console.error('[NoteDetail] Failed to delete:', error);
      alert('Failed to delete note');
    }
  };

  const handleOpenInDashboard = () => {
    const url = `http://localhost:8082?selected=${noteId}&focus=true`;
    chrome.tabs.create({ url });
  };

  const handleSendToChat = () => {
    // Send note to chat (implement in ChatPanel)
    chrome.runtime.sendMessage({
      type: 'ADD_NOTE_TO_CHAT',
      noteId,
      noteTitle: note?.title
    });
    // Switch to chat tab
    chrome.runtime.sendMessage({ type: 'SWITCH_TO_CHAT_TAB' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  if (!note) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4">
        <p className="text-gray-500 mb-4">Note not found</p>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
        >
          Back to Notes
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 bg-gray-800 border-b border-gray-700">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-3 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back</span>
        </button>

        <h2 className="text-lg font-bold text-white mb-2">{note.title}</h2>

        <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
          <div className="flex items-center gap-1">
            <ExternalLink className="w-3 h-3" />
            <a
              href={note.context.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-blue-400 truncate max-w-[200px]"
            >
              {note.context.domain}
            </a>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{formatDate(note.created_at)}</span>
          </div>
        </div>

        {/* Tags */}
        {tags.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {tags.map(tag => (
              <span
                key={tag}
                className="px-2 py-1 text-xs bg-blue-600 text-white rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : loadingRelated ? (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Loader className="w-3 h-3 animate-spin" />
            <span>Generating tags...</span>
          </div>
        ) : null}
      </div>

      {/* Tab Navigation */}
      <nav className="flex border-b border-gray-700 bg-gray-800">
        <TabButton
          active={activeTab === 'content'}
          onClick={() => setActiveTab('content')}
          label="Content"
        />
        {note?.schema_name === 'note.v1' && (
          <>
            <TabButton
              active={activeTab === 'summary'}
              onClick={() => setActiveTab('summary')}
              label="Summary"
            />
            <TabButton
              active={activeTab === 'insights'}
              onClick={() => setActiveTab('insights')}
              label="Insights"
            />
            <TabButton
              active={activeTab === 'eli5'}
              onClick={() => setActiveTab('eli5')}
              label="ELI5"
            />
          </>
        )}
        {note?.schema_name === 'agent.context.v1' && (
          <TabButton
            active={activeTab === 'context'}
            onClick={() => setActiveTab('context')}
            label="LLM Context"
            icon={<Brain className="w-4 h-4" />}
          />
        )}
        <TabButton
          active={activeTab === 'raw'}
          onClick={() => setActiveTab('raw')}
          label="Raw"
        />
      </nav>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'content' && (
          <div 
            className="markdown-content"
            dangerouslySetInnerHTML={{ __html: markdownToHtml(note.context.content) }}
          />
        )}

        {activeTab === 'summary' && (
          <div className="prose dark:prose-invert">
            {summary ? (
              <p className="text-gray-300">{summary}</p>
            ) : loadingRelated ? (
              <div className="flex items-center gap-2 text-gray-500">
                <Loader className="w-4 h-4 animate-spin" />
                <span>Generating summary...</span>
              </div>
            ) : (
              <p className="text-gray-500">No summary available</p>
            )}
          </div>
        )}

        {activeTab === 'insights' && (
          <div>
            {insights.length > 0 ? (
              <ul className="space-y-3">
                {insights.map((insight, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="text-blue-400 font-bold">•</span>
                    <span className="text-gray-300">{insight}</span>
                  </li>
                ))}
              </ul>
            ) : loadingRelated ? (
              <div className="flex items-center gap-2 text-gray-500">
                <Loader className="w-4 h-4 animate-spin" />
                <span>Extracting insights...</span>
              </div>
            ) : (
              <p className="text-gray-500">No insights available</p>
            )}
          </div>
        )}

        {activeTab === 'eli5' && (
          <div className="prose dark:prose-invert">
            {eli5 ? (
              <p className="text-gray-300 text-lg leading-relaxed">{eli5}</p>
            ) : loadingRelated ? (
              <div className="flex items-center gap-2 text-gray-500">
                <Loader className="w-4 h-4 animate-spin" />
                <span>Creating simple explanation...</span>
              </div>
            ) : (
              <p className="text-gray-500">No ELI5 explanation available</p>
            )}
          </div>
        )}

        {activeTab === 'context' && note?.schema_name === 'agent.context.v1' && (
          <ContextViewer breadcrumb={note} />
        )}

        {activeTab === 'raw' && (
          <pre className="text-xs text-gray-400 bg-gray-800 p-4 rounded-lg overflow-x-auto">
            {JSON.stringify(note, null, 2)}
          </pre>
        )}
      </div>

      {/* Actions Footer */}
      <div className="p-4 bg-gray-800 border-t border-gray-700 space-y-2">
        <button
          onClick={handleSendToChat}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Share2 className="w-4 h-4" />
          <span>Send to Chat</span>
        </button>

        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={handleOpenInDashboard}
            className="flex items-center justify-center gap-1 px-3 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors text-sm"
          >
            <Search className="w-3 h-3" />
            <span>Dashboard</span>
          </button>

          <button
            onClick={() => {/* TODO: Export */}}
            className="flex items-center justify-center gap-1 px-3 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors text-sm"
          >
            <Download className="w-3 h-3" />
            <span>Export</span>
          </button>

          <button
            onClick={handleDelete}
            className="flex items-center justify-center gap-1 px-3 py-2 bg-red-900/30 text-red-400 rounded-lg hover:bg-red-900/50 transition-colors text-sm"
          >
            <Trash2 className="w-3 h-3" />
            <span>Delete</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, label, icon }: { 
  active: boolean; 
  onClick: () => void; 
  label: string;
  icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 px-4 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
        active
          ? 'bg-gray-900 text-blue-400 border-b-2 border-blue-500'
          : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

