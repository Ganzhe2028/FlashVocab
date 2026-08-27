export default function FamiliarPool({ entries }) {
  return (
    <details className="familiar-pool">
      <summary>暂时熟悉池（{entries.length} 个词）</summary>
      {entries.length ? (
        <div className="familiar-list">
          {entries.map(({ entry, cardId, study, spell }) => (
            <div className="familiar-item" key={cardId}>
              <strong>{entry.term}</strong>
              <span>
                辨识：
                {study.hidden
                  ? `隐藏至第 ${study.dueRound} 轮`
                  : `${Math.min(study.streak, 4)}/4`}
              </span>
              <span>
                拼写：
                {spell.hidden
                  ? `隐藏至第 ${spell.dueRound} 轮`
                  : `${Math.min(spell.streak, 4)}/4`}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p>连续正确 4 轮的词会出现在这里。</p>
      )}
    </details>
  );
}
