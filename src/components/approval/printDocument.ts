/** 복제한 문서에 스타일시트가 붙기를 기다리는 시간 */
const STYLE_WAIT_MS = 350;
/** 그림(직인·서명)을 기다리는 한도 — 끝내 안 오면 그림 없이 찍는다 */
const IMAGE_WAIT_LIMIT_MS = 4000;

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
  const print = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      window.setTimeout(() => {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      }, 1000);
    }
  };

  // 직인·서명 그림이 아직 안 왔으면 종이에 빈자리로 찍힌다 — 다 올 때까지(길어도 4초) 기다린다
  const pending = Array.from(doc.images).filter((image) => !image.complete);
  const minimumWait = new Promise<void>((resolve) => window.setTimeout(resolve, STYLE_WAIT_MS));
  const imagesReady = Promise.all(
    pending.map(
      (image) =>
        new Promise<void>((resolve) => {
          image.addEventListener('load', () => resolve(), { once: true });
          image.addEventListener('error', () => resolve(), { once: true });
        }),
    ),
  );
  const giveUp = new Promise<void>((resolve) => window.setTimeout(resolve, IMAGE_WAIT_LIMIT_MS));
  void Promise.all([minimumWait, Promise.race([imagesReady, giveUp])]).then(print);
}
