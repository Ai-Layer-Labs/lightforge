# RCRT Documentation Hub

Welcome to the **RCRT (Right Context Right Time)** documentation! This hub provides comprehensive information about the system architecture, APIs, and development workflows.

## 📚 Documentation Index

### Core Documentation

1. **[SYSTEM_ARCHITECTURE_OVERVIEW.md](./SYSTEM_ARCHITECTURE_OVERVIEW.md)** ⭐
   - Complete system architecture
   - Component descriptions
   - Data models and schemas
   - Event flows
   - Security details
   - **Start here for comprehensive understanding**

2. **[QUICK_REFERENCE.md](./QUICK_REFERENCE.md)** 🚀
   - Quick start commands
   - Common API calls
   - Environment variables
   - Debugging tips
   - Code examples
   - **Perfect for day-to-day development**

3. **[SYSTEM_DIAGRAMS.md](./SYSTEM_DIAGRAMS.md)** 📊
   - Visual architecture diagrams
   - Data flow illustrations
   - Deployment topologies
   - Component interaction matrices
   - **Visual learners start here**

---

## 🎯 Quick Start

### For First-Time Users

1. Read **[System Architecture Overview](./SYSTEM_ARCHITECTURE_OVERVIEW.md)** sections:
   - Executive Summary
   - System Components
   - Data Model: Breadcrumbs
   - Event Flow Examples

2. Try the **[Quick Reference](./QUICK_REFERENCE.md)** examples:
   - Quick Start Commands
   - Get JWT Token
   - Create Breadcrumb

3. Explore **[System Diagrams](./SYSTEM_DIAGRAMS.md)**:
   - System Architecture Diagram
   - Data Flow: User Message to Agent Response

### For Developers

1. **Setup Environment**: Follow [Quick Start Commands](./QUICK_REFERENCE.md#quick-start-commands)
2. **API Reference**: Browse [Common API Calls](./QUICK_REFERENCE.md#common-api-calls)
3. **Debugging**: Check [Troubleshooting](./QUICK_REFERENCE.md#troubleshooting-checklist)

### For Architects

1. **Architecture**: Review [System Components](./SYSTEM_ARCHITECTURE_OVERVIEW.md#system-components)
2. **Deployment**: Study [Deployment Topologies](./SYSTEM_DIAGRAMS.md#deployment-topologies)
3. **Security**: Read [Authentication & Security](./SYSTEM_ARCHITECTURE_OVERVIEW.md#authentication--security)

---

## 🏗️ System Overview

**RCRT** is an event-driven AI agent orchestration platform that treats all data as versioned **breadcrumbs**.

### Key Features

✅ **Event-Driven**: Real-time SSE (Server-Sent Events) pub/sub  
✅ **Selector-Based Routing**: Intelligent event routing via tags/schemas  
✅ **Schema Versioning**: Backwards-compatible data evolution  
✅ **Multi-Component**: 5 modular services working together  
✅ **Production-Ready**: JWT auth, encryption, ACL, monitoring  
✅ **Beautiful UI**: 3D/2D dashboard visualization  
✅ **Browser Integration**: Chrome extension for chat  

### Core Components

| Component | Technology | Purpose | Port |
|-----------|-----------|---------|------|
| **rcrt-server** | Rust/Axum | Core API & events | 8081 |
| **frontend** | React/TypeScript | 3D/2D dashboard | 8082 |
| **agent-runner** | Node.js/TypeScript | Execute AI agents | - |
| **tools-runner** | Node.js/TypeScript | Execute tools | - |
| **extension** | React/TypeScript | Browser chat | - |

---

## 📖 Documentation by Topic

### Getting Started

- [System Architecture Overview](./SYSTEM_ARCHITECTURE_OVERVIEW.md#executive-summary)
- [Quick Start Commands](./QUICK_REFERENCE.md#quick-start-commands)
- [Component Ports](./QUICK_REFERENCE.md#component-ports)
- [Environment Variables](./QUICK_REFERENCE.md#environment-variables-cheatsheet)

### Core Concepts

- [Breadcrumbs](./SYSTEM_ARCHITECTURE_OVERVIEW.md#data-model-breadcrumbs)
- [Event-Driven Architecture](./SYSTEM_ARCHITECTURE_OVERVIEW.md#core-philosophy)
- [Selector-Based Subscriptions](./SYSTEM_ARCHITECTURE_OVERVIEW.md#1-selector-based-routing)
- [Schema Versioning](./SYSTEM_ARCHITECTURE_OVERVIEW.md#3-schema-versioning)

### Components

- [rcrt-server](./SYSTEM_ARCHITECTURE_OVERVIEW.md#1-rcrt-server-rustaxum)
- [frontend (Dashboard v2)](./SYSTEM_ARCHITECTURE_OVERVIEW.md#2-frontend-dashboard-v2-reacttypescript)
- [agent-runner](./SYSTEM_ARCHITECTURE_OVERVIEW.md#3-agent-runner-nodejstypescript)
- [tools-runner](./SYSTEM_ARCHITECTURE_OVERVIEW.md#4-tools-runner-nodejstypescript)
- [extension](./SYSTEM_ARCHITECTURE_OVERVIEW.md#5-extension-chrome-extension)

### API & SDK

- [API Endpoints](./SYSTEM_ARCHITECTURE_OVERVIEW.md#api-endpoints)
- [Common API Calls](./QUICK_REFERENCE.md#common-api-calls)
- [TypeScript SDK Examples](./QUICK_REFERENCE.md#typescript-sdk-examples)
- [Chrome Extension API](./QUICK_REFERENCE.md#chrome-extension-api)

### Data & Schemas

- [Breadcrumb Schema](./SYSTEM_ARCHITECTURE_OVERVIEW.md#core-schema)
- [Common Schemas](./QUICK_REFERENCE.md#common-breadcrumb-schemas)
- [Database Schema](./SYSTEM_DIAGRAMS.md#database-schema-postgresql)
- [Breadcrumb Lifecycle](./SYSTEM_DIAGRAMS.md#breadcrumb-lifecycle)

### Event System

- [Event Flow Examples](./SYSTEM_ARCHITECTURE_OVERVIEW.md#event-flow-examples)
- [SSE Connection](./QUICK_REFERENCE.md#connect-to-sse)
- [Selector Examples](./QUICK_REFERENCE.md#selector-examples)
- [Agent Subscription Matching](./SYSTEM_DIAGRAMS.md#agent-subscription-matching)

### Development

- [Code Structure](./SYSTEM_ARCHITECTURE_OVERVIEW.md#code-structure)
- [Development Workflow](./SYSTEM_ARCHITECTURE_OVERVIEW.md#development-workflow)
- [Common Patterns](./QUICK_REFERENCE.md#common-patterns)
- [Debugging Tips](./QUICK_REFERENCE.md#debugging-tips)

### Deployment

- [Configuration & Deployment](./SYSTEM_ARCHITECTURE_OVERVIEW.md#configuration--deployment)
- [Docker Compose](./SYSTEM_ARCHITECTURE_OVERVIEW.md#docker-compose)
- [Deployment Topologies](./SYSTEM_DIAGRAMS.md#deployment-topologies)
- [Monitoring & Observability](./SYSTEM_DIAGRAMS.md#monitoring--observability)

### Security

- [Authentication & Security](./SYSTEM_ARCHITECTURE_OVERVIEW.md#authentication--security)
- [JWT Token Flow](./SYSTEM_ARCHITECTURE_OVERVIEW.md#jwt-token-flow)
- [Security Best Practices](./QUICK_REFERENCE.md#security-best-practices)

### Troubleshooting

- [Troubleshooting](./SYSTEM_ARCHITECTURE_OVERVIEW.md#troubleshooting)
- [Troubleshooting Checklist](./QUICK_REFERENCE.md#troubleshooting-checklist)
- [Debug Commands](./SYSTEM_ARCHITECTURE_OVERVIEW.md#debug-commands)
- [Debugging Tips](./QUICK_REFERENCE.md#debugging-tips)

---

## 🎓 Learning Paths

### Path 1: Understand the System (1-2 hours)

1. ✅ Read [Executive Summary](./SYSTEM_ARCHITECTURE_OVERVIEW.md#executive-summary)
2. ✅ Study [System Architecture Diagram](./SYSTEM_DIAGRAMS.md#system-architecture-diagram)
3. ✅ Review [Breadcrumbs](./SYSTEM_ARCHITECTURE_OVERVIEW.md#data-model-breadcrumbs)
4. ✅ Follow [Data Flow Example](./SYSTEM_DIAGRAMS.md#data-flow-user-message-to-agent-response)
5. ✅ Read [Key Design Patterns](./SYSTEM_ARCHITECTURE_OVERVIEW.md#key-design-patterns)

### Path 2: Get Started Developing (30 min)

1. ✅ Follow [Quick Start Commands](./QUICK_REFERENCE.md#quick-start-commands)
2. ✅ Get [JWT Token](./QUICK_REFERENCE.md#get-jwt-token)
3. ✅ Try [Create Breadcrumb](./QUICK_REFERENCE.md#create-breadcrumb)
4. ✅ Test [SSE Connection](./QUICK_REFERENCE.md#connect-to-sse)
5. ✅ Review [TypeScript SDK Examples](./QUICK_REFERENCE.md#typescript-sdk-examples)

### Path 3: Build an Agent (1 hour)

1. ✅ Understand [Agent Architecture](./SYSTEM_ARCHITECTURE_OVERVIEW.md#3-agent-runner-nodejstypescript)
2. ✅ Review [Agent Definition Schema](./QUICK_REFERENCE.md#agent-definition)
3. ✅ Follow [Create Agent](./QUICK_REFERENCE.md#create-agent) pattern
4. ✅ Study [Selector Examples](./QUICK_REFERENCE.md#selector-examples)
5. ✅ Test with [User Message Flow](./SYSTEM_DIAGRAMS.md#data-flow-user-message-to-agent-response)

### Path 4: Build a Tool (1 hour)

1. ✅ Understand [Tool Architecture](./SYSTEM_ARCHITECTURE_OVERVIEW.md#4-tools-runner-nodejstypescript)
2. ✅ Review [Tool Definition Schema](./QUICK_REFERENCE.md#tool-definition)
3. ✅ Follow [Create Tool](./QUICK_REFERENCE.md#create-tool) pattern
4. ✅ Study [Tool Execution Flow](./SYSTEM_DIAGRAMS.md#tool-execution-flow)
5. ✅ Understand [EventBridge](./SYSTEM_ARCHITECTURE_OVERVIEW.md#eventbridge)

### Path 5: Deploy to Production (2-3 hours)

1. ✅ Review [Deployment Topologies](./SYSTEM_DIAGRAMS.md#deployment-topologies)
2. ✅ Setup [Docker Compose](./SYSTEM_ARCHITECTURE_OVERVIEW.md#docker-compose)
3. ✅ Configure [Environment Variables](./QUICK_REFERENCE.md#environment-variables-cheatsheet)
4. ✅ Enable [Security Best Practices](./QUICK_REFERENCE.md#security-best-practices)
5. ✅ Setup [Monitoring](./SYSTEM_DIAGRAMS.md#monitoring--observability)

---

## 🔗 External Resources

### Prerequisites

- **PostgreSQL**: https://www.postgresql.org/
- **pgvector**: https://github.com/pgvector/pgvector
- **NATS**: https://nats.io/
- **Rust**: https://www.rust-lang.org/
- **Node.js**: https://nodejs.org/
- **Docker**: https://www.docker.com/

### Technologies Used

- **Axum**: https://github.com/tokio-rs/axum
- **React**: https://react.dev/
- **Zustand**: https://github.com/pmndrs/zustand
- **React Three Fiber**: https://docs.pmnd.rs/react-three-fiber/
- **TailwindCSS**: https://tailwindcss.com/
- **Vite**: https://vitejs.dev/

---

## 📝 Contributing

### Adding Documentation

1. Follow existing documentation style
2. Use clear headings and structure
3. Include code examples where appropriate
4. Update this README.md index if adding new sections

### Documentation Standards

- Use Markdown format
- Include diagrams for complex concepts
- Keep code examples up-to-date
- Cross-reference related sections
- Test all code snippets before committing

---

## 🆘 Getting Help

### Common Questions

**Q: Where do I start?**  
A: Read the [Executive Summary](./SYSTEM_ARCHITECTURE_OVERVIEW.md#executive-summary) first, then follow the [Quick Start](./QUICK_REFERENCE.md#quick-start-commands).

**Q: How do breadcrumbs work?**  
A: See [Data Model: Breadcrumbs](./SYSTEM_ARCHITECTURE_OVERVIEW.md#data-model-breadcrumbs) and [Breadcrumb Lifecycle](./SYSTEM_DIAGRAMS.md#breadcrumb-lifecycle).

**Q: How do agents subscribe to events?**  
A: Review [Selector-Based Routing](./SYSTEM_ARCHITECTURE_OVERVIEW.md#1-selector-based-routing) and [Agent Subscription Matching](./SYSTEM_DIAGRAMS.md#agent-subscription-matching).

**Q: How do tools execute?**  
A: Study [Tool Execution Flow](./SYSTEM_DIAGRAMS.md#tool-execution-flow) and [EventBridge](./SYSTEM_ARCHITECTURE_OVERVIEW.md#eventbridge).

**Q: Something's not working?**  
A: Check [Troubleshooting Checklist](./QUICK_REFERENCE.md#troubleshooting-checklist) and [Debugging Tips](./QUICK_REFERENCE.md#debugging-tips).

### Support Channels

- **Issues**: Report bugs and feature requests
- **Discussions**: Ask questions and share ideas
- **Documentation**: Improve docs via pull requests

---

## 📜 Glossary

| Term | Definition |
|------|-----------|
| **Breadcrumb** | Core data primitive - versioned JSON with schema |
| **SSE** | Server-Sent Events - one-way real-time communication |
| **Selector** | Subscription criteria (tags, schemas, context) |
| **Schema** | Versioned breadcrumb type (e.g., `user.message.v1`) |
| **Agent** | AI entity defined as breadcrumb, executes via agent-runner |
| **Tool** | Executable service defined as breadcrumb, runs via tools-runner |
| **JWT** | JSON Web Token - authentication mechanism |
| **EventBridge** | Event correlation system for request/response patterns |
| **Hygiene** | Automatic cleanup system for expired breadcrumbs |
| **ACL** | Access Control List - fine-grained permissions |

---

## 🗺️ Roadmap

See [Future Enhancements](./SYSTEM_ARCHITECTURE_OVERVIEW.md#future-enhancements) for planned features and research areas.

---

## 📄 License

[Your License]

---

## 🙏 Acknowledgments

Built with modern technologies and best practices from the Rust, Node.js, and React communities.

---

**Documentation Version**: 1.0  
**Last Updated**: 2024  
**Maintainers**: RCRT Team  

---

## Quick Links

- 📘 [Full Architecture](./SYSTEM_ARCHITECTURE_OVERVIEW.md)
- 🚀 [Quick Reference](./QUICK_REFERENCE.md)
- 📊 [System Diagrams](./SYSTEM_DIAGRAMS.md)
- 🏗️ [Component Ports](#-system-overview)
- 🎓 [Learning Paths](#-learning-paths)
- 🆘 [Getting Help](#-getting-help)