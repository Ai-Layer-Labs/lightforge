// Puppeteer HeroUI Component Extractor for UI Forge
// Run this with: node extract-heroui-components.js

const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

const HEROUI_COMPONENTS = [
  'accordion', 'alert', 'autocomplete', 'avatar', 'avatar-group', 'badge',
  'breadcrumbs', 'button', 'button-group', 'calendar', 'card', 'checkbox',
  'checkbox-group', 'chip', 'circular-progress', 'code', 'date-input',
  'date-picker', 'date-range-picker', 'divider', 'dropdown', 'drawer',
  'form', 'image', 'input', 'input-otp', 'kbd', 'link', 'listbox', 'modal',
  'navbar', 'number-input', 'pagination', 'popover', 'progress', 'radio-group',
  'range-calendar', 'scroll-shadow', 'select', 'skeleton', 'slider', 'snippet',
  'spacer', 'spinner', 'switch', 'table', 'tabs', 'toast', 'textarea',
  'time-input', 'tooltip', 'user'
];

class HeroUIExtractor {
  constructor() {
    this.browser = null;
    this.page = null;
    this.baseUrl = 'https://storybook.heroui.com';
    this.outputDir = './heroui-extraction';
    this.results = [];
  }

  async initialize() {
    console.log('Launching browser...');
    this.browser = await puppeteer.launch({
      headless: false, // Set to true for production
      defaultViewport: { width: 1920, height: 1080 },
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    this.page = await this.browser.newPage();
    await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    
    // Create output directory
    await fs.mkdir(this.outputDir, { recursive: true });
    await fs.mkdir(path.join(this.outputDir, 'screenshots'), { recursive: true });
    
    console.log('Browser ready!');
  }

  async extractComponent(componentName) {
    console.log(`\n🔄 Extracting ${componentName}...`);
    
    const componentData = {
      name: componentName,
      title: this.toTitleCase(componentName),
      extraction_timestamp: new Date().toISOString(),
      docs: {},
      stories: [],
      props: {},
      defaultProps: {},
      variants: [],
      examples: [],
      screenshots: [],
      errors: []
    };

    try {
      // 1. Extract from Docs page
      await this.extractFromDocs(componentName, componentData);
      
      // 2. Extract from Stories/Canvas
      await this.extractFromStories(componentName, componentData);
      
      // 3. Extract props from Controls
      await this.extractPropsFromControls(componentName, componentData);
      
      // 4. Take screenshots for preview assets
      await this.captureScreenshots(componentName, componentData);
      
      console.log(`✅ ${componentName}: ${componentData.examples.length} examples, ${Object.keys(componentData.props).length} props`);
      
    } catch (error) {
      console.error(`❌ Failed to extract ${componentName}:`, error.message);
      componentData.errors.push({
        stage: 'extraction',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }

    return componentData;
  }

  async extractFromDocs(componentName, componentData) {
    const docsUrl = `${this.baseUrl}/?path=/docs/${componentName}--docs`;
    console.log(`  📖 Docs: ${docsUrl}`);
    
    try {
      await this.page.goto(docsUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      await this.page.waitForTimeout(3000);

      // Extract documentation content
      componentData.docs = await this.page.evaluate(() => {
        const docs = {
          title: document.title,
          description: '',
          installation: '',
          examples: []
        };

        // Get description - usually in the first paragraph
        const firstP = document.querySelector('.docblock-description p, .sb-docs p');
        if (firstP) {
          docs.description = firstP.textContent.trim();
        }

        // Extract code examples
        const codeBlocks = document.querySelectorAll('pre code, .docblock-source pre, .sb-code pre');
        codeBlocks.forEach((block, index) => {
          const code = block.textContent?.trim();
          if (code && code.length > 10) {
            // Try to get the example context/title
            const parent = block.closest('.docblock-code-toggle, .sb-story, .docblock-source');
            let title = `Example ${index + 1}`;
            
            if (parent) {
              const heading = parent.previousElementSibling?.querySelector('h3, h4, .sb-story__title');
              if (heading) {
                title = heading.textContent.trim() || title;
              }
            }

            docs.examples.push({
              title,
              code,
              language: this.detectLanguage(code)
            });
          }
        });

        return docs;
      });

      // Extract examples for componentData
      componentData.examples = componentData.docs.examples.map(ex => ({
        name: ex.title,
        code: ex.code,
        language: ex.language,
        source: 'docs'
      }));

    } catch (error) {
      console.error(`  ❌ Docs extraction failed:`, error.message);
      componentData.errors.push({
        stage: 'docs',
        error: error.message
      });
    }
  }

  async extractFromStories(componentName, componentData) {
    // Try common story variations
    const storyVariants = [
      'default', 'sizes', 'colors', 'variants', 'disabled', 'loading',
      'with-icons', 'bordered', 'shadow', 'flat', 'solid'
    ];

    for (const variant of storyVariants) {
      try {
        const storyUrl = `${this.baseUrl}/?path=/story/${componentName}--${variant}`;
        
        console.log(`  📱 Story: ${variant}`);
        await this.page.goto(storyUrl, { waitUntil: 'networkidle2', timeout: 15000 });
        await this.page.waitForTimeout(2000);

        // Check if story exists (not 404)
        const hasStory = await this.page.evaluate(() => {
          return !document.body.textContent.includes('Story not found') && 
                 !document.querySelector('.sb-errordisplay');
        });

        if (!hasStory) continue;

        // Try to get story code
        const storyCode = await this.extractStoryCode(variant);
        if (storyCode) {
          componentData.examples.push({
            name: variant,
            code: storyCode,
            language: 'tsx',
            source: 'story'
          });

          componentData.stories.push({
            name: variant,
            url: storyUrl,
            hasCode: !!storyCode
          });
        }

      } catch (error) {
        // Silently continue - many stories won't exist
        continue;
      }
    }
  }

  async extractStoryCode(variantName) {
    try {
      // Look for "Show code" button and click it
      const showCodeSelector = '[title*="Show code"], [aria-label*="Show code"], [data-title*="code"]';
      const showCodeButton = await this.page.$(showCodeSelector);
      
      if (showCodeButton) {
        await showCodeButton.click();
        await this.page.waitForTimeout(1000);
      }

      // Extract code from various possible locations
      const code = await this.page.evaluate(() => {
        // Try multiple selectors for code blocks
        const codeSelectors = [
          '.docblock-source code',
          '.sb-source code', 
          '.sb-code code',
          '[class*="source"] code',
          'pre code'
        ];

        for (const selector of codeSelectors) {
          const codeElement = document.querySelector(selector);
          if (codeElement && codeElement.textContent.trim().length > 20) {
            return codeElement.textContent.trim();
          }
        }
        return null;
      });

      return code;
    } catch (error) {
      return null;
    }
  }

  async extractPropsFromControls(componentName, componentData) {
    try {
      // Go to the default story to access controls
      const controlsUrl = `${this.baseUrl}/?path=/story/${componentName}--default`;
      await this.page.goto(controlsUrl, { waitUntil: 'networkidle2', timeout: 15000 });
      await this.page.waitForTimeout(3000);

      // Extract props from the Controls panel
      const propsData = await this.page.evaluate(() => {
        const props = {};
        const defaultProps = {};

        // Look for controls panel
        const controlsPanel = document.querySelector('[data-testid="controls-panel"], [class*="controls"]');
        if (!controlsPanel) {
          // Try to click Controls tab if it exists
          const controlsTab = document.querySelector('[role="tab"][title*="Controls"], [role="tab"]:has-text("Controls")');
          if (controlsTab) {
            controlsTab.click();
          }
        }

        // Extract control rows
        const controlRows = document.querySelectorAll(
          '[class*="control-row"], [class*="controls"] tr, [data-testid*="control"]'
        );

        controlRows.forEach(row => {
          const nameEl = row.querySelector('[class*="control-name"], td:first-child, [data-testid*="name"]');
          const controlEl = row.querySelector('input, select, [role="combobox"], [class*="control-value"]');
          
          if (nameEl && controlEl) {
            const propName = nameEl.textContent?.trim();
            if (propName) {
              // Determine prop type and default value
              let propType = 'string';
              let defaultValue = null;

              if (controlEl.type === 'checkbox') {
                propType = 'boolean';
                defaultValue = controlEl.checked;
              } else if (controlEl.tagName === 'SELECT') {
                propType = 'enum';
                defaultValue = controlEl.value;
                const options = Array.from(controlEl.options).map(opt => opt.value);
                props[propName] = {
                  type: propType,
                  enum: options,
                  default: defaultValue
                };
                return;
              } else if (controlEl.type === 'number') {
                propType = 'number';
                defaultValue = parseFloat(controlEl.value) || 0;
              } else {
                defaultValue = controlEl.value || controlEl.textContent?.trim();
              }

              props[propName] = {
                type: propType,
                default: defaultValue
              };

              if (defaultValue !== null && defaultValue !== undefined && defaultValue !== '') {
                defaultProps[propName] = defaultValue;
              }
            }
          }
        });

        return { props, defaultProps };
      });

      componentData.props = propsData.props;
      componentData.defaultProps = propsData.defaultProps;

    } catch (error) {
      console.error(`  ❌ Props extraction failed:`, error.message);
      componentData.errors.push({
        stage: 'props',
        error: error.message
      });
    }
  }

  async captureScreenshots(componentName, componentData) {
    try {
      // Capture default component screenshot
      const defaultUrl = `${this.baseUrl}/?path=/story/${componentName}--default`;
      await this.page.goto(defaultUrl, { waitUntil: 'networkidle2', timeout: 15000 });
      await this.page.waitForTimeout(2000);

      // Find the story preview
      const previewFrame = await this.page.$('#storybook-preview-iframe');
      if (previewFrame) {
        const frame = await previewFrame.contentFrame();
        if (frame) {
          const screenshotPath = path.join(this.outputDir, 'screenshots', `${componentName}-default.png`);
          await frame.screenshot({
            path: screenshotPath,
            type: 'png',
            clip: { x: 0, y: 0, width: 400, height: 200 }
          });
          
          componentData.screenshots.push({
            variant: 'default',
            path: screenshotPath,
            url: `./screenshots/${componentName}-default.png`
          });
        }
      }

    } catch (error) {
      console.error(`  ❌ Screenshot failed:`, error.message);
      componentData.errors.push({
        stage: 'screenshot',
        error: error.message
      });
    }
  }

  detectLanguage(code) {
    if (code.includes('import') && (code.includes('<') || code.includes('jsx') || code.includes('tsx'))) {
      return code.includes('interface') || code.includes(': ') ? 'tsx' : 'jsx';
    }
    return 'javascript';
  }

  toTitleCase(str) {
    return str.split('-').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  }

  async generateUIForgeTemplates(componentData) {
    // Convert extracted data to UI Forge template format
    const templates = [];
    
    // Base template
    const baseTemplate = {
      schema_name: "ui.template.v1",
      title: `Template: ${componentData.title}`,
      tags: [
        "workspace:builder",
        "ui:template", 
        `component:${componentData.title.replace(/\s+/g, '')}`,
        "palette:heroui"
      ],
      context: {
        component_type: componentData.title.replace(/\s+/g, ''),
        default_props: this.sanitizeDefaultProps(componentData.defaultProps),
        description: componentData.docs.description || `${componentData.title} component`,
        preview_asset_tag: `asset:${componentData.name}:default`,
        examples: componentData.examples.slice(0, 3), // Include top 3 examples
        props_schema: componentData.props
      }
    };
    
    templates.push(baseTemplate);
    
    return templates;
  }

  sanitizeDefaultProps(defaultProps) {
    // Remove any non-serializable or problematic props
    const sanitized = {};
    
    Object.entries(defaultProps).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        // Skip functions, complex objects, etc.
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          sanitized[key] = value;
        }
      }
    });
    
    return sanitized;
  }

  async extractAll() {
    console.log(`🚀 Starting extraction of ${HEROUI_COMPONENTS.length} HeroUI components...\n`);
    
    for (let i = 0; i < HEROUI_COMPONENTS.length; i++) {
      const componentName = HEROUI_COMPONENTS[i];
      const componentData = await this.extractComponent(componentName);
      
      // Generate UI Forge templates
      const templates = await this.generateUIForgeTemplates(componentData);
      componentData.ui_forge_templates = templates;
      
      this.results.push(componentData);
      
      // Progress indicator
      const progress = Math.round(((i + 1) / HEROUI_COMPONENTS.length) * 100);
      console.log(`📊 Progress: ${i + 1}/${HEROUI_COMPONENTS.length} (${progress}%)\n`);
      
      // Brief pause to be respectful
      await this.page.waitForTimeout(1000);
    }

    // Save results
    await this.saveResults();
    
    console.log(`\n🎉 Extraction complete! Found:`);
    console.log(`   📦 Components: ${this.results.length}`);
    console.log(`   📝 Examples: ${this.results.reduce((sum, r) => sum + r.examples.length, 0)}`);
    console.log(`   🎛️  Props: ${this.results.reduce((sum, r) => sum + Object.keys(r.props).length, 0)}`);
    console.log(`   📸 Screenshots: ${this.results.reduce((sum, r) => sum + r.screenshots.length, 0)}`);
  }

  async saveResults() {
    // Save raw extraction data
    await fs.writeFile(
      path.join(this.outputDir, 'heroui-extraction-complete.json'),
      JSON.stringify(this.results, null, 2)
    );

    // Save UI Forge templates separately
    const allTemplates = this.results.flatMap(r => r.ui_forge_templates || []);
    await fs.writeFile(
      path.join(this.outputDir, 'ui-forge-templates.json'),
      JSON.stringify(allTemplates, null, 2)
    );

    // Save summary
    const summary = this.results.map(r => ({
      name: r.name,
      title: r.title,
      examples: r.examples.length,
      props: Object.keys(r.props).length,
      defaultProps: Object.keys(r.defaultProps).length,
      screenshots: r.screenshots.length,
      errors: r.errors.length,
      hasDocumentation: !!r.docs.description
    }));

    await fs.writeFile(
      path.join(this.outputDir, 'extraction-summary.json'),
      JSON.stringify(summary, null, 2)
    );

    console.log(`\n💾 Results saved to: ${this.outputDir}/`);
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

// Main execution
async function main() {
  const extractor = new HeroUIExtractor();
  
  try {
    await extractor.initialize();
    await extractor.extractAll();
  } catch (error) {
    console.error('❌ Extraction failed:', error);
  } finally {
    await extractor.close();
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { HeroUIExtractor };