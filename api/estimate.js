// Vercel serverless function: receives estimate requests and emails them via Resend.
// Required env vars (Vercel → Project → Settings → Environment Variables):
//   RESEND_API_KEY      – API key from resend.com
//   ESTIMATE_TO_EMAIL   – inbox that receives requests
//   ESTIMATE_FROM_EMAIL – verified sender, e.g. "Coastal Tile <estimates@yourdomain.com>"
//                         (until a domain is verified, Resend only allows onboarding@resend.dev
//                          and only delivers to the Resend account owner's email)

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clip = (s, n) => String(s ?? "").trim().slice(0, n);
const recent = new Map(); // best-effort rate limit per warm instance

module.exports = async (req, res) => {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "Use POST." }); }

  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  const now = Date.now(), hits = (recent.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  if (hits.length >= 5) return res.status(429).json({ error: "Too many requests from this connection. Wait a few minutes." });
  hits.push(now); recent.set(ip, hits);

  let b = req.body;
  if (typeof b === "string") { try { b = JSON.parse(b); } catch { b = null; } }
  if (!b || typeof b !== "object") return res.status(400).json({ error: "The form data couldn't be read." });

  // Honeypot: bots fill hidden fields. Pretend success, send nothing.
  if (b.company) return res.status(200).json({ ok: true });

  const d = {
    name: clip(b.name, 100), email: clip(b.email, 200), phone: clip(b.phone, 30), location: clip(b.location, 200),
    projectType: clip(b.projectType, 60), size: clip(b.size, 100), start: clip(b.start, 60),
    description: clip(b.description, 3000), contactMethod: clip(b.contactMethod, 30),
  };
  const errs = [];
  if (d.name.length < 2) errs.push("name");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email)) errs.push("email");
  if (d.phone.replace(/\D/g, "").length < 10) errs.push("phone");
  if (d.location.length < 3) errs.push("location");
  if (!d.projectType) errs.push("project type");
  if (d.description.length < 10) errs.push("description");
  if (b.consent !== true) errs.push("consent");
  if (errs.length) return res.status(400).json({ error: "Check these fields: " + errs.join(", ") + "." });

  const photos = Array.isArray(b.photos) ? b.photos.slice(0, 4).filter((p) => p && typeof p.content === "string" && p.content.length < 1_500_000 && /^[A-Za-z0-9+/=]+$/.test(p.content)) : [];

  const { RESEND_API_KEY, ESTIMATE_TO_EMAIL, ESTIMATE_FROM_EMAIL } = process.env;
  if (!RESEND_API_KEY || !ESTIMATE_TO_EMAIL) {
    console.error("Estimate form not configured: missing RESEND_API_KEY or ESTIMATE_TO_EMAIL");
    return res.status(503).json({ error: "Online requests aren't connected yet." });
  }

  const rows = [["Name", d.name], ["Email", d.email], ["Phone", d.phone], ["Location", d.location], ["Project", d.projectType], ["Size", d.size || "—"], ["Start", d.start || "Not sure"], ["Contact by", d.contactMethod]];
  const htmlBody = `<h2>New estimate request</h2><table cellpadding="6" style="border-collapse:collapse">${rows.map(([k, v]) => `<tr><td style="color:#555">${k}</td><td><strong>${esc(v)}</strong></td></tr>`).join("")}</table><h3>Description</h3><p style="white-space:pre-wrap">${esc(d.description)}</p><p style="color:#777">Photos attached: ${photos.length}</p>`;
  const text = rows.map(([k, v]) => `${k}: ${v}`).join("\n") + `\n\n${d.description}\n\nPhotos attached: ${photos.length}`;

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: ESTIMATE_FROM_EMAIL || "Coastal Tile Website <onboarding@resend.dev>",
        to: ESTIMATE_TO_EMAIL.split(",").map((s) => s.trim()),
        reply_to: d.email,
        subject: `Estimate request: ${d.projectType} – ${d.name}`,
        html: htmlBody, text,
        attachments: photos.map((p, i) => ({ filename: clip(p.filename, 80).replace(/[^\w.-]/g, "_") || `photo-${i + 1}.jpg`, content: p.content })),
      }),
    });
    if (!r.ok) { console.error("Resend error", r.status, await r.text()); return res.status(502).json({ error: "The request couldn't be delivered." }); }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("Estimate send failed", e);
    return res.status(502).json({ error: "The request couldn't be delivered." });
  }
};
