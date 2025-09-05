#!/usr/bin/env node

const regexPatterns = require("./regex");
const utils = require("./util");
const figmaApi = require("./figma_api");
const githubApi = require("./github_api");

/**
 * Main function to process Figma links in PR descriptions
 */
async function main() {
  // Validate environment variables
  const validation = githubApi.validateEnvironmentVariables(process.env);
  if (!validation.isValid) {
    console.error(
      `Missing required environment variables: ${validation.missing.join(", ")}`
    );
    process.exit(1);
  }

  const {
    FIGMA_TOKEN: figmaToken,
    GITHUB_TOKEN: githubToken,
    PR_NUMBER: prNumber,
    GITHUB_REPOSITORY,
  } = process.env;

  // Parse repository information
  const repoInfo = githubApi.parseRepositoryInfo(GITHUB_REPOSITORY);
  if (!repoInfo) {
    console.error("Could not parse repository info from GITHUB_REPOSITORY");
    process.exit(1);
  }

  const { owner, repo } = repoInfo;

  try {
    // Fetch current PR body
    console.log(
      `Fetching current PR body for #${prNumber} in ${owner}/${repo}...`
    );
    const prBody = await githubApi.fetchCurrentPRBody(
      owner,
      repo,
      prNumber,
      githubToken
    );
    console.log(`Current PR body length: ${prBody.length}`);

    // Analyze Design Specs section
    const specsAnalysis = analyzeDesignSpecsSection(prBody);
    console.log(
      `Found ${specsAnalysis.existingSpecCount} existing Design Spec entrie(s) in Design Specs section`
    );

    // Find Figma links to process
    const figmaLinks = findFigmaLinks(prBody, specsAnalysis);
    if (figmaLinks.length === 0) {
      console.log("No Figma links found to process");
      return;
    }

    const linksAbove = figmaLinks.filter(link => !link.isInSpecsSection).length;
    const linksWithin = figmaLinks.filter(link => link.isInSpecsSection).length;
    
    console.log(`Found ${figmaLinks.length} Figma link(s) to process:`);
    if (linksAbove > 0) {
      console.log(`  - ${linksAbove} above Design Specs section`);
    }
    if (linksWithin > 0) {
      console.log(`  - ${linksWithin} within Design Specs section (unprotected areas)`);
    }

    // Process each Figma link
    let updatedBody = prBody;
    let specsContent = "";

    for (let i = 0; i < figmaLinks.length; i++) {
      try {
        const result = await processFigmaLink(
          figmaLinks[i],
          specsAnalysis.existingSpecCount + i + 1,
          figmaToken
        );
        specsContent += result.specSnippet;
        
        // Replace with reference text or remove entirely based on location
        if (figmaLinks[i].isInSpecsSection) {
          // For links within Design Specs section, just remove them
          updatedBody = updatedBody.replace(figmaLinks[i].fullMatch, '');
        } else {
          // For links above Design Specs section, replace with reference
          updatedBody = updatedBody.replace(
            figmaLinks[i].fullMatch,
            result.referenceText
          );
        }
        console.log(
          `Processed Figma link ${i + 1}/${figmaLinks.length}: ${
            figmaLinks[i].url
          }`
        );
      } catch (error) {
        console.error(
          `Error processing Figma link ${figmaLinks[i].url}:`,
          error.message
        );
      }
    }

    // Update Design Specs section
    if (specsContent) {
      updatedBody = updateDesignSpecsSection(
        updatedBody,
        specsContent,
        specsAnalysis
      );
      console.log(
        `Added ${figmaLinks.length} design spec(s) to Design Specs section`
      );
    }

    // Update PR if changes were made
    if (updatedBody !== prBody) {
      await updatePRDescription(
        updatedBody,
        prBody,
        owner,
        repo,
        prNumber,
        githubToken
      );
    } else {
      console.log("No updates needed");
    }
  } catch (error) {
    console.error("Script failed:", error.message);
    process.exit(1);
  }
}

/**
 * Analyzes the existing Design Specs section in the PR body
 * @param {string} prBody - Current PR body content
 * @returns {{hasSpecsSection: boolean, specsSectionIndex: number, specsEndIndex: number, existingSpecCount: number}}
 */
function analyzeDesignSpecsSection(prBody) {
  const hasSpecsSection = regexPatterns.DESIGN_SPECS_SECTION_REGEX.test(prBody);
  const endMarker = utils.getDesignSpecsEndMarker();

  let specsSectionIndex = -1;
  let specsEndIndex = -1;
  let existingSpecCount = 0;

  if (hasSpecsSection) {
    specsSectionIndex = prBody.search(regexPatterns.DESIGN_SPECS_SECTION_REGEX);
    specsEndIndex = prBody.indexOf(endMarker);

    // Count existing Design Spec entries in the Design Specs section
    const specsSectionContent = utils.extractSectionContent(
      prBody,
      specsSectionIndex,
      specsEndIndex,
      regexPatterns.NEXT_SECTION_REGEX
    );

    const existingSpecHeaders = specsSectionContent.match(regexPatterns.DESIGN_SPEC_HEADER_REGEX);
    existingSpecCount = existingSpecHeaders ? existingSpecHeaders.length : 0;
  }

  return {
    hasSpecsSection,
    specsSectionIndex,
    specsEndIndex,
    existingSpecCount,
  };
}

/**
 * Finds all Figma links above the Design Specs section and in unprotected areas within it
 * @param {string} prBody - PR body content
 * @param {{hasSpecsSection: boolean, specsSectionIndex: number, specsEndIndex: number}} specsAnalysis - Design specs section analysis
 * @returns {Array<{url: string, fileId: string, nodeId: string, fullMatch: string, isMarkdownLink: boolean, linkText: string|null, isInSpecsSection: boolean}>}
 */
function findFigmaLinks(prBody, specsAnalysis) {
  const figmaLinks = [];

  // 1. Search above the Design Specs section
  const contentAboveSpecs = specsAnalysis.hasSpecsSection
    ? prBody.substring(0, specsAnalysis.specsSectionIndex)
    : prBody;

  findFigmaLinksInContent(contentAboveSpecs, figmaLinks, false);

  // 2. Search within unprotected areas of Design Specs section
  if (specsAnalysis.hasSpecsSection) {
    const specsSectionContent = utils.extractSectionContent(
      prBody,
      specsAnalysis.specsSectionIndex,
      specsAnalysis.specsEndIndex,
      regexPatterns.NEXT_SECTION_REGEX
    );

    const unprotectedContent = utils.extractUnprotectedSpecsContent(specsSectionContent);
    findFigmaLinksInContent(unprotectedContent, figmaLinks, true);
  }

  return figmaLinks;
}

/**
 * Finds Figma links in a given content string and adds them to the provided array
 * @param {string} content - Content to search in
 * @param {Array} figmaLinks - Array to add found links to
 * @param {boolean} isInSpecsSection - Whether the content is within the Design Specs section
 */
function findFigmaLinksInContent(content, figmaLinks, isInSpecsSection) {
  // Find markdown links with Figma URLs first
  let markdownMatch;
  const markdownRegex = new RegExp(regexPatterns.MARKDOWN_FIGMA_LINK_REGEX.source, 'g');
  
  while ((markdownMatch = markdownRegex.exec(content)) !== null) {
    const linkText = markdownMatch[1];
    const fullUrl = markdownMatch[2];
    const parsed = figmaApi.parseFigmaUrl(fullUrl);

    if (parsed) {
      figmaLinks.push(
        utils.createLinkObject(
          fullUrl,
          parsed.fileId,
          parsed.nodeId,
          markdownMatch[0], // full markdown match
          true, // isMarkdownLink
          linkText,
          isInSpecsSection
        )
      );
    }
  }

  // Find standalone Figma URLs
  let standaloneMatch;
  const standaloneRegex = new RegExp(regexPatterns.FIGMA_URL_REGEX.source, 'g');
  
  while ((standaloneMatch = standaloneRegex.exec(content)) !== null) {
    const fullUrl = standaloneMatch[0];

    // Skip if already captured as markdown link
    const alreadyProcessed = figmaLinks.some((link) => link.url === fullUrl);
    if (alreadyProcessed) continue;

    const parsed = figmaApi.parseFigmaUrl(fullUrl);
    if (parsed) {
      figmaLinks.push(
        utils.createLinkObject(
          fullUrl,
          parsed.fileId,
          parsed.nodeId,
          fullUrl, // full URL match
          false, // isMarkdownLink
          null, // no linkText for standalone URLs
          isInSpecsSection
        )
      );
    }
  }
}

/**
 * Processes a single Figma link to generate spec content and reference text
 * @param {{url: string, fileId: string, nodeId: string, fullMatch: string, isMarkdownLink: boolean, linkText: string|null, isInSpecsSection: boolean}} link - Figma link info
 * @param {number} specNumber - Sequential spec number
 * @param {string} figmaToken - Figma API token
 * @returns {Promise<{specSnippet: string, referenceText: string}>} Generated content
 */
async function processFigmaLink(link, specNumber, figmaToken) {
  // Parse URL to get all components including version
  const parsed = figmaApi.parseFigmaUrl(link.url);
  let version;

  if (parsed.versionId) {
    console.log(`Using existing version from URL: ${parsed.versionId}`);
    version = figmaApi.createVersionFromId(parsed.versionId);
  } else {
    version = await figmaApi.fetchLatestVersion(link.fileId, figmaToken);
  }

  // Get image URL (no need to download the data, we just use the URL)
  const imageUrl = await figmaApi.fetchNodeImageUrl(
    link.fileId,
    link.nodeId,
    figmaToken
  );
  console.log(`Using Figma image URL (expires in 30 days): ${imageUrl}`);

  // Generate content
  const specId = `design-spec-${specNumber}`;
  const expirationString = utils.calculateImageExpirationDate();
  const cleanUrl = utils.createCleanFigmaUrl(
    link.fileId,
    link.nodeId,
    version.id
  );

  const specSnippet = utils.createDesignSpecSnippet(
    specNumber,
    specId,
    imageUrl,
    cleanUrl,
    version.id,
    version.created_at,
    expirationString
  );

  // Only create reference text for links above the Design Specs section
  const referenceText = link.isInSpecsSection ? 
    '' : 
    utils.createReferenceText(
      link.isMarkdownLink,
      link.linkText,
      specNumber,
      specId
    );

  return { specSnippet, referenceText };
}

/**
 * Updates the Design Specs section with new content
 * @param {string} body - Current PR body
 * @param {string} specsContent - New specs content to add
 * @param {{hasSpecsSection: boolean, specsSectionIndex: number, specsEndIndex: number}} specsAnalysis - Section analysis
 * @returns {string} Updated PR body
 */
function updateDesignSpecsSection(body, specsContent, specsAnalysis) {
  const endMarker = utils.getDesignSpecsEndMarker();

  if (specsAnalysis.hasSpecsSection) {
    if (specsAnalysis.specsEndIndex > specsAnalysis.specsSectionIndex) {
      // Insert before existing end marker
      return (
        body.substring(0, specsAnalysis.specsEndIndex) +
        specsContent +
        body.substring(specsAnalysis.specsEndIndex)
      );
    } else {
      // Create end marker and insert content
      const afterSpecsSection = body.substring(specsAnalysis.specsSectionIndex);
      const nextSectionMatch = afterSpecsSection.match(
        regexPatterns.NEXT_SECTION_REGEX
      );

      if (nextSectionMatch) {
        const nextSectionIndex =
          specsAnalysis.specsSectionIndex + nextSectionMatch.index;
        const withEndMarker =
          body.substring(0, nextSectionIndex) +
          `\n${endMarker}` +
          body.substring(nextSectionIndex);

        const newEndMarkerIndex = withEndMarker.indexOf(endMarker);
        return (
          withEndMarker.substring(0, newEndMarkerIndex) +
          specsContent +
          withEndMarker.substring(newEndMarkerIndex)
        );
      } else {
        return body + specsContent + `\n${endMarker}`;
      }
    }
  } else {
    // Create new Design Specs section
    return body + `\n## Design Specs\n${specsContent}\n${endMarker}`;
  }
}

/**
 * Updates the PR description via GitHub API
 * @param {string} updatedBody - New PR body content
 * @param {string} originalBody - Original PR body content
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} prNumber - Pull request number
 * @param {string} githubToken - GitHub API token
 */
async function updatePRDescription(
  updatedBody,
  originalBody,
  owner,
  repo,
  prNumber,
  githubToken
) {
  console.log(`Updating PR #${prNumber} in ${owner}/${repo}...`);
  console.log(`Original body length: ${originalBody.length}`);
  console.log(`Updated body length: ${updatedBody.length}`);
  console.log(
    `Body diff: ${updatedBody.length - originalBody.length} characters added`
  );

  const status = await githubApi.updatePRDescription(
    owner,
    repo,
    prNumber,
    updatedBody,
    githubToken
  );
  console.log("PR update response status:", status);
  console.log("Successfully updated PR description with Figma images");
}

// Run the main function
main().catch((error) => {
  console.error("Script failed:", error);
  process.exit(1);
});
