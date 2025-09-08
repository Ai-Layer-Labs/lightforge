
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
          console.log('✓ Component meta: ' + comp.title);
        } else {
          console.log('- Component meta exists: ' + comp.title);
        }
      } catch (error) {
        console.error('✗ Component meta failed ' + comp.title + ':', error.message);
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
          console.log('\u2713 Created template: ' + template.title);
        } else {
          console.log('- Template exists: ' + template.title);
        }
      } catch (error) {
        console.error('✗ Failed to create template ' + template.title + ':', error.message);
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
          console.log('\u2713 Created asset: ' + asset.title);
        } else {
          console.log('- Asset exists: ' + asset.title);
        }
      } catch (error) {
        console.error('✗ Failed to create asset ' + asset.title + ':', error.message);
      }
    }

    console.log('\n🎉 Seeding complete!');
    console.log('📦 Templates created: ' + templatesCreated);
    console.log('🖼️  Assets created: ' + assetsCreated);
    console.log('📚 Components created: ' + componentsCreated);

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

// Run seeder
seedHeroUI();
