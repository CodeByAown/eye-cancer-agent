# Professional Medical Report Generator — Spec

Every completed analysis produces a polished, hospital-grade PDF. Built by the **Medical Report Agent** + **Patient Education Agent** ([`05-multi-agent.md`](05-multi-agent.md)). Layout follows conventions from radiology/pathology reports and AI-medical software.

## Report sections (fixed order)

1. **Header / branding** — hospital or company logo, product name, report ID, generated timestamp.
2. **Patient information** — name/ID (or "Anonymous / Demo"), age, sex, referring context. _(PHI-light for demo.)_
3. **Scan metadata** — module, modality, capture method (scanner/upload), device, image dimensions, model name + version.
4. **Uploaded / captured image** — the original.
5. **Explainability heatmap** — Grad-CAM/attention overlay beside the original.
6. **AI findings** — detected condition(s), per-class probabilities table.
7. **Confidence scores** — visual bars + numeric; a "confidence interpretation" note.
8. **Severity assessment** — none/mild/moderate/severe with scale graphic.
9. **Clinical summary** — concise professional narrative (LLM-generated, grounded).
10. **Educational information** — plain-language explanation, causes, risk factors, lifestyle; medication _education_ (guardrailed).
11. **Follow-up recommendations** — next steps, urgency flag ("routine / soon / urgent consult"), whether immediate consultation is advised.
12. **Important medical disclaimer** — deterministic, code-inserted (not LLM).
13. **QR code** — links to the secure online report (signed URL) / verification.
14. **Footer** — page numbers, report ID, "AI-generated decision support — not a diagnosis."

## Layout

- Clean clinical letterhead; medical teal/indigo accent; generous whitespace; print-safe (A4/Letter).
- Two-column findings (image | heatmap; findings | confidence).
- Consistent typographic scale; accessible contrast.

## Generation pipeline

```
prediction + report.narrative
      │  Medical Report Agent assembles ReportSchema (JSON)
      ▼
HTML template (Jinja) styled with print CSS
      │  QR generated (segno/qrcode) → embedded data URI
      ▼
WeasyPrint  →  PDF  →  stored in S3/R2  →  reports.pdf_uri
      │
      ▼
signed download URL + online HTML view
```

## Tech choices

- **WeasyPrint** (HTML/CSS → PDF): pixel-accurate, styleable with the same design tokens as the web app. _(Alt considered: ReactPDF — less CSS fidelity; Puppeteer/Chromium — heavier runtime.)_
- **QR:** `segno` (pure-Python, no deps).
- **Prose:** Claude, grounded in structured findings only; disclaimer appended in code.
- **Branding:** per-organization logo/colors from `organizations` (white-label ready for enterprise clients).

## Data model addition

Extends `reports` from [`02-architecture.md`](02-architecture.md):

```sql
ALTER TABLE reports ADD COLUMN report_number TEXT UNIQUE;      -- human-readable ID
ALTER TABLE reports ADD COLUMN qr_target_url TEXT;
ALTER TABLE reports ADD COLUMN branding JSONB;                 -- org logo/colors snapshot
ALTER TABLE reports ADD COLUMN version INT DEFAULT 1;
```

## API

```
POST /api/v1/reports                {prediction_id} → report_id (async)
GET  /api/v1/reports/{id}           # structured + HTML view
GET  /api/v1/reports/{id}/pdf       # signed PDF download
GET  /r/{report_number}             # public verification page (QR target, signed)
```

## White-label / enterprise

Org-level branding, custom disclaimers per jurisdiction, and template variants (screening vs detailed) so the same report engine serves multiple client brands.
