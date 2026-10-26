export default function AIPreparationControls({ settings, onChange, busy, progress, onCancel, idPrefix, onPrepareExisting, hasWords }) {
  return (
    <section className="ai-preparation" aria-label="DeepSeek 备料设置">
      <label className="switch-row">
        <span><strong>导入时用 DeepSeek 备料</strong><small>补记忆画面、干扰词、用法和辨析情景；会发送这次词表并消耗 API 额度。</small></span>
        <input type="checkbox" role="switch" checked={settings.enabled} disabled={busy} onChange={(event) => onChange({ ...settings, enabled: event.target.checked })} />
      </label>
      {settings.enabled ? <>
        <label className="field-label" htmlFor={`${idPrefix}-key`}>DeepSeek API key</label>
        <input className="wave-name" id={`${idPrefix}-key`} type="password" autoComplete="off" autoCapitalize="none" spellCheck={false} value={settings.apiKey} disabled={busy} onChange={(event) => onChange({ ...settings, apiKey: event.target.value })} />
        <p className="setting-note">key 仅留当前页面内存，刷新后清空。生成的资料会随词表保存在本机。</p>
        <label className="field-label" htmlFor={`${idPrefix}-model`}>DeepSeek 模型 ID</label>
        <input className="wave-name" id={`${idPrefix}-model`} value={settings.model} disabled={busy} onChange={(event) => onChange({ ...settings, model: event.target.value })} />
        <a className="text-button" href="https://api-docs.deepseek.com/" target="_blank" rel="noreferrer">DeepSeek 官方接口说明</a>
        {onPrepareExisting ? <button type="button" className="secondary-action" disabled={busy || !hasWords} onClick={onPrepareExisting}>补齐当前波次资料</button> : null}
      </> : null}
      {busy ? <div role="status"><p>已备料 {progress.current} / {progress.total} 词，全部成功后保存。</p><button type="button" className="text-button" onClick={onCancel}>取消备料</button></div> : null}
    </section>
  );
}
