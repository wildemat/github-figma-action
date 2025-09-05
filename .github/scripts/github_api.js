const axios = require("axios");

/**
 * GitHub API functions for PR operations
 */

/**
 * Fetches the current PR body from GitHub API
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} prNumber - Pull request number
 * @param {string} githubToken - GitHub API token
 * @returns {Promise<string>} Current PR body content
 */
async function fetchCurrentPRBody(owner, repo, prNumber, githubToken) {
  const response = await axios.get(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`,
    {
      headers: {
        Authorization: `token ${githubToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    }
  );
  return response.data.body || "";
}

/**
 * Updates the PR description with new content
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} prNumber - Pull request number
 * @param {string} updatedBody - New PR body content
 * @param {string} githubToken - GitHub API token
 * @returns {Promise<number>} HTTP status code of the update request
 */
async function updatePRDescription(owner, repo, prNumber, updatedBody, githubToken) {
  const response = await axios.patch(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`,
    { body: updatedBody },
    {
      headers: {
        Authorization: `token ${githubToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    }
  );
  return response.status;
}

/**
 * Parses repository information from environment variable
 * @param {string} repoString - Repository string in format "owner/repo"
 * @returns {{owner: string, repo: string} | null} Parsed owner and repo or null if invalid
 */
function parseRepositoryInfo(repoString) {
  if (!repoString) return null;
  
  const [owner, repo] = repoString.split("/");
  if (!owner || !repo) return null;
  
  return { owner, repo };
}

/**
 * Validates required environment variables for GitHub operations
 * @param {Object} env - Environment variables object
 * @param {string} env.FIGMA_TOKEN - Figma API token
 * @param {string} env.GITHUB_TOKEN - GitHub API token  
 * @param {string} env.PR_NUMBER - Pull request number
 * @param {string} env.GITHUB_REPOSITORY - Repository in owner/repo format
 * @returns {{isValid: boolean, missing: string[]}} Validation result
 */
function validateEnvironmentVariables(env) {
  const required = ['FIGMA_TOKEN', 'GITHUB_TOKEN', 'PR_NUMBER', 'GITHUB_REPOSITORY'];
  const missing = required.filter(key => !env[key]);
  
  return {
    isValid: missing.length === 0,
    missing
  };
}

module.exports = {
  fetchCurrentPRBody,
  updatePRDescription,
  parseRepositoryInfo,
  validateEnvironmentVariables
};