import { allowsUnknownAnswer, UNKNOWN_ANSWER } from "../questionBuilder.js";

export default function QuestionView({ quiz, onAnswer, onNext, onEnd, onRestart }) {
  if (quiz.finished) {
    const correct = quiz.results.filter((result) => result.correct).length;
    return (
      <section className="status-view" aria-labelledby="quiz-summary-title">
        <p className="eyebrow">{quiz.kind === "scenario" ? "情景题" : quiz.kind === "bank" ? "填搭配" : quiz.kind === "contrast" ? "辨析近义词" : "选择题"}结算</p>
        <h1 id="quiz-summary-title">这组题练完了。</h1>
        <p role="status">共 {quiz.results.length} 题，答对 {correct}，答错 {quiz.results.length - correct}。</p>
        <div className="status-actions">
          <button type="button" className="primary-action" onClick={onRestart}>再练一组</button>
          <button type="button" className="secondary-action" onClick={onEnd}>回到刚才的学习</button>
        </div>
      </section>
    );
  }
  const question = quiz.question;
  const answered = quiz.selected !== null;
  return (
    <section className="question-view" aria-labelledby="question-title">
      <p className="eyebrow">练习 · {quiz.index + 1} / {quiz.queueIds.length}</p>
      <h1 id="question-title">{quiz.kind === "scenario" ? "根据情景选词。" : quiz.kind === "bank" ? "从词库找回搭配。" : quiz.kind === "contrast" ? "这次更接近哪个词？" : "选最贴切的词。"}</h1>
      <p className="question-prompt">{question.prompt}</p>
      {quiz.kind === "bank" ? <p>选择空缺搭配里的词。词库含当前词表全部词，另有 {question.extraCount} 个额外词。</p> : null}
      {quiz.kind === "bank" ? <p className="option-help">前九项可按 1–9；所有选项也能点击，或用 Tab 选中后按 Enter。</p> : null}
      <div className={`question-options${quiz.kind === "bank" ? " word-bank-options" : ""}`} role="group" aria-label="选择答案">
        {question.options.map((option, index) => (
          <button
            type="button"
            key={option}
            className={`choice-action${answered && option === question.answer ? " is-correct" : ""}${answered && option === quiz.selected && option !== question.answer ? " is-incorrect" : ""}`}
            disabled={answered}
            onClick={() => onAnswer(option)}
          ><span>{quiz.kind === "bank" ? option.replace(/(^|[\s-])([a-z])/g, (_, separator, initial) => separator + initial.toUpperCase()) : option}</span><span className="option-meta">
            {answered && option === question.answer ? <small>正确答案</small> : answered && option === quiz.selected ? <small>你的选择（错）</small> : null}
            {index < 9 ? <kbd>{index + 1}</kbd> : null}
          </span></button>
        ))}
        {allowsUnknownAnswer(quiz.kind) ? (
          <button
            type="button"
            className={`choice-action${quiz.selected === UNKNOWN_ANSWER ? " is-incorrect" : ""}`}
            disabled={answered}
            onClick={() => onAnswer(UNKNOWN_ANSWER)}
          >
            <span>我不知道</span>
            <span className="option-meta">
              {quiz.selected === UNKNOWN_ANSWER ? <small>已选</small> : null}
              <kbd>5</kbd>
            </span>
          </button>
        ) : null}
      </div>
      {answered ? (
        <div className="question-feedback" role="status">
          <strong>{quiz.selected === question.answer ? "答对了" : `正确答案：${question.answer}`}</strong>
          <p>{question.explanation}</p>
          <button type="button" className="primary-action" onClick={onNext}><span>下一题</span><kbd>N</kbd></button>
        </div>
      ) : null}
      <button type="button" className="text-button sample-link" onClick={onEnd}>回到刚才的学习</button>
    </section>
  );
}
