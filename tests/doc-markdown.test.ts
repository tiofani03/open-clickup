import { describe, it, expect } from "vitest";
import { markdownToHtml, htmlToMarkdown } from "../lib/markdown";

describe("lib/markdown", () => {
  describe("markdownToHtml", () => {
    it("converts headings 1, 2, and 3", () => {
      expect(markdownToHtml("# Heading 1")).toBe("<h1>Heading 1</h1>");
      expect(markdownToHtml("## Heading 2")).toBe("<h2>Heading 2</h2>");
      expect(markdownToHtml("### Heading 3")).toBe("<h3>Heading 3</h3>");
    });

    it("converts inline formatting (bold, italic, strike, code)", () => {
      expect(markdownToHtml("This is **bold** text")).toBe(
        "<p>This is <strong>bold</strong> text</p>"
      );
      expect(markdownToHtml("This is *italic* text")).toBe(
        "<p>This is <em>italic</em> text</p>"
      );
      expect(markdownToHtml("This is _italic_ text")).toBe(
        "<p>This is <em>italic</em> text</p>"
      );
      expect(markdownToHtml("This is ~~strike~~ text")).toBe(
        "<p>This is <s>strike</s> text</p>"
      );
      expect(markdownToHtml("This is `inline code` text")).toBe(
        "<p>This is <code>inline code</code> text</p>"
      );
    });

    it("converts code blocks with language", () => {
      const md = "```ts\nconst x = 42;\n```";
      const html = markdownToHtml(md);
      expect(html).toContain("<pre><code");
      expect(html).toContain("const x = 42;");
      expect(html).toContain("</pre>");
    });

    it("converts blockquotes", () => {
      expect(markdownToHtml("> Simple quote")).toBe(
        "<blockquote><p>Simple quote</p></blockquote>"
      );
    });

    it("converts unordered lists", () => {
      const md = "- Item A\n- Item B";
      expect(markdownToHtml(md)).toBe(
        "<ul><li>Item A</li><li>Item B</li></ul>"
      );
    });

    it("converts ordered lists", () => {
      const md = "1. First\n2. Second";
      expect(markdownToHtml(md)).toBe(
        "<ol><li>First</li><li>Second</li></ol>"
      );
    });

    it("converts horizontal rules", () => {
      expect(markdownToHtml("---")).toBe("<hr />");
    });

    it("converts checklists (task items)", () => {
      const md = "- [ ] Unfinished\n- [x] Finished";
      const html = markdownToHtml(md);
      expect(html).toContain('data-checked="false"');
      expect(html).toContain('data-checked="true"');
      expect(html).toContain("Unfinished");
      expect(html).toContain("Finished");
    });

    it("handles multiple paragraphs and empty input", () => {
      expect(markdownToHtml("")).toBe("");
      expect(markdownToHtml("   ")).toBe("");
      const md = "First paragraph\n\nSecond paragraph";
      expect(markdownToHtml(md)).toBe(
        "<p>First paragraph</p><p>Second paragraph</p>"
      );
    });
  });

  describe("htmlToMarkdown", () => {
    it("converts headings to markdown", () => {
      expect(htmlToMarkdown("<h1>Heading 1</h1>")).toBe("# Heading 1");
      expect(htmlToMarkdown("<h2>Heading 2</h2>")).toBe("## Heading 2");
      expect(htmlToMarkdown("<h3>Heading 3</h3>")).toBe("### Heading 3");
    });

    it("converts inline formatting to markdown", () => {
      expect(htmlToMarkdown("<p><strong>bold</strong></p>")).toBe("**bold**");
      expect(htmlToMarkdown("<p><b>bold</b></p>")).toBe("**bold**");
      expect(htmlToMarkdown("<p><em>italic</em></p>")).toBe("*italic*");
      expect(htmlToMarkdown("<p><i>italic</i></p>")).toBe("*italic*");
      expect(htmlToMarkdown("<p><s>strike</s></p>")).toBe("~~strike~~");
      expect(htmlToMarkdown("<p><del>strike</del></p>")).toBe("~~strike~~");
      expect(htmlToMarkdown("<p><code>inline code</code></p>")).toBe("`inline code`");
    });

    it("converts code blocks to markdown", () => {
      const html = '<pre><code class="language-js">console.log("hi");</code></pre>';
      expect(htmlToMarkdown(html)).toBe('```js\nconsole.log("hi");\n```');
    });

    it("converts blockquotes to markdown", () => {
      expect(htmlToMarkdown("<blockquote><p>Quote line</p></blockquote>")).toBe(
        "> Quote line"
      );
    });

    it("converts lists to markdown", () => {
      const ul = "<ul><li>Item 1</li><li>Item 2</li></ul>";
      expect(htmlToMarkdown(ul)).toBe("- Item 1\n- Item 2");

      const ol = "<ol><li>First</li><li>Second</li></ol>";
      expect(htmlToMarkdown(ol)).toBe("1. First\n2. Second");
    });

    it("converts checklists to markdown", () => {
      const html = `<ul>
        <li data-checked="false"><input type="checkbox" /> Task A</li>
        <li data-checked="true"><input type="checkbox" checked /> Task B</li>
      </ul>`;
      expect(htmlToMarkdown(html)).toBe("- [ ] Task A\n- [x] Task B");
    });

    it("converts horizontal rules", () => {
      expect(htmlToMarkdown("<hr />")).toBe("---");
      expect(htmlToMarkdown("<hr>")).toBe("---");
    });

    it("handles empty or whitespace html", () => {
      expect(htmlToMarkdown("")).toBe("");
      expect(htmlToMarkdown("<p></p>")).toBe("");
    });
  });

  describe("roundtrip consistency", () => {
    it("preserves content across markdown -> html -> markdown", () => {
      const original = [
        "# Document Title",
        "## Subtitle",
        "Paragraph with **bold**, *italic*, and `code`.",
        "> Important note",
        "- Bullet 1",
        "- Bullet 2",
        "1. Step 1",
        "2. Step 2",
        "---",
        "- [ ] Open item",
        "- [x] Done item",
      ].join("\n\n");

      const html = markdownToHtml(original);
      const restored = htmlToMarkdown(html);

      // Verify all essential text and structure remain
      expect(restored).toContain("# Document Title");
      expect(restored).toContain("## Subtitle");
      expect(restored).toContain("**bold**");
      expect(restored).toContain("*italic*");
      expect(restored).toContain("`code`");
      expect(restored).toContain("> Important note");
      expect(restored).toContain("- Bullet 1");
      expect(restored).toContain("1. Step 1");
      expect(restored).toContain("---");
      expect(restored).toContain("- [ ] Open item");
      expect(restored).toContain("- [x] Done item");
    });

    it("preserves complex multiline code blocks with symbols", () => {
      const original = [
        "### Developer Setup",
        "```bash",
        "pnpm install",
        'export API_URL="https://localhost:8080/api"',
        "pnpm dev",
        "```",
      ].join("\n\n");

      const html = markdownToHtml(original);
      expect(html).toContain('class="language-bash"');
      expect(html).toContain("pnpm install");
      expect(html).toContain("export API_URL=");

      const restored = htmlToMarkdown(html);
      expect(restored).toContain("### Developer Setup");
      expect(restored).toContain("```bash");
      expect(restored).toContain("pnpm install");
      expect(restored).toContain('export API_URL="https://localhost:8080/api"');
    });

    it("simulates dual mode switching between visual and raw markdown", () => {
      // 1. Initial markdown loaded into visual mode (converted to HTML)
      let initialMarkdown = "# Sprint 42 Plan\n\n- Task A\n- Task B";
      let visualHtml = markdownToHtml(initialMarkdown);

      // 2. User switches to Markdown mode: editor extracts HTML and converts to Markdown
      let rawMarkdown = htmlToMarkdown(visualHtml);
      expect(rawMarkdown).toContain("# Sprint 42 Plan");
      expect(rawMarkdown).toContain("- Task A");

      // 3. User modifies in Markdown mode
      rawMarkdown += "\n- Task C\n\n> Note: complete before Friday";

      // 4. User switches back to Visual mode: Markdown converted to HTML
      visualHtml = markdownToHtml(rawMarkdown);
      expect(visualHtml).toContain("<li>Task C</li>");
      expect(visualHtml).toContain("<blockquote><p>Note: complete before Friday</p></blockquote>");

      // 5. Final state converted back preserves everything
      const finalMarkdown = htmlToMarkdown(visualHtml);
      expect(finalMarkdown).toContain("- Task C");
      expect(finalMarkdown).toContain("> Note: complete before Friday");
    });
  });
});
