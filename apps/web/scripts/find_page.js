const fs = require('fs');
const readline = require('readline');

async function processLineByLine() {
  const fileStream = fs.createReadStream('C:/Users/TINH-NGUYEN/.gemini/antigravity-ide/brain/e75250cf-29a5-47da-9155-9c5f3192fa43/.system_generated/logs/transcript.jsonl');

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    if (line.includes('app/page.tsx')) {
        console.log("Found something!");
        const data = JSON.parse(line);
        if (data.tool_calls) {
            for (const call of data.tool_calls) {
                if (call.name === 'view_file' && call.args && call.args.AbsolutePath && call.args.AbsolutePath.includes('page.tsx')) {
                    // console.log("view_file", call);
                }
            }
        }
        if (data.type === 'PLANNER_RESPONSE' && data.content && data.content.includes('page.tsx')) {
            // maybe response content
        }
    }
    if (line.includes('app\\\\page.tsx') || line.includes('app\\\\page.tsx')) {
      console.log("Found windows path!");
    }
  }
}

processLineByLine();
