/**
 * Save Page Component
 * Captures current page and shows real-time processing status
 */

import { useState, useEffect } from 'react';
import { Save, Check, Loader, AlertCircle, ExternalLink } from 'lucide-react';
import type { RCRTClient } from '../lib/rcrt-client';
import type { ProcessingStatus } from '../lib/types';
import { captureCurrentPage } from '../lib/page-capture';

interface SavePageProps {
  client: RCRTClient;
}

export function SavePage({ client }: SavePageProps) {
  const [currentPage, setCurrentPage] = useState<{ title: string; url: string; domain: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<ProcessingStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Get current page info
  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab) {
        setCurrentPage({
          title: tab.title || 'Untitled',
          url: tab.url || '',
          domain: new URL(tab.url || 'about:blank').hostname
        });
      }
    });
  }, []);

  const handleSavePage = async () => {
    if (saving) return;

    setSaving(true);
    setError(null);
    setStatus(null);

    try {
      // 1. Capture page content
      const pageContext = await captureCurrentPage();

      // 2. Create note.v1 breadcrumb
      const note = await client.createBreadcrumb({
        schema_name: 'note.v1',
        title: pageContext.title,
        tags: ['note', 'saved-page', `domain:${pageContext.domain}`],
        context: {
          content: pageContext.content.mainText,
          url: pageContext.url,
          domain: pageContext.domain,
          og_image: pageContext.ogImage,
          headings: pageContext.content.headings,
          links: pageContext.content.links,
          captured_at: new Date().toISOString()
        }
      });

      // 3. Set initial status
      setStatus({
        noteId: note.id,
        breadcrumb: 'complete',
        tags: 'pending',
        summary: 'pending',
        insights: 'pending',
        eli5: 'pending'
      });

      // 4. Subscribe to processing events
      client.subscribeToSSE(
        {
          any_tags: [`note:${note.id}`]
        },
        (event) => {
          // Defensive check for SSE events
          if (!event || !event.breadcrumb) {
            return;
          }

          console.log('[SavePage] Processing event:', event);

          // Update status based on schema
          setStatus(prev => {
            if (!prev) return null;

            const updated = { ...prev };

            if (event.breadcrumb.schema_name === 'note.tags.v1') {
              updated.tags = 'complete';
            } else if (event.breadcrumb.schema_name === 'note.summary.v1') {
              updated.summary = 'complete';
            } else if (event.breadcrumb.schema_name === 'note.insights.v1') {
              updated.insights = 'complete';
            } else if (event.breadcrumb.schema_name === 'note.eli5.v1') {
              updated.eli5 = 'complete';
            }

            return updated;
          });
        }
      );

      setSaving(false);
    } catch (err) {
      console.error('[SavePage] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to save page');
      setSaving(false);
    }
  };

  const StatusIndicator = ({ label, status }: { label: string; status?: 'pending' | 'complete' | 'error' }) => {
    if (!status) return null;

    return (
      <div className="flex items-center justify-between py-2 px-3 bg-gray-800 rounded-lg">
        <span className="text-sm text-gray-300">{label}</span>
        {status === 'pending' && <Loader className="w-4 h-4 text-blue-400 animate-spin" />}
        {status === 'complete' && <Check className="w-4 h-4 text-green-400" />}
        {status === 'error' && <AlertCircle className="w-4 h-4 text-red-400" />}
      </div>
    );
  };

  const allComplete = status && 
    status.tags === 'complete' && 
    status.summary === 'complete' && 
    status.insights === 'complete' && 
    status.eli5 === 'complete';

  return (
    <div className="flex flex-col h-full p-4 space-y-4">
      {/* Current Page Info */}
      {currentPage && (
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h3 className="font-semibold text-white mb-2">Current Page</h3>
          <p className="text-sm text-gray-300 mb-1">{currentPage.title}</p>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <ExternalLink className="w-3 h-3" />
            <span className="truncate">{currentPage.domain}</span>
          </div>
        </div>
      )}

      {/* Save Button */}
      <button
        onClick={handleSavePage}
        disabled={saving || !currentPage}
        className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${
          saving || !currentPage
            ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
            : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}
      >
        <Save className="w-5 h-5" />
        <span>{saving ? 'Saving...' : 'Save Page to RCRT'}</span>
      </button>

      {/* Error Message */}
      {error && (
        <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-400">Error</p>
              <p className="text-xs text-red-300 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Processing Status */}
      {status && (
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 space-y-2">
          <h3 className="font-semibold text-white mb-3">Processing Status</h3>
          
          <StatusIndicator label="Creating breadcrumb" status={status.breadcrumb} />
          <StatusIndicator label="Generating tags" status={status.tags} />
          <StatusIndicator label="Creating summary" status={status.summary} />
          <StatusIndicator label="Extracting insights" status={status.insights} />
          <StatusIndicator label="ELI5 explanation" status={status.eli5} />

          {allComplete && (
            <div className="mt-4 pt-4 border-t border-gray-700">
              <div className="flex items-center gap-2 text-green-400 mb-3">
                <Check className="w-5 h-5" />
                <span className="font-medium">All processing complete!</span>
              </div>
              
              <button
                onClick={() => {
                  chrome.runtime.sendMessage({ type: 'SWITCH_TO_NOTES_TAB' });
                }}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                View in Notes
              </button>
            </div>
          )}
        </div>
      )}

      {/* Info */}
      <div className="text-xs text-gray-500 space-y-1">
        <p>• Notes are saved to RCRT (unlimited storage)</p>
        <p>• 4 agents process notes in parallel</p>
        <p>• Searchable via semantic vector search</p>
        <p>• Accessible across devices</p>
      </div>
    </div>
  );
}

