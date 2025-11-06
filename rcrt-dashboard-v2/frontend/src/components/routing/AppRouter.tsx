import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DynamicPageLoader } from './DynamicPageLoader';
import { Dashboard } from '../Dashboard';

/**
 * AppRouter manages all routes in the RCRT Dashboard
 * Routes:
 * - / -> Redirects to /dashboard (default)
 * - /dashboard -> Main dashboard view (hardcoded for now)
 * - /quick-start -> Dynamic Quick Start wizard (loaded from breadcrumb)
 * - /:pageName -> Dynamic page loader (loads ui.page.v1 or page.layout.v1 breadcrumbs)
 * 
 * NOTE: All pages except /dashboard are fully dynamic from breadcrumbs!
 * The /quick-start page is loaded from bootstrap-breadcrumbs/pages/quick-start-wizard.json
 * Users can manually navigate to /quick-start anytime to set up providers
 */
export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Root redirect to dashboard */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* Main dashboard - still hardcoded (could be converted to breadcrumb later) */}
        <Route path="/dashboard" element={<Dashboard />} />

        {/* Dynamic page loader - handles ALL other routes including /quick-start */}
        <Route path="/:pageName" element={<DynamicPageLoader />} />

        {/* Fallback - redirect to dashboard */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

