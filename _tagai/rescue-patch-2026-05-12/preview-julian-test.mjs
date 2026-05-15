// One-shot: render Texas Built Construction's outreach email
// and send it to wirelessgus@gmail.com so Gus can see exactly
// what a real prospect would receive. No DB writes.
import { previewOutreachEmail } from './src/outreach/email.js';

const slug = process.argv[2] || 'texas-built-construction-dallas';
const redirectTo = process.argv[3] || 'wirelessgus@gmail.com';
const deployUrlBase = process.argv[4]; // optional override, e.g. https://3dd78ea0.rescue-websites.pages.dev

console.log(`Preview send: slug=${slug} -> ${redirectTo}${deployUrlBase ? ` (deploy=${deployUrlBase})` : ''}`);
const result = await previewOutreachEmail(slug, redirectTo, deployUrlBase);
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);
