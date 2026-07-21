/**
 * Upload System_Design_Fundamentals.pdf via the real UI upload input,
 * wait for Groq generation, print chapter/lesson titles.
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API = process.env.API_URL || "http://127.0.0.1:8001";
const BASE = process.env.BASE_URL || "http://localhost:3000";
const PDF =
  "C:\\Users\\Navee\\Downloads\\System_Design_Fundamentals.pdf";
const email = `groq_${Date.now()}@example.com`;
const password = "demopass123";

async function main() {
  const health = await fetch(`${API}/health`).then((r) => r.json());
  console.log("HEALTH", JSON.stringify(health));
  if (health.effective_llm !== "groq" || !health.groq_api_key_set) {
    throw new Error(
      `Backend not configured for Groq: ${JSON.stringify(health)}`
    );
  }
  if (!fs.existsSync(PDF)) throw new Error(`PDF missing: ${PDF}`);

  const authRes = await fetch(`${API}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name: "Groq Demo" }),
  });
  if (!authRes.ok) {
    throw new Error(`register ${authRes.status} ${await authRes.text()}`);
  }
  const auth = await authRes.json();
  console.log("AUTH ok", auth.user.email);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.addCookies([
    {
      name: "in2peta_token",
      value: encodeURIComponent(auth.access_token),
      url: BASE,
    },
  ]);
  await context.addInitScript((token) => {
    localStorage.setItem("in2peta_token", token);
  }, auth.access_token);

  const page = await context.newPage();
  await page.goto(`${BASE}/dashboard`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await page.waitForSelector("text=Turn a PDF into a course", {
    timeout: 120000,
  });
  console.log("UI dashboard ready");

  page.on("console", (msg) => {
    if (msg.type() === "error") console.log("BROWSER_ERR", msg.text());
  });
  page.on("requestfailed", (req) => {
    console.log("REQ_FAIL", req.method(), req.url(), req.failure()?.errorText);
  });

  const fileInputs = page.locator('input[type="file"]');
  const n = await fileInputs.count();
  console.log("file inputs on page:", n);
  if (n < 1) throw new Error("No file input found — UploadProvider missing");

  // Drive the same hidden input the banner/bottom-tab openPicker() clicks.
  const uploadWait = page.waitForResponse(
    (r) => r.url().includes("/documents/upload") && r.request().method() === "POST",
    { timeout: 180000 }
  );
  await fileInputs.first().setInputFiles(PDF);
  console.log("PDF set on UploadProvider file input");

  // If React onChange didn't fire (rare), dispatch a change event as fallback.
  const early = await Promise.race([
    uploadWait.then((r) => ({ kind: "resp", r })),
    page.waitForTimeout(3000).then(() => ({ kind: "timeout" })),
  ]);
  if (early.kind === "timeout") {
    console.log("No upload yet — dispatching change event fallback");
    await page.evaluate(() => {
      const input = document.querySelector('input[type="file"]');
      if (input) input.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  const uploadResp =
    early.kind === "resp" ? early.r : await uploadWait;
  console.log("API_RESP", uploadResp.status(), uploadResp.url());
  if (!uploadResp.ok()) {
    throw new Error(
      `Upload HTTP ${uploadResp.status()}: ${await uploadResp.text()}`
    );
  }
  const uploadBody = await uploadResp.json();
  console.log("UPLOAD body", uploadBody);

  await page.waitForURL(/\/courses\/\d+\/generating/, { timeout: 180000 });
  const courseId = String(
    uploadBody.course_id || page.url().match(/\/courses\/(\d+)\//)?.[1]
  );
  console.log("UPLOAD redirected course_id=", courseId);

  let status = "generating";
  let stage = null;
  for (let i = 0; i < 240; i++) {
    const st = await fetch(`${API}/courses/${courseId}/status`, {
      headers: { Authorization: `Bearer ${auth.access_token}` },
    }).then((r) => r.json());
    status = st.status;
    stage = st.generation_stage;
    if (i % 3 === 0 || status !== "generating") {
      console.log("POLL", i, status, stage, st.error || "");
    }
    if (status === "ready" || status === "failed") break;
    await new Promise((r) => setTimeout(r, 5000));
  }

  if (status !== "ready") {
    await browser.close();
    throw new Error(`Generation ended as ${status} stage=${stage}`);
  }

  const course = await fetch(`${API}/courses/${courseId}`, {
    headers: { Authorization: `Bearer ${auth.access_token}` },
  }).then((r) => r.json());

  console.log("\n===== GENERATED COURSE =====");
  console.log("TITLE:", course.title);
  console.log(
    "DIFFICULTY:",
    course.difficulty,
    "MINUTES:",
    course.estimated_minutes
  );
  console.log("DESCRIPTION:", course.description);
  for (const ch of course.chapters) {
    console.log("\nCHAPTER:", ch.title);
    console.log("  summary:", ch.summary);
    for (const t of ch.topics) {
      console.log("  TOPIC:", t.title);
      for (const l of t.lessons) {
        console.log("    LESSON:", l.title);
      }
    }
  }

  // Scan all lesson titles + a couple lesson bodies for PDF terms
  const titles = [];
  for (const ch of course.chapters) {
    titles.push(ch.title);
    for (const t of ch.topics) {
      titles.push(t.title);
      for (const l of t.lessons) titles.push(l.title);
    }
  }
  const titleBlob = titles.join(" | ");
  const terms = [
    "CAP",
    "Sharding",
    "Load Balancing",
    "JWT",
    "Canary",
    "Kafka",
    "Redis",
    "CDN",
    "Replication",
    "Caching",
  ];
  console.log("\n===== TITLE TERM HITS =====");
  for (const term of terms) {
    console.log(`${term}:`, titleBlob.toLowerCase().includes(term.toLowerCase()));
  }

  const sampleLessonId =
    course.chapters?.[1]?.topics?.[0]?.lessons?.[0]?.id ||
    course.chapters?.[0]?.topics?.[0]?.lessons?.[0]?.id;
  if (sampleLessonId) {
    const lesson = await fetch(`${API}/lessons/${sampleLessonId}`, {
      headers: { Authorization: `Bearer ${auth.access_token}` },
    }).then((r) => r.json());
    const blob = JSON.stringify(lesson.content || {});
    console.log("\n===== SAMPLE LESSON =====");
    console.log("title:", lesson.title);
    for (const term of terms) {
      console.log(`${term} in body:`, blob.toLowerCase().includes(term.toLowerCase()));
    }
    console.log("preview:", blob.slice(0, 800));
  }

  const out = path.join(__dirname, "..", "demo-proof");
  fs.mkdirSync(out, { recursive: true });
  await page.goto(`${BASE}/courses/${courseId}`, { waitUntil: "networkidle" });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({
    path: path.join(out, "11-groq-course-overview-1280.png"),
    fullPage: true,
  });
  console.log("\nSHOT demo-proof/11-groq-course-overview-1280.png");
  console.log("COURSE_ID", courseId);
  await browser.close();
}

main().catch((e) => {
  console.error("FAIL", e);
  process.exit(1);
});
