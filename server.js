const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 3000;
const publicDir = path.join(__dirname, "public");

const server = http.createServer((req, res) => {
  const requestedPath = req.url === "/" ? "/index.html" : req.url;
  const filePath = path.join(publicDir, requestedPath);

  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
      return;
    }

    res.writeHead(200, { "Content-Type": getContentType(filePath) });
    res.end(content);
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

function getContentType(filePath) {
  const extension = path.extname(filePath);

  if (extension === ".css") return "text/css";
  if (extension === ".js") return "text/javascript";
  if (extension === ".html") return "text/html";

  return "text/plain";
}
