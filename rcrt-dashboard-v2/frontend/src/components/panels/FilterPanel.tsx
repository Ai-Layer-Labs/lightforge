import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDashboard, useNodes } from '../../stores/DashboardStore';

export function FilterPanel() {
  const { applyFilter, clearFilters } = useDashboard();
  const nodes = useNodes();
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [searchText, setSearchText] = useState('');
  
  // Extract all available tags from nodes (same as v1 approach)
  const allTags = React.useMemo(() => {
    const tagSet = new Set<string>();
    nodes.forEach(node => {
      node.metadata.tags.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [nodes]);
  
  // Apply filters when selection changes (same logic as v1)
  useEffect(() => {
    const filterFn = (node: any) => {
      // Text filter
      const matchesText = !searchText || 
        node.metadata.title.toLowerCase().includes(searchText.toLowerCase()) ||
        node.metadata.subtitle?.toLowerCase().includes(searchText.toLowerCase());
      
      // Tag filter (same logic as v1: ALL selected tags must be present)
      const matchesTags = selectedTags.length === 0 || 
        selectedTags.every(filterTag => node.metadata.tags.includes(filterTag));
      
      return matchesText && matchesTags;
    };
    
    applyFilter('main', filterFn);
  }, [selectedTags, searchText, applyFilter]);
  
  // Toggle tag filter (same as v1 toggleTagFilter function)
  const toggleTag = (tag: string) => {
    setSelectedTags(prev => {
      const index = prev.indexOf(tag);
      if (index === -1) {
        return [...prev, tag];
      } else {
        return prev.filter(t => t !== tag);
      }
    });
  };
  
  const clearAllFilters = () => {
    setSelectedTags([]);
    setSearchText('');
    clearFilters();
  };
  
  const filteredCount = nodes.filter(n => !n.state.filtered).length;
  const totalCount = nodes.length;
  
  return (
    <motion.div
      className="filter-panel p-4 h-full overflow-y-auto scrollbar-thin"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">🔍 Filter by Tags</h3>
        <span className="text-sm text-gray-400">
          {filteredCount} of {totalCount}
        </span>
      </div>
      
      {/* Search Input */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search nodes..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="w-full px-3 py-2 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-blue-400 focus:outline-none transition-colors"
        />
      </div>
      
      {/* Clear Filters Button */}
      {(selectedTags.length > 0 || searchText) && (
        <motion.button
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={clearAllFilters}
          className="w-full mb-4 px-3 py-2 bg-red-500/20 border border-red-400/50 rounded-lg text-red-300 hover:bg-red-500/30 transition-colors text-sm"
        >
          Clear All Filters
        </motion.button>
      )}
      
      {/* Tag Filter Chips (same style as v1) */}
      <div className="tag-filters flex flex-wrap gap-2 max-h-64 overflow-y-auto scrollbar-thin">
        <AnimatePresence>
          {allTags.map(tag => (
            <motion.button
              key={tag}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={() => toggleTag(tag)}
              className={`tag-filter-chip px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border ${
                selectedTags.includes(tag)
                  ? 'bg-blue-500/30 border-blue-400/60 text-blue-200 shadow-lg shadow-blue-500/20'
                  : 'bg-gray-700/50 border-gray-600/50 text-gray-300 hover:bg-gray-600/50 hover:border-gray-500/60'
              }`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              title={tag}
            >
              {tag.includes(':') ? tag.split(':')[1] || tag.split(':')[0] : tag}
            </motion.button>
          ))}
        </AnimatePresence>
      </div>
      
      {/* Active Filter Summary */}
      {selectedTags.length > 0 && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-4 p-3 bg-blue-500/10 border border-blue-400/30 rounded-lg"
        >
          <div className="text-xs text-blue-300 font-medium mb-1">
            Active Filters ({selectedTags.length}):
          </div>
          <div className="text-xs text-gray-300">
            {selectedTags.join(', ')}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}