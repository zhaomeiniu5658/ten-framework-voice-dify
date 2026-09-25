function headingText(line: string) {
  return line.replace(/^#{1,6}\s*/, "").trim();
}

export function MBTIReport({ text }: { text: string }) {
  const blocks = text.trim().split(/\n\s*\n/);
  const title = headingText(blocks.shift() || "面试报告");

  return (
    <article aria-label={title} className="space-y-5 text-sm leading-7">
      <header className="border-b border-white/10 pb-4">
        <h2 className="text-xl font-semibold tracking-wide">{title}</h2>
      </header>
      {blocks.map((block, index) => {
        const lines = block.split("\n");
        const first = lines[0] || "";
        const isHeading = /^#{2,6}\s/.test(first);
        return (
          <section key={index} className="space-y-1">
            {isHeading ? (
              <h3 className="font-semibold text-sky-300">
                {headingText(first)}
              </h3>
            ) : null}
            <div className="whitespace-pre-wrap break-words text-zinc-300">
              {(isHeading ? lines.slice(1) : lines).join("\n")}
            </div>
          </section>
        );
      })}
    </article>
  );
}
