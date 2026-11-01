// The bot login: `limen login --bot github_actions`. The CLI asks the runner for the job's OIDC
// token itself (it needs `permissions: id-token: write`), so no token passes through this action.

// host:port, or [v6]:port. It becomes an argument after `--proxy`, so it may not start with "-".
const PROXY = /^(?:[A-Za-z0-9][A-Za-z0-9.-]*|\[[0-9A-Fa-f:.]+\]):\d{1,5}$/;
const NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export function loginArgs({ proxy, botName = "", audience = "", caFile = "" }) {
  if (!PROXY.test(proxy)) {
    throw new Error(`proxy "${proxy}" is not host:port, for example limen.example.com:443`);
  }
  if (botName && !NAME.test(botName)) throw new Error(`bot-name "${botName}" is not a bot name`);
  if (audience && !/^\S+$/.test(audience)) throw new Error("audience may not contain spaces");
  const args = ["--proxy", proxy, "login", "--bot", "github_actions"];
  if (botName) args.push("--bot-name", botName);
  if (audience) args.push("--audience", audience);
  if (caFile) args.push("--ca-file", caFile);
  return args;
}
