import { describe, it, expect } from "vitest";
import { renderMermaidDiagram, generateSvgFromMermaid } from "../components/doc/mermaid/mermaid-renderer";
import { markdownToHtml, htmlToMarkdown } from "../lib/markdown";

describe("Mermaid Diagram Renderer", () => {
  it("renders a standard flowchart with nodes and edges", async () => {
    const code = `flowchart TD
    A([Start]) --> B[Process Step]
    B --> C{Decision}
    C -- Yes --> D[(Database)]
    C -- No --> E([Done])
    D --> E`;

    const svg = await renderMermaidDiagram("test_flowchart", code);
    expect(svg).toContain("<svg");
    expect(svg).toContain("Start");
    expect(svg).toContain("Process Step");
    expect(svg).toContain("Decision");
    expect(svg).toContain("Database");
    expect(svg).toContain("Done");
    expect(svg).toContain("path");
  });

  it("renders a sequence diagram with lifelines and messages", async () => {
    const code = `sequenceDiagram
    participant User
    participant Server
    User->>Server: Request Data
    Server-->>User: 200 OK`;

    const svg = await renderMermaidDiagram("test_sequence", code);
    expect(svg).toContain("<svg");
    expect(svg).toContain("User");
    expect(svg).toContain("Server");
    expect(svg).toContain("Request Data");
  });

  it("handles left-to-right (LR) flowchart orientation", async () => {
    const code = `flowchart LR
    Client --> API --> Database`;

    const svg = await renderMermaidDiagram("test_lr", code);
    expect(svg).toContain("<svg");
    expect(svg).toContain("Client");
    expect(svg).toContain("API");
    expect(svg).toContain("Database");
  });

  it("synchronously generates SVG with generateSvgFromMermaid", () => {
    const code = `flowchart TD
    Start["Begin Process"] --> Finish['End Process']`;
    const svg = generateSvgFromMermaid("sync_test", code);
    expect(svg).toContain("<svg");
    expect(svg).toContain("Begin Process");
    expect(svg).toContain("End Process");
    expect(svg).not.toContain('"Begin Process"');
  });

  it("preserves mermaid diagrams in markdownToHtml and htmlToMarkdown roundtrip", () => {
    const originalMd = "```mermaid\nflowchart TD\n    A[Step 1] --> B[Step 2]\n```";
    const html = markdownToHtml(originalMd);
    expect(html).toContain('data-type="mermaid-block"');
    expect(html).toContain("Step 1");
    expect(html).toContain("Step 2");

    const backToMd = htmlToMarkdown(html);
    expect(backToMd).toBe(originalMd);
  });
});
