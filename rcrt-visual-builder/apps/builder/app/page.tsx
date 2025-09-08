import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 bg-gradient-to-br from-background to-content1">
      <div className="max-w-4xl w-full">
        <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          RCRT Visual Builder
        </h1>
        <p className="text-xl text-default-600 mb-12">
          Dynamic UI System powered by HeroUI and RCRT Breadcrumbs
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Demo Page */}
          <Link href="/demo" className="group">
            <div className="p-6 rounded-xl border border-divider bg-content1/50 backdrop-blur hover:bg-content2/50 transition-all hover:shadow-lg">
              <div className="text-3xl mb-3">🚀</div>
              <h2 className="text-2xl font-semibold mb-2 group-hover:text-primary transition-colors">
                Quick Demo
              </h2>
              <p className="text-default-500">
                Experience the UI Forge system with a simple demo showing how breadcrumbs 
                dynamically render HeroUI components.
              </p>
            </div>
          </Link>

          {/* Showcase Page */}
          <Link href="/showcase" className="group">
            <div className="p-6 rounded-xl border border-divider bg-content1/50 backdrop-blur hover:bg-content2/50 transition-all hover:shadow-lg">
              <div className="text-3xl mb-3">🎨</div>
              <h2 className="text-2xl font-semibold mb-2 group-hover:text-primary transition-colors">
                Component Showcase
              </h2>
              <p className="text-default-500">
                Explore 70+ HeroUI components including forms, displays, navigation, 
                overlays, and data visualization.
              </p>
            </div>
          </Link>

          {/* Builder Palette Demo */}
          <Link href="/builder" className="group">
            <div className="p-6 rounded-xl border border-divider bg-content1/50 backdrop-blur hover:bg-content2/50 transition-all hover:shadow-lg">
              <div className="text-3xl mb-3">🔨</div>
              <h2 className="text-2xl font-semibold mb-2 group-hover:text-primary transition-colors">
                Builder Palette
              </h2>
              <p className="text-default-500">
                Browse seeded templates and add instances into a workspace.
              </p>
            </div>
          </Link>

          {/* Workflows (Coming Soon) */}
          <div className="opacity-60 cursor-not-allowed">
            <div className="p-6 rounded-xl border border-divider bg-content1/30">
              <div className="text-3xl mb-3">⚡</div>
              <h2 className="text-2xl font-semibold mb-2">
                Workflow Editor
              </h2>
              <p className="text-default-400">
                Design and execute complex workflows with agents and flows.
                <span className="block mt-2 text-sm text-warning">Coming soon...</span>
              </p>
            </div>
          </div>
        </div>

        <div className="mt-12 p-6 rounded-xl bg-content2/30 border border-divider">
          <h3 className="text-lg font-semibold mb-3">✨ Key Features</h3>
          <ul className="space-y-2 text-default-600">
            <li className="flex items-start gap-2">
              <span className="text-success mt-1">✓</span>
              <span><strong>210+ HeroUI Components</strong> - Beautiful, accessible React components</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-success mt-1">✓</span>
              <span><strong>Dynamic UI Rendering</strong> - Components defined as breadcrumbs, rendered in real-time</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-success mt-1">✓</span>
              <span><strong>Event Bindings</strong> - Components can emit breadcrumbs, update state, call APIs</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-success mt-1">✓</span>
              <span><strong>Theme & Styling</strong> - Dynamic theming through breadcrumb configuration</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-success mt-1">✓</span>
              <span><strong>No Fallbacks</strong> - Strict validation ensures UI integrity</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}