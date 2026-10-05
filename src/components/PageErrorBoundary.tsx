import { Component, type ErrorInfo, type ReactNode } from "react";

export default class PageErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("Page rendering failed", error, info.componentStack); }
  render() {
    if (!this.state.error) return this.props.children;
    return <main className="mx-auto max-w-2xl px-5 py-16" role="alert">
      <h1 className="text-2xl font-extrabold">Не удалось открыть страницу</h1>
      <p className="mt-3 text-sm text-[#52705a]">Попробуйте ещё раз или перейдите в другой раздел через меню сверху.</p>
      <button className="cta-lime mt-6 rounded-xl px-5 py-3 font-bold" onClick={() => this.setState({ error: null })}>Попробовать снова</button>
      <details className="mt-6 text-sm"><summary className="cursor-pointer">Текст ошибки</summary><pre className="mt-3 whitespace-pre-wrap break-words">{this.state.error.message}</pre></details>
    </main>;
  }
}
