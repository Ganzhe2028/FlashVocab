export default function AIPreparationControls({ settings, onChange, busy, progress, onCancel, idPrefix, onPrepareExisting, hasWords }) {
  return (
    <section className="ai-preparation" aria-label="DeepSeek 补全设置">
      <label className="field-label" htmlFor={`${idPrefix}-key`}>DeepSeek API key</label>
      <input className="wave-name" id={`${idPrefix}-key`} type="password" autoComplete="off" autoCapitalize="none" spellCheck={false} value={settings.apiKey} disabled={busy} onChange={(event) => onChange({ ...settings, apiKey: event.target.value })} />
      <label className="field-label" htmlFor={`${idPrefix}-model`}>模型 ID</label>
      <input className="wave-name" id={`${idPrefix}-model`} value={settings.model} disabled={busy} onChange={(event) => onChange({ ...settings, model: event.target.value })} />
      <a className="text-button" href="https://api-docs.deepseek.com/" target="_blank" rel="noreferrer">DeepSeek 官方接口说明</a>
      {onPrepareExisting ? <button type="button" className="secondary-action" disabled={busy || !hasWords} onClick={onPrepareExisting}>补齐当前词表资料</button> : null}
      {busy ? <div role="status"><p>已处理 {progress.current} / {progress.total} 词，全部成功后保存。</p><button type="button" className="text-button" onClick={onCancel}>取消</button></div> : null}
    </section>
  );
}
