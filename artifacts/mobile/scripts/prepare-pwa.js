const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const outputDir = path.join(projectRoot, "dist");
const publicDir = path.join(projectRoot, "public");
if (!fs.existsSync(path.join(outputDir, "index.html"))) {
  throw new Error(`Expo web export did not create ${path.join(outputDir, "index.html")}`);
}

for (const filename of ["manifest.webmanifest", "sw.js"]) {
  fs.copyFileSync(path.join(publicDir, filename), path.join(outputDir, filename));
}
for (const [source, target] of [
  ["icon.png", "pwa-icon.png"],
  ["icon-180.png", "hayan-home-icon-v3-180.png"],
  ["icon-192.png", "hayan-home-icon-v3-192.png"],
  ["icon-512.png", "hayan-home-icon-v3-512.png"],
  ["icon-maskable.png", "hayan-home-icon-v3-maskable.png"],
]) {
  fs.copyFileSync(path.join(projectRoot, "assets", "images", source), path.join(outputDir, target));
}

function findHtmlFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return findHtmlFiles(entryPath);
    return entry.isFile() && entry.name.endsWith(".html") ? [entryPath] : [];
  });
}

function setMeta(html, name, content) {
  const pattern = new RegExp(`<meta\\s+name=["']${name}["'][^>]*>`, "i");
  const tag = `  <meta name="${name}" content="${content}" />`;
  return pattern.test(html)
    ? html.replace(pattern, tag)
    : html.replace("</head>", `${tag}\n</head>`);
}

function setLink(html, rel, tag) {
  const pattern = new RegExp(`<link\\s+rel=["']${rel}["'][^>]*>`, "i");
  return pattern.test(html)
    ? html.replace(pattern, tag)
    : html.replace("</head>", `  ${tag}\n</head>`);
}

for (const htmlPath of findHtmlFiles(outputDir)) {
  let html = fs.readFileSync(htmlPath, "utf8");
  html = setMeta(html, "viewport", "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover");
  html = setMeta(html, "apple-mobile-web-app-capable", "yes");
  html = setMeta(html, "apple-mobile-web-app-status-bar-style", "black-translucent");
  html = setMeta(html, "theme-color", "#FFFFFF");
  html = setLink(html, "manifest", '<link rel="manifest" href="/manifest.webmanifest" />');
  html = setLink(html, "apple-touch-icon", '<link rel="apple-touch-icon" sizes="180x180" href="/hayan-home-icon-v3-180.png" />');
  html = setLink(html, "icon", '<link rel="icon" type="image/png" sizes="180x180" href="/hayan-home-icon-v3-180.png" />');
  if (!html.includes("serviceWorker.register")) {
    html = html.replace("</body>", '  <script>if("serviceWorker" in navigator){window.addEventListener("load",()=>navigator.serviceWorker.register("/sw.js").catch((error)=>console.warn("PWA service worker registration failed",error)));}</script>\n</body>');
  }
  fs.writeFileSync(htmlPath, html);
}
console.log("PWA manifest and service worker added to dist/");
