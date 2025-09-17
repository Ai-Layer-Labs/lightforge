import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDashboard, useCurrentView, useLoading } from '../stores/DashboardStore';
import { useRealTimeData } from '../hooks/useRealTimeData';
import { useAuthentication } from '../hooks/useAuthentication';
import { Header } from './ui/Header';
import { LeftPanel } from './panels/LeftPanel';
import { Canvas2D } from './canvas/Canvas2D';
import { Canvas3D } from './canvas/Canvas3D';
import { LoadingOverlay } from './ui/LoadingOverlay';

export function Dashboard() {
  const { loadConfiguration, switchView } = useDashboard();
  const currentView = useCurrentView();
  const loading = useLoading();
  const { isAuthenticated, isLoading: authLoading, error: authError } = useAuthentication();
  
  // Initialize real-time data connection
  useRealTimeData();
  
  // Load initial configuration and data
  useEffect(() => {
    const initializeDashboard = async () => {
      console.log('🚀 Initializing RCRT Dashboard v2...');
      
      try {
        // Load configuration from breadcrumbs
        await loadConfiguration();
        
        console.log('✅ Dashboard v2 initialized successfully');
      } catch (error) {
        console.error('❌ Dashboard initialization failed:', error);
      }
    };
    
    initializeDashboard();
  }, [loadConfiguration]);
  
  // Show authentication loading or error states
  if (authLoading) {
    return (
      <div className="dashboard-container w-full h-full flex flex-col bg-gradient-rcrt">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-2 border-rcrt-primary border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-rcrt-primary">🔐 Authenticating with RCRT...</p>
          </div>
        </div>
      </div>
    );
  }
  
  if (authError) {
    return (
      <div className="dashboard-container w-full h-full flex flex-col bg-gradient-rcrt">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-red-400">
            <p className="text-xl mb-2">❌ Authentication Failed</p>
            <p className="text-sm opacity-75">{authError.message}</p>
          </div>
        </div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return (
      <div className="dashboard-container w-full h-full flex flex-col bg-gradient-rcrt">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-yellow-400">
            <p className="text-xl">⏳ Waiting for authentication...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container w-full h-full flex flex-col bg-gradient-rcrt">
      {/* Header */}
      <Header />
      
      {/* Main Content */}
      <div className="main-content flex-1 flex overflow-hidden">
        {/* Left Panel */}
        <LeftPanel />
        
        {/* Canvas Area */}
        <div className="canvas-area flex-1 relative overflow-hidden">
          <AnimatePresence mode="wait">
            {currentView === '2d' ? (
              <motion.div
                key="canvas-2d"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="w-full h-full"
              >
                <Canvas2D />
              </motion.div>
            ) : (
              <motion.div
                key="canvas-3d"
                initial={{ opacity: 0, rotateY: -10 }}
                animate={{ opacity: 1, rotateY: 0 }}
                exit={{ opacity: 0, rotateY: 10 }}
                transition={{ duration: 0.4, ease: "easeInOut" }}
                className="w-full h-full"
              >
                <Canvas3D />
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* View Toggle Button - shifts with 3D controls panel */}
          <motion.button
            className="absolute top-4 z-50 glass-dark rounded-lg px-4 py-2 text-rcrt-primary hover:text-white transition-colors"
            style={{
              right: currentView === '3d' ? '80px' : '16px', // Shift right when 3D controls are visible
            }}
            onClick={() => switchView(currentView === '2d' ? '3d' : '2d')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            animate={{
              right: currentView === '3d' ? '80px' : '16px',
            }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            {currentView === '2d' ? '🎲 Switch to 3D' : '📐 Switch to 2D'}
          </motion.button>
        </div>
      </div>
      
      {/* Loading Overlay */}
      <AnimatePresence>
        {loading.initialLoad && <LoadingOverlay />}
      </AnimatePresence>
    </div>
  );
}
