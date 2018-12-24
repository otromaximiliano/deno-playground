import { args, run, stat, readFile, exit } from "deno";
import { parse } from "https://deno.land/x/flags/index.ts";
import { serve } from "https://deno.land/x/net/http.ts";
import { intercept, route, get, html, empty, file } from "./middleware.ts";

const parsedArgs = parse(args);
const mainFile = parsedArgs._[1];
const indexHtml = parsedArgs._[2];
const port = parsedArgs.p || parsedArgs.port || 3000;
const help = parsedArgs.h || parsedArgs.help;
if (help) {
  showUsage();
  exit(0);
}
if (!mainFile || !indexHtml) {
  showUsage();
  exit(1);
}
function showUsage() {
  console.log();
  console.log(
    `Usage:
    deno ./start.ts src/Main.elm src/index.html --allow-net --allow-run`
  );
  console.log();
}

main(mainFile, indexHtml, port);

async function main(main: string, index: string, port: number) {
  let lastModified = null;
  let shouldRefresh = false;
  (async () => {
    const serve_ = intercept(
      serve,
      [
        function requestLogger(req) {
          // console.log(req.method, req.url);
        },
        route([
          get("/", async req => {
            const data = await readFile(index);
            const decoder = new TextDecoder();
            const html_ = decoder
              .decode(data)
              .replace("</head>", `<script>${reloader}</script></head>`);
            await html(req, html_);
          }),
          get("/elm.js", async req => {
            await file(req, "dist/elm.js", "application/json");
          }),
          get("/live", async req => {
            if (shouldRefresh) {
              shouldRefresh = false;
              await empty(req, 205);
            } else {
              await empty(req, 200);
            }
          })
        ])
      ],
      {
        "404": async req => {
          await empty(req, 404);
        },
        "500": async req => {
          await empty(req, 500);
        }
      }
    );
    const s = serve_("127.0.0.1:" + port);
    console.log("server listening on " + port + ".");
  })();
  while (true) {
    lastModified = await watch(main, lastModified);
    const code = await compile(main);
    if (code === 0) {
      shouldRefresh = true;
    }
  }
}

async function watch(main: string, lastModified: number): Promise<number> {
  while (true) {
    const fileInfo = await stat(main);
    if (!lastModified && fileInfo) {
      return fileInfo.modified;
    }
    if (lastModified && lastModified < fileInfo.modified) {
      return fileInfo.modified;
    }
    await new Promise(resolve => {
      setTimeout(resolve, 500);
    });
  }
}

function compile(main: string): Promise<number> {
  return new Promise(async resolve => {
    const process = run({
      args: ["elm", "make", main, "--output", "dist/elm.js"],
      stdout: "inherit",
      stderr: "inherit"
    });
    const status = await process.status();
    resolve(status.code);
  });
}

const reloader = `
  errorCount = 0;
  function live() {
    fetch("/live").then(res => {
      console.log(res.status);
      if (res.status === 205) {
        errorCount = 0;
        location.reload();
      } else if (res.status === 200) {
        errorCount = 0;
        setTimeout(live, 1000);
      } else {
        errorCount++;
        if(errorCount > 10) {
          console.log("stopped connection.");
        } else {
          setTimeout(live, 1000);
        }
      }
    }).catch(e => {
      errorCount++;
      if(errorCount > 10) {
        console.log("stopped connection.");
      } else {
        setTimeout(live, 1000);
      }
    });
  }
  live();
`;