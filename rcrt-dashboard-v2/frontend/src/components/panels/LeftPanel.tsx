import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNodes, useSelectedNodes, useDashboard } from '../../stores/DashboardStore';
import { FilterPanel } from './FilterPanel';
import { CreatePanel } from './CreatePanel';
import { DetailsPanel } from './DetailsPanel';

export function LeftPanel() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'filters' | 'create' | 'details'>('filters');
  
  const nodes = useNodes();
  const selectedNodes = useSelectedNodes();
  
  // Auto-switch to details when node is selected
  React.useEffect(() => {
    if (selectedNodes.length > 0 && activeTab !== 'details') {
      setActiveTab('details');
    }
  }, [selectedNodes.length, activeTab]);
  
  const tabs = [
    { id: 'filters', label: 'Filters', icon: '🔍', count: nodes.filter(n => !n.state.filtered).length },
    { id: 'create', label: 'Create', icon: '➕', count: null },
    { id: 'details', label: 'Details', icon: '📋', count: selectedNodes.length > 0 ? selectedNodes.length : null },
  ];
  
  return (
    <motion.div
      className="left-panel bg-black/20 backdrop-blur-md border-r border-white/10 flex flex-col"
      animate={{ 
        width: isCollapsed ? 60 : 350,
        minWidth: isCollapsed ? 60 : 300,
      }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
    >
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
