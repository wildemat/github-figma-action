#!/usr/bin/env node

const axios = require("axios");

async function main() {
  const figmaToken = process.env.FIGMA_TOKEN;
  const githubToken = process.env.GITHUB_TOKEN;
  const prNumber = process.env.PR_NUMBER;
  let prBody = process.env.PR_BODY || "";

  if (!figmaToken || !githubToken || !prNumber) {
    console.error("Missing required environment variables");
    process.exit(1);
  }

  // Get current PR body from API to ensure we have the latest version
  try {
    const repoInfo = process.env.GITHUB_REPOSITORY || "";
    const [owner, repo] = repoInfo.split("/");
    
    if (owner && repo) {
      console.log(`Fetching current PR body for #${prNumber} in ${owner}/${repo}...`);
      const prResponse = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`,
        {
          headers: {
            Authorization: `token ${githubToken}`,
            Accept: "application/vnd.github.v3+json",
          },
        }
      );
      prBody = prResponse.data.body || "";
      console.log(`Current PR body length: ${prBody.length}`);
    }
  } catch (error) {
    console.log("Could not fetch current PR body, using provided body:", error.message);
  }

  // Check if Screenshots section exists
  const screenshotsRegex = /## Screenshots/i;
  const hasScreenshotsSection = screenshotsRegex.test(prBody);
  
  let screenshotsSectionIndex = -1;
  if (hasScreenshotsSection) {
    screenshotsSectionIndex = prBody.search(screenshotsRegex);
  }

  // Only look for Figma URLs above the Screenshots section (or entire body if no section exists)
  const contentToSearch = hasScreenshotsSection ? 
    prBody.substring(0, screenshotsSectionIndex) : 
    prBody;

  // Regex to find Figma URLs
  const figmaUrlRegex =
    /https:\/\/www\.figma\.com\/design\/([^/]+)\/[^?]*\?[^#]*node-id=([^&]+)/g;

  let match;
  const figmaLinks = [];

  while ((match = figmaUrlRegex.exec(contentToSearch)) !== null) {
    figmaLinks.push({
      url: match[0],
      fileId: match[1],
      nodeId: match[2].replace("-", ":"), // Convert 3143-20344 to 3143:20344
      originalIndex: match.index, // Store original position for replacement
    });
  }

  if (figmaLinks.length === 0) {
    console.log("No Figma links found above Screenshots section");
    return;
  }

  console.log(`Found ${figmaLinks.length} Figma link(s) above Screenshots section`);

  let updatedBody = prBody;
  let screenshotsContent = "";

  for (let i = 0; i < figmaLinks.length; i++) {
    const link = figmaLinks[i];
    try {
      // Get file version
      const versionResponse = await axios.get(
        `https://api.figma.com/v1/files/${link.fileId}/versions`,
        { headers: { "X-Figma-Token": figmaToken } }
      );

      const latestVersion = versionResponse.data.versions[0];

      // Get node image
      const imageResponse = await axios.get(
        `https://api.figma.com/v1/images/${link.fileId}?ids=${link.nodeId}&format=png`,
        { headers: { "X-Figma-Token": figmaToken } }
      );

      const imageUrl = imageResponse.data.images[link.nodeId];

      if (!imageUrl) {
        console.log(`Could not get image for node ${link.nodeId}`);
        continue;
      }

      // Download the image
      console.log(`Downloading image for ${link.url}...`);
      const imageData = await axios.get(imageUrl, {
        responseType: "arraybuffer",
      });

      // Use the temporary Figma URL (valid for 30 days)
      console.log(`Using Figma image URL (expires in 30 days): ${imageUrl}`);
      
      // Calculate expiration date (30 days from now)
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 30);
      const expirationString = expirationDate.toISOString().split('T')[0]; // YYYY-MM-DD format
      
      const attachmentUrl = imageUrl;

      // Create screenshot entry for Screenshots section
      const screenshotNumber = i + 1;
      const screenshotId = `screenshot-${screenshotNumber}`;
      const screenshotSnippet = `
### Screenshot ${screenshotNumber}

**Design Link:** [View in Figma](${link.url})

**Version:** ${latestVersion.id}

**Snapshot Timestamp:** ${latestVersion.created_at}

**Image Expires:** ${expirationString}

<kbd><img alt="Figma Design Preview" src="${attachmentUrl}" /></kbd>

`;

      screenshotsContent += screenshotSnippet;

      // Replace the original Figma URL with a reference
      const referenceText = `[Refer to Screenshot ${screenshotNumber} below](#${screenshotId})`;
      updatedBody = updatedBody.replace(link.url, referenceText);
      
      console.log(`Processed Figma link ${i + 1}/${figmaLinks.length}: ${link.url}`);
    } catch (error) {
      console.error(`Error processing Figma link ${link.url}:`, error.message);
    }
  }

  // Add or update Screenshots section
  if (screenshotsContent) {
    if (hasScreenshotsSection) {
      // Append to existing Screenshots section
      const afterScreenshotsSection = prBody.substring(screenshotsSectionIndex);
      const nextSectionMatch = afterScreenshotsSection.match(/\n## /);
      
      if (nextSectionMatch) {
        // There's another section after Screenshots
        const nextSectionIndex = screenshotsSectionIndex + nextSectionMatch.index;
        updatedBody = updatedBody.substring(0, nextSectionIndex) + 
                     screenshotsContent + 
                     updatedBody.substring(nextSectionIndex);
      } else {
        // Screenshots is the last section, append at the end
        updatedBody += screenshotsContent;
      }
    } else {
      // Create new Screenshots section at the end
      updatedBody += `\n## Screenshots\n${screenshotsContent}`;
    }
    console.log(`Added ${figmaLinks.length} screenshot(s) to Screenshots section`);
  }

  // Update PR description if changes were made
  if (updatedBody !== prBody) {
    try {
      const repoInfo = process.env.GITHUB_REPOSITORY || "";
      const [owner, repo] = repoInfo.split("/");

      if (!owner || !repo) {
        console.error("Could not parse repository info");
        return;
      }
      console.log(`Updating PR #${prNumber} in ${owner}/${repo}...`);
      console.log(`Original body length: ${prBody.length}`);
      console.log(`Updated body length: ${updatedBody.length}`);
      console.log(`Body diff: ${updatedBody.length - prBody.length} characters added`);

      const result = await axios.patch(
        `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`,
        { body: updatedBody },
        {
          headers: {
            Authorization: `token ${githubToken}`,
            Accept: "application/vnd.github.v3+json",
          },
        }
      );

      console.log("PR update response status:", result.status);

      console.log("Successfully updated PR description with Figma previews");
    } catch (error) {
      console.error("Error updating PR:", error.message);
    }
  } else {
    console.log("No updates needed");
  }
}

main().catch((error) => {
  console.error("Script failed:", error);
  process.exit(1);
});
