export function downloadRenderedInterviewReport(root: HTMLElement, filename: string) {
  const report = root.querySelector<HTMLElement>(".interview-paper-report");
  if (!report) throw new Error("报告内容尚未加载完成。");

  const css = Array.from(document.styleSheets).flatMap((sheet) => {
    try {
      return Array.from(sheet.cssRules, (rule) => rule.cssText);
    } catch {
      return [];
    }
  }).join("\n");
  const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${filename.replace(/\.html$/i, "")}</title>
<style>
${css}
html,body{margin:0;padding:0;background:#e8ebed}
@page{size:A4;margin:0}
@media print{html,body{background:#fff}.interview-paper-report{padding:0!important}}
</style>
</head>
<body>${report.outerHTML}</body>
</html>`;
  const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename.endsWith(".html") ? filename : `${filename}.html`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
