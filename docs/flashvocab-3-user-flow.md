# 闪词 3.0 完整 User Flow

> 2026-09-07：新重写已经完成，现行行为合同与验收结果统一见 [执行计划](flashvocab-3-rewrite-plan.md)。下文保留旧流程作为历史来源，不再代表当前产品流程。

> 状态：历史逻辑来源；3.0 重写已完成
> 日期：2026-08-30  
> 范围：用户从打开网页、准备词表、辨识、拼写、返场、完成到再次打开的完整流程  
> 不包含：界面布局、视觉风格、动效参数、代码实现与算法字段

## 结论

闪词 3.0 的主流程不是“刷完一轮后让用户选择做什么”，而是：

**准备或恢复词表 → 辨识 → 系统解释并安排下一步 → 只让具备基础的词进入拼写 → 延后复习或回到辨识 → 明确完成。**

用户持续提供极轻量的学习证据，系统负责整理词序、判断阶段、安排返场、保存进度和解释空状态。正常学习时，用户不需要理解内部轮数、隐藏状态或调度规则。

## 一、阅读规则

### 状态标签

- **已对齐**：已经由产品初心和 3.0 设计底稿推出，可作为后续设计约束。
- **已确认**：产品负责人已经选择，可进入后续低保真设计；标为“实验性”的规则仍需在真实作业中验证。
- **推荐**：当前建议采用的 v0.1 默认方案，需要通过低保真稿和实际使用验证。
- **待确认**：会明显改变 User Flow，进入界面设计前需要由产品负责人拍板。

### 流程图语义

- 圆角节点：一个稳定状态或结果；
- 菱形节点：系统或用户必须作出的判断；
- 主路径：系统推荐的默认前进方向；
- 次级路径：用户主动改选、打开帮助或管理工具；
- 后台策略不会伪装成用户步骤，只在图后单独说明。

## 二、从初心到 User Flow

```mermaid
flowchart LR
    audience["中文语境下、临近 ENGL quiz 的学生"] --> scene["10–15 分钟碎片时间，多天重复冲刺临时词表"]
    scene --> pain["导入与重复准备太重；学习中选择和找按钮会打断；跳词像故障"]
    pain --> duty["闪词外包整理、轮转、筛选、阶段衔接与恢复"]
    duty --> principles["少、轻、快、好理解、键盘优先、可复用"]
    principles --> loop["准备或恢复 → 辨识 → 自动分流 → 合格词拼写 → 返场或完成"]
```

每一个环节都要能回答四个问题：

1. 是否让用户更快开始本次学习；
2. 是否减少学习中的判断和操作；
3. 是否直接服务于 quiz 所需的辨识与拼写；
4. 是否让中断和下次继续更容易。

## 三、总体 User Flow

```mermaid
flowchart LR
    open(["打开闪词"]) --> hasDeck{"有可恢复的词表与进度？"}
    hasDeck -->|"没有"| prepare["准备词表"]
    prepare --> validate["导入或粘贴 → 检查词表"]
    validate -->|"失败"| repair["说明问题并保留原状态"]
    repair --> prepare
    validate -->|"成功"| activate["启用并保存在本地"]
    activate --> recognition["辨识循环"]
    hasDeck -->|"有"| resume{"上次停在哪个阶段？"}
    resume -->|"辨识"| recognition
    resume -->|"拼写"| spelling["合格词拼写"]
    resume -->|"过渡或完成"| route
    recognition --> recognitionDone["完成一轮辨识"]
    recognitionDone --> route{"系统判断此刻最有价值的下一步"}
    route -->|"拼写池已成批，或已无法继续累积"| spellNotice["解释：这些词可以开始拼写"]
    spellNotice --> spelling
    route -->|"拼写池不足且仍可继续累积"| recognitionNotice["解释：这些词仍需辨识"]
    recognitionNotice --> recognition
    route -->|"只有到期返场词"| returnNotice["解释：这些词到了回看时间"]
    returnNotice --> recognition
    route -->|"当前无待办"| complete["明确完成，不让空状态像故障"]
    spelling --> spellingDone["完成本批拼写并更新词的阶段"]
    spellingDone --> route
    complete -->|"自由复习"| recognition
    complete -->|"结束本次"| persist["保留当前词表与进度"]
    recognition -->|"随时中断"| persist
    spelling -->|"随时中断"| persist
```

### 总流程的三条硬约束

1. 正常推进只有一个主动作；次级改选存在，但不与主动作争夺注意力。
2. 系统改变阶段前，必须用一句人话说明“为什么”和“接下来会发生什么”。
3. “继续辨识”“可以拼写”“之后再复习”“从词表移除”是四种不同状态，不能混用文案。

## 四、打开、准备与恢复

### 4.1 首次使用或没有词表

```mermaid
flowchart LR
    noDeck(["没有可用词表"]) --> prepare["进入准备词表"]
    prepare --> source{"词表从哪里来？"}
    source -->|"文件"| file["选择支持的文件"]
    source -->|"粘贴"| paste["粘贴现有内容"]
    source -->|"借助 AI"| prompt["复制生成提示词到任意 AI"]
    prompt --> paste
    source -->|"先体验"| demo["载入内置示例词表"]
    file --> parse["解析、统一格式、检查"]
    paste --> parse
    parse -->|"失败"| error["指出无法识别的位置和修复方式"]
    error --> source
    parse -->|"成功"| preview["显示识别词数和少量样例"]
    preview --> activate["开始使用这份词表"]
    demo --> activate
    activate --> local["自动保存在浏览器本地"]
    local --> backup["一次性提示保存词表副本"]
    backup --> firstCard["进入第一张辨识卡"]
```

**已对齐：**文件、粘贴和 AI 生成只是三种输入入口，最终必须收敛到同一个“识别成功 → 立即开始 → 可保存副本”的状态。

<a id="decision-d1"></a>

**待确认 D1：**首次无词表时采用“直接进入内置词表”，还是“准备词表为主、内置示例为次”，暂不只凭文字决定。低保真阶段必须把两种首屏都画出来，以实际进入感受对比后再选择；在此之前，两条路径都保留，不把任何一条写成正式默认值。

### 4.2 已有词表再次打开

```mermaid
flowchart LR
    reopen(["再次打开"]) --> state{"上次状态"}
    state -->|"辨识未完成"| recognition["回到同一张词，答案保持收起"]
    state -->|"拼写未完成"| spelling["回到同一题，清空未提交的半截输入"]
    state -->|"轮末过渡"| transition["恢复相同结论和推荐下一步"]
    state -->|"当前已完成"| complete["恢复明确完成态"]
    recognition --> continue["继续原流程"]
    spelling --> continue
    transition --> continue
    complete --> choice{"结束还是自由复习？"}
```

**已对齐：**打开应用首先是“继续”，不是重新选择模式；自动保存是后台能力，不成为额外步骤。

### 4.3 导入新词表替换当前词表

```mermaid
flowchart LR
    current(["当前已有词表和进度"]) --> import["选择或粘贴新词表"]
    import --> validate{"解析是否成功？"}
    validate -->|"失败"| keep["保留当前词表、进度和画面"]
    keep --> repair["说明具体问题后重新尝试"]
    validate -->|"成功"| replace["直接启用新词表并从第一轮辨识开始"]
    replace --> feedback["轻量提示：已替换为 X 个词；可撤销"]
    feedback -->|"撤销"| current
```

<a id="decision-d2"></a>

**已确认 D2：**新词表解析成功后直接替换，不增加事前确认步骤。可逆性改由替换后的轻量 Undo 承担：不打断导入，同时给误操作留下恢复路径。

## 五、单词辨识循环

### 5.1 每张词的主路径

```mermaid
flowchart LR
    hidden(["显示单词，答案收起"]) --> reveal["Enter 或 Space 翻开"]
    reveal --> reading["简明英英释义 → 中文校准 → 按需例句"]
    reading --> judgment{"我是否认出来？"}
    judgment -->|"Enter：认出来了"| known["记录本轮一次辨识成功"]
    judgment -->|"N：没认出来"| unknown["记录本轮失败，继续留在辨识"]
    judgment -->|"Space：再遮住"| hidden
    judgment -->|"需要帮助"| help["发音、词源、对应概念或深入理解"]
    help --> reading
    known --> more{"本轮还有词？"}
    unknown --> more
    more -->|"有"| hidden
    more -->|"没有"| summary["本轮结束，交给系统分流"]
```

### 5.2 辨识证据的规则

- 翻开答案只代表“看到了”，不代表“认出来了”。
- 只有翻开后明确按 `Enter` 或 `N` 才产生一次学习证据。
- 同一个词在同一轮最多记录一次；返回上一张、再次翻开或反复查看不会重复加分。
- 辨识失败会让词继续留在辨识阶段，不把它送去拼写。

```mermaid
flowchart LR
    reveal(["翻开答案"]) --> scored{"本轮已经判断过这个词？"}
    scored -->|"是"| viewOnly["只允许查看，不改写本轮结果"]
    scored -->|"否"| answer{"用户判断"}
    answer -->|"认出来"| success["本轮辨识成功 +1"]
    answer -->|"没认出"| failure["本轮辨识失败，稳定度回退"]
    success --> threshold{"已在不同轮次达到门槛？"}
    threshold -->|"否"| remain["继续辨识"]
    threshold -->|"是"| eligible["获得拼写资格"]
    failure --> remain
```

<a id="decision-d3"></a>

**已确认 D3（实验性）：**先采用“两个不同轮次辨识成功”作为拼写资格。等收到下一份真实作业后实测；如果进入拼写明显过慢，再退回一次正确即可获得资格。

### 5.3 辅助动作不改变主状态

```mermaid
flowchart LR
    card(["当前辨识卡"]) --> action{"辅助动作"}
    action -->|"点击单词"| copy["复制当前单词"]
    action -->|"上一词"| previous["回看上一张，不重复计分"]
    action -->|"理解更多"| deep["复制已带入当前词的理解请求"]
    action -->|"手动发音"| speak["播放当前词"]
    copy --> same["回到同一张、同一显隐状态"]
    previous --> card
    deep --> next["提示：粘贴到任意 AI 获取解释"]
    next --> same
    speak --> same
    same --> card
```

**已对齐：**深度理解是“当前词卡住后”的上下文支路，不再是与 Import、Export 同级的全局入口。

## 六、轮末自动分流

轮末是 2.5 最割裂的地方，也是 3.0 的核心重构点。系统先尝试把合格词积累成 3–5 个的小批次，再判断是否仍有不稳定词、是否存在不足 3 个但已经无法继续积累的尾批、是否有到期返场词；最后才进入完成。

```mermaid
flowchart LR
    roundDone(["完成一轮辨识或一批拼写"]) --> evaluate["汇总可拼写词、未稳定词和到期返场词"]
    evaluate --> batchReady{"已形成 3–5 个拼写小批次？"}
    batchReady -->|"是"| spellNotice["这批词已具备辨识基础，现在用拼写加固"]
    spellNotice -->|"Enter 默认"| spelling["开始这批词的拼写"]
    spellNotice -.->|"次级改选"| keepRecognition["保留资格，继续下一轮辨识"]
    batchReady -->|"否"| unstable{"仍有未稳定词可继续积累？"}
    unstable -->|"有"| recognitionNotice["X 个词仍需辨识，先把它们认熟"]
    recognitionNotice -->|"Enter 默认"| keepRecognition
    unstable -->|"没有"| tail{"仍有 1–2 个合格词？"}
    tail -->|"有"| tailNotice["没有更多词可累积，完成剩余小批"]
    tailNotice --> spelling
    tail -->|"没有"| due{"有到期返场词？"}
    due -->|"有"| returnNotice["X 个词到了回看时间"]
    returnNotice -->|"Enter 默认"| returnRecognition["开始返场辨识"]
    due -->|"没有"| complete["当前没有待办；词没有丢失，也不是故障"]
    complete --> intent{"用户现在想做什么？"}
    intent -->|"结束本次"| save["保留进度并停留在完成态"]
    intent -->|"自由复习"| freeReview["选择少量抽查或完整复习"]
```

### 五个 Case 的人话版本

#### Case A：拼写候选已形成 3–5 个小批次

`完成辨识 → 3–5 个词达到门槛 → 说明“这批词现在适合拼写” → Enter 开始拼写 → 次级动作仍可继续辨识。`

#### Case B：已有 1–2 个候选，仍能继续积累

`完成辨识 → 拼写池不足 3 个 + 仍有未稳定词 → 保留已有资格 → 说明“再认熟一小批” → Enter 进入下一轮辨识。`

#### Case C：只剩 1–2 个候选，已经无法继续积累

`完成辨识 → 拼写池不足 3 个 + 没有其他未稳定词 → 为避免卡住，放行剩余小批 → Enter 开始拼写。`

#### Case D：没有普通词，但有到期返场词

`完成一轮 → X 个词到了回看时间 → 说明这是返场而不是词表重置 → Enter 开始返场辨识。`

#### Case E：所有词都在等待，当前没有到期词

`完成一轮 → 0 个普通词 + 0 个拼写候选 + 0 个到期词 → 完成页明确说明原因 → 用户结束，或主动自由复习。`

**已对齐：**系统自动给出默认路线，用户保留一个不显眼的改选入口。改选后不清除已经获得的拼写资格。

<a id="decision-d4"></a>

**已确认 D4（实验性）：**不因 1 个候选立即切换阶段，先积累成 3–5 个的小批次。若已经没有其他未稳定词可供累积，则放行最后 1–2 个，避免流程永远停在辨识。真实作业中重点观察：批量感是否更自然，以及拼写验证是否被推迟过久。

<a id="decision-d5"></a>

**已确认 D5：**完成态的 `Enter` 表示结束本次，并停留在完成页；“自由抽查 / 完整复习”作为主动入口，不自动制造额外一轮。

## 七、合格词拼写

### 7.1 每张词的主路径

```mermaid
flowchart LR
    prompt(["显示简明英英释义、词性与中文校准"]) --> type["输入拼写"]
    type --> submit{"Enter 提交首次答案"}
    submit -->|"正确"| correct["记录通过，轻量显示正确拼写"]
    submit -->|"错误"| wrong["记录未通过，显示正确拼写与发音"]
    wrong --> retry["重新正确输入一次"]
    retry --> check{"再次提交是否正确？"}
    check -->|"否"| wrong
    check -->|"是"| corrected["确认已改正，但首次结果仍是未通过"]
    correct --> later["该词进入之后再复习"]
    corrected --> recognition["该词回到继续辨识"]
    later --> more{"本批还有词？"}
    recognition --> more
    more -->|"有"| prompt
    more -->|"没有"| route["完成本批，回到系统分流"]
```

<a id="decision-d6"></a>

**已确认 D6：**首次拼错后必须正确重打一次才能前进，但改正不覆盖首次错误。这既完成了当下的拼写动作，也不污染系统对掌握程度的判断。

### 7.2 中断拼写

```mermaid
flowchart LR
    spelling(["拼写进行中"]) --> esc["Esc 或关闭网页"]
    esc --> save["保存当前题、已提交结果和剩余队列"]
    save --> reopen["再次进入拼写"]
    reopen --> current["回到同一题；未提交的半截输入清空"]
    current --> spelling
```

<a id="decision-d7"></a>

**已确认 D7：**中断代表暂停，不代表放弃这批拼写。保存当前题、已提交结果和剩余队列；恢复时回到同一题，并清空未提交的半截输入。

## 八、返场与词的生命周期

用户只需要理解三个学习阶段；“隐藏”“due round”“同步”等内部字段不进入日常界面。

```mermaid
flowchart LR
    recognition(["继续辨识"]) --> eligible["达到门槛：可以拼写"]
    eligible --> spell{"首次拼写结果"}
    spell -->|"正确"| later["之后再复习"]
    spell -->|"错误"| recognition
    later --> due["到了回看时间"]
    due --> returnRecognition{"返场辨识结果"}
    returnRecognition -->|"没认出"| recognition
    returnRecognition -->|"认出"| returnSpell["进入返场拼写"]
    returnSpell --> result{"返场拼写结果"}
    result -->|"正确"| later
    result -->|"错误"| recognition
```

### 后台调度的可解释边界

```mermaid
flowchart LR
    dueMany(["到期词多于本轮返场容量"]) --> choose["优先选择逾期更久的一部分"]
    choose --> selected["本轮进入返场"]
    choose --> unselected["其余仍保持到期"]
    unselected --> nextRound["下一轮优先出现"]
    selected --> feedback["用户只看到：现在回看 / 之后还会回来"]
    nextRound --> feedback
```

“之后再复习”绝不表示删除；暂时没有词出现时，完成页必须解释其原因。

## 九、移除、撤销、重置与更换

### 9.1 从当前词表移除

```mermaid
flowchart LR
    card(["当前词"]) --> remove["Delete 或工具入口：从本词表移除"]
    remove --> undo["立即显示撤销"]
    undo --> decision{"用户是否撤销？"}
    decision -->|"是"| restore["恢复该词和原学习状态"]
    decision -->|"否"| continue["继续学习；导出中也不再包含该词"]
    continue --> empty{"词表是否已空？"}
    empty -->|"否"| next["下一张或下一阶段"]
    empty -->|"是"| emptyState["进入空词表状态"]
    emptyState --> actions["导入新词表 / 撤销上次移除 / 恢复内置示例"]
```

<a id="decision-d8"></a>

**已确认 D8：**移除即刻执行并提供清晰 Undo，不增加确认弹窗。动作必须叫“从本词表移除”，不能与系统的“之后再复习”混淆。

### 9.2 三种高影响操作

```mermaid
flowchart LR
    tools(["工具层"]) --> action{"选择操作"}
    action -->|"重置学习进度"| resetConfirm["确认：保留词表，只清学习记录"]
    action -->|"恢复内置词表"| builtinConfirm["确认：替换当前词表和进度"]
    action -->|"导入新词表"| importFlow["解析成功后直接替换"]
    resetConfirm -->|"确认"| firstRound["当前词表第一轮辨识"]
    builtinConfirm -->|"确认"| builtin["内置词表第一轮辨识"]
    importFlow --> imported["新词表第一轮辨识，并提供 Undo"]
    resetConfirm -->|"取消"| same["回到原状态"]
    builtinConfirm -->|"取消"| same
```

## 十、理解帮助、设置与静默模式

### 10.1 理解帮助

`当前词 → 用户卡住 → 按需打开发音、例句、词源、对应概念或深度理解 → 得到帮助或复制提示词 → 回到同一张、同一阶段。`

当前 3.0 的释义顺序：

`翻开 → 足够简单的英英释义 → 中文快速定位和校准 → 按需例句与理解层。`

未来图片实验：

`翻开 → 若该词有可靠核心画面，则先感知画面 → 简明英英释义 → 中文校准。`

若图片缺失、不可靠或词过于抽象：

`图片路径失败 → 自动回到英英释义优先 → 不阻断学习。`

图片是未来实验，不进入 3.0 初始版本的必经 User Flow。

### 10.2 工具层

```mermaid
flowchart LR
    study(["当前学习状态"]) --> open["用户主动打开工具层"]
    open --> choice{"需要什么？"}
    choice -->|"词表"| deck["导入、保存副本、导出、更换"]
    choice -->|"偏好"| settings["发音、洗牌、理解内容显示、亮暗外观"]
    choice -->|"学习状态"| progress["查看熟悉词和整体状态"]
    choice -->|"说明"| guide["简短 Guidebook"]
    deck --> close["关闭工具层"]
    settings --> close
    progress --> close
    guide --> close
    close --> study
```

关闭工具层后回到原词、原阶段、原显隐状态；普通设置不重启一轮。

### 10.3 静默模式

```mermaid
flowchart LR
    normal(["正常界面"]) --> trigger{"开始连续键盘操作或指针静止"}
    trigger -->|"是"| quiet["标题、入口和管理控件降低视觉权重"]
    quiet --> restore{"恢复条件出现？"}
    restore -->|"指针移动、Tab、Esc 或触摸工具区"| normal
    restore -->|"没有"| quiet
```

静默模式只改变注意力，不移动主卡，不让功能失去键盘可达性。

## 十一、异常、空状态与能力降级

| 触发状态 | 流程 | 稳定结果 |
| --- | --- | --- |
| 导入解析失败 | 选择内容 → 无法识别 → 指出具体问题 → 修正或换入口 | 当前词表与进度不变 |
| 导入后反悔 | 新词表解析成功并直接替换 → 点击 Undo | 恢复替换前的词表与学习进度 |
| 本地记录损坏 | 打开 → 无法安全恢复 → 说明记录不可用 → 准备词表或载入内置示例 | 应用仍可进入，不崩溃 |
| 发音不可用 | 请求发音 → 浏览器不支持 → 给出简短不可用说明 | 学习主链继续 |
| 剪贴板复制失败 | 复制单词或提示词 → 失败 → 显示可手动复制的内容 | 当前卡不变 |
| 所有词在等待返场 | 系统发现当前无普通词和到期词 → 明确完成页 | 不出现空白卡或顶部小字 |
| 到期词过多 | 只抽取本轮容量 → 其余继续保持到期 | 下一轮优先出现 |
| 移除最后一词 | 词表变空 → 空词表主状态 | 可撤销、导入或恢复示例 |
| 中断后重开 | 读取保存状态 → 恢复阶段 | 辨识答案收起；拼写半截输入清空 |

## 十二、完整状态清单

后续低保真稿至少需要覆盖以下 16 个状态，才算把 User Flow 画完整：

1. 无词表的准备页；
2. 导入解析失败；
3. 导入成功预览；
4. 新词表替换完成反馈与撤销；
5. 辨识未翻；
6. 辨识已翻；
7. 辨识已翻并打开理解层；
8. 轮末推荐继续辨识；
9. 轮末推荐开始拼写；
10. 轮末进入返场；
11. 当前无到期词的明确完成态；
12. 拼写输入；
13. 拼写正确；
14. 拼写错误并重打；
15. 工具层；
16. 空词表并可撤销。

<a id="decision-summary"></a>

## 十三、决策总表

| 编号 | 决策 | 已选路径 | 状态 |
| --- | --- | --- | --- |
| [D1](#decision-d1) | 没有用户词表时的首屏 | 等低保真 A/B 首屏出来后再决定 | 待确认 |
| [D2](#decision-d2) | 导入新词表 | 解析成功即替换，事后可 Undo | 已确认 A |
| [D3](#decision-d3) | 拼写资格 | 两个不同轮次辨识正确 | 已确认 B，实验性 |
| [D4](#decision-d4) | 拼写候选批量 | 积累成 3–5 个；尾批 1–2 个可放行 | 已确认 B，实验性 |
| [D5](#decision-d5) | 当前无待办时 `Enter` | 结束本次并停留完成态 | 已确认 A |
| [D6](#decision-d6) | 拼写首次错误 | 正确重打一次再前进 | 已确认 B |
| [D7](#decision-d7) | `Esc` 或关闭时 | 暂停并保存当前拼写批次 | 已确认 B |
| [D8](#decision-d8) | Remove | 立即移除并提供 Undo | 已确认 B |

D2–D8 已经成为后续低保真设计的逻辑基线；D3、D4 需等下一份真实作业进行验证。D1 必须先看到两种首屏的实际低保真效果再决定，不阻塞其他状态设计。

## 十四、逻辑验收标准

User Flow 对齐完成的标准不是流程图“看起来完整”，而是以下问题都能得到唯一、可解释的答案：

- 第一次打开、再次打开和中断恢复分别去哪；
- 文件、粘贴和 AI 生成的词表如何进入同一主循环；
- 翻开答案与“我认出来了”如何区分；
- 哪些词进入拼写，为什么进入；
- 拼写正确、错误和改正后分别去哪；
- 所有词暂时不出现时，用户看到什么、下一步是什么；
- 移除、暂缓、重置和替换有什么不同；
- 任意状态下按主动作会发生什么；
- 用户卡住、改变主意或被迫中断时如何回到主流程；
- 图片实验失败时，核心学习闭环仍能独立成立。

## 附录：来源与可编辑图

- [闪词 3.0 重构设计底稿](flashvocab-3-design-brief.md)
- [产品设计方法核心图](user-flow-sources/general-concept-graph.png)
- [闪词产品逻辑核心图](user-flow-sources/flashvocab2-logic.png)
- [可编辑 FigJam：闪词 3.0 完整 User Flow](https://www.figma.com/board/opENWBAXDlHYoPrVyzZQMM)

FigJam 内包含此前的总体流程与五张分图；本轮批注只更新文字逻辑，FigJam 暂未同步。Markdown 文档是当前有效版本，D1 确认并进入下一轮图形设计时再统一更新流程图。
