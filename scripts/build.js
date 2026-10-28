#!/usr/bin/env node
// Regenerates index.html and sitemap.xml from content.json.
// The admin page does the same thing in the browser when you click "Publikasikan";
// run this only after editing content.json or render.js by hand:  node scripts/build.js
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const { renderPage, renderSitemap } = require(path.join(root, 'assets/js/render.js'));
const content = JSON.parse(fs.readFileSync(path.join(root, 'content.json'), 'utf8'));
fs.writeFileSync(path.join(root, 'index.html'), renderPage(content));
fs.writeFileSync(path.join(root, 'sitemap.xml'), renderSitemap(content));
console.log('index.html dan sitemap.xml diperbarui.');
