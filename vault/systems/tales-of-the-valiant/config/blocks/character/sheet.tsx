import * as React from "react";
import { EntityBlock } from "rpg-ui-toolkit";
import type { CharacterEntity } from "../../entities/character.types";
import { header as headerBlock } from "./header";
import { health as healthBlock } from "./health";
import { stats as statsBlock } from "./stats";
import { senses as sensesBlock } from "./senses";
import { skills as skillsBlock } from "./skills";
import attacksBlock from "./attacks";
import { proficiencies as proficienciesBlock } from "./proficiencies";
import type { SheetProps } from "./sheet.types";

/**
 * `rpg character.sheet` — convenience composite block that renders the
 * top-of-sheet band (header → health → stats → senses → skills →
 * attacks → proficiencies) from a single fence body.
 *
 * Authors can merge the YAML that would otherwise live in seven
 * separate blocks under one `character.sheet` fence and skip the empty
 * boilerplate. Each sub-renderer receives a synthetic `blocks` context
 * where the 7 sheet-resident keys point to this block's own `self`, so
 * cross-block reads (e.g. attacks → blocks.stats, health → blocks.header)
 * all land on the shared data. External blocks kept outside the sheet
 * (features, spells, inventory) flow through from the real dispatcher
 * context untouched, so attack derivation still sees the inventory's
 * equipped weapons.
 */
export const sheet: EntityBlock<SheetProps, CharacterEntity> = (ctx) => {
  const syntheticBlocks = {
    ...((ctx.blocks as Record<string, unknown>) ?? {}),
    header: ctx.self,
    health: ctx.self,
    stats: ctx.self,
    senses: ctx.self,
    skills: ctx.self,
    attacks: ctx.self,
    proficiencies: ctx.self,
  };

  const subCtx = { ...ctx, blocks: syntheticBlocks } as unknown as typeof ctx;

  return (
    <div className="rpg-character-sheet">
      {headerBlock(subCtx as Parameters<typeof headerBlock>[0])}
      {healthBlock(subCtx as Parameters<typeof healthBlock>[0])}
      {statsBlock(subCtx as Parameters<typeof statsBlock>[0])}
      {sensesBlock(subCtx as Parameters<typeof sensesBlock>[0])}
      {skillsBlock(subCtx as Parameters<typeof skillsBlock>[0])}
      {attacksBlock(subCtx as Parameters<typeof attacksBlock>[0])}
      {proficienciesBlock(subCtx as Parameters<typeof proficienciesBlock>[0])}
    </div>
  );
};

export default sheet;
