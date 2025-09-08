// Offline HeroUI Component Seeder
// Generates static template files that ship with your system

const fs = require('fs').promises;
const path = require('path');
const fetch = require('node-fetch');

class OfflineHeroUISeeder {
  constructor() {
    // Pre-curated component data based on HeroUI patterns
    // This data is static and ships with your system
    this.componentDatabase = this.buildComponentDatabase();
  }

  buildComponentDatabase() {
    // Manually curated defaults; will be auto-augmented from registry if available
    const base = {
      Button: {
        defaultProps: {
          variant: "solid",
          size: "md",
          color: "default",
          isDisabled: false,
          isLoading: false,
          children: "Button"
        },
        propSchema: {
          variant: {
            type: "select",
            options: ["solid", "bordered", "light", "flat", "faded", "shadow", "ghost"],
            default: "solid"
          },
          size: {
            type: "select", 
            options: ["sm", "md", "lg"],
            default: "md"
          },
          color: {
            type: "select",
            options: ["default", "primary", "secondary", "success", "warning", "danger"],
            default: "default"
          },
          isDisabled: { type: "boolean", default: false },
          isLoading: { type: "boolean", default: false },
          startContent: { type: "react_node", optional: true },
          endContent: { type: "react_node", optional: true },
          children: { type: "react_node", default: "Button" }
        },
        variants: [
          { name: "primary", props: { color: "primary" } },
          { name: "secondary", props: { color: "secondary" } },
          { name: "danger", props: { color: "danger" } },
          { name: "ghost", props: { variant: "ghost" } },
          { name: "loading", props: { isLoading: true } }
        ],
        examples: [
          {
            name: "Basic Button",
            code: `<Button>Click me</Button>`
          },
          {
            name: "Primary Button", 
            code: `<Button color="primary">Primary</Button>`
          },
          {
            name: "Loading Button",
            code: `<Button isLoading>Loading</Button>`
          },
          {
            name: "With Icon",
            code: `<Button startContent={<PlusIcon />}>Add Item</Button>`
          }
        ],
        installation: {
          individual: "npm install @heroui/button",
          collective: "npm install @heroui/react"
        },
        imports: {
          individual: 'import { Button } from "@heroui/button";',
          collective: 'import { Button } from "@heroui/react";'
        }
      },

      Input: {
        defaultProps: {
          variant: "flat",
          size: "md",
          labelPlacement: "inside",
          label: "Label",
          placeholder: "Enter text..."
        },
        propSchema: {
          variant: {
            type: "select",
            options: ["flat", "bordered", "underlined", "faded"],
            default: "flat"
          },
          size: {
            type: "select",
            options: ["sm", "md", "lg"],
            default: "md"
          },
          labelPlacement: {
            type: "select", 
            options: ["inside", "outside", "outside-left"],
            default: "inside"
          },
          label: { type: "string", default: "Label" },
          placeholder: { type: "string", default: "Enter text..." },
          description: { type: "string", optional: true },
          errorMessage: { type: "string", optional: true },
          isRequired: { type: "boolean", default: false },
          isDisabled: { type: "boolean", default: false },
          isInvalid: { type: "boolean", default: false }
        },
        variants: [
          { name: "bordered", props: { variant: "bordered" } },
          { name: "underlined", props: { variant: "underlined" } },
          { name: "required", props: { isRequired: true, label: "Required Field" } },
          { name: "with-description", props: { description: "Helper text here" } },
          { name: "error", props: { isInvalid: true, errorMessage: "This field is required" } }
        ],
        examples: [
          {
            name: "Basic Input",
            code: `<Input label="Email" placeholder="Enter your email" />`
          },
          {
            name: "Required Input", 
            code: `<Input label="Password" type="password" isRequired />`
          },
          {
            name: "With Description",
            code: `<Input label="Username" description="This will be your public display name" />`
          }
        ],
        installation: {
          individual: "npm install @heroui/input",
          collective: "npm install @heroui/react"
        },
        imports: {
          individual: 'import { Input } from "@heroui/input";',
          collective: 'import { Input } from "@heroui/react";'
        }
      },

      Card: {
        defaultProps: {
          shadow: "md",
          radius: "lg",
          children: "Card content"
        },
        propSchema: {
          shadow: {
            type: "select",
            options: ["none", "sm", "md", "lg"],
            default: "md"
          },
          radius: {
            type: "select",
            options: ["none", "sm", "md", "lg", "full"],
            default: "lg"
          },
          isHoverable: { type: "boolean", default: false },
          isPressable: { type: "boolean", default: false },
          isDisabled: { type: "boolean", default: false },
          children: { type: "react_node", default: "Card content" }
        },
        variants: [
          { name: "hoverable", props: { isHoverable: true } },
          { name: "pressable", props: { isPressable: true } },
          { name: "no-shadow", props: { shadow: "none" } },
          { name: "small-radius", props: { radius: "sm" } }
        ],
        examples: [
          {
            name: "Basic Card",
            code: `<Card>\n  <CardBody>Card content</CardBody>\n</Card>`
          },
          {
            name: "Card with Header",
            code: `<Card>\n  <CardHeader>Header</CardHeader>\n  <CardBody>Content</CardBody>\n</Card>`
          }
        ],
        installation: {
          individual: "npm install @heroui/card",
          collective: "npm install @heroui/react"
        },
        imports: {
          individual: 'import { Card, CardBody, CardHeader } from "@heroui/card";',
          collective: 'import { Card, CardBody, CardHeader } from "@heroui/react";'
        }
      },

      // Add more components as needed...
      Select: {
        defaultProps: {
          variant: "flat",
          size: "md", 
          labelPlacement: "inside",
          label: "Select option",
          placeholder: "Choose an option"
        },
        propSchema: {
          variant: {
            type: "select",
            options: ["flat", "bordered", "underlined", "faded"],
            default: "flat"
          },
          size: {
            type: "select",
            options: ["sm", "md", "lg"],
            default: "md"
          },
          selectionMode: {
            type: "select",
            options: ["single", "multiple"],
            default: "single"
          },
          label: { type: "string", default: "Select option" },
          placeholder: { type: "string", default: "Choose an option" },
          isRequired: { type: "boolean", default: false },
          isDisabled: { type: "boolean", default: false }
        },
        variants: [
          { name: "multiple", props: { selectionMode: "multiple" } },
          { name: "bordered", props: { variant: "bordered" } }
        ],
        examples: [
          {
            name: "Basic Select",
            code: `<Select label="Framework">\n  <SelectItem key="react">React</SelectItem>\n  <SelectItem key="vue">Vue</SelectItem>\n</Select>`
          }
        ],
        installation: {
          individual: "npm install @heroui/select",
          collective: "npm install @heroui/react"
        },
        imports: {
          individual: 'import { Select, SelectItem } from "@heroui/select";',
          collective: 'import { Select, SelectItem } from "@heroui/react";'
        }
      }

      // Continue with other important components...
    };

    // Auto-discover from our registry file to stay up-to-date
    try {
      const registryPath = path.join(__dirname, 'rcrt-visual-builder', 'packages', 'heroui-breadcrumbs', 'src', 'registry', 'registerComponents.ts');
      const content = require('fs').readFileSync(registryPath, 'utf8');
      const matches = [...content.matchAll(/'([A-Za-z][A-Za-z0-9]*)':\s*[A-Za-z][A-Za-z0-9]*/g)];
      const names = Array.from(new Set(matches.map(m => m[1])));
      for (const name of names) {
        if (!base[name]) {
          // Provide minimal safe defaults for unknown components
          base[name] = {
            defaultProps: { children: name },
            propSchema: { children: { type: 'react_node', optional: true } },
            variants: [],
            examples: [{ name: `${name} Basic`, code: `<${name} />` }],
            installation: { collective: 'npm install @heroui/react' },
            imports: { collective: `import { ${name} } from "@heroui/react";` }
          };
        }
      }
    } catch (e) {
      // Non-fatal: keep curated base if registry file not found
    }

    return base;
  }

  generateUIForgeTemplates() {
    const templates = [];
    const assets = [];

    Object.entries(this.componentDatabase).forEach(([componentName, componentData]) => {
      // Base template
      const baseTemplate = {
        schema_name: "ui.template.v1",
        title: `Template: ${componentName}`,
        tags: [
          "workspace:builder",
          "ui:template",
          `component:${componentName}`,
          "palette:heroui"
        ],
        context: {
          component_type: componentName,
          default_props: componentData.defaultProps,
          props_schema: componentData.propSchema,
          examples: componentData.examples,
          installation: componentData.installation,
          imports: componentData.imports,
          preview_asset_tag: `asset:${componentName.toLowerCase()}:default`,
          description: this.generateDescription(componentName, componentData)
        }
      };

      templates.push(baseTemplate);

      // Variant templates
      componentData.variants.forEach(variant => {
        const variantTemplate = {
          ...baseTemplate,
          title: `Template: ${componentName} / ${variant.name}`,
          tags: [...baseTemplate.tags, `variant:${variant.name}`],
          context: {
            ...baseTemplate.context,
            default_props: { ...componentData.defaultProps, ...variant.props },
            preview_asset_tag: `asset:${componentName.toLowerCase()}:${variant.name}`,
            description: `${componentName} ${variant.name} variant`
          }
        };

        templates.push(variantTemplate);
      });

      // Generate preview assets
      assets.push({
        schema_name: "ui.asset.v1",
        title: `Asset: ${componentName} / default`,
        tags: [
          "workspace:builder",
          "ui:asset",
          `asset:${componentName.toLowerCase()}:default`,
          `component:${componentName}`
        ],
        context: {
          kind: "image",
          content_type: "image/svg+xml",
          data_base64: this.generatePlaceholderSVG(componentName, "default"),
          width: 400,
          height: 200,
          alt: `${componentName} default preview`
        }
      });
    });

    return { templates, assets };
  }

  generateComponentCatalog() {
    const records = [];
    Object.entries(this.componentDatabase).forEach(([componentName, componentData]) => {
      records.push({
        schema_name: "ui.component.v1",
        title: `UI Component: ${componentName}`,
        tags: [
          "workspace:builder",
          "ui:component",
          `component:${componentName}`,
          "palette:heroui"
        ],
        context: {
          component_type: componentName,
          library: "heroui",
          library_version: "2.x",
          props_schema: componentData.propSchema,
          installation: componentData.installation,
          imports: componentData.imports,
          examples: componentData.examples
        }
      });
    });
    return records;
  }

  generateDescription(componentName, componentData) {
    const descriptions = {
      Button: "Interactive button component for triggering actions",
      Input: "Text input field for collecting user data",
      Card: "Container component for grouping related content",
      Select: "Dropdown selection component for choosing options"
    };

    return descriptions[componentName] || `${componentName} component`;
  }

  generatePlaceholderSVG(componentName, variant) {
    // Generate simple SVG preview as base64
    const svg = `
      <svg width="400" height="200" xmlns="http://www.w3.org/2000/svg">
        <rect width="400" height="200" fill="#f4f4f5"/>
        <text x="200" y="100" text-anchor="middle" dy=".3em" 
              font-family="system-ui" font-size="24" fill="#71717a">
          ${componentName} ${variant}
        </text>
      </svg>
    `;

    return Buffer.from(svg).toString('base64');
  }

  async generateStaticFiles(outputDir = './heroui-templates') {
    const { templates, assets } = this.generateUIForgeTemplates();
    const components = this.generateComponentCatalog();

    // Create output directory
    await fs.mkdir(outputDir, { recursive: true });

    // Write templates file
    await fs.writeFile(
      path.join(outputDir, 'ui-templates.json'),
      JSON.stringify(templates, null, 2)
    );

    // Write assets file
    await fs.writeFile(
      path.join(outputDir, 'ui-assets.json'),
      JSON.stringify(assets, null, 2)
    );

    // Write component catalog file
    await fs.writeFile(
      path.join(outputDir, 'ui-components.json'),
      JSON.stringify(components, null, 2)
    );

    // Write seeder script
    const seederScript = this.generateSeederScript();
    await fs.writeFile(
      path.join(outputDir, 'seed-heroui.js'),
      seederScript
    );

    // Write summary
    const summary = {
      generated_at: new Date().toISOString(),
      templates_count: templates.length,
      assets_count: assets.length,
      components_count: components.length,
      components: Object.keys(this.componentDatabase),
      usage: "Run 'node seed-heroui.js' to populate your RCRT database"
    };

    await fs.writeFile(
      path.join(outputDir, 'summary.json'),
      JSON.stringify(summary, null, 2)
    );

    console.log(`Generated ${templates.length} templates and ${assets.length} assets`);
    console.log(`Files written to: ${outputDir}/`);

    return summary;
  }

  generateSeederScript() {
    return `
// HeroUI Template Seeder Script
// Run this to populate your RCRT database with HeroUI templates

const fs = require('fs').promises;
const path = require('path');
const fetch = require('node-fetch');

async function seedHeroUI() {
  try {
    // Load data files
    const templates = JSON.parse(await fs.readFile('./ui-templates.json', 'utf8'));
    const assets = JSON.parse(await fs.readFile('./ui-assets.json', 'utf8'));
    const components = JSON.parse(await fs.readFile('./ui-components.json', 'utf8').catch(()=> '[]'));

    // Backend URL
    const baseUrl = (process.env.RCRT_URL || 'http://localhost:8081').replace(/\/$/, '');
    const getByTag = async (tag) => {
      const resp = await fetch(baseUrl + '/breadcrumbs?tag=' + encodeURIComponent(tag));
      if (!resp.ok) throw new Error(await resp.text());
      return resp.json();
    };
    const createBreadcrumb = async (body) => {
      const resp = await fetch(baseUrl + '/breadcrumbs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      if (!resp.ok) throw new Error(await resp.text());
      return resp.json();
    };

    console.log('Starting HeroUI template seeding...');

    let templatesCreated = 0;
    let assetsCreated = 0;
    let componentsCreated = 0;

    // Optional SSR validation
    const validate = async (title, body) => {
      if (process.env.VALIDATE_SSR !== '1') return true;
      try {
        const React = require('react');
        const ReactDOMServer = require('react-dom/server');
        const lib = require('@heroui/react');
        const Comp = lib[body.context.component_type];
        if (!Comp) return false;
        ReactDOMServer.renderToString(React.createElement(Comp, body.context.default_props));
        return true;
      } catch (e) {
        console.warn('SSR validation failed for', title, e.message);
        return false;
      }
    };

    // Seed components first (catalog)
    for (const comp of components) {
      try {
        const list = await getByTag('workspace:builder');
        const exists = list.find((b) => b.title === comp.title);
        if (!exists) {
          await createBreadcrumb(comp);
          componentsCreated++;
          console.log('\u2713 Component meta: ' + comp.title);
        } else {
          console.log('- Component meta exists: ' + comp.title);
        }
      } catch (error) {
        console.error('\u2717 Component meta failed ' + comp.title + ':', error.message);
      }
    }

    // Seed templates (idempotent)
    for (const template of templates) {
      try {
        const list = await getByTag('workspace:builder');
        const exists = list.find((b) => b.title === template.title);
        const ok = await validate(template.title, template);
        if (!exists && ok) {
          await createBreadcrumb(template);
          templatesCreated++;
          console.log('\\u2713 Created template: ' + template.title);
        } else {
          console.log('- Template exists: ' + template.title);
        }
      } catch (error) {
        console.error('\u2717 Failed to create template ' + template.title + ':', error.message);
      }
    }

    // Seed assets (idempotent)
    for (const asset of assets) {
      try {
        const list = await getByTag('workspace:builder');
        const exists = list.find((b) => b.title === asset.title);
        if (!exists) {
          await createBreadcrumb(asset);
          assetsCreated++;
          console.log('\\u2713 Created asset: ' + asset.title);
        } else {
          console.log('- Asset exists: ' + asset.title);
        }
      } catch (error) {
        console.error('\u2717 Failed to create asset ' + asset.title + ':', error.message);
      }
    }

    console.log('\\n\uD83C\uDF89 Seeding complete!');
    console.log('\uD83D\uDCE6 Templates created: ' + templatesCreated);
    console.log('\uD83D\uDDBC\uFE0F  Assets created: ' + assetsCreated);
    console.log('\uD83D\uDCDA Components created: ' + componentsCreated);

  } catch (error) {
    console.error('\u274C Seeding failed:', error);
    process.exit(1);
  }
}

// Run seeder
seedHeroUI();
`;
  }
}

// Usage
async function main() {
  const seeder = new OfflineHeroUISeeder();
  await seeder.generateStaticFiles();
  console.log('\\nStatic HeroUI templates generated!');
  console.log('To use:');
  console.log('1. Copy the generated files to your project');
  console.log('2. Run: node seed-heroui.js');
  console.log('3. Templates will be available in your UI Forge builder');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { OfflineHeroUISeeder };
