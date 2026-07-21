/**
 * Visual + upload proof for the UI-only pass.
 * Run: node scripts/demo-proof.mjs
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "demo-proof");
const BASE = "http://localhost:3000";
const API = "http://127.0.0.1:8000";
const email = `demo_${Date.now()}@example.com`;
const password = "demopass123";
const name = "Demo User";

fs.mkdirSync(OUT, { recursive: true });

async function shot(page, name, width) {
  await page.setViewportSize({ width, height: width < 800 ? 812 : 900 });
  await page.waitForTimeout(400);
  const file = path.join(OUT, `${name}-${width}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log("SHOT", file);
  return file;
}

async function main() {
  // Ensure a tiny PDF exists
  const pdfPath = path.join(OUT, "sample.pdf");
  if (!fs.existsSync(pdfPath)) {
    // Minimal valid PDF bytes
    const pdf = `%PDF-1.1
1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj
2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj
3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj
4 0 obj<< /Length 44 >>stream
BT /F1 18 Tf 40 80 Td (In2Peta Demo) Tj ET
endstream endobj
5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000266 00000 n 
0000000361 00000 n 
trailer<< /Size 6 /Root 1 0 R >>
startxref
434
%%EOF`;
    fs.writeFileSync(pdfPath, pdf);
  }

  const badTxt = path.join(OUT, "not-a-pdf.txt");
  fs.writeFileSync(badTxt, "this is not a pdf");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // 1) Landing
  await page.goto(BASE, { waitUntil: "networkidle" });
  await shot(page, "01-landing", 375);
  await shot(page, "01-landing", 1280);

  // 2) Register via API then set token in browser for speed + reliability
  const reg = await fetch(`${API}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name }),
  });
  if (!reg.ok) {
    throw new Error(`register failed: ${reg.status} ${await reg.text()}`);
  }
  const auth = await reg.json();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await shot(page, "02-login", 375);
  await shot(page, "02-login", 1280);

  // Hydrate auth the same way the app does
  await page.evaluate(
    ({ token }) => {
      localStorage.setItem("in2peta_token", token);
      document.cookie = `in2peta_token=${encodeURIComponent(token)}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
    },
    { token: auth.access_token }
  );

  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await page.waitForSelector('text=Turn a PDF into a course');
  await shot(page, "03-dashboard", 375);
  await shot(page, "03-dashboard", 768);
  await shot(page, "03-dashboard", 1280);

  // 3) Bad file type — set files on the hidden input from UploadProvider
  const fileInput = page.locator('input[type="file"][accept*="pdf"]');
  await fileInput.setInputFiles(badTxt);
  await page.waitForSelector('text=Upload failed', { timeout: 8000 });
  await shot(page, "04-upload-bad-type", 375);
  console.log("OK bad file type shows error UI");

  // Clear error by clicking try again area is optional; upload a real PDF
  await fileInput.setInputFiles(pdfPath);
  await page.waitForURL(/\/courses\/\d+\/generating/, { timeout: 30000 });
  await shot(page, "05-generating", 375);
  await shot(page, "05-generating", 1280);
  console.log("OK PDF upload redirected to generating");

  // Wait for ready (mock LLM should be fast)
  const match = page.url().match(/\/courses\/(\d+)\//);
  const courseId = match?.[1];
  if (!courseId) throw new Error("no course id in URL");

  for (let i = 0; i < 60; i++) {
    const st = await fetch(`${API}/courses/${courseId}/status`, {
      headers: { Authorization: `Bearer ${auth.access_token}` },
    }).then((r) => r.json());
    if (st.status === "ready") break;
    if (st.status === "failed") throw new Error(`generation failed: ${st.error}`);
    await page.waitForTimeout(1000);
  }

  await page.goto(`${BASE}/courses/${courseId}`, { waitUntil: "networkidle" });
  await shot(page, "06-course-overview", 375);
  await shot(page, "06-course-overview", 1280);

  // Open first lesson
  const course = await fetch(`${API}/courses/${courseId}`, {
    headers: { Authorization: `Bearer ${auth.access_token}` },
  }).then((r) => r.json());
  const firstLesson =
    course.chapters?.[0]?.topics?.[0]?.lessons?.[0]?.id;
  if (!firstLesson) throw new Error("no lessons in generated course");

  await page.goto(`${BASE}/courses/${courseId}/lessons/${firstLesson}`, {
    waitUntil: "networkidle",
  });
  await page.waitForSelector('text=Mark complete');
  await shot(page, "07-lesson-reader", 375);
  await shot(page, "07-lesson-reader", 1280);

  // Open mobile contents drawer
  await page.setViewportSize({ width: 375, height: 812 });
  const contentsBtn = page.getByRole("button", { name: /contents/i });
  if (await contentsBtn.isVisible()) {
    await contentsBtn.click();
    await page.waitForTimeout(500);
    await shot(page, "08-mobile-contents-drawer", 375);
  }

  // Quiz if available
  const chapterId = course.chapters?.[0]?.id;
  if (chapterId) {
    await page.goto(
      `${BASE}/courses/${courseId}/chapters/${chapterId}/quiz`,
      { waitUntil: "networkidle" }
    );
    await page.waitForTimeout(1500);
    await shot(page, "09-quiz", 375);
    await shot(page, "09-quiz", 1280);
  }

  // Verify banner click opens chooser (filechooser event)
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await page.setViewportSize({ width: 1280, height: 900 });
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser", { timeout: 5000 }),
    page.getByRole("button", { name: "Upload a PDF" }).first().click(),
  ]);
  console.log("OK banner click opened filechooser, accept=", chooser.isMultiple());

  await browser.close();
  console.log("DONE proof written to", OUT);
}

main().catch((err) => {
  console.error("FAIL", err);
  process.exit(1);
});
