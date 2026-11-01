import { failure } from "./lib/actions.mjs";
import { main } from "./lib/run.mjs";

try {
  await main(process.env);
} catch (error) {
  failure(error.message);
  process.exitCode = 1;
}
