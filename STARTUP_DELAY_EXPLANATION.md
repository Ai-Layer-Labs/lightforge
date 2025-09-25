# RCRT Startup Delay Explanation

## Why the long wait?

When you see this during setup:
```
⏳ Waiting for http://localhost:8081/health to be ready...
.......................
```

RCRT is actually running but taking time to initialize because:

### 1. **ONNX Model Loading (Primary Cause)**
On first startup, RCRT loads embedding models for AI-powered search:
- Downloads/loads ONNX runtime
- Initializes neural network models
- Sets up vector embeddings
- This can take **1-2 minutes** on first run

### 2. **Service Dependencies**
The system starts services in order:
1. PostgreSQL with pgvector
2. NATS messaging
3. RCRT server (loading models)
4. Tools runner
5. Agent runner
6. Dashboard

## Solutions

### Quick Fix (Already Applied)
- Increased timeout from 60s to 120s in `ensure-default-agent.js`
- Added informative messages about the delay

### Speed Up Future Startups
1. **Keep containers running**: Models are cached after first load
   ```bash
   docker compose stop    # Instead of 'down'
   docker compose start   # Faster restart
   ```

2. **Pre-built images**: Use pre-built Docker images if available

3. **Disable embeddings** (if not needed):
   ```bash
   # In docker-compose.yml, remove "embed-onnx" from FEATURES
   FEATURES: "nats"  # Instead of "embed-onnx nats"
   ```

## What's Happening in the Logs

The logs show healthy operation:
- ✅ Database initialized with vector support
- ✅ Hygiene system running (cleanup tasks)
- ✅ ONNX Runtime loaded successfully
- ✅ Server listening on correct port

The wait is normal and expected on first run!
