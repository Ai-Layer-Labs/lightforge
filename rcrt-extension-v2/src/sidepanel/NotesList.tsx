/**
 * Notes List Component
 * Displays saved notes with semantic search and tag filtering
 */

import { useState, useEffect } from 'react';
import { Search, Clock, ExternalLink, Loader } from 'lucide-react';
import type { RCRTClient } from '../lib/rcrt-client';
import type { Breadcrumb } from '../lib/types';
import { NoteDetail } from './NoteDetail';
import { formatDate, truncateText } from '../lib/text-utils';

interface NotesListProps {
  client: RCRTClient;
}

export function NotesList({ client }: NotesListProps) {
  const [notes, setNotes] = useState<Breadcrumb[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Load notes on mount
  useEffect(() => {
    loadNotes();

    // Subscribe to new notes
    const unsubscribe = client.subscribeToSSE(
      {
        schema_name: 'note.v1'
      },
      (event) => {
        // Defensive check for SSE events
        if (!event || !event.breadcrumb) {
          return;
        }

        if (event.type === 'breadcrumb.created') {
          setNotes(prev => [event.breadcrumb, ...prev]);
        } else if (event.type === 'breadcrumb.updated') {
          setNotes(prev => prev.map(n => n.id === event.breadcrumb.id ? event.breadcrumb : n));
        } else if (event.type === 'breadcrumb.deleted') {
          setNotes(prev => prev.filter(n => n.id !== event.breadcrumb_id));
        }
      }
    );

    return () => {
      unsubscribe.then(fn => fn());
    };
  }, [client]);

  // Extract tags from all notes
  useEffect(() => {
    const tagSet = new Set<string>();
    notes.forEach(note => {
      note.tags.forEach(tag => {
        if (!tag.startsWith('note') && !tag.startsWith('saved-page') && !tag.startsWith('domain:')) {
          tagSet.add(tag);
        }
      });
    });
    setAllTags(Array.from(tagSet).sort());
  }, [notes]);

  const loadNotes = async () => {
    try {
      setLoading(true);
      const results = await client.searchBreadcrumbs({
        schema_name: 'note.v1',
        nn: 100
      });
      setNotes(results);
    } catch (error) {
      console.error('[NotesList] Failed to load notes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);

    if (!query.trim()) {
      await loadNotes();
      return;
    }

    try {
      setLoading(true);
      const results = await client.searchBreadcrumbs({
        q: query,
        schema_name: 'note.v1',
        nn: 20
      });
      setNotes(results);
    } catch (error) {
      console.error('[NotesList] Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterByTag = async (tag: string | null) => {
    setSelectedTag(tag);
    
    if (!tag) {
      await loadNotes();
      return;
    }

    try {
      setLoading(true);
      const results = await client.searchBreadcrumbs({
        schema_name: 'note.v1',
        any_tags: [tag],
        nn: 100
      });
      setNotes(results);
    } catch (error) {
      console.error('[NotesList] Filter failed:', error);
    } finally {
      setLoading(false);
    }
  };

  if (selectedNoteId) {
    return (
      <NoteDetail
        noteId={selectedNoteId}
        client={client}
        onBack={() => setSelectedNoteId(null)}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search Bar */}
      <div className="p-4 bg-gray-800 border-b border-gray-700">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="search"
            placeholder="Search notes... (semantic search)"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Tag Filter */}
        {allTags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => filterByTag(null)}
              className={`px-2 py-1 text-xs rounded-full transition-colors ${
                !selectedTag
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              All
            </button>
            {allTags.slice(0, 10).map(tag => (
              <button
                key={tag}
                onClick={() => filterByTag(tag)}
                className={`px-2 py-1 text-xs rounded-full transition-colors ${
                  selectedTag === tag
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Notes List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader className="w-8 h-8 text-blue-400 animate-spin" />
          </div>
        )}

        {!loading && notes.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">
              {searchQuery || selectedTag ? 'No notes found' : 'No saved notes yet'}
            </p>
            <p className="text-sm text-gray-600 mt-2">
              {!searchQuery && !selectedTag && 'Go to the Save tab to save your first page'}
            </p>
          </div>
        )}

        {!loading && notes.map(note => (
          <button
            key={note.id}
            onClick={() => setSelectedNoteId(note.id)}
            className="w-full text-left bg-gray-800 hover:bg-gray-750 rounded-lg p-4 border border-gray-700 hover:border-gray-600 transition-all slide-in"
          >
            <h3 className="font-semibold text-white mb-2 line-clamp-2">
              {note.title}
            </h3>
            
            {/* Domain and Time */}
            <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
              <div className="flex items-center gap-1">
                <ExternalLink className="w-3 h-3" />
                <span>{note.context.domain}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>{formatDate(note.created_at)}</span>
              </div>
            </div>

            {/* Tags (from breadcrumb, will be enhanced by agent) */}
            {note.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {note.tags
                  .filter(tag => !tag.startsWith('note') && !tag.startsWith('saved-page') && !tag.startsWith('domain:'))
                  .slice(0, 5)
                  .map(tag => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 text-xs bg-gray-700 text-gray-300 rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
              </div>
            )}

            {/* Content Preview */}
            <p className="text-sm text-gray-400 mt-2 line-clamp-2">
              {truncateText(note.context.content, 150)}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

