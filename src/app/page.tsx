import { COPY } from "@/copy";

export default function Home() {
  return (
    <main className="shell">
      <h1 className="wordmark">{COPY.placeholder.title}</h1>
      <p className="lede">{COPY.placeholder.lede}</p>
      <p className="hint">{COPY.placeholder.nextStep}</p>
    </main>
  );
}
