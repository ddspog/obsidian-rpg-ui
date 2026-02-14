# Build Verification Test

## Purpose

This file helps verify you're running the correct build of the plugin with the unified `rpg` namespace support.

## Quick Check

Create this simple test in any note:

```rpg test
This is a test block
```

## Expected Behavior

### If Plugin is Correctly Built and Loaded:

**You WILL see in console:**
```
DnD UI Toolkit: Fence line: "```rpg test"
DnD UI Toolkit: Extracted meta: "test"
DnD UI Toolkit: Processing rpg block with meta: test
DnD UI Toolkit: Unknown rpg block type: test
```

**You WILL see in the note:**
- An error notice saying: "Unknown rpg block type: test"

This confirms:
- ✅ Plugin is loaded
- ✅ `rpg` processor is registered
- ✅ Meta extraction works
- ✅ Debug logging works

### If Plugin is NOT Correctly Built:

**You will see:**
- Just the raw markdown with no rendering
- NO console messages starting with "DnD UI Toolkit:"
- The text "This is a test block" in a code block

This means:
- ❌ Plugin not loaded OR
- ❌ Old build without `rpg` processor OR
- ❌ Build failed

## How to Fix

### Step 1: Check Plugin is Enabled

Settings → Community Plugins → Look for "DnD UI Toolkit"

- If disabled: Enable it
- If not listed: Plugin not installed correctly

### Step 2: Rebuild Plugin

```bash
cd /path/to/obsidian-rpg-ui
npm install
npm run build
```

**Expected output:**
```
> obsidian-sample-plugin@1.0.0 build
> tsc -noEmit -skipLibCheck && node esbuild.config.mjs production

  styles.css  18.9kb

⚡ Done in Xms
```

### Step 3: Copy Files to Vault

If not using PLUGIN_DIR environment variable, manually copy:

From repository:
- `main.js` (should be ~XXX KB)
- `styles.css` (should be ~19 KB)
- `manifest.json`

To vault location:
```
<your-vault>/.obsidian/plugins/obsidian-rpg-ui/
```

### Step 4: Verify File Dates

Check the modification date of `main.js` in your plugin folder:
- Should be TODAY's date
- Should be AFTER you ran the build

### Step 5: Reload Obsidian

- Close all Obsidian windows
- Reopen Obsidian
- Open console BEFORE creating any blocks
- Check for plugin loading messages

### Step 6: Test Again

1. Create the test block above
2. Check console for "DnD UI Toolkit:" messages
3. Should see the error notice about "Unknown rpg block type: test"

## Troubleshooting

### Problem: Build fails

**Check for errors in build output**

Common issues:
- Node modules not installed: Run `npm install`
- TypeScript errors: These are expected (pre-existing), build should still work
- esbuild not found: Run `npm install` again

### Problem: No main.js after build

**Check esbuild.config.mjs exists**

The build uses esbuild. If it fails silently, try:
```bash
node esbuild.config.mjs production
```

### Problem: Plugin shows in Settings but doesn't work

**Check browser console for errors**

Look for:
- JavaScript errors when plugin loads
- "Failed to load plugin" messages
- Any red error messages

### Problem: Still no debug messages

**Verify the build includes our changes**

Open `main.js` in a text editor and search for:
- "DnD UI Toolkit" (should appear multiple times)
- "registerMarkdownCodeBlockProcessor" (should appear multiple times)
- "extractMeta" (should appear)

If not found: Build is from wrong branch or old version.

## Success Criteria

- [ ] `npm run build` completes successfully
- [ ] `main.js` exists and is recent (today's date)
- [ ] Plugin shows as enabled in Settings
- [ ] Test block shows error notice in note
- [ ] Console shows "DnD UI Toolkit:" debug messages
- [ ] Error message is "Unknown rpg block type: test"

Once these all pass, the `rpg consumable` blocks should work!

## Next Steps

If build verification passes but `rpg consumable` still doesn't work:
1. Share full console output
2. Try manual tests 01-10
3. Check for any JavaScript errors
4. Verify `rpg` blocks with other meta types (attributes, skills, etc.)
