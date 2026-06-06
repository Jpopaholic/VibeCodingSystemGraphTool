import React, { useState, useEffect } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';

export default function PromptCompiler({ activeNode }) {
  const { 
    nodes: graphNodes, 
    glossary, 
    globalConstraints, 
    updateNode,
    readFiles,
    writeFile,
    language,
    t,
    showPrompt,
    showAlert
  } = useWorkspace();

  const [compiledPrompt, setCompiledPrompt] = useState('');
  const [isCompiling, setIsCompiling] = useState(false);
  const [codeToApply, setCodeToApply] = useState('');
  const [targetPath, setTargetPath] = useState('');

  // Synchronize target file path when node changes
  useEffect(() => {
    if (activeNode) {
      setTargetPath(activeNode.synthesis?.filePath || '');
      setCompiledPrompt('');
      setCodeToApply('');
    }
  }, [activeNode]);

  if (!activeNode) return null;

  // Promise-based async Prompt compilation
  const handleCompilePrompt = async () => {
    setIsCompiling(true);
    try {
      // Find completed dependency file paths
      const completedDeps = (activeNode.dependencies || []).map(depId => {
        const depNode = graphNodes.find(n => n.id === depId);
        if (depNode && depNode.synthesis?.status === 'completed' && depNode.synthesis?.filePath) {
          return depNode.synthesis.filePath;
        }
        return null;
      }).filter(p => p !== null);

      // Await files read from workspace directly using our Promise API
      let readFilesMap = {};
      if (completedDeps.length > 0) {
        readFilesMap = await readFiles(completedDeps);
      }

      // Build context components
      const glossaryContext = Object.entries(glossary)
        .map(([k, v]) => `- **${k}**: ${v}`)
        .join('\n');

      const globalConstraintsContext = globalConstraints
        .map(c => `- ${c}`)
        .join('\n');

      const dependenciesContext = (activeNode.dependencies || []).map(depId => {
        const depNode = graphNodes.find(n => n.id === depId);
        if (!depNode) return '';

        const isCompleted = depNode.synthesis?.status === 'completed';
        const depPath = depNode.synthesis?.filePath || '';
        const depCode = readFilesMap[depPath] || '';

        if (language === 'en') {
          if (isCompleted && depCode) {
            return `### 📦 Completed Dependency: ${depNode.name} (${depPath})
\`\`\`javascript
${depCode}
\`\`\``;
          } else {
            return `### ⏳ Pending Dependency: ${depNode.name}
- Expected output (produce): ${depNode.produce}
- Intent: ${depNode.synthesis?.intentSignal || depNode.intent || 'Not defined yet'}`;
          }
        } else {
          if (isCompleted && depCode) {
            return `### 📦 已完成的前置組件: ${depNode.name} (${depPath})
\`\`\`javascript
${depCode}
\`\`\``;
          } else {
            return `### ⏳ 待辦的前置組件: ${depNode.name}
- 預期產出 (produce): ${depNode.produce}
- 核心意圖: ${depNode.synthesis?.intentSignal || depNode.intent || '尚未定義'}`;
          }
        }
      }).filter(text => text.length > 0).join('\n\n');

      const rawNotes = activeNode.vibeNotes || '';
      const intentSignal = activeNode.synthesis?.intentSignal || '';
      const constraints = (activeNode.synthesis?.extractedConstraints || []).map(c => `- ${c}`).join('\n');

      // Generate final prompt text
      const promptText = language === 'en'
        ? `You are now a software implementation expert. Please implement this component for me based on the specified "Output Expectation" and "Synthesis Code Contract".

---

## 🟢 Component Info
- **Component Name**: ${activeNode.name}
- **ID**: ${activeNode.id}
- **Output Expectation (What does this produce?)**:
  > "${activeNode.produce}"

---

## 🧠 Memos & Vibe Notes
${rawNotes ? `### Developer Memos:\n${rawNotes}\n` : ''}
${intentSignal ? `### AI Distilled Intent (Intent Signal):\n${intentSignal}\n` : ''}
${constraints ? `### Key Technical Constraints:\n${constraints}\n` : ''}

---

## 🌐 Global Constraints
${globalConstraintsContext || 'No global constraints.'}

---

## 📖 Glossary / Terminology
When writing the code, you **must** use the following defined business terms and data structures. Do NOT invent conflicting synonyms:
${glossaryContext || 'No glossary terms defined.'}

---

## 🔗 Dependency Modules (Dependencies)
This component is related to the following components. If a dependency is completed, read its actual source code and integrate/invoke it accordingly. If it is pending, follow its interface contract:
${dependenciesContext || 'No dependencies.'}

---

## 📝 Implementation Output Requirements
1. **Module Decoupling**: This component must be a highly cohesive, loosely coupled independent module, transferring data only through agreed interfaces and dependencies.
2. **Path Declaration**: You must explicitly annotate the target path at the very top of the code as a comment: \`// Path: [recommended target file path]\`.
3. **Output Code Only**: Output the complete, copy-paste ready code content directly without wrapping it in conversational text.
`
        : `你現在是軟體實作專家。請依照指定的「產出預期」與「系統合約」，為我實作這個組件。

---

## 🟢 實作組件資訊
- **組件名稱**：${activeNode.name}
- **識別碼**：${activeNode.id}
- **產出預期 (What does this produce?)**：
  > "${activeNode.produce}"

---

## 🧠 設計隨筆與開發備忘 (Vibe Notes)
${rawNotes ? `### 開發者原始備忘：\n${rawNotes}\n` : ''}
${intentSignal ? `### AI 精煉意圖 (Intent Signal)：\n${intentSignal}\n` : ''}
${constraints ? `### 關鍵技術約束：\n${constraints}\n` : ''}

---

## 🌐 全局專案約束 (Global Constraints)
${globalConstraintsContext || '無全局約束。'}

---

## 📖 業務名詞定義表 (Glossary)
在編寫程式碼時，**必須**使用以下定義的業務名詞與資料結構，嚴禁發明混淆的同義詞：
${glossaryContext || '無特別定義名詞。'}

---

## 🔗 前置依賴模組 (Dependencies)
本組件與以下組件有關聯。如果是已完成的組件，請閱讀其真實程式碼並相應地進行整合與呼叫；如果是未完成組件，請遵循其接口契約：
${dependenciesContext || '無前置依賴組件。'}

---

## 📝 實作輸出要求
1. **模組解耦**：本組件必須是一個高内聚、低耦合的獨立模組，只透過約定的接口與依賴項進行數據傳遞。
2. **路徑聲明**：請在程式碼最上方以註解明確標註建議的路徑：\`// Path: [建議的檔案路徑]\`。
3. **只輸出代碼**：直接輸出完整的程式碼內容，方便拷貝。
`;

      setCompiledPrompt(promptText);
    } catch (err) {
      await showAlert(t('compileFailedAlert') + err.message);
    } finally {
      setIsCompiling(false);
    }
  };

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(compiledPrompt);
    const notification = document.createElement('div');
    notification.innerText = t('copiedPromptAlert');
    notification.style.position = 'fixed';
    notification.style.bottom = '20px';
    notification.style.left = '50%';
    notification.style.transform = 'translateX(-50%)';
    notification.style.background = '#9333ea';
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

  // Promise-based async file write apply
  const handleApplyCode = async () => {
    if (!codeToApply.trim()) {
      await showAlert(t('noCodeAlert'));
      return;
    }

    let resolvedPath = targetPath.trim();
    if (!resolvedPath) {
      const pathMatch = codeToApply.match(/(?:\/\/|#)\s*Path:\s*([^\r\n]+)/i);
      if (pathMatch && pathMatch[1]) {
        resolvedPath = pathMatch[1].trim();
        setTargetPath(resolvedPath);
      } else {
        const userPath = await showPrompt(t('askFilePathPrompt'), 'src/components/MyComponent.jsx');
        if (!userPath) return;
        resolvedPath = userPath.trim();
        setTargetPath(resolvedPath);
      }
    }

    try {
      // Direct await on file write call (decoupled)
      const writtenPath = await writeFile(resolvedPath, codeToApply);

      // Successfully written! Update node state (Completed) & save compile history to Trace Layer
      const updatedNode = {
        ...activeNode,
        synthesis: {
          ...(activeNode.synthesis || {}),
          filePath: writtenPath,
          status: 'completed'
        },
        trace: {
          ...(activeNode.trace || {}),
          lastImplementedPrompt: compiledPrompt || 'Compiled prompt context'
        }
      };
      
      updateNode(updatedNode);
      setCodeToApply('');
      await showAlert(t('applySuccessAlert') + writtenPath);
    } catch (err) {
      await showAlert(t('applyFailedAlert') + err.message);
    }
  };

  return (
    <div style={{ marginTop: '24px', borderTop: '1px solid var(--panel-border)', paddingTop: '20px' }}>
      <div className="form-label" style={{ color: '#a855f7' }}>{t('compilerTitle')}</div>
      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '14px', lineHeight: '1.4' }}>
        {t('compilerDesc')}
      </p>

      {compiledPrompt ? (
        <div className="prompt-box">
          <textarea 
            className="form-input" 
            style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', minHeight: '120px', background: '#050508' }}
            readOnly
            value={compiledPrompt}
          />
          <div className="prompt-actions">
            <button className="btn" onClick={handleCopyPrompt}>
              {t('btnCopyPrompt')}
            </button>
            <button 
              className="btn" 
              style={{ background: '#374151', flex: 'none', width: '80px' }}
              onClick={() => setCompiledPrompt('')}
            >
              {t('btnResetPrompt')}
            </button>
          </div>
        </div>
      ) : (
        <button 
          className="btn" 
          style={{ width: '100%', padding: '12px', fontSize: '0.9rem' }}
          onClick={handleCompilePrompt}
        >
          {isCompiling ? t('isCompilingText') : t('btnCompilePrompt')}
        </button>
      )}

      {/* Apply Code Section */}
      <div className="apply-code-section">
        <div className="form-label" style={{ color: 'var(--color-success)' }}>{t('applyCodeTitle')}</div>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '12px', lineHeight: '1.4' }}>
          {t('applyCodeDesc')}
        </p>
        <div className="form-group">
          <input 
            type="text" 
            className="form-input" 
            placeholder={t('applyPathPlaceholder')}
            style={{ fontSize: '0.8rem', padding: '6px 10px', marginBottom: '8px' }}
            value={targetPath}
            onChange={(e) => setTargetPath(e.target.value)}
          />
          <textarea 
            className="form-input apply-textarea" 
            placeholder={t('applyTextareaPlaceholder')}
            value={codeToApply}
            onChange={(e) => setCodeToApply(e.target.value)}
          />
        </div>
        <button 
          className="btn" 
          style={{ width: '100%', padding: '12px', background: 'linear-gradient(135deg, var(--color-success), #059669)', boxShadow: '0 4px 15px rgba(16, 185, 129, 0.2)' }}
          onClick={handleApplyCode}
        >
          {t('btnApplyCode')}
        </button>
      </div>
    </div>
  );
}
