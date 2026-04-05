import type { CriticReview } from "@/hooks/useApi";

interface CriticScoreCardProps {
  review: CriticReview;
}

function getScoreColor(score: number): { ring: string; text: string; bg: string } {
  if (score >= 8) return { ring: "#22C55E", text: "text-[#22C55E]", bg: "bg-[#22C55E15]" };
  if (score >= 5) return { ring: "#F59E0B", text: "text-[#F59E0B]", bg: "bg-[#F59E0B15]" };
  return { ring: "#EF4444", text: "text-[#EF4444]", bg: "bg-[#EF444415]" };
}

export function CriticScoreCard({ review }: CriticScoreCardProps) {
  const color = getScoreColor(review.score);
  const circumference = 2 * Math.PI * 36;
  const progress = (review.score / 10) * circumference;
  const dashOffset = circumference - progress;

  return (
    <div className="rounded-[10px] border border-[#334155] bg-[#1E293B] p-4 animate-in fade-in duration-500">
      <span className="text-[10px] font-semibold uppercase tracking-[1.5px] text-[#64748B]">
        QUALITY REVIEW
      </span>

      <div className="mt-3 flex gap-4">
        {/* SVG donut */}
        <div className="shrink-0">
          <svg width="80" height="80" viewBox="0 0 80 80" className="rotate-[-90deg]">
            <circle
              cx="40"
              cy="40"
              r="36"
              fill="none"
              stroke="#1E293B"
              strokeWidth="6"
            />
            <circle
              cx="40"
              cy="40"
              r="36"
              fill="none"
              stroke={color.ring}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              className="transition-[stroke-dashoffset] duration-1000 ease-out"
            />
          </svg>
          <div className="relative -mt-[56px] flex items-center justify-center h-[32px]">
            <span className={`text-xl font-bold ${color.text}`}>
              {review.score}
            </span>
            <span className="text-xs text-[#64748B]">/10</span>
          </div>
        </div>

        {/* Strengths / Weaknesses */}
        <div className="flex flex-1 flex-col gap-1.5 min-w-0">
          {review.strengths.map((s, i) => (
            <div key={`s-${i}`} className="flex items-start gap-1.5">
              <span className="shrink-0 text-[11px] text-[#22C55E]">+</span>
              <span className="text-[11px] leading-snug text-[#94A3B8]">{s}</span>
            </div>
          ))}
          {review.weaknesses.map((w, i) => (
            <div key={`w-${i}`} className="flex items-start gap-1.5">
              <span className="shrink-0 text-[11px] text-[#EF4444]">&minus;</span>
              <span className="text-[11px] leading-snug text-[#94A3B8]">{w}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
