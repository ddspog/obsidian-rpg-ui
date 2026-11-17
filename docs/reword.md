# Improve the wording

Picks passages of a session's log and has a model rewrite their prose, and
only that. **Wording** in the Log's controls (desktop and phone), or the
command "Improve the wording of this session's log".

1. **Pick**: the log's passages by scene, newest first: outcomes (`=> …`),
   narration, dialogue, events (`! …`). Tick them one by one, a whole scene
   (_all_), the _Last scene_ or the _Last 5_ (40 at most a time). A line can
   say what is wanted ("more tense", "shorter").
2. **Review**: each passage as it was and reworded. A rewording can be
   edited, or unticked to keep the original.
3. **Write to the log**: the kept rewordings replace their passages.

What cannot change: every other line of the log (rolls, oracles, tables,
markers), and on a passage's own line its `=>` or speaker and the tags after
it (`[Talon/XP+87]`). A rewording is refused, and the passage left as it was,
when it drops or changes a `[[link]]`, holds a tag, starts like a log line,
runs to more than one line, or grows far longer. A passage whose line changed
in the note since the dialog opened is left alone too.

The model is the Anthropic-compatible endpoint of the plugin's settings
(Images › Anthropic: link, key, model). It is sent the picked passages, a few
before them for the journal's voice, and the mechanics each one tells, so the
wording stays true to what was rolled.

Code: `lib/domains/session-log/reword.ts` (passages, the prompt, the checks,
putting them back; no Obsidian in it), `lib/plugin/reword-modal.ts`,
`lib/services/anthropic-text.ts`.

Not yet: picking by selecting in the Log's prose itself; a log's second block.
