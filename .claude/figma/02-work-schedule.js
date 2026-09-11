// 근무조정 화면 — use_figma 단일 호출용 스크립트
//
// 파일:   8NhqGFtA1mpFgv7zN3EIjT (케어브이 디자인 시스템)
// 대상:   본문 노드 3:30 (근무조정 셸 3:2 안). 헤더(3:188)·월 요약(3:197)은 이미 있음.
// 남은일: 본문 2단 = 월 캘린더(5주) + 승인 대기 패널
//
// 주의 1: counterAxisAlignItems 는 MIN|MAX|CENTER|BASELINE 만 받는다. STRETCH 는 없다.
//         자식을 늘리려면 자식에 layoutSizingVertical='FILL' 을 준다.
// 주의 2: node.query() 는 한글 레이어명을 파싱하지 못한다. findAll 을 쓴다.
// 주의 3: Figtree 스타일명은 "SemiBold" (공백 없음).

for (const s of ["Regular", "Medium", "SemiBold"]) {
  await figma.loadFontAsync({ family: "Figtree", style: s });
}

const vars = {};
for (const c of await figma.variables.getLocalVariableCollectionsAsync()) {
  for (const id of c.variableIds) {
    const v = await figma.variables.getVariableByIdAsync(id);
    vars[v.name] = v;
  }
}
const paint = (n) =>
  figma.variables.setBoundVariableForPaint(
    { type: "SOLID", color: { r: 0, g: 0, b: 0 } }, "color", vars[n]
  );
const styles = {};
for (const s of await figma.getLocalTextStylesAsync()) styles[s.name] = s;

const radius = (f, token) => {
  for (const k of ["topLeftRadius", "topRightRadius", "bottomLeftRadius", "bottomRightRadius"]) {
    f.setBoundVariable(k, vars[token]);
  }
};
const pad = (f, token) => {
  for (const p of ["paddingLeft", "paddingRight", "paddingTop", "paddingBottom"]) {
    f.setBoundVariable(p, vars[token]);
  }
};
async function T(parent, chars, styleName, colorVar) {
  const t = figma.createText();
  t.characters = chars;
  await t.setTextStyleIdAsync(styles[styleName].id);
  t.fills = [paint(colorVar)];
  parent.appendChild(t);
  return t;
}

const content = await figma.getNodeByIdAsync("3:30");

// 재실행 안전: 이미 만든 2단이 있으면 지우고 다시 만든다
for (const ch of [...content.children]) {
  if (ch.name === "본문 2단") ch.remove();
}

const row = figma.createAutoLayout("HORIZONTAL", { name: "본문 2단" });
row.setBoundVariable("itemSpacing", vars["spacing/5"]);
content.appendChild(row);
row.layoutSizingHorizontal = "FILL";
row.layoutSizingVertical = "FILL";

// ── 월 캘린더 ────────────────────────────────────────────────
const cal = figma.createAutoLayout("VERTICAL", { name: "월 캘린더" });
cal.fills = [paint("bg/surface")];
cal.strokes = [paint("border")];
cal.strokeWeight = 1;
radius(cal, "radius/container");
pad(cal, "spacing/4");
cal.setBoundVariable("itemSpacing", vars["spacing/2"]);
row.appendChild(cal);
cal.layoutSizingHorizontal = "FILL";
cal.layoutSizingVertical = "FILL";

const dow = figma.createAutoLayout("HORIZONTAL", { name: "요일" });
dow.setBoundVariable("itemSpacing", vars["spacing/1"]);
cal.appendChild(dow);
dow.layoutSizingHorizontal = "FILL";
for (const d of ["일", "월", "화", "수", "목", "금", "토"]) {
  const c = figma.createAutoLayout("HORIZONTAL", { name: d });
  c.primaryAxisAlignItems = "CENTER";
  c.setBoundVariable("paddingBottom", vars["spacing/1"]);
  dow.appendChild(c);
  c.layoutSizingHorizontal = "FILL";
  await T(c, d, "supporting", d === "일" ? "status/error" : "text/disabled");
}

// 이름 뒤 '*' = 승인 대기 (틸 + 불릿). 그 외는 승인된 것이라 조용히 둔다.
async function week(name, days) {
  const w = figma.createAutoLayout("HORIZONTAL", { name });
  w.setBoundVariable("itemSpacing", vars["spacing/1"]);
  cal.appendChild(w);
  w.layoutSizingHorizontal = "FILL";
  w.layoutSizingVertical = "FILL";

  for (const d of days) {
    const cell = figma.createAutoLayout("VERTICAL", { name: `${d.label}일` });
    cell.setBoundVariable("itemSpacing", vars["spacing/0-5"]);
    pad(cell, "spacing/1-5");
    radius(cell, "radius/inner");
    cell.fills = [paint(d.today ? "accent/muted" : d.dim ? "bg/body" : "bg/surface")];
    w.appendChild(cell);
    cell.layoutSizingHorizontal = "FILL";
    cell.layoutSizingVertical = "FILL";

    const dateColor = d.dim
      ? "text/disabled"
      : d.holiday || d.sun
      ? "status/error"
      : d.today
      ? "text/accent"
      : "text/secondary";
    await T(cell, d.label, d.today ? "label/strong" : "supporting", dateColor);

    if (d.event) await T(cell, d.event, "supporting", "text/accent");
    for (const n of d.names || []) {
      const wait = n.endsWith("*");
      await T(cell, wait ? "• " + n.slice(0, -1) : n, "supporting", wait ? "text/accent" : "text/secondary");
    }
    if (d.more) await T(cell, `+${d.more}`, "supporting", "text/disabled");
  }
}

// 2026년 9월 — 9/1은 화요일, 일요일 시작 5주
await week("1주", [
  { label: "30", dim: true, sun: true }, { label: "31", dim: true },
  { label: "1", names: ["박소향", "서른진"], more: 2 },
  { label: "2", names: ["정연수", "김효준"], more: 2 },
  { label: "3", names: ["박소향", "조상권"], more: 2 },
  { label: "4", event: "개교기념일 행사", names: ["이수나"], more: 3 },
  { label: "5" },
]);
await week("2주", [
  { label: "6", sun: true },
  { label: "7", names: ["정연수", "배정민"], more: 2 },
  { label: "8", names: ["조미숙*", "임은주"], more: 2 },
  { label: "9", names: ["정성근", "박성은"], more: 1 },
  { label: "10", names: ["박소향", "신외경"], more: 2 },
  { label: "11", today: true, names: ["김효준", "이수나"], more: 3 },
  { label: "12", names: ["박소향", "서른진*"], more: 2 },
]);
await week("3주", [
  { label: "13", sun: true },
  { label: "14", names: ["신외경", "김형인"], more: 1 },
  { label: "15", names: ["강재연", "임은주*"], more: 1 },
  { label: "16", names: ["김효준", "이수나"], more: 2 },
  { label: "17", event: "감염관리 점검", names: ["정성근"], more: 3 },
  { label: "18", names: ["정연수", "박소향"], more: 2 },
  { label: "19", names: ["조미숙", "이수나"], more: 2 },
]);
await week("4주", [
  { label: "20", sun: true },
  { label: "21", event: "근무표 작성 시작", names: ["김보경*"], more: 3 },
  { label: "22", names: ["이수나", "강재연"], more: 2 },
  { label: "23", names: ["김형인", "박정숙"], more: 1 },
  { label: "24", holiday: true, event: "추석 연휴" },
  { label: "25", holiday: true, event: "추석" },
  { label: "26", holiday: true, event: "추석 연휴" },
]);
await week("5주", [
  { label: "27", sun: true },
  { label: "28", names: ["정연수", "배정민"], more: 1 },
  { label: "29", names: ["이수나", "강재연"], more: 1 },
  { label: "30", names: ["김효준", "김형인"], more: 1 },
  { label: "1", dim: true }, { label: "2", dim: true }, { label: "3", dim: true },
]);

// ── 승인 대기 패널 ───────────────────────────────────────────
const side = figma.createAutoLayout("VERTICAL", { name: "우측 열" });
side.setBoundVariable("itemSpacing", vars["spacing/5"]);
side.resize(300, 100);
row.appendChild(side);
side.layoutSizingHorizontal = "FIXED";
side.layoutSizingVertical = "FILL";

const waitCard = figma.createAutoLayout("VERTICAL", { name: "승인 대기" });
waitCard.fills = [paint("bg/surface")];
waitCard.strokes = [paint("accent")];
waitCard.strokeWeight = 1;
radius(waitCard, "radius/container");
pad(waitCard, "spacing/5");
waitCard.setBoundVariable("itemSpacing", vars["spacing/4"]);
side.appendChild(waitCard);
waitCard.layoutSizingHorizontal = "FILL";
waitCard.layoutSizingVertical = "HUG";

const wHead = figma.createAutoLayout("HORIZONTAL", { name: "제목" });
wHead.primaryAxisAlignItems = "SPACE_BETWEEN";
wHead.counterAxisAlignItems = "CENTER";
waitCard.appendChild(wHead);
wHead.layoutSizingHorizontal = "FILL";
await T(wHead, "승인 대기", "eyebrow", "text/accent");
await T(wHead, "4", "label/strong", "text/accent");

for (const [who, role, kind, when] of [
  ["조미숙", "간호조무사", "일반휴무", "9.8"],
  ["서른진", "요양보호사", "연차", "9.12"],
  ["임은주", "요양보호사", "일반휴무", "9.15"],
  ["김보경", "사회복지사", "일반휴무", "9.21"],
]) {
  const item = figma.createAutoLayout("VERTICAL", { name: who });
  item.setBoundVariable("itemSpacing", vars["spacing/0-5"]);
  waitCard.appendChild(item);
  item.layoutSizingHorizontal = "FILL";

  const top = figma.createAutoLayout("HORIZONTAL", { name: "행" });
  top.primaryAxisAlignItems = "SPACE_BETWEEN";
  top.counterAxisAlignItems = "BASELINE";
  item.appendChild(top);
  top.layoutSizingHorizontal = "FILL";
  await T(top, `${who} · ${kind}`, "body", "text/primary");
  await T(top, when, "supporting", "text/secondary");
  await T(item, role, "supporting", "text/disabled");
}

const btnRow = figma.createAutoLayout("HORIZONTAL", { name: "일괄 처리" });
btnRow.setBoundVariable("itemSpacing", vars["spacing/2"]);
waitCard.appendChild(btnRow);
btnRow.layoutSizingHorizontal = "FILL";
for (const [label, primary] of [["모두 승인", true], ["하나씩 보기", false]]) {
  const b = figma.createAutoLayout("HORIZONTAL", { name: label });
  b.primaryAxisAlignItems = "CENTER";
  b.counterAxisAlignItems = "CENTER";
  for (const p of ["paddingTop", "paddingBottom"]) b.setBoundVariable(p, vars["spacing/2"]);
  radius(b, "radius/element");
  b.fills = [paint(primary ? "accent" : "bg/surface")];
  if (!primary) { b.strokes = [paint("border")]; b.strokeWeight = 1; }
  btnRow.appendChild(b);
  b.layoutSizingHorizontal = "FILL";
  await T(b, label, "label", primary ? "on-accent" : "text/primary");
}

// 이번 달 인원 요약 — 조용한 보조 카드
const statCard = figma.createAutoLayout("VERTICAL", { name: "이번 달" });
statCard.fills = [paint("bg/surface")];
statCard.strokes = [paint("border")];
statCard.strokeWeight = 1;
radius(statCard, "radius/container");
pad(statCard, "spacing/5");
statCard.setBoundVariable("itemSpacing", vars["spacing/3"]);
side.appendChild(statCard);
statCard.layoutSizingHorizontal = "FILL";
statCard.layoutSizingVertical = "HUG";
await T(statCard, "이번 달 휴무", "eyebrow", "text/secondary");
for (const [label, value] of [
  ["일반휴무", "31건"], ["연차", "12건"], ["병가", "4건"],
]) {
  const r = figma.createAutoLayout("HORIZONTAL", { name: label });
  r.primaryAxisAlignItems = "SPACE_BETWEEN";
  statCard.appendChild(r);
  r.layoutSizingHorizontal = "FILL";
  await T(r, label, "body", "text/secondary");
  await T(r, value, "body", "text/primary");
}

await row.screenshot();
return { createdNodeIds: [row.id, cal.id, side.id], rowId: row.id };
