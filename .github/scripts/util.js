/**
 * Utility functions for formatting and text processing
 */

/**
 * Calculates the expiration date for Figma image URLs (30 days from now)
 * @returns {string} Expiration date in YYYY-MM-DD format
 */
function calculateImageExpirationDate() {
  const expirationDate = new Date();
  expirationDate.setDate(expirationDate.getDate() + 30);
  return expirationDate.toISOString().split("T")[0];
}

/**
 * Creates a clean Figma URL with only essential parameters
 * @param {string} fileId - Figma file ID
 * @param {string} nodeId - Figma node ID (in colon format, e.g., "3143:20344")
 * @param {string} versionId - Figma version ID
 * @returns {string} Clean Figma URL
 */
function createCleanFigmaUrl(fileId, nodeId, versionId) {
  const dashNodeId = nodeId.replace(":", "-");
  return `https://www.figma.com/design/${fileId}/?node-id=${dashNodeId}&version-id=${versionId}&m=dev`;
}

/**
 * Converts node ID from dash format to colon format
 * @param {string} nodeId - Node ID in dash format (e.g., "3143-20344")
 * @returns {string} Node ID in colon format (e.g., "3143:20344")
 */
function convertNodeIdToColonFormat(nodeId) {
  return nodeId.replace("-", ":");
}

/**
 * Creates a design spec snippet for the Design Specs section with protected markers
 * @param {number} specNumber - Sequential spec number
 * @param {string} specId - Anchor ID for the spec
 * @param {string} attachmentUrl - URL of the design preview image
 * @param {string} cleanUrl - Clean Figma URL
 * @param {string} versionId - Figma version ID
 * @param {string} snapshotTimestamp - Version creation timestamp
 * @param {string} expirationString - Image expiration date
 * @returns {string} Formatted design spec markdown
 */
function createDesignSpecSnippet(
  specNumber,
  specId,
  attachmentUrl,
  cleanUrl,
  versionId,
  snapshotTimestamp,
  expirationString
) {
  const startMarker = `<!-- START_SPEC_${specNumber} - DO NOT EDIT CONTENT BELOW -->`;
  const endMarker = `<!-- END_SPEC_${specNumber} - DO NOT EDIT CONTENT ABOVE -->`;

  return `
${startMarker}

<a id="${specId}"></a>

<details>
<summary><strong>🎨 Design Spec ${specNumber}</strong> <a href="#${specId}">#</a></summary>

<br>

<kbd><img alt="Figma Design Preview" src="${attachmentUrl}" /></kbd>

<details>
<summary>📋 Spec Details</summary>

**Design Link:** [View in Figma](${cleanUrl}) (Cmd+Click to open in new tab)

**Version:** ${versionId}

**Snapshot Timestamp:** ${snapshotTimestamp}

**Image Expires:** ${expirationString}

**Description: <enter description here>**

</details>

</details>

---

${endMarker}

`;
}

/**
 * Creates a reference text to replace original Figma URLs
 * @param {boolean} isMarkdownLink - Whether the original was a markdown link
 * @param {string|null} linkText - Text from markdown link (null for standalone URLs)
 * @param {number} specNumber - Sequential spec number
 * @param {string} specId - Anchor ID for the spec
 * @returns {string} Reference text to replace original URL
 */
function createReferenceText(isMarkdownLink, linkText, specNumber, specId) {
  if (isMarkdownLink && linkText) {
    return `${linkText} ([Refer to Design Spec ${specNumber} below](#${specId}))`;
  } else {
    return `[Refer to Design Spec ${specNumber} below](#${specId})`;
  }
}

/**
 * Generates the end marker comment for the Design Specs section
 * @returns {string} HTML comment marker
 */
function getDesignSpecsEndMarker() {
  return "<!-- END_DESIGN_SPECS - WILL NOT DETECT FIGMA LINKS BELOW THIS LINE -->";
}

/**
 * Finds the index of content between start and end positions
 * @param {string} content - Full content string
 * @param {number} startIndex - Start position
 * @param {number} endIndex - End position (-1 if no end)
 * @param {RegExp} nextSectionRegex - Regex to find next section if no end marker
 * @returns {string} Content between positions
 */
function extractSectionContent(
  content,
  startIndex,
  endIndex,
  nextSectionRegex
) {
  if (endIndex > startIndex) {
    return content.substring(startIndex, endIndex);
  } else {
    const section = content.substring(startIndex);
    const nextSectionMatch = section.match(nextSectionRegex);
    return nextSectionMatch
      ? section.substring(0, nextSectionMatch.index)
      : section;
  }
}

/**
 * Creates a standardized link object from parsed Figma URL components
 * @param {string} url - Original Figma URL
 * @param {string} fileId - Figma file ID
 * @param {string} nodeId - Figma node ID (in colon format)
 * @param {string} fullMatch - Complete matched text (URL or markdown link)
 * @param {boolean} isMarkdownLink - Whether this was originally a markdown link
 * @param {string|null} linkText - Text from markdown link (null for standalone URLs)
 * @param {boolean} isInSpecsSection - Whether this link was found within the Design Specs section
 * @returns {Object} Standardized link object
 */
function createLinkObject(
  url,
  fileId,
  nodeId,
  fullMatch,
  isMarkdownLink,
  linkText = null,
  isInSpecsSection = false
) {
  return {
    url,
    fileId,
    nodeId,
    fullMatch,
    isMarkdownLink,
    linkText,
    isInSpecsSection,
  };
}

/**
 * Extracts unprotected content from Design Specs section (content outside of spec entry markers)
 * @param {string} specsSectionContent - Content of the Design Specs section
 * @returns {string} Content that is not within protected spec entry markers
 */
function extractUnprotectedSpecsContent(specsSectionContent) {
  // Remove all content between START_SPEC_X and END_SPEC_X markers
  const protectedRegex =
    /<!-- START_SPEC_\d+ - DO NOT EDIT CONTENT BELOW -->[\s\S]*?<!-- END_SPEC_\d+ - DO NOT EDIT CONTENT ABOVE -->/g;
  return specsSectionContent.replace(protectedRegex, "");
}

module.exports = {
  calculateImageExpirationDate,
  createCleanFigmaUrl,
  convertNodeIdToColonFormat,
  createDesignSpecSnippet,
  createReferenceText,
  getDesignSpecsEndMarker,
  extractSectionContent,
  createLinkObject,
  extractUnprotectedSpecsContent,
};
