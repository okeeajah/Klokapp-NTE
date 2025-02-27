import fs from 'fs';
import fetch from 'node-fetch';
import ora from 'ora';
import prompt from 'prompt-sync';
import cfonts from "cfonts";

const configFile = 'config.json';
const messagesFile = 'NTE-pesan.txt';
const promptSync = prompt();

// Load configuration
if (!fs.existsSync(configFile)) {
  console.error(`❌ Error: File "${configFile}" not found!`);
  process.exit(1);
}
const config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));

// Load messages from file
let messages = [];
if (fs.existsSync(messagesFile)) {
  messages = fs.readFileSync(messagesFile, 'utf-8').split('\n').filter(line => line.trim() !== '');
} else {
  console.error(`❌ Error: File "${messagesFile}" not found!`);
  process.exit(1);
}

// Get session tokens and AI IDs from config.json
const accounts = config.accounts || [];
if (accounts.length === 0) {
  console.error("❌ Error: No accounts found! Add them to config.json.");
  process.exit(1);
}

// Prompt user for loop count and interval
cfonts.say("NT Exhaust", {
  font: "block",
  align: "center",
  colors: ["cyan", "magenta"],
  background: "black",
  letterSpacing: 1,
  lineHeight: 1,
  space: true,
  maxLength: "0",
});

console.log("=== Telegram Channel🚀 : NT Exhaust (@NTExhaust) ===", "\x1b[36m");
const loopCount = parseInt(promptSync('🔄 How many times should each account run? '), 10);
const intervalHours = parseFloat(promptSync('⏳ Interval between each run (in hours)? '));

console.log(`\n🔹 Each account will run ${loopCount} times before switching, with an interval of ${intervalHours} hours between full account cycles.\n`);

async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      options.signal = controller.signal;

      const response = await fetch(url, options);
      clearTimeout(timeout);

      if (!response.ok) throw new Error(`Request failed user limit or website down`);
      
      const text = await response.text();
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
      
    } catch (error) {
      if (attempt === maxRetries || error.name === 'AbortError') {
        console.error(`❌ Request failed user limit or website down`);
        return null;
      }
      console.log(`🔄 Retrying (${attempt}/${maxRetries})...`);
    }
  }
}

async function makeRequests(account, runNumber) {
  const { token, ai_id } = account;
  const spinner = ora(`🔹 [Run ${runNumber}] Using session token: ${token}`).start();
  
  try {
    const headers = {
      'accept': '*/*',
      'content-type': 'application/json',
      'origin': 'https://klokapp.ai',
      'referer': 'https://klokapp.ai/',
      'user-agent': 'Mozilla/5.0',
      'x-session-token': token
    };

    const randomMessage = messages[Math.floor(Math.random() * messages.length)];

    const postData = {
      id: ai_id,
      messages: [{ role: 'user', content: randomMessage }],
      model: 'llama-3.3-70b-instruct',
      created_at: new Date().toISOString(),
      language: 'english'
    };

    spinner.text = `💬 [Run ${runNumber}] Sending request to chat API...`;
    const chatResponse = await fetchWithRetry('https://api1-pp.klokapp.ai/v1/chat', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(postData)
    });

    if (chatResponse) {
      spinner.succeed(`📝 Chat API Response:\n${JSON.stringify(chatResponse, null, 2)}`);
    } else {
      spinner.fail(`❌ Chat API request failed`);
    }

    spinner.text = `📊 [Run ${runNumber}] Fetching rate limit info...`;
    const rateLimitResponse = await fetchWithRetry('https://api1-pp.klokapp.ai/v1/rate-limit', { method: 'GET', headers });
    if (rateLimitResponse) spinner.succeed(`📊 Rate Limit Response:\n${JSON.stringify(rateLimitResponse, null, 2)}`);

    spinner.text = `🎯 [Run ${runNumber}] Fetching points info...`;
    const pointsResponse = await fetchWithRetry('https://api1-pp.klokapp.ai/v1/points', { method: 'GET', headers });
    if (pointsResponse) spinner.succeed(`🎯 Points Response:\n${JSON.stringify(pointsResponse, null, 2)}`);

    const delaySeconds = Math.floor(Math.random() * (10 - 5 + 1) + 5);
    console.log(`⏳ Waiting ${delaySeconds} seconds before next run...`);
    await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));

  } catch (error) {
    spinner.fail(`❌ Error in request: ${error.message}`);
  }
}

(async function runLoop() {
  for (const account of accounts) {
    console.log(`\n🚀 Running all loops for account with token: ${account.token}\n`);
    
    for (let i = 1; i <= loopCount; i++) {
      await makeRequests(account, i);
      await new Promise(resolve => setTimeout(resolve, 15000));
    }

    console.log(`⏳ Waiting 10 seconds before switching to the next account...\n`);
    await new Promise(resolve => setTimeout(resolve, 10000));
  }

  console.log(`⏳ Waiting ${intervalHours} hours before starting the next full cycle...\n`);
  await new Promise(resolve => setTimeout(resolve, intervalHours * 3600 * 1000));

  console.log("\n✅ All accounts have completed their loops! Exiting program.");
})();
