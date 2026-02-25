import { CreateEntity, FeatureEntry, TitleAnchor, Pill, ProgressBar, TriggerButton, InspirationalLevel, Stat, StatUL, SkillLI } from "rpg-ui-toolkit";
import { xpTable as xp } from './character.lookup';
import type { CharacterEntity } from "./character.types";
import header from '../blocks/character/header';
import health from '../blocks/character/health';
import stats from '../blocks/character/stats';
import senses from '../blocks/character/senses';
import skills from '../blocks/character/skills';
import attacks from '../blocks/character/attacks';
import proficiencies from '../blocks/character/proficiencies';

const character = CreateEntity<CharacterEntity>(async ({ wiki }) => ({
    lookup: { table: { xp } },
    blocks: {
        header,
        health,
        stats,
        senses,
        skills,
        attacks,
        proficiencies,
        features: ({ self, blocks, lookup, system }) => null,
        spells: ({ self, blocks, lookup, system }) => null,
        inventory: ({ self, blocks, lookup, system }) => null,
        description: ({ self, blocks, lookup, system }) => null,
    },
    features: [
        { $name: "Dash", type: "action", $contents: "Double your speed for the current turn." },
        {
            $name: "Disengage",
            type: "action",
            $contents: "Your movement doesn't provoke opportunity attacks for the rest of the turn.",
        },
        {
            $name: "Dodge",
            type: "action",
            $contents: "Attack rolls against you have disadvantage until your next turn.",
        },
        {
            $name: "Help",
            type: "action",
            $contents: "Give an ally advantage on their next ability check or attack roll.",
        },
        { $name: "Hide", type: "action", $contents: "Make a Dexterity (Stealth) check to hide." },
        {
            $name: "Ready",
            type: "action",
            $contents: "Prepare an action to trigger in response to a specified circumstance.",
        },
        {
            $name: "Search",
            type: "action",
            $contents: "Make a Wisdom (Perception) or Intelligence (Investigation) check to find something.",
        },
        {
            $name: "Use an Object",
            type: "action",
            $contents: "Interact with an object or the environment.",
        },
        {
            $name: "Opportunity Attack",
            type: "reaction",
            $contents: "Make a melee attack against a creature that leaves your reach.",
        },
        ...(await wiki.folder("compendium/entities/character/features") as unknown as FeatureEntry[])
    ],
    expressions: {
        CharacterLevel: (_, { blocks }) => {
            const { header } = blocks;
            return header.classes
                .map(c => c.level)
                .reduce((a, b) => a + b, 0);
        },
        ProficiencyBonus: (_, { expressions }) => {
            const level = expressions.CharacterLevel();
            return Math.floor((level - 1) / 4) + 2;
        },
        ModifierTotal: ([{ attribute, proficiency, bonus }], { blocks, expressions }) => {
          if (!(attribute in blocks.stats)) return 0;
          const attrValue = blocks.stats[attribute].value;
          const attrMod = Math.floor((attrValue - 10) / 2);
          const pb = expressions.ProficiencyBonus() * proficiency;
          return attrMod + pb + bonus;
        },
        Passive: ([{ attribute, proficiency, bonus, vantage }], { expressions }) => {
          return 10 + expressions.ModifierTotal({ attribute, proficiency, bonus }) + 5 * vantage;
        }
    },
}));

export default character;
