var __system_module = (() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
    get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
  }) : x)(function(x) {
    if (typeof require !== "undefined") return require.apply(this, arguments);
    throw Error('Dynamic require of "' + x + '" is not supported');
  });
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // vault:tales-of-the-valiant/config/index.ts
  var config_exports = {};
  __export(config_exports, {
    ruleViews: () => ruleViews,
    system: () => system
  });
  var import_rpg_ui_toolkit22 = __require("rpg-ui-toolkit");

  // vault:tales-of-the-valiant/config/attributes.ts
  var attributes = [
    {
      $name: "Strength",
      alias: "STR",
      subtitle: "Associated Skills: Athletics",
      measures: "Physical might",
      $contents: `Strength measures bodily power, athletic aptitude, and the extent to which you can exert raw physical force. STR is used to: 
- Calculate attack rolls and damage with melee weapons 
- Determine how much weight can be lifted or carried 

Use STR for checks that involve feats of bodily force, such as: 

- Kicking down a door, breaking free of bonds, or smashing a lock 
- Pulling, pushing, or lifting heavy objects 
- Climbing a rope or swimming against the current 
- Resisting an attempt to grab, pull, or push you`
    },
    {
      $name: "Dexterity",
      alias: "DEX",
      subtitle: "Associated Skills: Acrobatics, Sleight of Hand, Stealth",
      measures: "Agility, reflexes, and balance",
      $contents: `Dexterity measures agility, reflexes, and balance. DEX is used to:
- Calculate attack rolls and damage with ranged weapons or melee weapons with the Finesse property
- Calculate Armor Class
- Determine initiative order during encounter gameplay

Use DEX for checks that involve reflexes, precise motion, or swift response time such as:
- Maintaining balance while on a moving vehicle or scooting along a narrow ledge
- Picking a pocket without being noticed
- Picking a lock or disabling a trap
- Crafting a small or detailed object
- Moving silently or sneaking up on prey
- Resisting an attempt to grab, pull, or push you`
    },
    {
      $name: "Constitution",
      alias: "CON",
      subtitle: "Associated Skills: None",
      measures: "Health and stamina",
      $contents: `Constitution measures health, stamina, and vital force. CON is used to:
- Calculate hit points (HP)

Use CON for checks that involve endurance or weathering extreme conditions, such as:
- Holding your breath
- Extended marching or labor without rest
- Going without sleep
- Surviving without food or water
- Quaffing an entire stein of ale in one go`
    },
    {
      $name: "Intelligence",
      alias: "INT",
      subtitle: "Associated Skills: Arcana, History, Investigation, Nature, Religion",
      measures: "Reasoning and memory",
      $contents: `Intelligence measures mental acuity, accuracy of recall, and the ability to reason. INT is used to:
- Calculate certain class spellcasting abilities

Use INT for checks to draw on logic, education, memory, or deductive reasoning, such as:
- Communicating without using words
- Estimating the value of a precious item
- Forging a document
- Recalling lore about a craft or trade
- Winning a game of skill`
    },
    {
      $name: "Wisdom",
      alias: "WIS",
      subtitle: "Associated Skills: Animal Handling, Insight, Medicine, Perception, Survival",
      measures: "Perceptiveness and mental fortitude",
      $contents: `Wisdom reflects how attuned you are to the world around you and represents perceptiveness and intuition. WIS is used to:
- Calculate certain class spellcasting abilities

Use WIS for checks to intuit clues about the environment and people or treat the injured, such as:
- Getting a gut feeling about next steps
- Discerning if a seemingly dead creature is Undead
- Picking up on subtle signals happening around you
- Bandage a wound or recognize a disease`
    },
    {
      $name: "Charisma",
      alias: "CHA",
      subtitle: "Associated Skills: Deception, Intimidation, Performance, Persuasion",
      measures: "Confidence, poise, and charm",
      $contents: `Charisma measures your ability to interact with others and can represent a charming or commanding personality. CHA is used to:
- Calculate certain class spellcasting abilities

Use CHA for checks to influence or entertain, make an impression, tell a convincing lie, or navigate a tricky social situation, such as:
- Finding the best person to talk to for news, rumors, and gossip
- Pulling together a disguise to pass as a city guard
- Blending into a crowd to get the sense of key topics of conversation`
    }
  ];
  var attributes_default = attributes;

  // vault:tales-of-the-valiant/config/spellslots.ts
  var table = [
    { level: 1, slots: [2, 0, 0, 0, 0, 0, 0, 0, 0] },
    { level: 2, slots: [3, 0, 0, 0, 0, 0, 0, 0, 0] },
    { level: 3, slots: [4, 2, 0, 0, 0, 0, 0, 0, 0] },
    { level: 4, slots: [4, 3, 0, 0, 0, 0, 0, 0, 0] },
    { level: 5, slots: [4, 3, 2, 0, 0, 0, 0, 0, 0] },
    { level: 6, slots: [4, 3, 3, 0, 0, 0, 0, 0, 0] },
    { level: 7, slots: [4, 3, 3, 1, 0, 0, 0, 0, 0] },
    { level: 8, slots: [4, 3, 3, 2, 0, 0, 0, 0, 0] },
    { level: 9, slots: [4, 3, 3, 3, 1, 0, 0, 0, 0] },
    { level: 10, slots: [4, 3, 3, 3, 2, 0, 0, 0, 0] },
    { level: 11, slots: [4, 3, 3, 3, 2, 1, 0, 0, 0] },
    { level: 12, slots: [4, 3, 3, 3, 2, 1, 0, 0, 0] },
    { level: 13, slots: [4, 3, 3, 3, 2, 1, 1, 0, 0] },
    { level: 14, slots: [4, 3, 3, 3, 2, 1, 1, 0, 0] },
    { level: 15, slots: [4, 3, 3, 3, 2, 1, 1, 1, 0] },
    { level: 16, slots: [4, 3, 3, 3, 2, 1, 1, 1, 0] },
    { level: 17, slots: [4, 3, 3, 3, 2, 1, 1, 1, 1] },
    { level: 18, slots: [4, 3, 3, 3, 3, 1, 1, 1, 1] },
    { level: 19, slots: [4, 3, 3, 3, 3, 2, 1, 1, 1] },
    { level: 20, slots: [4, 3, 3, 3, 3, 2, 1, 1, 1] }
  ];
  var spellslots_default = table;

  // vault:tales-of-the-valiant/config/entities/character.tsx
  var import_rpg_ui_toolkit11 = __require("rpg-ui-toolkit");

  // vault:tales-of-the-valiant/config/entities/character.lookup.ts
  var xpTable = [
    0,
    // Level 1
    300,
    // Level 2
    900,
    // Level 3
    2700,
    // Level 4
    6500,
    // Level 5
    14e3,
    // Level 6
    23e3,
    // Level 7
    34e3,
    // Level 8
    48e3,
    // Level 9
    64e3,
    // Level 10
    85e3,
    // Level 11
    1e5,
    // Level 12
    12e4,
    // Level 13
    14e4,
    // Level 14
    165e3,
    // Level 15
    195e3,
    // Level 16
    225e3,
    // Level 17
    265e3,
    // Level 18
    305e3,
    // Level 19
    355e3
    // Level 20
  ];
  var FULL_SLOTS = [
    /*  1 */
    [2, 0, 0, 0, 0, 0, 0, 0, 0],
    /*  2 */
    [3, 0, 0, 0, 0, 0, 0, 0, 0],
    /*  3 */
    [4, 2, 0, 0, 0, 0, 0, 0, 0],
    /*  4 */
    [4, 3, 0, 0, 0, 0, 0, 0, 0],
    /*  5 */
    [4, 3, 2, 0, 0, 0, 0, 0, 0],
    /*  6 */
    [4, 3, 3, 0, 0, 0, 0, 0, 0],
    /*  7 */
    [4, 3, 3, 1, 0, 0, 0, 0, 0],
    /*  8 */
    [4, 3, 3, 2, 0, 0, 0, 0, 0],
    /*  9 */
    [4, 3, 3, 3, 1, 0, 0, 0, 0],
    /* 10 */
    [4, 3, 3, 3, 2, 0, 0, 0, 0],
    /* 11 */
    [4, 3, 3, 3, 2, 1, 0, 0, 0],
    /* 12 */
    [4, 3, 3, 3, 2, 1, 0, 0, 0],
    /* 13 */
    [4, 3, 3, 3, 2, 1, 1, 0, 0],
    /* 14 */
    [4, 3, 3, 3, 2, 1, 1, 0, 0],
    /* 15 */
    [4, 3, 3, 3, 2, 1, 1, 1, 0],
    /* 16 */
    [4, 3, 3, 3, 2, 1, 1, 1, 0],
    /* 17 */
    [4, 3, 3, 3, 2, 1, 1, 1, 1],
    /* 18 */
    [4, 3, 3, 3, 3, 1, 1, 1, 1],
    /* 19 */
    [4, 3, 3, 3, 3, 2, 1, 1, 1],
    /* 20 */
    [4, 3, 3, 3, 3, 2, 2, 1, 1]
  ];
  var HALF_SLOTS = [
    /*  1 */
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    /*  2 */
    [2, 0, 0, 0, 0, 0, 0, 0, 0],
    /*  3 */
    [3, 0, 0, 0, 0, 0, 0, 0, 0],
    /*  4 */
    [3, 0, 0, 0, 0, 0, 0, 0, 0],
    /*  5 */
    [4, 2, 0, 0, 0, 0, 0, 0, 0],
    /*  6 */
    [4, 2, 0, 0, 0, 0, 0, 0, 0],
    /*  7 */
    [4, 3, 0, 0, 0, 0, 0, 0, 0],
    /*  8 */
    [4, 3, 0, 0, 0, 0, 0, 0, 0],
    /*  9 */
    [4, 3, 2, 0, 0, 0, 0, 0, 0],
    /* 10 */
    [4, 3, 2, 0, 0, 0, 0, 0, 0],
    /* 11 */
    [4, 3, 3, 0, 0, 0, 0, 0, 0],
    /* 12 */
    [4, 3, 3, 0, 0, 0, 0, 0, 0],
    /* 13 */
    [4, 3, 3, 1, 0, 0, 0, 0, 0],
    /* 14 */
    [4, 3, 3, 1, 0, 0, 0, 0, 0],
    /* 15 */
    [4, 3, 3, 2, 0, 0, 0, 0, 0],
    /* 16 */
    [4, 3, 3, 2, 0, 0, 0, 0, 0],
    /* 17 */
    [4, 3, 3, 3, 1, 0, 0, 0, 0],
    /* 18 */
    [4, 3, 3, 3, 1, 0, 0, 0, 0],
    /* 19 */
    [4, 3, 3, 3, 2, 0, 0, 0, 0],
    /* 20 */
    [4, 3, 3, 3, 2, 0, 0, 0, 0]
  ];
  var THIRD_SLOTS = [
    /*  1 */
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    /*  2 */
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    /*  3 */
    [2, 0, 0, 0, 0, 0, 0, 0, 0],
    /*  4 */
    [3, 0, 0, 0, 0, 0, 0, 0, 0],
    /*  5 */
    [3, 0, 0, 0, 0, 0, 0, 0, 0],
    /*  6 */
    [3, 0, 0, 0, 0, 0, 0, 0, 0],
    /*  7 */
    [4, 2, 0, 0, 0, 0, 0, 0, 0],
    /*  8 */
    [4, 2, 0, 0, 0, 0, 0, 0, 0],
    /*  9 */
    [4, 2, 0, 0, 0, 0, 0, 0, 0],
    /* 10 */
    [4, 3, 0, 0, 0, 0, 0, 0, 0],
    /* 11 */
    [4, 3, 0, 0, 0, 0, 0, 0, 0],
    /* 12 */
    [4, 3, 0, 0, 0, 0, 0, 0, 0],
    /* 13 */
    [4, 3, 2, 0, 0, 0, 0, 0, 0],
    /* 14 */
    [4, 3, 2, 0, 0, 0, 0, 0, 0],
    /* 15 */
    [4, 3, 2, 0, 0, 0, 0, 0, 0],
    /* 16 */
    [4, 3, 3, 0, 0, 0, 0, 0, 0],
    /* 17 */
    [4, 3, 3, 0, 0, 0, 0, 0, 0],
    /* 18 */
    [4, 3, 3, 0, 0, 0, 0, 0, 0],
    /* 19 */
    [4, 3, 3, 1, 0, 0, 0, 0, 0],
    /* 20 */
    [4, 3, 3, 1, 0, 0, 0, 0, 0]
  ];
  function slotsForCaster(tier, classLevel) {
    if (tier === "none") return [0, 0, 0, 0, 0, 0, 0, 0, 0];
    const table2 = tier === "full" ? FULL_SLOTS : tier === "half" ? HALF_SLOTS : THIRD_SLOTS;
    const clamped = Math.max(1, Math.min(20, Math.floor(classLevel)));
    return table2[clamped - 1].slice();
  }

  // vault:tales-of-the-valiant/config/blocks/character/header.tsx
  var React = __toESM(__require("react"));
  var import_obsidian = __require("obsidian");
  var import_rpg_ui_toolkit = __require("rpg-ui-toolkit");
  function bareLink(value) {
    let raw = value;
    while (Array.isArray(raw)) raw = raw[0];
    if (typeof raw !== "string") return "";
    return raw.replace(/^\[\[/, "").replace(/\]\]$/, "").split("|")[0].trim();
  }
  function CommentMarkdown({ source }) {
    const ref = React.useRef(null);
    React.useEffect(() => {
      var _a, _b, _c, _d, _e, _f;
      const el = ref.current;
      if (!el) return;
      (_a = el.empty) == null ? void 0 : _a.call(el);
      el.innerHTML = "";
      if (!source) return;
      const app = globalThis.app;
      const sourcePath = (_e = (_d = (_c = (_b = app == null ? void 0 : app.workspace) == null ? void 0 : _b.getActiveFile) == null ? void 0 : _c.call(_b)) == null ? void 0 : _d.path) != null ? _e : "";
      const comp = new import_obsidian.Component();
      comp.load();
      const renderer = import_obsidian.MarkdownRenderer;
      const promise = typeof renderer.render === "function" ? renderer.render(app, source, el, sourcePath, comp) : (_f = renderer.renderMarkdown) == null ? void 0 : _f.call(renderer, source, el, sourcePath, comp);
      Promise.resolve(promise).then(() => {
        const p = el.querySelector("p");
        if (p && p.parentElement === el) {
          while (p.firstChild) el.appendChild(p.firstChild);
          p.remove();
        }
      }).catch(() => {
        el.textContent = source;
      });
      return () => {
        try {
          comp.unload();
        } catch (e) {
        }
      };
    }, [source]);
    return /* @__PURE__ */ React.createElement("span", { ref });
  }
  function PillRef({ details: details2 }) {
    const link = bareLink(details2.file);
    const label = details2.text || link;
    return /* @__PURE__ */ React.createElement("span", { "aria-details": "Pill Reference", className: "rpg-pill-ref" }, /* @__PURE__ */ React.createElement(import_rpg_ui_toolkit.Pill.Link, { link }, label), details2.comment && /* @__PURE__ */ React.createElement("small", { "aria-details": "Pill Comment", className: "rpg-pill-comment" }, /* @__PURE__ */ React.createElement(CommentMarkdown, { source: details2.comment })));
  }
  var header = ({ self, lookup, expressions, trigger }) => {
    var _a;
    return /* @__PURE__ */ React.createElement(import_rpg_ui_toolkit.Header.Banner, { label: "Character", background: self.banner, distribution: "2 1" }, /* @__PURE__ */ React.createElement("hgroup", { "aria-details": "Name & Summary" }, /* @__PURE__ */ React.createElement(import_rpg_ui_toolkit.Title, null), /* @__PURE__ */ React.createElement(import_rpg_ui_toolkit.Line.Pills, null, self.classes && self.classes.map((cls, i) => {
      var _a2;
      const className = bareLink(cls.name);
      const subclass = bareLink((_a2 = cls.sub) != null ? _a2 : cls.subclass);
      return /* @__PURE__ */ React.createElement(React.Fragment, { key: `class-${i}` }, /* @__PURE__ */ React.createElement(import_rpg_ui_toolkit.Pill.Link, { link: className }, className, " ", cls.level), subclass && /* @__PURE__ */ React.createElement(import_rpg_ui_toolkit.Pill.Link, { link: subclass }, subclass));
    }), self.lineage && /* @__PURE__ */ React.createElement(PillRef, { details: self.lineage }), self.heritage && /* @__PURE__ */ React.createElement(PillRef, { details: self.heritage }), self.background && /* @__PURE__ */ React.createElement(PillRef, { details: self.background }))), /* @__PURE__ */ React.createElement("fieldset", { "aria-details": "Leveling" }, /* @__PURE__ */ React.createElement(import_rpg_ui_toolkit.Line.BigElements, null, /* @__PURE__ */ React.createElement(import_rpg_ui_toolkit.Line.Buttons, null, /* @__PURE__ */ React.createElement(import_rpg_ui_toolkit.Button.Trigger, { onClick: () => trigger("short-rest"), "aria-label": "Short Rest" }, /* @__PURE__ */ React.createElement(import_rpg_ui_toolkit.Lucide.UtensilsCrossed, { size: 28, strokeWidth: 1 })), /* @__PURE__ */ React.createElement(import_rpg_ui_toolkit.Button.Trigger, { onClick: () => trigger("long-rest"), "aria-label": "Long Rest" }, /* @__PURE__ */ React.createElement(import_rpg_ui_toolkit.Lucide.FlameKindling, { size: 28, strokeWidth: 1 }))), /* @__PURE__ */ React.createElement(
      import_rpg_ui_toolkit.Level.Inspirational,
      {
        level: expressions.CharacterLevel(),
        inspiration: self.luck,
        maxPoints: 5,
        onUpdateInspiration: (value) => self.setLuck(value)
      }
    )), /* @__PURE__ */ React.createElement(
      import_rpg_ui_toolkit.Progress.Bar,
      {
        value: self.xp,
        max: (_a = lookup.table.xp[expressions.CharacterLevel()]) != null ? _a : lookup.table.xp[expressions.CharacterLevel() - 1]
      }
    )));
  };
  var header_default = header;

  // vault:tales-of-the-valiant/config/blocks/character/health.tsx
  var React2 = __toESM(__require("react"));
  var import_rpg_ui_toolkit2 = __require("rpg-ui-toolkit");
  function parseCondition(raw) {
    var _a, _b, _c, _d, _e;
    if (Array.isArray(raw)) raw = raw[0];
    if (raw && typeof raw === "object") {
      const obj = raw;
      raw = (_d = (_c = (_b = (_a = obj.link) != null ? _a : obj.path) != null ? _b : obj.file) != null ? _c : obj.src) != null ? _d : "";
    }
    let val = typeof raw === "string" ? raw : String(raw != null ? raw : "");
    const aliasMatch = val.match(/^\[\[(.+?)\|(.+)\]\]$/);
    if (aliasMatch) return { linkpath: aliasMatch[1].trim(), label: aliasMatch[2].trim() };
    const wikiMatch = val.match(/^\[\[(.+)\]\]$/);
    if (wikiMatch) val = wikiMatch[1].trim();
    const segment = (_e = val.split(/[/\\]/).pop()) != null ? _e : val;
    return { label: segment.replace(/\.[^.]+$/, "").trim(), linkpath: val || null };
  }
  function parseNumericTrait(raw) {
    if (typeof raw === "number") return raw;
    if (typeof raw !== "string") return 0;
    const cleaned = raw.replace(/^\[\[/, "").replace(/\]\]$/, "").split("|")[0].trim();
    const n = parseFloat(cleaned.replace(/^[+\s]+/, ""));
    return Number.isFinite(n) ? n : 0;
  }
  var health = ({ self, blocks, lookup, expressions }) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q;
    const deathSaves = (_a = self.death_saves) != null ? _a : { successes: 0, failures: 0 };
    const yamlHitDice = (_b = self.hit_dice) != null ? _b : {};
    const conditions = (_c = self.conditions) != null ? _c : [];
    const exhaustion = (_d = self.exhaustion) != null ? _d : 0;
    const header2 = blocks.header;
    const featuresBlock = blocks.features;
    const inventory2 = blocks.inventory;
    const view = (_e = lookup.$features) == null ? void 0 : _e.call(lookup, header2, featuresBlock == null ? void 0 : featuresBlock.choices, featuresBlock == null ? void 0 : featuresBlock.additional, inventory2);
    const traits = (_f = view == null ? void 0 : view.traits) != null ? _f : {};
    const hitDice = resolveHitDice(view, yamlHitDice);
    const speeds = resolveSpeeds(self.speed, traits);
    const naturalAcFromTraits = ((_g = traits["Natural AC"]) != null ? _g : []).map(parseNumericTrait).filter((n) => Number.isFinite(n) && n > 0);
    const naturalAc = Math.max((_h = self.natural_ac) != null ? _h : 10, ...naturalAcFromTraits.length > 0 ? naturalAcFromTraits : [0]);
    const initExpertise = ((_i = traits["Initiative E."]) != null ? _i : []).length > 0;
    const initFull = ((_j = traits["Initiative P."]) != null ? _j : []).length > 0;
    const initHalf = ((_k = traits["Initiative J."]) != null ? _k : []).length > 0;
    const initProfLevel = initExpertise ? 2 : initFull ? 1 : initHalf ? 0.5 : 0;
    const initFlat = ((_l = traits["Initiative B."]) != null ? _l : []).reduce((n, raw) => n + parseNumericTrait(raw), 0);
    const initiativeTotal = expressions.ModifierTotal({
      attribute: "DEX",
      proficiency: initProfLevel,
      bonus: initFlat
    });
    const initAdv = ((_m = traits["Initiative A."]) != null ? _m : []).length > 0;
    const initDis = ((_n = traits["Initiative D."]) != null ? _n : []).length > 0;
    const initVantage = initAdv && !initDis ? "adv" : initDis && !initAdv ? "dis" : void 0;
    const handleSpendDie = (dieType) => {
      var _a2, _b2;
      const current = (_b2 = (_a2 = hitDice[dieType]) == null ? void 0 : _a2.current) != null ? _b2 : 0;
      if (current <= 0) return;
      self.setHit_dice({
        ...yamlHitDice,
        [dieType]: current - 1
      });
    };
    const equippedAc = resolveEquippedAc(blocks, lookup, naturalAc);
    return /* @__PURE__ */ React2.createElement(import_rpg_ui_toolkit2.Section.Row, { label: "Health Management", distribution: "1 2" }, /* @__PURE__ */ React2.createElement(import_rpg_ui_toolkit2.PortraitThumb, { src: self.portrait }), /* @__PURE__ */ React2.createElement(import_rpg_ui_toolkit2.Article.Column, { label: "Content" }, /* @__PURE__ */ React2.createElement(import_rpg_ui_toolkit2.HGroup.Row, { label: "Defense Stats" }, /* @__PURE__ */ React2.createElement(import_rpg_ui_toolkit2.Line.Control, null, /* @__PURE__ */ React2.createElement(
      import_rpg_ui_toolkit2.DeathSaveDots,
      {
        side: "failures",
        count: 3,
        filled: deathSaves.failures,
        onChange: (v) => self.setDeath_saves({ ...deathSaves, failures: v })
      }
    ), /* @__PURE__ */ React2.createElement(import_rpg_ui_toolkit2.Badge.Shield, { value: equippedAc.armor, label: "Armor" }), equippedAc.shieldBonus > 0 && /* @__PURE__ */ React2.createElement(import_rpg_ui_toolkit2.Badge.Shield, { value: equippedAc.armor + equippedAc.shieldBonus, label: "Shield" }), /* @__PURE__ */ React2.createElement(
      import_rpg_ui_toolkit2.DeathSaveDots,
      {
        side: "successes",
        count: 3,
        filled: deathSaves.successes,
        onChange: (v) => self.setDeath_saves({ ...deathSaves, successes: v })
      }
    )), /* @__PURE__ */ React2.createElement(import_rpg_ui_toolkit2.Line.Stats, null, /* @__PURE__ */ React2.createElement(import_rpg_ui_toolkit2.Stat.Diamond, { label: "Initiative", value: initiativeTotal, format: "bonus", vantage: initVantage }), speeds.map((s, i) => {
      var _a2, _b2;
      return /* @__PURE__ */ React2.createElement(import_rpg_ui_toolkit2.Stat.Diamond, { key: i, label: (_a2 = s.type) != null ? _a2 : "Walk", value: (_b2 = s.value) != null ? _b2 : 30, format: "unit", size: "lg" });
    }), /* @__PURE__ */ React2.createElement(import_rpg_ui_toolkit2.Stat.Diamond, { label: "Proficiency", value: expressions.ProficiencyBonus(), format: "bonus" }))), /* @__PURE__ */ React2.createElement("p", { "aria-details": "Health Management Row", style: { alignItems: "stretch" } }, /* @__PURE__ */ React2.createElement("dl", { "aria-label": "Health Controller", style: { flex: 3 } }, /* @__PURE__ */ React2.createElement("dt", null, "HIT POINTS"), /* @__PURE__ */ React2.createElement("dd", { "aria-label": "Progress Health" }, /* @__PURE__ */ React2.createElement(import_rpg_ui_toolkit2.Progress.Health, { value: (_o = self.current_hp) != null ? _o : 0, max: (_p = self.max_hp) != null ? _p : 0, secondary: (_q = self.temp_hp) != null ? _q : 0 })), /* @__PURE__ */ React2.createElement("dt", null, "Hit Dice"), /* @__PURE__ */ React2.createElement("dd", { "aria-label": "Dice Tray" }, /* @__PURE__ */ React2.createElement(import_rpg_ui_toolkit2.DiceTray, { dice: hitDice, onSpend: handleSpendDie }))), /* @__PURE__ */ React2.createElement("dl", { "aria-label": "Character Status", style: { flex: 2 } }, /* @__PURE__ */ React2.createElement("dt", null, "Exhaustion"), /* @__PURE__ */ React2.createElement("dd", { "aria-label": "Progress Numbered" }, /* @__PURE__ */ React2.createElement(import_rpg_ui_toolkit2.Progress.Numbered, { value: exhaustion, max: 6 })), /* @__PURE__ */ React2.createElement("dt", null, "Conditions"), /* @__PURE__ */ React2.createElement("dd", { "aria-label": "Conditions List" }, conditions.length === 0 ? /* @__PURE__ */ React2.createElement("span", { "aria-details": "No Conditions" }, "\u2014") : conditions.map((raw, i) => {
      const { label, linkpath } = parseCondition(raw);
      return /* @__PURE__ */ React2.createElement(import_rpg_ui_toolkit2.ConditionPill, { key: i, value: raw, label, linkpath });
    }))))));
  };
  var health_default = health;
  function resolveEquippedAc(blocks, lookup, naturalAc) {
    var _a, _b;
    const inv = blocks == null ? void 0 : blocks.inventory;
    const items = Array.isArray(inv == null ? void 0 : inv.items) ? inv.items : [];
    const lib = (_a = lookup == null ? void 0 : lookup.$items) != null ? _a : {};
    const dexMod = abilityModFromBlocks(blocks, "DEX");
    let armor = naturalAc;
    let shieldBonus = 0;
    for (const raw of items) {
      if (!raw || typeof raw !== "object") continue;
      const o = raw;
      if (typeof o.name !== "string") continue;
      const name = wikiStem(o.name);
      if (!name) continue;
      const fm = lib[name];
      if (!fm) continue;
      const armorBlock = fm.armor && typeof fm.armor === "object" ? fm.armor : void 0;
      if (!armorBlock) continue;
      const formula = typeof armorBlock.ac === "string" ? armorBlock.ac : void 0;
      const category = typeof armorBlock.category === "string" ? armorBlock.category.toLowerCase() : void 0;
      if (category === "shield") {
        const bonus = parseAcBonus(formula);
        if (bonus > shieldBonus) shieldBonus = bonus;
      } else if (o.slot === "armor") {
        armor = (_b = computeArmorValue(formula, category, dexMod)) != null ? _b : armor;
      }
    }
    return { armor, shieldBonus };
  }
  function abilityModFromBlocks(blocks, key) {
    var _a;
    const stats2 = (_a = blocks == null ? void 0 : blocks.stats) != null ? _a : {};
    const cell = stats2[key];
    let score = 10;
    if (typeof cell === "number") score = cell;
    else if (cell && typeof cell === "object" && typeof cell.value === "number") {
      score = cell.value;
    }
    return Math.floor((score - 10) / 2);
  }
  function parseAcBonus(raw) {
    if (!raw) return 0;
    const m = raw.match(/[+-]?\d+/);
    if (!m) return 0;
    const n = Number(m[0]);
    return Number.isFinite(n) ? n : 0;
  }
  function computeArmorValue(formula, category, dexMod) {
    if (!formula) return null;
    const baseMatch = formula.match(/-?\d+/);
    if (!baseMatch) return null;
    const base = Number(baseMatch[0]);
    if (!Number.isFinite(base)) return null;
    const wantsDex = /\bdex\b/i.test(formula);
    if (!wantsDex) return base;
    const explicitCap = formula.match(/max\s+(\d+)/i);
    const cap = explicitCap ? Number(explicitCap[1]) : category === "heavy" ? 0 : category === "medium" ? 2 : Infinity;
    return base + Math.min(dexMod, cap);
  }
  function wikiStem(raw) {
    const m = raw.match(/^\[\[(.+?)\]\]$/);
    const inner = m ? m[1] : raw;
    return inner.split("|")[0].split("/").pop().trim();
  }
  var SPEED_KEYS = [
    { trait: "Walk", type: "Walk" },
    { trait: "Fly", type: "Fly" },
    { trait: "Swim", type: "Swim" },
    { trait: "Burrow", type: "Burrow" },
    { trait: "Climb", type: "Climb" }
  ];
  function resolveSpeeds(yamlSpeed, traits) {
    var _a;
    const yamlList = Array.isArray(yamlSpeed) ? yamlSpeed : yamlSpeed ? [yamlSpeed] : [];
    if (yamlList.length > 0) {
      return yamlList.map((entry) => {
        var _a2, _b;
        return {
          value: (_a2 = entry.value) != null ? _a2 : 30,
          type: (_b = entry.type) != null ? _b : "Walk"
        };
      });
    }
    const out = [];
    for (const { trait, type } of SPEED_KEYS) {
      const values = (_a = traits[trait]) != null ? _a : [];
      if (values.length === 0) continue;
      const best = Math.max(...values.map(parseNumericTrait).filter((n) => n > 0));
      if (Number.isFinite(best) && best > 0) out.push({ value: best, type });
    }
    if (out.length === 0) out.push({ value: 30, type: "Walk" });
    return out;
  }
  function resolveHitDice(view, yamlHitDice) {
    var _a, _b, _c;
    const out = {};
    const byDie = /* @__PURE__ */ new Map();
    for (const source of (_a = view == null ? void 0 : view.sources) != null ? _a : []) {
      if (source.kind !== "class") continue;
      const die = pickDieFace((_b = source.baseTraits) == null ? void 0 : _b["Hit Die"]);
      if (!die || !source.level) continue;
      byDie.set(die, ((_c = byDie.get(die)) != null ? _c : 0) + source.level);
    }
    for (const [die, max] of byDie) {
      const current = readHitDieCurrent(yamlHitDice[die], max);
      out[die] = { max, current };
    }
    for (const [die, entry] of Object.entries(yamlHitDice)) {
      if (out[die]) continue;
      const { current, max } = normaliseYamlHitDieEntry(entry);
      if (max <= 0 && current <= 0) continue;
      out[die] = { max: max || current, current };
    }
    return out;
  }
  function readHitDieCurrent(raw, defaultMax) {
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
    if (raw && typeof raw === "object") {
      const v = raw.current;
      if (typeof v === "number" && Number.isFinite(v)) return v;
    }
    return defaultMax;
  }
  function normaliseYamlHitDieEntry(raw) {
    if (typeof raw === "number") return { current: raw, max: raw };
    if (raw && typeof raw === "object") {
      const o = raw;
      const current = typeof o.current === "number" ? o.current : 0;
      const max = typeof o.max === "number" ? o.max : current;
      return { current, max };
    }
    return { current: 0, max: 0 };
  }
  function pickDieFace(values) {
    if (!values || values.length === 0) return null;
    for (const raw of values) {
      const m = String(raw).match(/d(\d+)/i);
      if (m) return `d${m[1]}`;
    }
    return null;
  }

  // vault:tales-of-the-valiant/config/blocks/character/stats.tsx
  var React3 = __toESM(__require("react"));
  var import_rpg_ui_toolkit3 = __require("rpg-ui-toolkit");
  var ATTRS = ["STR", "DEX", "CON", "INT", "WIS", "CHA"];
  var ATTR_ALIAS = {
    STR: "STR",
    STRENGTH: "STR",
    DEX: "DEX",
    DEXTERITY: "DEX",
    CON: "CON",
    CONSTITUTION: "CON",
    INT: "INT",
    INTELLIGENCE: "INT",
    WIS: "WIS",
    WISDOM: "WIS",
    CHA: "CHA",
    CHARISMA: "CHA"
  };
  function parseAsi(raw) {
    const match = raw.match(/^\s*\+(\d+)\s+([A-Za-z]+)\s*$/);
    if (!match) return null;
    const points = parseInt(match[1], 10);
    if (!Number.isFinite(points)) return null;
    const attr = ATTR_ALIAS[match[2].toUpperCase()];
    if (!attr) return null;
    return { attr, points };
  }
  function sumAsi(values) {
    const totals = {
      STR: 0,
      DEX: 0,
      CON: 0,
      INT: 0,
      WIS: 0,
      CHA: 0
    };
    for (const raw of values != null ? values : []) {
      const parsed = parseAsi(raw);
      if (parsed) totals[parsed.attr] += parsed.points;
    }
    return totals;
  }
  function asAttrCode(raw) {
    var _a;
    if (typeof raw !== "string") return null;
    const cleaned = raw.replace(/^\+/, "").trim().toUpperCase();
    return (_a = ATTR_ALIAS[cleaned]) != null ? _a : null;
  }
  function saveProfLevelsFromTraits(traits) {
    var _a, _b, _c;
    const out = {
      STR: 0,
      DEX: 0,
      CON: 0,
      INT: 0,
      WIS: 0,
      CHA: 0
    };
    const bump = (code, lvl) => {
      if (lvl > out[code]) out[code] = lvl;
    };
    for (const raw of (_a = traits["Save P."]) != null ? _a : []) {
      const code = asAttrCode(raw);
      if (code) bump(code, 1);
    }
    for (const raw of (_b = traits["Save J."]) != null ? _b : []) {
      const code = asAttrCode(raw);
      if (code) bump(code, 0.5);
    }
    for (const raw of (_c = traits["Save E."]) != null ? _c : []) {
      const code = asAttrCode(raw);
      if (code) bump(code, 2);
    }
    return out;
  }
  function saveBonusFromTraits(traits) {
    var _a;
    const out = {
      STR: 0,
      DEX: 0,
      CON: 0,
      INT: 0,
      WIS: 0,
      CHA: 0
    };
    for (const raw of (_a = traits["Save B."]) != null ? _a : []) {
      const match = raw.match(/^\s*([+\-]?\d+(?:\.\d+)?)\s+([A-Za-z]+)\s*$/);
      if (!match) continue;
      const bonus = parseFloat(match[1]);
      const code = asAttrCode(match[2]);
      if (!Number.isFinite(bonus) || !code) continue;
      out[code] += bonus;
    }
    return out;
  }
  function saveVantageFromTraits(traits) {
    var _a, _b;
    const adv = /* @__PURE__ */ new Set();
    const dis = /* @__PURE__ */ new Set();
    const apply = (set, raw) => {
      if (raw === "") {
        for (const code2 of ATTRS) set.add(code2);
        return;
      }
      const code = asAttrCode(raw);
      if (code) set.add(code);
    };
    for (const raw of (_a = traits["Save A."]) != null ? _a : []) apply(adv, raw);
    for (const raw of (_b = traits["Save D."]) != null ? _b : []) apply(dis, raw);
    const out = {
      STR: void 0,
      DEX: void 0,
      CON: void 0,
      INT: void 0,
      WIS: void 0,
      CHA: void 0
    };
    for (const code of ATTRS) {
      const a = adv.has(code);
      const d = dis.has(code);
      if (a && !d) out[code] = "adv";
      else if (d && !a) out[code] = "dis";
    }
    return out;
  }
  function readAttr(raw) {
    var _a, _b;
    if (typeof raw === "number") return { baseValue: raw };
    if (raw && typeof raw === "object") {
      const obj = raw;
      return {
        baseValue: typeof obj.value === "number" ? obj.value : 10,
        saveProf: (_a = obj.save) == null ? void 0 : _a.proficiency,
        saveBonus: (_b = obj.save) == null ? void 0 : _b.bonus
      };
    }
    return { baseValue: 10 };
  }
  var stats = ({ self, blocks, lookup, expressions }) => {
    var _a, _b, _c, _d, _e;
    const header2 = blocks.header;
    const features2 = blocks.features;
    const inventory2 = blocks.inventory;
    const view = (_a = lookup.$features) == null ? void 0 : _a.call(lookup, header2, features2 == null ? void 0 : features2.choices, features2 == null ? void 0 : features2.additional, inventory2);
    const asi = sumAsi((_b = view == null ? void 0 : view.traits) == null ? void 0 : _b["Ability Scores"]);
    const saveProfsAuto = saveProfLevelsFromTraits((_c = view == null ? void 0 : view.traits) != null ? _c : {});
    const saveBonusAuto = saveBonusFromTraits((_d = view == null ? void 0 : view.traits) != null ? _d : {});
    const saveVantageAuto = saveVantageFromTraits((_e = view == null ? void 0 : view.traits) != null ? _e : {});
    return /* @__PURE__ */ React3.createElement("section", { "aria-details": "Character Stats" }, ATTRS.map((attr) => {
      var _a2, _b2;
      const cell = readAttr(self[attr]);
      const finalValue = cell.baseValue + asi[attr];
      const proficiency = (_a2 = cell.saveProf) != null ? _a2 : saveProfsAuto[attr];
      const saveBonus = expressions.ModifierTotal({
        attribute: attr,
        proficiency,
        bonus: ((_b2 = cell.saveBonus) != null ? _b2 : 0) + saveBonusAuto[attr]
      });
      return /* @__PURE__ */ React3.createElement(
        import_rpg_ui_toolkit3.Stat,
        {
          key: attr,
          value: finalValue,
          saveBonus,
          proficiency,
          saveVantage: saveVantageAuto[attr]
        },
        attr
      );
    }));
  };
  var stats_default = stats;

  // vault:tales-of-the-valiant/config/blocks/character/senses.tsx
  var React4 = __toESM(__require("react"));
  function bareLabel(raw) {
    return raw.replace(/^\+/, "").replace(/^\[\[/, "").replace(/\]\]$/, "").split("|")[0].trim();
  }
  function countProfs(traitValues, valid) {
    var _a;
    const counts = /* @__PURE__ */ new Map();
    for (const raw of traitValues != null ? traitValues : []) {
      const name = bareLabel(raw);
      if (!valid.has(name)) continue;
      counts.set(name, ((_a = counts.get(name)) != null ? _a : 0) + 1);
    }
    return counts;
  }
  var SENSES_SKILLS = /* @__PURE__ */ new Set(["Insight", "Investigation", "Perception"]);
  function stringifyMaybeArray(v) {
    let cur = v;
    while (Array.isArray(cur)) cur = cur[0];
    return typeof cur === "string" ? cur : "";
  }
  function parseLeadingWikilink(text) {
    const m = text.match(/^\[\[([^\]]+)\]\](.*)$/);
    if (!m) return null;
    const inner = m[1];
    const pipe = inner.indexOf("|");
    const link = (pipe >= 0 ? inner.slice(0, pipe) : inner).trim();
    const label = (pipe >= 0 ? inner.slice(pipe + 1) : inner).trim();
    return { label, link, rest: m[2].trim() };
  }
  function normaliseSense(raw) {
    var _a;
    if (raw == null) return null;
    if (typeof raw === "string" || Array.isArray(raw)) {
      const text = (typeof raw === "string" ? raw : stringifyMaybeArray(raw)).replace(/^\+/, "").trim();
      if (!text) return null;
      const wl = parseLeadingWikilink(text);
      if (wl) {
        const rangeMatch = wl.rest.match(/^(\d+)\s*(?:ft\.?)?$/i);
        const range = rangeMatch ? parseInt(rangeMatch[1], 10) : void 0;
        return {
          type: wl.label,
          range: Number.isFinite(range) ? range : void 0,
          link: wl.link
        };
      }
      const m = text.match(/^(.+?)\s+(\d+)\s*(?:ft\.?)?$/i);
      if (m) {
        const range = parseInt(m[2], 10);
        return { type: m[1].trim(), range: Number.isFinite(range) ? range : void 0 };
      }
      return { type: text };
    }
    if (typeof raw === "object") {
      const obj = raw;
      const rawType = stringifyMaybeArray(obj.type).trim();
      if (!rawType) return null;
      const wl = parseLeadingWikilink(rawType);
      const explicitLink = stringifyMaybeArray(obj.link).trim() || void 0;
      const type = wl ? wl.label : rawType;
      const link = (_a = wl == null ? void 0 : wl.link) != null ? _a : explicitLink;
      const range = typeof obj.range === "number" && Number.isFinite(obj.range) ? obj.range : void 0;
      return { type, range, link };
    }
    return null;
  }
  var senses = ({ self, blocks, lookup, expressions }) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p;
    const header2 = blocks.header;
    const features2 = blocks.features;
    const inventory2 = blocks.inventory;
    const view = (_a = lookup.$features) == null ? void 0 : _a.call(lookup, header2, features2 == null ? void 0 : features2.choices, features2 == null ? void 0 : features2.additional, inventory2);
    const traits = (_b = view == null ? void 0 : view.traits) != null ? _b : {};
    const profCounts = countProfs(traits["Skill P."], SENSES_SKILLS);
    for (const raw of (_c = traits["Skill E."]) != null ? _c : []) {
      const name = bareLabel(raw);
      if (SENSES_SKILLS.has(name)) profCounts.set(name, Math.max((_d = profCounts.get(name)) != null ? _d : 0, 2));
    }
    const halfNames = /* @__PURE__ */ new Set();
    for (const raw of (_e = traits["Skill J."]) != null ? _e : []) {
      const name = bareLabel(raw);
      if (SENSES_SKILLS.has(name)) halfNames.add(name);
    }
    const vantageByName = /* @__PURE__ */ new Map();
    const bonusByName = /* @__PURE__ */ new Map();
    for (const raw of (_f = traits["Skill A."]) != null ? _f : []) {
      const name = bareLabel(raw);
      if (SENSES_SKILLS.has(name)) vantageByName.set(name, ((_g = vantageByName.get(name)) != null ? _g : 0) + 1);
    }
    for (const raw of (_h = traits["Skill D."]) != null ? _h : []) {
      const name = bareLabel(raw);
      if (SENSES_SKILLS.has(name)) vantageByName.set(name, ((_i = vantageByName.get(name)) != null ? _i : 0) - 1);
    }
    for (const raw of (_j = traits["Skill B."]) != null ? _j : []) {
      const match = raw.match(/^\s*([+\-]?\d+(?:\.\d+)?)\s+(.+?)\s*$/);
      if (!match) continue;
      const bonus = parseFloat(match[1]);
      const name = bareLabel(match[2]);
      if (!Number.isFinite(bonus) || !SENSES_SKILLS.has(name)) continue;
      bonusByName.set(name, ((_k = bonusByName.get(name)) != null ? _k : 0) + bonus);
    }
    const skillsBlock = blocks.skills;
    const resolveSkill = (name) => {
      var _a2, _b2, _c2, _d2, _e2, _f2, _g2, _h2, _i2;
      const override = skillsBlock == null ? void 0 : skillsBlock[name];
      if ((override == null ? void 0 : override.proficiency) != null) {
        return {
          proficiency: override.proficiency,
          vantage: (_b2 = (_a2 = override.vantage) != null ? _a2 : vantageByName.get(name)) != null ? _b2 : 0,
          bonus: (_d2 = (_c2 = override.bonus) != null ? _c2 : bonusByName.get(name)) != null ? _d2 : 0
        };
      }
      const count = (_e2 = profCounts.get(name)) != null ? _e2 : 0;
      const proficiency = count >= 2 ? 2 : count >= 1 ? 1 : halfNames.has(name) ? 0.5 : 0;
      return {
        proficiency,
        vantage: (_g2 = (_f2 = override == null ? void 0 : override.vantage) != null ? _f2 : vantageByName.get(name)) != null ? _g2 : 0,
        bonus: (_i2 = (_h2 = override == null ? void 0 : override.bonus) != null ? _h2 : bonusByName.get(name)) != null ? _i2 : 0
      };
    };
    const insight = resolveSkill("Insight");
    const investigation = resolveSkill("Investigation");
    const perception = resolveSkill("Perception");
    const yamlSenses = (_l = self.senses_list) != null ? _l : [];
    const traitSenses = (_m = traits["Senses"]) != null ? _m : [];
    const additional = (_o = (_n = self.additional) == null ? void 0 : _n.senses) != null ? _o : [];
    const base = yamlSenses.length > 0 ? yamlSenses : traitSenses;
    const merged = [];
    const seen = /* @__PURE__ */ new Set();
    for (const raw of [...base, ...additional]) {
      const norm = normaliseSense(raw);
      if (!norm) continue;
      const key = `${norm.type.toLowerCase()}:${(_p = norm.range) != null ? _p : ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(norm);
    }
    return /* @__PURE__ */ React4.createElement("section", { "aria-details": "Character Senses" }, /* @__PURE__ */ React4.createElement("header", { className: "rpg-tag-heading" }, /* @__PURE__ */ React4.createElement("span", null, "Passive")), /* @__PURE__ */ React4.createElement("output", { "aria-label": "Passive Insight" }, /* @__PURE__ */ React4.createElement("data", null, expressions.Passive({
      attribute: "WIS",
      proficiency: insight.proficiency,
      vantage: insight.vantage,
      bonus: insight.bonus
    })), /* @__PURE__ */ React4.createElement("small", null, "Insight")), /* @__PURE__ */ React4.createElement("output", { "aria-label": "Passive Investigation" }, /* @__PURE__ */ React4.createElement("data", null, expressions.Passive({
      attribute: "INT",
      proficiency: investigation.proficiency,
      vantage: investigation.vantage,
      bonus: investigation.bonus
    })), /* @__PURE__ */ React4.createElement("small", null, "Investigation")), /* @__PURE__ */ React4.createElement("output", { "aria-label": "Passive Perception" }, /* @__PURE__ */ React4.createElement("data", null, expressions.Passive({
      attribute: "WIS",
      proficiency: perception.proficiency,
      vantage: perception.vantage,
      bonus: perception.bonus
    })), /* @__PURE__ */ React4.createElement("small", null, "Perception")), /* @__PURE__ */ React4.createElement("dl", { "aria-label": "Senses List" }, /* @__PURE__ */ React4.createElement("dt", { className: "rpg-tag-heading" }, /* @__PURE__ */ React4.createElement("span", null, "Senses")), merged.length === 0 ? /* @__PURE__ */ React4.createElement("dd", { "aria-details": "No Senses" }, /* @__PURE__ */ React4.createElement("span", null, "\u2014")) : merged.map((sense, i) => /* @__PURE__ */ React4.createElement("dd", { key: i }, sense.link ? /* @__PURE__ */ React4.createElement("a", { className: "internal-link", href: sense.link, "data-href": sense.link }, sense.type) : /* @__PURE__ */ React4.createElement("span", null, sense.type), sense.range != null && /* @__PURE__ */ React4.createElement("span", { "aria-details": "Sense Range" }, sense.range, " ft.")))));
  };
  var senses_default = senses;

  // vault:tales-of-the-valiant/config/blocks/character/skills.tsx
  var React5 = __toESM(__require("react"));
  var import_rpg_ui_toolkit4 = __require("rpg-ui-toolkit");
  var SKILLS = [
    { name: "Acrobatics", attr: "DEX" },
    { name: "Animal Handling", attr: "WIS" },
    { name: "Arcana", attr: "INT" },
    { name: "Athletics", attr: "STR" },
    { name: "Deception", attr: "CHA" },
    { name: "History", attr: "INT" },
    { name: "Insight", attr: "WIS" },
    { name: "Intimidation", attr: "CHA" },
    { name: "Investigation", attr: "INT" },
    { name: "Medicine", attr: "WIS" },
    { name: "Nature", attr: "INT" },
    { name: "Perception", attr: "WIS" },
    { name: "Performance", attr: "CHA" },
    { name: "Persuasion", attr: "CHA" },
    { name: "Religion", attr: "INT" },
    { name: "Sleight of Hand", attr: "DEX" },
    { name: "Stealth", attr: "DEX" },
    { name: "Survival", attr: "WIS" }
  ];
  var SKILL_SET = new Set(SKILLS.map((s) => s.name));
  function formatMod(n) {
    return (n >= 0 ? "+" : "\u2212") + Math.abs(n);
  }
  function bareLabel2(raw) {
    return raw.replace(/^\+/, "").replace(/^\[\[/, "").replace(/\]\]$/, "").split("|")[0].trim();
  }
  function ProfDot({ level: level2 }) {
    if (level2 >= 2) {
      return /* @__PURE__ */ React5.createElement("svg", { "aria-label": "Expertise", viewBox: "0 0 10 10", width: "12", height: "12" }, /* @__PURE__ */ React5.createElement("circle", { cx: "5", cy: "5", r: "4.5", fill: "none", stroke: "currentColor", strokeWidth: "1" }), /* @__PURE__ */ React5.createElement("circle", { cx: "5", cy: "5", r: "2.5", fill: "currentColor" }));
    }
    if (level2 >= 1) {
      return /* @__PURE__ */ React5.createElement("svg", { "aria-label": "Proficient", viewBox: "0 0 10 10", width: "12", height: "12" }, /* @__PURE__ */ React5.createElement("circle", { cx: "5", cy: "5", r: "3.5", fill: "currentColor" }));
    }
    if (level2 > 0) {
      return /* @__PURE__ */ React5.createElement("svg", { "aria-label": "Half Proficient", viewBox: "0 0 10 10", width: "12", height: "12" }, /* @__PURE__ */ React5.createElement("circle", { cx: "5", cy: "5", r: "3.5", fill: "none", stroke: "currentColor", strokeWidth: "1" }), /* @__PURE__ */ React5.createElement("path", { d: "M5 1.5 A3.5 3.5 0 0 0 5 8.5 Z", fill: "currentColor" }));
    }
    return /* @__PURE__ */ React5.createElement("svg", { "aria-label": "Not Proficient", viewBox: "0 0 10 10", width: "12", height: "12" }, /* @__PURE__ */ React5.createElement("circle", { cx: "5", cy: "5", r: "3.5", fill: "none", stroke: "currentColor", strokeWidth: "1" }));
  }
  function VantageBadge({ kind }) {
    return /* @__PURE__ */ React5.createElement("span", { className: "rpg-vantage-badge", "data-vantage": kind, "aria-label": kind === "adv" ? "Advantage" : "Disadvantage" }, /* @__PURE__ */ React5.createElement("sup", null, kind === "adv" ? "A" : "D"));
  }
  var skills = ({ self, blocks, lookup, expressions }) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s;
    const header2 = blocks.header;
    const features2 = blocks.features;
    const inventory2 = blocks.inventory;
    const view = (_a = lookup.$features) == null ? void 0 : _a.call(lookup, header2, features2 == null ? void 0 : features2.choices, features2 == null ? void 0 : features2.additional, inventory2);
    const traits = (_b = view == null ? void 0 : view.traits) != null ? _b : {};
    const profCounts = /* @__PURE__ */ new Map();
    for (const raw of (_c = traits["Skill P."]) != null ? _c : []) {
      const name = bareLabel2(raw);
      if (!SKILL_SET.has(name)) continue;
      profCounts.set(name, ((_d = profCounts.get(name)) != null ? _d : 0) + 1);
    }
    for (const raw of (_e = traits["Skill E."]) != null ? _e : []) {
      const name = bareLabel2(raw);
      if (!SKILL_SET.has(name)) continue;
      profCounts.set(name, Math.max((_f = profCounts.get(name)) != null ? _f : 0, 2));
    }
    const halfNames = /* @__PURE__ */ new Set();
    for (const raw of (_g = traits["Skill J."]) != null ? _g : []) {
      const name = bareLabel2(raw);
      if (SKILL_SET.has(name)) halfNames.add(name);
    }
    const vantageByName = /* @__PURE__ */ new Map();
    const bonusByName = /* @__PURE__ */ new Map();
    for (const raw of (_h = traits["Skill A."]) != null ? _h : []) {
      const name = bareLabel2(raw);
      if (!SKILL_SET.has(name)) continue;
      vantageByName.set(name, ((_i = vantageByName.get(name)) != null ? _i : 0) + 1);
    }
    for (const raw of (_j = traits["Skill D."]) != null ? _j : []) {
      const name = bareLabel2(raw);
      if (!SKILL_SET.has(name)) continue;
      vantageByName.set(name, ((_k = vantageByName.get(name)) != null ? _k : 0) - 1);
    }
    for (const raw of (_l = traits["Skill B."]) != null ? _l : []) {
      const match = raw.match(/^\s*([+\-]?\d+(?:\.\d+)?)\s+(.+?)\s*$/);
      if (!match) continue;
      const bonus = parseFloat(match[1]);
      const name = bareLabel2(match[2]);
      if (!Number.isFinite(bonus) || !SKILL_SET.has(name)) continue;
      bonusByName.set(name, ((_m = bonusByName.get(name)) != null ? _m : 0) + bonus);
    }
    const additional = (_n = self.additional) != null ? _n : {};
    for (const n of (_o = additional.profs) != null ? _o : []) {
      if (SKILL_SET.has(n)) profCounts.set(n, ((_p = profCounts.get(n)) != null ? _p : 0) + 1);
    }
    for (const n of (_q = additional.expertise) != null ? _q : []) {
      if (SKILL_SET.has(n)) profCounts.set(n, Math.max((_r = profCounts.get(n)) != null ? _r : 0, 2));
    }
    for (const n of (_s = additional.half_profs) != null ? _s : []) {
      if (SKILL_SET.has(n)) halfNames.add(n);
    }
    const derivedProficiency = (name) => {
      var _a2;
      const count = (_a2 = profCounts.get(name)) != null ? _a2 : 0;
      if (count >= 2) return 2;
      if (count >= 1) return 1;
      if (halfNames.has(name)) return 0.5;
      return 0;
    };
    const resolveSkill = (name) => {
      var _a2, _b2, _c2, _d2, _e2;
      const override = self[name];
      return {
        proficiency: (_a2 = override == null ? void 0 : override.proficiency) != null ? _a2 : derivedProficiency(name),
        vantage: (_c2 = (_b2 = override == null ? void 0 : override.vantage) != null ? _b2 : vantageByName.get(name)) != null ? _c2 : 0,
        bonus: (_e2 = (_d2 = override == null ? void 0 : override.bonus) != null ? _d2 : bonusByName.get(name)) != null ? _e2 : 0
      };
    };
    return /* @__PURE__ */ React5.createElement("section", { "aria-details": "Character Skills" }, /* @__PURE__ */ React5.createElement("header", { className: "rpg-tag-heading" }, /* @__PURE__ */ React5.createElement("span", null, "Skills")), /* @__PURE__ */ React5.createElement("menu", null, SKILLS.map(({ name, attr }) => {
      const skill = resolveSkill(name);
      const mod = expressions.ModifierTotal({
        attribute: attr,
        proficiency: skill.proficiency,
        bonus: skill.bonus
      });
      const vantage = skill.vantage;
      return /* @__PURE__ */ React5.createElement("li", { key: name, "data-vantage": vantage > 0 ? "adv" : vantage < 0 ? "dis" : void 0 }, /* @__PURE__ */ React5.createElement(ProfDot, { level: skill.proficiency }), /* @__PURE__ */ React5.createElement("abbr", { "aria-details": "Skill Attribute" }, attr), /* @__PURE__ */ React5.createElement("span", { "aria-details": "Skill Name" }, /* @__PURE__ */ React5.createElement(import_rpg_ui_toolkit4.Markdown, { source: `[[${name}]]`, className: "rpg-inline-md" })), /* @__PURE__ */ React5.createElement("data", { value: mod }, vantage > 0 && /* @__PURE__ */ React5.createElement(VantageBadge, { kind: "adv" }), vantage < 0 && /* @__PURE__ */ React5.createElement(VantageBadge, { kind: "dis" }), formatMod(mod)));
    })));
  };
  var skills_default = skills;

  // vault:tales-of-the-valiant/config/blocks/character/rolls.tsx
  var React6 = __toESM(__require("react"));
  var import_rpg_ui_toolkit5 = __require("rpg-ui-toolkit");
  var rolls = ({ self, blocks, lookup }) => {
    const stats2 = resolveWielderStats(blocks);
    const characterLevel = resolveCharacterLevel(blocks);
    const equip = resolveEquipState(blocks, lookup);
    const resolvedCasters = resolveCasters(blocks, lookup);
    const rawRows = [
      ...deriveWeaponRows(blocks, lookup, stats2, equip),
      ...deriveSpellRows(blocks, lookup, stats2, resolvedCasters, characterLevel),
      ...deriveFeatureRows(blocks, lookup, characterLevel),
      ...deriveManualRows(self.rolls)
    ];
    const rows = rawRows.map((row) => ({
      ...row,
      available: isRollAvailable(row.kind, row.roll, row.sourceNote, equip)
    }));
    return /* @__PURE__ */ React6.createElement("section", { "aria-details": "Character Rolls", className: "rpg-rolls" }, rows.length === 0 ? /* @__PURE__ */ React6.createElement(React6.Fragment, null, /* @__PURE__ */ React6.createElement("header", { className: "rpg-tag-heading" }, /* @__PURE__ */ React6.createElement("span", null, "Rolls")), /* @__PURE__ */ React6.createElement("p", { className: "rpg-rolls__empty" }, /* @__PURE__ */ React6.createElement("em", null, "No rolls available."))) : /* @__PURE__ */ React6.createElement("div", { className: "rpg-rolls__scroll" }, /* @__PURE__ */ React6.createElement("table", { className: "rpg-rolls__table" }, /* @__PURE__ */ React6.createElement("thead", { className: "rpg-rolls__head-band" }, /* @__PURE__ */ React6.createElement("tr", null, /* @__PURE__ */ React6.createElement("th", { className: "rpg-rolls__head-label" }, "Rolls"), /* @__PURE__ */ React6.createElement("th", null, "Hit"), /* @__PURE__ */ React6.createElement("th", null, "DC"), /* @__PURE__ */ React6.createElement("th", null, "Range"), /* @__PURE__ */ React6.createElement("th", null, "Damage"), /* @__PURE__ */ React6.createElement("th", null, "Cost"), /* @__PURE__ */ React6.createElement("th", null, "Effects"))), /* @__PURE__ */ React6.createElement("tbody", null, rows.map((row) => /* @__PURE__ */ React6.createElement(RollRowUI, { key: row.id, row, blocks, stats: stats2, characterLevel }))))));
  };
  function useNoteKey() {
    return React6.useMemo(() => {
      var _a, _b, _c, _d;
      const app = globalThis.app;
      return (_d = (_c = (_b = (_a = app == null ? void 0 : app.workspace) == null ? void 0 : _a.getActiveFile) == null ? void 0 : _b.call(_a)) == null ? void 0 : _c.path) != null ? _d : "default";
    }, []);
  }
  function usePersistentNumber(storageKey, defaultValue) {
    const [value, setValue] = React6.useState(() => {
      try {
        if (typeof localStorage === "undefined") return defaultValue;
        const stored = localStorage.getItem(storageKey);
        if (stored === null || stored === "") return defaultValue;
        const parsed = Number(stored);
        return Number.isFinite(parsed) ? parsed : defaultValue;
      } catch (e) {
        return defaultValue;
      }
    });
    const update = React6.useCallback(
      (next) => {
        setValue(next);
        try {
          if (next === void 0) localStorage.removeItem(storageKey);
          else localStorage.setItem(storageKey, String(next));
        } catch (e) {
        }
      },
      [storageKey]
    );
    return [value, update];
  }
  function filterCastableCircles(declaredCircles, caster, blocks) {
    var _a;
    if (!caster || caster.tier === "none") {
      return { castable: declaredCircles, anyAvailable: true };
    }
    const spells2 = blocks == null ? void 0 : blocks.spells;
    const state = (_a = spells2 == null ? void 0 : spells2.casters) == null ? void 0 : _a[caster.source];
    const maxByCircle = slotsForCaster(caster.tier, caster.level);
    const castable = declaredCircles.filter((c) => {
      var _a2, _b, _c, _d, _e;
      if (c === 0) return true;
      const max = (_a2 = maxByCircle[c - 1]) != null ? _a2 : 0;
      const spent = Number((_e = (_d = (_b = state == null ? void 0 : state.spent) == null ? void 0 : _b[c]) != null ? _d : (_c = state == null ? void 0 : state.spent) == null ? void 0 : _c[String(c)]) != null ? _e : 0) || 0;
      return max - spent > 0;
    });
    const anyAvailable = declaredCircles.length === 0 || castable.length > 0;
    return { castable, anyAvailable };
  }
  function RollRowUI({
    row,
    blocks,
    stats: stats2,
    characterLevel
  }) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j;
    const noteKey = useNoteKey();
    const baseRoll = row.roll;
    const declaredCircles = baseRoll.upcast ? [baseRoll.circle, ...Object.keys(baseRoll.upcast).map(Number)].filter((n) => typeof n === "number" && Number.isFinite(n)).sort((a, b) => a - b) : [];
    const { castable, anyAvailable } = filterCastableCircles(declaredCircles, row.caster, blocks);
    const [upcastCircleRaw, setUpcastCircle] = usePersistentNumber(
      `${noteKey}:rolls:${row.id}:upcast`,
      baseRoll.circle
    );
    const upcastCircle = React6.useMemo(() => {
      var _a2;
      if (castable.length === 0) return upcastCircleRaw;
      if (upcastCircleRaw != null && castable.includes(upcastCircleRaw)) return upcastCircleRaw;
      return castable.includes((_a2 = baseRoll.circle) != null ? _a2 : -1) ? baseRoll.circle : castable[0];
    }, [upcastCircleRaw, castable, baseRoll.circle]);
    const swapOptions = (_b = (_a = baseRoll.swapOn) == null ? void 0 : _a.options) != null ? _b : [];
    const swapInitialIdx = React6.useMemo(() => {
      if (!baseRoll.swapOn) return 0;
      const baseValue = baseRoll.swapOn.field === "range" ? baseRoll.range : baseRoll.name;
      const match = swapOptions.findIndex((o) => o.value === baseValue);
      return match >= 0 ? match : 0;
    }, [baseRoll, swapOptions]);
    const [swapIndexRaw, setSwapIndex] = usePersistentNumber(
      `${noteKey}:rolls:${row.id}:swap`,
      swapInitialIdx
    );
    const swapIndex = swapIndexRaw != null ? swapIndexRaw : swapInitialIdx;
    const [costAmountRaw, setCostAmount] = usePersistentNumber(
      `${noteKey}:rolls:${row.id}:cost`,
      (_c = baseRoll.cost) == null ? void 0 : _c.amount
    );
    const costAmount = costAmountRaw;
    let roll = baseRoll;
    if (baseRoll.upcast && upcastCircle != null && upcastCircle !== baseRoll.circle) {
      roll = applyRollOverride(roll, baseRoll.upcast[upcastCircle]);
    }
    if (baseRoll.swapOn && swapOptions[swapIndex]) {
      const opt = swapOptions[swapIndex];
      roll = applyRollOverride(roll, opt);
      if (baseRoll.swapOn.field === "range") roll = { ...roll, range: opt.value };
      else roll = { ...roll, name: opt.value };
    }
    const name = roll.name || row.sourceNote;
    const dcText = roll.save ? `${roll.save.ability} ${(_d = roll.save.dc) != null ? _d : "\u2014"}` : "";
    const formHasHit = roll.form === "melee" || roll.form === "ranged" || roll.form === "spell";
    const hitText = formHasHit ? (_e = roll.to_hit) != null ? _e : "" : "";
    const slotGated = row.kind === "spell" && declaredCircles.length > 0 && !anyAvailable;
    const available = row.available && !slotGated;
    const unavailReason = !row.available ? `Unavailable: needs ${(_f = roll.requires) != null ? _f : "equip"}` : slotGated ? "Unavailable: out of spell slots" : void 0;
    const cycleUpcast = () => {
      if (castable.length <= 1) return;
      const active = upcastCircle != null ? upcastCircle : castable[0];
      const idx = castable.indexOf(active);
      const next = castable[(idx + 1) % castable.length];
      setUpcastCircle(next);
    };
    const cycleSwap = () => {
      if (swapOptions.length <= 1) return;
      setSwapIndex((swapIndex + 1) % swapOptions.length);
    };
    const resolvedCostMax = resolveCostMax((_g = baseRoll.cost) == null ? void 0 : _g.max, {
      pb: stats2.pb,
      characterLevel,
      sourceLevel: row.sourceLevel
    });
    const cycleCost = () => {
      const cost = baseRoll.cost;
      if (!cost || resolvedCostMax == null || resolvedCostMax <= 1) return;
      const current = costAmount != null ? costAmount : cost.amount;
      const next = current >= resolvedCostMax ? 1 : current + 1;
      setCostAmount(next);
    };
    return /* @__PURE__ */ React6.createElement(
      "tr",
      {
        "data-form": roll.form,
        "data-available": available ? "true" : "false",
        "aria-description": unavailReason
      },
      /* @__PURE__ */ React6.createElement("td", { className: "rpg-rolls__name" }, /* @__PURE__ */ React6.createElement(
        FormCell,
        {
          roll: baseRoll,
          effectiveCircle: upcastCircle,
          onCycle: cycleUpcast,
          canCycle: castable.length > 1
        }
      ), /* @__PURE__ */ React6.createElement(
        SwapOrText,
        {
          field: "name",
          value: name,
          swapOn: baseRoll.swapOn,
          onCycle: cycleSwap,
          fallback: /* @__PURE__ */ React6.createElement("a", { className: "internal-link", href: row.sourceNote, "data-href": row.sourceNote }, name)
        }
      )),
      /* @__PURE__ */ React6.createElement("td", { className: "rpg-rolls__hit" }, hitText),
      /* @__PURE__ */ React6.createElement("td", { className: "rpg-rolls__dc" }, dcText),
      /* @__PURE__ */ React6.createElement("td", { className: "rpg-rolls__range" }, /* @__PURE__ */ React6.createElement(
        SwapOrText,
        {
          field: "range",
          value: (_h = roll.range) != null ? _h : "",
          swapOn: baseRoll.swapOn,
          onCycle: cycleSwap
        }
      )),
      /* @__PURE__ */ React6.createElement("td", { className: "rpg-rolls__damage" }, /* @__PURE__ */ React6.createElement(DamageCell, { damage: roll.damage })),
      /* @__PURE__ */ React6.createElement("td", { className: "rpg-rolls__cost" }, /* @__PURE__ */ React6.createElement(
        CostCell,
        {
          cost: roll.cost,
          amount: (_j = costAmount != null ? costAmount : (_i = roll.cost) == null ? void 0 : _i.amount) != null ? _j : 1,
          resolvedMax: resolvedCostMax,
          onCycle: cycleCost
        }
      )),
      /* @__PURE__ */ React6.createElement("td", { className: "rpg-rolls__effects" }, /* @__PURE__ */ React6.createElement(EffectsCell, { roll }))
    );
  }
  function DamageCell({ damage }) {
    if (!damage) return null;
    const list = Array.isArray(damage) ? damage : [damage];
    return /* @__PURE__ */ React6.createElement(React6.Fragment, null, list.map((d, i) => /* @__PURE__ */ React6.createElement(React6.Fragment, { key: i }, i > 0 && /* @__PURE__ */ React6.createElement("span", { className: "rpg-rolls__damage-sep" }, " + "), /* @__PURE__ */ React6.createElement("span", { className: "rpg-rolls__damage-roll" }, compactDie(d.roll, d.bonus)), /* @__PURE__ */ React6.createElement("span", { className: "rpg-rolls__damage-type" }, " ", d.type))));
  }
  function compactDie(roll, bonus) {
    if (!bonus || bonus === "+0") return roll;
    return `${roll}${bonus.startsWith("-") ? bonus : `+${bonus.replace(/^\+/, "")}`}`;
  }
  function EffectsCell({ roll }) {
    var _a, _b, _c, _d, _e;
    const pills = [];
    const onSuccess = (_c = (_b = (_a = roll.save) == null ? void 0 : _a.on_success) == null ? void 0 : _b.toLowerCase()) != null ? _c : "";
    if (onSuccess.includes("half")) {
      pills.push({
        glyph: "\xBD",
        label: "Half damage on successful save",
        cls: "rpg-rolls__icon--save-half",
        key: "save-half"
      });
    } else if (onSuccess.includes("no")) {
      pills.push({
        glyph: "\u2205",
        label: "No damage on successful save",
        cls: "rpg-rolls__icon--save-none",
        key: "save-none"
      });
    } else if (roll.save) {
      pills.push({
        glyph: "\u21BA",
        label: `On save: ${(_d = roll.save.on_success) != null ? _d : "negates effect"}`,
        cls: "rpg-rolls__icon--save-other",
        key: "save-other"
      });
    }
    for (const [idx, eff] of ((_e = roll.effects) != null ? _e : []).entries()) {
      const resolved = resolveEffect(eff);
      if (!resolved) continue;
      pills.push({
        glyph: resolved.glyph,
        label: resolved.label,
        cls: "rpg-rolls__icon--condition",
        key: `eff-${idx}`
      });
    }
    return /* @__PURE__ */ React6.createElement(React6.Fragment, null, pills.map((p) => {
      var _a2;
      return /* @__PURE__ */ React6.createElement(
        "span",
        {
          key: p.key,
          className: `rpg-rolls__icon ${(_a2 = p.cls) != null ? _a2 : ""}`,
          "data-tip": p.label,
          "aria-label": p.label
        },
        p.glyph
      );
    }), roll.notes && /* @__PURE__ */ React6.createElement("small", { className: "rpg-rolls__notes-text" }, roll.notes));
  }
  var EFFECT_VOCABULARY = {
    blinded: { glyph: "\u{1F441}", label: "Blinded" },
    prone: { glyph: "\u2935", label: "Knocked prone" },
    poisoned: { glyph: "\u2620", label: "Poisoned" },
    charmed: { glyph: "\u2665", label: "Charmed" },
    restrained: { glyph: "\u{1FAA2}", label: "Restrained" },
    grappled: { glyph: "\u270A", label: "Grappled" },
    frightened: { glyph: "\u{1F631}", label: "Frightened" },
    stunned: { glyph: "\u{1F4AB}", label: "Stunned" },
    deafened: { glyph: "\u{1F442}", label: "Deafened" },
    unconscious: { glyph: "\u{1F4A4}", label: "Unconscious" },
    push: { glyph: "\u2192", label: "Pushes the target" },
    pin: { glyph: "\u{1F4CC}", label: "Pinned" }
  };
  function resolveEffect(eff) {
    var _a;
    if (typeof eff === "string") {
      const hit = EFFECT_VOCABULARY[eff.toLowerCase()];
      if (hit) return hit;
      return { glyph: eff, label: eff };
    }
    if (eff && typeof eff === "object" && typeof eff.icon === "string") {
      return { glyph: eff.icon, label: (_a = eff.label) != null ? _a : eff.icon };
    }
    return null;
  }
  function CostCell({
    cost,
    amount,
    resolvedMax,
    onCycle
  }) {
    if (!cost) return null;
    const resolved = resolveCost(cost);
    const label = `${amount}\xD7 ${resolved.label}`;
    const canCycle = resolvedMax != null && resolvedMax > 1;
    const content = /* @__PURE__ */ React6.createElement(React6.Fragment, null, /* @__PURE__ */ React6.createElement("span", { className: "rpg-rolls__cost-amount" }, amount), /* @__PURE__ */ React6.createElement("span", { className: "rpg-rolls__cost-icon", "aria-hidden": "true" }, resolved.glyph));
    if (canCycle) {
      return /* @__PURE__ */ React6.createElement(
        "button",
        {
          type: "button",
          className: "rpg-rolls__cost-btn",
          onClick: onCycle,
          "aria-label": `${label}. Click to cycle.`,
          "data-tip": `${label} \u2014 click to cycle`
        },
        content
      );
    }
    return /* @__PURE__ */ React6.createElement("span", { className: "rpg-rolls__cost-label", "aria-label": label, "data-tip": label }, content);
  }
  var COST_VOCABULARY = {
    "hit-dice": { glyph: "\u{1F3B2}", label: "Hit dice" },
    "channel-divinity": { glyph: "\u271D", label: "Channel Divinity" },
    "wild-shape": { glyph: "\u{1F43E}", label: "Wild Shape" },
    "mystic-mark": { glyph: "\u{1F3AF}", label: "Mystic Mark" },
    "pb-pool": { glyph: "\u2742", label: "PB-pool use" },
    rage: { glyph: "\u{1F525}", label: "Rage" },
    ki: { glyph: "\u262F", label: "Ki point" },
    "sorcery-point": { glyph: "\u27E1", label: "Sorcery point" },
    "superiority-die": { glyph: "\u25C8", label: "Superiority die" },
    "bardic-inspiration": { glyph: "\u{1F3B5}", label: "Bardic Inspiration" }
  };
  function resolveCost(cost) {
    const hit = COST_VOCABULARY[cost.type.toLowerCase()];
    if (hit) return hit;
    return { glyph: cost.type, label: cost.type };
  }
  var CIRCLED_NUMERALS = {
    0: "\u24EA",
    1: "\u2460",
    2: "\u2461",
    3: "\u2462",
    4: "\u2463",
    5: "\u2464",
    6: "\u2465",
    7: "\u2466",
    8: "\u2467",
    9: "\u2468"
  };
  function FormCell({
    roll,
    effectiveCircle,
    onCycle,
    canCycle
  }) {
    var _a;
    if (roll.circle != null) {
      const circle = effectiveCircle != null ? effectiveCircle : roll.circle;
      const glyph = (_a = CIRCLED_NUMERALS[circle]) != null ? _a : "\u2728";
      if (roll.upcast && canCycle) {
        return /* @__PURE__ */ React6.createElement(
          "button",
          {
            type: "button",
            className: "rpg-rolls__form-icon rpg-rolls__form-icon--upcast",
            onClick: onCycle,
            "aria-label": `Cast at circle ${circle}. Click to cycle.`,
            "data-tip": `Circle ${circle} \u2014 click to cycle`
          },
          glyph
        );
      }
      return /* @__PURE__ */ React6.createElement("span", { className: "rpg-rolls__form-icon", "aria-label": `Circle ${circle}` }, glyph);
    }
    return /* @__PURE__ */ React6.createElement("span", { className: "rpg-rolls__form-icon", "aria-label": `Form: ${roll.form}` }, /* @__PURE__ */ React6.createElement(FormIcon, { form: roll.form }));
  }
  function SwapOrText({
    field,
    value,
    swapOn,
    onCycle,
    fallback
  }) {
    if ((swapOn == null ? void 0 : swapOn.field) === field && swapOn.options.length > 1) {
      return /* @__PURE__ */ React6.createElement(
        "button",
        {
          type: "button",
          className: "rpg-rolls__swap-btn",
          onClick: onCycle,
          "aria-label": `${value}. Click to cycle.`,
          "data-tip": `${value} \u2014 click to cycle`
        },
        value
      );
    }
    return /* @__PURE__ */ React6.createElement(React6.Fragment, null, fallback != null ? fallback : value);
  }
  function FormIcon({ form }) {
    var _a;
    const map = {
      melee: "\u2694",
      ranged: "\u{1F3F9}",
      spell: "\u2728",
      save: "\u{1F6E1}",
      rider: "\u2295",
      healing: "\u271A",
      temp: "\u{1F499}"
    };
    return /* @__PURE__ */ React6.createElement("span", { "aria-hidden": "true" }, (_a = map[form]) != null ? _a : "?");
  }
  function resolveCharacterLevel(blocks) {
    const header2 = blocks == null ? void 0 : blocks.header;
    if (!Array.isArray(header2 == null ? void 0 : header2.classes)) return 0;
    return header2.classes.reduce(
      (acc, c) => acc + (typeof c.level === "number" ? c.level : 0),
      0
    );
  }
  function applyRollOverride(base, override) {
    if (!override) return base;
    const next = { ...base };
    if (override.name !== void 0) next.name = override.name;
    if (override.damage !== void 0) next.damage = override.damage;
    if (override.to_hit !== void 0) next.to_hit = override.to_hit;
    if (override.range !== void 0) next.range = override.range;
    if (override.save !== void 0) next.save = override.save;
    if (override.effects !== void 0) next.effects = override.effects;
    if (override.notes !== void 0) next.notes = override.notes;
    return next;
  }
  function resolveLeveled(base, kind, sourceLevel, characterLevel) {
    var _a;
    const leveled = base.leveled;
    if (!leveled) return base;
    const by = (_a = leveled.by) != null ? _a : kind === "feature" ? "class" : "character";
    const level2 = by === "class" ? sourceLevel : characterLevel;
    if (level2 == null) return base;
    const thresholds = Object.keys(leveled.at).map((k) => Number(k)).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
    let picked;
    for (const t of thresholds) {
      if (t <= level2) picked = t;
      else break;
    }
    if (picked == null) return base;
    return applyRollOverride(base, leveled.at[picked]);
  }
  function resolveCostMax(max, ctx) {
    var _a;
    if (max == null) return void 0;
    if (typeof max === "number") return max;
    const raw = max.trim();
    if (!raw) return void 0;
    switch (raw) {
      case "PB":
        return ctx.pb;
      case "level":
        return ctx.characterLevel;
      case "class_level":
        return (_a = ctx.sourceLevel) != null ? _a : ctx.characterLevel;
      default: {
        const n = Number(raw);
        return Number.isFinite(n) ? n : void 0;
      }
    }
  }
  function resolveWielderStats(blocks) {
    var _a;
    const stats2 = (_a = blocks == null ? void 0 : blocks.stats) != null ? _a : {};
    const pick = (key) => {
      const cell = stats2[key];
      if (typeof cell === "number") return cell;
      if (cell && typeof cell === "object" && typeof cell.value === "number") {
        return cell.value;
      }
      return 10;
    };
    const mod = (score) => Math.floor((score - 10) / 2);
    const header2 = blocks == null ? void 0 : blocks.header;
    const classLevels = Array.isArray(header2 == null ? void 0 : header2.classes) ? header2.classes.reduce(
      (acc, c) => acc + (typeof c.level === "number" ? c.level : 0),
      0
    ) : 0;
    const pb = Math.floor(Math.max(0, classLevels - 1) / 4) + 2;
    return {
      str: mod(pick("STR")),
      dex: mod(pick("DEX")),
      con: mod(pick("CON")),
      int: mod(pick("INT")),
      wis: mod(pick("WIS")),
      cha: mod(pick("CHA")),
      pb
    };
  }
  function deriveWeaponRows(blocks, lookup, stats2, equip) {
    var _a, _b, _c, _d, _e;
    const inv = blocks == null ? void 0 : blocks.inventory;
    const rawItems = Array.isArray(inv == null ? void 0 : inv.items) ? inv.items : [];
    const items = rawItems.flatMap(flattenItemEntries);
    const library = (_a = lookup == null ? void 0 : lookup.$items) != null ? _a : {};
    const magicLib = (_b = lookup == null ? void 0 : lookup.$magic) != null ? _b : {};
    const personalLib = (_c = lookup == null ? void 0 : lookup.$personal) != null ? _c : {};
    const rows = [];
    const handItems = /* @__PURE__ */ new Set();
    if (equip.mainHand) handItems.add(equip.mainHand);
    if (equip.offHand) handItems.add(equip.offHand);
    const qtyByName = /* @__PURE__ */ new Map();
    for (const entry of items) {
      const name = stripWikilink(entry.name);
      if (!name) continue;
      const prev = (_d = qtyByName.get(name)) != null ? _d : 0;
      qtyByName.set(name, prev + (typeof entry.qty === "number" ? entry.qty : 1));
    }
    const emitted = /* @__PURE__ */ new Set();
    for (const entry of items) {
      const target = stripWikilink(entry.name);
      if (!target) continue;
      if (!handItems.has(target)) continue;
      if (emitted.has(target)) continue;
      emitted.add(target);
      const personal2 = personalLib[target];
      let element2;
      let overlay;
      if (personal2) {
        const resolution = (0, import_rpg_ui_toolkit5.resolvePersonalItem)(personal2, { elements: library, magic: magicLib }, target);
        if (!resolution) continue;
        element2 = resolution.effectiveElement;
        overlay = resolution.weaponOverlay;
      } else {
        const itemData = library[target];
        if (!itemData) continue;
        element2 = itemData;
      }
      const derived = (0, import_rpg_ui_toolkit5.deriveWeaponRolls)(element2, stats2, overlay, target);
      if (derived.length === 0) continue;
      derived.forEach((roll, i) => {
        rows.push({
          id: derived.length > 1 ? `weapon:${target}:${i}` : `weapon:${target}`,
          kind: "weapon",
          roll,
          sourceNote: target
        });
      });
      const qty = (_e = qtyByName.get(target)) != null ? _e : 0;
      if (target === equip.mainHand && qty >= 2 && hasWeaponProperty(element2, "light")) {
        const offHand = (0, import_rpg_ui_toolkit5.deriveWeaponRolls)(element2, stats2, { ...overlay, offHand: true }, `${target} (Off-hand)`);
        const primary = offHand[0];
        if (primary) {
          rows.push({
            id: `weapon:${target}:offhand`,
            kind: "weapon",
            roll: primary,
            sourceNote: target
          });
        }
      }
    }
    return rows;
  }
  function flattenItemEntries(raw) {
    if (typeof raw === "string") return [{ name: raw }];
    if (!raw || typeof raw !== "object") return [];
    const o = raw;
    const out = [];
    if (typeof o.name === "string") {
      const qty = typeof o.qty === "number" ? o.qty : typeof o.quantity === "number" ? o.quantity : void 0;
      out.push({ name: o.name, qty, equipped: o.equipped, slot: o.slot });
    }
    if (Array.isArray(o.contents)) {
      for (const c of o.contents) out.push(...flattenItemEntries(c));
    }
    return out;
  }
  function stripWikilink(raw) {
    const m = raw.match(/^\[\[(.+?)\]\]$/);
    if (!m) return raw.trim();
    return m[1].split("|")[0].split("/").pop().trim();
  }
  function resolveCasters(blocks, lookup) {
    var _a, _b;
    const out = /* @__PURE__ */ new Map();
    const header2 = blocks == null ? void 0 : blocks.header;
    const features2 = blocks == null ? void 0 : blocks.features;
    if (!header2 || !(lookup == null ? void 0 : lookup.$features)) return out;
    try {
      const view = lookup.$features(header2, features2 == null ? void 0 : features2.choices, features2 == null ? void 0 : features2.additional);
      for (const caster of (_a = view.casters) != null ? _a : []) {
        const c = caster;
        out.set(c.source, {
          source: c.source,
          ability: c.ability,
          tier: (_b = c.tier) != null ? _b : "none",
          level: typeof c.level === "number" ? c.level : 0
        });
      }
    } catch (e) {
    }
    return out;
  }
  function deriveSpellRows(blocks, lookup, stats2, casters, characterLevel) {
    var _a, _b, _c, _d, _e, _f;
    const spellsBlock = blocks == null ? void 0 : blocks.spells;
    const castersState = (_a = spellsBlock == null ? void 0 : spellsBlock.casters) != null ? _a : {};
    const library = (_b = lookup == null ? void 0 : lookup.$spells) != null ? _b : {};
    const seen = /* @__PURE__ */ new Set();
    const rows = [];
    for (const [source, state] of Object.entries(castersState)) {
      const resolved = casters.get(source);
      if (!resolved) continue;
      const abilityMod = abilityModFromStats(stats2, resolved.ability);
      const toHit = `${(0, import_rpg_ui_toolkit5.signed)(stats2.pb + abilityMod)} (${resolved.ability})`;
      const dc = `${8 + stats2.pb + abilityMod}`;
      const pool = [...(_c = state.cantrips) != null ? _c : [], ...flattenSpellLevels(state.prepared), ...flattenSpellLevels(state.known)];
      for (const raw of pool) {
        const name = stripWikilink(raw);
        if (!name || seen.has(name)) continue;
        seen.add(name);
        const body = library[name];
        const roll = body == null ? void 0 : body.roll;
        if (!roll) continue;
        const filled = {
          ...roll,
          name: (_d = roll.name) != null ? _d : name,
          to_hit: roll.form === "spell" ? (_e = roll.to_hit) != null ? _e : toHit : roll.to_hit,
          save: roll.save ? { ...roll.save, dc: (_f = roll.save.dc) != null ? _f : dc } : roll.save
        };
        const leveled = resolveLeveled(filled, "spell", void 0, characterLevel);
        rows.push({
          id: `spell:${source}:${name}`,
          kind: "spell",
          roll: leveled,
          sourceNote: name,
          caster: resolved
        });
      }
    }
    return rows;
  }
  function abilityModFromStats(stats2, ability) {
    const key = ability.trim().toUpperCase();
    switch (key) {
      case "STR":
        return stats2.str;
      case "DEX":
        return stats2.dex;
      case "CON":
        return stats2.con;
      case "INT":
        return stats2.int;
      case "WIS":
        return stats2.wis;
      case "CHA":
        return stats2.cha;
      default:
        return 0;
    }
  }
  function flattenSpellLevels(map) {
    if (!map) return [];
    return Object.values(map).flatMap((v) => Array.isArray(v) ? v : []);
  }
  function deriveFeatureRows(blocks, lookup, characterLevel) {
    var _a, _b;
    const header2 = blocks == null ? void 0 : blocks.header;
    const features2 = blocks == null ? void 0 : blocks.features;
    if (!header2 || !(lookup == null ? void 0 : lookup.$features)) return [];
    const view = lookup.$features(header2, features2 == null ? void 0 : features2.choices, features2 == null ? void 0 : features2.additional);
    const rows = [];
    for (const src of (_a = view.sources) != null ? _a : []) {
      for (const f of src.features) {
        if (!f.roll) continue;
        const rowName = (_b = f.roll.name) != null ? _b : f.name;
        const named = { ...f.roll, name: rowName };
        const leveled = resolveLeveled(named, "feature", src.level, characterLevel);
        rows.push({
          id: `feature:${src.source}:${f.name}:${rowName}`,
          kind: "feature",
          roll: leveled,
          sourceNote: src.source,
          sourceLevel: src.level
        });
      }
    }
    return rows;
  }
  function deriveManualRows(manual) {
    if (!Array.isArray(manual)) return [];
    const rows = [];
    manual.forEach((atk, i) => {
      const name = atk.name || atk.label || `Roll ${i + 1}`;
      const aspect = {
        name,
        form: "melee",
        to_hit: typeof atk.to_hit === "number" ? (0, import_rpg_ui_toolkit5.signed)(atk.to_hit) : typeof atk.to_hit === "string" ? atk.to_hit : void 0,
        range: atk.range,
        damage: atk.damage ? { roll: atk.damage.roll, type: atk.damage.type, bonus: atk.damage.bonus } : void 0,
        notes: atk.notes
      };
      rows.push({
        id: `manual:${i}`,
        kind: "manual",
        roll: aspect,
        sourceNote: name
      });
    });
    return rows;
  }
  function resolveEquipState(blocks, lookup) {
    var _a;
    const state = { mainHand: null, offHand: null };
    const inv = blocks == null ? void 0 : blocks.inventory;
    const rawItems = Array.isArray(inv == null ? void 0 : inv.items) ? inv.items : [];
    const items = rawItems.flatMap(flattenItemEntries);
    const library = (_a = lookup == null ? void 0 : lookup.$items) != null ? _a : {};
    for (const entry of items) {
      if (!entry.equipped && !entry.slot) continue;
      const target = stripWikilink(entry.name);
      if (!target) continue;
      const itemData = library[target];
      const isTwoHanded = (itemData == null ? void 0 : itemData.weapon) ? hasProperty(itemData.weapon.properties, "two-handed") : false;
      if (entry.slot === "main_hand") {
        state.mainHand = target;
        if (isTwoHanded) state.offHand = target;
      } else if (entry.slot === "off_hand" || entry.slot === "shield") {
        state.offHand = target;
      } else if (entry.equipped && (itemData == null ? void 0 : itemData.weapon)) {
        if (!state.mainHand) state.mainHand = target;
        if (isTwoHanded && !state.offHand) state.offHand = target;
      }
    }
    return state;
  }
  function hasProperty(properties, name) {
    if (!properties) return false;
    const target = name.toLowerCase();
    return properties.some((p) => {
      const bare = p.replace(/^\[\[/, "").replace(/\]\]$/, "").split("|")[0].toLowerCase();
      return bare === target;
    });
  }
  function hasWeaponProperty(element2, name) {
    var _a;
    return hasProperty((_a = element2.weapon) == null ? void 0 : _a.properties, name);
  }
  function isRollAvailable(kind, roll, sourceNote, equip) {
    var _a;
    const requires = (_a = roll.requires) != null ? _a : roll.form === "melee" || roll.form === "ranged" ? "one_hand" : "none";
    if (kind === "weapon") {
      const inMain = equip.mainHand === sourceNote;
      const inOff = equip.offHand === sourceNote;
      if (!inMain && !inOff) return false;
      if (requires === "two_hands") {
        return inMain && (equip.offHand === null || equip.offHand === sourceNote);
      }
      return true;
    }
    switch (requires) {
      case "none":
        return true;
      case "one_hand":
        return equip.mainHand !== null || equip.offHand !== null;
      case "two_hands":
        return equip.mainHand !== null && (equip.offHand === null || equip.offHand === equip.mainHand);
      case "free_hand":
        return equip.mainHand === null || equip.offHand === null;
      default:
        return true;
    }
  }
  var rolls_default = rolls;

  // vault:tales-of-the-valiant/config/blocks/character/proficiencies.tsx
  var React7 = __toESM(__require("react"));
  var import_rpg_ui_toolkit6 = __require("rpg-ui-toolkit");
  function bareLabel3(raw) {
    let s;
    if (typeof raw === "string") {
      s = raw;
    } else if (Array.isArray(raw)) {
      let v = raw;
      while (Array.isArray(v)) v = v[0];
      s = typeof v === "string" ? `[[${v}]]` : String(v != null ? v : "");
    } else {
      s = String(raw != null ? raw : "");
    }
    return s.replace(/^\+/, "").replace(/^\[\[/, "").replace(/\]\]$/, "").split("|")[0].trim();
  }
  function readTrait(traits, key) {
    var _a;
    const raw = (_a = traits == null ? void 0 : traits[key]) != null ? _a : [];
    const seen = /* @__PURE__ */ new Set();
    const out = [];
    for (const v of raw) {
      const label = bareLabel3(v);
      if (!label || seen.has(label)) continue;
      seen.add(label);
      out.push(label);
    }
    return out;
  }
  function buildCategories(data, inUse) {
    const cats = [];
    if (data.weapons.length) cats.push({ label: "Weapons", items: data.weapons, linkItems: true, inUse: inUse.weapons });
    if (data.armor.length) cats.push({ label: "Armor", items: data.armor, linkItems: true, inUse: inUse.armor });
    if (data.tools.length) cats.push({ label: "Tools", items: data.tools, linkItems: true, inUse: inUse.tools });
    if (data.languages.length) cats.push({ label: "Languages", items: data.languages, linkItems: true });
    if (data.resistance.length) cats.push({ label: "Resistance", items: data.resistance, linkItems: true });
    if (data.immunity.length) cats.push({ label: "Immunity", items: data.immunity, linkItems: true });
    if (data.vulnerability.length) cats.push({ label: "Vulnerability", items: data.vulnerability, linkItems: true });
    return cats;
  }
  function resolveInUseProficiencies(blocks, lookup, profs) {
    var _a;
    const out = {
      armor: /* @__PURE__ */ new Set(),
      weapons: /* @__PURE__ */ new Set(),
      tools: /* @__PURE__ */ new Set()
    };
    const inv = blocks == null ? void 0 : blocks.inventory;
    const rawItems = Array.isArray(inv == null ? void 0 : inv.items) ? inv.items : [];
    const lib = (_a = lookup == null ? void 0 : lookup.$items) != null ? _a : {};
    const equippedWeaponTypes = [];
    const equippedWeaponNames = [];
    const equippedArmorCategories = [];
    let hasShield = false;
    const invToolNames = /* @__PURE__ */ new Set();
    for (const raw of rawItems) {
      if (!raw || typeof raw !== "object") continue;
      const o = raw;
      if (typeof o.name !== "string") continue;
      const name = wikiStem2(o.name);
      const fm = lib[name];
      if (!fm) continue;
      const type = typeof fm.type === "string" ? fm.type.toLowerCase() : "";
      const armorBlock = fm.armor && typeof fm.armor === "object" ? fm.armor : void 0;
      const armorCat = typeof (armorBlock == null ? void 0 : armorBlock.category) === "string" ? armorBlock.category.toLowerCase() : void 0;
      if (o.slot === "main_hand" || o.slot === "off_hand") {
        equippedWeaponTypes.push(type);
        equippedWeaponNames.push(name.toLowerCase());
      }
      if (o.slot === "armor" && armorCat) {
        equippedArmorCategories.push(armorCat);
      }
      if (armorCat === "shield") hasShield = true;
      if (/\btools?\b|\bkits?\b|\binstruments?\b/.test(type)) {
        invToolNames.add(name.toLowerCase());
      }
    }
    for (const prof of profs.weapons) {
      const lower = prof.toLowerCase();
      const typeMatch = new RegExp(`\\b${escapeRegex(lower)}\\b`);
      const matchesType = equippedWeaponTypes.some((t) => typeMatch.test(t));
      const matchesName = equippedWeaponNames.some((n) => n === lower);
      if (matchesType || matchesName) out.weapons.add(prof);
    }
    for (const prof of profs.armor) {
      const lower = prof.toLowerCase();
      if (lower === "shields") {
        if (hasShield) out.armor.add(prof);
        continue;
      }
      const re = new RegExp(`\\b${escapeRegex(lower.replace(/\s*armor$/, ""))}\\b`);
      if (equippedArmorCategories.some((c) => re.test(c))) out.armor.add(prof);
    }
    for (const prof of profs.tools) {
      if (invToolNames.has(prof.toLowerCase())) out.tools.add(prof);
    }
    return out;
  }
  function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  function wikiStem2(raw) {
    const m = raw.match(/^\[\[(.+?)\]\]$/);
    const inner = m ? m[1] : raw;
    return inner.split("|")[0].split("/").pop().trim();
  }
  var proficiencies = ({ self, blocks, lookup }) => {
    var _a, _b, _c;
    const header2 = blocks.header;
    const features2 = blocks.features;
    const inventory2 = blocks.inventory;
    const view = (_a = lookup.$features) == null ? void 0 : _a.call(lookup, header2, features2 == null ? void 0 : features2.choices, features2 == null ? void 0 : features2.additional, inventory2);
    const traits = (_b = view == null ? void 0 : view.traits) != null ? _b : {};
    const auto = {
      armor: readTrait(traits, "Armor"),
      weapons: readTrait(traits, "Weapons"),
      tools: readTrait(traits, "Tools"),
      languages: readTrait(traits, "Languages"),
      resistance: readTrait(traits, "Resistance"),
      immunity: readTrait(traits, "Immunity"),
      vulnerability: readTrait(traits, "Vulnerability")
    };
    const additional = (_c = self.additional) != null ? _c : {};
    const merge = (yaml, fromTraits, extra) => {
      const base = yaml && yaml.length > 0 ? yaml.map(bareLabel3) : fromTraits;
      const seen = new Set(base);
      const merged = [...base];
      for (const e of extra != null ? extra : []) {
        const label = bareLabel3(e);
        if (!label || seen.has(label)) continue;
        seen.add(label);
        merged.push(label);
      }
      return merged;
    };
    const data = {
      armor: merge(self.armor, auto.armor, additional.armor),
      weapons: merge(self.weapons, auto.weapons, additional.weapons),
      tools: merge(self.tools, auto.tools, additional.tools),
      languages: merge(self.languages, auto.languages, additional.languages),
      resistance: merge(self.resistance, auto.resistance, additional.resistance),
      immunity: merge(self.immunity, auto.immunity, additional.immunity),
      vulnerability: merge(self.vulnerability, auto.vulnerability, additional.vulnerability)
    };
    const cats = buildCategories(
      data,
      resolveInUseProficiencies(blocks, lookup, {
        armor: data.armor,
        weapons: data.weapons,
        tools: data.tools
      })
    );
    return /* @__PURE__ */ React7.createElement("section", { "aria-details": "Character Proficiencies" }, /* @__PURE__ */ React7.createElement("header", { className: "rpg-tag-heading" }, /* @__PURE__ */ React7.createElement("span", null, "Proficiencies")), /* @__PURE__ */ React7.createElement("dl", null, cats.map(({ label, items, linkItems, inUse }) => /* @__PURE__ */ React7.createElement("div", { key: label }, /* @__PURE__ */ React7.createElement("dt", null, label), items.map((item2, i) => {
      const active = inUse == null ? void 0 : inUse.has(item2);
      return /* @__PURE__ */ React7.createElement("dd", { key: i, "data-in-use": active ? "true" : void 0 }, linkItems ? /* @__PURE__ */ React7.createElement(import_rpg_ui_toolkit6.Pill.Link, { link: item2 }, item2) : item2, active && /* @__PURE__ */ React7.createElement("sup", { className: "rpg-prof-in-use", "aria-label": "In use" }, "\u2022"));
    })))));
  };
  var proficiencies_default = proficiencies;

  // vault:tales-of-the-valiant/config/blocks/character/features.tsx
  var React8 = __toESM(__require("react"));
  var import_rpg_ui_toolkit7 = __require("rpg-ui-toolkit");
  function usePersistentOpen(key, defaultOpen) {
    const storageKey = `rpg-ui:open:${key}`;
    const [open, setOpen] = React8.useState(() => {
      try {
        if (typeof localStorage === "undefined") return defaultOpen;
        const stored = localStorage.getItem(storageKey);
        return stored === null ? defaultOpen : stored === "1";
      } catch (e) {
        return defaultOpen;
      }
    });
    const update = React8.useCallback(
      (next) => {
        setOpen(next);
        try {
          localStorage.setItem(storageKey, next ? "1" : "0");
        } catch (e) {
        }
      },
      [storageKey]
    );
    return [open, update];
  }
  function useNoteKey2() {
    return React8.useMemo(() => {
      var _a, _b, _c, _d;
      const app = globalThis.app;
      return (_d = (_c = (_b = (_a = app == null ? void 0 : app.workspace) == null ? void 0 : _a.getActiveFile) == null ? void 0 : _b.call(_a)) == null ? void 0 : _c.path) != null ? _d : "default";
    }, []);
  }
  function pillStem(p) {
    if (!(p == null ? void 0 : p.file)) return void 0;
    let raw = p.file;
    while (Array.isArray(raw)) raw = raw[0];
    if (typeof raw !== "string") return void 0;
    const stem = raw.replace(/^\[\[/, "").replace(/\]\]$/, "").replace(/\.md$/, "").trim();
    return stem || void 0;
  }
  function linkStem(raw) {
    let v = raw;
    while (Array.isArray(v)) v = v[0];
    if (typeof v !== "string") return void 0;
    const stem = v.replace(/^\[\[/, "").replace(/\]\]$/, "").replace(/\.md$/, "").split("|")[0].trim();
    return stem || void 0;
  }
  function resolveMaxCount(max, characterLevel, vars) {
    if (max == null) return null;
    if (typeof max === "number") return max;
    if (typeof max === "string") {
      const hit = vars == null ? void 0 : vars[max];
      if (typeof hit === "number") return hit;
      if (typeof hit === "string") {
        const n2 = Number(hit);
        return Number.isFinite(n2) ? n2 : null;
      }
      const n = Number(max);
      return Number.isFinite(n) ? n : null;
    }
    const entries = Object.entries(max).map(([lv, n]) => [Number(lv), n]).sort((a, b) => a[0] - b[0]);
    if (entries.length === 0) return null;
    if (characterLevel == null) return entries[entries.length - 1][1];
    let chosen = null;
    for (const [lv, n] of entries) {
      if (lv <= characterLevel) chosen = n;
      else break;
    }
    return chosen != null ? chosen : entries[0][1];
  }
  function UsageDots({
    count,
    spent,
    onSpentChange
  }) {
    if (count <= 0) return null;
    const clamped = Math.max(0, Math.min(spent, count));
    return /* @__PURE__ */ React8.createElement("span", { className: "rpg-feature-bucket-dots", role: "group", "aria-label": `${count - clamped} of ${count} uses remaining` }, Array.from({ length: count }, (_, i) => {
      const filled = i < clamped;
      return /* @__PURE__ */ React8.createElement(
        "button",
        {
          key: i,
          type: "button",
          className: "rpg-feature-bucket-dot",
          "aria-pressed": filled,
          "aria-label": `Use ${i + 1}${filled ? " (spent)" : ""}`,
          disabled: !onSpentChange,
          onClick: () => onSpentChange == null ? void 0 : onSpentChange(filled ? i : i + 1)
        }
      );
    }));
  }
  var BUCKETS = [
    { id: "action", label: "Action" },
    { id: "bonus", label: "Bonus Action" },
    { id: "reaction", label: "Reaction" },
    { id: "active", label: "Active" },
    { id: "passive", label: "Passive" },
    { id: "resource", label: "Resource" }
  ];
  var BUCKET_IDS = new Set(BUCKETS.map((b) => b.id));
  function computeAspectKey(bucket, aspect, indexInBucket) {
    const name = aspect == null ? void 0 : aspect.name;
    return `${bucket}:${name != null ? name : indexInBucket}`;
  }
  function isAspectTrivialised(set, bucket, aspectKey) {
    return set.has(aspectKey) || set.has(bucket);
  }
  function bucketize(sources, trivialized) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j;
    const byBucket = {};
    const grantedTrivials = {};
    const featureLevel = (l) => {
      if (l == null) return -1;
      if (Array.isArray(l)) {
        const nums = l.filter((n) => typeof n === "number");
        return nums.length > 0 ? Math.min(...nums) : -1;
      }
      return l;
    };
    for (const src of sources) {
      const orderedFeatures = [...src.features].sort((a, b) => featureLevel(a.level) - featureLevel(b.level));
      const sourceTrivials = (_a = trivialized == null ? void 0 : trivialized[src.source]) != null ? _a : {};
      for (const feature of orderedFeatures) {
        let placed = false;
        const trivialSet = new Set((_b = sourceTrivials[feature.name]) != null ? _b : []);
        for (const { id } of BUCKETS) {
          const raw = feature[id];
          if (raw == null) continue;
          const items = Array.isArray(raw) ? raw : [raw];
          let aspectIdx = 0;
          for (const item2 of items) {
            const links = extractWikilinks(item2);
            if (links.length > 0) {
              for (const link of links) {
                const name = link.replace(/^\[\[/, "").replace(/\]\]$/, "").split("|")[0];
                if (!name) continue;
                ((_c = grantedTrivials[id]) != null ? _c : grantedTrivials[id] = []).push({ $name: name, type: id });
              }
              continue;
            }
            if (item2 && typeof item2 === "object" && !Array.isArray(item2)) {
              const aspect = item2;
              const aspectKey = computeAspectKey(id, aspect, aspectIdx);
              if (isAspectTrivialised(trivialSet, id, aspectKey)) {
                ((_d = grantedTrivials[id]) != null ? _d : grantedTrivials[id] = []).push({
                  $name: (_e = aspect.name) != null ? _e : feature.name,
                  type: id,
                  userTrivialized: true,
                  source: src.source,
                  aspectKey
                });
              } else {
                ((_f = byBucket[id]) != null ? _f : byBucket[id] = []).push({
                  feature,
                  aspect,
                  bucket: id,
                  source: src.source,
                  level: src.level,
                  aspectKey
                });
              }
              placed = true;
              aspectIdx++;
            }
          }
        }
        if (!placed && feature.type && BUCKET_IDS.has(feature.type)) {
          const bucket = feature.type;
          const aspectKey = computeAspectKey(bucket, null, 0);
          if (isAspectTrivialised(trivialSet, bucket, aspectKey)) {
            ((_g = grantedTrivials[bucket]) != null ? _g : grantedTrivials[bucket] = []).push({
              $name: feature.name,
              type: bucket,
              userTrivialized: true,
              source: src.source,
              aspectKey
            });
          } else {
            ((_h = byBucket[bucket]) != null ? _h : byBucket[bucket] = []).push({
              feature,
              aspect: {},
              bucket,
              source: src.source,
              level: src.level,
              aspectKey
            });
          }
          placed = true;
        }
        if (!placed && feature.max != null) {
          const aspectKey = computeAspectKey("resource", null, 0);
          if (isAspectTrivialised(trivialSet, "resource", aspectKey)) {
            ((_i = grantedTrivials.resource) != null ? _i : grantedTrivials.resource = []).push({
              $name: feature.name,
              type: "resource",
              userTrivialized: true,
              source: src.source,
              aspectKey
            });
          } else {
            ((_j = byBucket.resource) != null ? _j : byBucket.resource = []).push({
              feature,
              aspect: { max: feature.max, recovery: feature.recovery },
              bucket: "resource",
              source: src.source,
              level: src.level,
              aspectKey
            });
          }
        }
      }
    }
    return { byBucket, grantedTrivials };
  }
  function extractWikilinks(val) {
    if (val == null) return [];
    if (typeof val === "string") return [val];
    if (Array.isArray(val)) {
      if (val.length === 1 && Array.isArray(val[0]) && val[0].length === 1 && typeof val[0][0] === "string") {
        return [`[[${val[0][0]}]]`];
      }
      return val.flatMap(extractWikilinks);
    }
    return [];
  }
  function spellStem(raw) {
    return raw.replace(/^\[\[/, "").replace(/\]\]$/, "").replace(/\.md$/, "").split("|")[0].trim();
  }
  function evalBuyBudget(expr, vars) {
    if (expr == null) return void 0;
    if (typeof expr === "number") return Number.isFinite(expr) ? Math.max(0, Math.floor(expr)) : 0;
    if (typeof expr !== "string") return 0;
    let rewritten = expr.trim();
    if (!rewritten) return 0;
    const keys = Object.keys(vars).sort((a, b) => b.length - a.length);
    for (const k of keys) {
      const v = vars[k];
      if (typeof v !== "number") continue;
      rewritten = rewritten.replace(new RegExp(`\\b${k}\\b`, "g"), String(v));
    }
    if (!/^[-+*/() \d.]+$/.test(rewritten)) return 0;
    try {
      const value = Function(`"use strict"; return (${rewritten})`)();
      return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
    } catch (e) {
      return 0;
    }
  }
  function matchCastingBucket(casting) {
    if (!casting || typeof casting !== "string") return void 0;
    const c = casting.toLowerCase();
    if (/bonus\s*action/.test(c)) return "bonus";
    if (/reaction/.test(c)) return "reaction";
    if (/\baction\b/.test(c)) return "action";
    return void 0;
  }
  function collectSpellTrivials(casters, castersState, spellLibrary) {
    var _a, _b, _c, _d, _e;
    const out = {};
    if (!casters || casters.length === 0) return out;
    const seen = /* @__PURE__ */ new Set();
    const push = (raw) => {
      var _a2;
      const stem = spellStem(raw);
      if (!stem) return;
      const doc = spellLibrary[stem];
      const bucket = matchCastingBucket(doc == null ? void 0 : doc.casting);
      if (!bucket) return;
      const key = `${bucket}:${stem}`;
      if (seen.has(key)) return;
      seen.add(key);
      ((_a2 = out[bucket]) != null ? _a2 : out[bucket] = []).push({ $name: stem, type: bucket });
    };
    for (const caster of casters) {
      const state = (_a = castersState[caster.source]) != null ? _a : {};
      for (const [lvlStr, list] of Object.entries((_b = caster.granted.cantrips) != null ? _b : {})) {
        if (Number(lvlStr) > caster.level) continue;
        for (const s of list != null ? list : []) push(s);
      }
      for (const [lvlStr, list] of Object.entries((_c = caster.granted.prepared) != null ? _c : {})) {
        if (Number(lvlStr) > caster.level) continue;
        for (const s of list != null ? list : []) push(s);
      }
      for (const [lvlStr, list] of Object.entries((_d = caster.granted.rituals) != null ? _d : {})) {
        if (Number(lvlStr) > caster.level) continue;
        for (const s of list != null ? list : []) push(s);
      }
      for (const s of (_e = state.cantrips) != null ? _e : []) push(s);
      for (const m of [state.prepared, state.known, state.rituals]) {
        if (!m) continue;
        for (const list of Object.values(m)) {
          for (const s of list != null ? list : []) push(s);
        }
      }
    }
    return out;
  }
  function EntryRow({
    entry,
    characterLevel,
    context,
    spent,
    onSpentChange,
    onCollapse
  }) {
    var _a, _b, _c;
    const { feature, aspect, source, aspectKey } = entry;
    const displayName = prettifyLevelSuffix((_a = aspect.name) != null ? _a : feature.name);
    const isResource = entry.bucket === "resource";
    const cardText = isResource ? aspect.text : (_b = aspect.text) != null ? _b : feature.text;
    const maxCount = resolveMaxCount(aspect.max, characterLevel, context == null ? void 0 : context.vars);
    return /* @__PURE__ */ React8.createElement("li", { className: "rpg-feature-bucket-entry" }, /* @__PURE__ */ React8.createElement("div", { className: "rpg-feature-bucket-entry-title" }, /* @__PURE__ */ React8.createElement("strong", { className: "rpg-feature-bucket-entry-name" }, displayName), maxCount != null && /* @__PURE__ */ React8.createElement(UsageDots, { count: maxCount, spent, onSpentChange }), aspect.recharge && /* @__PURE__ */ React8.createElement("small", { "aria-details": "Recharge" }, "\u21BB ", aspect.recharge), (isResource || aspect.resource != null) && aspect.recovery && /* @__PURE__ */ React8.createElement("small", { "aria-details": "Resource Recovery" }, "recharge on ", aspect.recovery), !isResource && aspect.resource && /* @__PURE__ */ React8.createElement("small", { "aria-details": "Uses Resource" }, "uses ", aspect.resource), onCollapse && /* @__PURE__ */ React8.createElement(
      "button",
      {
        type: "button",
        className: "rpg-feature-bucket-entry-collapse",
        "aria-label": `Minimise ${(_c = aspect.name) != null ? _c : feature.name} to a link`,
        title: "Minimise this aspect to a link",
        onClick: () => onCollapse(source, feature.name, aspectKey)
      },
      "\u25BE"
    )), /* @__PURE__ */ React8.createElement("div", { className: "rpg-feature-bucket-entry-meta" }, /* @__PURE__ */ React8.createElement(
      "a",
      {
        className: "internal-link rpg-feature-bucket-source",
        href: source,
        "data-href": source,
        "aria-details": "Feature Source"
      },
      source
    )), /* @__PURE__ */ React8.createElement("figure", { className: "rpg-feature-bucket-entry-image", "aria-hidden": "true" }), cardText && /* @__PURE__ */ React8.createElement(import_rpg_ui_toolkit7.Markdown, { source: cardText, context, className: "rpg-feature-bucket-entry-desc" }));
  }
  function Bucket({
    id,
    label,
    entries,
    trivials,
    characterLevel,
    context,
    spentMap,
    onSpentChange,
    onCollapse,
    onRestore
  }) {
    if (entries.length === 0 && trivials.length === 0) return null;
    const total = entries.length + trivials.length;
    const noteKey = useNoteKey2();
    const [open, setOpen] = usePersistentOpen(`${noteKey}:bucket:${id}`, false);
    return /* @__PURE__ */ React8.createElement(
      "details",
      {
        className: `rpg-feature-bucket rpg-feature-bucket-${id}`,
        open,
        onToggle: (e) => setOpen(e.currentTarget.open)
      },
      /* @__PURE__ */ React8.createElement("summary", null, /* @__PURE__ */ React8.createElement("span", { className: "rpg-feature-bucket-label" }, label), /* @__PURE__ */ React8.createElement("span", { className: "rpg-feature-bucket-count" }, total)),
      entries.length > 0 && /* @__PURE__ */ React8.createElement("ul", null, entries.map((entry, i) => {
        var _a;
        const key = `${entry.source}:${entry.feature.name}:${entry.bucket}`;
        return /* @__PURE__ */ React8.createElement(
          EntryRow,
          {
            key: i,
            entry,
            characterLevel,
            context,
            spent: (_a = spentMap[key]) != null ? _a : 0,
            onSpentChange: onSpentChange ? (next) => onSpentChange(key, next) : void 0,
            onCollapse
          }
        );
      })),
      trivials.length > 0 && /* @__PURE__ */ React8.createElement("div", { className: "rpg-feature-bucket-trivials", "aria-label": "Compact entries" }, /* @__PURE__ */ React8.createElement(TrivialsList, { trivials, onRestore }))
    );
  }
  function TrivialsList({
    trivials,
    onRestore
  }) {
    return /* @__PURE__ */ React8.createElement(React8.Fragment, null, trivials.map((t, i) => {
      var _a, _b;
      return /* @__PURE__ */ React8.createElement(React8.Fragment, { key: `${(_a = t.source) != null ? _a : "shared"}:${t.$name}:${(_b = t.aspectKey) != null ? _b : i}` }, i > 0 && /* @__PURE__ */ React8.createElement("span", { className: "rpg-feature-bucket-trivial-sep" }, " \xB7 "), /* @__PURE__ */ React8.createElement("span", { className: "rpg-feature-bucket-trivial" }, /* @__PURE__ */ React8.createElement(import_rpg_ui_toolkit7.Markdown, { source: `[[${t.$name}]]` }), t.userTrivialized && t.source && t.aspectKey && onRestore && /* @__PURE__ */ React8.createElement(
        "button",
        {
          type: "button",
          className: "rpg-feature-bucket-trivial-restore",
          "aria-label": `Restore ${t.$name} to full card`,
          title: "Restore to full card",
          onClick: () => onRestore(t.source, t.$name, t.aspectKey)
        },
        "\u21A9"
      )));
    }));
  }
  function grantsAtLevel(caster, level2) {
    if (!caster) return [];
    const buckets = [caster.granted.cantrips, caster.granted.prepared, caster.granted.rituals];
    const out = [];
    for (const m of buckets) {
      const raws = (m != null ? m : {})[level2];
      if (!raws) continue;
      for (const s of raws) out.push(s);
    }
    return out;
  }
  function TraitValue({ value }) {
    const prefixed = value.startsWith("+") || value.startsWith("\u2212") ? value : `+${value}`;
    const parts = prefixed.split(/(\[\[[^\]]+\]\])/);
    return /* @__PURE__ */ React8.createElement(React8.Fragment, null, parts.map((part, i) => {
      var _a;
      const match = part.match(/^\[\[([^|\]]+)(?:\|([^\]]+))?\]\]$/);
      if (match) {
        const href = match[1];
        const label = (_a = match[2]) != null ? _a : match[1];
        return /* @__PURE__ */ React8.createElement("a", { key: i, className: "internal-link", href, "data-href": href }, label);
      }
      return /* @__PURE__ */ React8.createElement(React8.Fragment, { key: i }, part);
    }));
  }
  function TraitsInline({ traits }) {
    const entries = Object.entries(traits);
    if (entries.length === 0) return null;
    return /* @__PURE__ */ React8.createElement(React8.Fragment, null, entries.map(([name, values], i) => {
      const visible = values.filter((v) => v !== "");
      const bareFlag = visible.length === 0;
      return /* @__PURE__ */ React8.createElement(React8.Fragment, { key: name }, i > 0 && ", ", /* @__PURE__ */ React8.createElement("strong", null, name), !bareFlag && /* @__PURE__ */ React8.createElement(React8.Fragment, null, " (", visible.map((v, j) => /* @__PURE__ */ React8.createElement(React8.Fragment, { key: j }, j > 0 && ", ", /* @__PURE__ */ React8.createElement(TraitValue, { value: v }))), ")"));
    }));
  }
  function mergeTraitMaps(...maps) {
    var _a;
    const out = {};
    for (const m of maps) {
      if (!m) continue;
      for (const [k, v] of Object.entries(m)) {
        out[k] = [...(_a = out[k]) != null ? _a : [], ...v];
      }
    }
    return out;
  }
  function grantToWikilink(raw) {
    const stem = spellStem(raw);
    return stem ? `[[${stem}]]` : raw;
  }
  function TraitsSourceLine({
    src,
    sub,
    casters
  }) {
    var _a, _b, _c, _d, _e, _f;
    const isClass = src.kind === "class" || src.kind === "subclass";
    const hasBase = Object.keys(src.baseTraits).length > 0;
    const hasLeveled = Object.keys(src.leveledTraits).length > 0;
    const subHasBase = !!sub && Object.keys(sub.baseTraits).length > 0;
    const subHasLeveled = !!sub && Object.keys(sub.leveledTraits).length > 0;
    const caster = casters == null ? void 0 : casters.find((c) => c.source === src.source);
    const hasAnyGrants = !!caster && Object.values({
      ...caster.granted.cantrips,
      ...caster.granted.prepared,
      ...caster.granted.rituals
    }).some((list) => {
      var _a2;
      return ((_a2 = list == null ? void 0 : list.length) != null ? _a2 : 0) > 0;
    });
    if (!hasBase && !hasLeveled && !subHasBase && !subHasLeveled && !hasAnyGrants) return null;
    if (isClass) {
      const classByLevel = (_a = src.traitsByLevel) != null ? _a : {};
      const subByLevel = (_b = sub == null ? void 0 : sub.traitsByLevel) != null ? _b : {};
      const levelSet = /* @__PURE__ */ new Set();
      for (const k of Object.keys(classByLevel)) {
        const n = Number(k);
        if (Number.isFinite(n) && Object.keys((_c = classByLevel[n]) != null ? _c : {}).length > 0) levelSet.add(n);
      }
      for (const k of Object.keys(subByLevel)) {
        const n = Number(k);
        if (Number.isFinite(n) && Object.keys((_d = subByLevel[n]) != null ? _d : {}).length > 0) levelSet.add(n);
      }
      if (caster) {
        for (const m of [caster.granted.cantrips, caster.granted.prepared, caster.granted.rituals]) {
          for (const k of Object.keys(m != null ? m : {})) {
            const n = Number(k);
            if (Number.isFinite(n) && ((_f = (_e = m[n]) == null ? void 0 : _e.length) != null ? _f : 0) > 0) levelSet.add(n);
          }
        }
      }
      const levels = [...levelSet].sort((a, b) => a - b);
      const subUnlockLevel = (() => {
        var _a2;
        if (!sub) return void 0;
        const l = Object.keys(subByLevel).map(Number).filter((n) => {
          var _a3;
          return Number.isFinite(n) && Object.keys((_a3 = subByLevel[n]) != null ? _a3 : {}).length > 0;
        }).sort((a, b) => a - b);
        return (_a2 = l[0]) != null ? _a2 : sub.level;
      })();
      const mergedBase = mergeTraitMaps(src.baseTraits, sub == null ? void 0 : sub.baseTraits);
      const hasMergedBase = Object.keys(mergedBase).length > 0;
      return /* @__PURE__ */ React8.createElement("div", { className: "rpg-feature-traits-source" }, /* @__PURE__ */ React8.createElement("p", null, /* @__PURE__ */ React8.createElement("a", { className: "internal-link rpg-feature-traits-source-link", href: src.source, "data-href": src.source }, src.source), src.level != null && /* @__PURE__ */ React8.createElement("span", { className: "rpg-feature-traits-source-level" }, " (Lv. ", src.level, ")"), hasMergedBase && /* @__PURE__ */ React8.createElement(React8.Fragment, null, " \u2014 ", /* @__PURE__ */ React8.createElement(TraitsInline, { traits: mergedBase }))), levels.length > 0 && /* @__PURE__ */ React8.createElement("ul", { className: "rpg-feature-traits-leveled" }, levels.map((lvl) => {
        var _a2, _b2;
        const row = mergeTraitMaps(classByLevel[lvl], subByLevel[lvl]);
        if (sub && lvl === subUnlockLevel) {
          row["Subclass"] = [...(_a2 = row["Subclass"]) != null ? _a2 : [], `[[${sub.source}]]`];
        }
        const grants = grantsAtLevel(caster, lvl).map(grantToWikilink);
        if (grants.length > 0) {
          row["Granted"] = [...(_b2 = row["Granted"]) != null ? _b2 : [], ...grants];
        }
        if (Object.keys(row).length === 0) return null;
        return /* @__PURE__ */ React8.createElement("li", { key: lvl }, /* @__PURE__ */ React8.createElement("strong", { className: "rpg-feature-traits-level-tag" }, "Lv. ", lvl), " ", /* @__PURE__ */ React8.createElement(TraitsInline, { traits: row }));
      })));
    }
    return /* @__PURE__ */ React8.createElement("div", { className: "rpg-feature-traits-source" }, /* @__PURE__ */ React8.createElement("p", null, /* @__PURE__ */ React8.createElement("a", { className: "internal-link rpg-feature-traits-source-link", href: src.source, "data-href": src.source }, src.source), hasBase && /* @__PURE__ */ React8.createElement(React8.Fragment, null, " \u2014 ", /* @__PURE__ */ React8.createElement(TraitsInline, { traits: src.baseTraits }))), hasLeveled && !hasBase && /* @__PURE__ */ React8.createElement("p", null, /* @__PURE__ */ React8.createElement(TraitsInline, { traits: src.leveledTraits })));
  }
  function TraitsBucket({ sources, casters }) {
    const hasCasterGrants = (sourceName) => {
      var _a;
      const caster = casters == null ? void 0 : casters.find((c) => c.source === sourceName);
      if (!caster) return false;
      for (const m of [caster.granted.cantrips, caster.granted.prepared, caster.granted.rituals]) {
        for (const list of Object.values(m != null ? m : {})) {
          if (((_a = list == null ? void 0 : list.length) != null ? _a : 0) > 0) return true;
        }
      }
      return false;
    };
    const groups = [];
    for (const s of sources) {
      const hasBase = Object.keys(s.baseTraits).length > 0;
      const hasLeveled = Object.keys(s.leveledTraits).length > 0;
      const hasSpells = hasCasterGrants(s.source);
      if (!hasBase && !hasLeveled && !hasSpells) continue;
      if (s.kind === "subclass") {
        const last = groups[groups.length - 1];
        if (last && last.src.kind === "class" && !last.sub) {
          last.sub = s;
          continue;
        }
      }
      groups.push({ src: s });
    }
    if (groups.length === 0) return null;
    const noteKey = useNoteKey2();
    const [open, setOpen] = usePersistentOpen(`${noteKey}:bucket:traits`, false);
    return /* @__PURE__ */ React8.createElement(
      "details",
      {
        className: "rpg-feature-bucket rpg-feature-bucket-traits",
        open,
        onToggle: (e) => setOpen(e.currentTarget.open)
      },
      /* @__PURE__ */ React8.createElement("summary", null, /* @__PURE__ */ React8.createElement("span", { className: "rpg-feature-bucket-label" }, "Traits"), /* @__PURE__ */ React8.createElement("span", { className: "rpg-feature-bucket-count" }, groups.length)),
      /* @__PURE__ */ React8.createElement("div", { className: "rpg-feature-traits-summary" }, groups.map(({ src, sub }) => /* @__PURE__ */ React8.createElement(TraitsSourceLine, { key: `${src.source}:${src.kind}`, src, sub, casters })))
    );
  }
  function aggregateAsiPicks(picks, quantity) {
    var _a;
    const totals = /* @__PURE__ */ new Map();
    for (const p of picks) totals.set(p, ((_a = totals.get(p)) != null ? _a : 0) + quantity);
    return [...totals.entries()].map(([attr, total]) => `+${total} ${attr}`);
  }
  function prettifyLevelSuffix(name) {
    const m = name.match(/^(.*)@(\d+)$/);
    return m ? `${m[1]} (Lv. ${m[2]})` : name;
  }
  function groupPendingsBySource(pendings, sources) {
    var _a;
    const order = /* @__PURE__ */ new Map();
    sources.forEach((s, i) => order.set(s.source, i));
    const groups = /* @__PURE__ */ new Map();
    for (const p of pendings) {
      const bucket = (_a = groups.get(p.source)) != null ? _a : [];
      bucket.push(p);
      groups.set(p.source, bucket);
    }
    return [...groups.entries()].sort(([a], [b]) => {
      var _a2, _b;
      return ((_a2 = order.get(a)) != null ? _a2 : Infinity) - ((_b = order.get(b)) != null ? _b : Infinity);
    }).map(([source, list]) => ({ source, pendings: list }));
  }
  function gatherDecisions(sources, choices) {
    var _a, _b;
    if (!choices) return [];
    const groups = [];
    for (const src of sources) {
      const sourcePicks = choices[src.source];
      if (!sourcePicks) continue;
      const decisions = [];
      const seenFeatureNames = /* @__PURE__ */ new Set();
      for (const feature of src.features) {
        seenFeatureNames.add(feature.name);
        const raw = sourcePicks[feature.name];
        if (raw == null) continue;
        const values = Array.isArray(raw) ? raw : [raw];
        if (values.length === 0) continue;
        const rawChoose = feature.choose;
        const hasBuy = feature.buy != null;
        const singleChoose = Array.isArray(rawChoose) ? rawChoose.length === 1 ? rawChoose[0] : void 0 : rawChoose;
        const isAsi = !hasBuy && (singleChoose == null ? void 0 : singleChoose.type) === "asi";
        const category = prettifyLevelSuffix(
          hasBuy ? feature.name : (_a = singleChoose == null ? void 0 : singleChoose.category) != null ? _a : isAsi ? "Ability Scores" : feature.name
        );
        const decisionValues = isAsi ? aggregateAsiPicks(values, (_b = singleChoose == null ? void 0 : singleChoose.quantity) != null ? _b : 1) : values;
        decisions.push({
          category,
          values: decisionValues,
          source: src.source,
          resetKey: feature.name
        });
      }
      for (const [key, raw] of Object.entries(sourcePicks)) {
        if (seenFeatureNames.has(key)) continue;
        const values = Array.isArray(raw) ? raw : [raw];
        if (values.length === 0) continue;
        const colonIdx = key.indexOf(":");
        const stripped = colonIdx >= 0 ? key.slice(colonIdx + 1) : key;
        const label = prettifyLevelSuffix(stripped);
        decisions.push({ category: label, values, source: src.source, resetKey: key });
      }
      if (decisions.length > 0) {
        groups.push({ source: src.source, decisions });
      }
    }
    return groups;
  }
  function DecisionsLog({
    sources,
    choices,
    onReset
  }) {
    const groups = React8.useMemo(() => gatherDecisions(sources, choices), [sources, choices]);
    if (groups.length === 0) return null;
    const total = groups.reduce((n, g) => n + g.decisions.length, 0);
    const noteKey = useNoteKey2();
    const [open, setOpen] = usePersistentOpen(`${noteKey}:decisions`, false);
    return /* @__PURE__ */ React8.createElement(
      "details",
      {
        className: "rpg-feature-decisions",
        open,
        onToggle: (e) => setOpen(e.currentTarget.open)
      },
      /* @__PURE__ */ React8.createElement("summary", null, /* @__PURE__ */ React8.createElement("span", { className: "rpg-feature-decisions-label" }, "Decisions made"), /* @__PURE__ */ React8.createElement("span", { className: "rpg-feature-decisions-count" }, total)),
      /* @__PURE__ */ React8.createElement("div", { className: "rpg-feature-decisions-groups" }, groups.map((g) => /* @__PURE__ */ React8.createElement("p", { key: g.source, className: "rpg-feature-decisions-line" }, /* @__PURE__ */ React8.createElement("a", { className: "internal-link rpg-feature-decisions-source-link", href: g.source, "data-href": g.source }, g.source), " \u2014 ", g.decisions.map((d, j) => /* @__PURE__ */ React8.createElement(React8.Fragment, { key: j }, j > 0 && ", ", /* @__PURE__ */ React8.createElement("span", { className: "rpg-feature-decisions-entry" }, /* @__PURE__ */ React8.createElement("strong", null, d.category), " (", d.values.map((v, k) => /* @__PURE__ */ React8.createElement(React8.Fragment, { key: k }, k > 0 && ", ", /* @__PURE__ */ React8.createElement(TraitValue, { value: v }))), ")", onReset && /* @__PURE__ */ React8.createElement(
        "button",
        {
          type: "button",
          className: "rpg-feature-decisions-undo",
          "aria-label": `Undo ${d.category}`,
          title: "Undo this decision",
          onClick: () => onReset(d.source, d.resetKey)
        },
        "\u21BA"
      )))))))
    );
  }
  function FeaturesAccordion({
    view,
    trivials,
    characterLevel,
    context,
    spentMap,
    onSpentChange,
    trivialized,
    onCollapse,
    onRestore
  }) {
    const { byBucket, grantedTrivials } = React8.useMemo(
      () => bucketize(view.sources, trivialized),
      [view.sources, trivialized]
    );
    const mergedTrivials = React8.useMemo(() => {
      var _a;
      const out = {};
      for (const [bucket, entries] of Object.entries(trivials)) {
        out[bucket] = [...entries];
      }
      for (const [bucket, entries] of Object.entries(grantedTrivials)) {
        const list = (_a = out[bucket]) != null ? _a : out[bucket] = [];
        const seen = new Set(list.map((e) => e.$name));
        for (const e of entries) {
          if (seen.has(e.$name)) continue;
          seen.add(e.$name);
          list.push(e);
        }
      }
      return out;
    }, [trivials, grantedTrivials]);
    return /* @__PURE__ */ React8.createElement("section", { className: "rpg-feature-accordion", "aria-label": "Features by Type" }, BUCKETS.map(({ id, label }) => {
      var _a, _b;
      return /* @__PURE__ */ React8.createElement(
        Bucket,
        {
          key: id,
          id,
          label,
          entries: (_a = byBucket[id]) != null ? _a : [],
          trivials: (_b = mergedTrivials[id]) != null ? _b : [],
          characterLevel,
          context,
          spentMap,
          onSpentChange,
          onCollapse,
          onRestore
        }
      );
    }), /* @__PURE__ */ React8.createElement(TraitsBucket, { sources: view.sources, casters: view.casters }));
  }
  var features = ({ self, blocks, lookup, frontmatter }) => {
    var _a, _b, _c, _d, _e, _f;
    const lib = lookup.$compendium;
    const header2 = (_a = blocks.header) != null ? _a : {};
    const noteKey = useNoteKey2();
    const [pendingOpen, setPendingOpen] = usePersistentOpen(`${noteKey}:pending`, true);
    const pendingRef = React8.useRef(null);
    const scrollFlagKey = `rpg-ui:scroll-to-choices:${noteKey}`;
    React8.useEffect(() => {
      try {
        if (typeof sessionStorage === "undefined") return;
        if (sessionStorage.getItem(scrollFlagKey) !== "1") return;
        sessionStorage.removeItem(scrollFlagKey);
      } catch (e) {
        return;
      }
      const id = window.setTimeout(() => {
        var _a2;
        (_a2 = pendingRef.current) == null ? void 0 : _a2.scrollIntoView({ block: "start", behavior: "auto" });
      }, 50);
      return () => window.clearTimeout(id);
    }, [scrollFlagKey]);
    const markScrollPending = React8.useCallback(() => {
      try {
        sessionStorage == null ? void 0 : sessionStorage.setItem(scrollFlagKey, "1");
      } catch (e) {
      }
    }, [scrollFlagKey]);
    const decl = {
      classes: ((_b = header2.classes) != null ? _b : []).map((c) => {
        var _a2, _b2;
        return {
          name: (_a2 = linkStem(c.name)) != null ? _a2 : "",
          level: c.level,
          // `sub:` is the terse alias for `subclass:` (see header block).
          // Either yields a stem the resolver can look up.
          subclass: (_b2 = linkStem(c.sub)) != null ? _b2 : linkStem(c.subclass)
        };
      }),
      lineage: pillStem(header2.lineage),
      heritage: pillStem(header2.heritage),
      background: pillStem(header2.background),
      choices: self.choices,
      additional: self.additional
    };
    const inventoryRaw = blocks.inventory;
    const view = lookup.$features ? lookup.$features(header2, self.choices, self.additional, inventoryRaw) : (0, import_rpg_ui_toolkit7.resolveFeatures)(decl, lib);
    const primaryClass = ((_c = header2.classes) != null ? _c : [])[0];
    const characterLevel = primaryClass == null ? void 0 : primaryClass.level;
    const context = React8.useMemo(() => {
      var _a2;
      const fm = frontmatter != null ? frontmatter : {};
      const num = (key, fallback) => {
        const v = fm[key];
        const n = typeof v === "number" ? v : Number(v);
        return Number.isFinite(n) ? n : fallback;
      };
      const mod = (score) => Math.floor((score - 10) / 2);
      const str = num("strength", 10);
      const dex = num("dexterity", 10);
      const con = num("constitution", 10);
      const intel = num("intelligence", 10);
      const wis = num("wisdom", 10);
      const cha = num("charisma", 10);
      const lv = characterLevel != null ? characterLevel : num("level", 1);
      return {
        tables: view.tables,
        vars: {
          LV: lv,
          CLASS_LEVEL: lv,
          CLASS: (_a2 = primaryClass == null ? void 0 : primaryClass.name) != null ? _a2 : "",
          PB: num("proficiency_bonus", 2),
          STR: str,
          DEX: dex,
          CON: con,
          INT: intel,
          WIS: wis,
          CHA: cha,
          STR_MOD: mod(str),
          DEX_MOD: mod(dex),
          CON_MOD: mod(con),
          INT_MOD: mod(intel),
          WIS_MOD: mod(wis),
          CHA_MOD: mod(cha)
        }
      };
    }, [view.tables, characterLevel, primaryClass, frontmatter]);
    const setChoices = self.setChoices;
    const setSpent = self.setSpent;
    const setTrivialized = self.setTrivialized;
    const spentMap = (_d = self.spent) != null ? _d : {};
    const handleSpentChange = setSpent ? (key, next) => {
      setSpent((prev) => {
        const out = { ...prev != null ? prev : {} };
        if (next <= 0) delete out[key];
        else out[key] = next;
        return out;
      });
    } : void 0;
    const handleCollapse = setTrivialized ? (source, featureName, aspectKey) => {
      markScrollPending();
      setTrivialized((prev) => {
        var _a2;
        const next = { ...prev != null ? prev : {} };
        const bySource = { ...(_a2 = next[source]) != null ? _a2 : {} };
        const keys = bySource[featureName] ? [...bySource[featureName]] : [];
        if (!keys.includes(aspectKey)) keys.push(aspectKey);
        bySource[featureName] = keys;
        next[source] = bySource;
        return next;
      });
    } : void 0;
    const handleRestore = setTrivialized ? (source, featureName, aspectKey) => {
      markScrollPending();
      setTrivialized((prev) => {
        var _a2, _b2;
        const next = { ...prev != null ? prev : {} };
        const bySource = { ...(_a2 = next[source]) != null ? _a2 : {} };
        const keys = ((_b2 = bySource[featureName]) != null ? _b2 : []).filter((k) => k !== aspectKey);
        if (keys.length === 0) delete bySource[featureName];
        else bySource[featureName] = keys;
        if (Object.keys(bySource).length === 0) delete next[source];
        else next[source] = bySource;
        return next;
      });
    } : void 0;
    const makeToggle = (source, featureName) => setChoices ? (option) => {
      markScrollPending();
      setChoices((prev) => {
        var _a2;
        const next = { ...prev != null ? prev : {} };
        const sourcePicks = { ...(_a2 = next[source]) != null ? _a2 : {} };
        const current = sourcePicks[featureName];
        const currentArr = Array.isArray(current) ? [...current] : current ? [current] : [];
        const idx = currentArr.indexOf(option);
        if (idx >= 0) currentArr.splice(idx, 1);
        else currentArr.push(option);
        if (currentArr.length === 0) delete sourcePicks[featureName];
        else sourcePicks[featureName] = currentArr;
        next[source] = sourcePicks;
        return next;
      });
    } : void 0;
    const makePicker = (source, featureName) => setChoices ? (option, delta) => {
      markScrollPending();
      setChoices((prev) => {
        var _a2;
        const next = { ...prev != null ? prev : {} };
        const sourcePicks = { ...(_a2 = next[source]) != null ? _a2 : {} };
        const current = sourcePicks[featureName];
        const currentArr = Array.isArray(current) ? [...current] : current ? [current] : [];
        if (delta > 0) {
          currentArr.push(option);
        } else {
          const idx = currentArr.lastIndexOf(option);
          if (idx >= 0) currentArr.splice(idx, 1);
        }
        if (currentArr.length === 0) delete sourcePicks[featureName];
        else sourcePicks[featureName] = currentArr;
        next[source] = sourcePicks;
        return next;
      });
    } : void 0;
    const makeReset = setChoices ? (source, key) => {
      markScrollPending();
      setChoices((prev) => {
        var _a2;
        const next = { ...prev != null ? prev : {} };
        const sourcePicks = { ...(_a2 = next[source]) != null ? _a2 : {} };
        if (!(key in sourcePicks)) return prev != null ? prev : {};
        delete sourcePicks[key];
        if (Object.keys(sourcePicks).length === 0) delete next[source];
        else next[source] = sourcePicks;
        return next;
      });
    } : void 0;
    const spellsBlock = blocks.spells;
    const spellLibrary = (_e = lookup.$spells) != null ? _e : {};
    const trivialsByBucket = React8.useMemo(() => {
      var _a2, _b2, _c2, _d2, _e2, _f2, _g, _h, _i, _j;
      const out = {};
      for (const entry of (_a2 = lookup.$defaultFeatures) != null ? _a2 : []) {
        const bucket = ((_b2 = entry.type) != null ? _b2 : "").toLowerCase();
        if (!bucket) continue;
        ((_c2 = out[bucket]) != null ? _c2 : out[bucket] = []).push(entry);
      }
      const spellTrivials = collectSpellTrivials(view.casters, (_d2 = spellsBlock == null ? void 0 : spellsBlock.casters) != null ? _d2 : {}, spellLibrary);
      for (const [bucket, entries] of Object.entries(spellTrivials)) {
        const list = (_e2 = out[bucket]) != null ? _e2 : out[bucket] = [];
        const seen = new Set(list.map((e) => e.$name));
        for (const e of entries) {
          if (seen.has(e.$name)) continue;
          seen.add(e.$name);
          list.push(e);
        }
      }
      const inv = blocks == null ? void 0 : blocks.inventory;
      const rawItems = Array.isArray(inv == null ? void 0 : inv.items) ? inv.items : [];
      const equippedTargets = /* @__PURE__ */ new Set();
      const collectEquipped = (raw) => {
        var _a3;
        if (typeof raw === "string") return;
        if (!raw || typeof raw !== "object") return;
        const o = raw;
        if (typeof o.name === "string" && (o.equipped || typeof o.slot === "string")) {
          const stem = (_a3 = o.name.replace(/^\[\[|\]\]$/g, "").split("|")[0].split("/").pop()) == null ? void 0 : _a3.trim();
          if (stem) equippedTargets.add(stem);
        }
        if (Array.isArray(o.contents)) for (const c of o.contents) collectEquipped(c);
      };
      for (const it of rawItems) collectEquipped(it);
      const itemsLib = (_f2 = lookup.$items) != null ? _f2 : {};
      const actionList = (_g = out.action) != null ? _g : out.action = [];
      const seenAction = new Set(actionList.map((e) => e.$name));
      for (const target of equippedTargets) {
        const item2 = itemsLib[target];
        const opts = (_i = (_h = item2 == null ? void 0 : item2.weapon) == null ? void 0 : _h.options) != null ? _i : [];
        for (const raw of opts) {
          const stem = (_j = String(raw).replace(/^\[\[|\]\]$/g, "").split("|")[0].split("/").pop()) == null ? void 0 : _j.trim();
          if (!stem || seenAction.has(stem)) continue;
          seenAction.add(stem);
          actionList.push({ $name: stem, type: "action" });
        }
      }
      return out;
    }, [lookup.$defaultFeatures, lookup, view.casters, spellsBlock, spellLibrary, blocks]);
    return /* @__PURE__ */ React8.createElement("section", { "aria-details": "Character Features", className: "rpg-feature-source-groups" }, view.sources.length === 0 ? /* @__PURE__ */ React8.createElement("p", { "aria-details": "No Sources" }, /* @__PURE__ */ React8.createElement("em", null, "No class, lineage, or background declared.")) : /* @__PURE__ */ React8.createElement(
      FeaturesAccordion,
      {
        view,
        trivials: trivialsByBucket,
        characterLevel,
        context,
        spentMap,
        onSpentChange: handleSpentChange,
        trivialized: self.trivialized,
        onCollapse: handleCollapse,
        onRestore: handleRestore
      }
    ), (view.pendingChoices.length > 0 || Object.keys((_f = self.choices) != null ? _f : {}).length > 0) && /* @__PURE__ */ React8.createElement("section", { ref: pendingRef, "aria-label": "Pending Choices", className: "rpg-feature-pending-list" }, (() => {
      const visiblePendings = view.pendingChoices.filter((p) => {
        var _a2;
        const isBuyEmission = p.feature.buy != null && p.feature.choose == null;
        if (!isBuyEmission) return true;
        const budget = (_a2 = evalBuyBudget(p.feature.buy, context.vars)) != null ? _a2 : 0;
        const spent = p.picked.reduce((sum, name) => {
          const opt = p.options.find((o) => {
            var _a3;
            return ((_a3 = o.name) != null ? _a3 : "") === name;
          });
          return sum + (typeof (opt == null ? void 0 : opt.cost) === "number" ? opt.cost : 0);
        }, 0);
        return budget - spent > 0;
      });
      return visiblePendings.length > 0 ? /* @__PURE__ */ React8.createElement(
        "details",
        {
          className: "rpg-feature-pending-details",
          open: pendingOpen,
          onToggle: (e) => setPendingOpen(e.currentTarget.open)
        },
        /* @__PURE__ */ React8.createElement("summary", null, /* @__PURE__ */ React8.createElement("span", { className: "rpg-feature-pending-label" }, "Choices to make"), /* @__PURE__ */ React8.createElement("span", { className: "rpg-feature-pending-count" }, visiblePendings.length)),
        /* @__PURE__ */ React8.createElement("div", { className: "rpg-feature-pending-groups" }, groupPendingsBySource(visiblePendings, view.sources).map(({ source, pendings }) => /* @__PURE__ */ React8.createElement("div", { key: source, className: "rpg-feature-pending-group" }, /* @__PURE__ */ React8.createElement("h3", { className: "rpg-feature-pending-group-label" }, /* @__PURE__ */ React8.createElement("a", { className: "internal-link", href: source, "data-href": source }, source)), pendings.map((p) => /* @__PURE__ */ React8.createElement(
          import_rpg_ui_toolkit7.PendingChoiceRow,
          {
            key: `${p.source}:${p.feature.name}`,
            pending: p,
            onToggle: makeToggle(p.source, p.feature.name),
            onPick: makePicker(p.source, p.feature.name),
            buyBudget: evalBuyBudget(p.feature.buy, context.vars)
          }
        )))))
      ) : null;
    })(), /* @__PURE__ */ React8.createElement(DecisionsLog, { sources: view.sources, choices: self.choices, onReset: makeReset })));
  };
  var features_default = features;

  // vault:tales-of-the-valiant/config/blocks/character/spells.tsx
  var React9 = __toESM(__require("react"));
  var import_rpg_ui_toolkit8 = __require("rpg-ui-toolkit");
  function bareStem(raw) {
    let v = raw;
    while (Array.isArray(v)) v = v[0];
    if (typeof v !== "string") return "";
    return v.replace(/^\[\[/, "").replace(/\]\]$/, "").replace(/\.md$/, "").split("|")[0].trim();
  }
  function joinLabels(value) {
    if (value == null) return "";
    if (Array.isArray(value)) {
      const parts = [];
      for (const v of value) {
        const s = bareStem(v);
        if (s) parts.push(s);
        else if (typeof v === "string" && v.trim()) parts.push(v.trim());
      }
      return parts.join(", ");
    }
    if (typeof value === "string") return value.trim();
    if (typeof value === "number") return String(value);
    return "";
  }
  function hasAnyPicks(casters, castersState) {
    var _a;
    for (const caster of casters) {
      const state = castersState[caster.source];
      if (!state) continue;
      if (((_a = state.cantrips) != null ? _a : []).length > 0) return true;
      const maps = [state.prepared, state.known, state.rituals];
      for (const m of maps) {
        if (!m) continue;
        for (const list of Object.values(m)) {
          if ((list != null ? list : []).length > 0) return true;
        }
      }
    }
    return false;
  }
  function evalPreparedMax(expr, vars) {
    if (!expr || !expr.trim()) return 0;
    let rewritten = expr;
    const keys = Object.keys(vars).sort((a, b) => b.length - a.length);
    for (const k of keys) {
      rewritten = rewritten.replace(new RegExp(`\\b${k}\\b`, "g"), String(vars[k]));
    }
    if (!/^[-+*/() \d.]+$/.test(rewritten)) return 0;
    try {
      const value = Function(`"use strict"; return (${rewritten})`)();
      return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
    } catch (e) {
      return 0;
    }
  }
  function useNoteKey3() {
    return React9.useMemo(() => {
      var _a, _b, _c, _d;
      const app = globalThis.app;
      return (_d = (_c = (_b = (_a = app == null ? void 0 : app.workspace) == null ? void 0 : _a.getActiveFile) == null ? void 0 : _b.call(_a)) == null ? void 0 : _c.path) != null ? _d : "default";
    }, []);
  }
  function usePersistentOpen2(storageKey, defaultOpen) {
    const [open, setOpen] = React9.useState(() => {
      try {
        if (typeof localStorage === "undefined") return defaultOpen;
        const stored = localStorage.getItem(storageKey);
        return stored === null ? defaultOpen : stored === "1";
      } catch (e) {
        return defaultOpen;
      }
    });
    const update = React9.useCallback(
      (next) => {
        setOpen(next);
        try {
          localStorage.setItem(storageKey, next ? "1" : "0");
        } catch (e) {
        }
      },
      [storageKey]
    );
    return [open, update];
  }
  function abilityModifier(stats2, ability) {
    if (!stats2) return 0;
    const raw = stats2[ability];
    let score = 10;
    if (typeof raw === "number") score = raw;
    else if (raw && typeof raw === "object" && typeof raw.value === "number") {
      score = raw.value;
    }
    return Math.floor((score - 10) / 2);
  }
  function signed2(n) {
    return n >= 0 ? `+${n}` : `\u2212${Math.abs(n)}`;
  }
  var GROUP_LABEL = {
    prepared: "prepared",
    granted: "granted",
    ritual: "ritual",
    known: "known"
  };
  function SpellEntry({
    spellName,
    group,
    doc,
    enablerSource
  }) {
    const stem = bareStem(spellName);
    const styleLabel = doc ? joinLabels(doc.style) : "";
    const componentsLabel = (doc == null ? void 0 : doc.components) != null ? joinLabels(doc.components) : "";
    const subParts = [];
    if (doc == null ? void 0 : doc.range) subParts.push({ key: "range", label: "Range", value: doc.range });
    if (componentsLabel) subParts.push({ key: "components", label: "Components", value: componentsLabel });
    if (doc == null ? void 0 : doc.duration) subParts.push({ key: "duration", label: "Duration", value: doc.duration });
    return /* @__PURE__ */ React9.createElement("li", { className: "rpg-spell-entry", "data-group": group }, /* @__PURE__ */ React9.createElement("span", { className: "rpg-spell-entry-header" }, /* @__PURE__ */ React9.createElement("a", { className: "internal-link rpg-spell-entry-name", href: stem, "data-href": stem }, stem), (doc == null ? void 0 : doc.casting) && /* @__PURE__ */ React9.createElement(React9.Fragment, null, /* @__PURE__ */ React9.createElement("span", { className: "rpg-spell-entry-sep" }, " \xB7 "), /* @__PURE__ */ React9.createElement("small", { className: "rpg-spell-entry-casting", "aria-details": "Casting Time" }, doc.casting, " to cast")), styleLabel && /* @__PURE__ */ React9.createElement(React9.Fragment, null, /* @__PURE__ */ React9.createElement("span", { className: "rpg-spell-entry-sep" }, " \xB7 "), /* @__PURE__ */ React9.createElement("small", { className: "rpg-spell-entry-style", "aria-details": "Style" }, styleLabel)), /* @__PURE__ */ React9.createElement("span", { className: "rpg-spell-entry-sep" }, " \xB7 "), /* @__PURE__ */ React9.createElement("small", { className: "rpg-spell-entry-group", "aria-details": "Spell Group" }, /* @__PURE__ */ React9.createElement("em", null, GROUP_LABEL[group]))), /* @__PURE__ */ React9.createElement(
      "a",
      {
        className: "internal-link rpg-spell-entry-enabler",
        href: enablerSource,
        "data-href": enablerSource,
        "aria-details": "Enabling Source"
      },
      enablerSource
    ), subParts.length > 0 && /* @__PURE__ */ React9.createElement("span", { className: "rpg-spell-entry-subline" }, subParts.map((p, i) => /* @__PURE__ */ React9.createElement(React9.Fragment, { key: p.key }, i > 0 && /* @__PURE__ */ React9.createElement("span", { className: "rpg-spell-entry-sep" }, " \xB7 "), /* @__PURE__ */ React9.createElement("small", { "aria-details": p.label }, p.value)))), (doc == null ? void 0 : doc.text) && /* @__PURE__ */ React9.createElement(import_rpg_ui_toolkit8.Markdown, { source: doc.text, className: "rpg-spell-entry-text" }));
  }
  function SlotPips({ max, spent, onChange }) {
    if (max === 0) return null;
    const clamped = Math.max(0, Math.min(max, spent));
    const spend = () => onChange == null ? void 0 : onChange(Math.min(max, clamped + 1));
    const unspend = () => onChange == null ? void 0 : onChange(Math.max(0, clamped - 1));
    return /* @__PURE__ */ React9.createElement("output", { "aria-label": `${max - clamped} of ${max} slots remaining`, className: "rpg-spell-slots" }, Array.from({ length: max }, (_, i) => {
      const isSpent = i < clamped;
      return /* @__PURE__ */ React9.createElement(
        "button",
        {
          key: i,
          type: "button",
          className: "rpg-spell-slot",
          "data-spent": isSpent ? "true" : "false",
          "aria-label": isSpent ? "Recover slot" : "Spend slot",
          onClick: () => isSpent ? unspend() : spend()
        },
        isSpent ? "\u25CF" : "\u25CB"
      );
    }));
  }
  function bundleForCircle(caster, state, circle, spells2) {
    var _a, _b, _c, _d, _e, _f;
    const out = { prepared: [], granted: [], ritual: [], known: [] };
    const push = (bucket, name) => {
      const bare = bareStem(name);
      if (bare && !out[bucket].includes(bare)) out[bucket].push(bare);
    };
    if (circle === 0) {
      for (const [lvlStr, raws] of Object.entries(caster.granted.cantrips)) {
        if (Number(lvlStr) > caster.level) continue;
        for (const s of raws) push("granted", s);
      }
      for (const s of (_a = state.cantrips) != null ? _a : []) push("known", s);
      return out;
    }
    for (const [lvlStr, raws] of Object.entries(caster.granted.prepared)) {
      if (Number(lvlStr) > caster.level) continue;
      for (const s of raws) {
        const stem = bareStem(s);
        const doc = spells2[stem];
        const docCircle = typeof (doc == null ? void 0 : doc.circle) === "string" ? circleNumber(doc.circle) : void 0;
        const fallback = Math.ceil(Number(lvlStr) / 2);
        if ((docCircle != null ? docCircle : fallback) === circle) push("granted", s);
      }
    }
    for (const s of (_c = (_b = state.prepared) == null ? void 0 : _b[circle]) != null ? _c : []) push("prepared", s);
    for (const s of (_e = (_d = state.known) == null ? void 0 : _d[circle]) != null ? _e : []) push("known", s);
    for (const [lvlStr, raws] of Object.entries((_f = state.rituals) != null ? _f : {})) {
      if (Number(lvlStr) > caster.level) continue;
      for (const s of raws != null ? raws : []) {
        const stem = bareStem(s);
        const doc = spells2[stem];
        const docCircle = typeof (doc == null ? void 0 : doc.circle) === "string" ? circleNumber(doc.circle) : void 0;
        const fallback = Math.ceil(Number(lvlStr) / 2);
        if ((docCircle != null ? docCircle : fallback) === circle) push("ritual", s);
      }
    }
    return out;
  }
  function circleNumber(raw) {
    const trimmed = raw.trim().toLowerCase();
    if (trimmed === "cantrip" || trimmed === "cantrips" || trimmed === "0") return 0;
    const m = trimmed.match(/^(\d+)/);
    if (m) return parseInt(m[1], 10);
    return void 0;
  }
  function CircleDrawer({
    caster,
    circle,
    slotsMax,
    spent,
    onSpentChange,
    entries,
    spells: spells2,
    noteKey
  }) {
    const [open, setOpen] = usePersistentOpen2(`${noteKey}:spells:${caster.source}:${circle}`, circle === 0);
    const label = circle === 0 ? "Cantrips" : `${ordinal(circle)} Circle`;
    const total = entries.prepared.length + entries.granted.length + entries.ritual.length + entries.known.length;
    const ordered = [
      ...entries.prepared.map((n) => ({ group: "prepared", name: n })),
      ...entries.granted.map((n) => ({ group: "granted", name: n })),
      ...entries.ritual.map((n) => ({ group: "ritual", name: n })),
      ...entries.known.map((n) => ({ group: "known", name: n }))
    ];
    return /* @__PURE__ */ React9.createElement(
      "details",
      {
        className: "rpg-spell-circle",
        "data-circle": circle,
        open,
        onToggle: (e) => setOpen(e.currentTarget.open)
      },
      /* @__PURE__ */ React9.createElement("summary", null, /* @__PURE__ */ React9.createElement("span", { className: "rpg-spell-circle-label" }, label), circle !== 0 && slotsMax > 0 && /* @__PURE__ */ React9.createElement(SlotPips, { max: slotsMax, spent, onChange: onSpentChange }), /* @__PURE__ */ React9.createElement("span", { className: "rpg-spell-circle-count" }, total)),
      total === 0 ? /* @__PURE__ */ React9.createElement("p", { "aria-details": "Empty Circle" }, /* @__PURE__ */ React9.createElement("em", null, "\u2014")) : /* @__PURE__ */ React9.createElement("ul", { "aria-label": `${label} Spells`, className: "rpg-spell-entries" }, ordered.map(({ group, name }) => {
        var _a;
        const stem = bareStem(name);
        const enabler = (_a = caster.grantedBy[stem]) != null ? _a : caster.source;
        return /* @__PURE__ */ React9.createElement(
          SpellEntry,
          {
            key: `${group}:${name}`,
            spellName: name,
            group,
            doc: spells2[stem],
            enablerSource: enabler
          }
        );
      }))
    );
  }
  function ordinal(n) {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }
  function CasterSection({
    caster,
    state,
    spells: spells2,
    onSpentChange,
    noteKey,
    abilityMod,
    proficiencyBonus
  }) {
    const slots = slotsForCaster(caster.tier, caster.level);
    const highest = slots.reduce((max, n, i) => n > 0 ? i + 1 : max, 0);
    const saveDc = 8 + proficiencyBonus + abilityMod;
    return /* @__PURE__ */ React9.createElement("article", { "aria-label": `Spellcasting \xB7 ${caster.source}`, className: "rpg-caster" }, /* @__PURE__ */ React9.createElement("header", { className: "rpg-caster-header" }, /* @__PURE__ */ React9.createElement("span", null, "Spellcasting \xB7 ", caster.source, /* @__PURE__ */ React9.createElement("small", { className: "rpg-caster-meta" }, caster.ability ? /* @__PURE__ */ React9.createElement(React9.Fragment, null, " ", "\xB7 ", caster.ability, " ", signed2(abilityMod), " \xB7 DC ", saveDc) : /* @__PURE__ */ React9.createElement(React9.Fragment, null, " ", "\xB7 ", /* @__PURE__ */ React9.createElement("em", null, "pick ability")), " ", "\xB7 ", caster.type === "prepared" ? "prepared" : "known", caster.tier !== "none" && /* @__PURE__ */ React9.createElement(React9.Fragment, null, " \xB7 ", caster.tier, "-caster")))), /* @__PURE__ */ React9.createElement("div", { className: "rpg-caster-body" }, (() => {
      const cantripEntries = bundleForCircle(caster, state, 0, spells2);
      if (caster.cantrips === 0 && cantripEntries.prepared.length === 0 && cantripEntries.granted.length === 0 && cantripEntries.ritual.length === 0 && cantripEntries.known.length === 0) {
        return null;
      }
      return /* @__PURE__ */ React9.createElement(
        CircleDrawer,
        {
          caster,
          circle: 0,
          slotsMax: 0,
          spent: 0,
          entries: cantripEntries,
          spells: spells2,
          noteKey
        }
      );
    })(), Array.from({ length: highest }, (_, i) => {
      var _a, _b, _c;
      const circle = i + 1;
      const max = (_a = slots[i]) != null ? _a : 0;
      const spent = (_c = (_b = state.spent) == null ? void 0 : _b[circle]) != null ? _c : 0;
      const entries = bundleForCircle(caster, state, circle, spells2);
      return /* @__PURE__ */ React9.createElement(
        CircleDrawer,
        {
          key: circle,
          caster,
          circle,
          slotsMax: max,
          spent,
          onSpentChange: (n) => onSpentChange == null ? void 0 : onSpentChange(circle, n),
          entries: bundleForCircle(caster, state, circle, spells2),
          spells: spells2,
          noteKey
        }
      );
    })));
  }
  function collectFlavorOptions(caster, inPool, spellLibrary) {
    if (!caster.style || caster.style.length === 0) {
      return [];
    }
    const normaliseOne = (v) => {
      let cur = v;
      while (Array.isArray(cur)) cur = cur[0];
      if (typeof cur !== "string") return "";
      return cur.replace(/^\[\[/, "").replace(/\]\]$/, "").split("|")[0].trim().toLowerCase();
    };
    const collectStrings = (v, out2) => {
      if (v == null) return;
      if (Array.isArray(v)) {
        if (v.length === 1 && Array.isArray(v[0]) && v[0].length === 1 && typeof v[0][0] === "string") {
          const n = normaliseOne(v[0][0]);
          if (n) out2.push(n);
          return;
        }
        for (const x of v) collectStrings(x, out2);
        return;
      }
      if (typeof v === "string") {
        for (const part of v.split(",")) {
          const n = normaliseOne(part);
          if (n) out2.push(n);
        }
      }
    };
    const styleSet = /* @__PURE__ */ new Set();
    for (const s of caster.style) {
      const list = [];
      collectStrings(s, list);
      for (const n of list) styleSet.add(n);
    }
    if (styleSet.size === 0) return [];
    const out = [];
    for (const [stem, doc] of Object.entries(spellLibrary)) {
      if (inPool.has(stem)) continue;
      const list = [];
      collectStrings(doc.style, list);
      if (list.some((s) => styleSet.has(s))) {
        out.push(`[[${stem}]]`);
      }
    }
    return out;
  }
  function collectPending(casters, castersState, tagIndex, folderIndex, preparedBudgets, spellLibrary, extraStyles) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s, _t, _u;
    const out = [];
    for (const caster of casters) {
      const state = (_a = castersState[caster.source]) != null ? _a : {};
      const mergedStyles = [];
      const pushStyle = (v) => {
        let cur = v;
        while (Array.isArray(cur)) cur = cur[0];
        if (typeof cur !== "string") return;
        const n = cur.replace(/^\[\[/, "").replace(/\]\]$/, "").split("|")[0].trim();
        if (n && !mergedStyles.includes(n)) mergedStyles.push(n);
      };
      for (const s of (_b = caster.style) != null ? _b : []) pushStyle(s);
      for (const s of extraStyles != null ? extraStyles : []) pushStyle(s);
      const effectiveCaster = { ...caster, style: mergedStyles };
      const cantripPicks = ((_c = state.cantrips) != null ? _c : []).map(bareStem).filter(Boolean);
      const cantripDeficit = Math.max(0, caster.cantrips - cantripPicks.length);
      const mainPool = caster.pool ? (0, import_rpg_ui_toolkit8.expandOptionRefs)([caster.pool], tagIndex, folderIndex) : [];
      const cantripSource = (_d = caster.cantrip_pool) != null ? _d : caster.pool;
      const cantripRaw = cantripSource ? (0, import_rpg_ui_toolkit8.expandOptionRefs)([cantripSource], tagIndex, folderIndex) : [];
      const cantripPool = caster.cantrip_pool && caster.pool && mainPool.length > 0 ? cantripRaw.filter((c) => mainPool.includes(c)) : cantripRaw;
      if (cantripDeficit > 0) {
        const inPool = new Set(cantripPool.map(bareStem));
        const flavor = collectFlavorOptions(effectiveCaster, inPool, spellLibrary).filter((ref) => {
          const stem = bareStem(ref);
          const doc = spellLibrary[stem];
          const c = typeof (doc == null ? void 0 : doc.circle) === "string" ? circleNumber(doc.circle) : void 0;
          return c === 0;
        });
        out.push({
          source: caster.source,
          category: "cantrips",
          label: "Known Cantrips",
          remaining: cantripDeficit,
          picked: cantripPicks,
          options: cantripPool,
          flavorOptions: flavor.length > 0 ? flavor : void 0
        });
      }
      if (caster.type === "prepared" && mainPool.length > 0) {
        const budget = (_e = preparedBudgets[caster.source]) != null ? _e : 0;
        const preparedPicksByCircle = {};
        const allPicks = [];
        for (const [cStr, list] of Object.entries((_f = state.prepared) != null ? _f : {})) {
          const c = Number(cStr);
          if (!Number.isFinite(c)) continue;
          const bucket = (_g = preparedPicksByCircle[c]) != null ? _g : preparedPicksByCircle[c] = [];
          for (const s of list != null ? list : []) {
            const stem = bareStem(s);
            if (stem) {
              bucket.push(stem);
              allPicks.push(stem);
            }
          }
        }
        const deficit = Math.max(0, budget - allPicks.length);
        if (deficit > 0) {
          const slots = slotsForCaster(caster.tier, caster.level);
          const maxCircle = slots.reduce((m, n, i) => n > 0 ? i + 1 : m, 0);
          const poolByCircle = {};
          const inPool = /* @__PURE__ */ new Set();
          for (const ref of mainPool) {
            const stem = bareStem(ref);
            inPool.add(stem);
            const doc = spellLibrary[stem];
            const rawCircle = typeof (doc == null ? void 0 : doc.circle) === "string" ? doc.circle : "";
            const c = rawCircle ? circleNumber(rawCircle) : void 0;
            if (c == null || c === 0 || c > maxCircle) continue;
            ((_h = poolByCircle[c]) != null ? _h : poolByCircle[c] = []).push(ref);
          }
          const flavorByCircle = {};
          for (const ref of collectFlavorOptions(effectiveCaster, inPool, spellLibrary)) {
            const stem = bareStem(ref);
            const doc = spellLibrary[stem];
            const rawCircle = typeof (doc == null ? void 0 : doc.circle) === "string" ? doc.circle : "";
            const c = rawCircle ? circleNumber(rawCircle) : void 0;
            if (c == null || c === 0 || c > maxCircle) continue;
            ((_i = flavorByCircle[c]) != null ? _i : flavorByCircle[c] = []).push(ref);
          }
          const circles = [];
          for (let c = 1; c <= maxCircle; c++) {
            const options = (_j = poolByCircle[c]) != null ? _j : [];
            const flavor = (_k = flavorByCircle[c]) != null ? _k : [];
            if (options.length === 0 && flavor.length === 0) continue;
            circles.push({
              circle: c,
              options,
              picked: (_l = preparedPicksByCircle[c]) != null ? _l : [],
              flavorOptions: flavor.length > 0 ? flavor : void 0
            });
          }
          if (circles.length > 0) {
            out.push({
              source: caster.source,
              category: "prepared",
              label: "Prepared Spells",
              remaining: deficit,
              picked: allPicks,
              circles
            });
          }
        }
      }
      if ((caster.rituals > 0 || caster.rituals_per_circle > 0) && (caster.ritual_pool || caster.pool)) {
        const poolRef = (_m = caster.ritual_pool) != null ? _m : caster.pool;
        const rawRitualPool = (0, import_rpg_ui_toolkit8.expandOptionRefs)([poolRef], tagIndex, folderIndex);
        const ritualPool = rawRitualPool.filter((ref) => {
          const stem = bareStem(ref);
          const doc = spellLibrary[stem];
          const raw = typeof (doc == null ? void 0 : doc.circle) === "string" ? doc.circle : "";
          return /ritual/i.test(raw);
        });
        const inRitualPool = new Set(ritualPool.map(bareStem));
        const flavorRitualRefs = collectFlavorOptions(effectiveCaster, inRitualPool, spellLibrary).filter((ref) => {
          const stem = bareStem(ref);
          const doc = spellLibrary[stem];
          const raw = typeof (doc == null ? void 0 : doc.circle) === "string" ? doc.circle : "";
          return /ritual/i.test(raw);
        });
        const effectiveByLevel = { ...(_n = caster.ritualsByLevel) != null ? _n : {} };
        if (caster.rituals_per_circle > 0) {
          const slotsAtCurrent = slotsForCaster(caster.tier, caster.level);
          const maxCircleNow = slotsAtCurrent.reduce((m, n, i) => n > 0 ? i + 1 : m, 0);
          for (let circle = 1; circle <= maxCircleNow; circle++) {
            let unlockLevel;
            for (let lv = 1; lv <= caster.level; lv++) {
              const slots = slotsForCaster(caster.tier, lv);
              if (((_o = slots[circle - 1]) != null ? _o : 0) > 0) {
                unlockLevel = lv;
                break;
              }
            }
            if (unlockLevel == null) continue;
            effectiveByLevel[unlockLevel] = ((_p = effectiveByLevel[unlockLevel]) != null ? _p : 0) + caster.rituals_per_circle;
          }
        }
        const grantLevels = Object.keys(effectiveByLevel).map(Number).filter((n) => {
          var _a2;
          return Number.isFinite(n) && n > 0 && n <= caster.level && ((_a2 = effectiveByLevel[n]) != null ? _a2 : 0) > 0;
        }).sort((a, b) => a - b);
        for (const grantLevel of grantLevels) {
          const budget = (_q = effectiveByLevel[grantLevel]) != null ? _q : 0;
          const picks = (_s = (_r = state.rituals) == null ? void 0 : _r[grantLevel]) != null ? _s : [];
          const deficit = Math.max(0, budget - picks.length);
          if (deficit === 0) continue;
          const slots = slotsForCaster(caster.tier, grantLevel);
          const maxCircleAtGrant = slots.reduce((m, n, i) => n > 0 ? i + 1 : m, 0);
          const bucketByCircle = (refs) => {
            var _a2;
            const grouped = {};
            for (const ref of refs) {
              const stem = bareStem(ref);
              const doc = spellLibrary[stem];
              const rawCircle = typeof (doc == null ? void 0 : doc.circle) === "string" ? doc.circle : "";
              const c = rawCircle ? circleNumber(rawCircle) : void 0;
              if (c == null || c === 0 || c > maxCircleAtGrant) continue;
              ((_a2 = grouped[c]) != null ? _a2 : grouped[c] = []).push(ref);
            }
            return grouped;
          };
          const poolByCircle = bucketByCircle(ritualPool);
          const flavorByCircle = bucketByCircle(flavorRitualRefs);
          const circles = [];
          for (let c = 1; c <= maxCircleAtGrant; c++) {
            const options = (_t = poolByCircle[c]) != null ? _t : [];
            const flavor = (_u = flavorByCircle[c]) != null ? _u : [];
            if (options.length === 0 && flavor.length === 0) continue;
            circles.push({
              circle: c,
              options,
              picked: picks.map(bareStem),
              flavorOptions: flavor.length > 0 ? flavor : void 0
            });
          }
          out.push({
            source: caster.source,
            category: "rituals",
            label: `Lv. ${grantLevel} Rituals`,
            remaining: deficit,
            picked: picks.map(bareStem),
            level: grantLevel,
            circles: circles.length > 0 ? circles : void 0
          });
        }
      }
    }
    return out;
  }
  function SpellPendingRow({
    pending,
    onToggle
  }) {
    var _a, _b, _c, _d, _e, _f;
    const groups = pending.circles;
    const hasCircles = Array.isArray(groups) && groups.length > 0;
    const totalOptions = hasCircles ? groups.reduce((n, g) => {
      var _a2, _b2;
      return n + g.options.length + ((_b2 = (_a2 = g.flavorOptions) == null ? void 0 : _a2.length) != null ? _b2 : 0);
    }, 0) : ((_b = (_a = pending.options) == null ? void 0 : _a.length) != null ? _b : 0) + ((_d = (_c = pending.flavorOptions) == null ? void 0 : _c.length) != null ? _d : 0);
    const renderOption = (opt, i, picked, flavor, circle) => {
      const optLabel = bareStem(opt) || opt;
      const alreadyPicked = picked.includes(optLabel);
      const slotsFull = pending.remaining === 0;
      return /* @__PURE__ */ React9.createElement("li", { key: `${flavor ? "f" : "p"}:${i}:${opt}` }, /* @__PURE__ */ React9.createElement(
        "button",
        {
          type: "button",
          "data-flavor": flavor ? "true" : void 0,
          "aria-pressed": alreadyPicked,
          disabled: !onToggle || slotsFull && !alreadyPicked,
          onClick: () => onToggle == null ? void 0 : onToggle(opt, circle)
        },
        optLabel
      ));
    };
    return /* @__PURE__ */ React9.createElement("aside", { className: "rpg-feature-pending", "aria-label": `Pending ${pending.label} for ${pending.source}` }, /* @__PURE__ */ React9.createElement("p", null, "pick ", pending.remaining, " more for ", /* @__PURE__ */ React9.createElement("em", null, pending.label)), totalOptions === 0 ? /* @__PURE__ */ React9.createElement("p", { className: "rpg-spell-pending-empty" }, /* @__PURE__ */ React9.createElement("em", null, "No options available \u2014 set a `pool:` on this caster or populate the referenced compendium.")) : hasCircles ? (
      // Circle-grouped: one sub-section per circle under the single
      // "pick N more" label so the remaining budget shows once.
      /* @__PURE__ */ React9.createElement("div", { className: "rpg-spell-pending-circles" }, groups.map((g) => {
        var _a2;
        return /* @__PURE__ */ React9.createElement("div", { key: g.circle, className: "rpg-spell-pending-circle" }, /* @__PURE__ */ React9.createElement("h4", { className: "rpg-spell-pending-circle-label" }, ordinal(g.circle), " Circle"), /* @__PURE__ */ React9.createElement("menu", { "aria-label": `${ordinal(g.circle)} Circle Options` }, g.options.map((opt, i) => renderOption(opt, i, g.picked, false, g.circle)), ((_a2 = g.flavorOptions) != null ? _a2 : []).map((opt, i) => renderOption(opt, i, g.picked, true, g.circle))));
      }))
    ) : /* @__PURE__ */ React9.createElement("menu", { "aria-label": "Choice Options" }, ((_e = pending.options) != null ? _e : []).map((opt, i) => renderOption(opt, i, pending.picked, false)), ((_f = pending.flavorOptions) != null ? _f : []).map((opt, i) => renderOption(opt, i, pending.picked, true))));
  }
  function groupPendingBySource(pending) {
    var _a;
    const order = /* @__PURE__ */ new Map();
    pending.forEach((p, i) => {
      if (!order.has(p.source)) order.set(p.source, i);
    });
    const groups = /* @__PURE__ */ new Map();
    for (const p of pending) {
      const bucket = (_a = groups.get(p.source)) != null ? _a : [];
      bucket.push(p);
      groups.set(p.source, bucket);
    }
    return [...groups.entries()].sort(([a], [b]) => {
      var _a2, _b;
      return ((_a2 = order.get(a)) != null ? _a2 : 0) - ((_b = order.get(b)) != null ? _b : 0);
    }).map(([source, rows]) => ({ source, rows }));
  }
  function gatherSpellDecisions(casters, castersState, onUndoCantrip, onUndoCircleEntry) {
    var _a, _b, _c, _d;
    const labelMap = {
      prepared: "Prepared",
      known: "Known",
      rituals: "Rituals"
    };
    const groups = [];
    for (const caster of casters) {
      const state = (_a = castersState[caster.source]) != null ? _a : {};
      const categories = [];
      const cantrips = (_b = state.cantrips) != null ? _b : [];
      if (cantrips.length > 0) {
        categories.push({
          label: "Cantrips",
          flat: cantrips.map((s) => ({
            spell: s,
            onUndo: onUndoCantrip ? () => onUndoCantrip(caster.source, s) : void 0
          }))
        });
      }
      const circleCategories = ["known", "prepared", "rituals"];
      for (const cat of circleCategories) {
        const map = (_c = state[cat]) != null ? _c : {};
        const circleNums = Object.keys(map).map((k) => Number(k)).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
        const circles = [];
        for (const circle of circleNums) {
          const picks = (_d = map[circle]) != null ? _d : [];
          if (picks.length === 0) continue;
          circles.push({
            circle,
            entries: picks.map((s) => ({
              spell: s,
              onUndo: onUndoCircleEntry ? () => onUndoCircleEntry(caster.source, cat, circle, s) : void 0
            }))
          });
        }
        if (circles.length > 0) {
          categories.push({
            label: labelMap[cat],
            dimension: cat === "rituals" ? "level" : "circle",
            circles
          });
        }
      }
      if (categories.length > 0) groups.push({ source: caster.source, categories });
    }
    return groups;
  }
  function SpellsDecisionsLog({
    casters,
    castersState,
    noteKey,
    onUndoCantrip,
    onUndoCircleEntry
  }) {
    const groups = React9.useMemo(
      () => gatherSpellDecisions(casters, castersState, onUndoCantrip, onUndoCircleEntry),
      [casters, castersState, onUndoCantrip, onUndoCircleEntry]
    );
    if (groups.length === 0) return null;
    const total = groups.reduce((n, g) => {
      for (const cat of g.categories) {
        if (cat.flat) n += cat.flat.length;
        if (cat.circles) for (const c of cat.circles) n += c.entries.length;
      }
      return n;
    }, 0);
    const [open, setOpen] = usePersistentOpen2(`${noteKey}:spells:decisions`, false);
    const renderEntry = (e, key, leadingComma) => {
      const stem = bareStem(e.spell);
      return /* @__PURE__ */ React9.createElement(React9.Fragment, { key }, leadingComma && ", ", /* @__PURE__ */ React9.createElement("span", { className: "rpg-feature-decisions-entry" }, /* @__PURE__ */ React9.createElement("a", { className: "internal-link", href: stem, "data-href": stem }, stem), e.onUndo && /* @__PURE__ */ React9.createElement(
        "button",
        {
          type: "button",
          className: "rpg-feature-decisions-undo",
          "aria-label": `Undo ${stem}`,
          title: "Undo this decision",
          onClick: e.onUndo
        },
        "\u21BA"
      )));
    };
    return /* @__PURE__ */ React9.createElement(
      "details",
      {
        className: "rpg-feature-decisions",
        open,
        onToggle: (e) => setOpen(e.currentTarget.open)
      },
      /* @__PURE__ */ React9.createElement("summary", null, /* @__PURE__ */ React9.createElement("span", { className: "rpg-feature-decisions-label" }, "Decisions made"), /* @__PURE__ */ React9.createElement("span", { className: "rpg-feature-decisions-count" }, total)),
      /* @__PURE__ */ React9.createElement("div", { className: "rpg-feature-decisions-groups" }, groups.map((g) => /* @__PURE__ */ React9.createElement("div", { key: g.source, className: "rpg-feature-decisions-group" }, /* @__PURE__ */ React9.createElement("p", { className: "rpg-feature-decisions-source-line" }, /* @__PURE__ */ React9.createElement("a", { className: "internal-link rpg-feature-decisions-source-link", href: g.source, "data-href": g.source }, g.source)), g.categories.map((cat) => {
        var _a, _b;
        return /* @__PURE__ */ React9.createElement("p", { key: cat.label, className: "rpg-feature-decisions-category-line" }, /* @__PURE__ */ React9.createElement("strong", null, cat.label), " \u2014 ", (_a = cat.flat) == null ? void 0 : _a.map((e, j) => renderEntry(e, j, j > 0)), (_b = cat.circles) == null ? void 0 : _b.map((circ, i) => /* @__PURE__ */ React9.createElement(React9.Fragment, { key: circ.circle }, i > 0 && "; ", /* @__PURE__ */ React9.createElement("em", { className: "rpg-feature-decisions-circle-tag" }, cat.dimension === "level" ? `Lv. ${circ.circle}:` : `${ordinal(circ.circle)} Circle:`), " ", circ.entries.map((e, j) => renderEntry(e, j, j > 0)))));
      }))))
    );
  }
  var spells = ({ self, blocks, lookup, expressions }) => {
    var _a, _b, _c;
    const header2 = blocks.header;
    const features2 = blocks.features;
    const view = (_a = lookup.$features) == null ? void 0 : _a.call(lookup, header2, features2 == null ? void 0 : features2.choices, features2 == null ? void 0 : features2.additional);
    const noteKey = useNoteKey3();
    const [pendingOpen, setPendingOpen] = usePersistentOpen2(`${noteKey}:spells:pending`, true);
    if (!view || view.casters.length === 0) {
      return /* @__PURE__ */ React9.createElement("section", { "aria-details": "Character Spells" }, /* @__PURE__ */ React9.createElement("p", { "aria-details": "No Casters" }, /* @__PURE__ */ React9.createElement("em", null, "No spellcasting class declared.")));
    }
    const castersState = (_b = self.casters) != null ? _b : {};
    const stats2 = blocks.stats;
    const spellLibrary = (_c = lookup.$spells) != null ? _c : {};
    const setCasters = self.setCasters;
    const updateSpent = setCasters ? (source, circle, next) => {
      setCasters((prev) => {
        var _a2, _b2;
        const nextMap = { ...prev != null ? prev : {} };
        const casterPrev = { ...(_a2 = nextMap[source]) != null ? _a2 : {} };
        const spentPrev = { ...(_b2 = casterPrev.spent) != null ? _b2 : {} };
        if (next <= 0) delete spentPrev[circle];
        else spentPrev[circle] = next;
        casterPrev.spent = Object.keys(spentPrev).length > 0 ? spentPrev : void 0;
        nextMap[source] = casterPrev;
        return nextMap;
      });
    } : void 0;
    const toggleCantrip = setCasters ? (source, option) => {
      setCasters((prev) => {
        var _a2, _b2;
        const nextMap = { ...prev != null ? prev : {} };
        const casterPrev = { ...(_a2 = nextMap[source]) != null ? _a2 : {} };
        const list = [...(_b2 = casterPrev.cantrips) != null ? _b2 : []];
        const bare = bareStem(option);
        const idx = list.findIndex((s) => bareStem(s) === bare);
        if (idx >= 0) list.splice(idx, 1);
        else list.push(option);
        if (list.length === 0) delete casterPrev.cantrips;
        else casterPrev.cantrips = list;
        nextMap[source] = casterPrev;
        return nextMap;
      });
    } : void 0;
    const removeFromCircleList = setCasters ? (source, category, circle, option) => {
      setCasters((prev) => {
        var _a2, _b2, _c2;
        const nextMap = { ...prev != null ? prev : {} };
        const casterPrev = { ...(_a2 = nextMap[source]) != null ? _a2 : {} };
        const bucketMap = { ...(_b2 = casterPrev[category]) != null ? _b2 : {} };
        const list = [...(_c2 = bucketMap[circle]) != null ? _c2 : []];
        const bare = bareStem(option);
        const idx = list.findIndex((s) => bareStem(s) === bare);
        if (idx < 0) return prev != null ? prev : {};
        list.splice(idx, 1);
        if (list.length === 0) delete bucketMap[circle];
        else bucketMap[circle] = list;
        if (Object.keys(bucketMap).length === 0) delete casterPrev[category];
        else casterPrev[category] = bucketMap;
        nextMap[source] = casterPrev;
        return nextMap;
      });
    } : void 0;
    const togglePrepared = setCasters ? (source, option, circle) => {
      if (!Number.isFinite(circle) || circle <= 0) return;
      const stem = bareStem(option);
      if (!stem) return;
      setCasters((prev) => {
        var _a2, _b2, _c2;
        const nextMap = { ...prev != null ? prev : {} };
        const casterPrev = { ...(_a2 = nextMap[source]) != null ? _a2 : {} };
        const bucketMap = { ...(_b2 = casterPrev.prepared) != null ? _b2 : {} };
        const list = [...(_c2 = bucketMap[circle]) != null ? _c2 : []];
        const idx = list.findIndex((s) => bareStem(s) === stem);
        if (idx >= 0) list.splice(idx, 1);
        else list.push(option);
        if (list.length === 0) delete bucketMap[circle];
        else bucketMap[circle] = list;
        if (Object.keys(bucketMap).length === 0) delete casterPrev.prepared;
        else casterPrev.prepared = bucketMap;
        nextMap[source] = casterPrev;
        return nextMap;
      });
    } : void 0;
    const toggleRitual = setCasters ? (source, option, level2) => {
      if (!Number.isFinite(level2) || level2 <= 0) return;
      const stem = bareStem(option);
      if (!stem) return;
      setCasters((prev) => {
        var _a2, _b2, _c2;
        const nextMap = { ...prev != null ? prev : {} };
        const casterPrev = { ...(_a2 = nextMap[source]) != null ? _a2 : {} };
        const bucketMap = { ...(_b2 = casterPrev.rituals) != null ? _b2 : {} };
        const list = [...(_c2 = bucketMap[level2]) != null ? _c2 : []];
        const idx = list.findIndex((s) => bareStem(s) === stem);
        if (idx >= 0) list.splice(idx, 1);
        else list.push(option);
        if (list.length === 0) delete bucketMap[level2];
        else bucketMap[level2] = list;
        if (Object.keys(bucketMap).length === 0) delete casterPrev.rituals;
        else casterPrev.rituals = bucketMap;
        nextMap[source] = casterPrev;
        return nextMap;
      });
    } : void 0;
    const compendium = lookup.$compendium;
    const preparedBudgets = {};
    for (const caster of view.casters) {
      if (caster.type !== "prepared" || !caster.prepared_max) continue;
      const mod = abilityModifier(stats2, caster.ability);
      const pb = expressions.ProficiencyBonus();
      const vars = {
        LV: caster.level,
        CLASS_LEVEL: caster.level,
        PB: pb,
        [`${caster.ability}_MOD`]: mod,
        STR_MOD: abilityModifier(stats2, "STR"),
        DEX_MOD: abilityModifier(stats2, "DEX"),
        CON_MOD: abilityModifier(stats2, "CON"),
        INT_MOD: abilityModifier(stats2, "INT"),
        WIS_MOD: abilityModifier(stats2, "WIS"),
        CHA_MOD: abilityModifier(stats2, "CHA")
      };
      preparedBudgets[caster.source] = evalPreparedMax(caster.prepared_max, vars);
    }
    const pending = collectPending(
      view.casters,
      castersState,
      compendium == null ? void 0 : compendium.tagIndex,
      compendium == null ? void 0 : compendium.folderIndex,
      preparedBudgets,
      spellLibrary,
      // Character-level `style:` merges into every caster's own
      // declared style list — lets the sheet author attune a single
      // character without editing the class's shared config.
      Array.isArray(self.style) ? self.style : self.style != null ? [self.style] : []
    );
    return /* @__PURE__ */ React9.createElement("section", { "aria-details": "Character Spells" }, view.casters.map((caster) => {
      var _a2;
      const state = (_a2 = castersState[caster.source]) != null ? _a2 : {};
      const mod = abilityModifier(stats2, caster.ability);
      const pb = expressions.ProficiencyBonus();
      return /* @__PURE__ */ React9.createElement(
        CasterSection,
        {
          key: caster.source,
          caster,
          state,
          spells: spellLibrary,
          noteKey,
          abilityMod: mod,
          proficiencyBonus: pb,
          onSpentChange: updateSpent ? (circle, next) => updateSpent(caster.source, circle, next) : void 0
        }
      );
    }), (pending.length > 0 || hasAnyPicks(view.casters, castersState)) && /* @__PURE__ */ React9.createElement("section", { "aria-label": "Spell Pending Choices", className: "rpg-feature-pending-list" }, pending.length > 0 && /* @__PURE__ */ React9.createElement(
      "details",
      {
        className: "rpg-feature-pending-details",
        open: pendingOpen,
        onToggle: (e) => setPendingOpen(e.currentTarget.open)
      },
      /* @__PURE__ */ React9.createElement("summary", null, /* @__PURE__ */ React9.createElement("span", { className: "rpg-feature-pending-label" }, "Choices to make"), /* @__PURE__ */ React9.createElement("span", { className: "rpg-feature-pending-count" }, pending.length)),
      /* @__PURE__ */ React9.createElement("div", { className: "rpg-feature-pending-groups" }, groupPendingBySource(pending).map(({ source, rows }) => /* @__PURE__ */ React9.createElement("div", { key: source, className: "rpg-feature-pending-group" }, /* @__PURE__ */ React9.createElement("h3", { className: "rpg-feature-pending-group-label" }, /* @__PURE__ */ React9.createElement("a", { className: "internal-link", href: source, "data-href": source }, source)), rows.map((p, i) => {
        var _a2;
        return /* @__PURE__ */ React9.createElement(
          SpellPendingRow,
          {
            key: `${p.category}:${(_a2 = p.level) != null ? _a2 : "x"}:${i}`,
            pending: p,
            onToggle: p.category === "cantrips" && toggleCantrip ? (opt) => toggleCantrip(p.source, opt) : p.category === "prepared" && togglePrepared ? (opt, circle) => {
              if (typeof circle !== "number") return;
              togglePrepared(p.source, opt, circle);
            } : p.category === "rituals" && toggleRitual && typeof p.level === "number" ? (opt) => toggleRitual(p.source, opt, p.level) : void 0
          }
        );
      }))))
    ), /* @__PURE__ */ React9.createElement(
      SpellsDecisionsLog,
      {
        casters: view.casters,
        castersState,
        noteKey,
        onUndoCantrip: toggleCantrip,
        onUndoCircleEntry: removeFromCircleList
      }
    )));
  };
  var spells_default = spells;

  // vault:tales-of-the-valiant/config/blocks/character/inventory.tsx
  var React10 = __toESM(__require("react"));
  var import_rpg_ui_toolkit9 = __require("rpg-ui-toolkit");
  var inventory = ({ self, blocks, lookup, expressions }) => {
    var _a, _b, _c, _d, _e;
    const rawItems = Array.isArray(self.items) ? self.items : [];
    const items = normaliseItems(rawItems);
    const itemsByName = (_a = lookup == null ? void 0 : lookup.$items) != null ? _a : {};
    const magicByName = (_b = lookup == null ? void 0 : lookup.$magic) != null ? _b : {};
    const personalByName = (_c = lookup == null ? void 0 : lookup.$personal) != null ? _c : {};
    const containersByName = (_d = lookup == null ? void 0 : lookup.$containers) != null ? _d : {};
    const containerPaths = (_e = lookup == null ? void 0 : lookup.$containerPaths) != null ? _e : {};
    const provenanceById = /* @__PURE__ */ new Map();
    const expandedItems = items.map((entry, idx) => {
      const expansion = expandContainerEntry(entry, {
        containersByName,
        containerPaths
      });
      if (expansion.provenances.length > 0) {
        for (const p of expansion.provenances) {
          provenanceById.set([String(idx), ...p.pathSegments].join("."), p.info);
        }
      }
      return expansion.entry;
    });
    const block = {
      items: expandedItems,
      currency: normaliseCurrency(self.currency),
      encumbrance: self.encumbrance
    };
    const strength = resolveStrength(self, blocks, expressions);
    const lookupFn = (target) => {
      var _a2, _b2;
      if (!target) return void 0;
      const stem = target.split("/").pop();
      const personal2 = (_a2 = personalByName[target]) != null ? _a2 : personalByName[stem];
      if (personal2) {
        const resolution = (0, import_rpg_ui_toolkit9.resolvePersonalItem)(personal2, { elements: itemsByName, magic: magicByName }, stem);
        if (resolution) return resolution.effectiveElement;
      }
      const container2 = (_b2 = containersByName[target]) != null ? _b2 : containersByName[stem];
      if (container2) {
        const resolution = (0, import_rpg_ui_toolkit9.resolveContainer)(container2, { elements: itemsByName, magic: magicByName }, stem);
        if (resolution) return resolution.effectiveElement;
      }
      if (itemsByName[target]) return itemsByName[target];
      return itemsByName[stem];
    };
    const data = (0, import_rpg_ui_toolkit9.resolveInventory)({
      block,
      lookup: lookupFn,
      strength,
      attunement: resolveAttunement(items, personalByName, blocks, lookup)
    });
    const selfApi = self;
    const setItems = selfApi.setItems;
    const patchForeignBlock = selfApi.patchForeignBlock;
    const handleToggleEquip = setItems ? (target) => {
      setItems(toggleEquip(items, target, lookupFn));
    } : void 0;
    const handleToggleForSale = setItems ? (target) => {
      const provenance = provenanceById.get(target.id);
      if (provenance) {
        if (!patchForeignBlock) return;
        patchContainerForSale(patchForeignBlock, containersByName, provenance);
        return;
      }
      setItems(toggleForSale(items, target));
    } : void 0;
    return /* @__PURE__ */ React10.createElement(import_rpg_ui_toolkit9.InventoryBlock, { data, onToggleEquip: handleToggleEquip, onToggleForSale: handleToggleForSale });
  };
  function expandContainerEntry(entry, lookups) {
    var _a;
    const stem = wikiStem3(entry.name);
    const container2 = lookups.containersByName[stem];
    if (!container2) return { entry, provenances: [] };
    const path = (_a = lookups.containerPaths[stem]) != null ? _a : "";
    const contents = [];
    const provenances = [];
    const recordChildren = (children, pathPrefix, locatorBase) => {
      children.forEach((child, idx) => {
        const childPath = [...pathPrefix, String(idx)];
        provenances.push({
          pathSegments: childPath,
          info: {
            stem,
            path,
            locator: appendSubPath(locatorBase, [idx])
          }
        });
        if (Array.isArray(child.contents)) {
          recordChildren(child.contents, childPath, appendSubPath(locatorBase, [idx]));
        }
      });
    };
    const sections = Array.isArray(container2.sections) ? container2.sections : [];
    sections.forEach((section, sectionIndex) => {
      const sectionItems = Array.isArray(section.items) ? section.items : [];
      if (sectionItems.length === 0) return;
      if (section.name) {
        const childContents = sectionItems.map(toInventoryItemEntry).filter((e) => e !== null);
        const wrapperIdx = contents.length;
        contents.push({ name: section.name, contents: childContents });
        recordChildren(childContents, [String(wrapperIdx)], {
          kind: "section",
          sectionIndex,
          itemIndex: -1
        });
      } else {
        sectionItems.forEach((item2, itemIndex) => {
          const converted = toInventoryItemEntry(item2);
          if (!converted) return;
          const idx = contents.length;
          contents.push(converted);
          provenances.push({
            pathSegments: [String(idx)],
            info: {
              stem,
              path,
              locator: { kind: "section", sectionIndex, itemIndex }
            }
          });
          if (Array.isArray(converted.contents)) {
            recordChildren(converted.contents, [String(idx)], {
              kind: "section",
              sectionIndex,
              itemIndex
            });
          }
        });
      }
    });
    const trailing = Array.isArray(container2.items) ? container2.items : [];
    trailing.forEach((item2, index) => {
      const converted = toInventoryItemEntry(item2);
      if (!converted) return;
      const idx = contents.length;
      contents.push(converted);
      provenances.push({
        pathSegments: [String(idx)],
        info: { stem, path, locator: { kind: "items", index } }
      });
      if (Array.isArray(converted.contents)) {
        recordChildren(converted.contents, [String(idx)], {
          kind: "items",
          index
        });
      }
    });
    return { entry: { ...entry, contents }, provenances };
  }
  function appendSubPath(base, indices) {
    var _a, _b;
    const subPath = [...(_a = base.subPath) != null ? _a : [], ...indices];
    if (base.kind === "items") {
      return { kind: "items", index: base.index, subPath };
    }
    if (base.itemIndex < 0) {
      const [first, ...rest] = indices;
      return {
        kind: "section",
        sectionIndex: base.sectionIndex,
        itemIndex: first,
        subPath: [...(_b = base.subPath) != null ? _b : [], ...rest]
      };
    }
    return {
      kind: "section",
      sectionIndex: base.sectionIndex,
      itemIndex: base.itemIndex,
      subPath
    };
  }
  function patchContainerForSale(patchForeignBlock, containersByName, provenance) {
    var _a, _b;
    if (!provenance.path) return;
    const container2 = containersByName[provenance.stem];
    if (!container2) return;
    if (provenance.locator.kind === "items") {
      const items = Array.isArray(container2.items) ? container2.items : [];
      const next = withToggledContainer(items, [provenance.locator.index, ...(_a = provenance.locator.subPath) != null ? _a : []]);
      if (!next) return;
      void patchForeignBlock(provenance.path, "item", "container", "items", next);
      return;
    }
    const sectionLocator = provenance.locator;
    const sections = Array.isArray(container2.sections) ? container2.sections : [];
    if (sectionLocator.sectionIndex >= sections.length) return;
    const targetSection = sections[sectionLocator.sectionIndex];
    const sectionItems = Array.isArray(targetSection == null ? void 0 : targetSection.items) ? targetSection.items : [];
    const nextSectionItems = withToggledContainer(sectionItems, [
      sectionLocator.itemIndex,
      ...(_b = sectionLocator.subPath) != null ? _b : []
    ]);
    if (!nextSectionItems) return;
    const nextSections = sections.map(
      (section, idx) => idx === sectionLocator.sectionIndex ? { ...section, items: nextSectionItems } : section
    );
    void patchForeignBlock(provenance.path, "item", "container", "sections", nextSections);
  }
  function withToggledContainer(items, path) {
    const [head, ...rest] = path;
    if (head == null || head < 0 || head >= items.length) return null;
    const original = items[head];
    let cloned;
    if (typeof original === "string") {
      cloned = { name: original };
    } else if (original && typeof original === "object") {
      cloned = { ...original };
    } else {
      return null;
    }
    if (rest.length === 0) {
      if (cloned.for_sale) delete cloned.for_sale;
      else cloned.for_sale = true;
    } else {
      if (!Array.isArray(cloned.contents)) return null;
      const updated = withToggledContainer(cloned.contents, rest);
      if (!updated) return null;
      cloned.contents = updated;
    }
    const next = items.slice();
    next[head] = cloned;
    return next;
  }
  function toInventoryItemEntry(source) {
    if (typeof source === "string") return { name: source };
    if (!source || typeof source !== "object") return null;
    const o = source;
    if (typeof o.name !== "string") return null;
    const out = { name: o.name };
    if (typeof o.qty === "number") out.qty = o.qty;
    if (typeof o.notes === "string") out.notes = o.notes;
    if (o.for_sale === true) out.for_sale = true;
    if (Array.isArray(o.contents)) {
      out.contents = o.contents.map(toInventoryItemEntry).filter((e) => e !== null);
    }
    return out;
  }
  function normaliseItems(raw) {
    const out = [];
    for (const entry of raw) {
      const normalised = normaliseItem(entry);
      if (normalised) out.push(normalised);
    }
    return out;
  }
  function normaliseItem(raw) {
    if (typeof raw === "string") return { name: raw };
    if (!raw || typeof raw !== "object") return null;
    const o = raw;
    let name = null;
    if (typeof o.name === "string") {
      name = o.name;
    } else if (Array.isArray(o.name)) {
      let v = o.name;
      while (Array.isArray(v)) v = v[0];
      if (typeof v === "string") name = `[[${v}]]`;
    }
    if (!name) return null;
    const entry = { name };
    if (typeof o.qty === "number") entry.qty = o.qty;
    else if (typeof o.quantity === "number") entry.qty = o.quantity;
    if (o.section === "weapons" || o.section === "armor" || o.section === "tools" || o.section === "visible" || o.section === "main_containers" || o.section === "other_containers") {
      entry.section = o.section;
    }
    if (o.container === "main" || o.container === "other") entry.container = o.container;
    if (o.slot === "main_hand" || o.slot === "off_hand" || o.slot === "armor" || o.slot === "shield" || o.slot === "attuned") {
      entry.slot = o.slot;
    }
    if (typeof o.equipped === "boolean") entry.equipped = o.equipped;
    if (typeof o.for_sale === "boolean") entry.for_sale = o.for_sale;
    if (typeof o.notes === "string") entry.notes = o.notes;
    if (Array.isArray(o.contents)) entry.contents = normaliseItems(o.contents);
    return entry;
  }
  function normaliseCurrency(raw) {
    if (!raw || typeof raw !== "object") return void 0;
    const o = raw;
    const out = {};
    const map = [
      ["pp", ["pp", "platinum"]],
      ["gp", ["gp", "gold"]],
      ["ep", ["ep", "electrum"]],
      ["sp", ["sp", "silver"]],
      ["cp", ["cp", "copper"]]
    ];
    for (const [target, aliases] of map) {
      for (const k of aliases) {
        const v = o[k];
        if (typeof v === "number") {
          out[target] = v;
          break;
        }
      }
    }
    return Object.keys(out).length > 0 ? out : void 0;
  }
  function resolveStrength(self, blocks, _expressions) {
    var _a, _b;
    const override = (_a = self.encumbrance) == null ? void 0 : _a.strength;
    if (typeof override === "number") return override;
    const stats2 = (_b = blocks == null ? void 0 : blocks.stats) != null ? _b : {};
    const cell = stats2.STR;
    if (typeof cell === "number") return cell;
    if (cell && typeof cell === "object" && typeof cell.value === "number") {
      return cell.value;
    }
    return 10;
  }
  var inventory_default = inventory;
  function toggleEquip(items, target, lookup) {
    const targetIdx = parseInt(target.id, 10);
    if (Number.isNaN(targetIdx) || targetIdx < 0 || targetIdx >= items.length) {
      return items;
    }
    const next = items.map((it) => ({ ...it }));
    const entry = next[targetIdx];
    const wasEquipped = entry.equipped === true || entry.slot !== void 0;
    if (wasEquipped) {
      delete entry.slot;
      delete entry.equipped;
      return next;
    }
    const kind = target.equipKind;
    if (kind === "weapon") {
      const isTwoHanded = weaponIsTwoHanded(target, lookup);
      clearSlot(next, "main_hand");
      if (isTwoHanded) clearSlot(next, "off_hand");
      entry.slot = "main_hand";
    } else if (kind === "armor") {
      clearSlot(next, "armor");
      entry.slot = "armor";
    } else {
      entry.equipped = true;
    }
    return next;
  }
  function clearSlot(items, slot) {
    for (const it of items) {
      if (it.slot === slot) delete it.slot;
    }
  }
  function toggleForSale(items, target) {
    const path = target.id.split(".").map((s) => parseInt(s, 10));
    if (path.some((n) => Number.isNaN(n) || n < 0)) return items;
    return withToggled(items, path);
  }
  function withToggled(items, path) {
    const [head, ...rest] = path;
    if (head == null || head >= items.length) return items;
    const next = items.map((it) => ({ ...it }));
    const entry = next[head];
    if (rest.length === 0) {
      if (entry.for_sale) delete entry.for_sale;
      else entry.for_sale = true;
      return next;
    }
    if (!Array.isArray(entry.contents)) return items;
    entry.contents = withToggled(entry.contents, rest);
    return next;
  }
  function weaponIsTwoHanded(item2, lookup) {
    const props = item2.meta.properties;
    if (props && props.some(isTwoHandedToken)) return true;
    if (!item2.linkTarget) return false;
    const fm = lookup(item2.linkTarget);
    const weapon = fm && typeof fm === "object" ? fm.weapon : void 0;
    if (!weapon || typeof weapon !== "object") return false;
    const wp = weapon.properties;
    return Array.isArray(wp) && wp.some((p) => typeof p === "string" && isTwoHandedToken(p));
  }
  function isTwoHandedToken(raw) {
    const bare = raw.replace(/^\[\[/, "").replace(/\]\]$/, "").split("|")[0].toLowerCase();
    return bare === "two-handed" || bare === "twohanded";
  }
  function wikiStem3(raw) {
    if (!raw) return "";
    const m = raw.match(/^\[\[(.+?)\]\]$/);
    const inner = m ? m[1] : raw;
    return inner.split("|")[0].split("/").pop().trim();
  }
  function resolveAttunement(items, personalByName, blocks, lookup) {
    var _a, _b, _c;
    let active = 0;
    for (const entry of items) {
      const stem = wikiStem3(entry.name);
      const personal2 = personalByName[stem];
      if (personal2 == null ? void 0 : personal2.attuned) active++;
    }
    let capBonus = 0;
    try {
      const header2 = blocks == null ? void 0 : blocks.header;
      const features2 = blocks == null ? void 0 : blocks.features;
      const view = (_a = lookup == null ? void 0 : lookup.$features) == null ? void 0 : _a.call(lookup, header2, features2 == null ? void 0 : features2.choices, features2 == null ? void 0 : features2.additional);
      const values = (_c = (_b = view == null ? void 0 : view.traits) == null ? void 0 : _b["Attunement C."]) != null ? _c : [];
      for (const raw of values) {
        const n = parseInt(String(raw).replace(/^\+/, ""), 10);
        if (Number.isFinite(n)) capBonus += n;
      }
    } catch (e) {
    }
    return { active, cap: 3 + capBonus };
  }

  // vault:tales-of-the-valiant/config/blocks/character/sheet.tsx
  var React11 = __toESM(__require("react"));
  var sheet = (ctx) => {
    var _a;
    const syntheticBlocks = {
      ...(_a = ctx.blocks) != null ? _a : {},
      header: ctx.self,
      health: ctx.self,
      stats: ctx.self,
      senses: ctx.self,
      skills: ctx.self,
      rolls: ctx.self,
      proficiencies: ctx.self
    };
    const subCtx = { ...ctx, blocks: syntheticBlocks };
    return /* @__PURE__ */ React11.createElement("div", { className: "rpg-character-sheet" }, header(subCtx), health(subCtx), stats(subCtx), senses(subCtx), skills(subCtx), rolls_default(subCtx), proficiencies(subCtx));
  };
  var sheet_default = sheet;

  // vault:tales-of-the-valiant/config/blocks/character/description.tsx
  var React12 = __toESM(__require("react"));
  var import_obsidian2 = __require("obsidian");
  var import_rpg_ui_toolkit10 = __require("rpg-ui-toolkit");
  function usePersistentTab(key, defaultIndex) {
    const storageKey = `rpg-ui:tab:${key}`;
    const [index, setIndex] = React12.useState(() => {
      try {
        if (typeof localStorage === "undefined") return defaultIndex;
        const stored = localStorage.getItem(storageKey);
        if (stored == null) return defaultIndex;
        const n = Number(stored);
        return Number.isFinite(n) ? n : defaultIndex;
      } catch (e) {
        return defaultIndex;
      }
    });
    const update = React12.useCallback(
      (next) => {
        setIndex(next);
        try {
          localStorage.setItem(storageKey, String(next));
        } catch (e) {
        }
      },
      [storageKey]
    );
    return [index, update];
  }
  function useNoteKey4() {
    return React12.useMemo(() => {
      var _a, _b, _c, _d;
      const app = globalThis.app;
      return (_d = (_c = (_b = (_a = app == null ? void 0 : app.workspace) == null ? void 0 : _a.getActiveFile) == null ? void 0 : _b.call(_a)) == null ? void 0 : _c.path) != null ? _d : "default";
    }, []);
  }
  function flattenToString(v) {
    let cur = v;
    while (Array.isArray(cur)) cur = cur[0];
    return typeof cur === "string" ? cur : "";
  }
  function visibleLabel(raw) {
    const m = raw.match(/^\[\[([^\]]+)\]\]$/);
    if (!m) return raw;
    const inner = m[1];
    const pipe = inner.indexOf("|");
    return (pipe >= 0 ? inner.slice(pipe + 1) : inner).trim();
  }
  var VALID_FITS = /* @__PURE__ */ new Set(["cover", "contain", "width", "height"]);
  function resolveArt(raw) {
    if (raw != null && typeof raw === "object" && !Array.isArray(raw) && "src" in raw && !("link" in raw) && !("path" in raw) && !("file" in raw)) {
      const obj = raw;
      const rawFit = typeof obj.fit === "string" ? obj.fit.toLowerCase() : "cover";
      const fit = VALID_FITS.has(rawFit) ? rawFit : "cover";
      const align = typeof obj.align === "string" && obj.align.trim() ? obj.align.trim().toLowerCase() : fit === "cover" ? "top center" : "center";
      return { src: obj.src, fit, align };
    }
    return { src: raw, fit: "cover", align: "top center" };
  }
  function resolveObjectPosition(fit, align) {
    const s = align.toLowerCase().trim();
    if (fit === "cover" || fit === "contain") {
      return s || "center";
    }
    if (fit === "width") {
      const y = /top/.test(s) ? "top" : /bottom/.test(s) ? "bottom" : "center";
      return `center ${y}`;
    }
    const x = /left/.test(s) ? "left" : /right/.test(s) ? "right" : "center";
    return `${x} center`;
  }
  function buildImagePrompt(appearance) {
    var _a, _b, _c;
    if (!appearance) return "";
    const flat = {};
    for (const row of (_a = appearance.side_props) != null ? _a : []) {
      for (const [k, v] of Object.entries(row)) {
        if (v == null || v === "") continue;
        flat[k.toLowerCase()] = String(v);
      }
    }
    const bits = ["Photorealistic portrait."];
    if (flat.age) bits.push(`Age ${flat.age}.`);
    const sizePieces = [];
    if (flat.height) sizePieces.push(`height ${flat.height}`);
    if (flat.weight) sizePieces.push(`weight ${flat.weight}`);
    if (sizePieces.length > 0) bits.push(`${sizePieces.join(", ")}.`);
    const lookPieces = [];
    if (flat.eyes) lookPieces.push(`${flat.eyes} eyes`);
    if (flat.skin) lookPieces.push(`${flat.skin} skin`);
    if (flat.hair) lookPieces.push(`${flat.hair} hair`);
    if (lookPieces.length > 0) {
      const [first, ...rest] = lookPieces;
      const cap = first.charAt(0).toUpperCase() + first.slice(1);
      bits.push(rest.length > 0 ? `${cap}, ${rest.join(", ")}.` : `${cap}.`);
    }
    const knownKeys = /* @__PURE__ */ new Set(["age", "height", "weight", "eyes", "skin", "hair"]);
    for (const [k, v] of Object.entries(flat)) {
      if (knownKeys.has(k)) continue;
      bits.push(`${k.charAt(0).toUpperCase()}${k.slice(1)}: ${v}.`);
    }
    const body = ((_b = appearance.body) != null ? _b : "").trim();
    const clothes = ((_c = appearance.clothes) != null ? _c : "").trim();
    if (body) bits.push(body.endsWith(".") ? body : `${body}.`);
    if (clothes) bits.push(clothes.endsWith(".") ? clothes : `${clothes}.`);
    return bits.join(" ");
  }
  function copyPromptToClipboard(prompt) {
    if (!prompt) {
      new import_obsidian2.Notice("Nothing to copy \u2014 appearance is empty");
      return;
    }
    const write = () => {
      var _a;
      if ((_a = navigator == null ? void 0 : navigator.clipboard) == null ? void 0 : _a.writeText) {
        return navigator.clipboard.writeText(prompt);
      }
      const ta = document.createElement("textarea");
      ta.value = prompt;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } finally {
        document.body.removeChild(ta);
      }
      return Promise.resolve();
    };
    write().then(() => new import_obsidian2.Notice("Image prompt copied")).catch(() => new import_obsidian2.Notice("Failed to copy prompt"));
  }
  function upperLabel(key) {
    return key.replace(/_/g, " ").toUpperCase();
  }
  function SidePropsGrid({ rows }) {
    if (rows.length === 0) return null;
    const filtered = rows.map((row) => Object.entries(row).filter(([, v]) => v != null && v !== "")).filter((entries) => entries.length > 0);
    if (filtered.length === 0) return null;
    const maxCols = Math.max(...filtered.map((r) => r.length));
    return /* @__PURE__ */ React12.createElement("div", { className: "rpg-description-sideprops" }, /* @__PURE__ */ React12.createElement("table", { className: "rpg-description-sideprops-row" }, /* @__PURE__ */ React12.createElement("tbody", null, filtered.flatMap((entries, i) => {
      const pad = maxCols - entries.length;
      const keyRow = /* @__PURE__ */ React12.createElement("tr", { key: `k-${i}`, className: "rpg-description-sideprops-keys" }, entries.map(([k]) => /* @__PURE__ */ React12.createElement("th", { key: k, scope: "col" }, upperLabel(k))), Array.from({ length: pad }, (_, j) => /* @__PURE__ */ React12.createElement("th", { key: `pad-k-${j}`, "aria-hidden": "true" })));
      const valueRow = /* @__PURE__ */ React12.createElement("tr", { key: `v-${i}`, className: "rpg-description-sideprops-values" }, entries.map(([k, v]) => /* @__PURE__ */ React12.createElement("td", { key: k }, String(v))), Array.from({ length: pad }, (_, j) => /* @__PURE__ */ React12.createElement("td", { key: `pad-v-${j}`, "aria-hidden": "true" })));
      return [keyRow, valueRow];
    }))));
  }
  function AppearanceTab({ appearance, sourcePath }) {
    var _a, _b;
    const prompt = React12.useMemo(() => buildImagePrompt(appearance), [appearance]);
    const isEmpty = !appearance || !appearance.body && !appearance.clothes && !appearance.art && ((_a = appearance.side_props) != null ? _a : []).length === 0;
    if (isEmpty) return /* @__PURE__ */ React12.createElement(EmptyPanel, { hint: "No appearance notes yet." });
    const { src: artSrc, fit: artFit, align: artAlign } = resolveArt(appearance == null ? void 0 : appearance.art);
    const artPosition = resolveObjectPosition(artFit, artAlign);
    const artStyle = {
      ["--rpg-art-position"]: artPosition
    };
    return /* @__PURE__ */ React12.createElement("div", { className: "rpg-description-appearance" }, /* @__PURE__ */ React12.createElement("figure", { className: "rpg-description-appearance-art", "data-fit": artFit, style: artStyle, "aria-label": "Character art" }, /* @__PURE__ */ React12.createElement(import_rpg_ui_toolkit10.PortraitThumb, { src: artSrc, alt: "Character art" })), /* @__PURE__ */ React12.createElement("div", { className: "rpg-description-appearance-body" }, /* @__PURE__ */ React12.createElement(SidePropsGrid, { rows: (_b = appearance == null ? void 0 : appearance.side_props) != null ? _b : [] }), (appearance == null ? void 0 : appearance.body) && /* @__PURE__ */ React12.createElement("section", { "aria-label": "Body description" }, /* @__PURE__ */ React12.createElement("header", { className: "rpg-tag-heading" }, /* @__PURE__ */ React12.createElement("span", null, "Body")), /* @__PURE__ */ React12.createElement(import_rpg_ui_toolkit10.Markdown, { source: appearance.body, sourcePath })), (appearance == null ? void 0 : appearance.clothes) && /* @__PURE__ */ React12.createElement("section", { "aria-label": "Clothes description" }, /* @__PURE__ */ React12.createElement("header", { className: "rpg-tag-heading" }, /* @__PURE__ */ React12.createElement("span", null, "Attire")), /* @__PURE__ */ React12.createElement(import_rpg_ui_toolkit10.Markdown, { source: appearance.clothes, sourcePath })), /* @__PURE__ */ React12.createElement("footer", { className: "rpg-description-appearance-actions" }, /* @__PURE__ */ React12.createElement(
      "button",
      {
        type: "button",
        className: "rpg-description-copy-prompt",
        onClick: () => copyPromptToClipboard(prompt),
        "aria-label": "Copy image prompt to clipboard",
        "data-tip": "Copy image prompt"
      },
      /* @__PURE__ */ React12.createElement("svg", { viewBox: "0 0 14 14", "aria-hidden": "true", focusable: "false" }, /* @__PURE__ */ React12.createElement("rect", { x: "4.25", y: "4.25", width: "7", height: "7", rx: "1" }), /* @__PURE__ */ React12.createElement("path", { d: "M2.75 2.75 H9 V4.25 M2.75 2.75 V9 H4.25" }))
    ))));
  }
  function HighlightsList({ highlights, sourcePath }) {
    if (highlights.length === 0) return null;
    return /* @__PURE__ */ React12.createElement("dl", { className: "rpg-description-highlights", "aria-label": "Story highlights" }, highlights.map((h, i) => {
      var _a, _b;
      if (h.footnote) {
        return /* @__PURE__ */ React12.createElement("div", { key: i, className: "rpg-description-highlight rpg-description-highlight-footnote" }, /* @__PURE__ */ React12.createElement("dd", null, /* @__PURE__ */ React12.createElement(import_rpg_ui_toolkit10.Markdown, { source: h.footnote, sourcePath })));
      }
      return /* @__PURE__ */ React12.createElement("div", { key: i, className: "rpg-description-highlight" }, /* @__PURE__ */ React12.createElement("dt", null, (_a = h.key) != null ? _a : ""), /* @__PURE__ */ React12.createElement("dd", null, /* @__PURE__ */ React12.createElement(import_rpg_ui_toolkit10.Markdown, { source: (_b = h.value) != null ? _b : "", sourcePath })));
    }));
  }
  function BackstoryTab({ backstory, sourcePath }) {
    var _a, _b;
    const isEmpty = !backstory || !backstory.text && !backstory.homeland && ((_a = backstory.highlights) != null ? _a : []).length === 0;
    if (isEmpty) return /* @__PURE__ */ React12.createElement(EmptyPanel, { hint: "No backstory written yet." });
    const homelandRaw = flattenToString(backstory == null ? void 0 : backstory.homeland);
    return /* @__PURE__ */ React12.createElement("div", { className: "rpg-description-backstory" }, (homelandRaw || (backstory == null ? void 0 : backstory.text)) && /* @__PURE__ */ React12.createElement("article", { className: "rpg-description-story", "aria-label": "Character backstory" }, homelandRaw && /* @__PURE__ */ React12.createElement("header", { className: "rpg-tag-heading rpg-description-story-ribbon" }, /* @__PURE__ */ React12.createElement("span", null, /* @__PURE__ */ React12.createElement("small", null, "Homeland"), /* @__PURE__ */ React12.createElement(import_rpg_ui_toolkit10.Markdown, { source: homelandRaw, sourcePath }))), (backstory == null ? void 0 : backstory.text) && /* @__PURE__ */ React12.createElement("div", { className: "rpg-description-story-scroll" }, /* @__PURE__ */ React12.createElement(import_rpg_ui_toolkit10.Markdown, { source: backstory.text, sourcePath }))), /* @__PURE__ */ React12.createElement(HighlightsList, { highlights: (_b = backstory == null ? void 0 : backstory.highlights) != null ? _b : [], sourcePath }));
  }
  function looksLikeWikilink(raw) {
    if (raw == null) return false;
    if (Array.isArray(raw)) {
      for (const v of raw) if (looksLikeWikilink(v)) return true;
      return false;
    }
    if (typeof raw === "string") return /^!?\[\[/.test(raw.trim());
    if (typeof raw === "object") {
      const obj = raw;
      return obj.link != null || obj.path != null || obj.file != null || obj.src != null;
    }
    return false;
  }
  function IconGlyph({ name }) {
    const ref = React12.useRef(null);
    React12.useEffect(() => {
      if (!ref.current) return;
      ref.current.empty();
      try {
        (0, import_obsidian2.setIcon)(ref.current, name);
      } catch (e) {
        ref.current.textContent = name;
      }
    }, [name]);
    return /* @__PURE__ */ React12.createElement("span", { ref, className: "rpg-description-ribbon-glyph", "aria-hidden": "true" });
  }
  function TextGlyph({ text }) {
    return /* @__PURE__ */ React12.createElement("span", { className: "rpg-description-ribbon-glyph", "aria-hidden": "true" }, text);
  }
  function RibbonPortrait({ src, label }) {
    if (src == null) return null;
    if (typeof src === "string") {
      const trimmed = src.trim();
      if (trimmed.startsWith("icon:")) {
        return /* @__PURE__ */ React12.createElement(IconGlyph, { name: trimmed.slice(5).trim() });
      }
      if (!looksLikeWikilink(trimmed) && trimmed.length <= 4) {
        return /* @__PURE__ */ React12.createElement(TextGlyph, { text: trimmed });
      }
    }
    return /* @__PURE__ */ React12.createElement(import_rpg_ui_toolkit10.PortraitThumb, { src, alt: label });
  }
  function RibbonRow({
    entry,
    variant,
    sourcePath,
    footer
  }) {
    const portraitSrc = entry.portrait;
    const hasPortrait = portraitSrc != null && portraitSrc !== "";
    const label = visibleLabel(entry.name);
    return /* @__PURE__ */ React12.createElement("li", { className: `rpg-description-ribbon rpg-description-ribbon-${variant}` }, /* @__PURE__ */ React12.createElement("aside", { className: "rpg-description-ribbon-side", "data-has-portrait": hasPortrait || void 0 }, hasPortrait && /* @__PURE__ */ React12.createElement("figure", { className: "rpg-description-ribbon-portrait" }, /* @__PURE__ */ React12.createElement(RibbonPortrait, { src: portraitSrc, label })), /* @__PURE__ */ React12.createElement("header", { className: "rpg-tag-heading rpg-description-ribbon-name" }, /* @__PURE__ */ React12.createElement("span", null, /* @__PURE__ */ React12.createElement(import_rpg_ui_toolkit10.Markdown, { source: entry.name, sourcePath }))), entry.role && /* @__PURE__ */ React12.createElement("small", { className: "rpg-description-ribbon-role" }, entry.role)), entry.text && /* @__PURE__ */ React12.createElement("div", { className: "rpg-description-ribbon-body" }, /* @__PURE__ */ React12.createElement(import_rpg_ui_toolkit10.Markdown, { source: entry.text, sourcePath })), footer);
  }
  function AlliesEnemiesTab({
    allies,
    enemies,
    sourcePath
  }) {
    if (allies.length === 0 && enemies.length === 0) {
      return /* @__PURE__ */ React12.createElement(EmptyPanel, { hint: "No allies or enemies logged yet." });
    }
    return /* @__PURE__ */ React12.createElement("div", { className: "rpg-description-side-by-side" }, /* @__PURE__ */ React12.createElement("article", { className: "rpg-description-column", "data-kind": "allies" }, /* @__PURE__ */ React12.createElement("header", { className: "rpg-tag-heading" }, /* @__PURE__ */ React12.createElement("span", null, "Allies")), allies.length === 0 ? /* @__PURE__ */ React12.createElement("p", { className: "rpg-description-column-empty" }, "None recorded.") : /* @__PURE__ */ React12.createElement("ul", { className: "rpg-description-ribbon-list" }, allies.map((a, i) => /* @__PURE__ */ React12.createElement(RibbonRow, { key: i, entry: a, variant: "compact", sourcePath })))), /* @__PURE__ */ React12.createElement("article", { className: "rpg-description-column", "data-kind": "enemies" }, /* @__PURE__ */ React12.createElement("header", { className: "rpg-tag-heading" }, /* @__PURE__ */ React12.createElement("span", null, "Enemies")), enemies.length === 0 ? /* @__PURE__ */ React12.createElement("p", { className: "rpg-description-column-empty" }, "None recorded.") : /* @__PURE__ */ React12.createElement("ul", { className: "rpg-description-ribbon-list" }, enemies.map((e, i) => /* @__PURE__ */ React12.createElement(RibbonRow, { key: i, entry: e, variant: "compact", sourcePath })))));
  }
  function OrganizationsTab({ organizations, sourcePath }) {
    if (organizations.length === 0) {
      return /* @__PURE__ */ React12.createElement(EmptyPanel, { hint: "No organizations linked yet." });
    }
    return /* @__PURE__ */ React12.createElement("ul", { className: "rpg-description-ribbon-list rpg-description-organizations" }, organizations.map((o, i) => /* @__PURE__ */ React12.createElement(
      RibbonRow,
      {
        key: i,
        entry: o,
        variant: "compact",
        sourcePath,
        footer: o.position ? /* @__PURE__ */ React12.createElement("footer", { className: "rpg-description-org-position" }, /* @__PURE__ */ React12.createElement("span", { className: "rpg-description-meta-label" }, "Position"), /* @__PURE__ */ React12.createElement("span", { className: "rpg-description-meta-value" }, /* @__PURE__ */ React12.createElement(import_rpg_ui_toolkit10.Markdown, { source: o.position, sourcePath }))) : null
      }
    )));
  }
  function MotivationTab({ cards, sourcePath }) {
    if (cards.length === 0) {
      return /* @__PURE__ */ React12.createElement(EmptyPanel, { hint: "No motivations written yet." });
    }
    return /* @__PURE__ */ React12.createElement("div", { className: "rpg-description-motivation", "data-count": cards.length, "aria-label": "Character motivations" }, cards.map((card, i) => {
      const style = card.color ? { ["--rpg-card-accent"]: card.color } : void 0;
      return /* @__PURE__ */ React12.createElement("figure", { key: i, className: "rpg-description-motivation-card", style, "data-index": i }, /* @__PURE__ */ React12.createElement("blockquote", null, /* @__PURE__ */ React12.createElement(import_rpg_ui_toolkit10.Markdown, { source: card.text, sourcePath })));
    }));
  }
  function EmptyPanel({ hint }) {
    return /* @__PURE__ */ React12.createElement("p", { className: "rpg-description-empty", "aria-details": "Empty Tab" }, /* @__PURE__ */ React12.createElement("em", null, hint));
  }
  var description = ({ self }) => {
    const sourcePath = React12.useMemo(() => {
      var _a, _b, _c, _d;
      const app = globalThis.app;
      return (_d = (_c = (_b = (_a = app == null ? void 0 : app.workspace) == null ? void 0 : _a.getActiveFile) == null ? void 0 : _b.call(_a)) == null ? void 0 : _c.path) != null ? _d : "";
    }, []);
    const noteKey = useNoteKey4();
    const tabs = React12.useMemo(
      () => [
        {
          id: "appearance",
          label: "Appearance",
          render: () => /* @__PURE__ */ React12.createElement(AppearanceTab, { appearance: self.appearance, sourcePath })
        },
        {
          id: "backstory",
          label: "Backstory",
          render: () => /* @__PURE__ */ React12.createElement(BackstoryTab, { backstory: self.backstory, sourcePath })
        },
        {
          id: "allies-enemies",
          label: "Allies & Enemies",
          render: () => {
            var _a, _b;
            return /* @__PURE__ */ React12.createElement(AlliesEnemiesTab, { allies: (_a = self.allies) != null ? _a : [], enemies: (_b = self.enemies) != null ? _b : [], sourcePath });
          }
        },
        {
          id: "organizations",
          label: "Organizations",
          render: () => {
            var _a;
            return /* @__PURE__ */ React12.createElement(OrganizationsTab, { organizations: (_a = self.organizations) != null ? _a : [], sourcePath });
          }
        },
        {
          id: "motivation",
          label: "Motivation",
          render: () => {
            var _a;
            return /* @__PURE__ */ React12.createElement(MotivationTab, { cards: (_a = self.motivation) != null ? _a : [], sourcePath });
          }
        }
      ],
      [self, sourcePath]
    );
    const [activeIndex, setActiveIndex] = usePersistentTab(`${noteKey}:description`, 0);
    const clampedIndex = Math.max(0, Math.min(activeIndex, tabs.length - 1));
    const active = tabs[clampedIndex];
    const panelRef = React12.useRef(null);
    const scrollByTabRef = React12.useRef(/* @__PURE__ */ new Map());
    const onSelectTab = React12.useCallback(
      (next) => {
        if (next === clampedIndex) return;
        if (panelRef.current) {
          scrollByTabRef.current.set(clampedIndex, panelRef.current.scrollTop);
        }
        setActiveIndex(next);
      },
      [clampedIndex, setActiveIndex]
    );
    React12.useEffect(() => {
      var _a;
      const el = panelRef.current;
      if (!el) return;
      const saved = (_a = scrollByTabRef.current.get(clampedIndex)) != null ? _a : 0;
      const raf = requestAnimationFrame(() => {
        if (panelRef.current) panelRef.current.scrollTop = saved;
      });
      return () => cancelAnimationFrame(raf);
    }, [clampedIndex]);
    const onKeyDown = (e) => {
      let next = null;
      if (e.key === "ArrowRight") next = (clampedIndex + 1) % tabs.length;
      else if (e.key === "ArrowLeft") next = (clampedIndex - 1 + tabs.length) % tabs.length;
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = tabs.length - 1;
      if (next != null) {
        e.preventDefault();
        onSelectTab(next);
      }
    };
    return /* @__PURE__ */ React12.createElement("section", { "aria-details": "Character Description", className: "rpg-description-block" }, /* @__PURE__ */ React12.createElement(
      "menu",
      {
        role: "tablist",
        "aria-label": "Character description tabs",
        className: "rpg-description-tablist",
        onKeyDown
      },
      tabs.map((tab, i) => {
        const selected = i === clampedIndex;
        return /* @__PURE__ */ React12.createElement("li", { key: tab.id, className: "rpg-description-tab-item", role: "none" }, /* @__PURE__ */ React12.createElement(
          "button",
          {
            type: "button",
            role: "tab",
            id: `rpg-description-tab-${tab.id}`,
            "aria-selected": selected,
            "aria-controls": `rpg-description-panel-${tab.id}`,
            tabIndex: selected ? 0 : -1,
            className: "rpg-description-tab",
            "data-active": selected || void 0,
            onClick: () => onSelectTab(i)
          },
          /* @__PURE__ */ React12.createElement("span", null, tab.label)
        ));
      })
    ), /* @__PURE__ */ React12.createElement(
      "div",
      {
        ref: panelRef,
        role: "tabpanel",
        id: `rpg-description-panel-${active.id}`,
        "aria-labelledby": `rpg-description-tab-${active.id}`,
        className: "rpg-description-panel",
        "data-tab": active.id
      },
      active.render()
    ));
  };
  var description_default = description;

  // vault:tales-of-the-valiant/config/entities/character.tsx
  var character = (0, import_rpg_ui_toolkit11.CreateEntity)(async ({ wiki }) => {
    const [
      classDocs,
      subclassDocs,
      lineageDocs,
      heritageDocs,
      backgroundDocs,
      skillDocs,
      languageDocs,
      actionDocs,
      reactionDocs,
      bonusActionDocs,
      talentDocs
    ] = await Promise.all([
      wiki.folder("worldbuilding/traits/classes"),
      wiki.folder("worldbuilding/traits/subclasses"),
      wiki.folder("worldbuilding/traits/lineages"),
      wiki.folder("worldbuilding/traits/heritages"),
      wiki.folder("worldbuilding/traits/backgrounds"),
      wiki.folder("glossary/skills"),
      wiki.folder("worldbuilding/traits/languages"),
      wiki.folder("glossary/actions"),
      wiki.folder("glossary/reactions"),
      wiki.folder("glossary/bonus-actions"),
      wiki.folder("worldbuilding/traits/talents")
    ]);
    const refPaths = /* @__PURE__ */ new Set();
    const refRe = /@([A-Za-z0-9][A-Za-z0-9/_\-]*)/g;
    const scanForRefs = (text) => {
      if (!text) return;
      for (const m of text.matchAll(refRe)) {
        const p = m[1].replace(/\/+$/, "");
        if (p) refPaths.add(p);
      }
    };
    for (const d of [
      ...classDocs != null ? classDocs : [],
      ...subclassDocs != null ? subclassDocs : [],
      ...lineageDocs != null ? lineageDocs : [],
      ...heritageDocs != null ? heritageDocs : [],
      ...backgroundDocs != null ? backgroundDocs : [],
      ...talentDocs != null ? talentDocs : []
    ]) {
      scanForRefs(typeof (d == null ? void 0 : d.$contents) === "string" ? d.$contents : "");
    }
    refPaths.add("worldbuilding/spells");
    refPaths.add("worldbuilding/items");
    refPaths.add("worldbuilding/magic-items");
    refPaths.add("worldbuilding/containers");
    refPaths.add("adventurers");
    const refLoads = await Promise.all(
      [...refPaths].map(async (p) => {
        var _a;
        try {
          const docs = (_a = await wiki.folder(p)) != null ? _a : [];
          return { path: p, docs };
        } catch (e) {
          return { path: p, docs: [] };
        }
      })
    );
    const parentPaths = /* @__PURE__ */ new Set();
    for (const { docs } of refLoads) {
      if (!docs || docs.length === 0) continue;
      const dirs = docs.map((d) => {
        var _a;
        const p = (_a = d == null ? void 0 : d.$path) != null ? _a : "";
        return p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "";
      }).filter(Boolean);
      if (dirs.length === 0) continue;
      let common = dirs[0];
      for (const d of dirs) {
        while (d !== common && !d.startsWith(common + "/")) {
          const s = common.lastIndexOf("/");
          if (s < 0) {
            common = "";
            break;
          }
          common = common.slice(0, s);
        }
        if (!common) break;
      }
      if (!common) continue;
      const parent = common.includes("/") ? common.slice(0, common.lastIndexOf("/")) : "";
      if (parent && !refPaths.has(parent)) parentPaths.add(parent);
    }
    const parentLoads = await Promise.all(
      [...parentPaths].map(async (p) => {
        var _a;
        try {
          const docs = (_a = await wiki.folder(p)) != null ? _a : [];
          return { path: p, docs };
        } catch (e) {
          return { path: p, docs: [] };
        }
      })
    );
    const refDocs = [...refLoads.flatMap((r) => {
      var _a;
      return (_a = r.docs) != null ? _a : [];
    }), ...parentLoads.flatMap((r) => {
      var _a;
      return (_a = r.docs) != null ? _a : [];
    })];
    const indexDocs = [];
    const extraTagsFor = (d) => {
      if (!d || typeof d !== "object") return [];
      const out = [];
      const contents = typeof d.$contents === "string" ? d.$contents : "";
      if (!contents) return out;
      const blocks = (0, import_rpg_ui_toolkit11.extractSpellBlocks)(contents);
      for (const block of blocks) {
        const magics = [];
        const sources = Array.isArray(block.source) ? block.source : [];
        for (const raw of sources) {
          let v = raw;
          while (Array.isArray(v)) v = v[0];
          if (typeof v !== "string") continue;
          const stem = v.replace(/^\[\[/, "").replace(/\]\]$/, "").split("|")[0].trim();
          if (stem) {
            out.push(stem);
            magics.push(stem);
          }
        }
        let circle = "";
        if (typeof block.circle === "string" && block.circle.trim()) {
          circle = block.circle.trim();
          out.push(circle);
        }
        const kind = (0, import_rpg_ui_toolkit11.classifySpellCircle)(circle);
        if (kind) {
          out.push(kind);
          for (const magic2 of magics) {
            out.push(`${magic2}-${kind}`);
          }
        }
      }
      return out;
    };
    const indexedPaths = /* @__PURE__ */ new Set();
    const pushIndexDoc = (d) => {
      var _a, _b;
      const $path = (_a = d == null ? void 0 : d.$path) != null ? _a : "";
      if (!$path || indexedPaths.has($path)) return;
      indexedPaths.add($path);
      const frontmatterTags = Array.isArray(d == null ? void 0 : d.$tags) ? d.$tags.map((t) => t.replace(/^#/, "")) : [];
      const tags = [...frontmatterTags, ...extraTagsFor(d)];
      let parentDir = $path.includes("/") ? $path.slice(0, $path.lastIndexOf("/")) : "";
      while (parentDir) {
        let suffix = parentDir;
        while (suffix) {
          indexDocs.push({ $name: (_b = d == null ? void 0 : d.$name) != null ? _b : "", folder: suffix, tags });
          const slash = suffix.indexOf("/");
          if (slash < 0) break;
          suffix = suffix.slice(slash + 1);
        }
        const lastSlash = parentDir.lastIndexOf("/");
        if (lastSlash < 0) break;
        parentDir = parentDir.slice(0, lastSlash);
      }
    };
    for (const d of [...skillDocs != null ? skillDocs : [], ...languageDocs != null ? languageDocs : [], ...talentDocs != null ? talentDocs : [], ...refDocs]) {
      pushIndexDoc(d);
    }
    const { tagIndex, folderIndex } = (0, import_rpg_ui_toolkit11.buildCompendiumIndex)(indexDocs);
    const spellLibrary = {};
    for (const d of refDocs) {
      const name = d == null ? void 0 : d.$name;
      const contents = typeof (d == null ? void 0 : d.$contents) === "string" ? d.$contents : "";
      if (!name || !contents) continue;
      const blocks = (0, import_rpg_ui_toolkit11.extractSpellBlocks)(contents);
      if (blocks.length > 0 && !spellLibrary[name]) {
        spellLibrary[name] = blocks[0];
      }
    }
    const itemLibrary = {};
    const magicLibrary = {};
    const personalLibrary = {};
    const containerLibrary = {};
    const containerPathLibrary = {};
    for (const d of refDocs) {
      const name = d == null ? void 0 : d.$name;
      const $path = typeof (d == null ? void 0 : d.$path) === "string" ? d.$path : "";
      const contents = typeof (d == null ? void 0 : d.$contents) === "string" ? d.$contents : "";
      if (!name || !contents) continue;
      const isItemsFolder = $path.includes("worldbuilding/items/");
      const isMagicItemsFolder = $path.includes("worldbuilding/magic-items/");
      const isContainersFolder = $path.includes("worldbuilding/containers/");
      const isAdventurersFolder = $path.includes("adventurers/");
      if (!isItemsFolder && !isMagicItemsFolder && !isContainersFolder && !isAdventurersFolder) continue;
      if (isItemsFolder && !itemLibrary[name]) {
        const parsed = (0, import_rpg_ui_toolkit11.extractItemElementBlocks)(contents);
        if (parsed.length > 0) itemLibrary[name] = parsed[0];
      }
      if (!magicLibrary[name]) {
        const parsed = (0, import_rpg_ui_toolkit11.extractItemMagicBlocks)(contents);
        if (parsed.length > 0) magicLibrary[name] = parsed[0];
      }
      if (!personalLibrary[name]) {
        const parsed = (0, import_rpg_ui_toolkit11.extractItemPersonalBlocks)(contents);
        if (parsed.length > 0) personalLibrary[name] = parsed[0];
      }
      if (!containerLibrary[name]) {
        const parsed = (0, import_rpg_ui_toolkit11.extractItemContainerBlocks)(contents);
        if (parsed.length > 0) {
          containerLibrary[name] = parsed[0];
          if ($path) containerPathLibrary[name] = $path;
        }
      }
    }
    const compendium = {
      classes: (0, import_rpg_ui_toolkit11.parseSourceDocs)(classDocs != null ? classDocs : [], "class"),
      subclasses: (0, import_rpg_ui_toolkit11.parseSourceDocs)(subclassDocs != null ? subclassDocs : [], "subclass"),
      lineages: (0, import_rpg_ui_toolkit11.parseSourceDocs)(lineageDocs != null ? lineageDocs : [], "lineage"),
      heritages: (0, import_rpg_ui_toolkit11.parseSourceDocs)(heritageDocs != null ? heritageDocs : [], "heritage"),
      backgrounds: (0, import_rpg_ui_toolkit11.parseSourceDocs)(backgroundDocs != null ? backgroundDocs : [], "background"),
      talents: (0, import_rpg_ui_toolkit11.parseSourceDocs)(talentDocs != null ? talentDocs : [], "talent"),
      tagIndex,
      folderIndex
    };
    const DEBUG_INDEX = false;
    if (DEBUG_INDEX) {
      const sizeOf = (map) => {
        const out = {};
        for (const [k, v] of Object.entries(map)) out[k] = v.length;
        return out;
      };
      console.log("[RPG UI] referenced @folder paths:", [...refPaths]);
      console.log("[RPG UI] parent-walk loaded paths:", [...parentPaths]);
      console.log("[RPG UI] refDocs count:", refDocs.length);
      console.log("[RPG UI] folderIndex keys/counts:", sizeOf(folderIndex));
      console.log("[RPG UI] tagIndex keys/counts:", sizeOf(tagIndex));
      console.log("[RPG UI] spell library size:", Object.keys(spellLibrary).length);
      console.log("[RPG UI] spell library sample:", Object.keys(spellLibrary).slice(0, 20));
    }
    const toDefaultFeature = (type) => (d) => {
      var _a, _b;
      return {
        $name: (_a = d == null ? void 0 : d.$name) != null ? _a : "",
        $contents: (_b = d == null ? void 0 : d.$contents) != null ? _b : "",
        type
      };
    };
    const defaultFeatures = [
      ...(actionDocs != null ? actionDocs : []).map(toDefaultFeature("action")),
      ...(bonusActionDocs != null ? bonusActionDocs : []).map(toDefaultFeature("bonus")),
      ...(reactionDocs != null ? reactionDocs : []).map(toDefaultFeature("reaction"))
    ];
    const pillStem2 = (p) => {
      if (!(p == null ? void 0 : p.file)) return void 0;
      let raw = p.file;
      while (Array.isArray(raw)) raw = raw[0];
      if (typeof raw !== "string") return void 0;
      const stem = raw.replace(/^\[\[/, "").replace(/\]\]$/, "").replace(/\.md$/, "").trim();
      return stem || void 0;
    };
    const linkStem2 = (raw) => {
      let v = raw;
      while (Array.isArray(v)) v = v[0];
      if (typeof v !== "string") return void 0;
      const stem = v.replace(/^\[\[/, "").replace(/\]\]$/, "").replace(/\.md$/, "").split("|")[0].trim();
      return stem || void 0;
    };
    const collectEquippedPersonalTraits = (inventoryRaw) => {
      const merged = {};
      const bySource = [];
      if (!inventoryRaw || typeof inventoryRaw !== "object") return { merged, bySource };
      const items = inventoryRaw.items;
      if (!Array.isArray(items)) return { merged, bySource };
      const absorb = (source, traits) => {
        var _a, _b;
        const scoped = {};
        for (const [key, values] of Object.entries(traits)) {
          if (values.length === 0) continue;
          ((_a = merged[key]) != null ? _a : merged[key] = []).push(...values);
          ((_b = scoped[key]) != null ? _b : scoped[key] = []).push(...values);
        }
        if (Object.keys(scoped).length > 0) {
          bySource.push({ source, traits: scoped });
        }
      };
      const walk = (entry) => {
        var _a, _b, _c, _d;
        if (!entry || typeof entry !== "object") return;
        const o = entry;
        const rawName = typeof o.name === "string" ? o.name : Array.isArray(o.name) ? (() => {
          let v = o.name;
          while (Array.isArray(v)) v = v[0];
          return typeof v === "string" ? v : "";
        })() : "";
        const stem = (_a = rawName.replace(/^\[\[|\]\]$/g, "").split("|")[0].split("/").pop()) == null ? void 0 : _a.trim();
        if (stem) {
          const personal2 = personalLibrary[stem];
          if (personal2) {
            const resolution = (0, import_rpg_ui_toolkit11.resolvePersonalItem)(
              personal2,
              {
                elements: itemLibrary,
                magic: magicLibrary
              },
              stem
            );
            if (resolution) {
              const isShield = ((_b = resolution.effectiveElement.armor) == null ? void 0 : _b.category) === "Shield";
              const authored = o.equipped === true || typeof o.slot === "string";
              if (isShield || authored) {
                const personalName = personal2.name;
                const displayName = typeof personalName === "string" ? personalName : stem;
                const firstMagic = (_c = resolution.magicFeatureSources[0]) != null ? _c : displayName;
                absorb(firstMagic || displayName, resolution.traits);
              }
            }
          }
          const container2 = containerLibrary[stem];
          if (container2) {
            const resolution = (0, import_rpg_ui_toolkit11.resolveContainer)(
              container2,
              {
                elements: itemLibrary,
                magic: magicLibrary
              },
              stem
            );
            if (resolution) {
              const containerName = container2.name;
              const displayName = typeof containerName === "string" ? containerName : stem;
              const firstMagic = (_d = resolution.magicFeatureSources[0]) != null ? _d : displayName;
              absorb(firstMagic || displayName, resolution.traits);
            }
          }
        }
        if (Array.isArray(o.contents)) for (const c of o.contents) walk(c);
      };
      for (const it of items) walk(it);
      return { merged, bySource };
    };
    const featuresCache = /* @__PURE__ */ new Map();
    const $features = (header2, choices, additional, inventoryRaw) => {
      var _a, _b;
      const decl = {
        classes: ((_a = header2 == null ? void 0 : header2.classes) != null ? _a : []).map((c) => {
          var _a2, _b2;
          return {
            name: (_a2 = linkStem2(c.name)) != null ? _a2 : "",
            level: c.level,
            // Accept either `sub:` (terse alias for testing) or
            // `subclass:` (long form). `sub` wins when both are set.
            subclass: (_b2 = linkStem2(c.sub)) != null ? _b2 : linkStem2(c.subclass)
          };
        }),
        lineage: pillStem2(header2 == null ? void 0 : header2.lineage),
        heritage: pillStem2(header2 == null ? void 0 : header2.heritage),
        background: pillStem2(header2 == null ? void 0 : header2.background),
        choices,
        additional
      };
      const equipped = collectEquippedPersonalTraits(inventoryRaw);
      const key = JSON.stringify(decl) + "|" + JSON.stringify(equipped.bySource);
      const hit = featuresCache.get(key);
      if (hit) return hit;
      const baseView = (0, import_rpg_ui_toolkit11.resolveFeatures)(decl, compendium);
      const mergedTraits = {};
      for (const [k, v] of Object.entries(baseView.traits)) mergedTraits[k] = [...v];
      for (const [k, v] of Object.entries(equipped.merged)) {
        ((_b = mergedTraits[k]) != null ? _b : mergedTraits[k] = []).push(...v);
      }
      const extraSources = equipped.bySource.map((entry) => ({
        source: entry.source,
        kind: "item",
        features: [],
        pendingChoices: [],
        baseTraits: entry.traits,
        leveledTraits: {},
        traitsByLevel: {}
      }));
      const view = {
        ...baseView,
        traits: mergedTraits,
        sources: [...baseView.sources, ...extraSources]
      };
      if (featuresCache.size > 8) featuresCache.clear();
      featuresCache.set(key, view);
      return view;
    };
    return {
      lookup: {
        table: { xp: xpTable },
        $compendium: compendium,
        $defaultFeatures: defaultFeatures,
        $features,
        $spells: spellLibrary,
        $items: itemLibrary,
        $magic: magicLibrary,
        $personal: personalLibrary,
        $containers: containerLibrary,
        $containerPaths: containerPathLibrary
      },
      blocks: {
        header: header_default,
        health: health_default,
        stats: stats_default,
        senses: senses_default,
        skills: skills_default,
        rolls: rolls_default,
        proficiencies: proficiencies_default,
        features: features_default,
        spells: spells_default,
        inventory: inventory_default,
        sheet: sheet_default,
        description: description_default
      },
      features: defaultFeatures,
      expressions: {
        CharacterLevel: (_, { blocks }) => {
          var _a, _b;
          const header2 = (_a = blocks.header) != null ? _a : blocks.sheet;
          const classes = (_b = header2 == null ? void 0 : header2.classes) != null ? _b : [];
          return classes.map((c) => c.level).reduce((a, b) => a + b, 0);
        },
        ProficiencyBonus: (_, { expressions }) => {
          const level2 = expressions.CharacterLevel();
          return Math.floor((level2 - 1) / 4) + 2;
        },
        ModifierTotal: ([{ attribute, proficiency, bonus }], { blocks, lookup, expressions }) => {
          var _a, _b, _c, _d, _e, _f, _g;
          const statsSource = (_a = blocks.stats) != null ? _a : blocks.sheet;
          const cell = statsSource == null ? void 0 : statsSource[attribute];
          let attrValue = 10;
          if (typeof cell === "number") attrValue = cell;
          else if (cell && typeof cell === "object" && typeof cell.value === "number") {
            attrValue = cell.value;
          }
          const header2 = (_b = blocks.header) != null ? _b : blocks.sheet;
          const featuresBlock = (_c = blocks.features) != null ? _c : blocks.sheet;
          const asiTraits = (_g = (_f = (_e = (_d = lookup.$features) == null ? void 0 : _d.call(lookup, header2, featuresBlock == null ? void 0 : featuresBlock.choices, featuresBlock == null ? void 0 : featuresBlock.additional)) == null ? void 0 : _e.traits) == null ? void 0 : _f["Ability Scores"]) != null ? _g : [];
          const LONG = {
            STR: "STRENGTH",
            DEX: "DEXTERITY",
            CON: "CONSTITUTION",
            INT: "INTELLIGENCE",
            WIS: "WISDOM",
            CHA: "CHARISMA"
          };
          const attrLong = LONG[attribute];
          let asi = 0;
          for (const raw of asiTraits) {
            const m = String(raw).match(/^\s*\+(\d+)\s+([A-Za-z]+)\s*$/);
            if (!m) continue;
            const tag = m[2].toUpperCase();
            if (tag === attribute || tag === attrLong) asi += parseInt(m[1], 10);
          }
          const attrMod = Math.floor((attrValue + asi - 10) / 2);
          const pb = expressions.ProficiencyBonus() * proficiency;
          return attrMod + pb + bonus;
        },
        Passive: ([{ attribute, proficiency, bonus, vantage }], { expressions }) => {
          return 10 + expressions.ModifierTotal({ attribute, proficiency, bonus }) + 5 * vantage;
        }
      }
    };
  });
  var character_default = character;

  // vault:tales-of-the-valiant/config/entities/item.tsx
  var import_rpg_ui_toolkit16 = __require("rpg-ui-toolkit");

  // vault:tales-of-the-valiant/config/blocks/item/element.tsx
  var React13 = __toESM(__require("react"));
  var import_rpg_ui_toolkit12 = __require("rpg-ui-toolkit");
  var element = ({ self }) => {
    const data = { ...self };
    if (!data.desc && typeof self.text === "string") {
      data.desc = self.text;
    }
    return /* @__PURE__ */ React13.createElement(import_rpg_ui_toolkit12.ItemElementCard, { data, renderMarkdown: (src) => /* @__PURE__ */ React13.createElement(import_rpg_ui_toolkit12.Markdown, { source: src }) });
  };
  var element_default = element;

  // vault:tales-of-the-valiant/config/blocks/item/magic.tsx
  var React14 = __toESM(__require("react"));
  var import_rpg_ui_toolkit13 = __require("rpg-ui-toolkit");
  var magic = ({ self }) => {
    return /* @__PURE__ */ React14.createElement(import_rpg_ui_toolkit13.ItemMagicCard, { data: self, renderMarkdown: (src) => /* @__PURE__ */ React14.createElement(import_rpg_ui_toolkit13.Markdown, { source: src }) });
  };
  var magic_default = magic;

  // vault:tales-of-the-valiant/config/blocks/item/personal.tsx
  var React15 = __toESM(__require("react"));
  var import_rpg_ui_toolkit14 = __require("rpg-ui-toolkit");
  var personal = ({ self, lookup }) => {
    var _a, _b;
    const elements = (_a = lookup == null ? void 0 : lookup.$items) != null ? _a : {};
    const magicLib = (_b = lookup == null ? void 0 : lookup.$magic) != null ? _b : {};
    const resolution = (0, import_rpg_ui_toolkit14.resolvePersonalItem)(self, { elements, magic: magicLib });
    return /* @__PURE__ */ React15.createElement(import_rpg_ui_toolkit14.ItemPersonalCard, { data: self, resolution, renderMarkdown: (src) => /* @__PURE__ */ React15.createElement(import_rpg_ui_toolkit14.Markdown, { source: src }) });
  };
  var personal_default = personal;

  // vault:tales-of-the-valiant/config/blocks/item/container.tsx
  var React16 = __toESM(__require("react"));
  var import_rpg_ui_toolkit15 = __require("rpg-ui-toolkit");
  var container = ({ self, lookup }) => {
    var _a, _b;
    const elements = (_a = lookup == null ? void 0 : lookup.$items) != null ? _a : {};
    const magicLib = (_b = lookup == null ? void 0 : lookup.$magic) != null ? _b : {};
    const resolution = (0, import_rpg_ui_toolkit15.resolveContainer)(self, { elements, magic: magicLib });
    const lookupFn = (target) => {
      if (!target) return void 0;
      const stem = target.split("/").pop();
      if (elements[target]) return elements[target];
      return elements[stem];
    };
    const selfApi = self;
    const handleToggleForSale = (loc) => {
      var _a2, _b2;
      if (loc.source === "section") {
        const sections = Array.isArray(self.sections) ? self.sections : [];
        if (loc.sectionIndex < 0 || loc.sectionIndex >= sections.length) return;
        const target = sections[loc.sectionIndex];
        const currentItems = Array.isArray(target == null ? void 0 : target.items) ? target.items : [];
        const nextItems = withToggled2(currentItems, loc.path);
        if (!nextItems) return;
        const nextSections = sections.map((s, i) => i === loc.sectionIndex ? { ...s, items: nextItems } : s);
        (_a2 = selfApi.setSections) == null ? void 0 : _a2.call(selfApi, nextSections);
        return;
      }
      const items = Array.isArray(self.items) ? self.items : [];
      const next = withToggled2(items, loc.path);
      if (!next) return;
      (_b2 = selfApi.setItems) == null ? void 0 : _b2.call(selfApi, next);
    };
    const canToggle = !!(selfApi.setSections || selfApi.setItems);
    return /* @__PURE__ */ React16.createElement(
      import_rpg_ui_toolkit15.ItemContainerCard,
      {
        data: self,
        resolution,
        lookup: lookupFn,
        renderMarkdown: (src) => /* @__PURE__ */ React16.createElement(import_rpg_ui_toolkit15.Markdown, { source: src }),
        onToggleForSale: canToggle ? handleToggleForSale : void 0
      }
    );
  };
  var container_default = container;
  function withToggled2(items, path) {
    const [head, ...rest] = path;
    if (head == null || head < 0 || head >= items.length) return null;
    const original = items[head];
    let cloned;
    if (typeof original === "string") {
      cloned = { name: original };
    } else if (original && typeof original === "object") {
      cloned = { ...original };
    } else {
      return null;
    }
    if (rest.length === 0) {
      if (cloned.for_sale) delete cloned.for_sale;
      else cloned.for_sale = true;
    } else {
      if (!Array.isArray(cloned.contents)) return null;
      const updated = withToggled2(cloned.contents, rest);
      if (!updated) return null;
      cloned.contents = updated;
    }
    const next = items.slice();
    next[head] = cloned;
    return next;
  }

  // vault:tales-of-the-valiant/config/entities/item.tsx
  var item = (0, import_rpg_ui_toolkit16.CreateEntity)(async ({ wiki }) => {
    var _a, _b, _c, _d;
    const compendium = (_a = await wiki.folder("worldbuilding/items")) != null ? _a : [];
    const magicCompendium = (_b = await wiki.folder("worldbuilding/magic-items")) != null ? _b : [];
    const containersCompendium = (_c = await wiki.folder("worldbuilding/containers")) != null ? _c : [];
    const adventurers = (_d = await wiki.folder("adventurers")) != null ? _d : [];
    const items = {};
    const magic2 = {};
    const personal2 = {};
    const containers = {};
    const index = (docs) => {
      for (const d of docs) {
        const name = d == null ? void 0 : d.$name;
        const contents = typeof (d == null ? void 0 : d.$contents) === "string" ? d.$contents : "";
        if (!name || !contents) continue;
        const elementBodies = (0, import_rpg_ui_toolkit16.extractItemElementBlocks)(contents);
        if (elementBodies.length > 0 && !items[name]) {
          items[name] = elementBodies[0];
        }
        const magicBodies = (0, import_rpg_ui_toolkit16.extractItemMagicBlocks)(contents);
        if (magicBodies.length > 0 && !magic2[name]) {
          magic2[name] = magicBodies[0];
        }
        const personalBodies = (0, import_rpg_ui_toolkit16.extractItemPersonalBlocks)(contents);
        if (personalBodies.length > 0 && !personal2[name]) {
          personal2[name] = personalBodies[0];
        }
        const containerBodies = (0, import_rpg_ui_toolkit16.extractItemContainerBlocks)(contents);
        if (containerBodies.length > 0 && !containers[name]) {
          containers[name] = containerBodies[0];
        }
      }
    };
    index(compendium);
    index(magicCompendium);
    index(containersCompendium);
    index(adventurers);
    return {
      lookup: {
        $items: items,
        $magic: magic2,
        $personal: personal2,
        $containers: containers
      },
      blocks: {
        element: element_default,
        magic: magic_default,
        personal: personal_default,
        container: container_default
      }
    };
  });
  var item_default = item;

  // vault:tales-of-the-valiant/config/blocks/feature/details.tsx
  var React17 = __toESM(__require("react"));
  var import_rpg_ui_toolkit17 = __require("rpg-ui-toolkit");
  function HomebrewBadge({ source }) {
    const ref = React17.useRef(null);
    React17.useEffect(() => {
      var _a;
      const el = ref.current;
      if (!el) return;
      el.innerHTML = "";
      try {
        const obsidian = __require("obsidian");
        (_a = obsidian.setIcon) == null ? void 0 : _a.call(obsidian, el, "pen-line");
      } catch (e) {
        el.textContent = "\u2726";
      }
    }, []);
    const label = `Homebrew \u2014 ${source}`;
    return /* @__PURE__ */ React17.createElement(
      "span",
      {
        ref,
        className: "rpg-feature-card__homebrew-badge",
        role: "img",
        "aria-label": label,
        title: label
      }
    );
  }
  function resolveWikilink(link) {
    var _a, _b;
    const target = link.replace(/^\[\[|\]\]$/g, "").split("|")[0].split("#")[0].trim();
    if (!target) return null;
    const app = globalThis.app;
    const dest = (_b = (_a = app == null ? void 0 : app.metadataCache) == null ? void 0 : _a.getFirstLinkpathDest) == null ? void 0 : _b.call(_a, target, "");
    return dest ? link : null;
  }
  function formatMax(max) {
    if (max == null) return "";
    if (typeof max === "number") return String(max);
    if (typeof max === "string") return max;
    return Object.entries(max).sort((a, b) => Number(a[0]) - Number(b[0])).map(([lv, n]) => `Lv${lv}: ${n}`).join(", ");
  }
  function isNoTitleView(raw) {
    if (typeof raw !== "string") return false;
    return raw.toLowerCase().replace(/[\s\-_]+/g, "") === "notitle";
  }
  var details = ({ self, lookup }) => {
    var _a, _b;
    const resolvedLink = self.link ? resolveWikilink(self.link) : null;
    const isResource = self.type === "resource";
    const hideTitle = isNoTitleView(self.view);
    const HeadingTag = `h${Math.max(1, Math.min(6, (_a = self.heading) != null ? _a : 3))}`;
    const isHomebrew = !!self.$homebrew;
    const context = React17.useMemo(() => {
      var _a2;
      return { tables: (_a2 = lookup == null ? void 0 : lookup.$tables) != null ? _a2 : {}, vars: {} };
    }, [lookup == null ? void 0 : lookup.$tables]);
    const cls = ["rpg-feature-card"];
    if (isHomebrew) cls.push("rpg-feature-homebrew");
    return /* @__PURE__ */ React17.createElement("article", { className: cls.join(" "), "aria-label": `Feature ${self.name}` }, isHomebrew && /* @__PURE__ */ React17.createElement(HomebrewBadge, { source: (_b = self.source) != null ? _b : "" }), /* @__PURE__ */ React17.createElement("hgroup", null, !hideTitle && /* @__PURE__ */ React17.createElement(HeadingTag, null, self.name), /* @__PURE__ */ React17.createElement("p", null, self.subtitle ? /* @__PURE__ */ React17.createElement("small", { "aria-details": "Feature Subtitle" }, self.subtitle) : /* @__PURE__ */ React17.createElement(React17.Fragment, null, self.level != null && /* @__PURE__ */ React17.createElement("small", { "aria-details": "Feature Level" }, "Lv. ", self.level), self.uses != null && /* @__PURE__ */ React17.createElement("small", { "aria-details": "Feature Uses" }, self.uses, " use", self.uses === 1 ? "" : "s")), isResource && self.max != null && /* @__PURE__ */ React17.createElement("small", { "aria-details": "Resource Max" }, "Max: ", formatMax(self.max)), isResource && self.recovery && /* @__PURE__ */ React17.createElement("small", { "aria-details": "Resource Recovery" }, "Recovery: ", self.recovery))), self.text && /* @__PURE__ */ React17.createElement(import_rpg_ui_toolkit17.Markdown, { source: self.text, context, className: "rpg-feature-text" }), resolvedLink && /* @__PURE__ */ React17.createElement(import_rpg_ui_toolkit17.Markdown, { source: resolvedLink, className: "rpg-feature-link" }));
  };
  var details_default = details;

  // vault:tales-of-the-valiant/config/blocks/feature/choice.tsx
  var React18 = __toESM(__require("react"));
  var import_rpg_ui_toolkit18 = __require("rpg-ui-toolkit");
  var choice = ({ self }) => {
    if (!self.text) return null;
    return /* @__PURE__ */ React18.createElement(import_rpg_ui_toolkit18.Markdown, { source: self.text });
  };
  var choice_default = choice;

  // vault:tales-of-the-valiant/config/blocks/feature/unlock.tsx
  var React19 = __toESM(__require("react"));
  var unlock = ({ self }) => /* @__PURE__ */ React19.createElement("aside", { className: "rpg-feature-card rpg-feature-card-unlock", "aria-label": "Feature Unlock" }, /* @__PURE__ */ React19.createElement("small", null, "Unlocks ", self.kind, " at Lv. ", self.level));
  var unlock_default = unlock;

  // vault:tales-of-the-valiant/config/blocks/feature/level.tsx
  var React20 = __toESM(__require("react"));
  var level = () => {
    const ref = React20.useRef(null);
    React20.useLayoutEffect(() => {
      var _a;
      const node = ref.current;
      if (!node) return;
      const wrapper = (_a = node.closest(".el-pre")) != null ? _a : node.parentElement;
      wrapper == null ? void 0 : wrapper.remove();
    }, []);
    return /* @__PURE__ */ React20.createElement("div", { ref, "aria-hidden": "true" });
  };
  var level_default = level;

  // vault:tales-of-the-valiant/config/entities/stat.tsx
  var import_rpg_ui_toolkit20 = __require("rpg-ui-toolkit");

  // vault:tales-of-the-valiant/config/blocks/stat/vehicle.tsx
  var React21 = __toESM(__require("react"));
  var import_rpg_ui_toolkit19 = __require("rpg-ui-toolkit");
  var vehicle = ({ self }) => {
    var _a, _b;
    const [resolved, setResolved] = React21.useState([]);
    React21.useEffect(() => {
      var _a2, _b2, _c, _d;
      if (!self.features || self.features.length === 0) {
        setResolved([]);
        return;
      }
      let cancelled = false;
      const app = globalThis.app;
      const sourcePath = (_d = (_c = (_b2 = (_a2 = app == null ? void 0 : app.workspace) == null ? void 0 : _a2.getActiveFile) == null ? void 0 : _b2.call(_a2)) == null ? void 0 : _c.path) != null ? _d : "";
      const selfProps = {
        name: self.name ? String(self.name).toLowerCase() : "",
        size: self.size,
        type: self.type,
        dimensions: self.dimensions
      };
      (0, import_rpg_ui_toolkit19.resolveStatFeatures)(self.features, sourcePath, selfProps).then(
        (results) => {
          if (!cancelled) setResolved(results);
        }
      );
      return () => {
        cancelled = true;
      };
    }, [self.features, self.name]);
    return /* @__PURE__ */ React21.createElement(
      import_rpg_ui_toolkit19.StatblockVehicle,
      {
        name: self.name,
        size: self.size,
        type: self.type,
        dimensions: self.dimensions,
        stats: (_a = self.stats) != null ? _a : {},
        abilities: (_b = self.abilities) != null ? _b : { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
        features: resolved,
        body: self.text,
        view: self.view
      }
    );
  };
  var vehicle_default = vehicle;

  // vault:tales-of-the-valiant/config/entities/stat.tsx
  var stat = (0, import_rpg_ui_toolkit20.CreateEntity)(() => ({
    blocks: {
      vehicle: vehicle_default
    }
  }));
  var stat_default = stat;

  // vault:tales-of-the-valiant/config/rule-views.tsx
  var import_rpg_ui_toolkit21 = __require("rpg-ui-toolkit");
  var React22 = __toESM(__require("react"));
  function headingText(ctx) {
    const fm = ctx.frontmatter;
    if (typeof fm.name === "string" && fm.name) return fm.name;
    return void 0;
  }
  function resolvePath(obj, path) {
    let cur = obj;
    for (const key of path.split(".")) {
      if (cur == null || typeof cur !== "object") return void 0;
      cur = cur[key];
    }
    return cur;
  }
  function renderWikilinks(text) {
    const re = /\[\[([^\]\n]+)\]\]/g;
    const parts = [];
    let cursor = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      if (m.index > cursor) {
        parts.push(React22.createElement(React22.Fragment, { key: `t${cursor}` }, text.slice(cursor, m.index)));
      }
      const inner = m[1];
      const pipe = inner.indexOf("|");
      const target = (pipe >= 0 ? inner.slice(0, pipe) : inner).trim();
      const label = (pipe >= 0 ? inner.slice(pipe + 1) : inner).split("/").pop().trim();
      parts.push(React22.createElement("a", {
        key: `l${m.index}`,
        className: "internal-link",
        href: target,
        "data-href": target
      }, label));
      cursor = m.index + m[0].length;
    }
    if (cursor < text.length) {
      parts.push(React22.createElement(React22.Fragment, { key: `t${cursor}` }, text.slice(cursor)));
    }
    return React22.createElement(React22.Fragment, null, ...parts);
  }
  function headingView(level2) {
    const Tag = `h${level2}`;
    return {
      mode: "join",
      render: (ctx) => {
        const title = headingText(ctx);
        return React22.createElement(
          "section",
          { className: `rpg-view rpg-view--h${level2}` },
          title ? React22.createElement(Tag, null, title) : null,
          React22.createElement(import_rpg_ui_toolkit21.Markdown, { source: ctx.content, sourcePath: ctx.file })
        );
      }
    };
  }
  function parseBannerArgs(args) {
    let height = "normal";
    let position = "center";
    for (const arg of args != null ? args : []) {
      if (arg === "short" || arg === "tall" || arg === "normal" || arg === "hero") height = arg;
      else if (arg === "top" || arg === "center" || arg === "bottom") position = arg;
    }
    return { height, position };
  }
  function normalizeStatValue(raw) {
    if (typeof raw === "string") return raw;
    if (raw == null) return "";
    if (typeof raw === "number" || typeof raw === "boolean") return String(raw);
    if (Array.isArray(raw) && raw.length === 1 && Array.isArray(raw[0]) && raw[0].length === 1 && typeof raw[0][0] === "string") {
      return `[[${raw[0][0]}]]`;
    }
    return String(raw);
  }
  function normalizeStats(raw) {
    if (!raw || typeof raw !== "object") return {};
    const out = {};
    for (const [key, value] of Object.entries(raw)) {
      out[key] = normalizeStatValue(value);
    }
    return out;
  }
  function normalizeAbilities(raw) {
    const defaults = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
    if (!raw || typeof raw !== "object") return defaults;
    const obj = raw;
    for (const key of Object.keys(defaults)) {
      const v = obj[key];
      if (typeof v === "number") defaults[key] = v;
      else if (typeof v === "string") {
        const n = parseInt(v, 10);
        if (Number.isFinite(n)) defaults[key] = n;
      }
    }
    return defaults;
  }
  function normalizeFeatures(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.map((entry) => {
      if (typeof entry === "string") return { ref: entry };
      if (entry && typeof entry === "object" && "ref" in entry) return entry;
      if (Array.isArray(entry) && entry.length === 1 && Array.isArray(entry[0])) return { ref: `[[${entry[0][0]}]]` };
      return null;
    }).filter((x) => x !== null);
  }
  function StatblockCall({ parsed, body, view, sourcePath }) {
    const [resolved, setResolved] = React22.useState([]);
    const features2 = React22.useMemo(() => normalizeFeatures(parsed.features), [parsed.features]);
    const name = typeof parsed.name === "string" ? parsed.name : "";
    React22.useEffect(() => {
      if (features2.length === 0) {
        setResolved([]);
        return;
      }
      let cancelled = false;
      const selfProps = { name: name.toLowerCase(), size: parsed.size, type: parsed.type, dimensions: parsed.dimensions };
      (0, import_rpg_ui_toolkit21.resolveStatFeatures)(features2, sourcePath, selfProps).then((r) => {
        if (!cancelled) setResolved(r);
      });
      return () => {
        cancelled = true;
      };
    }, [features2, name, sourcePath]);
    return React22.createElement(import_rpg_ui_toolkit21.StatblockVehicle, {
      name,
      size: typeof parsed.size === "string" ? parsed.size : "",
      type: typeof parsed.type === "string" ? parsed.type : "",
      dimensions: typeof parsed.dimensions === "string" ? parsed.dimensions : void 0,
      stats: normalizeStats(parsed.stats),
      abilities: normalizeAbilities(parsed.abilities),
      features: resolved,
      body,
      view,
      sourcePath
    });
  }
  var ruleViews = {
    /**
     * Heading-prefixed views. Pick the level that nests correctly under
     * the surrounding document structure.
     *
     *   `@[[rules/combat]].h3()`        → all blocks, h3 with file name
     *   `@[[rules/combat]].h3(grapple)` → grapple block, h3 with `grapple.name`
     */
    h1: headingView(1),
    h2: headingView(2),
    h3: headingView(3),
    h4: headingView(4),
    h5: headingView(5),
    h6: headingView(6),
    /**
     * Paragraph form: bold name + first line of body in the same paragraph.
     * Rest of body flows below. Block-level container.
     *
     *   `@[[rules/combat]].p(grapple)`
     */
    p: {
      mode: "join",
      render: (ctx) => {
        const name = headingText(ctx);
        let source;
        if (name) {
          const firstNl = ctx.content.indexOf("\n");
          source = firstNl >= 0 ? `***${name}.*** ${ctx.content.slice(0, firstNl)}
${ctx.content.slice(firstNl)}` : `***${name}.*** ${ctx.content}`;
        } else {
          source = ctx.content;
        }
        return React22.createElement(
          "div",
          { className: "rpg-view rpg-view--p" },
          React22.createElement(import_rpg_ui_toolkit21.Markdown, { source, sourcePath: ctx.file })
        );
      }
    },
    /**
     * Inline form: bold name + body injected into the parent paragraph.
     * Truly inline — flows with surrounding prose. Content after newlines
     * / tables breaks out naturally.
     *
     *   `@[[rules/combat]].inline(grapple)`
     */
    inline: {
      mode: "join",
      render: (ctx) => {
        const name = headingText(ctx);
        let source;
        if (name) {
          const firstNl = ctx.content.indexOf("\n");
          source = firstNl >= 0 ? `**${name}.** ${ctx.content.slice(0, firstNl)}
${ctx.content.slice(firstNl)}` : `**${name}.** ${ctx.content}`;
        } else {
          source = ctx.content;
        }
        return React22.createElement(
          "span",
          { className: "rpg-view rpg-view--inline" },
          React22.createElement(import_rpg_ui_toolkit21.Markdown, { source, sourcePath: ctx.file })
        );
      }
    },
    /**
     * List item — produces `<li>` elements wrapped in a `<ul>`. When called
     * without an id, ALL blocks render as items in one list. Level parameter
     * controls nesting depth (1 = base/default, 2+ = indented).
     *
     *   `@[[combat]].item()`               — all blocks, level 1
     *   `@[[combat]].item(grapple)`        — single item, level 1
     *   `@[[combat]].item(shove, 2)`       — single item, indented one level
     */
    item: {
      mode: "args",
      wrapper: "ul",
      render: (ctx, args) => {
        const name = headingText(ctx);
        const level2 = typeof (args == null ? void 0 : args[0]) === "number" ? args[0] : 1;
        let source;
        if (name) {
          const firstNl = ctx.content.indexOf("\n");
          source = firstNl >= 0 ? `**${name}.** ${ctx.content.slice(0, firstNl)}
${ctx.content.slice(firstNl)}` : `**${name}.** ${ctx.content}`;
        } else {
          source = ctx.content;
        }
        const style = level2 > 1 ? { marginInlineStart: `${3.5 + (level2 - 2) * 1.5}em` } : void 0;
        return React22.createElement(
          "li",
          { className: "rpg-view rpg-view--item", style },
          React22.createElement(import_rpg_ui_toolkit21.Markdown, { source, sourcePath: ctx.file })
        );
      }
    },
    /**
     * Bare body — no chrome, just the markdown. For inline citation.
     *
     *   `@[[rules/combat]].bare(grapple)`
     */
    bare: {
      mode: "join",
      raw: true,
      render: (ctx) => React22.createElement(import_rpg_ui_toolkit21.Markdown, { source: ctx.content, sourcePath: ctx.file })
    },
    /**
     * Float side block — banner-style margin aside glued to the page edge.
     * Extra args: direction (left|right), type (preset name).
     *
     *   `@[[rules/combat]].float(grapple)`           — defaults: right, rules
     *   `@[[rules/combat]].float(grapple, left)`      — direction=left
     *   `@[[rules/combat]].float(grapple, left, tip)` — direction=left, type=tip
     */
    float: {
      mode: "args",
      render: (ctx, args) => {
        const direction = (args == null ? void 0 : args[0]) === "left" ? "left" : "right";
        const preset = typeof (args == null ? void 0 : args[1]) === "string" ? args[1] : "rules";
        return React22.createElement(import_rpg_ui_toolkit21.RuleSide, {
          variant: "float",
          type: preset,
          direction,
          title: headingText(ctx),
          content: ctx.content,
          sourcePath: ctx.file
        });
      }
    },
    /**
     * Callout side block — in-flow ornate certificate. Extra arg: type.
     *
     *   `@[[rules/combat]].callout(grapple)`          — default type: rules
     *   `@[[rules/combat]].callout(grapple, warning)` — type=warning
     */
    callout: {
      mode: "args",
      render: (ctx, args) => {
        const preset = typeof (args == null ? void 0 : args[0]) === "string" ? args[0] : "rules";
        return React22.createElement(import_rpg_ui_toolkit21.RuleSide, {
          variant: "callout",
          type: preset,
          title: headingText(ctx),
          content: ctx.content,
          sourcePath: ctx.file
        });
      }
    },
    /**
     * Commentary side block — gutter-only italic aside.
     * Extra args: direction (left|right), type (preset name).
     *
     *   `@[[rules/combat]].commentary(grapple)`              — defaults: right, no preset
     *   `@[[rules/combat]].commentary(grapple, left)`         — direction=left
     *   `@[[rules/combat]].commentary(grapple, right, quote)` — type=quote
     */
    commentary: {
      mode: "args",
      render: (ctx, args) => {
        const direction = (args == null ? void 0 : args[0]) === "left" ? "left" : "right";
        const preset = typeof (args == null ? void 0 : args[1]) === "string" ? args[1] : void 0;
        return React22.createElement(import_rpg_ui_toolkit21.RuleSide, {
          variant: "commentary",
          type: preset,
          direction,
          content: ctx.content,
          sourcePath: ctx.file
        });
      }
    },
    /**
     * Table — renders a complete `<table>` with headers (from field names)
     * and one `<tr>` per matching block. Args are frontmatter field names.
     *
     *   `@[[combat]].row(name, contest)`  — full table, all blocks
     *   `@[[combat]].row(grapple, name, contest)` — single-row table
     */
    row: {
      mode: "args",
      wrapper: "table",
      render: (ctx, args) => {
        const fields = (args != null ? args : []).map((arg) => String(arg));
        const cells = fields.map((f) => {
          var _a, _b;
          if (f === "name") return (_a = headingText(ctx)) != null ? _a : "";
          if (f === "link") {
            const label = (_b = headingText(ctx)) != null ? _b : ctx.name;
            return React22.createElement("a", {
              className: "internal-link",
              href: ctx.file,
              "data-href": ctx.file
            }, label);
          }
          const v = resolvePath(ctx.frontmatter, f);
          const text = Array.isArray(v) ? v.join(", ") : v == null ? "" : String(v);
          if (/\[\[/.test(text)) {
            return renderWikilinks(text);
          }
          return text;
        });
        return React22.createElement(
          "tr",
          { className: "rpg-view rpg-view--row" },
          cells.map((cell, i) => React22.createElement("td", { key: i }, cell))
        );
      }
    },
    /**
     * Tab view — renders each file as a tab in a TabGroupView.
     * Folder calls produce all tabs at once; single-file calls merge
     * with adjacent `.tab()` calls.
     *
     * Frontmatter fields: `tab-name`, `tab-icon`, `tab-color`, `tab-order`.
     *
     *   `@[[class-features/]].tab()`  → folder: all files as tabs
     *   `@[[Fighter]].tab()`          → single tab, merges with neighbors
     */
    tab: {
      mode: "join",
      wrapper: "tab-group",
      render: (ctx) => {
        return React22.createElement(import_rpg_ui_toolkit21.Markdown, { source: ctx.content, sourcePath: ctx.file });
      }
    },
    /**
     * Full-bleed banner image that breaks out of the content column.
     * Pulls image from the target file's frontmatter (`image:` or `banner:`).
     *
     * Args: height preset (short|normal|tall), position (top|center|bottom).
     *
     *   `@[[dragon-lair]].banner()`            → normal height, center
     *   `@[[dragon-lair]].banner(tall)`        → tall, center
     *   `@[[dragon-lair]].banner(short, top)`  → short, top-aligned
     */
    banner: {
      mode: "args",
      render: (ctx, args) => {
        var _a, _b;
        const { height, position } = parseBannerArgs(args);
        const fm = ctx.frontmatter;
        const rawImage = (_b = (_a = fm.image) != null ? _a : fm.banner) != null ? _b : null;
        const src = rawImage ? (0, import_rpg_ui_toolkit21.resolveVaultImage)(rawImage, ctx.file) : (0, import_rpg_ui_toolkit21.resolveVaultImage)(ctx.file, ctx.file);
        if (!src) {
          return React22.createElement(
            "div",
            { className: "rpg-view rpg-view--banner rpg-view--banner--error" },
            `[banner: could not resolve image for [[${ctx.name}]]]`
          );
        }
        return React22.createElement(
          "figure",
          { className: `rpg-view rpg-view--banner rpg-view--banner--${height}` },
          React22.createElement("img", {
            src,
            alt: ctx.name,
            style: { objectPosition: position }
          })
        );
      }
    },
    /**
     * Statblock import: renders a `stat.vehicle` (or other stat.*) block
     * from the target file inline.
     *
     *   `@[[Galley]].stat()`            → default view from the file
     *   `@[[Galley]].stat(desc-before)` → description before statblock
     *   `@[[Galley]].stat(desc-after)`  → description after statblock
     */
    stat: {
      mode: "join",
      render: (ctx, args) => {
        const fenceRe = /```+\s*rpg\s+stat\.(\w+)\s*\n([\s\S]*?)```+/;
        const m = fenceRe.exec(ctx.content);
        if (!m) return null;
        const raw = m[2];
        const sepIdx = raw.indexOf("\n---\n");
        const sepEnd = raw.indexOf("\n---");
        const effectiveSep = sepIdx >= 0 ? sepIdx : sepEnd >= 0 && sepEnd + 4 >= raw.length ? sepEnd : -1;
        let yamlText;
        let bodyText;
        if (effectiveSep >= 0) {
          yamlText = raw.slice(0, effectiveSep);
          bodyText = raw.slice(effectiveSep + 4).replace(/^\n+/, "").replace(/\n+$/, "") || void 0;
        } else {
          yamlText = raw;
        }
        let parsed = {};
        try {
          const { parse } = __require("yaml");
          const result = parse(yamlText);
          if (result && typeof result === "object" && !Array.isArray(result)) parsed = result;
        } catch (e) {
        }
        const viewOverride = typeof (args == null ? void 0 : args[0]) === "string" ? args[0] : void 0;
        const view = viewOverride != null ? viewOverride : typeof parsed.view === "string" ? parsed.view : void 0;
        return React22.createElement(StatblockCall, {
          parsed,
          body: bodyText,
          view,
          sourcePath: ctx.file
        });
      }
    },
    /**
     * Magic item import: renders an `item.magic` block from the target file.
     *
     *   `@[[Sentinel Shield]].magic()`
     */
    magic: {
      mode: "join",
      render: (ctx) => {
        const blocks = (0, import_rpg_ui_toolkit21.extractItemMagicBlocks)(ctx.content);
        if (blocks.length === 0) return null;
        const data = blocks[0];
        if (!data.name) data.name = ctx.name;
        return React22.createElement(import_rpg_ui_toolkit21.ItemMagicCard, {
          data,
          renderMarkdown: (src) => React22.createElement(import_rpg_ui_toolkit21.Markdown, { source: src, sourcePath: ctx.file })
        });
      }
    }
  };

  // vault:tales-of-the-valiant/config/index.ts
  var system = (0, import_rpg_ui_toolkit22.CreateSystem)(async ({ wiki }) => ({
    name: "Tales of the Valiant",
    attributes: attributes_default,
    skills: await wiki.folder("glossary/skills"),
    conditions: await wiki.folder("glossary/conditions"),
    // ── Entity Types ─────────────────────────────────────────────────────────────
    entities: {
      character: character_default,
      item: item_default,
      class: (0, import_rpg_ui_toolkit22.CreateEntity)(({ wiki: wiki2 }) => ({
        frontmatter: [{ name: "hit_die", type: "string", default: "d8" }],
        blocks: {
          features: () => null
        }
      })),
      subclass: (0, import_rpg_ui_toolkit22.CreateEntity)(({ wiki: wiki2 }) => ({
        frontmatter: [{ name: "parent_class", type: "string", default: "" }]
      })),
      lineage: (0, import_rpg_ui_toolkit22.CreateEntity)(({ wiki: wiki2 }) => ({
        frontmatter: [
          { name: "size", type: "string", default: "medium" },
          { name: "speed", type: "number", default: 30 }
        ]
      })),
      heritage: (0, import_rpg_ui_toolkit22.CreateEntity)(({ wiki: wiki2 }) => ({ frontmatter: [] })),
      background: (0, import_rpg_ui_toolkit22.CreateEntity)(({ wiki: wiki2 }) => ({ frontmatter: [] })),
      monster: (0, import_rpg_ui_toolkit22.CreateEntity)(async ({ wiki: wiki2 }) => {
        var _a, _b;
        const external = await wiki2.file("worldbuilding/bestiary/extra").catch(() => null);
        return {
          frontmatter: [{ name: "cr", type: "number", default: 0 }],
          features: [
            {
              $name: "Opportunity Attack",
              type: "reaction",
              $contents: "Make a melee attack against a creature that leaves your reach."
            },
            ...external ? [{ $name: (_a = external.$name) != null ? _a : external.$path, $contents: (_b = external.$contents) != null ? _b : "" }] : []
          ]
        };
      }),
      spell: (0, import_rpg_ui_toolkit22.CreateEntity)(({ wiki: wiki2 }) => ({
        frontmatter: [
          { name: "level", type: "number", default: 0 },
          { name: "school", type: "string", default: "" }
        ],
        blocks: {
          info: () => null,
          effects: () => null
        }
      })),
      feature: (0, import_rpg_ui_toolkit22.CreateEntity)(({ wiki: wiki2 }) => ({
        blocks: {
          details: details_default,
          choice: choice_default,
          unlock: unlock_default,
          level: level_default
        }
      })),
      stat: stat_default
    },
    // ── Features ──────────────────────────────────────────────────────────────────
    features: {
      categories: [
        { id: "action", label: "Action", icon: "\u2694\uFE0F" },
        { id: "bonus_action", label: "Bonus Action", icon: "\u26A1" },
        { id: "reaction", label: "Reaction", icon: "\u{1F6E1}\uFE0F" },
        { id: "free_action", label: "Free Action", icon: "\u2728" },
        { id: "passive", label: "Passive", icon: "\u{1F4CB}" },
        { id: "resource", label: "Resource" }
      ],
      providers: ["class", "subclass", "lineage", "heritage", "background"],
      collectors: ["character", "monster"]
    },
    // ── Spellcasting ─────────────────────────────────────────────────────────────
    spellcasting: {
      circles: [
        { id: "cantrip", label: "Cantrip", icon: "0" },
        { id: "1", label: "1st Level", icon: "1" },
        { id: "2", label: "2nd Level", icon: "2" },
        { id: "3", label: "3rd Level", icon: "3" },
        { id: "4", label: "4th Level", icon: "4" },
        { id: "5", label: "5th Level", icon: "5" },
        { id: "6", label: "6th Level", icon: "6" },
        { id: "7", label: "7th Level", icon: "7" },
        { id: "8", label: "8th Level", icon: "8" },
        { id: "9", label: "9th Level", icon: "9" }
      ],
      lists: [
        { id: "bard", label: "Bard Spells" },
        { id: "cleric", label: "Cleric Spells" },
        { id: "druid", label: "Druid Spells" },
        { id: "paladin", label: "Paladin Spells" },
        { id: "ranger", label: "Ranger Spells" },
        { id: "sorcerer", label: "Sorcerer Spells" },
        { id: "warlock", label: "Warlock Spells" },
        { id: "wizard", label: "Wizard Spells" }
      ],
      providers: ["class", "subclass"],
      collectors: ["character", "monster"],
      spellcastTable: spellslots_default,
      casters: {
        full: { name: "Full Caster", levelConversion: (l) => l },
        half: { name: "Half Caster", levelConversion: (l) => Math.floor(l / 2) },
        third: { name: "Third Caster", levelConversion: (l) => Math.floor(l / 3) }
      }
    },
    // ── Traits ────────────────────────────────────────────────────────────────────
    traits: [
      { $name: "Proficiency", mechanical: true, $contents: "Standard proficiency with weapons, tools, or skills." },
      { $name: "Expertise", mechanical: true, $contents: "Double proficiency bonus with specific skills or tools." },
      { $name: "Darkvision", mechanical: true, $contents: "See in darkness up to a specified range." },
      { $name: "Resistance", mechanical: true, $contents: "Take half damage from a specified damage type." },
      { $name: "Immunity", mechanical: true, $contents: "Take no damage from a specified damage type." }
    ]
  }));
  return __toCommonJS(config_exports);
})();
