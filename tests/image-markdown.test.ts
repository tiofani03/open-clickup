import { describe, it, expect } from "vitest";
import { markdownToHtml, htmlToMarkdown } from "../lib/markdown";

describe("Markdown Image Parser", () => {
  it("converts standard markdown images to image-block html", () => {
    const md = "![App Screenshot](/uploads/img_123.webp)";
    const html = markdownToHtml(md);
    expect(html).toContain('data-type="image-block"');
    expect(html).toContain('data-src="/uploads/img_123.webp"');
    expect(html).toContain('data-alt="App Screenshot"');
    expect(html).toContain('data-caption="App Screenshot"');
    expect(html).toContain('data-align="center"');
    expect(html).toContain('data-width="100%"');
    expect(html).toContain('<img src="/uploads/img_123.webp" alt="App Screenshot" />');
  });

  it("converts rich markdown images with alignment and width", () => {
    const md = "![Architecture Diagram|align:center|width:75%](/uploads/img_arch.webp)";
    const html = markdownToHtml(md);
    expect(html).toContain('data-type="image-block"');
    expect(html).toContain('data-align="center"');
    expect(html).toContain('data-width="75%"');
    expect(html).toContain('data-caption="Architecture Diagram"');
  });

  it("roundtrips image block HTML back to markdown", () => {
    const initialMd = "![System Design|align:center|width:50%](/uploads/img_999.webp)";
    const html = markdownToHtml(initialMd);
    const backToMd = htmlToMarkdown(html);
    expect(backToMd).toBe(initialMd);
  });

  it("roundtrips standard image markdown preserving default dimensions", () => {
    const initialMd = "![Dashboard Preview](/uploads/dashboard.webp)";
    const html = markdownToHtml(initialMd);
    const backToMd = htmlToMarkdown(html);
    expect(backToMd).toBe(initialMd);
  });

  it("converts rich markdown images with non-center alignment and custom width", () => {
    const initialMd = "![Sidebar Logo|align:left|width:25%](/uploads/logo.webp)";
    const html = markdownToHtml(initialMd);
    expect(html).toContain('data-align="left"');
    expect(html).toContain('data-width="25%"');
    const backToMd = htmlToMarkdown(html);
    expect(backToMd).toBe(initialMd);
  });

  it("converts existing standard <img> tags back to markdown", () => {
    const html = '<img src="/uploads/legacy.png" alt="Legacy Image" />';
    const md = htmlToMarkdown(html);
    expect(md).toBe("![Legacy Image](/uploads/legacy.png)");
  });

  it("converts standard <img> tag without alt attribute to markdown", () => {
    const html = '<img src="/uploads/unnamed.png" />';
    const md = htmlToMarkdown(html);
    expect(md).toBe("![](/uploads/unnamed.png)");
  });

  it("handles image block with attribute order variation from TipTap HTML", () => {
    const tipTapHtml =
      '<div data-type="image-block" data-src="/uploads/tip.webp" data-alt="TipTap" data-caption="TipTap" data-align="center" data-width="75%"><img src="/uploads/tip.webp" alt="TipTap" /></div>';
    const md = htmlToMarkdown(tipTapHtml);
    expect(md).toBe("![TipTap|align:center|width:75%](/uploads/tip.webp)");
  });

  it("escapes and unescapes special characters in caption", () => {
    const initialMd = '![Diagram <v1> & "Draft"|align:center|width:50%](/uploads/diag.webp)';
    const html = markdownToHtml(initialMd);
    expect(html).toContain("&lt;v1&gt;");
    expect(html).toContain("&amp;");
    expect(html).toContain("&quot;Draft&quot;");
    const backToMd = htmlToMarkdown(html);
    expect(backToMd).toBe(initialMd);
  });

  it("handles markdown with surrounding paragraphs and images", () => {
    const md = [
      "# Overview",
      "Here is an introduction paragraph.",
      "![Architecture|align:center|width:75%](/uploads/arch.webp)",
      "Conclusion paragraph following the image.",
    ].join("\n\n");

    const html = markdownToHtml(md);
    expect(html).toContain("<h1>Overview</h1>");
    expect(html).toContain("<p>Here is an introduction paragraph.</p>");
    expect(html).toContain('data-type="image-block"');
    expect(html).toContain("<p>Conclusion paragraph following the image.</p>");

    const restored = htmlToMarkdown(html);
    expect(restored).toBe(md);
  });
});
