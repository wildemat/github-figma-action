const axios = require("axios");

/**
 * Figma API functions for fetching design data and images
 */

/**
 * Creates standard headers for Figma API requests
 * @param {string} figmaToken - Figma API token
 * @returns {Object} Headers object for axios requests
 */
function getFigmaHeaders(figmaToken) {
  return { "X-Figma-Token": figmaToken };
}

/**
 * Fetches the latest version information for a Figma file
 * @param {string} fileId - Figma file ID
 * @param {string} figmaToken - Figma API token
 * @returns {Promise<{id: string, created_at: string}>} Latest version info
 */
async function fetchLatestVersion(fileId, figmaToken) {
  const response = await axios.get(
    `https://api.figma.com/v1/files/${fileId}/versions`,
    { headers: getFigmaHeaders(figmaToken) }
  );
  return response.data.versions[0];
}

/**
 * Fetches the image URL for a specific node in a Figma file
 * @param {string} fileId - Figma file ID
 * @param {string} nodeId - Figma node ID (in colon format)
 * @param {string} figmaToken - Figma API token
 * @returns {Promise<string>} Image URL from Figma API
 */
async function fetchNodeImageUrl(fileId, nodeId, figmaToken) {
  const response = await axios.get(
    `https://api.figma.com/v1/images/${fileId}?ids=${nodeId}&format=png`,
    { headers: getFigmaHeaders(figmaToken) }
  );
  
  const imageUrl = response.data.images[nodeId];
  if (!imageUrl) {
    throw new Error(`Could not get image for node ${nodeId}`);
  }
  
  return imageUrl;
}

/**
 * Downloads image data from a URL
 * @param {string} imageUrl - URL of the image to download
 * @returns {Promise<Buffer>} Image data as buffer
 */
async function downloadImageData(imageUrl) {
  const response = await axios.get(imageUrl, {
    responseType: "arraybuffer",
  });
  return response.data;
}

/**
 * Creates a version object from existing version ID
 * @param {string} versionId - Existing version ID from URL
 * @returns {{id: string, created_at: string}} Version object
 */
function createVersionFromId(versionId) {
  return {
    id: versionId,
    created_at: new Date().toISOString(), // Use current timestamp as fallback
  };
}

/**
 * Parses a Figma URL to extract all relevant components
 * @param {string} url - Full Figma URL
 * @returns {{fileId: string, nodeId: string, versionId: string|null} | null} Parsed components or null if invalid
 */
function parseFigmaUrl(url) {
  const fileIdMatch = url.match(/\/design\/([^/]+)\//);
  const nodeIdMatch = url.match(/node-id=([^&\s)]+)/);
  const versionMatch = url.match(/version-id=([^&\s)]+)/);
  
  if (fileIdMatch && nodeIdMatch) {
    return {
      fileId: fileIdMatch[1],
      nodeId: nodeIdMatch[1].replace("-", ":"), // Convert to colon format
      versionId: versionMatch ? versionMatch[1] : null
    };
  }
  
  return null;
}

/**
 * Processes a Figma link to extract file ID and node ID (legacy function for compatibility)
 * @param {string} url - Full Figma URL
 * @returns {{fileId: string, nodeId: string} | null} Extracted IDs or null if invalid
 * @deprecated Use parseFigmaUrl instead
 */
function extractFigmaIds(url) {
  const parsed = parseFigmaUrl(url);
  return parsed ? { fileId: parsed.fileId, nodeId: parsed.nodeId } : null;
}

/**
 * Extracts version ID from Figma URL if present (legacy function for compatibility)
 * @param {string} url - Figma URL that might contain version-id parameter
 * @returns {string | null} Version ID if found, null otherwise
 * @deprecated Use parseFigmaUrl instead
 */
function extractVersionId(url) {
  const parsed = parseFigmaUrl(url);
  return parsed ? parsed.versionId : null;
}

module.exports = {
  getFigmaHeaders,
  fetchLatestVersion,
  fetchNodeImageUrl,
  downloadImageData,
  createVersionFromId,
  parseFigmaUrl,
  extractFigmaIds,
  extractVersionId
};