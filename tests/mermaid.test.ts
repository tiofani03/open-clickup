import { describe, it, expect } from "vitest";
import { renderMermaidDiagram } from "../components/doc/mermaid/mermaid-renderer";

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
});
