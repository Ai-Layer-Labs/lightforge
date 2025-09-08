'use client';

import React from 'react';
import {
  Button, Card, CardBody, CardHeader, Input, Select, SelectItem, Modal, ModalContent, ModalBody, ModalHeader,
  Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Tabs, Tab, Badge, Tooltip, Progress, Checkbox,
  CheckboxGroup, RadioGroup, Radio, Switch, Slider, Textarea, Autocomplete, DatePicker, DateInput, DateRangePicker,
  TimeInput, NumberInput, Avatar, AvatarGroup, Chip, Divider, Link, User, Code, Kbd, Image, Snippet, Breadcrumbs,
  BreadcrumbItem, Navbar, NavbarBrand, NavbarContent, NavbarItem, Pagination, Skeleton, Spinner, CircularProgress,
  Alert, ScrollShadow, Spacer, Popover, PopoverTrigger, PopoverContent, Drawer, DrawerContent, DrawerHeader,
  DrawerBody, DrawerFooter, Accordion, AccordionItem, Listbox, ListboxItem, ListboxSection, Calendar, RangeCalendar
} from '@heroui/react';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="bg-content1/40">
      <CardHeader className="font-semibold">{title}</CardHeader>
      <CardBody className="space-y-4">{children}</CardBody>
    </Card>
  );
}

export const ComposedHeroUIDemos: React.FC = () => {
  const [isModalOpen, setModalOpen] = React.useState(false);
  const [isDrawerOpen, setDrawerOpen] = React.useState(false);

  return (
    <div className="space-y-6">
      <Section title="Core">
        <div className="flex flex-wrap gap-3 items-center">
          <Button color="primary">Button</Button>
          <Badge color="secondary">Badge</Badge>
          <Chip color="success">Chip</Chip>
          <Tooltip content="Tooltip"><Button variant="bordered">Hover me</Button></Tooltip>
          <Progress value={45} className="max-w-xs" />
        </div>
      </Section>

      <Section title="Navigation & Layout">
        <Navbar isBordered>
          <NavbarBrand>Brand</NavbarBrand>
          <NavbarContent justify="end">
            <NavbarItem>Right</NavbarItem>
          </NavbarContent>
        </Navbar>
        <Breadcrumbs aria-label="Breadcrumb">
          <BreadcrumbItem>Home</BreadcrumbItem>
          <BreadcrumbItem>Library</BreadcrumbItem>
          <BreadcrumbItem>Data</BreadcrumbItem>
        </Breadcrumbs>
        <Divider />
        <Tabs className="max-w-xl">
          <Tab key="a" title="One">First</Tab>
          <Tab key="b" title="Two">Second</Tab>
        </Tabs>
        <Pagination total={10} initialPage={2} className="mt-2" />
        <ScrollShadow hideScrollBar className="max-h-24 mt-2 p-2 border rounded">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i}>Scrollable line {i + 1}</div>
          ))}
        </ScrollShadow>
      </Section>

      <Section title="Forms">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Name" placeholder="Enter name" />
          <Select label="Framework" placeholder="Choose one">
            <SelectItem key="react">React</SelectItem>
            <SelectItem key="vue">Vue</SelectItem>
          </Select>
          <Textarea label="Message" placeholder="Your message" />
          <NumberInput label="Amount" defaultValue={3} />
          <TimeInput label="Time" />
          <DateInput label="Date" />
          <DatePicker label="Date Picker" />
          <DateRangePicker label="Date Range" />
          <Autocomplete label="Autocomplete" placeholder="Type..." />
        </div>
        <div className="flex gap-4 items-center mt-2">
          <Checkbox>Check me</Checkbox>
          <CheckboxGroup label="Select items" defaultValue={["a"]}>
            <Checkbox value="a">Apple</Checkbox>
            <Checkbox value="b">Banana</Checkbox>
          </CheckboxGroup>
          <RadioGroup label="Options" defaultValue="1" orientation="horizontal">
            <Radio value="1">One</Radio>
            <Radio value="2">Two</Radio>
          </RadioGroup>
          <Switch defaultSelected>Switch</Switch>
          <Slider className="max-w-xs" defaultValue={40} />
        </div>
      </Section>

      <Section title="Display & Media">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name="Ada" />
          <AvatarGroup>
            <Avatar name="A" />
            <Avatar name="B" />
          </AvatarGroup>
          <User name="Jane" description="Engineer" />
          <Image src="https://picsum.photos/320/180" alt="Img" width={320} height={180} className="rounded" />
          <Snippet>npm i @heroui/react</Snippet>
          <Code>{'<div/>'}</Code>
          <Kbd>⌘K</Kbd>
        </div>
      </Section>

      <Section title="Overlays">
        <div className="flex flex-wrap gap-3 items-center">
          <Button onPress={() => setModalOpen(true)}>Open Modal</Button>
          <Modal isOpen={isModalOpen} onOpenChange={setModalOpen}>
            <ModalContent>
              <ModalHeader>Modal</ModalHeader>
              <ModalBody>Modal content</ModalBody>
            </ModalContent>
          </Modal>

          <Popover>
            <PopoverTrigger>
              <Button variant="bordered">Popover</Button>
            </PopoverTrigger>
            <PopoverContent>Popover content</PopoverContent>
          </Popover>

          <Button onPress={() => setDrawerOpen(true)}>Open Drawer</Button>
          <Drawer isOpen={isDrawerOpen} onOpenChange={setDrawerOpen} placement="right">
            <DrawerContent>
              <DrawerHeader>Drawer</DrawerHeader>
              <DrawerBody>Drawer content</DrawerBody>
              <DrawerFooter>
                <Button onPress={() => setDrawerOpen(false)}>Close</Button>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
        </div>
      </Section>

      <Section title="Data Display & Calendar">
        <Table aria-label="Demo table" className="max-w-xl">
          <TableHeader>
            <TableColumn>Name</TableColumn>
            <TableColumn>Role</TableColumn>
          </TableHeader>
          <TableBody>
            <TableRow key="1"><TableCell>Ada</TableCell><TableCell>Engineer</TableCell></TableRow>
            <TableRow key="2"><TableCell>Alan</TableCell><TableCell>Researcher</TableCell></TableRow>
          </TableBody>
        </Table>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          <Calendar aria-label="Calendar" />
          <RangeCalendar aria-label="Range Calendar" />
        </div>
      </Section>

      <Section title="Feedback">
        <div className="flex flex-wrap gap-4 items-center">
          <Skeleton className="h-6 w-24" />
          <Spinner />
          <CircularProgress aria-label="loading" />
          <Alert color="warning" title="Heads up" />
        </div>
      </Section>

      <Spacer y={4} />
    </div>
  );
};


