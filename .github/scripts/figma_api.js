const axios = require("axios");

/**
 * Figma API functions for fetching design data and images
 */

/**
 * Fetches the latest version information for a Figma file
 * @param {string} fileId - Figma file ID
 * @param {string} figmaToken - Figma API token
 * @returns {Promise<{id: string, created_at: string}>} Latest version info
 */
async function fetchLatestVersion(fileId, figmaToken) {
  const response = await axios.get(
    `https://api.figma.com/v1/files/${fileId}/versions`,
    { headers: { "X-Figma-Token": figmaToken } }
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
    { headers: { "X-Figma-Token": figmaToken } }
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
 * Processes a Figma link to extract file ID and node ID
 * @param {string} url - Full Figma URL
 * @returns {{fileId: string, nodeId: string} | null} Extracted IDs or null if invalid
 */
function extractFigmaIds(url) {
  const fileIdMatch = url.match(/\/design\/([^/]+)\//);
  const nodeIdMatch = url.match(/node-id=([^&\s)]+)/);
  
  if (fileIdMatch && nodeIdMatch) {
    return {
      fileId: fileIdMatch[1],
      nodeId: nodeIdMatch[1].replace("-", ":") // Convert to colon format
    };
  }
  
  return null;
}

/**
 * Extracts version ID from Figma URL if present
 * @param {string} url - Figma URL that might contain version-id parameter
 * @returns {string | null} Version ID if found, null otherwise
 */
function extractVersionId(url) {
  const versionMatch = url.match(/version-id=([^&\s)]+)/);
  return versionMatch ? versionMatch[1] : null;
}

module.exports = {
  fetchLatestVersion,
  fetchNodeImageUrl,
  downloadImageData,
  createVersionFromId,
  extractFigmaIds,
  extractVersionId
};