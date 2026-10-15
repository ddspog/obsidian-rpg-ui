/**
 * The image studio: pick a note, pick where its image goes (a frontmatter key,
 * a block's `image:`/`icon:`, a card's hotbar icon), and see the image there
 * now beside a new one made from a prompt — kept only when it's accepted.
 */

import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { App, Notice, TFile, parseYaml } from "obsidian";
import type { ImageStudioSettings } from "settings";
import {
  IMAGE_KINDS,
  aspectFor,
  targetSize,
  kindOf,
  promptFor,
  toneOf,
  words,
  type CharacterLore,
  type IconTone,
  type ImageKindId,
  type NoteBlock,
  type PromptContext,
} from "lib/domains/image-studio/kinds";
import {
  imageFileName,
  imageLink,
  imageTargets,
  imageValue,
  rpgFences,
  setFenceFlag,
  setFenceKey,
  type ImageTarget,
} from "lib/domains/image-studio/targets";
import { ASPECTS, draftSubject, generateImage, type Aspect } from "lib/services/image-gen";
import { finishImage, type FinishedImage } from "lib/services/image-post";
import { NoteCombobox, type NoteOption } from "lib/components/session-log/note-combobox";

interface ImageStudioProps {
  app: App;
  settings: ImageStudioSettings;
  /** The note to start on (the one open), when there is one. */
  initial?: TFile;
  /** A card to make a hotbar icon for — no note needed (a GM card, a Party card). */
  card?: { name: string; noteName?: string; text?: string; tone?: IconTone };
  /** Told once an image is saved — the hotbar draws it at once. */
  onSaved?: () => void;
  /** Start on the first image whose label has this word (`portrait`, `image`). */
  focus?: string;
  onClose: () => void;
}

const IMAGE = /\.(png|webp|jpe?g|gif|svg)$/i;

/** The note's blocks — each one's head read, its body's prose — and its prose outside them. */
function readNote(text: string): { blocks: NoteBlock[]; prose: string } {
  const lines = text.split("\n");
  const fences = rpgFences(text);
  const blocks = fences.map((f) => {
    const inner = lines.slice(f.open + 1, f.close);
    const sep = inner.findIndex((l) => l.trim() === "---");
    let data: Record<string, unknown> = {};
    try {
      data = (parseYaml((sep >= 0 ? inner.slice(0, sep) : inner).join("\n")) as Record<string, unknown> | null) ?? {};
    } catch {
      // A head that doesn't parse gives the prompt nothing from it.
    }
    return {
      meta: f.meta,
      data,
      body:
        sep >= 0
          ? inner
              .slice(sep + 1)
              .join("\n")
              .trim()
          : "",
    };
  });
  // The prose: everything outside the frontmatter and the blocks.
  const inBlock = new Set(fences.flatMap((f) => Array.from({ length: f.close - f.open + 1 }, (_, i) => f.open + i)));
  const fmEnd = lines[0]?.trim() === "---" ? lines.findIndex((l, i) => i > 0 && l.trim() === "---") : -1;
  const prose = lines
    .filter((_, i) => i > fmEnd && !inBlock.has(i))
    .join("\n")
    .trim();
  return { blocks, prose };
}

/** A note's text as context for a prompt: no frontmatter, no fences' markup. */
const plainText = (text: string) =>
  text
    .replace(/^---\n[\s\S]*?\n---\n/, "")
    .replace(/^[`~]{3,}.*$/gm, "")
    .replace(/!?\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g, "$1")
    .trim();

export function ImageStudio({ app, settings, initial, card, onSaved, focus, onClose }: ImageStudioProps) {
  const notes = useMemo<NoteOption[]>(
    () => app.vault.getMarkdownFiles().map((f) => ({ name: f.basename, folder: f.parent?.path ?? "" })),
    [app]
  );
  const [query, setQuery] = useState(initial?.basename ?? "");
  const [file, setFile] = useState<TFile | undefined>(initial);
  const [text, setText] = useState("");
  // A card's own note (a spell's, a weapon's) — its full description for the prompt.
  const [cardNote, setCardNote] = useState<{ text: string; file: TFile } | null>(null);
  useEffect(() => {
    if (!card) return;
    // Its note by the name as written, else without the mark.
    const f =
      app.metadataCache.getFirstLinkpathDest(card.noteName ?? card.name, "") ??
      app.metadataCache.getFirstLinkpathDest(card.name, "");
    if (!f) return;
    void app.vault.cachedRead(f).then((t) => setCardNote({ text: t, file: f }));
  }, [card, app]);
  const [targetIndex, setTargetIndex] = useState(0);
  const [kindId, setKindId] = useState<ImageKindId>("item");
  const [prompt, setPrompt] = useState("");
  const [additions, setAdditions] = useState("");
  const [aspect, setAspect] = useState<Aspect>("1:1");
  const [busy, setBusy] = useState<"" | "draft" | "generate" | "save">("");
  const [error, setError] = useState("");
  const [made, setMade] = useState<(FinishedImage & { url: string }) | null>(null);

  // The note's text, read once it's picked.
  useEffect(() => {
    if (!file) return;
    void app.vault.cachedRead(file).then((t) => {
      setText(t);
      setTargetIndex(0);
    });
  }, [file, app]);

  // A card's own icon, or every image the note keeps.
  const targets = useMemo<ImageTarget[]>(
    () =>
      card
        ? [{ kind: "icon", name: card.name, label: `Hotbar icon · ${card.name}` }]
        : file
          ? imageTargets(text, file.basename)
          : [],
    [text, file, card]
  );
  // A note opened for one picture (a character's portrait) starts on it.
  useEffect(() => {
    if (!focus || targets.length === 0) return;
    const at = targets.findIndex((t) => t.label.toLowerCase().includes(focus.toLowerCase()));
    if (at >= 0) setTargetIndex(at);
  }, [file, targets.length]);

  const target: ImageTarget | undefined = targets[targetIndex];
  // What the image is OF: the card, the block's owner, else the note.
  const what = card
    ? card.name
    : target?.kind === "icon"
      ? target.name
      : target?.kind === "fence"
        ? (target.owner ?? file?.basename ?? "")
        : (file?.basename ?? "");

  // A character's origins, as their own notes describe them (the Kobold, the
  // Twisted Minion heritage, the Adherent background) — for what they look like.
  const [lore, setLore] = useState<CharacterLore[]>([]);
  useEffect(() => {
    if (!file || card) {
      setLore([]);
      return;
    }
    const header = readNote(text).blocks.find((b) => /^character\.(header|sheet)$/.test(b.meta))?.data as
      | Record<string, unknown>
      | undefined;
    if (!header) {
      setLore([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const out: CharacterLore[] = [];
      for (const [role, key] of [
        ["Lineage", "lineage"],
        ["Heritage", "heritage"],
        ["Background", "background"],
      ] as const) {
        const entry = header[key] as Record<string, unknown> | undefined;
        const note = words(entry?.file ?? entry);
        const f = note ? app.metadataCache.getFirstLinkpathDest(note, file.path) : null;
        if (f) out.push({ role, note, text: readNote(await app.vault.cachedRead(f)).prose });
      }
      if (!cancelled) setLore(out);
    })();
    return () => {
      cancelled = true;
    };
  }, [file, text, app, card]);

  // What the prompt is made from: the note, and the block the image is in.
  const ctx = useMemo<PromptContext | undefined>(() => {
    // A card: what it does is all there is to go on.
    if (card) {
      // Its note's block and prose when it has one, else what the tile says.
      const read = cardNote ? readNote(cardNote.text) : undefined;
      const block = read?.blocks.find((b) => words(b.data.name) === card.name) ?? read?.blocks[0];
      return {
        note: card.name,
        frontmatter: {},
        blocks: read?.blocks ?? [],
        prose: read?.prose || card.text || "",
        name: card.name,
        ...(block ? { block } : {}),
        ...(card.tone ? { tone: card.tone } : {}),
      };
    }
    if (!file || !target) return undefined;
    const { blocks, prose } = readNote(text);
    const frontmatter = (app.metadataCache.getFileCache(file)?.frontmatter ?? {}) as Record<string, unknown>;
    // An icon from a note: its type read off the block it names (a spell, a weapon, a bonus feature).
    const named = blocks.find((b) => words(b.data.name) === what);
    return {
      note: file.basename,
      frontmatter,
      blocks,
      prose,
      name: what,
      tone: toneOf(named ?? blocks[0]),
      ...(lore.length ? { lore } : {}),
      ...(target.kind === "fence" && blocks[target.fence] ? { block: blocks[target.fence] } : {}),
    };
  }, [file, target, text, what, app, card, cardNote, lore]);

  // A new target: its kind found from where it sits.
  useEffect(() => {
    if (target) setKindId(kindOf(target, file?.path));
    setMade(null);
    setError("");
    // (Keyed on the target itself: the list fills in once the note is read.)
  }, [target?.label, file]);

  // Its kind's prompt, filled from the note; its aspect; the user's words kept.
  useEffect(() => {
    if (!ctx) return;
    setPrompt(promptFor(kindId, ctx, settings.stylePrompt));
    setAspect(aspectFor(kindId, ctx));
  }, [kindId, ctx]);

  // Where the image is now: the link its value names, or the icon named for it.
  const current = useMemo(() => {
    if (!target || (!file && target.kind !== "icon")) return undefined;
    if (target.kind === "icon") {
      const key = target.name.toLowerCase();
      const hit = app.vault
        .getFiles()
        .find((f) => IMAGE.test(f.path) && /(^|\/)icons\//i.test(f.path) && f.basename.toLowerCase() === key);
      return hit ? { file: hit, url: app.vault.getResourcePath(hit) } : undefined;
    }
    if (!file) return undefined;
    const link = imageLink(target.value);
    const dest = link ? app.metadataCache.getFirstLinkpathDest(link, file.path) : null;
    return dest ? { file: dest, url: app.vault.getResourcePath(dest) } : undefined;
  }, [file, target, app]);

  // The size of the picture there now: the new one is made to match it.
  const [currentSize, setCurrentSize] = useState<{ w: number; h: number } | undefined>();
  useEffect(() => {
    setCurrentSize(undefined);
    if (!current) return;
    let cancelled = false;
    void app.vault
      .readBinary(current.file)
      .then((bytes) => createImageBitmap(new Blob([bytes])))
      .then((bmp) => {
        if (!cancelled) setCurrentSize({ w: bmp.width, h: bmp.height });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [current, app]);

  // A made image's blob URL lives until the next one, or the studio closes.
  useEffect(() => () => (made ? URL.revokeObjectURL(made.url) : undefined), [made]);

  const fullPrompt = additions.trim() ? `${prompt.trim()}\nAlso: ${additions.trim()}` : prompt.trim();

  const run = async (kind: "draft" | "generate", job: () => Promise<void>) => {
    setBusy(kind);
    setError("");
    try {
      await job();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
    }
  };

  // Visual details drafted from the note, into the user's additions.
  const draft = () =>
    run("draft", async () => {
      const said = await draftSubject(
        settings,
        `${what} (${IMAGE_KINDS[kindId].label.toLowerCase()})`,
        plainText(text)
      );
      setAdditions((a) => (a.trim() ? `${a.trim()} ${said}` : said));
    });

  // The image there now, finished as a new one would be (its margin or white
  // corners cleared, cropped, WebP) — to replace it with, or not.
  const cleanUp = () =>
    run("generate", async () => {
      if (!current) return;
      const bytes = await app.vault.readBinary(current.file);
      const ext = current.file.extension.toLowerCase();
      const mime = ext === "png" ? "image/png" : ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/webp";
      const done = await finishImage(bytes, mime, IMAGE_KINDS[kindId], currentSize);
      setMade({ ...done, url: URL.createObjectURL(new Blob([done.data], { type: done.mime })) });
    });

  // Made, then finished as the kind keeps it: keyed out, cropped, WebP.
  const generate = () =>
    run("generate", async () => {
      const raw = await generateImage(settings, fullPrompt, aspect);
      const done = await finishImage(
        raw.data,
        raw.mime,
        IMAGE_KINDS[kindId],
        targetSize(IMAGE_KINDS[kindId], aspect, currentSize) ?? currentSize
      );
      setMade({ ...done, url: URL.createObjectURL(new Blob([done.data], { type: done.mime })) });
    });

  // Keep it: the image saved, and its place pointed at it.
  const accept = async () => {
    if (!target || !made || (!file && target.kind !== "icon")) return;
    setBusy("save");
    setError("");
    try {
      const ext = "webp";
      if (target.kind === "icon") {
        // The icon replaces the one named for it (its old file to the trash).
        const folder = settings.iconFolder.trim() || "Icons";
        if (!app.vault.getAbstractFileByPath(folder)) await app.vault.createFolder(folder);
        if (current) await app.fileManager.trashFile(current.file);
        const path = `${folder}/${imageFileName(target.name)}.${ext}`;
        const existing = app.vault.getAbstractFileByPath(path);
        if (existing instanceof TFile) await app.vault.modifyBinary(existing, made.data);
        else await app.vault.createBinary(path, made.data);
      } else if (file) {
        // A new file where the vault keeps attachments; the old one stays (other notes may use it).
        const name = `${imageFileName(what, target.key === "icon" ? "icon" : undefined)}.${ext}`;
        // (Always WebP, best quality — the vault's art is.)
        const path = await app.fileManager.getAvailablePathForAttachment(name, file.path);
        const saved = await app.vault.createBinary(path, made.data);
        const value = imageValue(saved.name, target.value);
        if (target.kind === "frontmatter") {
          await app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
            fm[target.key] = value;
          });
        } else {
          await app.vault.process(file, (t) => {
            const set = setFenceKey(t, target.fence, target.key, value);
            // A card's picture is the art alone: the block draws the frame around it.
            return IMAGE_KINDS[kindId].framed ? setFenceFlag(set, target.fence, "framed", true) : set;
          });
        }
      }
      new Notice(`Image saved for ${what}.`);
      onSaved?.();
      setMade(null);
      if (file) setText(await app.vault.read(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
    }
  };

  const provider = settings.imageProvider === "ollama" ? settings.ollamaUrl : settings.geminiUrl;

  return (
    <div className="rpg-image-studio">
      <div className="rpg-image-studio-controls">
        {!card && (
          <label className="rpg-image-studio-field">
            <span>Note</span>
            <NoteCombobox
              value={query}
              options={notes}
              placeholder="Find a note…"
              onChange={(v, note) => {
                setQuery(v);
                if (!note) return;
                const f = app.vault.getAbstractFileByPath(`${note.folder ? `${note.folder}/` : ""}${note.name}.md`);
                if (f instanceof TFile) setFile(f);
              }}
            />
          </label>
        )}

        {(file || card) && (
          <label className="rpg-image-studio-field">
            <span>Image</span>
            <select className="dropdown" value={targetIndex} onChange={(e) => setTargetIndex(Number(e.target.value))}>
              {targets.map((t, i) => (
                <option key={i} value={i}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
        )}

        {target && (
          <>
            <label className="rpg-image-studio-field">
              <span>Kind</span>
              <select className="dropdown" value={kindId} onChange={(e) => setKindId(e.target.value as ImageKindId)}>
                {Object.values(IMAGE_KINDS).map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.label}
                    {k.cutout ? " — transparent" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="rpg-image-studio-field">
              <span>Prompt — filled from the note</span>
              <textarea rows={8} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
            </label>
            <label className="rpg-image-studio-field">
              <span>Your additions</span>
              <textarea
                rows={2}
                value={additions}
                placeholder="Anything to add — a colour, a pose, a detail…"
                onChange={(e) => setAdditions(e.target.value)}
              />
            </label>
            <div className="rpg-image-studio-row">
              <select
                className="dropdown"
                value={aspect}
                onChange={(e) => setAspect(e.target.value as Aspect)}
                aria-label="Aspect ratio"
              >
                {ASPECTS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!!busy || !settings.anthropicUrl.trim()}
                onClick={() => void draft()}
                title="Draft visual details from the note, into your additions"
              >
                {busy === "draft" ? "Drafting…" : "Draft details"}
              </button>
              <button
                type="button"
                disabled={!!busy || !current}
                onClick={() => void cleanUp()}
                title="Finish the image there now as a new one would be — its margin or white corners cleared"
              >
                Clean up current
              </button>
              <button
                type="button"
                className="mod-cta"
                disabled={!!busy || !provider.trim()}
                onClick={() => void generate()}
              >
                {busy === "generate" ? "Making…" : made ? "Make another" : "Make image"}
              </button>
            </div>
            {!provider.trim() && (
              <p className="rpg-image-studio-note">Set an image link in the plugin's settings to make images.</p>
            )}
          </>
        )}
        {error && <p className="rpg-image-studio-error">{error}</p>}
      </div>

      <div className="rpg-image-studio-previews">
        <figure>
          <figcaption>Now</figcaption>
          {current ? <img src={current.url} alt="" /> : <div className="rpg-image-studio-empty">No image yet</div>}
          {current && <small>{current.file.path}</small>}
        </figure>
        <figure>
          <figcaption>New</figcaption>
          {made ? (
            // The art alone, filling its space: the frame is the plugin's, drawn later.
            <img src={made.url} alt="" />
          ) : (
            <div className="rpg-image-studio-empty">{busy === "generate" ? "Making…" : "Make one to see it here"}</div>
          )}
          {made && (
            <small>
              WebP · {made.width}×{made.height} · {Math.round(made.data.byteLength / 1024)} KB
              {currentSize && made.width === currentSize.w && made.height === currentSize.h
                ? " · same size as now"
                : ""}
            </small>
          )}
        </figure>
        <div className="rpg-image-studio-row rpg-image-studio-decide">
          <button type="button" disabled={!made || !!busy} onClick={() => setMade(null)}>
            Discard
          </button>
          <button type="button" className="mod-cta" disabled={!made || !!busy} onClick={() => void accept()}>
            {busy === "save" ? "Saving…" : current ? "Replace" : "Add"}
          </button>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
