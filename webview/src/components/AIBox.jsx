import React, { useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';

export default function AIBox() {
  // Keyboard shortcut: Ctrl+Shift+I to open Init Prompt
  React.useEffect(() => {
    const handler = async (e) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i')) {
        e.preventDefault();
        const result = await showPrompt(t('askGoalPrompt'), language === 'en' ? 'e.g. A Markdown editor with local save and PDF export' : '例如：做一個結合 IndexedDB 存檔的 Markdown 編輯器，且能匯出 PDF', false, true);
        if (result) {
          const goal = typeof result === 'string' ? result : result.text;
          const images = typeof result === 'string' ? [] : result.images;
          copyToClipboard(getBootstrapPrompt(goal, images));
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const { 
    isVsCode,
    isIntelliJ,
    nodes,
    glossary, 
    updateGlossary, 
    globalConstraints, 
    updateGlobalConstraints,
    language,
    setLanguage,
    t,
    showPrompt,
    importGraphJSON,
    exportGraphJSON
  } = useWorkspace();

  const [newKey, setNewKey] = useState('');
  const [newDef, setNewDef] = useState('');
  const [editingKey, setEditingKey] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [newConstraint, setNewConstraint] = useState('');
  const [constraintImages, setConstraintImages] = useState([]);

  // 1. Language-aware Bootstrap Prompt templates
  const getBootstrapPrompt = (goal, images = []) => {
    let prompt = language === 'en'
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
請為我規劃以下三個部分，並輸出為純 JSON 格式（不要包含 any markdown 標記或 \`\`\`json 區塊，直接輸出 JSON 內容）：

1. "glossary": { "名詞": "定義與資料結構模型說明" }，提取系統的核心業務實體名詞。
2. "globalConstraints": [ "全域系統約束條件（如技術棧、排版風格）" ]。
3. "nodes": [
     {
       "id": "唯一的英文識別碼（例如 auth-helper）",
       "name": "中文組件名稱",
       "produce": "以主動動詞說明它產出什麼成果（使用繁體中文，例如「在本地儲存會話」）",
       "vibeNotes": "該組件的補充說明備忘",
       "dependencies": [ "依賴的其他 node id 陣列" ],
       "synthesis": {
         "filePath": "建議的實體檔案存放路徑（例如 src/utils/auth.js）",
         "status": "todo",
         "intentSignal": "精煉後的乾淨核心實作目的（使用繁體中文）",
         "extractedConstraints": [ "從說明中提煉出的具體技術規範（如不能用第三方庫）" ]
       },
       "trace": { "stale": false, "lastImplementedPrompt": "" }
     }
   ]

*重要指示*：請務必使用繁體中文填寫所有 nodes 中的 name、produce、vibeNotes、synthesis.intentSignal 等屬性，以及 glossary 的說明內容。

我的系統功能願景是：
${goal}`;

    if (images && images.length > 0) {
      prompt += language === 'en'
        ? `\n\n## 🎨 Visual References for System Graph\nThis vision contains the following reference mockups. Please inspect them and create initial nodes with these images stored in vibeImage/vibeImages:\n`
        : `\n\n## 🎨 系統視覺畫面參考\n此願景包含以下參考畫面。請詳細參考這些圖片，並將其規劃至初始節點的 vibeImage/vibeImages 屬性中：\n`;
      images.forEach((img, idx) => {
        prompt += `\nImage ${idx + 1}:\n${img}\n`;
      });
    }
    return prompt;
  };

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

*重要指示*：在同步、整理或新增節點與名詞時，請務必使用繁體中文填寫所有的 name、produce、vibeNotes、synthesis.intentSignal 等屬性，以及 glossary 的說明內容。

請直接輸出完整的 JSON 字串內容（不要 markdown 包裝，直接純 JSON）。`;

  // 3. Language-aware Add Feature Prompt template generator
  const getAddFeaturePrompt = (feature, images = []) => {
    const currentGraphJSON = JSON.stringify({
      glossary: glossary || {},
      globalConstraints: globalConstraints || [],
      nodes: nodes || []
    }, null, 2);

    let prompt = language === 'en'
      ? `Please act as a software architecture expert. We want to "add a new feature" to our existing system. Please help design and plan the changes, and output the updated and complete \`system-graph.json\` JSON content.

Our current system graph contract (\`system-graph.json\`) is:
\`\`\`json
${currentGraphJSON}
\`\`\`

The new feature description we want to add is:
"${feature}"

Please perform the following tasks:
1. Assess the impact of the new feature on the existing architecture.
2. If necessary, create new component nodes (nodes) specifying \`id\`, \`name\`, \`produce\`, \`vibeNotes\`, and design their \`synthesis\` (\`filePath\`, \`intentSignal\`, and \`extractedConstraints\`).
3. Set or update the relationships and dependencies between nodes (\`dependencies\`).
4. Append any new business terms or schemas to the \`glossary\`.
5. Keep existing unrelated nodes intact.

Please output the raw JSON text directly (no markdown packaging, just pure JSON).`
      : `請作為軟體架構規劃專家。我們要在現有的系統中「新增一個新功能」，請協助設計與規劃，並為我輸出更新後的完整 \`system-graph.json\` JSON 內容。

我們現有的系統架構契約 (\`system-graph.json\`) 如下：
\`\`\`json
${currentGraphJSON}
\`\`\`

使用者想要新增的功能描述為：
「${feature}」

請執行以下規劃任務：
1. 評估該功能對現有架構的影響。
2. 如果需要，請新增組件節點（nodes），設定其 \`id\`、\`name\`、\`produce\`、\`vibeNotes\`，並規劃合適的 \`synthesis\`（路徑 \`filePath\`、意圖 \`intentSignal\` 與 \`extractedConstraints\`）。
3. 建立或更新節點之間的依賴關係（\`dependencies\`）。
4. 在 \`glossary\` 中加入新增功能涉及的核心名詞與資料結構。
5. 保持現有與此功能無關的節點不變。

*重要指示*：在新增節點或名詞時，請務必使用繁體中文填寫所有的 name、produce、vibeNotes、synthesis.intentSignal 等屬性，以及 glossary 的說明內容。

請直接輸出完整且有效的 \`system-graph.json\` 純 JSON 內容（不要使用 markdown 區塊包裹，直接輸出 JSON 內容）。`;

    if (images && images.length > 0) {
      prompt += language === 'en'
        ? `\n\n## 🎨 Visual References for the New Feature\nThis feature contains the following reference mockups. Please inspect these images and incorporate them into the design. For any new nodes, you can store these images under their vibeImage/vibeImages property:\n`
        : `\n\n## 🎨 新增功能畫面參考\n此功能包含以下參考畫面。請詳細參考這些圖片的排版、設計風格，並將其規劃至新增節點的 vibeImage/vibeImages 屬性中：\n`;
      images.forEach((img, idx) => {
        prompt += `\nImage ${idx + 1}:\n${img}\n`;
      });
    }
    return prompt;
  };

  // 4. Language-aware Modify Feature Prompt template generator
  const getModifyFeaturePrompt = (detail, images = []) => {
    const currentGraphJSON = JSON.stringify({
      glossary: glossary || {},
      globalConstraints: globalConstraints || [],
      nodes: nodes || []
    }, null, 2);

    let prompt = language === 'en'
      ? `Please act as a software architecture expert. We want to "modify a feature or node" in our existing system. Please help design and plan the changes, and output the updated and complete \`system-graph.json\` JSON content.

Our current system graph contract (\`system-graph.json\`) is:
\`\`\`json
${currentGraphJSON}
\`\`\`

The modifications requested by the user are:
"${detail}"

Please perform the following tasks:
1. Assess which nodes, dependencies, vibeNotes, synthesis settings, or glossary entries need to be updated.
2. Modify the target component nodes. Update their \`produce\`, \`vibeNotes\`, or \`synthesis\` fields as required.
3. Update relationships/dependencies between nodes if needed.
4. Keep all other unrelated nodes and definitions intact.

Please output the raw JSON text directly (no markdown packaging, just pure JSON).`
      : `請作為軟體架構規劃專家。我們要在現有的系統中「修改特定功能或組件」，請協助設計與變更規劃，並為我輸出更新後的完整 \`system-graph.json\` JSON 內容。

我們現有的系統架構契約 (\`system-graph.json\`) 如下：
\`\`\`json
${currentGraphJSON}
\`\`\`

使用者想要的修改細節描述為：
「${detail}」

請執行以下規劃任務：
1. 評估該修改對哪些現有節點、依賴關係、Vibe Notes、Synthesis 設定或業務名詞有影響。
2. 進行目標節點的修改。更新其 \`produce\`（產出描述）、\`vibeNotes\` 或 \`synthesis\`（意圖與技術約束）等欄位。
3. 如果需要，調整節點之間的相依依賴線（\`dependencies\`）。
4. 保持其餘與此修改無關的節點、全局約束與業務名詞定義不變。

*重要指示*：在修改任何欄位、節點或名詞時，請務必使用繁體中文填寫所有的 name、produce、vibeNotes、synthesis.intentSignal 等屬性，以及 glossary 的說明內容。

請直接輸出完整且有效的 \`system-graph.json\` 純 JSON 內容（不要使用 markdown 區塊包裹，直接輸出 JSON 內容）。`;

    if (images && images.length > 0) {
      prompt += language === 'en'
        ? `\n\n## 🎨 Visual References for Modifications\nThis modification request contains the following reference mockups. Please inspect them and update the system design accordingly:\n`
        : `\n\n## 🎨 修改功能畫面參考\n此修改包含以下參考畫面。請詳細參考這些圖片以更新系統設計：\n`;
      images.forEach((img, idx) => {
        prompt += `\nImage ${idx + 1}:\n${img}\n`;
      });
    }
    return prompt;
  };

  // 5. Language-aware Remove Feature Prompt template generator
  const getRemoveFeaturePrompt = (target) => {
    const currentGraphJSON = JSON.stringify({
      glossary: glossary || {},
      globalConstraints: globalConstraints || [],
      nodes: nodes || []
    }, null, 2);

    return language === 'en'
      ? `Please act as a software architecture expert. We want to "remove/delete a feature or node" from our existing system. Please help design the clean-up process, and output the updated and complete \`system-graph.json\` JSON content.

Our current system graph contract (\`system-graph.json\`) is:
\`\`\`json
${currentGraphJSON}
\`\`\`

The component or feature target we want to remove is:
"${target}"

Please perform the following tasks:
1. Identify the target component node(s) to be removed.
2. Safely delete those nodes from the \`nodes\` list.
3. Crucially, clean up all dependency relationships! Cascade-remove the deleted node IDs from the \`dependencies\` arrays of all other remaining nodes.
4. If there are glossary terms or global constraints that were solely associated with the removed feature, clean them up as well.
5. Keep other unrelated nodes intact.

Please output the raw JSON text directly (no markdown packaging, just pure JSON).`
      : `請作為軟體架構規劃專家。我們希望從現有系統中「安全地移除某個功能或組件節點」，請協助進行清理規劃，並為我輸出更新後的完整 \`system-graph.json\` JSON 內容。

我們現有的系統架構契約 (\`system-graph.json\`) 如下：
\`\`\`json
${currentGraphJSON}
\`\`\`

使用者想要移除的組件節點或功能為：
「${target}」

請執行以下規劃任務：
1. 確認需要被移除的目標節點。
2. 從 \`nodes\` 列表中將該節點安全地刪除。
3. **重要：清理所有依賴關係線！** 檢查其餘所有留下來的節點，若其 \`dependencies\` 陣列中有包含已刪除節點的 ID，請將其一併清除，以防架構產生懸空參考（dangling dependencies）。
4. 若有僅與該已刪除功能相關的業務名詞（glossary）或全局約束，可一併進行清理。
5. 保持其餘與此移除無關的節點與定義不變。

請直接輸出完整且有效的 \`system-graph.json\` 純 JSON 內容（不要使用 markdown 區塊包裹，直接輸出 JSON 內容）。`;
  };

  // 6. Language-aware Refactor Architecture Prompt template generator
  const getRefactorArchitecturePrompt = (goal, images = []) => {
    const currentGraphJSON = JSON.stringify({
      glossary: glossary || {},
      globalConstraints: globalConstraints || [],
      nodes: nodes || []
    }, null, 2);

    let prompt = language === 'en'
      ? `Please act as a software architecture expert. We want to "refactor the system architecture" to optimize its structure. Please help plan the refactoring, and output the updated and complete \`system-graph.json\` JSON content.

Our current system graph contract (\`system-graph.json\`) is:
\`\`\`json
${currentGraphJSON}
\`\`\`

The refactoring goals are:
"${goal}"

Please perform the following tasks:
1. Re-design the system components to achieve better modularity, separation of concerns, or simpler data flow as requested.
2. You may merge redundant nodes, split large nodes into smaller, more focused cohesive modules, or rename IDs and file paths.
3. Clean up and rebuild the dependency tree (\`dependencies\`) between nodes based on the new architecture.
4. Update the \`glossary\` and \`globalConstraints\` to reflect the refactored design.
5. Ensure all existing feature goals (produce expectations) are still fully covered by the new node list.

Please output the raw JSON text directly (no markdown packaging, just pure JSON).`
      : `請作為軟體架構規劃專家。我們希望對現有系統進行「架構重構與優化」，請協助進行重構設計規劃，並為我輸出更新後的完整 \`system-graph.json\` JSON 內容。

我們現有的系統架構契約 (\`system-graph.json\`) 如下：
\`\`\`json
${currentGraphJSON}
\`\`\`

重構目標與細節描述為：
「${goal}」

請執行以下規劃任務：
1. 依據重構目標重新編排、設計系統組件，以實現更好的模組化、單一職責或更清晰的資料流向。
2. 您可以合併冗餘的節點、拆分過於龐大複雜的節點、或更正節點識別碼（ID）與實體檔案路徑（filePath）。
3. 根據重構後的設計，清理並重建所有節點間的依賴相依樹（\`dependencies樹\`）。
4. 更新名詞定義表（\`glossary\`）與全局約束（\`globalConstraints\`）以符合新的架構設計。
5. 確保所有既有功能的產出預期（produce）在新架構中依然被完整覆蓋。

*重要指示*：在重構、調整或新增組件時，請務必使用繁體中文填寫所有的 name、produce、vibeNotes、synthesis.intentSignal 等屬性，以及 glossary 的說明內容。

請直接輸出完整且有效的 \`system-graph.json\` 純 JSON 內容（不要使用 markdown 區塊包裹，直接輸出 JSON 內容）。`;

    if (images && images.length > 0) {
      prompt += language === 'en'
        ? `\n\n## 🎨 Visual References for Refactoring\nThis refactoring request contains the following reference mockups. Please inspect them and optimize the architecture accordingly:\n`
        : `\n\n## 🎨 重構畫面參考\n此重構包含以下參考畫面。請詳細參考這些圖片以優化系統架構設計：\n`;
      images.forEach((img, idx) => {
        prompt += `\nImage ${idx + 1}:\n${img}\n`;
      });
    }
    return prompt;
  };

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

  const handleConstraintImagesUpload = (files) => {
    const validFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (validFiles.length === 0) return;

    if (constraintImages.length + validFiles.length > 5) {
      alert(t('maxImagesLimitAlert'));
      return;
    }

    let processedCount = 0;
    const newImages = [];

    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const rawBase64 = e.target.result;
        const img = new Image();
        img.src = rawBase64;
        img.onload = () => {
          const maxWidth = 800;
          const maxHeight = 800;
          let width = img.width;
          let height = img.height;
          
          if (width > maxWidth || height > maxHeight) {
            if (width > height) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            } else {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }
          
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);
          newImages.push(compressedBase64);
          processedCount++;

          if (processedCount === validFiles.length) {
            setConstraintImages(prev => [...prev, ...newImages].slice(0, 5));
          }
        };
      };
      reader.readAsDataURL(file);
    });
  };

  const handleAddConstraint = (e) => {
    e.preventDefault();
    if (!newConstraint.trim()) return;
    const value = constraintImages.length > 0 
      ? { text: newConstraint.trim(), vibeImages: constraintImages }
      : newConstraint.trim();
    updateGlobalConstraints([...globalConstraints, value]);
    setNewConstraint('');
    setConstraintImages([]);
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
          <span style={{
            fontSize: '0.65rem',
            padding: '2px 6px',
            borderRadius: '4px',
            fontWeight: '600',
            marginLeft: '8px',
            background: isVsCode ? 'rgba(16, 185, 129, 0.15)' : 'rgba(147, 51, 234, 0.15)',
            color: isVsCode ? '#34d399' : '#d8b4fe',
            border: isVsCode ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(147, 51, 234, 0.3)',
            display: 'inline-block',
            verticalAlign: 'middle'
          }}>
            {isIntelliJ ? 'Android Studio' : (isVsCode ? 'VS Code' : 'Web App')}
          </span>
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
                {/* Add New Feature Prompt Button */}
                <button 
                  className="btn" 
                  style={{ 
                    fontSize: '0.78rem', 
                    padding: '10px 14px', 
                    background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' 
                  }}
                  onClick={async () => {
                    const result = await showPrompt(
                      language === 'en' ? 'Describe the new feature to add:' : '請描述要新增的新功能：',
                      language === 'en' ? 'e.g. Add user comments to each note' : '例如：在每篇筆記下方加入使用者評論',
                      false,
                      true
                    );
                    if (result) {
                      const feature = typeof result === 'string' ? result : result.text;
                      const images = typeof result === 'string' ? [] : result.images;
                      copyToClipboard(getAddFeaturePrompt(feature, images));
                    }
                  }}
                >
                  {t('btnNewFeaturePrompt')}
                </button>
                {/* Modify Feature Prompt Button */}
                <button 
                  className="btn" 
                  style={{ 
                    fontSize: '0.78rem', 
                    padding: '10px 14px', 
                    background: 'linear-gradient(135deg, #d97706, #b45309)' 
                  }}
                  onClick={async () => {
                    const result = await showPrompt(
                      language === 'en' ? 'Describe the feature/detail to modify:' : '請描述要修改的功能或細節：',
                      language === 'en' ? 'e.g. Change db-helper to support JSON backup' : '例如：將 db-helper 修改為支援匯出備份 JSON 檔案',
                      false,
                      true
                    );
                    if (result) {
                      const detail = typeof result === 'string' ? result : result.text;
                      const images = typeof result === 'string' ? [] : result.images;
                      copyToClipboard(getModifyFeaturePrompt(detail, images));
                    }
                  }}
                >
                  {t('btnModifyFeaturePrompt')}
                </button>
                {/* Remove Feature Prompt Button */}
                <button 
                  className="btn" 
                  style={{ 
                    fontSize: '0.78rem', 
                    padding: '10px 14px', 
                    background: 'linear-gradient(135deg, #dc2626, #b91c1c)' 
                  }}
                  onClick={async () => {
                    const target = await showPrompt(
                      language === 'en' ? 'Which component/feature do you want to remove?' : '請描述要移除的組件或功能：',
                      language === 'en' ? 'e.g. pdf-exporter' : '例如：pdf-exporter'
                    );
                    if (target) {
                      copyToClipboard(getRemoveFeaturePrompt(target));
                    }
                  }}
                >
                  {t('btnRemoveFeaturePrompt')}
                </button>
                {/* Refactor Architecture Prompt Button */}
                <button 
                  className="btn" 
                  style={{ 
                    fontSize: '0.78rem', 
                    padding: '10px 14px', 
                    background: 'linear-gradient(135deg, #2563eb, #1d4ed8)' 
                  }}
                  onClick={async () => {
                    const result = await showPrompt(
                      language === 'en' ? 'Describe your architecture refactoring goals:' : '請描述您的架構重構目標：',
                      language === 'en' ? 'e.g. Decouple modules, merge redundant nodes, optimize data flow' : '例如：解耦現有模組、合併冗餘節點、優化資料流相依關係',
                      false,
                      true
                    );
                    if (result) {
                      const goal = typeof result === 'string' ? result : result.text;
                      const images = typeof result === 'string' ? [] : result.images;
                      copyToClipboard(getRefactorArchitecturePrompt(goal, images));
                    }
                  }}
                >
                  {t('btnRefactorArchitecturePrompt')}
                </button>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {/* Import / Paste Graph JSON Button */}
                  <button 
                    className="btn" 
                    style={{ 
                      flex: 1,
                      fontSize: '0.75rem', 
                      padding: '8px 10px', 
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
                  {/* Export / Download Graph JSON Button */}
                  <button 
                    className="btn" 
                    style={{ 
                      flex: 1,
                      fontSize: '0.75rem', 
                      padding: '8px 10px', 
                      background: 'rgba(147, 51, 234, 0.08)', 
                      border: '1px solid rgba(147, 51, 234, 0.3)', 
                      color: '#c084fc',
                      boxShadow: 'none' 
                    }}
                    onClick={exportGraphJSON}
                  >
                    {t('exportGraphBtn')}
                  </button>
                </div>
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
                    const result = await showPrompt(t('askGoalPrompt'), language === 'en' ? 'e.g. A Markdown editor with local save and PDF export' : '例如：做一個結合 IndexedDB 存檔 dung Markdown 編輯器，且能匯出 PDF', false, true);
                    if (result) {
                      const goal = typeof result === 'string' ? result : result.text;
                      const images = typeof result === 'string' ? [] : result.images;
                      copyToClipboard(getBootstrapPrompt(goal, images));
                    }
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
                    const result = await showPrompt(t('askGoalPrompt'), language === 'en' ? 'e.g. A Markdown editor with local save and PDF export' : '例如：做一個結合 IndexedDB 存檔的 Markdown 編輯器，且能匯出 PDF', false, true);
                    if (result) {
                      const goal = typeof result === 'string' ? result : result.text;
                      const images = typeof result === 'string' ? [] : result.images;
                      copyToClipboard(getBootstrapPrompt(goal, images));
                    }
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
            {globalConstraints.map((constraint, idx) => {
              const isObj = typeof constraint === 'object' && constraint !== null;
              const text = isObj ? constraint.text : constraint;
              const imgs = isObj ? constraint.vibeImages || [] : [];
              return (
                <div 
                  key={idx} 
                  className="glossary-item"
                  style={{ display: 'flex', flexDirection: 'column', padding: '8px 12px', gap: '4px' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-main)' }}>• {text}</span>
                    <button 
                      onClick={() => handleRemoveConstraint(idx)}
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.9rem' }}
                      title="Delete"
                    >
                      ✕
                    </button>
                  </div>
                  {imgs.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                      {imgs.map((img, imgIdx) => (
                        <div key={imgIdx} style={{ position: 'relative', border: '1px solid var(--panel-border)', borderRadius: '4px', width: '35px', height: '35px', overflow: 'hidden', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <img src={img} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {constraintImages.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px', padding: '4px' }}>
              {constraintImages.map((img, idx) => (
                <div key={idx} style={{ position: 'relative', border: '1px solid var(--panel-border)', borderRadius: '4px', width: '40px', height: '40px', overflow: 'hidden', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img src={img} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  <button 
                    type="button"
                    onClick={() => setConstraintImages(prev => prev.filter((_, i) => i !== idx))}
                    style={{ position: 'absolute', top: '1px', right: '1px', background: 'rgba(239, 68, 68, 0.85)', border: 'none', color: '#fff', borderRadius: '50%', width: '12px', height: '12px', fontSize: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
          <form onSubmit={handleAddConstraint} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <input 
              type="text" 
              className="form-input" 
              placeholder={t('addConstraintPlaceholder')}
              style={{ fontSize: '0.8rem', padding: '6px 10px', flex: 1 }}
              value={newConstraint}
              onChange={(e) => setNewConstraint(e.target.value)}
              onPaste={(e) => {
                if (e.clipboardData.files.length > 0) {
                  e.preventDefault();
                  handleConstraintImagesUpload(e.clipboardData.files);
                }
              }}
            />
            <input 
              id="constraint-image-input" 
              type="file" 
              accept="image/*" 
              multiple
              style={{ display: 'none' }} 
              onChange={(e) => {
                if (e.target.files) {
                  handleConstraintImagesUpload(e.target.files);
                }
              }}
            />
            <button 
              type="button"
              className="btn"
              style={{ padding: '6px 10px', fontSize: '0.8rem', background: 'rgba(255,255,255,0.05)', color: 'var(--text-main)', border: '1px solid var(--panel-border)', boxShadow: 'none' }}
              onClick={() => document.getElementById('constraint-image-input').click()}
              title="Attach Images (Max 5)"
            >
              🖼️
            </button>
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
