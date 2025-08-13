import heroImage from "@/assets/hero-headphones.jpg";
import { Button } from "@/components/ui/button";
import { Headphones, Play } from "lucide-react";
import { useRef } from "react";

export const Hero = () => {
  const ref = useRef<HTMLDivElement>(null);

  const onMouseMove: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    ref.current.style.setProperty("--x", `${x}px`);
    ref.current.style.setProperty("--y", `${y}px`);
  };

  return (
    <header
      className="relative overflow-hidden"
      onMouseMove={onMouseMove}
      ref={ref}
      aria-label="Sema ASR hero section"
    >
      <nav className="container flex items-center justify-between py-6">
        <div className="flex items-center gap-2 text-foreground">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background shadow-sm">
            <Headphones className="h-5 w-5" aria-hidden />
          </span>
          <span className="text-lg font-semibold">Sema ASR</span>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="#transcribe"
            className="hidden md:inline-flex text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Try it
          </a>
          <a
            href="#docs"
            className="hidden md:inline-flex text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            API Docs
          </a>
          <Button variant="hero" size="lg" asChild>
            <a href="#transcribe" aria-label="Start transcribing">
              <Play className="opacity-90" /> Start now
            </a>
          </Button>
        </div>
      </nav>

      <div className="container grid gap-10 md:grid-cols-2 items-center pb-12 pt-2">
        <div className="relative order-2 md:order-1">
          <img
            src={heroImage}
            alt="Minimal headphones product shot, representing speech-to-text capabilities"
            className="w-full rounded-xl border border-border shadow-[var(--shadow-elevated)]"
            loading="eager"
            fetchPriority="high"
          />
        </div>
        <div className="order-1 md:order-2">
          <p className="text-sm font-medium text-primary">Swahili Speech-to-Text</p>
          <h1 className="mt-2 text-4xl/tight md:text-5xl/tight font-bold">
            Introducing Sema ASR
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Transcribe audio into accurate Swahili text with a powerful API. Fast, secure, and simple to use.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button variant="hero" size="lg" asChild>
              <a href="#transcribe">
                <Play className="opacity-90" /> Transcribe audio
              </a>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <a href="#docs">View API</a>
            </Button>
          </div>
        </div>
      </div>

      <div
        className="pointer-events-none absolute inset-0 opacity-80 md:opacity-100"
        style={{ background: "var(--gradient-hero)" }}
        aria-hidden
      />
    </header>
  );
};

export default Hero;
