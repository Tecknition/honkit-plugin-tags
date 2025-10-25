const test = require('node:test');
const assert = require('node:assert/strict');

let plugin;
let hasGrayMatter = true;

try {
  require.resolve('gray-matter');
  plugin = require('../index');
} catch (err) {
  hasGrayMatter = false;
}

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

test('finish generates tag page links that point to html outputs', hasGrayMatter ? {} : { skip: true }, async () => {
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
