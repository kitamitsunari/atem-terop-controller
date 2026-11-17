const esbuild = require('esbuild');
const fs      = require('fs');
const stubFreetypePlugin = {
  name: 'stub-freetype2',
  setup(build) {
    build.onResolve({ filter: /^@julusian\/freetype2$/ }, args => ({
      path: args.path,
      namespace: 'freetype-stub',
    }));
    build.onLoad({ filter: /.*/, namespace: 'freetype-stub' }, () => ({
      contents: 'module.exports = {};',
      loader: 'js',
    }));
  },
};
esbuild.build({
  entryPoints: ['terop_pusher.js'],
  bundle: true,
  platform: 'node',
  target: 'node24',
  charset: 'utf8',
  outfile: 'bundle.js',
  banner: {
    js: 'if (typeof require !== "undefined" && !require.resolve) { require.resolve = (id) => id; }',
  },
  plugins: [stubFreetypePlugin],
}).then(() => {
  let code = fs.readFileSync('bundle.js', 'utf8');
  const target = 'Promise.resolve(require(msg.modulePath))';
  if (!code.includes(target)) {
    console.error('[ERROR] ターゲット文字列が見つかりません');
    process.exit(1);
  }
  code = code.replace(target, 'Promise.resolve(global.__atemSocketChild)');
  fs.writeFileSync('bundle.js', code, 'utf8');
  console.log('[OK] FakeWorker -> global.__atemSocketChild patched!');
});
