const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
const assets = path.join(root, 'assets');

for (const file of ['apple-touch-icon.png', 'icon-192.png', 'icon-512.png']) {
  fs.copyFileSync(path.join(assets, file), path.join(dist, file));
}

fs.writeFileSync(
  path.join(dist, 'manifest.webmanifest'),
  JSON.stringify(
    {
      name: 'Mareo',
      short_name: 'Mareo',
      start_url: '/mareo/',
      display: 'standalone',
      background_color: '#7BCDE2',
      theme_color: '#04101C',
      icons: [
        { src: '/mareo/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/mareo/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
    },
    null,
    2,
  ),
);

const htmlPath = path.join(dist, 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');
if (!html.includes('apple-touch-icon')) {
  html = html.replace(
    '</head>',
    [
      '<link rel="apple-touch-icon" href="/mareo/apple-touch-icon.png"/>',
      '<link rel="manifest" href="/mareo/manifest.webmanifest"/>',
      '<meta name="theme-color" content="#04101C"/>',
      '<meta name="apple-mobile-web-app-capable" content="yes"/>',
      '<meta name="apple-mobile-web-app-title" content="Mareo"/>',
      '</head>',
    ].join(''),
  );
  fs.writeFileSync(htmlPath, html);
}
