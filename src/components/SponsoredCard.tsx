"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export type Sponsored = { id: string; sponsor: string; title: string; body: string | null; link: string | null };

export function SponsoredCard({ card }: { card: Sponsored }) {
  useEffect(() => {
    createClient().rpc("sponsored_view", { p_id: card.id }).then(() => {}, () => {});
  }, [card.id]);

  return (
    <article className="card" style={{ borderStyle: "dashed" }}>
      <p className="eyebrow small" style={{ marginBottom: 4 }}>Sponsored · {card.sponsor}</p>
      <h3>{card.title}</h3>
      {card.body && <p>{card.body}</p>}
      {card.link && (
        <a href={`/api/sponsored/click?id=${encodeURIComponent(card.id)}`} target="_blank" rel="noopener sponsored">
          Learn more ↗
        </a>
      )}
    </article>
  );
}
