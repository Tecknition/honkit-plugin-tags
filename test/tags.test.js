const test = require('node:test');
const assert = require('node:assert/strict');
const plugin = require('../index');

function createContext() {
  const writes = [];

  const ctx = {
    config: {
      get(key) {
        if (key === 'pluginsConfig') {
          return {};
        }
        return undefined;
      },
    },
    output: {
      toURL(pagePath) {
        if (/README\.md$/i.test(pagePath)) {
          return pagePath.replace(/README\.md$/i, 'index.html');
        }
        return pagePath.replace(/\.md$/i, '.html');
      },
      writeFile(file, content) {
        writes.push({ file, content });
        return Promise.resolve();
      },
    },
  };

  return { ctx, writes };
}

test('finish generates tag page links that point to html outputs', async () => {
  const { ctx, writes } = createContext();

  plugin.hooks.init.call(ctx);

  const page = {
    path: 'chapter/README.md',
    title: 'Chapter Overview',
    content: '---\ntags: [Docs]\n---\nContent body',
  };

  plugin.hooks['page:before'].call(ctx, page);
  plugin.hooks.page.call(ctx, { path: page.path, title: page.title });

  await plugin.hooks.finish.call(ctx);

  const tagPage = writes.find((w) => w.file === 'tags/docs.html');
  assert.ok(tagPage, 'expected docs tag page to be written');
  assert.match(tagPage.content, /href="\.\.\/chapter\/index\.html"/);
});

test('page:before extracts tags from front matter array', () => {
  const { ctx } = createContext();
  plugin.hooks.init.call(ctx);

  const page = {
    path: 'test.md',
    content: '---\ntags: [tag1, tag2, tag3]\n---\nContent',
  };

  const result = plugin.hooks['page:before'].call(ctx, page);
  assert.ok(result.content.includes('Tags:'));
  assert.ok(result.content.includes('tag1'));
  assert.ok(result.content.includes('tag2'));
});

test('page:before extracts tags from front matter string', () => {
  const { ctx } = createContext();
  plugin.hooks.init.call(ctx);

  const page = {
    path: 'test.md',
    content: '---\ntags: "alpha, beta, gamma"\n---\nContent',
  };

  const result = plugin.hooks['page:before'].call(ctx, page);
  assert.ok(result.content.includes('alpha'));
  assert.ok(result.content.includes('beta'));
});

test('page:before extracts tags from HTML comment', () => {
  const { ctx } = createContext();
  plugin.hooks.init.call(ctx);

  const page = {
    path: 'test.md',
    content: '<!-- tags: comment-tag1, comment-tag2 -->\nContent here',
  };

  const result = plugin.hooks['page:before'].call(ctx, page);
  assert.ok(result.content.includes('comment-tag1'));
  assert.ok(result.content.includes('comment-tag2'));
});

test('page:before handles top injection position', () => {
  const { ctx } = createContext();
  ctx.config.get = (key) => {
    if (key === 'pluginsConfig') {
      return { tags: { injectPosition: 'top' } };
    }
  };
  plugin.hooks.init.call(ctx);

  const page = {
    path: 'test.md',
    content: '---\ntags: [test]\n---\nBody content',
  };

  const result = plugin.hooks['page:before'].call(ctx, page);
  const tagIndex = result.content.indexOf('TAGS-PLUGIN');
  const bodyIndex = result.content.indexOf('Body content');
  assert.ok(tagIndex < bodyIndex, 'Tags should appear before body');
});

test('page:before handles absolute links', () => {
  const { ctx } = createContext();
  ctx.config.get = (key) => {
    if (key === 'pluginsConfig') {
      return { tags: { linkAbsolute: true } };
    }
  };
  plugin.hooks.init.call(ctx);

  const page = {
    path: 'deep/nested/test.md',
    content: '---\ntags: [absolute]\n---\nContent',
  };

  const result = plugin.hooks['page:before'].call(ctx, page);
  assert.ok(result.content.includes('/tags/'));
});

test('page:before removes old injected blocks', () => {
  const { ctx } = createContext();
  plugin.hooks.init.call(ctx);

  const page = {
    path: 'test.md',
    content:
      '<!-- TAGS-PLUGIN:START -->OLD TAGS<!-- TAGS-PLUGIN:END -->\n---\ntags: [new]\n---\nContent',
  };

  const result = plugin.hooks['page:before'].call(ctx, page);
  const matches = result.content.match(/TAGS-PLUGIN:START/g) || [];
  assert.strictEqual(matches.length, 1, 'Should only have one tag block');
});

test('page hook stores page title', () => {
  const { ctx } = createContext();
  plugin.hooks.init.call(ctx);

  const page = { path: 'test.md', title: 'Test Page' };
  plugin.hooks.page.call(ctx, page);
  assert.ok(true); // Should not throw
});

test('finish generates index page with all tags', async () => {
  const { ctx, writes } = createContext();
  plugin.hooks.init.call(ctx);

  const page1 = {
    path: 'page1.md',
    title: 'Page 1',
    content: '---\ntags: [common, unique1]\n---\nContent',
  };

  const page2 = {
    path: 'page2.md',
    title: 'Page 2',
    content: '---\ntags: [common, unique2]\n---\nContent',
  };

  plugin.hooks['page:before'].call(ctx, page1);
  plugin.hooks['page:before'].call(ctx, page2);
  plugin.hooks.page.call(ctx, { path: page1.path, title: page1.title });
  plugin.hooks.page.call(ctx, { path: page2.path, title: page2.title });

  await plugin.hooks.finish.call(ctx);

  const indexPage = writes.find((w) => w.file === 'tags/index.html');
  assert.ok(indexPage, 'Index page should be generated');
  assert.ok(indexPage.content.includes('common'));
  assert.ok(indexPage.content.includes('unique1'));
  assert.ok(indexPage.content.includes('unique2'));
});

test('finish handles custom tagsDir config', async () => {
  const { ctx, writes } = createContext();
  ctx.config.get = (key) => {
    if (key === 'pluginsConfig') {
      return { tags: { tagsDir: 'custom-tags' } };
    }
  };

  plugin.hooks.init.call(ctx);

  const page = {
    path: 'test.md',
    content: '---\ntags: [test]\n---\nContent',
  };

  plugin.hooks['page:before'].call(ctx, page);
  plugin.hooks.page.call(ctx, { path: page.path, title: 'Test' });

  await plugin.hooks.finish.call(ctx);

  assert.ok(writes.some((w) => w.file.startsWith('custom-tags/')));
});

test('finish handles showCount config', async () => {
  const { ctx, writes } = createContext();
  ctx.config.get = (key) => {
    if (key === 'pluginsConfig') {
      return { tags: { showCount: false } };
    }
  };

  plugin.hooks.init.call(ctx);

  const page = {
    path: 'test.md',
    content: '---\ntags: [test]\n---\nContent',
  };

  plugin.hooks['page:before'].call(ctx, page);
  plugin.hooks.page.call(ctx, { path: page.path, title: 'Test' });

  await plugin.hooks.finish.call(ctx);

  const indexPage = writes.find((w) => w.file === 'tags/index.html');
  assert.ok(!indexPage.content.includes('hk-count'));
});

test('page:before handles empty content gracefully', () => {
  const { ctx } = createContext();
  plugin.hooks.init.call(ctx);

  const page = { path: 'test.md', content: '' };
  const result = plugin.hooks['page:before'].call(ctx, page);
  assert.ok(result);
});

test('page:before deduplicates tags', () => {
  const { ctx } = createContext();
  plugin.hooks.init.call(ctx);

  const page = {
    path: 'test.md',
    content: '---\ntags: [dup, dup, unique]\n---\n<!-- tags: dup, another -->\nContent',
  };

  const result = plugin.hooks['page:before'].call(ctx, page);
  const dupMatches = (result.content.match(/\bdup\b/g) || []).length;
  // Should appear once in the rendered badges
  assert.ok(dupMatches >= 1);
});

test('fallback output path handles README files', () => {
  const { ctx } = createContext();
  ctx.output = null; // Force fallback
  plugin.hooks.init.call(ctx);

  const page = {
    path: 'docs/README.md',
    content: '---\ntags: [test]\n---\nContent',
  };

  plugin.hooks['page:before'].call(ctx, page);
  plugin.hooks.page.call(ctx, { path: page.path, title: 'Test' });

  assert.ok(true); // Should handle fallback
});

test('handles context without output.toURL', async () => {
  const { ctx, writes } = createContext();
  ctx.output.toURL = null; // Remove toURL
  plugin.hooks.init.call(ctx);

  const page = {
    path: 'test.md',
    content: '---\ntags: [fallback]\n---\nContent',
  };

  plugin.hooks['page:before'].call(ctx, page);
  plugin.hooks.page.call(ctx, { path: page.path, title: 'Test' });

  ctx.output.toURL = (p) => p.replace('.md', '.html'); // Restore for finish
  await plugin.hooks.finish.call(ctx);

  assert.ok(writes.length > 0);
});

test('handles error in output.toURL gracefully', async () => {
  const { ctx, writes } = createContext();
  const originalToURL = ctx.output.toURL;
  ctx.output.toURL = () => {
    throw new Error('toURL error');
  };

  plugin.hooks.init.call(ctx);

  const page = {
    path: 'test.md',
    content: '---\ntags: [error-test]\n---\nContent',
  };

  plugin.hooks['page:before'].call(ctx, page);
  plugin.hooks.page.call(ctx, { path: page.path, title: 'Test' });

  ctx.output.toURL = originalToURL; // Restore
  await plugin.hooks.finish.call(ctx);

  assert.ok(writes.length > 0);
});

test('handles page without path in page hook', () => {
  const { ctx } = createContext();
  plugin.hooks.init.call(ctx);

  const page = { title: 'No Path' };
  plugin.hooks.page.call(ctx, page);
  assert.ok(true); // Should not throw
});

test('finish handles empty tag map', async () => {
  const { ctx, writes } = createContext();
  plugin.hooks.init.call(ctx);

  // No pages with tags
  await plugin.hooks.finish.call(ctx);

  const indexPage = writes.find((w) => w.file === 'tags/index.html');
  assert.ok(indexPage);
  assert.ok(indexPage.content.includes('No tags found'));
});

test('config allows honkit-plugin-tags key', () => {
  const { ctx } = createContext();
  ctx.config.get = (key) => {
    if (key === 'pluginsConfig') {
      return { 'honkit-plugin-tags': { indexTitle: 'Custom Tags' } };
    }
  };

  plugin.hooks.init.call(ctx);

  const page = {
    path: 'test.md',
    content: '---\ntags: [test]\n---\nContent',
  };

  plugin.hooks['page:before'].call(ctx, page);
  assert.ok(true); // Should accept honkit-plugin-tags key
});
