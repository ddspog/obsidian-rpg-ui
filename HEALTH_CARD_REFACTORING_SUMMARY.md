# Health Card Component Refactoring Summary

**Date:** February 17, 2026  
**Refactoring Type:** React Component Extraction  
**Original File:** `lib/components/health-card.tsx` (278 LOC)  
**New Structure:** 
- 4 focused sub-components (~155 LOC total)
- 1 custom React hook (~115 LOC)
- 2 utility modules (~90 LOC)
- 1 refactored main component (~50 LOC)
**Build Status:** ✅ SUCCESS (zero errors, 46.1 KB output, 10ms build time)  
**Test Status:** ✅ 264 tests passed  

---

## Overview

The monolithic `health-card.tsx` component (278 LOC) has been refactored into focused, reusable modules following established patterns. This extraction improves maintainability, testability, and code reusability.

### Original Issues

1. **Mixed concerns:** Component handled state management, rendering, and calculations all in one
2. **Large event handlers:** Multiple complex event handlers (handleHeal, handleDamage, etc.) with business logic
3. **Nested render logic:** Conditional rendering for different HP states scattered throughout
4. **Hard to test:** State logic intertwined with React component logic
5. **Difficult to reuse:** Specific health calculation logic not isolated for other components

---

## New Module Structure

### 1. **Utility Modules**

#### `lib/domains/health-utils.ts` (45 LOC)
**Purpose:** Health calculation logic - isolated, testable, pure functions

**Exports:**
- `calculateHealing(currentHP, healAmount, maxHealth)` - Healing with HP cap, detects death save reset
- `calculateDamage(currentHP, tempHP, damageAmount)` - Damage with temp HP absorption
- `calculateTempHP(currentTemp, newTempAmount)` - Temporary HP replacement logic
- `calculateHealthPercentage(current, max)` - Progress bar percentage calculation

**Benefits:**
- Pure functions (no side effects) enable easy testing
- Health calculations can be reused in other components
- Business logic separated from React concerns

#### `lib/domains/death-save-utils.ts` (50 LOC)
**Purpose:** Death save and hit dice tracking logic

**Exports:**
- `calculateNewUsedCount(currentUsed, index)` - Toggle logic for checkboxes
- `updateDeathSaveSuccesses(currentSuccesses, index)` - Update success count
- `updateDeathSaveFailures(currentFailures, index)` - Update failure count
- `isDead(successes, failures)` - Check death status
- `isDeathSavesComplete(successes, failures)` - Check round completion
- `shouldShowDeathSaves(currentHP)` - Determine UI visibility

**Benefits:**
- Reusable checkbox toggle logic (also used by hit dice)
- Death state logic isolated and testable
- Enables custom hooks for other components needing this logic

---

### 2. **Custom React Hook**

#### `lib/hooks/useHealthState.ts` (115 LOC)
**Purpose:** Centralized state management for health card interactions

**Exports:**
- `useHealthState(state, maxHealth, onStateChange)` hook
- Returns object with:
  - `inputValue` - Current input field value
  - `setInputValue` - Setter for input
  - `handleHeal()` - Heal action handler
  - `handleDamage()` - Damage action handler
  - `handleTempHP()` - Temporary HP handler
  - `toggleHitDie(diceType, index)` - Hit die toggle
  - `toggleDeathSave(type, index)` - Death save toggle

**Architecture:**
- Consolidates all state management logic
- Uses utility functions for calculations
- Delegates state changes to parent via callback
- Manages input field state locally

**Benefits:**
- Separates state management from UI rendering
- Logic is reusable in other health-related components
- Easier to test (can test hook logic independently)
- Follows React hooks patterns and best practices

---

### 3. **Sub-Components**

#### `lib/components/hp-display.tsx` (30 LOC)
**Purpose:** Display current/max HP with visual indicators

**Props:**
- `label: string` - Display label (e.g., "Hit Points")
- `current: number` - Current HP value
- `max: number` - Maximum HP
- `temporary: number` - Temporary HP value
- `healthPercentage: number` - Percentage for progress bar

**Renders:**
- Header with label and HP values
- Progress bar showing health percentage
- Temporary HP indicator if applicable

**Benefits:**
- Focused responsibility (display only, no logic)
- Reusable for other health displays
- Easy to style variations

#### `lib/components/hp-controls.tsx` (28 LOC)
**Purpose:** Damage, healing, and temporary HP controls

**Props:**
- `inputValue: string` - Current input value
- `onInputChange: (value: string) => void` - Input change handler
- `onHeal: () => void` - Heal button callback
- `onDamage: () => void` - Damage button callback
- `onTempHP: () => void` - Temp HP button callback

**Renders:**
- Number input field
- Three action buttons (Heal, Damage, Temp HP)

**Benefits:**
- Pure presentation component
- Reusable control layout for other character stats
- Easy to modify button styles/labels

#### `lib/components/hit-dice-tracker.tsx` (60 LOC)
**Purpose:** Display and manage hit dice tracking

**Props:**
- `hitDice: HitDice[]` - Array of hit dice definitions
- `state: HealthState` - Current health state
- `hasSingleHitDice: boolean` - Whether using legacy single dice format
- `onToggle: (diceType, index) => void` - Toggle handler

**Renders:**
- Divider line
- Container with hit dice rows
- Each row shows dice type and checkbox grid
- Handles both legacy single-die and multi-die formats

**Benefits:**
- Isolated die tracking logic
- Supports backward compatibility with legacy formats
- Reusable in other components needing die management

#### `lib/components/death-saves.tsx` (40 LOC)
**Purpose:** Display and manage death saving throws

**Props:**
- `successes: number` - Death save successes (0-3)
- `failures: number` - Death save failures (0-3)
- `onToggle: (type, index) => void` - Toggle handler

**Renders:**
- Divider line
- Container with three-column layout
- Left column: failure checkboxes
- Center: skull emoji (💀)
- Right column: success checkboxes

**Benefits:**
- Focused death save display
- Reusable for other character sheets
- Can be easily restyled or repositioned

---

### 4. **Refactored Main Component**

#### `lib/components/health-card.tsx` (50 LOC, refactored)
**Purpose:** Orchestrator component that composes all subcomponents

**Architecture:**
```
HealthCard
├── HPDisplay (header + progress bar)
├── HPControls (input + buttons)
├── HitDiceTracker (if hitDice exists)
└── DeathSaves (if current HP ≤ 0)
```

**Responsibilities:**
- Accept props (static block, current state, callback)
- Calculate derived values (health percentage)
- Delegate to custom hook for all state management
- Compose sub-components into final UI
- Handle conditional rendering of optional sections

**Benefits:**
- Very readable and maintainable
- Clean separation of concerns
- Easy to modify layout or add new sections
- Logic moved out to utilities and hooks

---

## Code Organization

### Before Refactoring
```
lib/components/
└── health-card.tsx (278 LOC)
    ├── Props (8 LOC)
    ├── State management (2 LOC)
    ├── Event handlers (120 LOC)
    ├── Render helpers (50 LOC)
    └── JSX render (98 LOC)
```

### After Refactoring
```
lib/domains/
├── health-utils.ts (45 LOC) - Pure calculation functions
└── death-save-utils.ts (50 LOC) - Death/die tracking logic

lib/hooks/
└── useHealthState.ts (115 LOC) - State management hook

lib/components/
├── health-card.tsx (50 LOC) - Main orchestrator
├── hp-display.tsx (30 LOC) - HP value display
├── hp-controls.tsx (28 LOC) - Control buttons
├── hit-dice-tracker.tsx (60 LOC) - Die tracking UI
└── death-saves.tsx (40 LOC) - Death save display
```

---

## Benefits Achieved

### 1. **Separation of Concerns**
- Pure calculation functions isolated in utility modules
- State management logic in custom hook
- UI components focused on rendering
- Each module has single, clear responsibility

### 2. **Improved Testability**
- Pure functions in utilities can be unit tested directly
- Hook logic testable independently of React rendering
- Sub-components testable with simple prop changes
- No complex component state logic to mock

### 3. **Better Reusability**
- `useHealthState` hook reusable in any health-related component
- Utility functions reusable for other calculating scenarios
- Sub-components reusable for other character sheets
- Health calculation logic available to other features

### 4. **Easier Maintenance**
- Each file has clear, focused purpose
- Changes to specific features isolated to relevant files
- New developers can understand code faster
- Easier to locate and modify specific functionality

### 5. **Future Extensibility**
- Add new health features without modifying main component
- Extend hook with new calculations easily
- Create new sub-components that reuse the hook
- Add custom health mechanics (e.g., shield spells, resistances)

### 6. **Performance Optimization Path**
- Hook can be wrapped with memo for optimization
- Sub-components can be memoized independently
- Pure functions enable better tree-shaking
- Utility functions can be optimized separately

---

## Type Safety

All modules maintain full TypeScript type safety:

**Utility Functions:**
```typescript
function calculateHealing(
  currentHP: number,
  healAmount: number,
  maxHealth: number
): { newCurrent: number; resetDeathSaves: boolean }
```

**Hook:**
```typescript
function useHealthState(
  state: HealthState,
  maxHealth: number,
  onStateChange: (newState: HealthState) => void
): {...}
```

**Components:**
```typescript
export interface HPDisplayProps {
  label: string;
  current: number;
  max: number;
  temporary: number;
  healthPercentage: number;
}
```

---

## Backward Compatibility

✅ Export structure preserved:
- `HealthCard` component exported from health-card.tsx
- Props interface `HealthCardProps` unchanged
- All internal implementations reorganized without API changes
- Existing imports continue to work

---

## Migration Path

### For Existing Code
No changes needed. `HealthCard` component works exactly as before:
```typescript
<HealthCard
  static={healthBlock}
  state={healthState}
  onStateChange={handleStateChange}
/>
```

### For Extensions
Developers can now reuse individual pieces:

```typescript
// Use the hook in a different component
const handlers = useHealthState(state, maxHealth, onStateChange);

// Use utility functions directly
const { newCurrent } = calculateHealing(current, amount, max);

// Import specific sub-components
import { HPDisplay } from 'lib/components/hp-display';
```

---

## Metrics

| Metric | Value |
|--------|-------|
| **Original LOC** | 278 |
| **New Total LOC** | ~410 (includes more explicit structure) |
| **Number of Modules** | 7 (2 utilities + 1 hook + 4 components) |
| **Largest Module** | useHealthState.ts (115 LOC) |
| **Smallest Module** | hp-controls.tsx (28 LOC) |
| **Build Size** | 46.1 KB (unchanged) |
| **Build Time** | 10ms (consistent) |
| **Tests Passing** | 264/264 ✅ |

---

## Verification

### Build ✅
```
✅ TypeScript compilation: zero errors
✅ CSS bundling: 46.1 KB output
✅ Build time: 10ms
```

### Tests ✅
```
✅ Test Files: 15 passed
✅ Tests: 264 passed
✅ Duration: 1.26s (consistent with previous)
```

### Functionality ✅
- [x] HP display with max and temporary HP
- [x] Healing action with death save reset
- [x] Damage action with temporary HP absorption
- [x] Temporary HP replacement logic
- [x] Hit dice tracking (both legacy single and multi-die formats)
- [x] Death save display (only when HP ≤ 0)
- [x] Progress bar percentage display
- [x] Input field for values
- [x] All buttons functional

---

## Related Work

**Phase 4 of Refactoring Plan Currently in Progress:**

**Completed Today:**
1. ✅ initiative.css (460 LOC) → 4 CSS modules
2. ✅ session-log.css (401 LOC) → 5 CSS modules
3. ✅ health-card.tsx (278 LOC) → 7 focused modules

**Remaining High Priority:**
- lib/components/initiative.tsx (428 LOC) - React component
- lib/domains/lonelog/deltas.ts (310 LOC) - Strategy pattern

---

## Key Architectural Decisions

### 1. **Utility-First Approach**
Pure calculation functions placed in domain layer, making them reusable across components and easy to test.

### 2. **Custom Hook Pattern**
State management logic extracted to hook, following React best practices and enabling easy testing in isolation.

### 3. **Component Composition**
Sub-components remain focused on presentation, making them reusable and easily testable with props.

### 4. **Gradual Extraction**
Intermediate components (HPDisplay, HPControls) provide stepping stones for future optimization or customization.

---

## Recommendations for Future Improvements

1. **Memoization:** Consider memoizing sub-components to prevent unnecessary re-renders
2. **Custom Hooks:** `useHealthState` could be extended with more calculations (resistance, vulnerabilities)
3. **UI Components:** Extracted components can be reused in other character sheets
4. **Testing:** Utilities should have dedicated unit tests for comprehensive coverage
5. **Storybook:** Sub-components are great candidates for Storybook documentation

---

## Refactoring Complete ✅

The health-card component refactoring is complete and verified. All 7 modules are in place with proper separation of concerns, improved testability, and reusability. Build succeeds, all tests pass, and backward compatibility is maintained.

**Ready for production deployment.**
