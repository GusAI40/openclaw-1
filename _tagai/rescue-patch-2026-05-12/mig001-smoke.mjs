import { isSuppressed, getTodaysSendCount, wakeReadySnoozes } from "./src/lib/db.js";
import { getFromDomain, env } from "./src/lib/env.js";
console.log("TENANT:", env.TENANT_ID, "| CAP:", env.DAILY_SEND_CAP, "| FROM:", getFromDomain());
console.log("isSuppressed(test@example.com):", await isSuppressed("test@example.com"));
console.log("sentToday:", await getTodaysSendCount(getFromDomain()));
console.log("wakeReadySnoozes:", await wakeReadySnoozes());
