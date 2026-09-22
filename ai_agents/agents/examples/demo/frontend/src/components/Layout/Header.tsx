import { cn } from "@/lib/utils";
import { HeaderActions } from "./HeaderComponents";

export default function Header(props: { className?: string }) {
  const { className } = props;
  return (
    <>
      {/* Header */}
      <header
        className={cn(
          "flex items-center justify-between bg-[#181a1d] p-2 font-roboto md:p-4",
          className
        )}
      >
        <div className="flex items-center space-x-2">
          <h1 className="font-bold text-sm md:text-xl">AI Interview Agent</h1>
        </div>
        <HeaderActions />
      </header>
    </>
  );
}
