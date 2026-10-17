/**
 * 설명 단계에서 쓰는 개념 모형 (실제 배선 안내가 아님).
 * 전하(점)의 흐름과 에너지 전환을 단순화해 보여 준다.
 */
import type { InquiryId } from '@/poe/types';

function Dots({ path, n }: { path: string; n: number }) {
  // SVG <animateMotion> 없이 정적으로 같은 간격의 점을 배치한다 (장식 애니메이션 배제)
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <circle key={i} r="4" fill="var(--current)">
          <animateMotion dur="8s" repeatCount="indefinite" begin={`${(i * 8) / n}s`} path={path} />
        </circle>
      ))}
    </>
  );
}

export function ConceptModel({ inquiryId }: { inquiryId: InquiryId }) {
  const loop = 'M 60 40 L 340 40 L 340 200 L 60 200 Z';
  switch (inquiryId) {
    case 1:
      return (
        <svg className="circuit" viewBox="0 0 400 240" role="img" aria-label="개념 모형: 전하는 회로 어디서나 같은 간격으로 흐르고, 전구에서는 에너지가 빛과 열로 바뀐다">
          <path d={loop} fill="none" stroke="var(--border-strong)" strokeWidth="6" />
          <Dots path={loop} n={14} />
          <circle cx="200" cy="40" r="20" fill="#fff7cc" stroke="var(--warn)" strokeWidth="2" />
          <text x="200" y="45" fontSize="12" textAnchor="middle" fontWeight="700" fill="var(--warn)">
            전구
          </text>
          <text x="200" y="95" fontSize="12" textAnchor="middle" fill="var(--warn)" fontWeight="700">
            빛 · 열 (에너지가 나감)
          </text>
          <text x="200" y="125" fontSize="12" textAnchor="middle" fill="var(--text-muted)">
            점(전하)의 수와 간격은 전구 앞·뒤에서 같다 → 전류는 같다
          </text>
          <text x="200" y="228" fontSize="11" textAnchor="middle" fill="var(--text-faint)">
            개념 모형 — 실제 배선 안내가 아님
          </text>
        </svg>
      );
    case 2:
      return (
        <svg className="circuit" viewBox="0 0 400 240" role="img" aria-label="개념 모형: 전압이 클수록 전하를 미는 힘이 커져 같은 저항에 더 많은 전류가 흐른다">
          {[1, 2, 3].map((k) => (
            <g key={k} transform={`translate(0 ${(k - 1) * 70})`}>
              <text x="20" y="40" fontSize="12" fill="var(--voltage)" fontWeight="700">
                {k}V
              </text>
              {Array.from({ length: k }, (_, i) => (
                <polygon key={i} points={`${60 + i * 16},30 ${72 + i * 16},40 ${60 + i * 16},50`} fill="var(--voltage)" />
              ))}
              <rect x="140" y="30" width="80" height="20" fill="var(--surface)" stroke="var(--text)" strokeWidth="2" />
              <text x="180" y="44" fontSize="11" textAnchor="middle">
                같은 저항
              </text>
              {Array.from({ length: k * 2 }, (_, i) => (
                <circle key={i} cx={240 + i * 18} cy="40" r="4" fill="var(--current)" />
              ))}
            </g>
          ))}
          <text x="200" y="228" fontSize="11" textAnchor="middle" fill="var(--text-faint)">
            개념 모형 — 미는 힘(전압)이 커지면 지나가는 전하(전류)도 비례해 늘어난다
          </text>
        </svg>
      );
    case 3:
      return (
        <svg className="circuit" viewBox="0 0 400 240" role="img" aria-label="개념 모형: 전하가 가진 에너지가 두 저항을 지나며 단계적으로 줄어든다">
          <polyline points="40,40 130,40 130,100 250,100 250,180 360,180" fill="none" stroke="var(--voltage)" strokeWidth="4" />
          <rect x="120" y="30" width="20" height="80" fill="var(--voltage-soft)" stroke="var(--voltage)" />
          <rect x="240" y="90" width="20" height="100" fill="var(--voltage-soft)" stroke="var(--voltage)" />
          <text x="85" y="30" fontSize="11" textAnchor="middle" fill="var(--text-muted)">
            전원에서 받은 에너지
          </text>
          <text x="130" y="125" fontSize="11" textAnchor="middle" fill="var(--voltage)" fontWeight="700">
            R1 에서 V1 만큼
          </text>
          <text x="250" y="205" fontSize="11" textAnchor="middle" fill="var(--voltage)" fontWeight="700">
            R2 에서 V2 만큼
          </text>
          <text x="200" y="228" fontSize="11" textAnchor="middle" fill="var(--text-faint)">
            개념 모형 — V1 + V2 ≈ V전체. 저항이 크면 더 많이 내려간다
          </text>
        </svg>
      );
    case 4:
    default:
      return (
        <svg className="circuit" viewBox="0 0 400 240" role="img" aria-label="개념 모형: 전하가 갈라져 두 길로 흐르다 다시 모인다">
          <path d="M 30 120 L 120 120" stroke="var(--border-strong)" strokeWidth="6" fill="none" />
          <path d="M 120 120 C 160 120 160 60 200 60 L 260 60 C 300 60 300 120 340 120" stroke="var(--border-strong)" strokeWidth="6" fill="none" />
          <path d="M 120 120 C 160 120 160 180 200 180 L 260 180 C 300 180 300 120 340 120" stroke="var(--border-strong)" strokeWidth="6" fill="none" />
          <path d="M 340 120 L 380 120" stroke="var(--border-strong)" strokeWidth="6" fill="none" />
          {[40, 60, 80, 100].map((x) => (
            <circle key={x} cx={x} cy="120" r="4" fill="var(--current)" />
          ))}
          {[200, 230, 260].map((x) => (
            <circle key={`a${x}`} cx={x} cy="60" r="4" fill="var(--current)" />
          ))}
          {[215, 245].map((x) => (
            <circle key={`b${x}`} cx={x} cy="180" r="4" fill="var(--current)" />
          ))}
          {[350, 370].map((x) => (
            <circle key={`c${x}`} cx={x} cy="120" r="4" fill="var(--current)" />
          ))}
          <text x="230" y="45" fontSize="11" textAnchor="middle" fill="var(--text-muted)">
            가지 1 (저항 작음 → 더 많이)
          </text>
          <text x="230" y="205" fontSize="11" textAnchor="middle" fill="var(--text-muted)">
            가지 2 (저항 큼 → 더 적게)
          </text>
          <text x="200" y="228" fontSize="11" textAnchor="middle" fill="var(--text-faint)">
            개념 모형 — 길이 늘면 전체로 지나가는 전하가 늘어난다. I전체 ≈ I1 + I2
          </text>
        </svg>
      );
  }
}
