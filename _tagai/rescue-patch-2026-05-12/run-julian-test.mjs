// One-shot launcher: invokes runPipeline programmatically so that
// imported modules' CLI tails (mockup.ts:1371 etc.) don't see our
// positional args and misinterpret them as business IDs.
import { runPipeline } from './src/pipeline.js';

// Wipe positional args BEFORE pipeline.ts module-load triggers its own CLI block.
// (Module already loaded by the import above — but ungated CLI tails in deeper
// modules can still fire if invoked later. Belt and suspenders.)
process.argv = [process.argv[0], process.argv[1]];

await runPipeline({
  lat: 33.0775,           // Argyle TX
  lng: -97.2140,
  radiusMiles: 5,
  verticalSlugs: ['dentistry'],
  maxDiscover: 5,         // tiny: Google Places quota friendly
  maxAudit: 5,            // tiny: Firecrawl spend friendly
  maxEmail: 3,            // hard cap on first run regardless of DAILY_SEND_CAP
  dryRun: false,
});
