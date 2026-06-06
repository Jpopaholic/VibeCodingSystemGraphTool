import React, { useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';

export default function AIBox() {
  // Keyboard shortcut: Ctrl+Shift+I to open Init Prompt
  React.useEffect(() => {
    const handler = async (e) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i')) {
        e.preventDefault();
        const goal = await showPrompt(t('askGoalPrompt'), language === 'en' ? 'e.g. A Markdown editor with local save and PDF export' : '例如：做一個結合 IndexedDB 存檔的 Markdown 編輯器，且能匯出 PDF');
        if (goal) copyToClipboard(getBootstrapPrompt(goal));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const { 
    nodes,
    glossary, 
    updateGlossary, 
    globalConstraints, 
    updateGlobalConstraints,
    language,
    setLanguage,
    t,
    showPrompt,
    importGraphJSON
  } = useWorkspace();

  const [newKey, setNewKey] = useState('');
  const [newDef, setNewDef] = useState('');
  const [editingKey, setEditingKey] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [newConstraint, setNewConstraint] = useState('');

  // 1. Language-aware Bootstrap Prompt templates
  const getBootstrapPrompt = (goal) => language === 'en'
    ? `Please act as a software architecture expert, analyzing my system vision described below. 
I want to create a \`system-graph.json\` file in my project root directory. This file is our contract for co-development.
Please plan three sections and output in raw JSON format (no markdown code blocks, just raw JSON text):

1. "glossary": { "Term": "definition and data structure model description" }, extracting key business entities.
2. "globalConstraints": [ "global system constraints (e.g. tech stack, layout style)" ].
3. "nodes": [
     {
       "id": "unique-english-id (e.g., auth-helper)",
       "name": "Component Name",
       "produce": "What does this produce? starting with active verb (e.g. stores sessions locally)",
       "vibeNotes": "Supplementary developer memos for this node",
       "dependencies": [ "array of dependent node ids" ],
       "synthesis": {
         "filePath": "recommended file path (e.g., src/utils/auth.js)",
         "status": "todo",
         "intentSignal": "distilled clean core implementation goal",
         "extractedConstraints": [ "distilled technical constraints from notes (e.g., no external packages)" ],
         "userOverridden": false
       },
       "trace": { "stale": false, "lastImplementedPrompt": "" }
     }
   ]

The JSON must strictly follow this schema. Any missing fields will cause import errors.

My system vision is:
${goal}`
    : `請作為軟體架構規劃專家，分析我接下來要建造的系統想法。
我希望在專案根目錄下建立一個 \`system-graph.json\` 檔案。這個檔案是我們協同開發的唯一契約。
請為我規劃以下三個部分，並輸出為純 JSON 格式（不要包含任何 markdown 標記或 \`\`\`json 區塊，直接輸出 JSON 內容）：

1. "glossary": { "名詞": "定義與資料結構模型說明" }，提取系統的核心業務實體名詞。
2. "globalConstraints": [ "全域系統約束條件（如技術棧、排版風格）" ]。
3. "nodes": [
     {
       "id": "唯一的英文識別碼（例如 auth-helper）",
       "name": "中文組件名稱",
       "produce": "以主動動詞說明它產出什麼成果（例如 stores sessions locally）",
       "vibeNotes": "該組件的補充說明備忘",
       "dependencies": [ "依賴的其他 node id 陣列" ],
       "synthesis": {
         "filePath": "建議的實體檔案存放路徑（例如 src/utils/auth.js）",
         "status": "todo",
         "intentSignal": "精煉後的乾淨核心實作目的",
         "extractedConstraints": [ "從說明中提煉出的具體技術規範（如不能用第三方庫）" ]
       },
       "trace": { "stale": false, "lastImplementedPrompt": "" }
     }
   ]

我的系統功能願景是：
`;

  // 2. Language-aware Sync Prompt templates
  const syncPrompt = language === 'en'
    ? `Please scan our existing codebase and the existing \`system-graph.json\` (if any).
Please perform the following sync and organization task, and output the updated \`system-graph.json\` JSON content:

1. Scan files in the workspace, map them to nodes, and automatically append new nodes if new files are found.
2. Read the developer's \`vibeNotes\` in each node, acting as the AI preprocessor:
   - Filter out conversational noise and chatter.
   - Distill the core \`synthesis.intentSignal\`.
   - Extract structured technical constraints into \`synthesis.extractedConstraints\`.
   - **Important**: If the node has \`synthesis.userOverridden\` set to true, do **NOT** modify its \`synthesis\` content!
3. Analyze call imports in the codebase, and update node \`dependencies\` automatically.
4. Extract domain terms from code and append them to \`glossary\`.

Please output the raw JSON text directly (no markdown packaging, just pure JSON).`
    : `請掃描我們專案中現有的程式碼結構、檔案檔案以及已存在的 \`system-graph.json\`（若有）。
請執行以下同步與整理任務，並為我輸出完整的、更新後的 \`system-graph.json\` JSON 內容：

1. 檢查目前專案中的實體檔案，將它們與 nodes 進行對應，若有新增的檔案或模組，自動在 nodes 中新增節點。
2. 讀取使用者在各個節點中寫下的隨筆 \`vibeNotes\`，發揮 AI 整理官的角色：
   - 過濾掉口語與發散的噪音。
   - 提取出乾淨精煉的 \`synthesis.intentSignal\`。
   - 提煉出條理化的技術約束，寫入 \`synthesis.extractedConstraints\`。
   - **重要**：如果該節點的 \`synthesis.userOverridden\` 為 true，則**絕對不要**修改該節點的 \`synthesis\` 內容！
3. 分析目前的程式碼調用關係，自動更新節點間的 \`dependencies\`。
4. 提取出程式碼中的關鍵名詞，補全並更新 \`glossary\` 定義。

請直接輸出完整的 JSON 字串內容（不要 markdown 包裝，直接純 JSON）。`;

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    const notification = document.createElement('div');
    notification.innerText = t('copiedClipboard');
    notification.style.position = 'fixed';
    notification.style.bottom = '20px';
    notification.style.left = '50%';
    notification.style.transform = 'translateX(-50%)';
    notification.style.background = '#10b981';
    notification.style.color = '#fff';
    notification.style.padding = '8px 16px';
    notification.style.borderRadius = '4px';
    notification.style.fontSize = '0.8rem';
    notification.style.zIndex = '999';
    notification.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
    document.body.appendChild(notification);
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 2000);
  };

  const handleAddGlossary = (e) => {
    e.preventDefault();
    if (!newKey.trim() || !newDef.trim()) return;
    const updated = { ...glossary, [newKey.trim()]: newDef.trim() };
    updateGlossary(updated);
    setNewKey('');
    setNewDef('');
  };

  const handleRemoveGlossary = (key) => {
    const updated = { ...glossary };
    delete updated[key];
    updateGlossary(updated);
  };

  const handleStartEdit = (key, val) => {
    setEditingKey(key);
    setEditValue(val);
  };

  const handleSaveEdit = (key) => {
    if (editValue.trim() !== '') {
      const updated = { ...glossary, [key]: editValue.trim() };
      updateGlossary(updated);
    }
    setEditingKey(null);
  };

  const handleAddConstraint = (e) => {
    e.preventDefault();
    if (!newConstraint.trim()) return;
    updateGlobalConstraints([...globalConstraints, newConstraint.trim()]);
    setNewConstraint('');
  };

  const handleRemoveConstraint = (index) => {
    const updated = globalConstraints.filter((_, i) => i !== index);
    updateGlobalConstraints(updated);
  };

  return (
    <div className="side-panel">
      {/* Header with Language Selector */}
      <div className="panel-header">
        <div className="panel-title">
          <span>{t('panelTitle')}</span>
        </div>
        <select 
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          style={{
            background: 'rgba(0, 0, 0, 0.35)',
            border: '1px solid var(--panel-border)',
            color: 'var(--text-main)',
            borderRadius: '4px',
            fontSize: '0.72rem',
            padding: '2px 6px',
            outline: 'none',
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
            fontWeight: '500'
          }}
        >
          <option value="zh-TW">繁中</option>
          <option value="en">EN</option>
        </select>
      </div>

      <div className="panel-content">
        {/* AI Toolkit */}
        <div className="glossary-section" style={{ borderBottom: '1px solid var(--panel-border)', paddingBottom: '20px' }}>
          <div className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#c084fc' }}>
            <span>{t('aiToolkitTitle')}</span>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '12px', lineHeight: '1.4' }}>
            {t('aiToolkitDesc')}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {nodes && nodes.length > 0 ? (
              <>
                {/* Primary Sync Button */}
                <button 
                  className="btn" 
                  style={{ fontSize: '0.78rem', padding: '10px 14px', background: 'linear-gradient(135deg, #059669, #0d9488)' }}
                  onClick={() => copyToClipboard(syncPrompt)}
                >
                  {t('btnSyncPrompt')}
                </button>
                {/* Import / Paste Graph JSON Button */}
                <button 
                  className="btn" 
                  style={{ 
                    fontSize: '0.75rem', 
                    padding: '8px 14px', 
                    background: 'rgba(16, 185, 129, 0.08)', 
                    border: '1px solid rgba(16, 185, 129, 0.3)', 
                    color: '#10b981',
                    boxShadow: 'none' 
                  }}
                  onClick={async () => {
                    const json = await showPrompt(t('pasteJsonPrompt'), '', true);
                    if (json) {
                      await importGraphJSON(json);
                    }
                  }}
                >
                  {t('importGraphBtn')}
                </button>
                {/* Secondary Warning Bootstrap Button */}
                <button 
                  className="btn" 
                  style={{ 
                    fontSize: '0.75rem', 
                    padding: '8px 14px', 
                    background: 'rgba(255,255,255,0.03)', 
                    border: '1px dashed rgba(168, 85, 247, 0.4)', 
                    color: '#c084fc',
                    boxShadow: 'none' 
                  }}
                  onClick={async () => {
                    const goal = await showPrompt(t('askGoalPrompt'), language === 'en' ? 'e.g. A Markdown editor with local save and PDF export' : '例如：做一個結合 IndexedDB 存檔 dung Markdown 編輯器，且能匯出 PDF');
                    if (goal) copyToClipboard(getBootstrapPrompt(goal));
                  }}
                >
                  {language === 'en' ? '⚠️ Re-bootstrap Project...' : '⚠️ 重新全新建圖...'}
                </button>
              </>
            ) : (
              <>
                {/* Primary Bootstrap Button */}
                <button 
                  className="btn" 
                  style={{ fontSize: '0.78rem', padding: '10px 14px', background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}
                  onClick={async () => {
                    const goal = await showPrompt(t('askGoalPrompt'), language === 'en' ? 'e.g. A Markdown editor with local save and PDF export' : '例如：做一個結合 IndexedDB 存檔的 Markdown 編輯器，且能匯出 PDF');
                    if (goal) copyToClipboard(getBootstrapPrompt(goal));
                  }}
                >
                  {t('btnInitPrompt')} (Ctrl+Shift+I)
                </button>
                {/* Secondary Sync Button */}
                <button 
                  className="btn" 
                  style={{ 
                    fontSize: '0.75rem', 
                    padding: '8px 14px', 
                    background: 'rgba(255,255,255,0.03)', 
                    border: '1px dashed rgba(255,255,255,0.1)', 
                    color: 'var(--text-muted)',
                    boxShadow: 'none' 
                  }}
                  onClick={() => copyToClipboard(syncPrompt)}
                >
                  {t('btnSyncPrompt')}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Global Constraints */}
        <div className="glossary-section" style={{ borderBottom: '1px solid var(--panel-border)', paddingBottom: '20px', marginTop: '20px' }}>
          <div className="form-label">{t('globalConstraintsTitle')}</div>
          <div className="glossary-list" style={{ marginBottom: '12px' }}>
            {globalConstraints.map((constraint, idx) => (
              <div 
                key={idx} 
                className="glossary-item"
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px' }}
              >
                <span style={{ fontSize: '0.8rem', color: 'var(--text-main)' }}>• {constraint}</span>
                <button 
                  onClick={() => handleRemoveConstraint(idx)}
                  style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.9rem' }}
                  title="Delete"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <form onSubmit={handleAddConstraint} style={{ display: 'flex', gap: '6px' }}>
            <input 
              type="text" 
              className="form-input" 
              placeholder={t('addConstraintPlaceholder')}
              style={{ fontSize: '0.8rem', padding: '6px 10px' }}
              value={newConstraint}
              onChange={(e) => setNewConstraint(e.target.value)}
            />
            <button type="submit" className="btn" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>+</button>
          </form>
        </div>

        {/* Glossary Editor */}
        <div className="glossary-section" style={{ marginTop: '20px' }}>
          <div className="form-label">{t('glossaryTitle')}</div>
          <div className="glossary-list" style={{ marginBottom: '16px' }}>
            {Object.keys(glossary).length === 0 ? (
              <p style={{ fontSize: '0.75rem', color: 'var(--text-dark)', fontStyle: 'italic' }}>
                {t('noGlossary')}
              </p>
            ) : (
              Object.entries(glossary).map(([key, def]) => (
                <div key={key} className="glossary-item" style={{ position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span className="glossary-key">{key}</span>
                    <button 
                      onClick={() => handleRemoveGlossary(key)}
                      style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)', cursor: 'pointer', fontSize: '0.75rem' }}
                      title="Delete"
                    >
                      ✕
                    </button>
                  </div>
                  {editingKey === key ? (
                    <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                      <input 
                        type="text" 
                        className="form-input" 
                        style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => handleSaveEdit(key)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(key); }}
                        autoFocus
                      />
                    </div>
                  ) : (
                    <div 
                      className="glossary-def" 
                      style={{ cursor: 'pointer' }}
                      title={t('inlineEditHint')}
                      onClick={() => handleStartEdit(key, def)}
                    >
                      {def}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Add Glossary Form */}
          <form onSubmit={handleAddGlossary} style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(0,0,0,0.15)', padding: '12px', borderRadius: '8px', border: '1px dashed var(--panel-border)' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>{t('addGlossaryTitle')}</span>
            <input 
              type="text" 
              className="form-input" 
              placeholder={t('glossaryKeyPlaceholder')}
              style={{ fontSize: '0.8rem', padding: '6px 10px' }}
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
            />
            <input 
              type="text" 
              className="form-input" 
              placeholder={t('glossaryDefPlaceholder')}
              style={{ fontSize: '0.8rem', padding: '6px 10px' }}
              value={newDef}
              onChange={(e) => setNewDef(e.target.value)}
            />
            <button type="submit" className="btn" style={{ padding: '6px 12px', fontSize: '0.8rem', width: '100%' }}>
              {t('btnAddGlossary')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
