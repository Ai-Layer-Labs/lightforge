<!-- 874a9689-e433-4d62-9c61-adf091f6c12d f6588066-762f-44eb-bd95-fa811661b588 -->
# System Dependencies: The RCRT Way

## Problem Statement

Tools like Astral need system dependencies (Chrome libraries) but currently:

- ❌ Hardcoding in Dockerfile is not scalable
- ❌ LLMs can't declare system requirements
- ❌ Each new tool type requires DevOps intervention
- ❌ No visibility into why tools fail

**RCRT Principle:** Everything should be declarative, breadcrumb-driven, and LLM-friendly.

## Solution Architecture

### Option 1: Tool-Level Dependency Declaration (Pragmatic)

Add `system_dependencies` field to tool.code.v1:

```json
{
  "schema_name": "tool.code.v1",
  "context": {
    "name": "astral",
    "system_dependencies": {
      "apt_packages": [
        "google-chrome-stable",
        "fonts-liberation",
        "libnss3",
        "libxss1"
      ],
      "install_script": "RUN apt-get update && apt-get install -y wget gnupg && ...",
      "profile": "browser-automation"  // Reference to pre-defined profile
    }
  }
}
```

### Option 2: Environment Profiles (Most RCRT)

Create `environment.profile.v1` schema for reusable profiles:

```json
{
  "schema_name": "environment.profile.v1",
  "title": "Browser Automation Environment",
  "tags": ["env:profile", "runtime:browser", "workspace:system"],
  "context": {
    "profile_id": "browser-automation",
    "description": "Chrome/Chromium with all required system libraries",
    "apt_packages": ["google-chrome-stable", "fonts-liberation", ...],
    "docker_base": "node:18-bullseye",  // or custom image
    "install_commands": ["RUN apt-get update", "RUN apt-get install -y ..."],
    "compatible_tools": ["astral", "puppeteer", "playwright"],
    "tags_indicator": ["browser:automation", "requires:chrome"]
  }
}
```

Tools reference profile:

```json
{
  "schema_name": "tool.code.v1",
  "context": {
    "name": "astral",
    "environment_profile": "browser-automation"  // or profile UUID
  }
}
```

### Option 3: Hybrid Approach (Recommended)

- **Simple deps:** Inline `system_dependencies.apt_packages` array
- **Complex scenarios:** Reference `environment_profile`
- **Pre-built profiles:** Common environments as breadcrumbs

## Implementation Strategy

### Phase 1: Schema Extension (v2.3.0)

**Add optional fields to tool.code.v1:**

```typescript
{
  context: {
    // ... existing fields ...
    system_dependencies?: {
      apt_packages?: string[];           // ["chrome", "fonts-liberation"]
      environment_profile?: string;      // Reference to environment.profile.v1
      runtime_hint?: string;             // "browser" | "ml" | "image-processing"
    }
  }
}
```

### Phase 2: Dockerfile Generation

**Create `docker-generator` service:**

1. **Scans all approved tools** for `system_dependencies`
2. **Aggregates unique packages** across all tools
3. **Generates Dockerfile** or selects pre-built image
4. **Stores in** `docker.config.v1` breadcrumb
5. **Triggers rebuild** when dependencies change

### Phase 3: Pre-Built Image Profiles

**Create multiple Docker images:**

- `tools-runner-base` (Deno only)
- `tools-runner-browser` (+ Chrome, Firefox)
- `tools-runner-ml` (+ Python, TensorFlow libs)
- `tools-runner-full` (everything)

**Tool selects image** via `environment_profile` or tags.

## RCRT-Native Features

### 1. LLM-Friendly Declaration

```
tool-creator: "I need Chrome for browser automation"
           ↓
system_dependencies: { apt_packages: ["google-chrome-stable"] }
           ↓
Dockerfile updated automatically
```

### 2. Validation Integration

validation-specialist checks:

- Are system_dependencies reasonable?
- Does tool actually use the deps?
- Security implications?

### 3. Self-Documentation

```bash
# Query which tools need Chrome
GET /breadcrumbs?schema_name=tool.code.v1&contains=system_dependencies.apt_packages:chrome
```

### 4. Knowledge Base

Create `knowledge.v1` breadcrumbs:

- "Browser automation requires Chrome"
- "Image processing needs ImageMagick"
- "PDF tools need Ghostscript"

LLMs learn from these patterns!

## Minimal Implementation (Start Here)

### Step 1: Add Field to Schema

**File:** `bootstrap-breadcrumbs/schemas/tool-code-v1.def.json` (if exists)

Add to context properties:

```json
"system_dependencies": {
  "type": "object",
  "description": "System-level dependencies (apt packages, binaries, etc.)",
  "properties": {
    "apt_packages": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Debian/Ubuntu packages required"
    },
    "environment_profile": {
      "type": "string", 
      "description": "Reference to environment.profile.v1 breadcrumb"
    }
  }
}
```

### Step 2: Update tool-creator Prompt

Add to DENO RUNTIME REQUIREMENTS section:

```
SYSTEM DEPENDENCIES:

If tool needs system packages (Chrome, ImageMagick, etc.):

"system_dependencies": {
  "apt_packages": ["google-chrome-stable", "fonts-liberation"],
  "runtime_hint": "browser"
}

Common profiles:
- Browser: ["google-chrome-stable", "fonts-liberation", "libnss3"]
- Images: ["imagemagick", "libvips"]
- PDF: ["ghostscript", "poppler-utils"]
- None: Omit field for pure JavaScript/TypeScript tools
```

### Step 3: Create Docker Image Variants

**Build 3 images:**

1. `tools-runner:base` - Deno only (current)
2. `tools-runner:browser` - + Chrome dependencies
3. `tools-runner:full` - All common dependencies

### Step 4: Dynamic Image Selection

**In docker-compose.yml:**

```yaml
tools-runner:
  image: ${TOOLS_RUNNER_IMAGE:-tools-runner:base}
```

**Dashboard shows:** "Astral tool needs tools-runner:browser image"

### Step 5: Future: Auto-Generation

Service that:

1. Monitors tool creations
2. Aggregates system_dependencies
3. Generates custom Dockerfile
4. Triggers rebuild (with approval)

## Files to Create/Modify

### Immediate (v2.3.0):

1. Add `system_dependencies` field to tool schema documentation
2. Update tool-creator prompt with system dependencies guidance
3. Update validation-specialist to check system_dependencies
4. Create browser-automation.profile.v1 breadcrumb as example

### Future (v2.4.0):

1. Create `environment.profile.v1` schema
2. Build multiple Docker image variants
3. Create docker-generator service
4. Add image selection to dashboard

## Testing Plan

1. Update Astral tool to declare dependencies
2. Manually rebuild tools-runner:browser image with Chrome
3. Verify Astral works with proper image
4. Create knowledge breadcrumb documenting the pattern
5. Test tool-creator can generate system_dependencies field

## Expected Outcomes

### Immediate:

- ✅ Tools can declare system needs
- ✅ LLMs know what dependencies tools require
- ✅ Clear documentation of environment requirements
- ✅ Validation catches missing dependencies

### Long-term:

- ✅ Fully automated tool deployment
- ✅ Zero hardcoding in Docker files
- ✅ Self-service tool creation (LLMs handle everything)
- ✅ Knowledge base grows organically

## Why This Is The RCRT Way

1. **Declarative:** Dependencies in breadcrumb schema
2. **LLM-Friendly:** Simple JSON field, clear documentation
3. **Composable:** Reference profiles or inline declare
4. **Self-Documenting:** Query system to see what's needed
5. **Evolvable:** Start simple, add automation later
6. **No Hardcoding:** Everything driven by breadcrumbs

This transforms "add Chrome to Dockerfile" into "tools declare what they need, system adapts."

### To-dos

- [ ] Update tool-debugger to use context merge