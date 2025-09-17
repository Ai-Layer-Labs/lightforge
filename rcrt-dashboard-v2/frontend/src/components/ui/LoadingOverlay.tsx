import React from 'react';
import { motion } from 'framer-motion';

export function LoadingOverlay() {
  return (
    <motion.div
      className="loading-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        className="loading-content bg-gray-900/90 backdrop-blur-md rounded-xl p-8 border border-white/10 max-w-md w-full mx-4"
        initial={{ scale: 0.8, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.8, y: 20 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        {/* Loading Header */}
        <div className="text-center mb-6">
          <motion.div
            className="text-4xl mb-2"
            animate={{ 
              rotate: [0, 360],
              scale: [1, 1.1, 1]
            }}
            transition={{ 
              rotate: { duration: 2, repeat: Infinity, ease: "linear" },
              scale: { duration: 1, repeat: Infinity, ease: "easeInOut" }
            }}
          >
            🚀
          </motion.div>
          <h2 className="text-xl font-bold text-rcrt-primary mb-1">
            Initializing RCRT Dashboard v2
          </h2>
          <p className="text-sm text-gray-400">
            Self-configuring from breadcrumbs...
          </p>
        </div>
        
        {/* Loading Steps */}
        <div className="space-y-3">
          <LoadingStep 
            icon="🔗" 
            label="Connecting to RCRT API" 
            completed={true}
          />
          <LoadingStep 
            icon="📋" 
            label="Loading breadcrumbs" 
            loading={true}
          />
          <LoadingStep 
            icon="🤖" 
            label="Loading agents" 
            loading={true}
          />
          <LoadingStep 
            icon="🔐" 
            label="Loading secrets" 
            loading={true}
          />
          <LoadingStep 
            icon="⚙️" 
            label="Reading configuration" 
            pending={true}
          />
          <LoadingStep 
            icon="🔗" 
            label="Discovering connections" 
            pending={true}
          />
          <LoadingStep 
            icon="🎨" 
            label="Initializing visualization" 
            pending={true}
          />
        </div>
        
        {/* Progress Bar */}
        <div className="mt-6">
          <div className="flex justify-between text-xs text-gray-400 mb-2">
            <span>Progress</span>
            <span>30%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <motion.div
              className="bg-gradient-to-r from-rcrt-primary to-rcrt-secondary h-2 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: '30%' }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </div>
        </div>
        
        {/* Loading Tips */}
        <motion.div
          className="mt-4 p-3 bg-rcrt-primary/10 border border-rcrt-primary/20 rounded-lg"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, duration: 0.5 }}
        >
          <div className="text-xs text-rcrt-primary font-medium mb-1">
            💡 Did you know?
          </div>
          <div className="text-xs text-gray-300">
            Dashboard v2 stores its own configuration as RCRT breadcrumbs, 
            making it completely self-configuring and dynamic!
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

function LoadingStep({ 
  icon, 
  label, 
  completed = false, 
  loading = false, 
  pending = false 
}: {
  icon: string;
  label: string;
  completed?: boolean;
  loading?: boolean;
  pending?: boolean;
}) {
  return (
    <motion.div 
      className="flex items-center gap-3"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex-shrink-0">
        {completed && (
          <motion.div
            className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 25 }}
          >
            <span className="text-white text-xs">✓</span>
          </motion.div>
        )}
        
        {loading && (
          <motion.div
            className="w-6 h-6 bg-rcrt-primary rounded-full flex items-center justify-center"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          >
            <span className="text-xs">{icon}</span>
          </motion.div>
        )}
        
        {pending && (
          <div className="w-6 h-6 bg-gray-600 rounded-full flex items-center justify-center">
            <span className="text-gray-400 text-xs">{icon}</span>
          </div>
        )}
      </div>
      
      <span className={`text-sm ${
        completed ? 'text-green-400' : 
        loading ? 'text-rcrt-primary' : 
        'text-gray-400'
      }`}>
        {label}
      </span>
      
      {loading && (
        <motion.div
          className="flex-1 flex justify-end"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <div className="flex gap-1">
            <div className="w-1 h-1 bg-rcrt-primary rounded-full" />
            <div className="w-1 h-1 bg-rcrt-primary rounded-full" />
            <div className="w-1 h-1 bg-rcrt-primary rounded-full" />
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
