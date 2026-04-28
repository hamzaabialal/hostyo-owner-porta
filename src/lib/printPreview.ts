/**
 * Opens an HTML document in a new tab as a *preview* — no auto `window.print()`.
 *
 * Why: the previous implementation called `w.print()` immediately (and again
 * on a 5-second fallback timer), which spawned multiple browser print dialogs
 * back-to-back. On older browsers that stacked print jobs and caused crashes.
 * It also hijacked the user's intent — they may have only wanted to inspect
 * the statement or save the page as PDF themselves.
 *
 * Now we simply open the new tab and inject a small sticky toolbar at the
 * top with a single explicit "Print / Save as PDF" button. The toolbar is
 * hidden in print output via `@media print`. Users who want a PDF can use
 * the system print dialog's "Save as PDF" destination, exactly as the old
 * flow ultimately required — but they trigger it themselves.
 */
export function openPrintPreview(html: string, title: string): void {
  if (typeof window === "undefined") return;
  const w = window.open("", "_blank");
  if (!w) return;

  const styles = `
    <style>
      .hostyo-print-bar { position: sticky; top: 0; left: 0; right: 0; background: #111; color: #fff; padding: 10px 16px; display: flex; justify-content: space-between; align-items: center; z-index: 9999; font: 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; box-shadow: 0 2px 8px rgba(0,0,0,0.08); margin: -40px -48px 24px; }
      .hostyo-print-bar .hostyo-print-bar__title { font-weight: 600; }
      .hostyo-print-bar button { background: #fff; color: #111; border: 0; padding: 8px 14px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 12px; }
      .hostyo-print-bar button:hover { background: #f0f0f0; }
      @media print { .hostyo-print-bar { display: none !important; } }
    </style>
  `;
  const safeTitle = String(title).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] || c));
  const bar = `
    <div class="hostyo-print-bar">
      <span class="hostyo-print-bar__title">${safeTitle}</span>
      <button type="button" onclick="window.print()">Print / Save as PDF</button>
    </div>
  `;

  // Inject the styles into <head> and the toolbar at the start of <body>.
  // If for some reason the template is missing those tags we still write the
  // raw HTML, just without the convenience toolbar.
  const wrapped = html
    .replace(/<\/head>/i, `${styles}</head>`)
    .replace(/<body[^>]*>/i, (m) => `${m}${bar}`);

  w.document.write(wrapped.includes("hostyo-print-bar") ? wrapped : html);
  w.document.close();
}
