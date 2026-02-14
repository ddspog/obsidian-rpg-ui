# Inventory Block

The `rpg inventory` block allows you to track items, equipment, currency, and encumbrance in your character sheets.

## Basic Example

~~~markdown
```rpg inventory
state_key: ranger-inventory
currency:
  gold: 50
  silver: 120
  copper: 30
sections:
  - name: "Equipped"
    items:
      - name: "Longbow +1"
        weight: 2
        quantity: 1
        tags: [weapon, magical]
        description: "+1 to attack and damage rolls"
      - name: "Studded Leather Armor"
        weight: 13
        quantity: 1
        tags: [armor]
  - name: "Backpack"
    items:
      - name: "Rope (50 ft)"
        weight: 10
        quantity: 1
      - name: "Rations"
        weight: 1
        quantity: 5
        consumable: true
encumbrance:
  capacity: "{{multiply strength 15}}"
```
~~~

## YAML Structure

### Top-level fields

- `state_key` (optional): Unique identifier for persisting UI state
- `currency`: Object containing currency amounts
- `sections`: Array of item sections
- `encumbrance`: Encumbrance calculation settings

### Currency

The `currency` object can include:
- `platinum`: Platinum pieces (1 PP = 1000 CP)
- `gold`: Gold pieces (1 GP = 100 CP)
- `electrum`: Electrum pieces (1 EP = 50 CP)
- `silver`: Silver pieces (1 SP = 10 CP)
- `copper`: Copper pieces

### Sections

Each section represents a category of items (e.g., "Equipped", "Backpack", "Magic Items"):

- `name`: Section heading
- `items`: Array of item objects

### Items

Each item has:
- `name`: Item name (required)
- `weight`: Weight in pounds (optional)
- `quantity`: Number of items (optional, defaults to 1)
- `tags`: Array of string tags (optional)
- `description`: Item description (optional)
- `consumable`: Boolean indicating if item is consumable (optional)

### Encumbrance

The `encumbrance` object defines carrying capacity:
- `capacity`: Template string for calculating max weight (e.g., `"{{multiply strength 15}}"`)

The capacity template has access to all frontmatter fields and ability scores.

## Display Features

- **Currency Display**: Shows all non-zero currency amounts with labels
- **Encumbrance Bar**: Visual progress bar showing current/max carrying capacity
- **Item Sections**: Collapsible sections organizing items by category
- **Item Details**: Each item shows name, quantity (if > 1), weight, description, and tags

## Phase 2 Limitations

In Phase 2, the inventory block is **read-only**. Future phases will add:
- Inline editing (add/remove items, adjust quantities)
- Consumable item tracking with use buttons
- Integration with event system for automatic resets
- Write-back to code block YAML via `vault.process()`
