import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const activeRegions=['hatay','adana','gaziantep','sanliurfa','mersin'];
const expected=new Set(activeRegions.map(r=>`https://stagepulse.com.tr/${r}/`));
const sitemap=path.join(root,'sitemap.xml');
const fail=m=>{console.error(`Regional SEO validation failed: ${m}`);process.exit(1);};
if(!fs.existsSync(sitemap))fail('sitemap.xml is missing.');
const xml=fs.readFileSync(sitemap,'utf8');
const urls=[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1].trim());
const regional=urls.filter(u=>activeRegions.some(r=>u===`https://stagepulse.com.tr/${r}/`));
if(regional.length!==5||new Set(regional).size!==5)fail(`sitemap must contain exactly five active regional URLs; found ${regional.length}.`);
for(const url of expected)if(!urls.includes(url))fail(`missing canonical sitemap URL: ${url}`);
const seen=new Map();
const normalize=v=>v.toLocaleLowerCase('tr-TR').replace(/\s+/g,' ').trim();
const strip=html=>normalize(html.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' '));
for(const region of activeRegions){
 const file=path.join(root,region,'index.html');if(!fs.existsSync(file))fail(`missing ${region}/index.html`);
 const html=fs.readFileSync(file,'utf8');
 const canonical=html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1];
 const title=html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim();
 const description=html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1]?.trim();
 const h1=html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g,' ').trim();
 if(canonical!==`https://stagepulse.com.tr/${region}/`)fail(`${region}: invalid canonical.`);
 if(!title||!description||!h1)fail(`${region}: title, description and H1 are required.`);
 for(const [label,value] of [['title',title],['description',description],['h1',h1]]){const key=`${label}:${normalize(value)}`;if(seen.has(key))fail(`${region}: duplicate ${label} with ${seen.get(key)}.`);seen.set(key,region);}
 const text=strip(html);if(text.length<500)fail(`${region}: content is too thin.`);const bodyKey=`body:${text}`;if(seen.has(bodyKey))fail(`${region}: duplicate regional body with ${seen.get(bodyKey)}.`);seen.set(bodyKey,region);
 if(!html.includes('/bolgeler.html'))fail(`${region}: missing regional hub link.`);if(!html.includes('/teklif.html'))fail(`${region}: missing teklif.html internal link.`);
}
console.log('Regional SEO validation passed: 5 active regions, unique metadata/body, canonical URLs and internal links verified.');
