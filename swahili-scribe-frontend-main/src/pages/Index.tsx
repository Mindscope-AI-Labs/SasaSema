import Hero from "@/components/Hero";
import TranscribeForm from "@/components/TranscribeForm";
import HealthBadge from "@/components/HealthBadge";
import Seo from "@/components/Seo";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Seo
        title="Sema ASR — Swahili Speech‑to‑Text"
        description="Transcribe Swahili speech to text with Sema ASR. Upload audio and get fast, accurate transcriptions."
      />

      <Hero />

      <main className="container pb-16" role="main">
        <section className="flex items-center justify-between py-4" id="docs">
          <h2 className="text-xl font-semibold">API Status</h2>
          <HealthBadge />
        </section>

        <TranscribeForm />
      </main>
    </div>
  );
};

export default Index;
