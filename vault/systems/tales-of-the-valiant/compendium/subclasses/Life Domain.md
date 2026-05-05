---
.metadata:
  cssclasses: [note-class, rpg-ui]
.SUBCLASS:
  parent_class: Cleric
---
# Life Domain
Gods of the Life domain celebrate natural cycles of life and death, exemplifying health and vitality. Devotees of this domain are encouraged to heal the wounded, care for the sick, and oppose the perversion of undeath.
```rpg table.progression
|CLERIC LEVEL|FEATURES|
|---|---|
|3rd|Channel Divinity: Preserve Life, Disciple of Life, Life Domain Spells|
|7th|Blessed Healer|
|11th|Greater Preservation|
|15th|Perfect Healing|
[LIFE DOMAIN PROGRESSION #css/tx/table]
```
```rpg feature.details
name: Channel Divinity
subtitle: "3rd-Level Life Feature"
level: 3
text: |
  ![[life-domain.webp|right|384]] You gain the following Channel Divinity option. 
  ###### Channel Divinity: Preserve Life 
  As an action, you present your holy symbol and evoke healing energy that can restore a number of hit points equal to 5 × your cleric level.

  Choose any creatures within 30 feet of you and divide those hit points among them. This feature can restore a creature to no more than half of its hit point maximum. This healing has no effect on Undead or Constructs.
action:
  name: Preserve Life
  resource: Channel Divinity
  text: |
    As an action, you present your holy symbol and evoke healing energy that can restore a number of hit points equal to 5 × your cleric level.

    Choose any creatures within 30 feet of you and divide those hit points among them. This feature can restore a creature to no more than half of its hit point maximum. This healing has no effect on [[Undead]] or [[Constructs]]. 
traits:
  Channel Divinity: Preserve Life
```
```rpg feature.details
name: Disciple of Life
subtitle: "3rd-Level Life Feature"
level: 3
type: passive
text: |
  Your healing spells are more effective. When you use a [[Divine]] spell of 1st circle or higher to restore hit points to a creature, the creature regains additional hit points equal to 2 + the spell’s circle.
```
```rpg feature.details
name: Life Domain Spells
subtitle: "3rd-Level Life Feature"
level: 3
text: |
  You gain domain spells at the cleric levels listed in the **Life Domain Spells** table. See the Cleric Subclass class feature for how these spells work.
spellcasting:
  prepared:
    3: [ [[bless]], [[cure wounds]], [[gentle repose]], [[restoration]] ]
    5: [ [[mass healing word]], [[revivify]] ]
    7: [ [[death ward]], [[guardian of faith]] ]
    9: [ [[greater restoration]], [[mass cure wounds]] ]
```
```rpg table.life-domain-spells
|CLERIC LEVEL|SPELLS|
|---|---|
|3|[[bless]], [[cure wounds]], [[gentle repose]], [[restoration]]|
|5|[[mass healing word]], [[revivify]]|
|7|[[death ward]], [[guardian of faith]]|
|9|[[greater restoration]], [[mass cure wounds]]|
[LIFE DOMAIN SPELLS #css/tx/table]
```
```rpg feature.details
name: Blessed Healer
subtitle: "7th-Level Life Feature"
level: 7
type: passive
text: |
  Healing spells you cast on others heal you as well. When you cast a [[Divine]] spell of 1st circle or higher that restores hit points to a creature other than you, you regain hit points equal to 2 + the spell’s circle.
```
```rpg feature.details
name: Greater Preservation
subtitle: "11th-Level Life Feature"
level: 11
text: |
  The Preserve Life effect of your Channel Divinity feature can now affect any creatures within 60 feet of you. In addition, when you use Preserve Life, one target of your choice can also receive one of the following benefits: 
  - Cure all diseases affecting the target. 
  - End one of the following conditions affecting the target: [[blinded]], [[deafened]], [[paralyzed]], or [[poisoned]]. 
  - Neutralize all poisons affecting the target.
update:
  action: Preserve Life
  text: |
    As an action, you present your holy symbol and evoke healing energy that can restore a number of hit points equal to 5 × your cleric level.

    Choose any creatures within 60 feet of you and divide those hit points among them. This feature can restore a creature to no more than half of its hit point maximum. This healing has no effect on [[Undead]] or [[Constructs]].
    
    Also, one of the targets can also receive one of the following benefits:
    - Cure all diseases affecting the target.
    - End one of the following conditions affecting the target: [[blinded]], [[deafened]], [[paralyzed]], or [[poisoned]]. 
    - Neutralize all poisons affecting the target.
```
```rpg feature.details
name: Perfect Healing
subtitle: "15th-Level Life Feature"
level: 15
text: |
  When you cast a [[Divine]] spell of 1st circle or higher that restores hit points, you automatically restore the maximum possible number of hit points. For example, if a _cure wounds_ spell heals 1d8 + 3 hit points, rather than rolling, the target heals 11 hit points.
update:
  passive: Disciple of Life
  text: |
    Your healing spells are more effective. When you use a [[Divine]] spell of 1st circle or higher to restore hit points to a creature, you automatically restore the maximum possible number of hit points and additional hit points equal to 2 + the spell’s circle.
```
>[!rules] WHAT IF THE DOMAIN I WANT ISN’T LISTED WITH MY GOD? 
>
>Since a cleric picks their god at 1st level and commits to a domain at 3rd level, you might find that you want a domain that isn’t listed with your god on the **Deities** tables in **Appendix B: Gods & Pantheons**. Don’t worry! Suggested domains are just that—suggestions. Gods are powerful, mysterious beings with many facets. For example, it is completely reasonable to say that Ares, the Greek god of warfare, listed with the War domain, would also have use for a cleric devoted to the Death domain. 
>
>Selecting a nontraditional domain for your cleric’s god could even lead to interesting stories. If you think your desired domain is completely at odds with your cleric’s god, work with your GM to discuss solutions that make sense for the game.