/**
 * 공문 한 장을 숨은 iframe에 복제해 인쇄한다 (모달/오버레이 환경에서도 안전).
 *
 * 결재 문서(OfficialDocument)와 빈 서식(BlankFormDocument)이 같이 쓴다 —
 * 같은 carev-doc-* 스타일시트를 그대로 들고 가야 두 인쇄물이 같은 모양으로 나온다.
 */
export function printDocumentElement(element: HTMLElement, title = '전자결재 인쇄') {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  if (!doc) {
    document.body.removeChild(iframe);
    window.print();
    return;
  }

  const headHtml = Array.from(
    document.querySelectorAll('link[rel="stylesheet"], style'),
  )
    .map((node) => node.outerHTML)
    .join('');

  const safeTitle = title.replace(/[<>&"]/g, '');
  doc.open();
  doc.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>${safeTitle}</title>${headHtml}</head>` +
    `<body style="background:#fff">${element.outerHTML}</body></html>`,
  );
  doc.close();

  // 스타일시트 로드 대기 후 인쇄
  window.setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      window.setTimeout(() => {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      }, 1000);
    }
  }, 350);
}
