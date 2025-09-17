import React, { Suspense, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, Grid } from '@react-three/drei';
import { motion, AnimatePresence } from 'framer-motion';
import { Scene3D } from './Scene3D';
import { Scene3DControls } from '../panels/Scene3DControls';
import { use3DConfig } from '../../hooks/use3DConfig';

export function Canvas3D() {
  const { config, updateConfig, cleanupDuplicates, isLoading, isSaving, lastSaved } = use3DConfig();
  const [showControls, setShowControls] = useState(false); // Hidden by default
  
  // Debug logging when config changes
  React.useEffect(() => {
    console.log('🎛️ 3D Config updated:', config);
  }, [config]);
  return (
    <div className="canvas-3d w-full h-full relative">
      <Canvas
        camera={{ 
          position: [0, 0, 500], 
          fov: 75,
          near: 0.1,
          far: 2000 
        }}
        gl={{ 
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
          clearColor: 0x000000,
        }}
        style={{ background: '#000000' }}
      >
        {/* Lighting */}
        <ambientLight intensity={0.4} />
        <pointLight position={[10, 10, 10]} intensity={0.8} />
        <pointLight position={[-10, -10, -10]} intensity={0.3} color="#00f5ff" />
        
        {/* Black void background - no environment or grid for clean look */}
        
        {/* Controls */}
        <OrbitControls 
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={50}
          maxDistance={1000}
          maxPolarAngle={Math.PI}
        />
        
        {/* 3D Scene Content */}
        <Suspense fallback={null}>
          <Scene3D config={config} />
        </Suspense>
      </Canvas>
      
      {/* 3D Controls Panel (like left panel) */}
      <motion.div
        className="absolute top-0 right-0 bg-black/20 backdrop-blur-md border-l border-white/10 flex flex-col h-full"
        animate={{ 
          width: showControls ? 350 : 60,
          minWidth: showControls ? 300 : 60,
        }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
      >
        {/* Panel Header */}
        <div className="panel-header p-4 border-b border-white/10">
          <div className="flex items-center justify-between">
            <AnimatePresence mode="wait">
              {showControls && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-white">🎛️ 3D Controls</h2>
                    {isLoading && <span className="text-blue-400 text-xs">Loading...</span>}
                    {isSaving && <span className="text-yellow-400 text-xs">💾 Saving...</span>}
                  </div>
                  <p className="text-xs text-gray-400">Configure 3D visualization</p>
                </motion.div>
              )}
            </AnimatePresence>
            
            <motion.button
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white"
              onClick={() => setShowControls(!showControls)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <motion.span
                animate={{ rotate: showControls ? 0 : 180 }}
                transition={{ duration: 0.3 }}
              >
                ▶
              </motion.span>
            </motion.button>
          </div>
        </div>
        
        {/* Panel Content */}
        <div className="panel-content flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            {showControls && (
              <motion.div
                className="h-full"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <Scene3DControls 
                  config={config} 
                  onChange={updateConfig}
                  onCleanup={cleanupDuplicates}
                  isLoading={isLoading}
                  isSaving={isSaving}
                />
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Collapsed State */}
          <AnimatePresence>
            {!showControls && (
              <motion.div
                className="p-2 space-y-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, delay: 0.1 }}
              >
                <motion.button
                  className="w-full p-3 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                  onClick={() => setShowControls(true)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  title="Show 3D Controls"
                >
                  <div className="text-xl">🎛️</div>
                  <div className="text-xs mt-1">3D</div>
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
      
      {/* 3D Info */}
      <div className="absolute bottom-4 left-4 text-xs text-gray-400 font-mono bg-black/30 backdrop-blur-md rounded-lg px-3 py-2">
        <div className="flex items-center gap-2">
          <span>🎲 3D View Active</span>
          {isSaving && <span className="text-yellow-400">💾 Saving...</span>}
          {lastSaved && <span className="text-green-400">✅ Saved</span>}
        </div>
        <div>Mouse: Orbit • Wheel: Zoom • Right-click: Pan</div>
        <div>Config: {isLoading ? 'Loading...' : 'Loaded from breadcrumbs'}</div>
      </div>
    </div>
  );
}

function ControlButton({ icon, label, onClick }: {
  icon: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      className="flex items-center gap-2 px-3 py-2 bg-black/30 backdrop-blur-md rounded-lg border border-white/10 text-white/80 hover:text-white text-sm"
      onClick={onClick}
      whileHover={{ scale: 1.05, backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      whileTap={{ scale: 0.95 }}
      title={label}
    >
      <span>{icon}</span>
      <span className="hidden lg:inline">{label}</span>
    </motion.button>
  );
}
