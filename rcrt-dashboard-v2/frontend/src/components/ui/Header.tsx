import React from 'react';
import { motion } from 'framer-motion';
import { useEventStream, useNodes, useConnections } from '../../stores/DashboardStore';

export function Header() {
  const eventStream = useEventStream();
  const nodes = useNodes();
  const connections = useConnections();
  
  const stats = {
    nodes: nodes.length,
    connections: connections.length,
    events: eventStream.eventCount,
  };
  
  return (
    <motion.header 
      className="header bg-black/20 backdrop-blur-md border-b border-white/10 px-6 py-4 flex items-center justify-between"
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      {/* Logo */}
      <motion.div 
        className="flex items-center gap-3"
        whileHover={{ scale: 1.02 }}
      >
        <div className="text-2xl font-bold bg-gradient-to-r from-rcrt-primary to-rcrt-secondary bg-clip-text text-transparent">
          RCRT Dashboard v2
        </div>
        <div className="text-xs text-gray-400 font-mono">
          Self-Configuring • Real-Time
        </div>
      </motion.div>
      
      {/* Stats */}
      <div className="flex items-center gap-6">
        <StatItem 
          icon="📋" 
          label="Nodes" 
          value={stats.nodes} 
          color="text-rcrt-accent"
        />
        <StatItem 
          icon="🔗" 
          label="Connections" 
          value={stats.connections} 
          color="text-rcrt-primary"
        />
        <StatItem 
          icon="📡" 
          label="Events" 
          value={stats.events} 
          color="text-rcrt-secondary"
        />
        
        {/* Connection Status */}
        <div className="flex items-center gap-2">
          <motion.div
            className={`w-2 h-2 rounded-full ${
              eventStream.connected ? 'bg-green-400' : 'bg-red-400'
            }`}
            animate={eventStream.connected ? { scale: [1, 1.2, 1] } : {}}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <span className="text-xs text-gray-400">
            {eventStream.connected ? 'Live' : 'Disconnected'}
          </span>
        </div>
      </div>
      
      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        <ActionButton 
          icon="🔄" 
          label="Refresh" 
          onClick={() => window.location.reload()}
        />
        <ActionButton 
          icon="⚙️" 
          label="Settings" 
          onClick={() => console.log('Settings clicked')}
        />
        <ActionButton 
          icon="🧹" 
          label="Cleanup" 
          onClick={() => console.log('Cleanup clicked')}
        />
      </div>
    </motion.header>
  );
}

function StatItem({ icon, label, value, color }: {
  icon: string;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <motion.div 
      className="flex items-center gap-2"
      whileHover={{ scale: 1.05 }}
    >
      <span className="text-lg">{icon}</span>
      <div className="flex flex-col">
        <span className={`text-sm font-bold ${color}`}>
          {value.toLocaleString()}
        </span>
        <span className="text-xs text-gray-500">{label}</span>
      </div>
    </motion.div>
  );
}

function ActionButton({ icon, label, onClick }: {
  icon: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-gray-300 hover:text-white transition-colors"
      onClick={onClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <span>{icon}</span>
      <span className="hidden sm:inline">{label}</span>
    </motion.button>
  );
}
