const { spawn } = require("node:child_process");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const expoCli = path.join(projectRoot, "node_modules", "expo", "bin", "cli");
const userArgs = process.argv.slice(2);
const expoArgs = userArgs.filter((arg) => !["--lan", "--tunnel", "--tunnel-v2", "--go", "--dev-client", "--offline"].includes(arg));
const env = {
  ...process.env,
  EXPO_NO_METRO_WORKSPACE_ROOT: "1",
  DALKA_EXPO_GO_LOCAL: "1",
};

// LAN Expo Go startup needs online manifest signing, even though Metro itself
// serves the JavaScript bundle directly over the local network.
delete env.EXPO_OFFLINE;
delete env.EXPO_UNSTABLE_TUNNEL_V2;

const child = spawn(
  process.execPath,
  [expoCli, "start", "--lan", "--go", ...expoArgs],
  {
    cwd: projectRoot,
    env,
    stdio: "inherit",
  },
);

child.on("error", (error) => {
  console.error("Could not start the Expo Go development server:", error);
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
