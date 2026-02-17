/**
 * Field Definition Parser
 * 
 * Handles parsing of frontmatter field definitions
 */

import { FrontmatterFieldDef } from "../types";

/**
 * Parse frontmatter field definitions from array
 * 
 * @param fields - Array of field definitions from YAML
 * @returns Parsed field definitions with defaults and aliases
 */
export function parseFieldDefinitions(fields: any[]): FrontmatterFieldDef[] {
  if (!Array.isArray(fields)) {
    return [];
  }

  return fields.map((field) => {
    const def: FrontmatterFieldDef = {
      name: field.name,
      type: field.type || "string",
    };

    if (field.default !== undefined) {
      def.default = field.default;
    }
    if (field.derived) {
      def.derived = field.derived;
    }
    if (field.aliases) {
      def.aliases = Array.isArray(field.aliases) ? field.aliases : [field.aliases];
    }

    return def;
  });
}
