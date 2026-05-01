/**
 * Opens an HTML document in a new tab as a *preview* — no auto `window.print()`.
 *
 * The toolbar exposes a single **Save as PDF** action that uses html2pdf.js to
 * render the document straight to a downloaded PDF — no print dialog at any
 * point. Earlier versions fell back to `window.print()` when the CDN was slow
 * or html2pdf threw, which surfaced as the "aggressive auto-print" complaint.
 * We've removed those fallbacks: if html2pdf fails we surface an error
 * message instead of triggering the system print dialog.
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
        <button type="button" class="is-primary" data-hostyo-action="pdf">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 12 15 15"/></svg>
          Download PDF
        </button>
      </div>
    </div>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"><\/script>
    <script>
      (function () {
        var baseTitle = ${JSON.stringify(safeTitle)};
        var pdfBtn = document.querySelector('[data-hostyo-action="pdf"]');
        function waitForHtml2Pdf(timeoutMs) {
          return new Promise(function (resolve, reject) {
            var start = Date.now();
            (function check() {
              if (typeof html2pdf !== 'undefined') return resolve();
              if (Date.now() - start > timeoutMs) return reject(new Error('html2pdf load timeout'));
              setTimeout(check, 100);
            })();
          });
        }
        if (pdfBtn) pdfBtn.addEventListener('click', function () {
          var toolbar = document.querySelector('.hostyo-print-bar');
          var prevDisplay = toolbar ? toolbar.style.display : '';
          var prevLabel = pdfBtn.innerHTML;
          pdfBtn.disabled = true;
          pdfBtn.innerHTML = 'Preparing…';
          waitForHtml2Pdf(8000).then(function () {
            if (toolbar) toolbar.style.display = 'none';
            pdfBtn.innerHTML = 'Generating…';
            // eslint-disable-next-line no-undef
            return html2pdf().set({
              margin: [10, 10, 10, 10],
              filename: baseTitle + '.pdf',
              image: { type: 'jpeg', quality: 0.95 },
              html2canvas: { scale: 2, useCORS: true, allowTaint: false, backgroundColor: '#ffffff' },
              jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
              pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
            }).from(document.body).save();
          }).then(function () {
            if (toolbar) toolbar.style.display = prevDisplay;
            pdfBtn.disabled = false;
            pdfBtn.innerHTML = prevLabel;
          }).catch(function () {
            if (toolbar) toolbar.style.display = prevDisplay;
            pdfBtn.disabled = false;
            pdfBtn.innerHTML = prevLabel;
            // No more silent fallback to window.print() — the previous version
            // surfaced as an aggressive auto-print on slow networks. Surface
            // the failure so the user can retry; the document itself is still
            // viewable in this tab and can be saved via the browser's own
            // "Save Page" / "Print to PDF" if desired.
            alert('Could not generate the PDF. Please check your connection and try again — the report is still visible in this tab.');
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
