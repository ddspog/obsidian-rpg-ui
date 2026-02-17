# Test 14: System Mapping

This test validates the system mapping functionality in plugin settings.

## Test Purpose

Verify that:
1. System files can be mapped to specific folders
2. Files in mapped folders use the correct system
3. The file autocomplete works in settings
4. Multiple mappings can be configured
5. Default system is used when no mapping exists

## Prerequisites

- Plugin installed and enabled
- Test vault contains the example system files in `System-Split/`
- Open Settings → DnD UI Toolkit

## Test Steps

### Test 1: Add System Mapping with Autocomplete

**Steps:**
1. Go to Settings → DnD UI Toolkit → Systems section
2. Click "Add System Mapping" button
3. In the "Folder path" field, enter: `Session-Tests`
4. Click in the "System file" field
5. Start typing: `System-Split`

**Expected Result:**
- ✅ Autocomplete dropdown appears below input
- ✅ Shows matching file paths from the vault
- ✅ Can select `System-Split/System/DnD5e-System.md` from dropdown
- ✅ Arrow keys navigate suggestions
- ✅ Enter key selects highlighted suggestion

**Success Criteria:**
- [ ] Autocomplete dropdown displays
- [ ] File paths are filtered as you type
- [ ] Keyboard navigation works (Up/Down/Enter)
- [ ] Selected file populates the input field

### Test 2: Create Character in Mapped Folder

**Steps:**
1. Create mapping: `Session-Tests` → `System-Split/System/DnD5e-System.md`
2. Save settings
3. Create a new file: `Session-Tests/TestCharacter.md`
4. Add this content:

````markdown
```rpg ability-scores
strength: 16
dexterity: 14
constitution: 15
intelligence: 8
wisdom: 12
charisma: 10
```
````

5. Switch to Reading View

**Expected Result:**
- ✅ Ability scores render using the mapped system
- ✅ System-specific skill list is available if using `rpg skills` block
- ✅ Expressions from the mapped system are used

**Success Criteria:**
- [ ] Components render correctly
- [ ] System from `System-Split` is being used
- [ ] Console shows: "Loaded RPG system: D&D 5e from System-Split/System/DnD5e-System.md"

### Test 3: Verify Default System for Unmapped Folders

**Steps:**
1. Ensure no mapping exists for root folder ("")
2. Create a file in root: `RootCharacter.md`
3. Add same ability scores block as Test 2
4. Switch to Reading View

**Expected Result:**
- ✅ Uses default D&D 5e system (built-in)
- ✅ Ability scores render correctly
- ✅ No errors in console

**Success Criteria:**
- [ ] Components render with default system
- [ ] No mapping errors in console

### Test 4: Multiple Mappings

**Steps:**
1. Add these mappings:
   - `Session-Tests` → `System-Split/System/DnD5e-System.md`
   - `System-Inline` → `System-Inline/DnD5e-System.md`
2. Open `System-Inline/DnD5e-System.md`
3. Switch to Reading View

**Expected Result:**
- ✅ System info card displays
- ✅ Skills grid shows all skills
- ✅ Expression cards render formulas
- ✅ Uses the inline system definition

**Success Criteria:**
- [ ] Multiple mappings can coexist
- [ ] Each folder uses its mapped system
- [ ] No conflicts between mappings

### Test 5: Remove Mapping

**Steps:**
1. In settings, find a mapping
2. Click the trash icon next to it
3. Confirm mapping is removed
4. Open a file in the previously mapped folder

**Expected Result:**
- ✅ Mapping is removed from list
- ✅ File now uses default system
- ✅ No errors

**Success Criteria:**
- [ ] Mapping removed successfully
- [ ] Files fall back to default system
- [ ] Settings save correctly

### Test 6: Autocomplete Behavior

**Steps:**
1. Add a new mapping
2. In "System file" field, test these inputs:
   - Type "System" → shows all files with "System" in path
   - Type "DnD" → shows all files with "DnD" in path
   - Type ".md" → shows all markdown files
   - Press Escape → closes dropdown
   - Click outside → closes dropdown

**Expected Result:**
- ✅ Filtering works correctly
- ✅ Dropdown closes on Escape
- ✅ Dropdown closes on blur
- ✅ Case-insensitive search

**Success Criteria:**
- [ ] Search filters files correctly
- [ ] Escape key closes dropdown
- [ ] Click outside closes dropdown
- [ ] Case doesn't matter for search

## Troubleshooting

**Autocomplete not showing:**
- Check that `.md` files exist in vault
- Ensure you're clicking in the System file field (second text input)
- Try typing a partial file name

**Wrong system being used:**
- Check mapping configuration in settings
- Verify file is in correct folder
- Check console for "Loaded RPG system" messages
- Ensure system file path is correct

**Mapping not saving:**
- Check for console errors
- Verify system file exists at specified path
- Try removing and re-adding mapping

## Expected Console Output

When working correctly, you should see:

```
Loaded RPG system: D&D 5e from System-Split/System/DnD5e-System.md
```

No errors should appear when using mapped systems.

## Success Summary

All tests pass when:
- [ ] Autocomplete works for system file selection
- [ ] Files in mapped folders use correct system
- [ ] Default system used for unmapped folders
- [ ] Multiple mappings can coexist
- [ ] Mappings can be added and removed
- [ ] No console errors during normal operation
