/**
 * D&D 5e Experience Point Table
 *
 * XP thresholds for each character level. Index 0 = XP required to reach level 1,
 * index 1 = level 2, and so on through level 20.
 *
 * Source: D&D 5e Player's Handbook, Chapter 1 (Beyond 1st Level table)
 */

const xpTable: number[] = [
  0,      // Level 1
  300,    // Level 2
  900,    // Level 3
  2700,   // Level 4
  6500,   // Level 5
  14000,  // Level 6
  23000,  // Level 7
  34000,  // Level 8
  48000,  // Level 9
  64000,  // Level 10
  85000,  // Level 11
  100000, // Level 12
  120000, // Level 13
  140000, // Level 14
  165000, // Level 15
  195000, // Level 16
  225000, // Level 17
  265000, // Level 18
  305000, // Level 19
  355000, // Level 20
];

export default xpTable;
