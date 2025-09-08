/**
 * Test Page - Direct component rendering
 */

'use client';

import React from 'react';
import { Button, Card, CardBody, Navbar, NavbarBrand, NavbarContent, Chip } from '@heroui/react';

export default function TestPage() {
  return (
    <div className="min-h-screen dark:bg-background">
      <Navbar isBordered>
        <NavbarBrand>
          <p className="font-bold text-inherit">Test Navbar</p>
        </NavbarBrand>
        <NavbarContent justify="end">
          <Chip color="primary" variant="flat">HeroUI Test</Chip>
        </NavbarContent>
      </Navbar>
      
      <div className="container mx-auto p-6">
        <Card className="mb-6">
          <CardBody>
            <h1 className="text-2xl font-bold mb-4">Direct HeroUI Test</h1>
            <p className="text-default-600">If you can see this styled card with proper dark theme, HeroUI is working correctly.</p>
          </CardBody>
        </Card>
        
        <div className="flex gap-4 flex-wrap">
          <Button color="primary" variant="solid">Primary Button</Button>
          <Button color="secondary" variant="flat">Secondary Button</Button>
          <Button color="success" variant="bordered">Success Button</Button>
          <Button color="warning" variant="light">Warning Button</Button>
          <Button color="danger" variant="shadow">Danger Button</Button>
        </div>
        
        <div className="mt-6 flex gap-2 flex-wrap">
          <Chip color="success">Success Chip</Chip>
          <Chip color="warning">Warning Chip</Chip>
          <Chip color="danger">Danger Chip</Chip>
          <Chip color="primary" variant="flat">Primary Flat</Chip>
          <Chip color="secondary" variant="bordered">Secondary Bordered</Chip>
        </div>
      </div>
    </div>
  );
}
