const JSZip = require("jszip");
const fs = require("fs");
const path = require("path");

const zip = new JSZip();

function base64_encode(file) {
  // read binary data
  var bitmap = fs.readFileSync(file);
  // convert binary data to base64 encoded string
  return bitmap.toString("base64");
}

function addFile(zip, fpath) {
  if (
    fpath.includes(".json") |
    fpath.includes(".html") |
    fpath.includes(".js") |
    fpath.includes(".css")
  ) {
    return zip.file(path.basename(fpath), fs.readFileSync(fpath, "utf-8"));
  }
  if (
    fpath.includes(".png") |
    fpath.includes(".jpeg") |
    fpath.includes(".jpg")
  ) {
    return zip.file(path.basename(fpath), base64_encode(fpath), {
      base64: true,
    });
  }
  throw new Error(`File not handled ${fpath}`);
}

const rootFiles = ["manifest.json", "tab.png", "tabs.html"];

rootFiles.forEach((file) => addFile(zip, file));

const distZip = zip.folder("dist").folder("esm");

const distDir = fs
  .readdirSync("./dist/esm")
  .map((p) => path.join("./dist/esm", p));

distDir
  .filter((file) => !file.includes(".DS_Store"))
  .forEach((file) => {
    addFile(distZip, file);
  });

const stypesZip = zip.folder("styles");

const stylesDir = fs
  .readdirSync("./styles")
  .map((p) => path.join("./styles", p));

stylesDir
  .filter((file) => !file.includes(".DS_Store"))
  .forEach((file) => {
    addFile(stypesZip, file);
  });

zip
  .generateNodeStream({ type: "nodebuffer", streamFiles: true })
  .pipe(fs.createWriteStream("./dist/package.zip"))
  .on("finish", function () {
    // JSZip generates a readable stream with a "end" event,
    // but is piped here in a writable stream which emits a "finish" event.
    console.log("./dist/package.zip written.");
  });

if (fs.existsSync("./dist/package")) {
  fs.rm("./dist/package", { recursive: true, force: true }, () => {});
}
