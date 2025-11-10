import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNodes, useSelectedNodes, useDashboard } from '../../stores/DashboardStore';
import { FilterPanel } from './FilterPanel';
import { CreatePanel } from './CreatePanel';
import { DetailsPanel } from './DetailsPanel';
import { SettingsPanel } from './SettingsPanel';

export function LeftPanel() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'filters' | 'create' | 'details' | 'settings'>('filters');
  const [panelWidth, setPanelWidth] = useState(350);
  const [isResizing, setIsResizing] = useState(false);
  
  const nodes = useNodes();
  const selectedNodes = useSelectedNodes();
  
  // Handle resize
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    
    const startX = e.clientX;
    const startWidth = panelWidth;
    
    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - startX;
      const newWidth = Math.max(250, Math.min(600, startWidth + diff));
      setPanelWidth(newWidth);
    };
    
    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };
  
  // Auto-switch tabs based on what's selected
  React.useEffect(() => {
    if (selectedNodes.length > 0) {
      const node = selectedNodes[0];
      
      // All nodes → open Details
      if (activeTab !== 'details') {
        setActiveTab('details');
      }
    }
  }, [selectedNodes.length, selectedNodes]);
  
  // Dynamically organize tabs based on state
  const tabs = React.useMemo(() => {
    const allTabs = [
      { 
        id: 'filters', 
        label: 'Filters', 
        icon: '🔍', 
        count: nodes.filter(n => !n.state.filtered).length,
        priority: selectedNodes.length > 0 ? 2 : 1  // Lower priority when something selected
      },
      { 
        id: 'create', 
        label: 'Create', 
        icon: '➕', 
        count: null,
        priority: 3  // Always available
      },
      { 
        id: 'agents', 
        label: 'Agents', 
        icon: '🤖', 
        count: null,
        priority: 3  // Always available
      },
      { 
        id: 'settings', 
        label: 'Settings', 
        icon: '⚙️', 
        count: null,
        priority: 4  // Always available
      },
      { 
        id: 'details', 
        label: 'Details', 
        icon: '📋', 
        count: selectedNodes.length,
        priority: selectedNodes.length > 0 ? 1 : 5,  // Highest priority when something selected
        hidden: selectedNodes.length === 0  // Hide when nothing selected
      },
    ];
    
    // Filter out hidden tabs and sort by priority
    return allTabs
      .filter(tab => !tab.hidden)
      .sort((a, b) => a.priority - b.priority);
  }, [nodes, selectedNodes]);
  
  return (
    <motion.div
      className="left-panel bg-black/20 backdrop-blur-md border-r border-white/10 flex flex-col relative"
      style={{ 
        width: isCollapsed ? 60 : panelWidth,
        minWidth: isCollapsed ? 60 : 250,
        maxWidth: isCollapsed ? 60 : 600,
      }}
    >
      {/* Resize Handle */}
      {!isCollapsed && (
        <div
          className={`absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500/50 transition-colors z-10 ${
            isResizing ? 'bg-blue-500' : 'bg-transparent'
          }`}
          onMouseDown={handleMouseDown}
          style={{ touchAction: 'none' }}
        />
      )}
      {/* Panel Header */}
      <div className="panel-header p-4 border-b border-white/10">
        <div className="flex items-center justify-between">
          <AnimatePresence mode="wait">
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <h2 className="text-lg font-semibold text-white">Control Panel</h2>
                <p className="text-xs text-gray-400">Manage your RCRT ecosystem</p>
              </motion.div>
            )}
          </AnimatePresence>
          
          <motion.button
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white"
            onClick={() => setIsCollapsed(!isCollapsed)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <motion.span
              animate={{ rotate: isCollapsed ? 180 : 0 }}
              transition={{ duration: 0.3 }}
            >
              ◀
            </motion.span>
          </motion.button>
        </div>
        
        {/* Tabs */}
        <AnimatePresence mode="wait">
          {!isCollapsed && (
            <motion.div
              className="flex gap-1 mt-4"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2, delay: 0.1 }}
            >
              {tabs.map(tab => (
                <TabButton
                  key={tab.id}
                  tab={tab}
                  isActive={activeTab === tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Panel Content */}
      <div className="panel-content flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {!isCollapsed && (
            <motion.div
              key={activeTab}
              className="h-full"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {activeTab === 'filters' && <FilterPanel />}
              {activeTab === 'create' && <CreatePanel />}
              {activeTab === 'settings' && <SettingsPanel />}
              {activeTab === 'details' && <DetailsPanel />}
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Collapsed State */}
        <AnimatePresence>
          {isCollapsed && (
            <motion.div
              className="p-2 space-y-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, delay: 0.1 }}
            >
              {tabs.map(tab => (
                <motion.button
                  key={tab.id}
                  className={`w-full p-2 rounded-lg border transition-colors ${
                    activeTab === tab.id 
                      ? 'bg-rcrt-primary/20 border-rcrt-primary/40 text-rcrt-primary' 
                      : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10'
                  }`}
                  onClick={() => {
                    setActiveTab(tab.id as any);
                    setIsCollapsed(false);
                  }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  title={tab.label}
                >
                  <div className="text-lg">{tab.icon}</div>
                  {tab.count !== null && (
                    <div className="text-xs mt-1">{tab.count}</div>
                  )}
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function TabButton({ tab, isActive, onClick }: {
  tab: { id: string; label: string; icon: string; count: number | null };
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        isActive 
          ? 'bg-rcrt-primary/20 text-rcrt-primary border border-rcrt-primary/40' 
          : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 border border-transparent'
      }`}
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      data-tour={tab.id === 'create' ? 'create-button' : undefined}
    >
      <span>{tab.icon}</span>
      <span>{tab.label}</span>
      {tab.count !== null && (
        <motion.span 
          className={`text-xs px-1.5 py-0.5 rounded-full ${
            isActive ? 'bg-rcrt-primary/30' : 'bg-white/10'
          }`}
          key={tab.count} // Re-animate when count changes
          initial={{ scale: 1.2 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 25 }}
        >
          {tab.count}
        </motion.span>
      )}
    </motion.button>
  );
}
