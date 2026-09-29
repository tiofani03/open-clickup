import { describe, it, expect, vi } from "vitest";
import { createSlashSuggestion, type CommandItem } from "../components/doc/slash-command";

describe("Slash Command Suggestion", () => {
  it("defines command callback that executes selected item command", () => {
    const suggestion = createSlashSuggestion();
    expect(suggestion.command).toBeDefined();

    const mockItemCommand = vi.fn();
    const mockItem: CommandItem = {
      title: "Test Block",
      description: "Test description",
      category: "Basic blocks",
      iconSvg: "<svg></svg>",
      command: mockItemCommand,
    };

    const mockEditor = {} as any;
    const mockRange = { from: 10, to: 15 };

    // Invoke suggestion.command
    suggestion.command!({
      editor: mockEditor,
      range: mockRange,
      props: mockItem,
    });

    expect(mockItemCommand).toHaveBeenCalledTimes(1);
    expect(mockItemCommand).toHaveBeenCalledWith({
      editor: mockEditor,
      range: mockRange,
    });
  });

  it("filters command items based on user query", async () => {
    const suggestion = createSlashSuggestion();
    const allItems = await (suggestion.items as any)({ query: "" });
    expect(allItems.length).toBeGreaterThan(5);

    const headingItems = await (suggestion.items as any)({ query: "heading" });
    expect(headingItems.length).toBe(3);
    expect(headingItems.every((i: CommandItem) => i.title.toLowerCase().includes("heading"))).toBe(true);

    const mermaidItems = await (suggestion.items as any)({ query: "mermaid" });
    expect(mermaidItems.length).toBe(1);
    expect(mermaidItems[0].title).toBe("Mermaid Diagram");
  });
});
