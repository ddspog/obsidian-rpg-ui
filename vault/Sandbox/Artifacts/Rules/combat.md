---
source:
  system: tov
  book: Player's Guide
  company: Kobold Press
---
# Combat Rules — Source
Phase 3 demo: this file has multiple `rpg rule.content` blocks each with an `id` + `values` map. The companion file `Sandbox/Tests/30-TEST-RULE-CALLS.md` imports from here via `@[[file]].fn()` calls.
## CONTENTS
```rpg rule.content
id: grapple
name: Grapple
action: Attack action
range: Reach
contest: athletics
cost: 1 attack
view: p
values:
  contest: STR (Athletics) vs STR (Athletics) or DEX (Acrobatics)
  size_diff_max: 1
  speed_when_grappled: 0
---
Using the Attack action, you can make a special melee attack to grab a creature within reach. The target must be no more than one size larger than you. On success, the target is **grappled** and its speed becomes 0 until the grapple ends.
```
```rpg rule.content
id: shove
name: Shove
action: Attack action
range: Reach
contest: athletics
cost: 1 attack
view: p
values:
  contest: STR (Athletics) vs STR (Athletics) or DEX (Acrobatics)
  outcomes: knock prone | push 5 ft
---
Using the Attack action, you can shove a creature within reach. On success, you either knock the target prone or push it 5 feet away.
```
```rpg rule.content
id: opportunity
name: Opportunity Attack
action: Reaction
range: Reach
trigger: creature leaves your reach
cost: reaction
view: p
values:
  trigger: creature leaves your reach
  cost: reaction
---
When a hostile creature you can see moves out of your reach, you can use your reaction to make one melee attack against it.
```
$$START Ignored$$
```rpg rule.related
level: 2
entries:
- See also: "@[[Luck]].bare()"
```
```rpg rule.notes
**Author's note:** These rules were adjusted in v1.2 after playtest feedback from the Thursday group. The grapple size-diff max used to be 2; we're testing with 1 to keep small creatures viable.

Related discussion: [[2026-04-15 session log#Grapple edge cases]].
```
$$END Ignored$$
(Both the `rule.related` and `rule.notes` blocks above render here when the file is read directly. When the file is imported via \`@[[combat]].h3()\`, both get stripped — that's the local-only behavior.)
