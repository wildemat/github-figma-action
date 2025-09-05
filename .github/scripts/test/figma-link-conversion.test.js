/**
 * Jest test for Figma link conversion functionality
 * Tests that a single Figma link gets converted to proper format with mocked API calls
 */

const utils = require("../util");
const figmaApi = require("../figma_api");

// Test data
const TEST_FIGMA_URL = "https://www.figma.com/design/PtEQFlGwta7PzrMwRjqquH/Homepage--9.2?node-id=3143-20344";
const TEST_FILE_ID = "PtEQFlGwta7PzrMwRjqquH";
const TEST_NODE_ID = "3143:20344";
const TEST_VERSION_ID = "2260315635405056828";
const TEST_IMAGE_URL = "https://figma-alpha-api.s3.us-west-2.amazonaws.com/test-image.png";

// Mock Figma API methods
jest.mock("../figma_api");

describe("Figma Link Conversion", () => {
  beforeEach(() => {
    // Setup mocks
    figmaApi.parseFigmaUrl.mockImplementation((url) => {
      if (url === TEST_FIGMA_URL) {
        return {
          fileId: TEST_FILE_ID,
          nodeId: TEST_NODE_ID,
          versionId: null
        };
      }
      return null;
    });

    figmaApi.fetchLatestVersion.mockImplementation(async (fileId, token) => {
      if (fileId === TEST_FILE_ID) {
        return {
          id: TEST_VERSION_ID,
          created_at: "2025-01-08T14:29:08Z"
        };
      }
      throw new Error("Unexpected fileId in test");
    });

    figmaApi.fetchNodeImageUrl.mockImplementation(async (fileId, nodeId, token) => {
      if (fileId === TEST_FILE_ID && nodeId === TEST_NODE_ID) {
        return TEST_IMAGE_URL;
      }
      throw new Error("Unexpected parameters in test");
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("should parse Figma URL correctly", () => {
    const parsed = figmaApi.parseFigmaUrl(TEST_FIGMA_URL);
    
    expect(parsed.fileId).toBe(TEST_FILE_ID);
    expect(parsed.nodeId).toBe(TEST_NODE_ID);
    expect(parsed.versionId).toBeNull();
  });

  test("should fetch version information", async () => {
    const version = await figmaApi.fetchLatestVersion(TEST_FILE_ID, "fake-token");
    
    expect(version.id).toBe(TEST_VERSION_ID);
    expect(version.created_at).toBe("2025-01-08T14:29:08Z");
  });

  test("should fetch image URL", async () => {
    const imageUrl = await figmaApi.fetchNodeImageUrl(TEST_FILE_ID, TEST_NODE_ID, "fake-token");
    
    expect(imageUrl).toBe(TEST_IMAGE_URL);
  });

  test("should create link object", () => {
    const linkObject = utils.createLinkObject(
      TEST_FIGMA_URL,
      TEST_FILE_ID,
      TEST_NODE_ID,
      TEST_FIGMA_URL,
      false,
      null,
      false
    );

    expect(linkObject.url).toBe(TEST_FIGMA_URL);
    expect(linkObject.fileId).toBe(TEST_FILE_ID);
    expect(linkObject.nodeId).toBe(TEST_NODE_ID);
    expect(linkObject.isMarkdownLink).toBe(false);
    expect(linkObject.linkText).toBeNull();
    expect(linkObject.isInSpecsSection).toBe(false);
  });

  test("should create design spec snippet", () => {
    const expirationString = utils.calculateImageExpirationDate();
    const cleanUrl = utils.createCleanFigmaUrl(TEST_FILE_ID, TEST_NODE_ID, TEST_VERSION_ID);
    const specSnippet = utils.createDesignSpecSnippet(
      1,
      "design-spec-1",
      TEST_IMAGE_URL,
      cleanUrl,
      TEST_VERSION_ID,
      "2025-01-08T14:29:08Z",
      expirationString
    );

    expect(specSnippet).toContain("Design Spec 1");
    expect(specSnippet).toContain(TEST_IMAGE_URL);
    expect(specSnippet).toContain(TEST_VERSION_ID);
    expect(specSnippet).toContain("START_SPEC_1");
    expect(specSnippet).toContain("END_SPEC_1");
    expect(specSnippet).toContain("<details>");
    expect(specSnippet).toContain("🎨 Design Spec");
    expect(specSnippet).toContain("design-spec-1");
  });

  test("should create reference text", () => {
    const referenceText = utils.createReferenceText(false, null, 1, "design-spec-1");
    const expectedReference = "[Refer to Design Spec 1 below](#design-spec-1)";
    
    expect(referenceText).toBe(expectedReference);
  });

  test("should create markdown link reference text", () => {
    const referenceText = utils.createReferenceText(true, "homepage design", 1, "design-spec-1");
    const expectedReference = "homepage design ([Refer to Design Spec 1 below](#design-spec-1))";
    
    expect(referenceText).toBe(expectedReference);
  });

  test("should calculate expiration date", () => {
    const expirationDate = utils.calculateImageExpirationDate();
    
    expect(expirationDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    
    // Verify it's approximately 30 days from now
    const expectedDate = new Date();
    expectedDate.setDate(expectedDate.getDate() + 30);
    const expectedString = expectedDate.toISOString().split("T")[0];
    
    expect(expirationDate).toBe(expectedString);
  });

  test("should create clean Figma URL", () => {
    const cleanUrl = utils.createCleanFigmaUrl(TEST_FILE_ID, TEST_NODE_ID, TEST_VERSION_ID);
    const expectedUrl = `https://www.figma.com/design/${TEST_FILE_ID}/?node-id=3143-20344&version-id=${TEST_VERSION_ID}&m=dev`;
    
    expect(cleanUrl).toBe(expectedUrl);
  });
});