# honkit-plugin-tags

Add page tagging to Honkit/GitBook in a simple, intuitive way:

- Define tags in YAML front matter **or** with a one-line HTML comment.
- The plugin injects tag badges on each page.
- It generates a global **Tags index** and **per-tag** listing pages.

> Designed for Honkit (GitBook legacy). Zero placeholders, production-ready.

---

## Installation

```bash
npm install --save honkit-plugin-tags
# or
yarn add honkit-plugin-tags
```

In your `book.json` (or `book.js`), add the plugin:

```json
{
  "plugins": ["honkit-plugin-tags"],
  "pluginsConfig": {
    "honkit-plugin-tags": {
      "injectPosition": "bottom",
      "linkAbsolute": false,
      "frontMatterKey": "tags",
      "indexTitle": "Tags",
      "tagsDir": "tags",
      "tagIndexFilename": "index.html",
      "showCount": true,
      "badgeStyle": "pill",
      "lowercaseSlugs": true
    }
  }
}
```

> You can also use a short key `tags` in `pluginsConfig` instead of `honkit-plugin-tags` if you prefer.

---

## Authoring tags

### 1) YAML front matter (recommended)

At the top of a page:

```markdown
---
title: My Page
tags: [api, auth, jwt]
---

# My Page

Content goes here…
```

You can also provide a string:

```markdown
---
tags: api, auth, jwt
---
```

### 2) HTML comment (fallback)

Place this anywhere in the page:

```html
<!-- tags: api, auth, jwt -->
```

---

## What the plugin does

1. Parses front matter / comment to collect tags for each page.
2. Injects tag badges at the **bottom** (or top) of each page, e.g.

```
Tags: [api] [auth] [jwt]
```

3. Generates:
   - `tags/index.html` – a global index of all tags with counts.
   - `tags/<tag>.html` – a page listing all pages for that tag.

### Links & depth

- By default, links are **relative** so pages in nested folders still link to `/tags/...` correctly.
- If you want absolute-root links (e.g., deployed at domain root), set `"linkAbsolute": true`.

---

## CSS

A minimal stylesheet is included and automatically injected (`assets/tags.css`).  
Feel free to override styles in your theme.

---

## Options

| Option             | Type    | Default      | Description                                               |
| ------------------ | ------- | ------------ | --------------------------------------------------------- |
| `frontMatterKey`   | string  | `tags`       | Key name to read from YAML front matter.                  |
| `injectPosition`   | string  | `bottom`     | `"top"` or `"bottom"` injection of badges.                |
| `linkAbsolute`     | boolean | `false`      | Use absolute `/tags/...` links instead of relative links. |
| `indexTitle`       | string  | `Tags`       | Title for the tag index page.                             |
| `tagsDir`          | string  | `tags`       | Directory (under site root) for generated tag pages.      |
| `tagIndexFilename` | string  | `index.html` | Filename for the tag index page.                          |
| `showCount`        | boolean | `true`       | Show per-tag page counts in the index.                    |
| `badgeStyle`       | string  | `pill`       | One of `pill`, `chip`, or `raw`.                          |
| `lowercaseSlugs`   | boolean | `true`       | Lowercase tag slugs for generated filenames.              |

---

## Notes

- The plugin removes previously injected tag blocks on rebuilds to prevent duplication.
- Titles used in tag pages are taken from the page title resolved by Honkit.
- If no tags are found anywhere, the `/tags/index.html` page will say “No tags found.”

---

## License

MIT
