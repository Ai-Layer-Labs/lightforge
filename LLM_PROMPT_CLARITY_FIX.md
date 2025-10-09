# LLM Prompt Clarity Fix

## The Problem You Found

The LLM kept saying:
> "I cannot directly modify the `return_to_llm` flag. That is a system configuration."

**But that's WRONG!** The LLM CAN and SHOULD control `return_to_llm`!

## Root Cause

The system prompt was unclear:

### Before (Confusing)
```
- Simple tools have return_to_llm: false by default
  → Their results go directly to the user
  → You can override with "return_to_llm": true
```

**LLM reads this as**: "It's a system default, I can't change it"

### After (Clear)
```
TOOL RESPONSE HANDLING (YOU CONTROL THIS!):
- You CHOOSE whether tool results come back to you
- Add "return_to_llm": true if you want to add reasoning
- Add "return_to_llm": false if raw result is good enough

YOU DECIDE based on whether output needs your reasoning!
```

**LLM reads this as**: "Oh, this is MY choice!"

## The Fix

**Made it clear the LLM is in control:**
1. ✅ "YOU CONTROL THIS!" in header
2. ✅ "You CHOOSE" language
3. ✅ "YOU DECIDE" conclusion
4. ✅ Examples showing when to use each
5. ✅ Removed "system configuration" language

## Why This Matters

**With unclear prompt:**
- LLM thinks it's constrained
- Refuses to add the field
- User frustrated
- Feature unused

**With clear prompt:**
- LLM knows it controls this
- Adds field when appropriate
- Smart decisions
- Feature actually used

## Rebuild & Test

```powershell
docker compose build agent-runner
docker compose up -d agent-runner

# Test:
# "Generate a random number and explain why it's interesting"
# LLM should add: "return_to_llm": true
# Because it needs to add the explanation!

# "Just give me a random number"
# LLM should use: "return_to_llm": false  
# Because user just needs the number
```

---

**Lesson**: Prompts must be CRYSTAL CLEAR about what the LLM controls vs constraints.

**You caught a real UX issue!** 🎯
