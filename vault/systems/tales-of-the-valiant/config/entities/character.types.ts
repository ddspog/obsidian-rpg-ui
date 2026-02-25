export type CharacterLookup = {
  /** Set of helpful tables to help calculating stuff. */
  table: {
    /** Table of Experience Milestone to advance on Character Levels */
    xp: number[];
  }
}

/** Return types of each named expression on the character entity */
export type CharacterExpressions = {
  /** Sum of classes levels. */
  CharacterLevel: () => number;
  /** Proficiency Bonus based on Character Level. */
  ProficiencyBonus: () => number;
  /** Generic calculation for any attribute or skill modifier, given the attribute value, proficiency bonus, and any other bonuses or penalties. */
  ModifierTotal: (params: { attribute: 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA', proficiency: number, bonus: number }) => number;
  /** Passive value, calculated as 10 + modifier + proficiency bonus (if proficient) */
  Passive: (params: { attribute: 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA', proficiency: number, vantage: number, bonus: number }) => number;
};

type PillDetails = {
      /** File name for pulling data, and serving as link for the pill. */
      file: string;
      /** Label for showing on the pill, if you do not want solely the file name. */
      text?: string
}

export type AttributeDetails = {
  /** Current attribute score */
  value: number;
  /** Current saving throw proficiency and vantage */
  save: SkillDetails;
}

type SkillDetails = {
  /** Current skill proficiency */
  proficiency: number;
  /** Current skill vantage */
  vantage: number;
  /** Current skill bonus */
  bonus: number;
}

/** Props shapes for each block in the character entity */
export type CharacterBlocks = {
  /** The Header of a Character Sheet, with defining aspects of the character. */
  header: {
    /** List of classes, allowing user to multiclass */
    classes: {
      /** File name defining the Class with its features */
      name: string;
      /** Current level in that class */
      level: number
      /** File name for a Subclass, if any applied */
      subclass?: string;
    }[];
    /** Lineage defining the DNA of the character. */
    lineage: PillDetails;
    /** Heritage defining a bit of character manners and history. */
    heritage: PillDetails;
    /** Background defining a bit on how character came to adventure. */
    background: PillDetails;
    /** Current XP value */
    xp: number;
    /** Current Luck points available */
    luck: number;
  };
  health: {
    portrait: string;
    max_hp: number;
    current_hp: number;
    temp_hp: number;
    hit_dice: Record<string, { max: number; current: number }>;
    death_saves: {
      successes: number;
      failures: number;
    },
    exhaustion: number;
    conditions: string[];
    initiative: {
      proficiency: number;
      vantage: number;
    }
    natural_ac: number;
    speed: {
      value: number;
      type: string;
    };
  };
  stats: {
    /** Each core attribute with its value and saving throw details */
    STR: AttributeDetails;
    /** Each core attribute with its value and saving throw details */
    DEX: AttributeDetails;
    /** Each core attribute with its value and saving throw details */
    CON: AttributeDetails;
    /** Each core attribute with its value and saving throw details */
    INT: AttributeDetails;
    /** Each core attribute with its value and saving throw details */
    WIS: AttributeDetails;
    /** Each core attribute with its value and saving throw details */
    CHA: AttributeDetails;
  },
  senses: {
    /** List of senses with their type and range (if any) */
    senses_list: {
      /* Range in feet, if applicable (e.g. darkvision), otherwise null (e.g. blindsight) */
      range?: number;
      /* Type of sense, e.g. "darkvision", "blindsight", "tremorsense", "truesight", etc. */
      type: string;
    }[];
  },
  skills: {
    /** Each skill with its proficiency and vantage */
    Acrobatics: SkillDetails;
    /** Each skill with its proficiency and vantage */
    "Animal Handling": SkillDetails;
    /** Each skill with its proficiency and vantage */
    Arcana: SkillDetails;
    /** Each skill with its proficiency and vantage */
    Athletics: SkillDetails;
    /** Each skill with its proficiency and vantage */
    Deception: SkillDetails;
    /** Each skill with its proficiency and vantage */
    History: SkillDetails;
    /** Each skill with its proficiency and vantage */
    Insight: SkillDetails;
    /** Each skill with its proficiency and vantage */
    Intimidation: SkillDetails;
    /** Each skill with its proficiency and vantage */
    Investigation: SkillDetails;
    /** Each skill with its proficiency and vantage */
    Medicine: SkillDetails;
    /** Each skill with its proficiency and vantage */
    Nature: SkillDetails;
    /** Each skill with its proficiency and vantage */
    Perception: SkillDetails;
    /** Each skill with its proficiency and vantage */
    Performance: SkillDetails;
    /** Each skill with its proficiency and vantage */
    Persuasion: SkillDetails;
    /** Each skill with its proficiency and vantage */
    Religion: SkillDetails;
    /** Each skill with its proficiency and vantage */
    "Sleight of Hand": SkillDetails;
    /** Each skill with its proficiency and vantage */
    Stealth: SkillDetails;
    /** Each skill with its proficiency and vantage */
    Survival: SkillDetails;
  },
  attacks: {
    [filename: string]: {
      to_hit: string;
      damage: {
        roll: string;
        type: string;
      };
      property: string[];
      options: string[];
    }
  },
  proficiencies: {
    armor: string[];
    weapons: string[];
    tools: string[];
    languages: string[];
  };
  features: {
    filter?: string;
  };
  spells: {
    filter?: string;
  };
  inventory: {
    filter?: string;
  };
  description: {
    filter?: string;
  };
};
