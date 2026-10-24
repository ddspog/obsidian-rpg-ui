/** The few glob patterns a simulator's manifest uses to pick vault notes: `*` within a folder, `**` across. */
export function globToRegExp(pattern) {
  let re = "";
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === "*") {
      if (pattern[i + 1] === "*") {
        i++;
        if (pattern[i + 1] === "/") {
          i++;
          re += "(?:.*/)?";
        } else re += ".*";
      } else re += "[^/]*";
    } else if (c === "?") re += "[^/]";
    else re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`);
}

/** Whether `path` is in `include` (all when empty) and not in `exclude`. */
export function picks(path, include = [], exclude = []) {
  const hit = (list) => list.some((g) => globToRegExp(g).test(path));
  return (include.length === 0 || hit(include)) && !hit(exclude);
}
