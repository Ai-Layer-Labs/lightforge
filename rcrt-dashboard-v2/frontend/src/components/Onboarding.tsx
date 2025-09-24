import React, { useState, useEffect } from 'react';
import Joyride, { Step, CallBackProps, STATUS, EVENTS } from 'react-joyride';
import { motion, AnimatePresence } from 'framer-motion';
import { useNodes, useSelectedNodes, useDashboardStore } from '../stores/DashboardStore';

interface OnboardingProps {
  onComplete?: () => void;
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const nodes = useNodes();
  const selectedNodes = useSelectedNodes();
  const selectNode = useDashboardStore((state) => state.selectNode);
  
  // Check if onboarding should run
  useEffect(() => {
    const checkFirstRun = async () => {
      try {
        // Check if user has already completed onboarding
        if (localStorage.getItem('rcrt-onboarding-complete') === 'true') {
          return;
        }
        
        // Check if OPENROUTER_API_KEY secret exists
        const hasOpenRouterKey = nodes.some(node => 
          node.type === 'secret' && 
          (node.metadata.title === 'OPENROUTER_API_KEY' || node.metadata.title?.toLowerCase().includes('openrouter'))
        );
        
        // Check if openrouter tool is configured
        const openRouterTool = nodes.find(node => 
          node.type === 'tool' && node.data?.id === 'openrouter'
        );
        
        // Only run onboarding if OpenRouter isn't set up
        if (!hasOpenRouterKey && openRouterTool) {
          setTimeout(() => setRun(true), 1000);
        }
      } catch (error) {
        console.error('Error checking first run status:', error);
      }
    };
    
    checkFirstRun();
  }, [nodes]);

  const steps: Step[] = [
    {
      target: 'body',
      content: (
        <div className="text-center p-4">
          <h2 className="text-2xl font-bold mb-4 text-rcrt-primary">Welcome to RCRT Dashboard v2! 🚀</h2>
          <p className="mb-4">Let's set up your OpenRouter API key so you can use AI-powered features.</p>
          <p className="text-sm opacity-75">This quick setup will guide you through the process.</p>
        </div>
      ),
      placement: 'center',
      disableBeacon: true,
    },
    {
      target: '[data-tour="create-button"]',
      content: 'Click the Create button to start adding your OpenRouter API key.',
      placement: 'bottom',
      spotlightClicks: true,
    },
    {
      target: '[data-tour="create-secret"]',
      content: 'Select "Secret" to securely store your API key.',
      placement: 'right',
      spotlightClicks: true,
    },
    {
      target: '[data-tour="secret-name"]',
      content: 'Enter "OPENROUTER_API_KEY" as the secret name. This exact name is important!',
      placement: 'bottom',
      disableBeacon: true,
    },
    {
      target: '[data-tour="secret-value"]',
      content: 'Paste your OpenRouter API key here. You can get one from openrouter.ai/keys',
      placement: 'bottom',
    },
    {
      target: '[data-tour="create-secret-button"]',
      content: 'Click "Create Secret" to save your API key securely.',
      placement: 'top',
      spotlightClicks: true,
    },
    {
      target: '[data-tour="openrouter-tool"]',
      content: 'Great! Now find and click on the "openrouter" tool to configure it.',
      placement: 'bottom',
      spotlightClicks: true,
    },
    {
      target: '[data-tour="configure-tool"]',
      content: 'Click "Configure Tool" to link your API key to the OpenRouter tool.',
      placement: 'left',
      spotlightClicks: true,
    },
    {
      target: '[data-tour="select-secret"]',
      content: 'Select the OPENROUTER_API_KEY secret you just created.',
      placement: 'bottom',
      spotlightClicks: true,
    },
    {
      target: 'body',
      content: (
        <div className="text-center p-4">
          <h2 className="text-2xl font-bold mb-4 text-green-400">Setup Complete! 🎉</h2>
          <p className="mb-4">Your OpenRouter API key is now configured.</p>
          <p className="text-sm opacity-75 mb-4">You can now use AI-powered features in RCRT!</p>
          <div className="mt-4 p-4 bg-purple-500/20 rounded-lg border border-purple-400/40">
            <p className="text-purple-300 font-semibold mb-2">🧩 Next: Install the Browser Extension</p>
            <p className="text-sm text-gray-300">Chat with RCRT directly from your browser!</p>
            <div className="mt-3 p-2 bg-black/30 rounded text-left">
              <p className="text-xs text-gray-300 font-mono">Run: ./install-extension.sh</p>
            </div>
            <p className="text-xs text-gray-400 mt-2">Or manually load extension/dist in Chrome/Edge</p>
          </div>
        </div>
      ),
      placement: 'center',
    }
  ];

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status, type, index, action } = data;
    
    if ([EVENTS.STEP_AFTER, EVENTS.TARGET_NOT_FOUND].includes(type)) {
      setStepIndex(index + (action === 'next' ? 1 : -1));
    }
    
    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
      setRun(false);
      localStorage.setItem('rcrt-onboarding-complete', 'true');
      onComplete?.();
    }
  };

  const joyrideStyles = {
    options: {
      primaryColor: '#00f5ff',
      backgroundColor: '#1a1d2e',
      textColor: '#ffffff',
      overlayColor: 'rgba(0, 0, 0, 0.8)',
      arrowColor: '#1a1d2e',
      width: 380,
      zIndex: 10000,
    },
    buttonNext: {
      backgroundColor: '#00f5ff',
      color: '#1a1d2e',
      fontSize: 14,
      borderRadius: 8,
      padding: '8px 16px',
    },
    buttonBack: {
      color: '#00f5ff',
      fontSize: 14,
    },
    buttonSkip: {
      color: '#888',
      fontSize: 14,
    },
    tooltip: {
      backgroundColor: '#1a1d2e',
      borderRadius: 12,
      padding: 20,
      boxShadow: '0 0 40px rgba(0, 245, 255, 0.3)',
    },
    spotlight: {
      backgroundColor: 'transparent',
      border: '2px solid #00f5ff',
      borderRadius: 8,
    },
  };

  return (
    <>
      <Joyride
        steps={steps}
        run={run}
        stepIndex={stepIndex}
        continuous={true}
        showSkipButton={true}
        showProgress={true}
        styles={joyrideStyles}
        callback={handleJoyrideCallback}
        locale={{
          back: 'Back',
          close: 'Close',
          last: 'Finish',
          next: 'Next',
          skip: 'Skip Setup',
        }}
      />
      
      {/* Welcome Modal for first-time users */}
      <AnimatePresence>
        {run && stepIndex === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center"
            onClick={() => setStepIndex(1)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="glass-dark p-8 rounded-xl max-w-md mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h1 className="text-3xl font-bold text-rcrt-primary mb-4">Welcome to RCRT! 🚀</h1>
              <p className="text-gray-300 mb-6">
                It looks like this is your first time here. Let's get you set up with OpenRouter 
                so you can start using AI-powered features.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setStepIndex(1)}
                  className="flex-1 px-6 py-3 bg-rcrt-primary text-black rounded-lg hover:bg-rcrt-primary/80 transition-colors font-medium"
                >
                  Start Setup
                </button>
                <button
                  onClick={() => {
                    setRun(false);
                    localStorage.setItem('rcrt-onboarding-complete', 'true');
                  }}
                  className="px-6 py-3 text-gray-400 hover:text-white transition-colors"
                >
                  Skip for now
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
