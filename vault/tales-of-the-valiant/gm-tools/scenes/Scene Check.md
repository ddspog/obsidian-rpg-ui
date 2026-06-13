---
cssclasses:
  - note-feature
source: From **System Neutral** "Mythic Game Emulator 2E" by **Word Mill**
aliases:
  - Expected Scene
  - Expected Scenes
---
# EXPECTED SCENES
Mythic adventures move fluidly from one Scene to the next, with each new Scene adding details to the growing narrative. New plot twists develop, new Threads are discovered, and new NCs emerge, while existing Characters take new actions. Every choice you make affects the outcome of future Scenes as you strive to achieve your goals, fulfill open Threads, and reach a satisfying conclusion.

When a Scene comes to an end the first thing you do before beginning the next one is decide how you think it'll start, usually based on what you want your PC to do next. This is called an Expected Scene.

*The First Scene of the Player's adventure saw their detective Character visited in his office by a mysterious new client begging him to investigate the murder of her late husband. The police ruled his death a suicide, but she thinks otherwise. Through her, the PC learned that the victim owed a great deal of money to an old army buddy who threatened his life if he didn't pay it back—a promising lead with which to start the investigation.*

*With the opening Scene concluded the Player must now decide how they think the next Scene will begin. They decide the Expected Scene is about their PC dropping in on the suspect at his place of work to question him.*

Most of the time the Expected Scene will be based on what you decide your Character plans to do. Our detective Character wants to follow up on a lead so that forms the basis of the Player's Expected Scene.

Whatever your Expected Scene is you won't know for sure whether or not it will happen that way until you test it.
## Testing The Expected Scene
Before we dive into the new Scene we have to check if your expectations happen using the Chaos Factor. Roll a d10 and compare it to the current CF value. If you roll above the CF then the Expected Scene starts exactly how you thought it would; if you roll equal to or less than the CF then your Expected Scene changes in some way.

In cases when your Expected Scene is changed check the number you rolled. If the number is odd (1, 3, 5, 7, or 9) then it becomes an Altered Scene; if the number is even (2, 4, 6, or 8) then it becomes an Interrupt Scene.
```rpg table.testing-the-expected-scene
| Roll 1d10 and Compare It To The Chaos Factor. ||
| --- | --- |
|Roll Over Chaos Factor | Expected Scene|
|Roll Odd (1, 3, 5, 7, 9) Within Chaos Factor | Altered Scene |
|Roll Even (2, 4, 6, 8) Within Chaos Factor | Interrupt Scene |
[TESTING THE EXPECTED SCENE]
```

```rpg feature.gm
name: Testing the Expected Scene
stack: generator
source: 'From **System Neutral** "Mythic Game Emulator 2E" by **Word Mill**'
oracle:
  question: 'Does the "{{scene}}" scene happen as expected?'
  chaos: true
generator:
  name: Testing the Expected Scene
  roll: d10
  vs: CF
  work: Alterations
  interpret:
    ">CF": Expected Scene
    "<=CF, odd": Altered Scene
    "<=CF, even": Interrupt Scene
  follow:
    Altered Scene:
      The Next Expectation: ""
      A Tweak: "(note: tweak the activity, an NPC, an object, or the location)"
      Fate Question: "? [CF:{{cf}}] {{question}} -> (d100=)"
      Meaning Tables Inspiration: "Meaning: d100= ->"
      Scene Adjustment Table: "Scene Adjustment: d10= ->"
    Interrupt Scene:
      Generate a Random Event: "Event Focus: d100= ->"
scene:
  opens: "S{{n}} {{title}}"
example:
  scene: "ambush at the rockslide"
  cf: 5
  rolls: { d10: 3 }
  n: "01"
  title: "After the landslide: the road north lies buried."
---
State the scene you expect, then test it against the Chaos Factor.
```
