import React from 'react';
import { motion } from 'framer-motion';

interface Scene3DControlsProps {
  config: Scene3DConfig;
  onChange: (config: Scene3DConfig) => void;
}

export interface Scene3DConfig {
  // Sphere positions and base sizes for each category
  breadcrumbs: { x: number; y: number; z: number; baseRadius: number; };
  agents: { x: number; y: number; z: number; baseRadius: number; };
  'agent-definitions': { x: number; y: number; z: number; baseRadius: number; };
  tools: { x: number; y: number; z: number; baseRadius: number; };
  secrets: { x: number; y: number; z: number; baseRadius: number; };
  chat: { x: number; y: number; z: number; baseRadius: number; };
  
  // Sphere layering
  sphereLayerDistance: number;
  minNodeSpacing: number;
  
  // Card appearance
  cardScale: number;
  cardDistance: number;
  
  // Category labels
  labelHeight: number;
  labelSize: number;
  
  // Particles
  particleCount: number;
  particleSpread: number;
  particleOpacity: number;
  particleSize: number;
  
  // Animation
  animationDelay: number;
  animationDuration: number;
  
  // Cluster balls
  showClusterBalls: boolean;
  clusterBallOpacity: number;
  clusterBallWireframe: boolean;
}

export const defaultScene3DConfig: Scene3DConfig = {
  // Sphere positions and base sizes for each category (your optimized defaults)
  breadcrumbs: { x: 0, y: 0, z: 0, baseRadius: 300 },
  agents: { x: 75, y: 100, z: -50, baseRadius: 60 },
  'agent-definitions': { x: -75, y: 100, z: -50, baseRadius: 50 },
  tools: { x: 50, y: 25, z: 100, baseRadius: 40 },
  secrets: { x: 0, y: -100, z: -50, baseRadius: 50 },
  chat: { x: -100, y: -100, z: -50, baseRadius: 55 },
  
  // Sphere layering (your optimized defaults)
  sphereLayerDistance: 50,
  minNodeSpacing: 70,
  
  // Card appearance
  cardScale: 3.0,
  cardDistance: 200,
  
  // Category labels
  labelHeight: 80,
  labelSize: 1.2,
  
  // Particles
  particleCount: 15,
  particleSpread: 120,
  particleOpacity: 0.2,
  particleSize: 0.8,
  
  // Animation
  animationDelay: 0.2,
  animationDuration: 0.3,
  
  // Cluster balls
  showClusterBalls: true,
  clusterBallOpacity: 0.1,
  clusterBallWireframe: true,
};

interface ExtendedScene3DControlsProps extends Scene3DControlsProps {
  isLoading?: boolean;
  isSaving?: boolean;
  onCleanup?: () => void;
}

export function Scene3DControls({ config, onChange, onCleanup, isLoading, isSaving }: ExtendedScene3DControlsProps) {
  const updateConfig = (key: keyof Scene3DConfig, value: number | boolean) => {
    onChange({ ...config, [key]: value });
  };

  const resetToDefaults = () => {
    onChange(defaultScene3DConfig);
  };
  
  const centerAllSpheres = () => {
    const centeredConfig = {
      ...config,
      breadcrumbs: { ...config.breadcrumbs, x: 0, y: 0, z: 0 },
      agents: { ...config.agents, x: -150, y: 100, z: 100 },
      tools: { ...config.tools, x: 150, y: 100, z: 100 },
      secrets: { ...config.secrets, x: 0, y: -150, z: 0 },
      chat: { ...config.chat, x: -100, y: -100, z: -50 },
    };
    onChange(centeredConfig);
  };

  return (
    <motion.div
      className="scene-3d-controls p-4 h-full overflow-y-auto scrollbar-thin bg-gray-900/50 border-l border-gray-700"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Action Buttons */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={centerAllSpheres}
          disabled={isLoading || isSaving}
          className="flex-1 px-3 py-2 bg-green-500/20 border border-green-400/50 rounded text-green-300 text-sm hover:bg-green-500/30 transition-colors disabled:opacity-50"
        >
          🎯 Center
        </button>
        {onCleanup && (
          <button
            onClick={onCleanup}
            disabled={isLoading || isSaving}
            className="flex-1 px-3 py-2 bg-yellow-500/20 border border-yellow-400/50 rounded text-yellow-300 text-sm hover:bg-yellow-500/30 transition-colors disabled:opacity-50"
          >
            🧹 Clean
          </button>
        )}
        <button
          onClick={resetToDefaults}
          disabled={isLoading || isSaving}
          className="flex-1 px-3 py-2 bg-blue-500/20 border border-blue-400/50 rounded text-blue-300 text-sm hover:bg-blue-500/30 transition-colors disabled:opacity-50"
        >
          🔄 Reset
        </button>
      </div>
      
      <div className="space-y-6">
        {/* Breadcrumbs Sphere */}
        <ControlSection title="🌐 Breadcrumbs Sphere">
          <SphereControls
            label="Breadcrumbs"
            sphere={config.breadcrumbs}
            color="#00f5ff"
            onChange={(sphere) => updateConfig('breadcrumbs', sphere)}
          />
        </ControlSection>

        {/* Agents Sphere */}
        <ControlSection title="🤖 Agents Sphere">
          <SphereControls
            label="Agents"
            sphere={config.agents}
            color="#ffa500"
            onChange={(sphere) => updateConfig('agents', sphere)}
          />
        </ControlSection>

        {/* Agent Definitions Sphere */}
        <ControlSection title="🧠 Agent Definitions Sphere">
          <SphereControls
            label="Agent Definitions"
            sphere={config['agent-definitions']}
            color="#8a2be2"
            onChange={(sphere) => updateConfig('agent-definitions', sphere)}
          />
        </ControlSection>

        {/* Tools Sphere */}
        <ControlSection title="🛠️ Tools Sphere">
          <SphereControls
            label="Tools"
            sphere={config.tools}
            color="#00ff88"
            onChange={(sphere) => updateConfig('tools', sphere)}
          />
        </ControlSection>

        {/* Secrets Sphere */}
        <ControlSection title="🔐 Secrets Sphere">
          <SphereControls
            label="Secrets"
            sphere={config.secrets}
            color="#ff6b6b"
            onChange={(sphere) => updateConfig('secrets', sphere)}
          />
        </ControlSection>

        {/* Chat Sphere */}
        <ControlSection title="💬 Chat Sphere">
          <SphereControls
            label="Chat"
            sphere={config.chat}
            color="#8a2be2"
            onChange={(sphere) => updateConfig('chat', sphere)}
          />
        </ControlSection>

        {/* Sphere Layering */}
        <ControlSection title="🌐 Sphere Layering">
          <Slider
            label="Layer Distance"
            value={config.sphereLayerDistance}
            min={40}
            max={200}
            step={10}
            onChange={(value) => updateConfig('sphereLayerDistance', value)}
          />
          <Slider
            label="Min Node Spacing"
            value={config.minNodeSpacing}
            min={30}
            max={120}
            step={10}
            onChange={(value) => updateConfig('minNodeSpacing', value)}
          />
        </ControlSection>

        {/* Card Appearance */}
        <ControlSection title="🃏 Card Appearance">
          <Slider
            label="Card Scale"
            value={config.cardScale}
            min={1.0}
            max={6.0}
            step={0.1}
            onChange={(value) => updateConfig('cardScale', value)}
          />
          <Slider
            label="Distance Factor"
            value={config.cardDistance}
            min={50}
            max={500}
            step={25}
            onChange={(value) => updateConfig('cardDistance', value)}
          />
        </ControlSection>

        {/* Category Labels */}
        <ControlSection title="🏷️ Category Labels">
          <Slider
            label="Label Height"
            value={config.labelHeight}
            min={50}
            max={150}
            step={10}
            onChange={(value) => updateConfig('labelHeight', value)}
          />
          <Slider
            label="Label Size"
            value={config.labelSize}
            min={0.5}
            max={2.0}
            step={0.1}
            onChange={(value) => updateConfig('labelSize', value)}
          />
        </ControlSection>

        {/* Particles */}
        <ControlSection title="✨ Particle Effects">
          <Slider
            label="Particle Count"
            value={config.particleCount}
            min={0}
            max={50}
            step={5}
            onChange={(value) => updateConfig('particleCount', value)}
          />
          <Slider
            label="Particle Spread"
            value={config.particleSpread}
            min={50}
            max={300}
            step={10}
            onChange={(value) => updateConfig('particleSpread', value)}
          />
          <Slider
            label="Particle Opacity"
            value={config.particleOpacity}
            min={0.0}
            max={1.0}
            step={0.05}
            onChange={(value) => updateConfig('particleOpacity', value)}
          />
          <Slider
            label="Particle Size"
            value={config.particleSize}
            min={0.1}
            max={3.0}
            step={0.1}
            onChange={(value) => updateConfig('particleSize', value)}
          />
        </ControlSection>

        {/* Animation */}
        <ControlSection title="🎬 Animation">
          <Slider
            label="Animation Delay"
            value={config.animationDelay}
            min={0.0}
            max={1.0}
            step={0.05}
            onChange={(value) => updateConfig('animationDelay', value)}
          />
          <Slider
            label="Animation Duration"
            value={config.animationDuration}
            min={0.1}
            max={2.0}
            step={0.1}
            onChange={(value) => updateConfig('animationDuration', value)}
          />
        </ControlSection>

        {/* Cluster Balls */}
        <ControlSection title="🔮 Cluster Balls">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-gray-400">Show Cluster Balls</label>
            <input
              type="checkbox"
              checked={config.showClusterBalls}
              onChange={(e) => updateConfig('showClusterBalls', e.target.checked)}
              className="rounded border-white/20 bg-white/5 text-blue-400"
            />
          </div>
          <Slider
            label="Ball Opacity"
            value={config.clusterBallOpacity}
            min={0.0}
            max={0.5}
            step={0.01}
            onChange={(value) => updateConfig('clusterBallOpacity', value)}
          />
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-gray-400">Wireframe Mode</label>
            <input
              type="checkbox"
              checked={config.clusterBallWireframe}
              onChange={(e) => updateConfig('clusterBallWireframe', e.target.checked)}
              className="rounded border-white/20 bg-white/5 text-blue-400"
            />
          </div>
        </ControlSection>
      </div>
    </motion.div>
  );
}

function ControlSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="control-section">
      <h4 className="text-sm font-semibold text-gray-300 mb-3">{title}</h4>
      <div className="space-y-3">
        {children}
      </div>
    </div>
  );
}

function SphereControls({ 
  label, 
  sphere, 
  color, 
  onChange 
}: {
  label: string;
  sphere: { x: number; y: number; z: number; baseRadius: number; };
  color: string;
  onChange: (sphere: { x: number; y: number; z: number; baseRadius: number; }) => void;
}) {
  const updateSphere = (key: keyof typeof sphere, value: number) => {
    onChange({ ...sphere, [key]: value });
  };

  return (
    <div className="sphere-controls">
      <div className="grid grid-cols-2 gap-2 mb-3">
        <Slider
          label="X Position"
          value={sphere.x}
          min={-500}
          max={500}
          step={25}
          onChange={(value) => updateSphere('x', value)}
        />
        <Slider
          label="Y Position"
          value={sphere.y}
          min={-500}
          max={500}
          step={25}
          onChange={(value) => updateSphere('y', value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Slider
          label="Z Position"
          value={sphere.z}
          min={-500}
          max={500}
          step={25}
          onChange={(value) => updateSphere('z', value)}
        />
        <Slider
          label="Base Radius"
          value={sphere.baseRadius}
          min={30}
          max={300}
          step={10}
          onChange={(value) => updateSphere('baseRadius', value)}
        />
      </div>
      
      {/* Sphere preview */}
      <div className="mt-2 text-xs text-gray-400 font-mono">
        Pos: ({sphere.x}, {sphere.y}, {sphere.z}) • Base R: {sphere.baseRadius}
      </div>
    </div>
  );
}

function Slider({ 
  label, 
  value, 
  min, 
  max, 
  step, 
  onChange 
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="slider-control">
      <div className="flex justify-between items-center mb-1">
        <label className="text-xs text-gray-400">{label}</label>
        <span className="text-xs text-white font-mono bg-gray-800 px-2 py-0.5 rounded">
          {value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
      />
      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #00f5ff;
          cursor: pointer;
          border: 2px solid #ffffff;
        }
        .slider::-moz-range-thumb {
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #00f5ff;
          cursor: pointer;
          border: 2px solid #ffffff;
        }
      `}</style>
    </div>
  );
}
