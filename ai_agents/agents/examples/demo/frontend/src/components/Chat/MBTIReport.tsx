export function MBTIReport({ text }: { text: string }) {
  const [header, ...sections] = text.trim().split(/\n\s*\n/);
  const [title, subtitle] = header.split("\n");

  return (
    <article aria-label={title} className="space-y-6 text-sm leading-7">
      <header className="border-b border-white/10 pb-4">
        <h2 className="text-xl font-semibold tracking-wide">{title}</h2>
        <p className="mt-1 text-xs text-zinc-400">{subtitle}</p>
      </header>
      {sections.map((section, index) => {
        const [heading, ...lines] = section.split("\n");
        if (!/^[一二三四]、/.test(heading)) {
          return (
            <p key={index} className="whitespace-pre-wrap text-zinc-400">
              {section}
            </p>
          );
        }
        return (
          <section key={index} className="space-y-2">
            <h3 className="font-semibold text-sky-300">{heading}</h3>
            {lines.map((line, lineIndex) => (
              <p
                key={lineIndex}
                className={
                  line.startsWith("初步倾向：")
                    ? "py-1 text-2xl font-semibold tracking-wider text-white"
                    : line.includes("｜")
                      ? "pt-3 font-medium text-zinc-100"
                      : "whitespace-pre-wrap break-words text-zinc-300"
                }
              >
                {line}
              </p>
            ))}
          </section>
        );
      })}
    </article>
  );
}
