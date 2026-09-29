/**
 * Bidirectional Markdown <-> HTML converter for Open ClickUp docs.
 * Works seamlessly in both browser and Node (SSR/tests) environments without DOM dependencies.
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function unescapeHtml(html: string): string {
  return html
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

/**
 * Parse inline markdown formatting (bold, italic, strike, inline code, links).
 */
export function parseInlineMarkdown(text: string): string {
  // 1. Protect inline code `code` using null-byte placeholder (avoids matching by _ or * regexes)
  const codeSnippets: string[] = [];
  let parsed = text.replace(/`([^`]+)`/g, (_, code) => {
    const idx = codeSnippets.length;
    codeSnippets.push(`<code>${escapeHtml(code)}</code>`);
    return `\u0000INLINECODE${idx}\u0000`;
  });

  // 1b. Images ![alt](url) before links [text](url)
  parsed = parsed.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, rawMeta, url) => {
    let caption = rawMeta.trim();
    if (rawMeta.includes("|")) {
      caption = rawMeta.split("|")[0].trim();
    }
    return `<img src="${escapeHtml(url)}" alt="${escapeHtml(caption)}" />`;
  });

  // 2. Links [text](url)
  parsed = parsed.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // 3. Bold: **text** or __text__
  parsed = parsed.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  parsed = parsed.replace(/__([^_]+)__/g, "<strong>$1</strong>");

  // 4. Italic: *text* or _text_
  parsed = parsed.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");
  parsed = parsed.replace(/(?<!_)_([^_]+)_(?!_)/g, "<em>$1</em>");

  // 5. Strikethrough: ~~text~~
  parsed = parsed.replace(/~~([^~]+)~~/g, "<s>$1</s>");

  // 6. Restore inline code
  parsed = parsed.replace(/\u0000INLINECODE(\d+)\u0000/g, (_, idx) => {
    return codeSnippets[Number(idx)] ?? "";
  });

  return parsed;
}

/**
 * Convert raw markdown string to HTML.
 */
export function markdownToHtml(markdown: string): string {
  if (!markdown || !markdown.trim()) return "";

  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const htmlParts: string[] = [];

  let inCodeBlock = false;
  let codeBlockLang = "";
  let codeBlockContent: string[] = [];

  let listType: "ul" | "ol" | "taskList" | null = null;
  let listItems: string[] = [];

  let quoteLines: string[] = [];
  let paragraphLines: string[] = [];

  function flushList() {
    if (!listType || listItems.length === 0) {
      listType = null;
      listItems = [];
      return;
    }
    if (listType === "taskList") {
      htmlParts.push(`<ul class="task-list">${listItems.join("")}</ul>`);
    } else if (listType === "ul") {
      htmlParts.push(`<ul>${listItems.join("")}</ul>`);
    } else if (listType === "ol") {
      htmlParts.push(`<ol>${listItems.join("")}</ol>`);
    }
    listType = null;
    listItems = [];
  }

  function flushQuote() {
    if (quoteLines.length === 0) return;
    const inner = quoteLines.map((l) => parseInlineMarkdown(l)).join("<br />");
    htmlParts.push(`<blockquote><p>${inner}</p></blockquote>`);
    quoteLines = [];
  }

  function flushParagraph() {
    if (paragraphLines.length === 0) return;
    const text = paragraphLines.map((l) => parseInlineMarkdown(l)).join("<br />");
    if (text.trim()) {
      htmlParts.push(`<p>${text}</p>`);
    }
    paragraphLines = [];
  }

  function flushAll() {
    flushList();
    flushQuote();
    flushParagraph();
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Check code block ```
    if (trimmed.startsWith("```")) {
      if (inCodeBlock) {
        // Closing code block
        const isMermaid = codeBlockLang.toLowerCase() === "mermaid";
        const escapedCode = escapeHtml(codeBlockContent.join("\n"));
        if (isMermaid) {
          htmlParts.push(
            `<div data-type="mermaid-block" data-code="${escapedCode}"><pre class="language-mermaid"><code class="language-mermaid">${escapedCode}</code></pre></div>`
          );
        } else {
          const langAttr = codeBlockLang ? ` class="language-${codeBlockLang}"` : "";
          htmlParts.push(`<pre><code${langAttr}>${escapedCode}</code></pre>`);
        }
        inCodeBlock = false;
        codeBlockLang = "";
        codeBlockContent = [];
      } else {
        // Opening code block
        flushAll();
        inCodeBlock = true;
        codeBlockLang = trimmed.slice(3).trim();
        codeBlockContent = [];
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(rawLine);
      continue;
    }

    // Blank line
    if (!trimmed) {
      flushAll();
      continue;
    }

    // Horizontal Rule
    if (/^(\-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flushAll();
      htmlParts.push("<hr />");
      continue;
    }

    // Image Block: ![alt|align:center|width:50%](url) or ![alt](url)
    const imgMatch = trimmed.match(/^!\[(.*?)\]\(([^)]+)\)$/);
    if (imgMatch) {
      flushAll();
      const rawMeta = imgMatch[1];
      const url = imgMatch[2];
      let caption = rawMeta.trim();
      let align = "center";
      let width = "100%";

      if (rawMeta.includes("|")) {
        const parts = rawMeta.split("|");
        caption = parts[0].trim();
        for (let p = 1; p < parts.length; p++) {
          const part = parts[p].trim();
          if (part.startsWith("align:")) align = part.replace("align:", "").trim();
          if (part.startsWith("width:")) width = part.replace("width:", "").trim();
        }
      }

      htmlParts.push(
        `<div data-type="image-block" data-src="${escapeHtml(url)}" data-alt="${escapeHtml(caption)}" data-caption="${escapeHtml(caption)}" data-align="${escapeHtml(align)}" data-width="${escapeHtml(width)}"><img src="${escapeHtml(url)}" alt="${escapeHtml(caption)}" /></div>`
      );
      continue;
    }

    // Headings: #, ##, ###
    const headingMatch = rawLine.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushAll();
      const level = headingMatch[1].length;
      const content = parseInlineMarkdown(headingMatch[2].trim());
      htmlParts.push(`<h${level}>${content}</h${level}>`);
      continue;
    }

    // Blockquote: >
    if (rawLine.startsWith(">")) {
      flushList();
      flushParagraph();
      const content = rawLine.replace(/^>\s?/, "");
      quoteLines.push(content);
      continue;
    }

    // Checklists: - [ ] or - [x] or - [X]
    const taskMatch = rawLine.match(/^[-*]\s+\[([ xX])\]\s+(.*)$/);
    if (taskMatch) {
      flushQuote();
      flushParagraph();
      if (listType !== "taskList") {
        flushList();
        listType = "taskList";
      }
      const isChecked = taskMatch[1].toLowerCase() === "x";
      const itemContent = parseInlineMarkdown(taskMatch[2]);
      const checkedAttr = isChecked ? ' checked="checked"' : "";
      listItems.push(
        `<li class="task-item" data-checked="${isChecked}"><input type="checkbox"${checkedAttr} disabled /> ${itemContent}</li>`
      );
      continue;
    }

    // Unordered List: - or *
    const bulletMatch = rawLine.match(/^[-*]\s+(.*)$/);
    if (bulletMatch) {
      flushQuote();
      flushParagraph();
      if (listType !== "ul") {
        flushList();
        listType = "ul";
      }
      listItems.push(`<li>${parseInlineMarkdown(bulletMatch[1])}</li>`);
      continue;
    }

    // Ordered List: 1.
    const orderedMatch = rawLine.match(/^(\d+)\.\s+(.*)$/);
    if (orderedMatch) {
      flushQuote();
      flushParagraph();
      if (listType !== "ol") {
        flushList();
        listType = "ol";
      }
      listItems.push(`<li>${parseInlineMarkdown(orderedMatch[2])}</li>`);
      continue;
    }

    // Regular paragraph line
    flushList();
    flushQuote();
    paragraphLines.push(rawLine);
  }

  // Final flush for remaining open blocks
  if (inCodeBlock) {
    const isMermaid = codeBlockLang.toLowerCase() === "mermaid";
    const escapedCode = escapeHtml(codeBlockContent.join("\n"));
    if (isMermaid) {
      htmlParts.push(
        `<div data-type="mermaid-block" data-code="${escapedCode}"><pre class="language-mermaid"><code class="language-mermaid">${escapedCode}</code></pre></div>`
      );
    } else {
      const langAttr = codeBlockLang ? ` class="language-${codeBlockLang}"` : "";
      htmlParts.push(`<pre><code${langAttr}>${escapedCode}</code></pre>`);
    }
  } else {
    flushAll();
  }

  return htmlParts.join("");
}

/**
 * Convert HTML string to Markdown.
 */
export function htmlToMarkdown(html: string): string {
  if (!html || !html.trim()) return "";

  let result = html.replace(/\r\n/g, "\n");

  const codeBlocks: string[] = [];
  const imageBlocks: string[] = [];

  // 0. Preserve and extract Mermaid diagram blocks (div[data-type="mermaid-block"])
  result = result.replace(
    /<div[^>]*data-type="mermaid-block"[^>]*data-code="([^"]*)"[\s\S]*?<\/div>/gi,
    (_, encodedCode) => {
      const idx = codeBlocks.length;
      const cleanCode = unescapeHtml(encodedCode);
      codeBlocks.push(`\`\`\`mermaid\n${cleanCode.trim()}\n\`\`\``);
      return `\n\n\u0000CODEBLOCK${idx}\u0000\n\n`;
    }
  );

  result = result.replace(
    /<div[^>]*data-type="mermaid-block"[\s\S]*?<code[^>]*>([\s\S]*?)<\/code>[\s\S]*?<\/div>/gi,
    (_, innerCode) => {
      const idx = codeBlocks.length;
      const cleanCode = unescapeHtml(innerCode);
      codeBlocks.push(`\`\`\`mermaid\n${cleanCode.trim()}\n\`\`\``);
      return `\n\n\u0000CODEBLOCK${idx}\u0000\n\n`;
    }
  );

  // 1. Preserve and extract <pre><code>...</code></pre> blocks with any attributes
  result = result.replace(
    /<pre[^>]*><code(?:\s+[^>]*class="(?:language-)?([^" ]*)")?[^>]*>([\s\S]*?)<\/code><\/pre>/gi,
    (_, lang, code) => {
      const idx = codeBlocks.length;
      const cleanCode = unescapeHtml(code);
      codeBlocks.push(`\`\`\`${lang || ""}\n${cleanCode}\n\`\`\``);
      return `\n\n\u0000CODEBLOCK${idx}\u0000\n\n`;
    }
  );

  // 1b. Preserve and extract Image blocks (div[data-type="image-block"])
  result = result.replace(
    /<div[^>]*data-type=["']image-block["'][^>]*>[\s\S]*?<\/div>/gi,
    (block) => {
      const openingTagMatch = block.match(/<div\b([^>]*)>/i);
      const attrs = openingTagMatch ? openingTagMatch[1] : "";

      const srcMatch = attrs.match(/data-src=["']([^"']*)["']/i);
      const captionMatch = attrs.match(/data-caption=["']([^"']*)["']/i);
      const altMatch = attrs.match(/data-alt=["']([^"']*)["']/i);
      const alignMatch = attrs.match(/data-align=["']([^"']*)["']/i);
      const widthMatch = attrs.match(/data-width=["']([^"']*)["']/i);

      let src = srcMatch ? srcMatch[1] : "";
      let caption = captionMatch ? captionMatch[1] : (altMatch ? altMatch[1] : "");
      const align = alignMatch ? alignMatch[1] : "center";
      const width = widthMatch ? widthMatch[1] : "100%";

      // Fallback to inner img tag if src or caption missing on div
      if (!src || !caption) {
        const imgMatch = block.match(/<img\b([^>]*)\/?>/i);
        if (imgMatch) {
          const is = imgMatch[1].match(/src=["']([^"']*)["']/i);
          const ia = imgMatch[1].match(/alt=["']([^"']*)["']/i);
          if (!src && is) src = is[1];
          if (!caption && ia) caption = ia[1];
        }
      }

      const cap = unescapeHtml(caption || "");
      const al = align || "center";
      const w = width || "100%";
      const meta = (al !== "center" || (w !== "100%" && w !== "")) ? `${cap}|align:${al}|width:${w}` : cap;
      const idx = imageBlocks.length;
      imageBlocks.push(`![${meta}](${src})`);
      return `\n\n\u0000IMAGEBLOCK${idx}\u0000\n\n`;
    }
  );

  // 1c. Preserve and convert standalone <img> tags to markdown images
  result = result.replace(/<img\b([^>]*)\/?>/gi, (_, attrs) => {
    const srcMatch = attrs.match(/src=["']([^"']*)["']/i);
    if (!srcMatch) return "";
    const src = srcMatch[1];
    const altMatch = attrs.match(/alt=["']([^"']*)["']/i);
    const alt = unescapeHtml(altMatch ? altMatch[1] : "");
    const alignMatch = attrs.match(/data-align=["']([^"']*)["']/i);
    const widthMatch = attrs.match(/(?:data-width|width)=["']([^"']*)["']/i);
    const al = alignMatch ? alignMatch[1] : "center";
    const w = widthMatch ? widthMatch[1] : "100%";
    const meta = (al !== "center" || (w !== "100%" && w !== "")) ? `${alt}|align:${al}|width:${w}` : alt;
    const idx = imageBlocks.length;
    imageBlocks.push(`![${meta}](${src})`);
    return `\u0000IMAGEBLOCK${idx}\u0000`;
  });

  // 2. Headings
  result = result.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n\n# $1\n\n");
  result = result.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n\n## $1\n\n");
  result = result.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n\n### $1\n\n");
  result = result.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, "\n\n#### $1\n\n");
  result = result.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, "\n\n##### $1\n\n");
  result = result.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, "\n\n###### $1\n\n");

  // 3. Horizontal Rule
  result = result.replace(/<hr\s*\/?>/gi, "\n\n---\n\n");

  // 4. Blockquotes
  result = result.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, content) => {
    const lines = content
      .replace(/<p[^>]*>/gi, "")
      .replace(/<\/p>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .trim()
      .split("\n");
    const quote = lines.map((l: string) => `> ${l.trim()}`).join("\n");
    return `\n\n${quote}\n\n`;
  });

  // 5. Ordered List <ol>
  result = result.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_, inner) => {
    let index = 1;
    const lines: string[] = [];
    const matches = inner.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi);
    for (const match of matches) {
      const clean = match[1]
        .replace(/<p[^>]*>/gi, "")
        .replace(/<\/p>/gi, "")
        .trim();
      lines.push(`${index++}. ${clean}`);
    }
    return `\n\n${lines.join("\n")}\n\n`;
  });

  // 6. Unordered List <ul> (including task items)
  result = result.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_, inner) => {
    const lines: string[] = [];
    const matches = inner.matchAll(/<li([^>]*)>([\s\S]*?)<\/li>/gi);
    for (const match of matches) {
      const liAttrs = match[1];
      const content = match[2];

      const isTaskItem =
        /data-type="taskItem"/i.test(liAttrs) ||
        /data-checked/i.test(liAttrs) ||
        /class="[^"]*task-item/i.test(liAttrs) ||
        /type="checkbox"/i.test(content);

      if (isTaskItem) {
        const isChecked =
          /data-checked="true"/i.test(liAttrs) ||
          /type="checkbox"[^>]*checked/i.test(content);
        const text = content
          .replace(/<label[\s\S]*?<\/label>/gi, "")
          .replace(/<input[^>]*type="checkbox"[^>]*>/gi, "")
          .replace(/<p[^>]*>/gi, "")
          .replace(/<\/p>/gi, "")
          .replace(/<div[^>]*>/gi, "")
          .replace(/<\/div>/gi, "")
          .trim();
        lines.push(`- [${isChecked ? "x" : " "}] ${text}`);
      } else {
        const clean = content
          .replace(/<p[^>]*>/gi, "")
          .replace(/<\/p>/gi, "")
          .trim();
        lines.push(`- ${clean}`);
      }
    }
    return `\n\n${lines.join("\n")}\n\n`;
  });

  // 7. Paragraphs & Line Breaks
  result = result.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, "\n\n$1\n\n");
  result = result.replace(/<br\s*\/?>/gi, "\n");

  // 8. Inline formatting
  // Inline code: <code>...</code>
  result = result.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, "`$1`");

  // Links: <a href="url">text</a>
  result = result.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)");

  // Bold: <strong> or <b>
  result = result.replace(/<(?:strong|b)[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi, "**$1**");

  // Italic: <em> or <i>
  result = result.replace(/<(?:em|i)[^>]*>([\s\S]*?)<\/(?:em|i)>/gi, "*$1*");

  // Strike: <s> or <del> or <strike>
  result = result.replace(/<(?:s|del|strike)[^>]*>([\s\S]*?)<\/(?:s|del|strike)>/gi, "~~$1~~");

  // 9. Strip remaining HTML tags
  result = result.replace(/<[^>]+>/g, "");

  // 10. Decode entities
  result = unescapeHtml(result);

  // 11. Restore code blocks & image blocks
  result = result.replace(/\u0000CODEBLOCK(\d+)\u0000/g, (_, idx) => {
    return codeBlocks[Number(idx)] ?? "";
  });
  result = result.replace(/\u0000IMAGEBLOCK(\d+)\u0000/g, (_, idx) => {
    return imageBlocks[Number(idx)] ?? "";
  });

  // 12. Clean up whitespace: collapse 3+ newlines to 2 newlines
  result = result
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return result;
}
