// LinkedIn Job Exporter — adds an "Export .txt" button on LinkedIn job pages
// and downloads the currently viewed job posting as plain text.

(() => {
  const BUTTON_ID = "lje-export-btn";
  const LABEL = "Export .txt";

  // LinkedIn changes its markup often, so every field has several fallbacks.
  const SELECTORS = {
    title: [
      ".job-details-jobs-unified-top-card__job-title h1",
      ".job-details-jobs-unified-top-card__job-title",
      ".jobs-unified-top-card__job-title",
      ".top-card-layout__title",
      "h1.t-24",
    ],
    company: [
      ".job-details-jobs-unified-top-card__company-name a",
      ".job-details-jobs-unified-top-card__company-name",
      ".jobs-unified-top-card__company-name",
      ".topcard__org-name-link",
    ],
    meta: [
      ".job-details-jobs-unified-top-card__primary-description-container",
      ".job-details-jobs-unified-top-card__tertiary-description-container",
      ".jobs-unified-top-card__primary-description",
      ".topcard__flavor-row",
    ],
    insights: [
      ".job-details-fit-level-preferences",
      ".job-details-jobs-unified-top-card__job-insight",
      ".jobs-unified-top-card__job-insight",
    ],
    description: [
      "#job-details",
      ".jobs-description-content__text",
      ".jobs-description__content",
      ".show-more-less-html__markup",
    ],
  };

  const BLOCK_TAGS = new Set([
    "P", "DIV", "SECTION", "ARTICLE", "UL", "OL", "LI", "H1", "H2", "H3",
    "H4", "H5", "H6", "TABLE", "TR", "BLOCKQUOTE", "PRE",
  ]);

  function isJobPage() {
    const { pathname, search } = location;
    if (!pathname.startsWith("/jobs/")) return false;
    return pathname.startsWith("/jobs/view/") || new URLSearchParams(search).has("currentJobId");
  }

  function jobUrl() {
    const id = location.pathname.match(/\/jobs\/view\/(\d+)/)?.[1]
      ?? new URLSearchParams(location.search).get("currentJobId");
    return id ? `https://www.linkedin.com/jobs/view/${id}/` : location.href;
  }

  function first(list) {
    for (const sel of list) {
      const el = document.querySelector(sel);
      if (el && el.textContent.trim()) return el;
    }
    return null;
  }

  function all(list) {
    const seen = new Set();
    const out = [];
    for (const sel of list) {
      for (const el of document.querySelectorAll(sel)) {
        if (seen.has(el) || !el.textContent.trim()) continue;
        seen.add(el);
        out.push(el);
      }
    }
    return out;
  }

  function clean(s) {
    return s.replace(/[ \t ]+/g, " ").trim();
  }

  // Fallback for obfuscated markup: find the "About the job" heading and climb up
  // until we reach the container that also holds the description body.
  function findDescriptionByHeading() {
    const heading = [...document.querySelectorAll("h1, h2, h3, h4, span, div")]
      .find((h) => h.children.length === 0 && /^\s*about the job\s*$/i.test(h.textContent));
    if (!heading) return null;
    const headingLen = heading.textContent.trim().length;
    for (let el = heading.parentElement; el && el !== document.body; el = el.parentElement) {
      if (el.textContent.trim().length > headingLen + 100) return el;
    }
    return null;
  }

  // The tab title is usually "Job Title | Company | LinkedIn" (sometimes prefixed with "(3) ").
  function titleParts() {
    const parts = document.title.replace(/^\(\d+\)\s*/, "").split(" | ").map(clean);
    if (parts.length >= 3 && /linkedin/i.test(parts[parts.length - 1])) {
      return { title: parts[0], company: parts[1] };
    }
    return {};
  }

  function companyFromLink() {
    const link = [...document.querySelectorAll('main a[href*="/company/"]')]
      .find((a) => clean(a.textContent));
    return link ? clean(link.textContent) : "";
  }

  // Converts an element to readable plain text, keeping paragraphs and list bullets.
  function toText(root) {
    let out = "";
    const newline = () => { if (out && !out.endsWith("\n")) out += "\n"; };

    const walk = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        out += node.textContent.replace(/\s+/g, " ");
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const el = node;
      if (el.tagName === "SCRIPT" || el.tagName === "STYLE" || el.tagName === "BUTTON") return;
      if (el.getAttribute("aria-hidden") === "true" || el.classList.contains("visually-hidden")) return;
      if (el.tagName === "BR") { out += "\n"; return; }

      const block = BLOCK_TAGS.has(el.tagName);
      if (block) newline();
      if (el.tagName === "LI") out += "- ";
      for (const child of el.childNodes) walk(child);
      if (block) newline();
      if (/^(P|H[1-6]|UL|OL)$/.test(el.tagName)) out += "\n";
    };

    walk(root);
    return out
      .split("\n")
      .map((line) => line.replace(/[ \t ]+/g, " ").trim())
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function extractJob() {
    const fromTab = titleParts();
    const title = clean(first(SELECTORS.title)?.textContent ?? "")
      || fromTab.title
      || clean(document.querySelector("main h1")?.textContent ?? "");
    const company = clean(first(SELECTORS.company)?.textContent ?? "")
      || fromTab.company
      || companyFromLink();
    const meta = all(SELECTORS.meta).map((el) => clean(el.innerText)).filter(Boolean);
    const insights = all(SELECTORS.insights).map((el) => toText(el)).filter(Boolean);
    const descEl = first(SELECTORS.description) ?? findDescriptionByHeading();
    const description = descEl ? toText(descEl) : "";

    return { title, company, meta, insights, description, url: jobUrl() };
  }

  function formatJob(job) {
    const lines = [];
    lines.push(`Title:    ${job.title || "(not found)"}`);
    lines.push(`Company:  ${job.company || "(not found)"}`);
    lines.push(`URL:      ${job.url}`);
    lines.push(`Exported: ${new Date().toISOString().slice(0, 16).replace("T", " ")}`);
    if (job.meta.length) {
      lines.push("", "Details:");
      for (const m of job.meta) lines.push(m);
    }
    if (job.insights.length) {
      lines.push("", "Highlights:");
      for (const i of job.insights) lines.push(i);
    }
    lines.push("", "=".repeat(60), "", job.description || "(description not found)", "");
    return lines.join("\n");
  }

  function fileName(job) {
    const base = [job.company, job.title].filter(Boolean).join(" - ") || "linkedin-job";
    return base.replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, " ").slice(0, 120).trim() + ".txt";
  }

  function download(text, name) {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function flash(btn, text, state) {
    btn.textContent = text;
    btn.dataset.state = state;
    setTimeout(() => { btn.textContent = LABEL; delete btn.dataset.state; }, 2000);
  }

  function onExport(e) {
    const btn = e.currentTarget;
    const job = extractJob();
    if (!job.title && !job.description) {
      flash(btn, "Job not found", "error");
      return;
    }
    download(formatJob(job), fileName(job));
    flash(btn, "Saved ✓", "ok");
  }

  function sync() {
    const existing = document.getElementById(BUTTON_ID);
    if (isJobPage()) {
      if (existing) return;
      const btn = document.createElement("button");
      btn.id = BUTTON_ID;
      btn.type = "button";
      btn.textContent = LABEL;
      btn.title = "Export this job posting as a .txt file";
      btn.addEventListener("click", onExport);
      document.body.appendChild(btn);
    } else if (existing) {
      existing.remove();
    }
  }

  // LinkedIn is a single-page app, so re-check whenever the URL changes.
  let lastUrl = "";
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      sync();
    }
  }, 500);
})();
