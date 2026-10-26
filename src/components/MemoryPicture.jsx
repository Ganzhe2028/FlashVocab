import { getMemorySketch } from "../memorySketch.js";

const icons = {
  notes: <><path d="m-22-15 24-7 7 25-24 7Zm18 6 23 5-6 24-23-5Z" /><path d="m-15-7 11-3m-9 10 11-3m0 9 9 2" /></>,
  plan: <><rect x="-23" y="-27" width="46" height="54" rx="5" /><path d="m-15-13 3 3 5-6m-8 16 3 3 5-6m-8 16 3 3 5-6M0-12h14M0 1h14M0 14h14" /></>,
  light: <><path d="M-10 16c0-9-12-11-12-26a22 22 0 0 1 44 0C22 5 10 7 10 16Zm0 0h20m-18 7H8M0-39v-5M-32-27l-5-4m69 4 5-4" /></>,
  person: <><circle cy="-18" r="11" /><path d="M-25 28v-8a25 25 0 0 1 50 0v8Z" /></>,
  clock: <><circle r="29" /><path d="M0-19V0l14 9" /></>,
  door: <><path d="M-23 29v-58h46v58Zm6-52L12-17v46M5 5h1M-29 29h58" /></>,
  plant: <><path d="M0 29V-4C-25-1-26-18-26-18-7-21 0-10 0-4c0-17 24-23 24-23S30-7 0-4M-17 29h34" /></>,
  coins: <><ellipse cy="16" rx="27" ry="9" /><path d="M-27 16v10c0 12 54 12 54 0V16M-20-4v10c0 11 43 11 43 0V-4" /><ellipse cx="2" cy="-4" rx="22" ry="8" /><ellipse cy="-24" rx="17" ry="7" /></>,
  shield: <><path d="M0-31 25-20v20C25 17 0 32 0 32S-25 17-25 0v-20Z" /><path d="m-13-1 9 9L15-12" /></>,
  cloud: <path d="M-24 18a17 17 0 0 1-3-34 23 23 0 0 1 44-5 19 19 0 1 1 9 39Z" />,
  eye: <><path d="M-34 0S-20-23 0-23 34 0 34 0 20 23 0 23-34 0-34 0Z" /><circle r="11" /></>,
  hand: <path d="M-23 24-31 0c-2-7 7-9 10-2l5 8V-24c0-9 10-9 10 0v17-27c0-9 10-9 10 0v27-22c0-9 10-9 10 0v22-13c0-9 10-9 10 0v33L13 31H-9Z" />,
};

export default function MemoryPicture({ item }) {
  const sketch = getMemorySketch(item);
  const description = sketch
    ? `${sketch.left.label}，${sketch.link}，${sketch.right.label}。${item.microScene || ""}`
    : `${item.term}：${item.wordOrigin || item.meaningZh || item.meaning || "词义资料尚未补齐"}`;
  return <figure className="memory-picture">
    <svg viewBox="0 0 360 155" role="img" aria-label={`${item.term} 的记忆图：${description}`}>
      <g className="memory-objects" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
        <g transform="translate(75 57)">{icons[sketch?.left.icon || "notes"]}</g>
        <g transform="translate(285 57)">{icons[sketch?.right.icon || "light"]}</g>
        <path d="M130 58h100m-9-7 9 7-9 7" />
      </g>
      <g className="memory-labels" fill="currentColor" textAnchor="middle">
        <text x="75" y="119">{sketch?.left.label || "词源 / 词义"}</text>
        <text x="180" y="39">{sketch?.link || "联想"}</text>
        <text x="285" y="119">{sketch?.right.label || "记住含义"}</text>
      </g>
    </svg>
    <figcaption>{item.microScene || item.meaningZh || item.meaning || "补齐词表后，这里会显示具体的记忆画面。"}</figcaption>
  </figure>;
}
