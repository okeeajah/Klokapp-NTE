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

function formatResetTime(resetTime) {
    const resetDate = new Date(Date.now() + resetTime * 1000);
    return resetDate.toLocaleString();
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

async function signAndVerify(privateKey) {
    try {
        const wallet = new ethers.Wallet(privateKey);
        const nonce = crypto.randomBytes(32).toString("hex");
        const issuedAt = new Date().toISOString();
        const message = `klokapp.ai wants you to sign in with your Ethereum account:\n${wallet.address}\n\n\nURI: https://klokapp.ai/\nVersion: 1\nChain ID: 1\nNonce: ${nonce}\nIssued At: ${issuedAt}`;
        const signature = await wallet.signMessage(message);

        const payload = { signedMessage: signature, message, referral_code: REFERRAL_CODE };

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

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Request failed with status ${response.status}: ${text}`);
            }

            result = await response.json();

            if (result.session_token) {
                return { sessionToken: result.session_token, wallet };
            }
        }

        throw new Error("Gagal mendapatkan session token");
    } catch (error) {
        console.error(chalk.red("Error in signAndVerify:"), error);
        return null;
    }
}

async function makeRequests(sessionToken, walletAddress) {
    let chatCount = 0;
    while (true) {
        const headers = {
            accept: "*/*",
            "content-type": "application/json",
            origin: "https://klokapp.ai",
            referer: "https://klokapp.ai/",
            "user-agent": "Mozilla/5.0",
            "x-session-token": sessionToken
        };

        let spinner = ora(`💬 [Chat ke-${chatCount + 1}] Mengecek sisa rate limit...`).start();
        try {
            const rateCheckResponse = await fetch(`${BASE_URL}/v1/rate-limit`, { method: "GET", headers });

            if (!rateCheckResponse.ok) {
                spinner.fail(chalk.redBright(`Gagal memeriksa rate limit.`));
                break;
            }

            const rateCheck = await rateCheckResponse.json();

            // Jika daily-limit sudah tercapai
            if (rateCheck.remaining <= 0) {
                spinner.fail(chalk.redBright(`🚫 Daily limit sudah tercapai untuk akun ini.`));
                console.log(chalk.yellowBright(`🎯 Chat Daily Limit : ${rateCheck.limit}`));
                console.log(chalk.yellowBright(`🔢 Chat Usage Today : ${rateCheck.current_usage}`));
                console.log(chalk.yellowBright(`⏱️ Reset Time : ${formatResetTime(rateCheck.reset_time)}`));
                break;
            }

            spinner.succeed(chalk.greenBright(" Sisa rate limit mencukupi 📝"));

            spinner = ora(`💬 [Chat ke-${chatCount + 1}] Mengirim request ke Chat API...`).start();
            const randomMessage = messages[Math.floor(Math.random() * messages.length)];
            const postData = { id: uuidv4(), messages: [{ role: "user", content: randomMessage }], model: "llama-3.3-70b-instruct", created_at: new Date().toISOString(), language: "english" };

            const chatResponse = await fetch(`${BASE_URL}/v1/chat`, { method: "POST", headers, body: JSON.stringify(postData) });

            if (!chatResponse.ok) {
                spinner.fail(chalk.redBright(`Request Chat API gagal`));
                break;
            }

            spinner.succeed(chalk.greenBright(`Chat API Response diterima 📝`));
            chatCount++;

        } catch (error) {
            spinner.fail(chalk.redBright(`Terjadi kesalahan: ${error.message}`));
            break;
        }
        await taskDelay(10000, 20000); // Delay setelah setiap chat (di luar try-catch)
    }
    console.log(chalk.greenBright(`✅ Berhasil mengirim ${chatCount} chat untuk akun ${walletAddress}.`));
}

async function runLoop() {
    while (true) {
        for (let i = 0; i < PRIVATE_KEYS.length; i++) {
            console.log(chalk.bold.cyanBright(`\n=====================================================================`));
            const verifyResult = await signAndVerify(PRIVATE_KEYS[i]);

            if (!verifyResult) {
                console.error(chalk.red("Gagal mendapatkan session token, lanjut ke akun berikutnya."));
                continue;
            }

            const { sessionToken, wallet } = verifyResult;
            console.log(chalk.bold.whiteBright(`🚀 Mulai run untuk akun: \x1b[32m${wallet.address}\x1b[0m`));

            await makeRequests(sessionToken, wallet.address);

            if (i < PRIVATE_KEYS.length - 1) {
                await akunDelay(5000, 10000);
            }
        }
        console.log(chalk.bold.greenBright("\n✅ Semua pekerjaan telah selesai.."));
        console.log(chalk.bold.yellowBright("⏳ Menunggu selama satu hari sebelum memulai ulang..."));
        await akunDelay(86400000, 86400000); // Tunggu selama satu hari
    }
}

runLoop(); // Jalankan loop utama
