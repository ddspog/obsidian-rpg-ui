/**
 * `obsidian` for the headless CLI: the plugin's Node shim (parseYaml,
 * getFrontMatterInfo, stub classes), with real file classes the CLI's vault
 * hands out, so the plugin's `instanceof TFile` checks hold.
 */

export * from "../../scripts/obsidian-shim.js";

export class TAbstractFile {
  path = "";
  name = "";
  parent: TFolder | null = null;
  vault: unknown = null;
}

export class TFile extends TAbstractFile {
  basename = "";
  extension = "";
  stat = { ctime: 0, mtime: 0, size: 0 };
  constructor(path = "") {
    super();
    this.path = path;
    this.name = path.split("/").pop() ?? "";
    const dot = this.name.lastIndexOf(".");
    this.extension = dot > 0 ? this.name.slice(dot + 1) : "";
    this.basename = dot > 0 ? this.name.slice(0, dot) : this.name;
  }
}

export class TFolder extends TAbstractFile {
  children: TAbstractFile[] = [];
  constructor(path = "") {
    super();
    this.path = path;
    this.name = path.split("/").pop() ?? "";
  }
  isRoot(): boolean {
    return this.path === "" || this.path === "/";
  }
}
export class FuzzySuggestModal {
  constructor(..._args: unknown[]) {}
}
