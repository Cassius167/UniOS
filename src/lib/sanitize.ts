/**
 * Minimal allow-list HTML sanitizer for note content (runs in the browser).
 * Notes are only ever rendered back into the editor, but imported files could
 * contain anything, so scripts, event handlers and unknown tags are stripped.
 */
const ALLOWED_TAGS = new Set(["P", "BR", "DIV", "SPAN", "H1", "H2", "H3", "STRONG", "B", "EM", "I", "U", "S", "UL", "OL", "LI", "BLOCKQUOTE", "CODE", "PRE", "A", "HR"]);
const ALLOWED_ATTRS: Record<string, string[]> = { A: ["href", "target", "rel"], UL: ["data-checklist"], LI: ["data-checked"] };

export function sanitizeHtml(html: string): string {
  if (typeof window === "undefined") return html.replace(/<[^>]*>/g, "");
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstElementChild as HTMLElement;
  const walk = (el: Element) => {
    for (const child of [...el.children]) {
      if (!ALLOWED_TAGS.has(child.tagName)) {
        if (["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED"].includes(child.tagName)) child.remove();
        else child.replaceWith(...child.childNodes);
        continue;
      }
      for (const attr of [...child.attributes]) {
        const ok = ALLOWED_ATTRS[child.tagName]?.includes(attr.name);
        if (!ok || (attr.name === "href" && !/^(https?:|mailto:)/i.test(attr.value.trim()))) child.removeAttribute(attr.name);
      }
      if (child.tagName === "A") {
        child.setAttribute("target", "_blank");
        child.setAttribute("rel", "noopener noreferrer");
      }
      walk(child);
    }
  };
  walk(root);
  // second pass: unwrapped children may themselves contain disallowed nodes
  walk(root);
  return root.innerHTML;
}

export const htmlToText = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
