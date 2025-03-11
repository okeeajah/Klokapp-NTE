import { ethers } from "ethers";
import fs from "fs";
import crypto from "crypto";
import chalk from "chalk";
import fetch from "node-fetch";
import ora from "ora";
import prompt from "prompt-sync";
import cfonts from "cfonts";
import { v4 as uuidv4 } from "uuid";

// Ubah ke true untuk melakukan Debugging
const DEBUG = false;
const BASE_URL = "https://api1-pp.klokapp.ai";
const messagesFile = "NTE-pesan.txt";
const privateKeysFile = "privatekeys.txt";
const promptSync = prompt();
const REFERRAL_CODE = "H3NHLTWJ";

function prettyPrint(obj, indent = 0) {
  const spacing = "  ".repeat(indent);
  for (const key in obj) {
    if (typeof obj[key] === "object" && obj[key] !== null) {
      console.log(`${spacing}\x1b[36m${key}:\x1b[0m`);
      prettyPrint(obj[key], indent + 1);
    } else {
      console.log(`${spacing}\x1b[36m${key}:\x1b[0m ${obj[key]}`);
    }
  }
}

function centerText(text, color = "cyanBright") {
  const terminalWidth = process.stdout.columns || 80;
  const textLength = text.length;
  const padding = Math.max(0, Math.floor((terminalWidth - textLength) / 2));
  return " ".repeat(padding) + chalk[color](text);
}

function akunDelay(minMs, maxMs) {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  console.log(chalk.bold.grey(`\n⏳ Menunggu ${delay / 1000} detik sebelum beralih ke akun berikutnya...\n`));
  return new Promise((resolve) => setTimeout(resolve, delay));
}

function taskDelay(minMs, maxMs) {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  console.log(chalk.bold.grey(`\n⏳ Menunggu ${delay / 1000} detik sebelum chat berikutnya...\n`));
  return new Promise((resolve) => setTimeout(resolve, delay));
}

function printSection(title, content, icon = "✨") {
  console.log(`\n\x1b[35m${icon} =========================================== ${title} ========================================== ${icon}\x1b[0m`);
  if (typeof content === "object") {
    prettyPrint(content);
  } else {
    console.log(`\x1b[32m${content}\x1b[0m`);
  }
}

function formatResetTime(resetTime) {
  const resetDate = new Date(Date.now() + resetTime * 1000);
  return resetDate.toLocaleString();
}

async function typeOutText(text, delay = 1) {
  for (const char of text) {
    process.stdout.write(char);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

async function typeOutResponse(text) {
  printSection("Chat API Response", "");
  await typeOutText(text, 1);
  console.log("\n\x1b[35m==============================================================================================================\x1b[0m\n");
}

async function fetchWithoutRetry(url, options, spinner, noTimeout = false) {
  try {
    let controller, timeout;
    if (!noTimeout) {
      controller = new AbortController();
      timeout = setTimeout(() => controller.abort(), 10000);
      options.signal = controller.signal;
    }
    const response = await fetch(url, options);
    if (!noTimeout) clearTimeout(timeout);
    if (!response.ok) throw new Error(`Request gagal`);
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  } catch (error) {
    spinner.fail(chalk.redBright(` ${error.message}`));
    return null;
  }
}

async function checkChatConnectivity(headers) {
  const spinner = ora("⏳ Mengecek konektivitas Chat API...").start();
  try {
    await fetch(`${BASE_URL}/v1/chat`, { method: "HEAD", headers });
    spinner.succeed(chalk.greenBright(" Konektivitas Chat API baik 🚀"));
    return true;
  } catch (error) {
    spinner.fail(chalk.redBright(" Konektivitas Chat API bermasalah."));
    return false;
  }
}

if (!fs.existsSync(messagesFile)) {
  console.error(`❌ Error: File "${messagesFile}" tidak ditemukan!`);
  process.exit(1);
}

let messages = fs.readFileSync(messagesFile, "utf-8")
                .split("\n")
                .filter((line) => line.trim() !== "");

if (!fs.existsSync(privateKeysFile)) {
  console.error(`❌ Error: File "${privateKeysFile}" tidak ditemukan!`);
  process.exit(1);
}

const PRIVATE_KEYS = fs.readFileSync(privateKeysFile, "utf-8")
                      .split("\n")
                      .map((line) => line.trim())
                      .filter((line) => line !== "");

if (PRIVATE_KEYS.length === 0) {
  console.error("❌ Error: Tidak ada private key yang ditemukan!");
  process.exit(1);
}

cfonts.say("NT Exhaust", {
  font: "block",
  align: "center",
  colors: ["cyan", "magenta"],
});

console.log(centerText("=== Telegram Channel 🚀 : NT Exhaust (@NTExhaust) ==="));
console.log(centerText("⌞👤 Mod : @NT_Exhaust & @chelvinsanjaya ⌝ \n"));
const loopCount = parseInt(promptSync("📝 Berapa kali setiap akun melakukan chat dengan AI ? "), 10);

async function signAndVerify(privateKey) {
   try {
     const wallet = new ethers.Wallet(privateKey);
     const nonce = crypto.randomBytes(32).toString("hex");
     const issuedAt = new Date().toISOString();
     const message = `klokapp.ai wants you to sign in with your Ethereum account:\n${wallet.address}\n\n\nURI: https://klokapp.ai/\nVersion: 1\nChain ID: 1\nNonce: ${nonce}\nIssued At: ${issuedAt}`;
     const signature = await wallet.signMessage(message);

     // Hanya untuk keperluan Debuging
     if (DEBUG) {
       console.log(chalk.green("Generated Signature:"), signature);
       console.log(chalk.green("New Nonce:"), nonce);
       console.log(chalk.green("Issued Date:"), issuedAt);
     }

     const payload = { signedMessage: signature, message, referral_code: REFERRAL_CODE };

     if (DEBUG) {
       console.log(chalk.blue("Sending verification request..."));
     }

     let response, result;
     const headers = {
       "Content-Type": "application/json",
       Accept: "*/*",
       Origin: "https://klokapp.ai",
       Referer: "https://klokapp.ai/",
       "User-Agent": "Mozilla/5.0"
     };

     for (let i = 0; i < 3; i++) {
       response = await fetch(`${BASE_URL}/v1/verify`, {
         method: "POST",
         headers,
         body: JSON.stringify(payload)
       });
       if (DEBUG) {
         console.log(chalk.blue("Status Code:"), response.status);
         console.log(chalk.blue("Content-Type:"), response.headers.get("content-type"));
       }

       if (!response.ok) {
         const text = await response.text();
         throw new Error(`Request failed with status ${response.status}: ${text}`);
       }

       const contentType = response.headers.get("content-type");
       if (contentType && contentType.includes("application/json")) {
         result = await response.json();
       } else {
         const text = await response.text();
         throw new Error(`Expected JSON but received: ${text}`);
       }

       if (DEBUG) {
         console.log(chalk.blue("Full Verification Response:"), result);
       }
       if (result.session_token) {
         if (DEBUG) {
           console.log(chalk.green("Session Token Obtained:"), result.session_token);
         }
         return { sessionToken: result.session_token, wallet };
       }
       console.warn(chalk.yellow(`Percobaan ${i + 1} gagal. Mencoba lagi...`));
       await new Promise((res) => setTimeout(res, 2000));
     }

     throw new Error("Gagal mendapatkan session token");
   } catch (error) {
     console.error(chalk.red("Error in signAndVerify:"), error);
     return null;
   }
}

async function makeRequests(sessionToken, runNumber) {
   let successfulRuns = 0; // Track successful chat requests

   while (successfulRuns < loopCount) { // Loop until the desired number of chats is reached
     const headers = {
       accept: "*/*",
       "content-type": "application/json",
       origin: "https://klokapp.ai",
       referer: "https://klokapp.ai/",
       "user-agent": "Mozilla/5.0",
       "x-session-token": sessionToken
     };

     let spinner = ora(`💬 [Run ${runNumber}] Mengecek sisa rate limit...`).start();
     const rateCheck = await fetchWithoutRetry(`${BASE_URL}/v1/rate-limit`, { method: "GET", headers }, spinner);
     spinner.stop();

     if (!rateCheck || rateCheck.remaining <= 0) { // Check daily limit
       console.log(chalk.bold.redBright(`🚫 Daily limit sudah tercapai untuk akun ini.`));
       return { counted: false, dailyLimitReached: true, failed: false };
     }

     const connectivityOk = await checkChatConnectivity(headers); // Check connectivity
     if (!connectivityOk) { 
       console.log(chalk.red("Konektivitas ke Chat API bermasalah"));
       return { counted: false, dailyLimitReached: false, failed: true };
     }

     spinner = ora(`💬 [Run ${runNumber}] Mengirim request ke Chat API...`).start();
     const randomMessage = messages[Math.floor(Math.random() * messages.length)];
     const postData = { id: uuidv4(), messages: [{ role: "user", content: randomMessage }], model: "llama-3.3-70b-instruct", created_at: new Date().toISOString(), language: "english" };

     const chatResponse = await fetchWithoutRetry(`${BASE_URL}/v1/chat`, { method: "POST", headers, body: JSON.stringify(postData)}, spinner);

     if (!chatResponse) { 
       spinner.fail(chalk.redBright(`Request Chat API gagal`));
       continue; // Retry the current request
     } else { 
       spinner.succeed(chalk.greenBright(`Chat API Response diterima 📝`));
       const chatText =
         typeof chatResponse === "object"
           ? JSON.stringify(chatResponse, null, 2)
           : chatResponse;
       
       await typeOutResponse(chatText); // Output the chat response
       
       successfulRuns++; // Increment only on successful response
     }

     await taskDelay(5000, 10000); // Delay between requests
   }

   return { counted: true, dailyLimitReached: false, failed: false };
}

async function runLoop() {
   while (true ) { 
      for (let i = 0; i < PRIVATE_KEYS.length; i++) { 
         console.log(chalk.bold.cyanBright(`\n=====================================================================`));
         const verifyResult = await signAndVerify(PRIVATE_KEYS[i]);
         if (!verifyResult) { 
            console.error(chalk.red("Gagal mendapatkan session token, lanjut ke akun berikutnya."));
            continue; 
         }
         
         const { sessionToken, wallet } = verifyResult; 
         console.log(chalk.bold.whiteBright(`🚀 Mulai run untuk akun: \x1b[32m${wallet.address}\x1b[0m`));

         let successfulRuns = await makeRequests(sessionToken, i + 1); // Call makeRequests

         if (i < PRIVATE_KEYS.length - 1 ) { 
            await akunDelay(3000,5000); 
         }
      }

      console.log(chalk.bold.greenBright("\n✅ Semua pekerjaan telah selesai..")); 
      console.log(chalk.bold.yellowBright("⏳ Menunggu selama satu hari sebelum memulai ulang...")); 
      await akunDelay(86400000 ,86400000); // Tunggu selama satu hari
   }
}

runLoop(); // Jalankan loop utama
