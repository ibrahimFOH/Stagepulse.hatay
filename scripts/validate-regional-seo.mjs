import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const sitemap = path.join(root, 'sitemap.xml');
if (!fs.existsSync(sitemap)) process.exit(0);
const xml = fs.readFileSync(sitemap, 'utf8');
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
const regional = urls.filter(u => /bolg|region|hatay|adana|gaziantep|kahramanmara|osmaniye|kilis/i.test(u));
if (regional.length > 5) {
  console.error(`Regional SEO URL count is ${regional.length}; canonical limit is 5.`);
  process.exit(1);
}
console.log(`Regional SEO validation passed: ${regional.length}/5 active regional URLs.`);
