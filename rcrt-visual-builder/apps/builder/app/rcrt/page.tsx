'use client';

import React, { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { RcrtClientEnhanced } from '@rcrt-builder/sdk';

const BuilderPalette = dynamic(
  () => import('@rcrt-builder/heroui-breadcrumbs/src/custom/BuilderPalette').then(m => m.BuilderPalette),
  { ssr: false }
);

export default function BuilderPage() {
  const client = useMemo(() => new RcrtClientEnhanced('/api/rcrt'), []);
  const workspace = 'workspace:demo';
  return (
    <div className="min-h-screen bg-content">
      <div className="container mx-auto p-6">
        <h1 className="text-2xl font-semibold mb-4">Builder Palette</h1>
        <p className="text-default-500 mb-4">Templates are loaded from workspace:builder and assets are used for previews. Click Add to create an instance in {workspace}.</p>
        <BuilderPalette workspace={workspace} rcrtClient={client} />
      </div>
    </div>
  );
}


