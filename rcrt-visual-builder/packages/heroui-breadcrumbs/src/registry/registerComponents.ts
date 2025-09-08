/**
 * Register HeroUI Components
 * Registers all HeroUI components with the component registry
 */

import {
  // Core
  Button,
  Card,
  Input,
  Select,
  Modal,
  Table,
  Tabs,
  Badge,
  Tooltip,
  Progress,
  
  // Forms
  Checkbox,
  CheckboxGroup,
  Radio,
  RadioGroup,
  Switch,
  Slider,
  Textarea,
  Autocomplete,
  DatePicker,
  DateInput,
  DateRangePicker,
  TimeInput,
  NumberInput,
  
  // Display
  Avatar,
  AvatarGroup,
  Chip,
  Divider,
  Link,
  User,
  Code,
  Kbd,
  Image,
  Snippet,
  Breadcrumbs,
  BreadcrumbItem,
  
  // Navigation
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  NavbarMenuToggle,
  NavbarMenu,
  NavbarMenuItem,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  DropdownSection,
  Pagination,
  
  // Feedback
  Skeleton,
  Spinner,
  CircularProgress,
  Alert,
  
  // Layout
  ScrollShadow,
  Spacer,
  
  // Overlay
  Popover,
  PopoverTrigger,
  PopoverContent,
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  DrawerFooter,
  
  // Data Display
  Accordion,
  AccordionItem,
  Listbox,
  ListboxItem,
  ListboxSection,
  
  // Calendar
  Calendar,
  RangeCalendar
} from '@heroui/react';

import { ComponentRegistry } from './ComponentRegistry';
import { BuilderCanvas } from '../custom/BuilderCanvas';
import { BuilderPalette } from '../custom/BuilderPalette';

/**
 * Register all HeroUI components
 */
export function registerHeroUIComponents() {
  ComponentRegistry.registerBatch({
    // Core components
    'Button': Button,
    'Card': Card,
    'Input': Input,
    'Select': Select,
    'Modal': Modal,
    'Table': Table,
    'Tabs': Tabs,
    'Badge': Badge,
    'Tooltip': Tooltip,
    'Progress': Progress,
    
    // Form components
    'Checkbox': Checkbox,
    'CheckboxGroup': CheckboxGroup,
    'Radio': Radio,
    'RadioGroup': RadioGroup,
    'Switch': Switch,
    'Slider': Slider,
    'Textarea': Textarea,
    'Autocomplete': Autocomplete,
    'DatePicker': DatePicker,
    'DateInput': DateInput,
    'DateRangePicker': DateRangePicker,
    'TimeInput': TimeInput,
    'NumberInput': NumberInput,
    
    // Display components
    'Avatar': Avatar,
    'AvatarGroup': AvatarGroup,
    'Chip': Chip,
    'Divider': Divider,
    'Link': Link,
    'User': User,
    'Code': Code,
    'Kbd': Kbd,
    'Image': Image,
    'Snippet': Snippet,
    'Breadcrumbs': Breadcrumbs,
    'BreadcrumbItem': BreadcrumbItem,
    
    // Navigation
    'Navbar': Navbar,
    'NavbarBrand': NavbarBrand,
    'NavbarContent': NavbarContent,
    'NavbarItem': NavbarItem,
    'NavbarMenuToggle': NavbarMenuToggle,
    'NavbarMenu': NavbarMenu,
    'NavbarMenuItem': NavbarMenuItem,
    'Dropdown': Dropdown,
    'DropdownTrigger': DropdownTrigger,
    'DropdownMenu': DropdownMenu,
    'DropdownItem': DropdownItem,
    'DropdownSection': DropdownSection,
    'Pagination': Pagination,
    
    // Feedback
    'Skeleton': Skeleton,
    'Spinner': Spinner,
    'CircularProgress': CircularProgress,
    'Alert': Alert,
    
    // Layout
    'ScrollShadow': ScrollShadow,
    'Spacer': Spacer,
    
    // Overlay
    'Popover': Popover,
    'PopoverTrigger': PopoverTrigger,
    'PopoverContent': PopoverContent,
    'Drawer': Drawer,
    'DrawerContent': DrawerContent,
    'DrawerHeader': DrawerHeader,
    'DrawerBody': DrawerBody,
    'DrawerFooter': DrawerFooter,
    
    // Data Display
    'Accordion': Accordion,
    'AccordionItem': AccordionItem,
    'Listbox': Listbox,
    'ListboxItem': ListboxItem,
    'ListboxSection': ListboxSection,
    
    // Calendar
    'Calendar': Calendar,
    'RangeCalendar': RangeCalendar
  });
  // Custom builder components (breadcrumb-driven)
  ComponentRegistry.register('BuilderCanvas', BuilderCanvas as any);
  ComponentRegistry.register('BuilderPalette', BuilderPalette as any);
  
  console.log('Registered HeroUI components:', ComponentRegistry.getTypes());
}
