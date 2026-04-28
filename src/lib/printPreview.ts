/**
 * Opens an HTML document in a new tab as a *preview* — no auto `window.print()`.
 *
 * The previous implementation called `w.print()` immediately (and again on a
 * 5-second fallback timer), which spawned multiple browser print dialogs and
 * crashed older browsers. We now open the new tab and inject a small sticky
 * toolbar at the top with explicit **Print** and **Save as PDF** actions. The
 * toolbar is hidden in print output via `@media print`. Users trigger the
 * system print dialog themselves.
 *
 * Note: browsers don't expose an API to pre-select a print destination, so
 * both actions ultimately call `window.print()`. The split is for clarity —
 * "Print" tells the user to pick a physical printer in the dialog, while
 * "Save as PDF" tells them to pick the "Save as PDF" destination. We also
 * inject a one-time hint into the document title so the dialog defaults to
 * a sensible filename when the user picks "Save as PDF".
 */
export function openPrintPreview(html: string, title: string): void {
  if (typeof window === "undefined") return;
  const w = window.open("", "_blank");
  if (!w) return;

  const styles = `
    <style>
      .hostyo-print-bar { position: sticky; top: 0; left: 0; right: 0; background: #111; color: #fff; padding: 10px 16px; display: flex; justify-content: space-between; align-items: center; z-index: 9999; font: 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; box-shadow: 0 2px 8px rgba(0,0,0,0.08); margin: -40px -48px 24px; gap: 12px; flex-wrap: wrap; }
      .hostyo-print-bar .hostyo-print-bar__title { font-weight: 600; }
      .hostyo-print-bar .hostyo-print-bar__actions { display: flex; gap: 8px; }
      .hostyo-print-bar button { background: #fff; color: #111; border: 0; padding: 8px 14px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 12px; display: inline-flex; align-items: center; gap: 6px; }
      .hostyo-print-bar button:hover { background: #f0f0f0; }
      .hostyo-print-bar button.is-primary { background: #80020E; color: #fff; }
      .hostyo-print-bar button.is-primary:hover { background: #6b010c; }
      @media print { .hostyo-print-bar { display: none !important; } }
    </style>
  `;
  const safeTitle = String(title).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] || c));
  // Print → opens the system print dialog (only way to reach a physical printer).
  // Save as PDF → uses html2pdf.js loaded from a CDN to render the report's
  //   DOM straight to a PDF file and trigger a download — no print dialog.
  // The toolbar is hidden during the html2pdf render pass so it doesn't
  // appear inside the generated PDF.
  //
  // Handlers are attached via a script + addEventListener (NOT inline
  // `onclick`), because the JS string would contain double quotes from
  // JSON.stringify that broke the HTML attribute parsing previously.
  const bar = `
    <div class="hostyo-print-bar">
      <span class="hostyo-print-bar__title">${safeTitle}</span>
      <div class="hostyo-print-bar__actions">
        <button type="button" data-hostyo-action="print">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          Print
        </button>
        <button type="button" class="is-primary" data-hostyo-action="pdf">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 12 15 15"/></svg>
          Save as PDF
        </button>
      </div>
    </div>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"><\/script>
    <script>
      (function () {
        var baseTitle = ${JSON.stringify(safeTitle)};
        var printBtn = document.querySelector('[data-hostyo-action="print"]');
        var pdfBtn = document.querySelector('[data-hostyo-action="pdf"]');
        if (printBtn) printBtn.addEventListener('click', function () {
          try { document.title = baseTitle; } catch (e) {}
          window.print();
        });
        if (pdfBtn) pdfBtn.addEventListener('click', function () {
          if (typeof html2pdf === 'undefined') {
            // Library still downloading — fall back to the print dialog so
            // the user is never left with an inert button.
            try { document.title = baseTitle + '.pdf'; } catch (e) {}
            window.print();
            return;
          }
          var toolbar = document.querySelector('.hostyo-print-bar');
          var prevDisplay = toolbar ? toolbar.style.display : '';
          if (toolbar) toolbar.style.display = 'none';
          var prevLabel = pdfBtn.innerHTML;
          pdfBtn.disabled = true;
          pdfBtn.innerHTML = 'Generating…';
          // eslint-disable-next-line no-undef
          html2pdf().set({
            margin: [10, 10, 10, 10],
            filename: baseTitle + '.pdf',
            image: { type: 'jpeg', quality: 0.95 },
            html2canvas: { scale: 2, useCORS: true, allowTaint: false, backgroundColor: '#ffffff' },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
          }).from(document.body).save().then(function () {
            if (toolbar) toolbar.style.display = prevDisplay;
            pdfBtn.disabled = false;
            pdfBtn.innerHTML = prevLabel;
          }).catch(function () {
            if (toolbar) toolbar.style.display = prevDisplay;
            pdfBtn.disabled = false;
            pdfBtn.innerHTML = prevLabel;
            alert('Failed to generate PDF. Falling back to the print dialog.');
            try { document.title = baseTitle + '.pdf'; } catch (e) {}
            window.print();
          });
        });
      })();
    <\/script>
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
