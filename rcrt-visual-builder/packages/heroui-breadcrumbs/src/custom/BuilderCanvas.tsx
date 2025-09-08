'use client';

import React from 'react';
import { RcrtClientEnhanced } from '@rcrt-builder/sdk';

type NodeSummary = {
  id: string;
  title: string;
  tags: string[];
  context: any;
};

export interface BuilderCanvasProps {
  workspace: string;
  rcrtClient: RcrtClientEnhanced;
  className?: string;
}

export const BuilderCanvas: React.FC<BuilderCanvasProps> = ({ workspace, rcrtClient, className }) => {
  // Minimal placeholder until full canvas is implemented
  return (
    <div className={className} data-builder-canvas>
      <div style={{ padding: 8, fontSize: 12, opacity: 0.8 }}>Canvas – drag nodes here (WIP)</div>
    </div>
  );
};


