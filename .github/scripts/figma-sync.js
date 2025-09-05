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
      console.log(
        `Fetching current PR body for #${prNumber} in ${owner}/${repo}...`
      );
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
    console.log(
      "Could not fetch current PR body, using provided body:",
      error.message
    );
  }

  // Check if Design Specs section exists and count existing specs
  const specsRegex = /## Design Specs/i;
  const hasSpecsSection = specsRegex.test(prBody);
  const specsEndMarker =
    "<!-- END_DESIGN_SPECS - WILL NOT DETECT FIGMA LINKS BELOW THIS LINE -->";

  let specsSectionIndex = -1;
  let existingSpecCount = 0;
  let specsEndIndex = -1;

  if (hasSpecsSection) {
    specsSectionIndex = prBody.search(specsRegex);
    specsEndIndex = prBody.indexOf(specsEndMarker);

    // Count existing figma links in the Design Specs section
    let specsSectionContent;
    if (specsEndIndex > specsSectionIndex) {
      // Use content between ## Design Specs and the end marker
      specsSectionContent = prBody.substring(
        specsSectionIndex,
        specsEndIndex
      );
    } else {
      // No end marker found, use until next section or end of body
      const specsSection = prBody.substring(specsSectionIndex);
      const nextSectionMatch = specsSection.match(/\n## /);
      specsSectionContent = nextSectionMatch
        ? specsSection.substring(0, nextSectionMatch.index)
        : specsSection;
    }

    const existingFigmaLinks = specsSectionContent.match(
      /https:\/\/www\.figma\.com\/design\/[^\s)]+/g
    );
    existingSpecCount = existingFigmaLinks
      ? existingFigmaLinks.length
      : 0;

    console.log(
      `Found ${existingSpecCount} existing figma link(s) in Design Specs section`
    );
  }

  // Only look for Figma URLs above the Design Specs section (or entire body if no section exists)
  const contentToSearch = hasSpecsSection
    ? prBody.substring(0, specsSectionIndex)
    : prBody;

  // Regex to find Figma URLs - captures the complete URL until whitespace or closing parenthesis
  const figmaUrlRegex =
    /https:\/\/www\.figma\.com\/design\/([^/]+)\/[^?\s)]*\?[^\s)]*node-id=([^&\s)]+)[^\s)]*/g;

  let match;
  const figmaLinks = [];

  // First, find markdown links with Figma URLs
  const markdownLinkRegex =
    /\[([^\]]+)\]\((https:\/\/www\.figma\.com\/design\/[^)]+node-id=[^)]+)\)/g;
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
    const alreadyProcessed = figmaLinks.some((link) => link.url === fullUrl);
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
    console.log("No Figma links found above Design Specs section");
    return;
  }

  console.log(
    `Found ${figmaLinks.length} Figma link(s) above Design Specs section`
  );

  let updatedBody = prBody;
  let specsContent = "";

  for (let i = 0; i < figmaLinks.length; i++) {
    const link = figmaLinks[i];
    try {
      // Check if version is already specified in the URL
      const versionIdMatch = link.url.match(/version-id=([^&\s)]+)/);
      let latestVersion;

      if (versionIdMatch) {
        // Use the version from the URL
        const versionId = versionIdMatch[1];
        console.log(`Using existing version from URL: ${versionId}`);
        latestVersion = {
          id: versionId,
          created_at: new Date().toISOString(), // Use current timestamp as fallback
        };
      } else {
        // Get file version from API
        const versionResponse = await axios.get(
          `https://api.figma.com/v1/files/${link.fileId}/versions`,
          { headers: { "X-Figma-Token": figmaToken } }
        );
        latestVersion = versionResponse.data.versions[0];
      }

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
      const expirationString = expirationDate.toISOString().split("T")[0]; // YYYY-MM-DD format

      const attachmentUrl = imageUrl;

      // Create spec entry for Design Specs section (continue numbering from existing specs)
      const specNumber = existingSpecCount + i + 1;
      const specId = `spec-${specNumber}`;
      // Clean the URL to include essential parameters and version-id
      const cleanUrl = `https://www.figma.com/design/${
        link.fileId
      }/?node-id=${link.nodeId.replace(":", "-")}&version-id=${
        latestVersion.id
      }&m=dev`;

      const specSnippet = `
### Design Spec ${specNumber}

<kbd><img alt="Figma Design Preview" src="${attachmentUrl}" /></kbd>

<details>
<summary>spec details</summary>

**Design Link:** <a href="${cleanUrl}" target="_blank">View in Figma</a>

**Version:** ${latestVersion.id}

**Snapshot Timestamp:** ${latestVersion.created_at}

**Image Expires:** ${expirationString}


</details>

`;

      specsContent += specSnippet;

      // Replace the original Figma URL/link with a reference
      let referenceText;
      if (link.isMarkdownLink) {
        // For markdown links: [text](url) becomes "text ([Refer to Design Spec X below](#spec-x))"
        referenceText = `${link.linkText} ([Refer to Design Spec ${specNumber} below](#${specId}))`;
      } else {
        // For standalone URLs: url becomes "[Refer to Design Spec X below](#spec-x)"
        referenceText = `[Refer to Design Spec ${specNumber} below](#${specId})`;
      }
      updatedBody = updatedBody.replace(link.fullMatch, referenceText);

      console.log(
        `Processed Figma link ${i + 1}/${figmaLinks.length}: ${link.url}`
      );
    } catch (error) {
      console.error(`Error processing Figma link ${link.url}:`, error.message);
    }
  }

  // Add or update Design Specs section
  if (specsContent) {
    if (hasSpecsSection) {
      // Append to existing Design Specs section before the end marker
      if (specsEndIndex > specsSectionIndex) {
        // Insert before the end marker
        updatedBody =
          updatedBody.substring(0, specsEndIndex) +
          specsContent +
          updatedBody.substring(specsEndIndex);
      } else {
        // No end marker found, create one at the end of the Design Specs section
        const afterSpecsSection = updatedBody.substring(
          specsSectionIndex
        );
        const nextSectionMatch = afterSpecsSection.match(/\n## /);

        if (nextSectionMatch) {
          // There's another section after Design Specs - insert end marker before it
          const nextSectionIndex =
            specsSectionIndex + nextSectionMatch.index;
          updatedBody =
            updatedBody.substring(0, nextSectionIndex) +
            `\n${specsEndMarker}` +
            updatedBody.substring(nextSectionIndex);

          // Now append new content before the newly created end marker
          const newEndMarkerIndex = updatedBody.indexOf(specsEndMarker);
          updatedBody =
            updatedBody.substring(0, newEndMarkerIndex) +
            specsContent +
            updatedBody.substring(newEndMarkerIndex);
        } else {
          // Design Specs is the last section, append content and end marker at the end
          updatedBody += specsContent + `\n${specsEndMarker}`;
        }
      }
    } else {
      // Create new Design Specs section at the end
      updatedBody += `\n## Design Specs\n${specsContent}\n${specsEndMarker}`;
    }
    console.log(
      `Added ${figmaLinks.length} design spec(s) to Design Specs section`
    );
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
      console.log(
        `Body diff: ${updatedBody.length - prBody.length} characters added`
      );

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
