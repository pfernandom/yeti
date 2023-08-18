const { build } = require("esbuild");
const {
  dependencies,
  peerDependencies,
  devDependencies,
} = require("./package.json");
const { Generator } = require("npm-dts");

const external = [
  ...(dependencies ? Object.keys(dependencies) : []),
  ...(peerDependencies ? Object.keys(peerDependencies) : []),
  ...(devDependencies ? Object.keys(devDependencies) : []),
];

const sharedConfig = {
  entryPoints: ["src/scripts/content.ts", "src/scripts/popup.ts"],
  bundle: true,
  minify: true,
  external: external.filter((dep) => !dep.includes("lodash")),
};
build({
  ...sharedConfig,
  platform: "node", // for CJS
  outdir: "dist/",
});
build({
  ...sharedConfig,
  outdir: "dist/esm",
  platform: "neutral", // for ESM
  format: "esm",
});

// new Generator({
//   entry: "src/scripts/popup.ts",
//   output: "dist/popup.d.ts",
// }).generate();
