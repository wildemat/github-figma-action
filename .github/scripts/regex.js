// Regular expressions for parsing Figma URLs and markdown content

/**
 * Regex patterns for Figma URL parsing and content processing
 */

// Matches Figma design URLs with node-id parameter
const FIGMA_URL_REGEX = /https:\/\/www\.figma\.com\/design\/([^/]+)\/[^?\s)]*\?[^\s)]*node-id=([^&\s)]+)[^\s)]*/g;

// Matches markdown links containing Figma URLs
const MARKDOWN_FIGMA_LINK_REGEX = /\[([^\]]+)\]\((https:\/\/www\.figma\.com\/design\/[^)]+node-id=[^)]+)\)/g;

// Matches Design Specs section heading (case-insensitive)
const DESIGN_SPECS_SECTION_REGEX = /## Design Specs/i;

// Matches next markdown section heading
const NEXT_SECTION_REGEX = /\n## /;

// Matches existing Figma URLs in content
const EXISTING_FIGMA_LINKS_REGEX = /https:\/\/www\.figma\.com\/design\/[^\s)]+/g;

// Matches version-id parameter in Figma URLs
const VERSION_ID_REGEX = /version-id=([^&\s)]+)/;

// Matches file ID in Figma URL
const FILE_ID_REGEX = /\/design\/([^/]+)\//;

// Matches node ID in Figma URL
const NODE_ID_REGEX = /node-id=([^&\s)]+)/;

module.exports = {
  FIGMA_URL_REGEX,
  MARKDOWN_FIGMA_LINK_REGEX,
  DESIGN_SPECS_SECTION_REGEX,
  NEXT_SECTION_REGEX,
  EXISTING_FIGMA_LINKS_REGEX,
  VERSION_ID_REGEX,
  FILE_ID_REGEX,
  NODE_ID_REGEX
};