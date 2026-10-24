import { AppBar } from "@/components/AppBar";

/** Shown instantly while a page's data loads, so tapping a tab never feels stuck. */
export default function Loading() {
  return (
    <>
      <AppBar />
      <main id="main" className="wrap" aria-busy="true" aria-label="Loading">
        <div className="skel skel-title" />
        <div className="skel skel-card" />
        <div className="skel skel-row" />
        <div className="skel skel-row" />
        <div className="skel skel-row" />
      </main>
    </>
  );
}
