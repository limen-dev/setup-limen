import { warning } from "./lib/actions.mjs";
import { post } from "./lib/run.mjs";

try {
  await post(process.env);
} catch (error) {
  // Cleanup must not turn a finished job red.
  warning(`cleanup failed: ${error.message}`);
}
