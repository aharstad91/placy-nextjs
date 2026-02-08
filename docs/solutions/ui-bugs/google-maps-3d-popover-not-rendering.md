---
title: Google Maps 3D PopoverElement Not Rendering
date: 2026-02-03
category: ui-bugs
module: map_3d
tags:
  - google-maps
  - popover
  - react
  - 3d-maps
  - web-components
severity: medium
status: resolved
component: components/map/poi-marker-3d.tsx
symptoms:
  - PopoverElement created but not visible in DOM
  - Console logs show popover created and opened
  - No UI elements displayed on 3D map
  - Action buttons missing from active markers
related_issues: []
---

# Google Maps 3D PopoverElement Not Rendering

## Problem

PopoverElement for Google Maps 3D was being created and marked as `open: true` in console logs, but no visual popover appeared on the map. The goal was to display action buttons (3D toggle + travel time) next to active POI markers using Google's PopoverElement API.

### Observable Symptoms

1. **Console logs indicated success**:
   ```
   ✅ Popover created and appended to map3d
   ✅ POIMarker3D: Popover configured and opened
   ```

2. **But DOM showed zero popover elements**:
   ```javascript
   document.querySelectorAll('gmp-popover').length // 0
   ```

3. **Investigation revealed**:
   - Popover existed as child of `gmp-map-3d`
   - Had `open: true` and correct `positionAnchor`
   - But rendered with `width: 0, height: 0`
   - HTML content was present but not visible

## Root Causes

### 1. React StrictMode Double-Mount Race Condition

React StrictMode causes components to mount → unmount → remount. This created a race condition:

```typescript
useEffect(() => {
  let mounted = true;

  const initPopover = async () => {
    const { PopoverElement } = await google.maps.importLibrary("maps3d");

    // ❌ PROBLEM: cleanup runs BEFORE this check
    if (!mounted) return;

    const popover = new PopoverElement({ open: false });
    // Never reached in StrictMode
  };

  initPopover();

  return () => {
    mounted = false; // Runs before async completes!
  };
}, [map3d]);
```

**Timeline:**
1. First mount: Start async `importLibrary`
2. Cleanup runs: Set `mounted = false`
3. Async completes: Check `if (!mounted) return` → skip popover creation
4. Remount: Same problem repeats

### 2. Incorrect HTML Content Approach

Initially tried several wrong approaches:

**❌ Attempt 1: Complex DOM elements**
```typescript
const content = document.createElement('div');
const button = document.createElement('button');
// ... complex DOM tree
sharedPopover.append(content); // Not rendered
```

**❌ Attempt 2: HTML string**
```typescript
const htmlContent = `<div>...</div>`;
sharedPopover.append(htmlContent); // Rendered as TEXT, not HTML
```

**❌ Attempt 3: innerHTML without slots**
```typescript
sharedPopover.innerHTML = htmlContent; // Partially worked, no structure
```

## Solution

### 1. Fix React StrictMode Race Condition

Use `cleanedUp` flag that persists across the async boundary:

```typescript
useEffect(() => {
  if (!map3d) return;

  // Flag to track if cleanup has run
  let cleanedUp = false;

  const initPopover = async () => {
    try {
      const { PopoverElement } = await google.maps.importLibrary("maps3d") as google.maps.Maps3DLibrary;

      // ✅ Check AFTER async completes
      if (cleanedUp) {
        console.log('⚠️ Cleanup ran before async completed, skipping popover creation');
        return;
      }

      const popover = new PopoverElement({
        open: false,
      });

      // Append to map (makes it available in the 3D scene)
      map3d.append(popover);

      // Set ref after successful append
      sharedPopoverRef.current = popover;

      console.log('✅ Popover created and appended to map3d');

    } catch (err) {
      console.error("Failed to create shared popover:", err);
    }
  };

  initPopover();

  return () => {
    cleanedUp = true;
    console.log('🧹 Cleanup: removing popover');
    if (sharedPopoverRef.current) {
      sharedPopoverRef.current.remove();
      sharedPopoverRef.current = null;
    }
  };
}, [map3d]);
```

### 2. Use Slot-Based DOM Elements

Google Maps PopoverElement uses Web Component slots (`header` and `default`):

```typescript
if (isActive && travelTime && onToggle3D) {
  // Create header slot with 3D toggle button
  const header = document.createElement('div');
  header.slot = 'header';
  header.style.cssText = 'display: flex; justify-content: center;';

  const button3d = document.createElement('button');
  button3d.style.cssText = `
    width: 44px;
    height: 44px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: white;
    border: 1px solid #e5e7eb;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    cursor: pointer;
    transition: transform 0.2s;
  `;
  button3d.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#374151" stroke-width="2">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
      <line x1="12" y1="22.08" x2="12" y2="12"></line>
    </svg>
  `;

  // ✅ Real event handlers work
  button3d.onmouseenter = () => button3d.style.transform = 'scale(1.1)';
  button3d.onmouseleave = () => button3d.style.transform = 'scale(1)';
  button3d.onclick = (e) => {
    e.stopPropagation();
    onToggle3D();
  };

  header.appendChild(button3d);

  // Create default slot with travel time display
  const content = document.createElement('div');
  content.slot = 'default';
  content.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 16px;
    border-radius: 24px;
    background: white;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    font-size: 14px;
    font-weight: 500;
    color: #374151;
    font-family: system-ui, -apple-system, sans-serif;
    margin-top: 8px;
  `;
  content.innerHTML = `
    <span>${travelTime}min</span>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2">
      <path d="${travelIcon}"></path>
    </svg>
  `;

  // ✅ Clear and append slotted content
  sharedPopover.innerHTML = '';
  sharedPopover.append(header);
  sharedPopover.append(content);

  // Position and open
  sharedPopover.positionAnchor = markerRef.current;
  sharedPopover.open = true;
}
```

## Key Learnings

### 1. React StrictMode + Async = Race Conditions

When using async operations in `useEffect`:
- **Don't rely on `mounted` flag** - cleanup runs before async completes
- **Use `cleanedUp` flag** - check AFTER async operation finishes
- **Set refs after append** - ensures DOM element exists before storing reference

### 2. Web Component Slots Are Required

PopoverElement expects proper slot structure:
- `slot="header"` - Header content (typically title or primary action)
- `slot="default"` - Main content body
- **Don't use**: `innerHTML` with flat HTML string
- **Do use**: DOM elements with `element.slot = 'header'`

### 3. Google Maps 3D PopoverElement Best Practices

From [Google Maps 3D Popovers documentation](https://developers.google.com/maps/documentation/javascript/3d/popovers):

✅ **Recommended**:
- One reusable PopoverElement per map
- Update `positionAnchor` to reposition
- Use slots for structured content
- Anchor to `Marker3DInteractiveElement` only

❌ **Avoid**:
- Multiple open popovers simultaneously
- Complex nested HTML without slots
- Setting `positionAnchor` in constructor (update dynamically instead)

## Prevention Strategies

### 1. Test with React StrictMode

Always develop with StrictMode enabled to catch async race conditions early:

```typescript
// next.config.js
module.exports = {
  reactStrictMode: true, // Keep this ON
}
```

### 2. Pattern for Async in useEffect

```typescript
useEffect(() => {
  let cleanedUp = false;

  const asyncWork = async () => {
    const result = await someAsyncOperation();

    if (cleanedUp) return; // ✅ Check after async

    // Safe to use result
    doSomethingWith(result);
  };

  asyncWork();

  return () => {
    cleanedUp = true;
  };
}, [deps]);
```

### 3. Validate Slot Usage

When using Web Components with slots:

```typescript
// ✅ Always set slot attribute
const element = document.createElement('div');
element.slot = 'header'; // Required!

// ✅ Verify slots in DevTools
console.log({
  hasHeader: !!popover.querySelector('[slot="header"]'),
  hasDefault: !!popover.querySelector('[slot="default"]')
});
```

## Testing Verification

After implementing the fix:

1. **Visual confirmation**: Popover appears as white box with action buttons on 3D map
2. **Console logs**: No "Cleanup ran before async completed" warnings
3. **DOM inspection**: `document.querySelector('gmp-popover')` returns element
4. **Interaction**: Button hover effects and click handlers work correctly

## Related Documentation

- [Google Maps 3D Popovers](https://developers.google.com/maps/documentation/javascript/3d/popovers)
- [PopoverElement Example](https://developers.google.com/maps/documentation/javascript/examples/3d/popover-marker)
- [React useEffect Cleanup](https://react.dev/reference/react/useEffect#my-cleanup-logic-runs-even-though-my-component-didnt-unmount)

## Code References

- `components/map/poi-marker-3d.tsx:301-335` - Race condition fix
- `components/map/poi-marker-3d.tsx:201-269` - Slot-based content implementation
