// Regular expressions for parsing Figma URLs and markdown content

/**
 * Regex patterns for Figma URL parsing and content processing
 */

// Base Figma URL pattern components
const FIGMA_BASE_URL = 'https:\\/\\/www\\.figma\\.com\\/design\\/';
const FILE_ID_PATTERN = '([^/]+)';
const FILE_NAME_PATTERN = '[^?\\s)]*';
const QUERY_PARAMS_PATTERN = '[^\\s)]*';
const NODE_ID_PATTERN = '([^&\\s)]+)';

// Complete Figma URL pattern with node-id (captures file ID and node ID)
const FIGMA_URL_PATTERN = `${FIGMA_BASE_URL}${FILE_ID_PATTERN}\\/${FILE_NAME_PATTERN}\\?${QUERY_PARAMS_PATTERN}node-id=${NODE_ID_PATTERN}[^\\s)]*`;

// Example input: "https://www.figma.com/design/PtEQFlGwta7PzrMwRjqquH/Homepage--9.2?node-id=3143-20344&m=dev"
// Example output: Match with groups [1]="PtEQFlGwta7PzrMwRjqquH", [2]="3143-20344"
const FIGMA_URL_REGEX = new RegExp(FIGMA_URL_PATTERN, 'g');

// Example input: "[homepage design](https://www.figma.com/design/PtEQFlGwta7PzrMwRjqquH/Homepage--9.2?node-id=3143-20344)"
// Example output: Match with groups [1]="homepage design", [2]="https://www.figma.com/design/PtEQFlGwta7PzrMwRjqquH/Homepage--9.2?node-id=3143-20344"
const MARKDOWN_FIGMA_LINK_REGEX = new RegExp(`\\[([^\\]]+)\\]\\((${FIGMA_URL_PATTERN})\\)`, 'g');

// Example input: "Check https://www.figma.com/design/abc123/test?node-id=1-2 for reference"
// Example output: Match "https://www.figma.com/design/abc123/test?node-id=1-2"
const EXISTING_FIGMA_LINKS_REGEX = new RegExp(`${FIGMA_BASE_URL}[^\\s)]+`, 'g');

// Individual component patterns for parsing

// Example input: "https://www.figma.com/design/PtEQFlGwta7PzrMwRjqquH/Homepage"
// Example output: Match with group [1]="PtEQFlGwta7PzrMwRjqquH"
const FILE_ID_REGEX = /\/design\/([^/]+)\//;

// Example input: "?node-id=3143-20344&m=dev"
// Example output: Match with group [1]="3143-20344"
const NODE_ID_REGEX = /node-id=([^&\s)]+)/;

// Example input: "?node-id=3143-20344&version-id=2260315635405056828&m=dev"
// Example output: Match with group [1]="2260315635405056828"
const VERSION_ID_REGEX = /version-id=([^&\s)]+)/;

// Section and content patterns

// Example input: "## Design Specs" or "## design specs"
// Example output: Match "## Design Specs"
const DESIGN_SPECS_SECTION_REGEX = /## Design Specs/i;

// Example input: "Some content\n## Next Section"
// Example output: Match "\n## " (to find where next section starts)
const NEXT_SECTION_REGEX = /\n## /;

// Example input: "### Design Spec 1\n### Design Spec 2"
// Example output: Match "### Design Spec 1", "### Design Spec 2"
const DESIGN_SPEC_HEADER_REGEX = /### Design Spec \d+/g;

module.exports = {
  FIGMA_URL_REGEX,
  MARKDOWN_FIGMA_LINK_REGEX,
  DESIGN_SPECS_SECTION_REGEX,
  NEXT_SECTION_REGEX,
  EXISTING_FIGMA_LINKS_REGEX,
  DESIGN_SPEC_HEADER_REGEX,
  VERSION_ID_REGEX,
  FILE_ID_REGEX,
  NODE_ID_REGEX
};