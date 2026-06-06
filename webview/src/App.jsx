import React, { useState, useMemo } from 'react';
import { WorkspaceProvider, useWorkspace } from './context/WorkspaceContext';
import AIBox from './components/AIBox';
import GraphCanvas from './components/GraphCanvas';
import NodeEditor from './components/NodeEditor';
import PromptCompiler from './components/PromptCompiler';

function WorkspaceDashboard() {
  const { 
    isInitialized, 
    nodes, 
    glossary, 
    globalConstraints, 
    setGlossary, 
    setGlobalConstraints, 
    setNodes, 
    saveGraph,
    language,
    setLanguage,
    t,
    showPrompt,
    showAlert,
    importGraphJSON
  } = useWorkspace();

  const [selectedNodeId, setSelectedNodeId] = useState(null);

  // Find active node object
  const activeNode = useMemo(() => {
    return nodes.find(n => n.id === selectedNodeId) || null;
  }, [nodes, selectedNodeId]);

  // Soft Nudges calculation (Progression, Connection and Glossary logic)
  const activeNudges = useMemo(() => {
    if (!activeNode) return null;
    const nudges = [];

    // Nudge 1: Progression Nudge (highlight dependency nodes)
    const completedNodeIds = new Set(
      nodes.filter(n => n.synthesis?.status === 'completed').map(n => n.id)
    );
    const deps = activeNode?.dependencies || [];
    const status = activeNode?.synthesis?.status || 'todo';

    if (status !== 'completed' && deps.length > 0) {
      const uncompletedDeps = deps.filter(id => !completedNodeIds.has(id));
      if (uncompletedDeps.length > 0) {
        const depNames = uncompletedDeps
          .map(id => nodes.find(n => n.id === id)?.name || id)
          .join(', ');
        nudges.push({
          type: 'progression',
          text: t('nudgeProgression', { deps: depNames })
        });
      }
    }

    // Nudge 2: Connection Nudge (highlight UI nodes)
    if (activeNode && (activeNode.id?.includes('ui') || activeNode.name?.includes('UI') || activeNode.name?.includes('介面'))) {
      if (deps.length === 0) {
        nudges.push({
          type: 'connection',
          text: t('nudgeConnection')
        });
      }
    }

    // Nudge 3: Glossary Nudge (highlight glossary definitions matching vibeNotes text)
    const rawNotes = (activeNode?.vibeNotes || '').toLowerCase();
    const glossaryKeys = Object.keys(glossary);
    const matchedKeys = glossaryKeys.filter(k => 
      k.length > 2 && rawNotes.includes(k.toLowerCase())
    );
    if (matchedKeys.length > 0) {
      nudges.push({
        type: 'glossary',
        text: t('nudgeGlossary', { keys: matchedKeys.join(', ') })
      });
    }

    return nudges.length > 0 ? nudges : null;
  }, [activeNode, nodes, glossary, t]);

  // Bootstrap with a demo template
  const handleLoadDemoTemplate = () => {
    const demoGlossary = {
      "Note": "筆記物件結構，包含 { id: string, title: string, content: string, updatedAt: number }。",
      "PDFConfig": "PDF 導出配置，包含 { pageSize: 'A4' | 'Letter', margins: number }。"
    };
    const demoConstraints = [
      "Tech Stack: React, Vite, Vanilla CSS",
      "Module System: ES Modules",
      "Code Quality: Strict separation of concerns (Decoupled nodes)"
    ];
    const demoNodes = [
      {
        id: "db-helper",
        name: "Database Helper",
        produce: "stores notes locally",
        vibeNotes: "資料庫存取速度要快！代碼保持精簡，不要引入大型 SQL 庫，太肥了。純粹用 IndexedDB 封裝就好。",
        dependencies: [],
        synthesis: {
          filePath: "",
          status: "todo",
          intentSignal: "使用瀏覽器原生 IndexedDB 封裝筆記資料的本地持久化存取。",
          extractedConstraints: [
            "禁止引入外部大型資料庫依賴（限用原生 IndexedDB）",
            "所有存取 API 必須為 async"
          ]
        },
        trace: { lastImplementedPrompt: "" }
      },
      {
        id: "pdf-exporter",
        name: "PDF Exporter",
        produce: "exports note to PDF file",
        vibeNotes: "出錯時不要讓網頁當掉，要給個友善提示，而且不要用第三方大套件。",
        dependencies: [],
        synthesis: {
          filePath: "",
          status: "todo",
          intentSignal: "將 Note 資料序列化並利用輕量級庫轉換為 PDF 下載。",
          extractedConstraints: [
            "必須接受 PDFConfig 作為參數",
            "出錯時需回傳優雅且友善的錯誤提示"
          ]
        },
        trace: { lastImplementedPrompt: "" }
      },
      {
        id: "note-editor",
        name: "Note Editor UI",
        produce: "renders markdown editor UI",
        vibeNotes: "版面要乾淨！點擊儲存要呼叫資料庫，點擊導出要呼叫 PDF Exporter。",
        dependencies: ["db-helper", "pdf-exporter"],
        synthesis: {
          filePath: "",
          status: "todo",
          intentSignal: "Markdown 編輯介面，整合 db-helper 存檔與 pdf-exporter 匯出。",
          extractedConstraints: [
            "存檔時必須呼叫 db-helper 的 saveNote",
            "匯出時必須呼叫 pdf-exporter 進行處理"
          ]
        },
        trace: { lastImplementedPrompt: "" }
      }
    ];

    setGlossary(demoGlossary);
    setGlobalConstraints(demoConstraints);
    setNodes(demoNodes);
    saveGraph(demoGlossary, demoConstraints, demoNodes);
  };

  if (!isInitialized) {
    return (
      <div className="welcome-screen">
        <h2 style={{ color: 'var(--text-dark)' }}>{t('loading')}</h2>
      </div>
    );
  }

  // Welcome Bootstrap UI
  if (nodes.length === 0 && Object.keys(glossary).length === 0) {
    return (
      <div className="welcome-screen">
        <div className="welcome-card">
          {/* Language selector — top right */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              style={{
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid var(--panel-border)',
                color: 'var(--text-main)',
                borderRadius: '4px',
                fontSize: '0.75rem',
                padding: '3px 8px',
                outline: 'none',
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
              }}
            >
              <option value="zh-TW">繁中</option>
              <option value="en">EN</option>
            </select>
          </div>
          <div className="logo-container">
            <h1 className="logo-text">{t('welcomeTitle')}</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '6px', fontStyle: 'italic' }}>
              {t('welcomeSubtitle')}
            </p>
          </div>
          <p className="subtitle">
            {t('welcomeDesc')}
          </p>

          <div className="dream-input-wrapper">
            <button 
              className="btn" 
              style={{ padding: '16px', background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}
              onClick={async () => {
                const goal = await showPrompt(t('promptGoalPrompt'), '例如：做一個結合 IndexedDB 存檔的 Markdown 編輯器，且能匯出 PDF');
                if (goal) {
                  const bootstrapPrompt = language === 'en'
                    ? `Please act as a software architecture expert, analyzing my system vision described below. \nI want to create a \`system-graph.json\` file in my project root directory. This file is our contract for co-development.\nPlease plan three sections and output in raw JSON format (no markdown code blocks, just raw JSON text):\n\n1. "glossary": { "Term": "definition and data structure model description" }, extracting key business entities.\n2. "globalConstraints": [ "global system constraints (e.g. tech stack, layout style)" ].\n3. "nodes": [\n     {\n       "id": "unique-english-id (e.g., auth-helper)",\n       "name": "Component Name",\n       "produce": "What does this produce? starting with active verb (e.g. stores sessions locally)",\n       "vibeNotes": "Supplementary developer memos for this node",\n       "dependencies": [ "array of dependent node ids" ],\n       "synthesis": {\n         "filePath": "recommended file path (e.g., src/utils/auth.js)",\n         "status": "todo",\n         "intentSignal": "distilled clean core implementation goal",\n         "extractedConstraints": [ "distilled technical constraints from notes (e.g., no external packages)" ],\n         "userOverridden": false\n       },\n       "trace": { "stale": false, "lastImplementedPrompt": "" }\n     }\n   ]\n\nThe JSON must strictly follow this schema. Any missing fields will cause import errors.\n\nMy system vision is:\n${goal}`
                    : `請作為軟體架構規劃專家，分析我接下來要建造的系統想法。\n我希望在專案根目錄下建立一個 \`system-graph.json\` 檔案。這個檔案是我們協同開發的唯一契約。\n請為我規劃以下三個部分，並輸出為純 JSON 格式（不要包含任何 markdown 標記或 \`\`\`json 區塊，直接輸出 JSON 內容）：\n\n1. "glossary": { "名詞": "定義與資料結構模型說明" }，提取系統的核心業務實體名詞。\n2. "globalConstraints": [ "全域系統約束條件（如技術棧、排版風格）" ]。\n3. "nodes": [\n     {\n       "id": "唯一的英文識別碼（例如 auth-helper）",\n       "name": "中文組件名稱",\n       "produce": "以主動動詞說明它產出什麼成果（例如 stores sessions locally）",\n       "vibeNotes": "該組件的補充說明備忘",\n       "dependencies": [ "依賴的其他 node id 陣列" ],\n       "synthesis": {\n         "filePath": "建議的實體檔案存放路徑（例如 src/utils/auth.js）",\n         "status": "todo",\n         "intentSignal": "精煉後的乾淨核心實作目的",\n         "extractedConstraints": [ "從說明中提煉出的具體技術規範（如不能用第三方庫）" ]\n       },\n       "trace": { "stale": false, "lastImplementedPrompt": "" }\n     }\n   ]\n\nJSON 必須嚴格符合此 schema，缺少任何欄位都會導致匯入失敗。\n\n我的系統功能願景是：\n${goal}`;
                  navigator.clipboard.writeText(bootstrapPrompt);
                  await showAlert(t('promptCopiedAlert'));
                }
              }}
            >
              {t('copyInitPrompt')}
            </button>

            <div style={{ color: 'var(--text-dark)', fontSize: '0.85rem', margin: '8px 0' }}>
              {language === 'zh-TW' ? '— 或者 —' : '— OR —'}
            </div>

            <button 
              className="btn" 
              style={{ background: '#1f2937', color: '#c084fc', border: '1px dashed rgba(192, 132, 252, 0.4)', boxShadow: 'none' }}
              onClick={handleLoadDemoTemplate}
            >
              {t('loadDemoTemplate')}
            </button>

            <button 
              className="btn" 
              style={{ 
                background: 'rgba(16, 185, 129, 0.08)', 
                color: '#10b981', 
                border: '1px solid rgba(16, 185, 129, 0.3)', 
                boxShadow: 'none',
                marginTop: '12px'
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
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Left Panel */}
      <AIBox />

      {/* Center Panel */}
      <GraphCanvas 
        selectedNodeId={selectedNodeId}
        onSelectNode={setSelectedNodeId}
      />

      {/* Right Panel */}
      <div className="side-panel right" style={{ width: '380px' }}>
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {/* Node Editor */}
          <NodeEditor activeNode={activeNode} onDeleteNode={() => setSelectedNodeId(null)} />
          
          {/* Nudge Indicator */}
          {activeNode && activeNudges && (
            <div style={{ padding: '0 20px' }}>
              {activeNudges.map((nudge, idx) => (
                <div key={idx} className="nudges-box">
                  <span className="nudge-icon">💡</span>
                  <span>{nudge.text}</span>
                </div>
              ))}
            </div>
          )}

          {/* Prompt Compiler */}
          {activeNode && (
            <div style={{ padding: '0 20px 20px 20px' }}>
              <PromptCompiler activeNode={activeNode} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


export default function App() {
  return (
    <WorkspaceProvider>
      <WorkspaceDashboard />
    </WorkspaceProvider>
  );
}
