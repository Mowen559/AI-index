import { ProjectSelectForm } from "@/components/project-select-form";

export default function Home() {
  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-void">
      {/* Animated Glowing Background Elements */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-primary/10 mix-blend-screen blur-[100px] animate-pulse-glow" />
        <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-accent-purple/10 mix-blend-screen blur-[100px] animate-pulse-glow" style={{ animationDelay: "1s" }} />
      </div>

      <main className="relative z-10 w-full max-w-3xl px-6">
        <div className="animate-slide-in rounded-2xl border border-border bg-surface/60 p-10 shadow-glow-soft backdrop-blur-xl">
          <div className="mb-10 text-center animate-fade-in">
            <h1 className="mb-4 text-5xl font-bold tracking-tight text-text-primary">
              AIndex <span className="text-primary">Hub</span>
            </h1>
            <p className="mx-auto max-w-xl text-lg text-text-secondary leading-relaxed">
              Unified Codebase Intelligence. Select a local directory to automatically run AST parsing, codebase memory indexing, and architecture visualization.
            </p>
          </div>
          
          <div className="mx-auto w-full max-w-md animate-fade-in" style={{ animationDelay: "0.2s" }}>
            <ProjectSelectForm />
          </div>
        </div>

        {/* Decorative Grid Lines */}
        <div className="pointer-events-none absolute -inset-px rounded-2xl border border-primary/20 animate-breathe" />
      </main>
    </div>
  );
}
