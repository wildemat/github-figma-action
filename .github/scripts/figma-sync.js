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

  // Check if Screenshots section exists and count existing screenshots
  const screenshotsRegex = /## Screenshots/i;
  const hasScreenshotsSection = screenshotsRegex.test(prBody);
  const screenshotsEndMarker = "<!-- END_SCREENSHOTS - DO NOT EDIT BELOW THIS LINE -->";
  
  let screenshotsSectionIndex = -1;
  let existingScreenshotCount = 0;
  let screenshotsEndIndex = -1;
  
  if (hasScreenshotsSection) {
    screenshotsSectionIndex = prBody.search(screenshotsRegex);
    screenshotsEndIndex = prBody.indexOf(screenshotsEndMarker);
    
    // Count existing figma links in the Screenshots section
    let screenshotsSectionContent;
    if (screenshotsEndIndex > screenshotsSectionIndex) {
      // Use content between ## Screenshots and the end marker
      screenshotsSectionContent = prBody.substring(screenshotsSectionIndex, screenshotsEndIndex);
    } else {
      // No end marker found, use until next section or end of body
      const screenshotsSection = prBody.substring(screenshotsSectionIndex);
      const nextSectionMatch = screenshotsSection.match(/\n## /);
      screenshotsSectionContent = nextSectionMatch ? 
        screenshotsSection.substring(0, nextSectionMatch.index) : 
        screenshotsSection;
    }
    
    const existingFigmaLinks = screenshotsSectionContent.match(/https:\/\/www\.figma\.com\/design\/[^\s)]+/g);
    existingScreenshotCount = existingFigmaLinks ? existingFigmaLinks.length : 0;
    
    console.log(`Found ${existingScreenshotCount} existing figma link(s) in Screenshots section`);
  }

  // Only look for Figma URLs above the Screenshots section (or entire body if no section exists)
  const contentToSearch = hasScreenshotsSection ? 
    prBody.substring(0, screenshotsSectionIndex) : 
    prBody;

  // Regex to find Figma URLs - captures the complete URL until whitespace or closing parenthesis
  const figmaUrlRegex =
    /https:\/\/www\.figma\.com\/design\/([^/]+)\/[^?\s)]*\?[^\s)]*node-id=([^&\s)]+)[^\s)]*/g;

  let match;
  const figmaLinks = [];

  // First, find markdown links with Figma URLs
  const markdownLinkRegex = /\[([^\]]+)\]\((https:\/\/www\.figma\.com\/design\/[^)]+node-id=[^)]+)\)/g;
  let markdownMatch;
  
  while ((markdownMatch = markdownLinkRegex.exec(contentToSearch)) !== null) {
    const linkText = markdownMatch[1];
    const fullUrl = markdownMatch[2];
    
    // Extract fileId and nodeId from the URL
    const fileIdMatch = fullUrl.match(/\/design\/([^/]+)\//);
    const nodeIdMatch = fullUrl.match(/node-id=([^&\s)]+)/);
    
    if (fileIdMatch && nodeIdMatch) {
      figmaLinks.push({
        url: fullUrl,
        fileId: fileIdMatch[1],
        nodeId: nodeIdMatch[1].replace("-", ":"),
        originalIndex: markdownMatch.index,
        fullMatch: markdownMatch[0], // The entire markdown link
        isMarkdownLink: true,
        linkText: linkText,
      });
    }
  }

  // Then find standalone Figma URLs
  while ((match = figmaUrlRegex.exec(contentToSearch)) !== null) {
    const fullUrl = match[0];
    
    // Skip if this URL is already captured as part of a markdown link
    const alreadyProcessed = figmaLinks.some(link => link.url === fullUrl);
    if (alreadyProcessed) continue;
    
    // Extract fileId and nodeId from the URL
    const fileIdMatch = fullUrl.match(/\/design\/([^/]+)\//);
    const nodeIdMatch = fullUrl.match(/node-id=([^&\s)]+)/);
    
    if (fileIdMatch && nodeIdMatch) {
      figmaLinks.push({
        url: fullUrl,
        fileId: fileIdMatch[1],
        nodeId: nodeIdMatch[1].replace("-", ":"),
        originalIndex: match.index,
        fullMatch: fullUrl,
        isMarkdownLink: false,
        linkText: null,
      });
    }
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

      // Create screenshot entry for Screenshots section (continue numbering from existing screenshots)
      const screenshotNumber = existingScreenshotCount + i + 1;
      const screenshotId = `screenshot-${screenshotNumber}`;
      // Clean the URL to only include essential parameters
      const cleanUrl = `https://www.figma.com/design/${link.fileId}/?node-id=${link.nodeId.replace(":", "-")}`;
      
      const screenshotSnippet = `
### Screenshot ${screenshotNumber}

**Design Link:** [View in Figma](${cleanUrl})

**Version:** ${latestVersion.id}

**Snapshot Timestamp:** ${latestVersion.created_at}

**Image Expires:** ${expirationString}

<kbd><img alt="Figma Design Preview" src="${attachmentUrl}" /></kbd>

`;

      screenshotsContent += screenshotSnippet;

      // Replace the original Figma URL/link with a reference
      let referenceText;
      if (link.isMarkdownLink) {
        // For markdown links: [text](url) becomes "text ([Refer to Screenshot X below](#screenshot-x))"
        referenceText = `${link.linkText} ([Refer to Screenshot ${screenshotNumber} below](#${screenshotId}))`;
      } else {
        // For standalone URLs: url becomes "[Refer to Screenshot X below](#screenshot-x)"
        referenceText = `[Refer to Screenshot ${screenshotNumber} below](#${screenshotId})`;
      }
      updatedBody = updatedBody.replace(link.fullMatch, referenceText);
      
      console.log(`Processed Figma link ${i + 1}/${figmaLinks.length}: ${link.url}`);
    } catch (error) {
      console.error(`Error processing Figma link ${link.url}:`, error.message);
    }
  }

  // Add or update Screenshots section
  if (screenshotsContent) {
    if (hasScreenshotsSection) {
      // Append to existing Screenshots section before the end marker
      if (screenshotsEndIndex > screenshotsSectionIndex) {
        // Insert before the end marker
        updatedBody = updatedBody.substring(0, screenshotsEndIndex) + 
                     screenshotsContent + 
                     updatedBody.substring(screenshotsEndIndex);
      } else {
        // No end marker found, create one at the end of the Screenshots section
        const afterScreenshotsSection = updatedBody.substring(screenshotsSectionIndex);
        const nextSectionMatch = afterScreenshotsSection.match(/\n## /);
        
        if (nextSectionMatch) {
          // There's another section after Screenshots - insert end marker before it
          const nextSectionIndex = screenshotsSectionIndex + nextSectionMatch.index;
          updatedBody = updatedBody.substring(0, nextSectionIndex) + 
                       `\n${screenshotsEndMarker}` +
                       updatedBody.substring(nextSectionIndex);
          
          // Now append new content before the newly created end marker
          const newEndMarkerIndex = updatedBody.indexOf(screenshotsEndMarker);
          updatedBody = updatedBody.substring(0, newEndMarkerIndex) + 
                       screenshotsContent + 
                       updatedBody.substring(newEndMarkerIndex);
        } else {
          // Screenshots is the last section, append content and end marker at the end
          updatedBody += screenshotsContent + `\n${screenshotsEndMarker}`;
        }
      }
    } else {
      // Create new Screenshots section at the end
      updatedBody += `\n## Screenshots\n${screenshotsContent}\n${screenshotsEndMarker}`;
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
