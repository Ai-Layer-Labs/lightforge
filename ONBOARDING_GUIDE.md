# RCRT Dashboard v2 Onboarding Guide

## Overview

The RCRT Dashboard v2 includes a built-in onboarding flow that guides first-time users through setting up their OpenRouter API key. This ensures users can immediately start using AI-powered features.

## Features

### 🎯 Smart Detection
- Automatically detects if OpenRouter is not configured
- Checks for existing OPENROUTER_API_KEY secret
- Only shows onboarding when needed

### 🚀 Guided Tour
- Interactive tooltips using react-joyride
- Step-by-step instructions with visual highlights
- Skippable for experienced users

### 💾 State Persistence
- Remembers when onboarding is completed
- Uses localStorage to track completion
- Won't show again once completed

## User Flow

1. **Welcome Screen**
   - Modal appears on first visit
   - Explains the purpose of setup
   - Options to start or skip

2. **Create Secret**
   - Click "Create" button
   - Select "Secret" option
   - Enter "OPENROUTER_API_KEY" as name
   - Paste API key value
   - Create the secret

3. **Configure Tool**
   - Find and click "openrouter" tool
   - Click "Configure Tool"
   - Select the created secret from dropdown
   - Save configuration

4. **Completion**
   - Success message
   - Onboarding marked as complete
   - Ready to use AI features

## Technical Implementation

### Components
- `Onboarding.tsx` - Main onboarding component
- Uses react-joyride for tour functionality
- Integrates with existing dashboard state

### Data Attributes
Key elements have `data-tour` attributes:
- `data-tour="create-button"` - Create button
- `data-tour="create-secret"` - Secret creation option
- `data-tour="secret-name"` - Secret name input
- `data-tour="secret-value"` - Secret value textarea
- `data-tour="create-secret-button"` - Submit button
- `data-tour="openrouter-tool"` - OpenRouter tool node
- `data-tour="configure-tool"` - Configure tool button
- `data-tour="select-secret"` - Secret selection dropdown

### Triggering Conditions
Onboarding shows when:
- No localStorage flag `rcrt-onboarding-complete`
- No OPENROUTER_API_KEY secret exists
- OpenRouter tool is available

### Customization

#### Styling
The onboarding uses RCRT theme colors:
```javascript
primaryColor: '#00f5ff',      // RCRT primary cyan
backgroundColor: '#1a1d2e',   // Dark background
overlayColor: 'rgba(0, 0, 0, 0.8)'
```

#### Steps
Steps are defined in the `steps` array and can be customized:
- Add/remove steps
- Change content and placement
- Modify spotlight behavior

## Testing

### Reset Onboarding
To test the onboarding flow again:

1. Open browser console at http://localhost:8082
2. Run: `localStorage.removeItem('rcrt-onboarding-complete')`
3. Refresh the page

### Manual Trigger
For development testing:
```javascript
// Remove completion flag
localStorage.removeItem('rcrt-onboarding-complete');

// Manually start onboarding
window.dispatchEvent(new Event('rcrt-start-onboarding'));
```

## Troubleshooting

### Onboarding Not Showing
- Check if `rcrt-onboarding-complete` exists in localStorage
- Verify no OPENROUTER_API_KEY secret exists
- Ensure openrouter tool is loaded

### Tour Steps Not Working
- Verify `data-tour` attributes are present
- Check browser console for errors
- Ensure elements are visible when tour runs

### Style Issues
- Check if Tailwind classes are being applied
- Verify react-joyride styles are loaded
- Look for CSS conflicts

## Future Enhancements

1. **Multi-Step Wizards**
   - Add more configuration wizards
   - Guide through agent creation
   - Tool configuration helpers

2. **Progress Tracking**
   - Show completion percentage
   - Allow resuming interrupted tours
   - Track which steps were viewed

3. **Context-Sensitive Help**
   - Tooltips for complex features
   - Just-in-time education
   - Feature discovery prompts

4. **Personalization**
   - Different paths for different user types
   - Skip steps based on existing setup
   - Remember user preferences
