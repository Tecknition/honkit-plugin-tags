/* eslint-env node */
'use strict';

const path = require('path');
const matter = require('gray-matter');

const START_MARK = '<!-- TAGS-PLUGIN:START -->';
const END_MARK = '<!-- TAGS-PLUGIN:END -->';

const defaultConfig = {
  frontMatterKey: 'tags',
  injectPosition: 'bottom',    // 'top' | 'bottom'
  linkAbsolute: false,         // if true, use "/tags/<slug>.html" links
  indexTitle: 'Tags',
  tagsDir: 'tags',
  tagIndexFilename: 'index.html',
  showCount: true,
  badgeStyle: 'pill',          // 'pill' | 'chip' | 'raw'
  lowercaseSlugs: true
};

let pageTagsMap = new Map();   // path -> string[]
let pageTitleMap = new Map();  // path -> string

function uniq(arr) {
  return Array.from(new Set(arr));
}

function slugify(str, lowercase) {
  const s = lowercase ? String(str).toLowerCase() : String(str);
  return s.trim()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

function normalizeOutputPath(str) {
  return String(str || '').replace(/\\/g, '/').replace(/^\/+/, '');
}

function fallbackOutputPath(pagePath) {
  const normalized = normalizeOutputPath(pagePath);
  if (!normalized) return '';

  if (/README(\.[^./]+)?$/i.test(normalized)) {
    return normalized.replace(/README(\.[^./]+)?$/i, 'index.html');
  }

  return normalized.replace(/\.[^./]+$/, '.html');
}

function resolveOutputPath(ctx, pagePath) {
  if (!pagePath) return '';

  if (ctx && ctx.output && typeof ctx.output.toURL === 'function') {
    try {
      const resolved = ctx.output.toURL(pagePath);
      if (resolved) return normalizeOutputPath(resolved);
    } catch (e) {
      // swallow and fallback below
    }
  }

  return fallbackOutputPath(pagePath);
}

function relativeHref(fromFile, targetPath) {
  const fromDir = path.posix.dirname(fromFile);
  const relative = path.posix.relative(fromDir, targetPath);
  if (!relative) return path.posix.basename(targetPath);
  return relative;
}

function getPluginConfig(ctx) {
  try {
    const root = ctx && ctx.config
      ? (ctx.config.get ? ctx.config.get('pluginsConfig') : (ctx.config.values && ctx.config.values.pluginsConfig))
      : null;
    // allow both "honkit-plugin-tags" and "tags" keys for convenience
    return Object.assign({}, root && (root['honkit-plugin-tags'] || root['tags'] || {}));
  } catch (e) {
    return {};
  }
}

function extractTagsFromFrontMatter(content, key) {
  const fm = matter(content);
  let tags = [];
  const data = fm.data || {};
  const raw = data[key];
  if (Array.isArray(raw)) {
    tags = raw;
  } else if (typeof raw === 'string') {
    tags = raw.split(/[,|;]/).map(s => s.trim()).filter(Boolean);
  }
  return { tags, content: fm.content };
}

function extractTagsFromHtmlComment(content) {
  const m = content.match(/<!--\s*tags\s*:\s*([^>]*)-->/i);
  if (!m) return [];
  return m[1].split(/[,|;]/).map(s => s.trim()).filter(Boolean);
}

function renderBadges(tags, pagePath, cfg) {
  if (!tags || !tags.length) return '';
  const depth = (pagePath && pagePath.includes('/')) ? (pagePath.split('/').length - 1) : 0;
  const prefix = cfg.linkAbsolute ? '/' : '../'.repeat(depth);
  const hrefBase = `${prefix}${cfg.tagsDir.replace(/^\/+|\/+$/g,'')}/`;

  const badges = tags.map(t => {
    const slug = slugify(t, cfg.lowercaseSlugs);
    return `<a class="hk-tags-badge hk-style-${cfg.badgeStyle}" href="${hrefBase}${slug}.html">${escapeHtml(t)}</a>`;
  }).join(' ');

  return `

${START_MARK}
<div class="hk-tags-container">
  <span class="hk-tags-label">Tags:</span> ${badges}
</div>
${END_MARK}

`;
}

function renderIndexPage(tagToPages, cfg) {
  const tags = Array.from(tagToPages.keys()).sort((a,b)=>a.localeCompare(b));
  const items = tags.map(t => {
    const slug = slugify(t, cfg.lowercaseSlugs);
    const count = tagToPages.get(t).length;
    const countHtml = cfg.showCount ? ` <span class="hk-count">(${count})</span>` : '';
    return `<li><a href="${slug}.html">${escapeHtml(t)}</a>${countHtml}</li>`;
  }).join('\n');
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(cfg.indexTitle)}</title>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <link rel="stylesheet" href="../assets/tags.css">
</head>
<body class="hk-tags-page">
  <main class="hk-container">
    <h1>${escapeHtml(cfg.indexTitle)}</h1>
    ${tags.length ? `<ul class="hk-tag-list">
${items}
</ul>` : '<p>No tags found.</p>'}
  </main>
</body>
</html>`;
}

function renderTagPage(tag, pages, cfg) {
  const items = pages.map(p => `<li><a href="${escapeHtml(p.href)}">${escapeHtml(p.title)}</a></li>`).join('\n');
  const title = `Tag: ${tag}`;
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <link rel="stylesheet" href="../assets/tags.css">
</head>
<body class="hk-tags-page">
  <main class="hk-container">
    <h1>${escapeHtml(title)}</h1>
    ${pages.length ? `<ul class="hk-page-list">
${items}
</ul>` : '<p>No pages for this tag.</p>'}
    <p><a href="index.html">← All tags</a></p>
  </main>
</body>
</html>`;
}

module.exports = {
  book: {
    assets: './assets',
    css: ['tags.css']
  },
  hooks: {
    init: function() {
      pageTagsMap = new Map();
      pageTitleMap = new Map();
    },
    'page:before': function(page) {
      const cfg = Object.assign({}, defaultConfig, getPluginConfig(this));

      const original = page.content || '';
      // Remove prior injected tag blocks to avoid duplication on rebuilds
      const withoutOld = original.replace(new RegExp(`\\n?${START_MARK}[\\s\\S]*?${END_MARK}\\n?`, 'g'), '');

      // Parse front matter tags and strip it from content so it doesn't render
      const fm = extractTagsFromFrontMatter(withoutOld, cfg.frontMatterKey);
      let tags = fm.tags;
      let content = fm.content;

      // Fallback: allow a simple HTML comment form anywhere in the page
      tags = uniq([ ...tags, ...extractTagsFromHtmlComment(content) ])
        .map(t => String(t).trim())
        .filter(Boolean);

      if (tags.length) pageTagsMap.set(page.path, tags);

      // Inject badges
      const badges = renderBadges(tags, page.path, cfg);
      page.content = (cfg.injectPosition === 'top')
        ? (badges + content)
        : (content + badges);

      return page;
    },
    page: function(page) {
      if (page && page.path) {
        pageTitleMap.set(page.path, page.title || page.path);
      }
      return page;
    },
    finish: function() {
      const cfg = Object.assign({}, defaultConfig, getPluginConfig(this));

      // Build tag -> pages map
      const tagToPages = new Map();
      pageTagsMap.forEach((tags, p) => {
        tags.forEach(t => {
          const key = String(t);
          if (!tagToPages.has(key)) tagToPages.set(key, []);
          tagToPages.get(key).push({ title: pageTitleMap.get(p) || p, path: p });
        });
      });

      // Sort pages within each tag
      tagToPages.forEach(list => list.sort((a,b) => a.title.localeCompare(b.title)));

      const tagsDir = cfg.tagsDir.replace(/^\/+|\/+$/g, '');
      const tagsBase = tagsDir || '.';
      const indexPath = path.posix.join(tagsBase, cfg.tagIndexFilename);

      const indexHtml = renderIndexPage(tagToPages, cfg);
      const that = this;

      return this.output.writeFile(indexPath, indexHtml).then(() => {
        const promises = [];
        Array.from(tagToPages.keys()).sort((a,b) => a.localeCompare(b)).forEach(tag => {
          const slug = slugify(tag, cfg.lowercaseSlugs);
          const file = path.posix.join(tagsBase, `${slug}.html`);
          const targetPages = (tagToPages.get(tag) || []).map(page => {
            const outputPath = resolveOutputPath(that, page.path);
            const href = outputPath ? relativeHref(file, outputPath) : '#';
            return { title: page.title, href };
          });
          const html = renderTagPage(tag, targetPages, cfg);
          promises.push(that.output.writeFile(file, html));
        });
        return Promise.all(promises);
      });
    }
  }
};
