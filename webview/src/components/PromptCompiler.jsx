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
      // 1. Heuristic file path detector
      const detectRefPaths = (text, allNodes, activeNode) => {
        const detected = [];
        const regex = /(?:[a-zA-Z0-9_\-\.\/\\]+)\.(?:js|jsx|ts|tsx|json|css|html)/gi;
        
        let match;
        while ((match = regex.exec(text)) !== null) {
          const rawMatch = match[0].trim();
          const normalized = rawMatch.replace(/\\/g, '/');
          
          if (normalized.includes('/')) {
            detected.push(normalized);
          } else {
            // Filename only. Match against graph nodes
            const matchingNode = allNodes.find(n => {
              const filePath = n.synthesis?.filePath || '';
              const cleanPath = filePath.replace(/\\/g, '/');
              return cleanPath.endsWith('/' + normalized) || cleanPath.toLowerCase() === normalized.toLowerCase();
            });
            if (matchingNode && matchingNode.synthesis?.filePath) {
              detected.push(matchingNode.synthesis.filePath.replace(/\\/g, '/'));
            }
          }
        }
        
        // Filter out activeNode's own filePath and its dependencies' filePaths
        const ownPath = (activeNode.synthesis?.filePath || '').replace(/\\/g, '/');
        const depPaths = (activeNode.dependencies || []).map(depId => {
          const depNode = allNodes.find(n => n.id === depId);
          return (depNode?.synthesis?.filePath || '').replace(/\\/g, '/');
        }).filter(p => p.length > 0);

        return detected.filter(p => p !== ownPath && !depPaths.includes(p));
      };

      const rawNotes = activeNode.vibeNotes || '';
      const constraintsList = activeNode.synthesis?.extractedConstraints || [];
      const combinedTextForDetection = rawNotes + '\n' + constraintsList.join('\n');

      let detectedPaths = detectRefPaths(combinedTextForDetection, graphNodes, activeNode);

      // 2. Keyword detection for "external file" / "template file"
      const hasExternalFileKeywords = (text) => {
        const keywords = ['外部檔案', '外部', '匯入檔案', '參考檔案', '範本檔案', '模版檔案', 'external file', 'import file', 'template file', 'reference file'];
        return keywords.some(kw => text.toLowerCase().includes(kw));
      };

      let generateExternalTemplateFlag = false;
      let manualExternalPath = '';

      if (detectedPaths.length === 0 && hasExternalFileKeywords(combinedTextForDetection)) {
        const userPath = await showPrompt(t('askExternalFilePathPrompt'), '');
        if (userPath && userPath.trim()) {
          manualExternalPath = userPath.trim().replace(/\\/g, '/');
          detectedPaths.push(manualExternalPath);
        } else if (userPath === '') {
          // User left it blank (clicked confirm with empty text)
          generateExternalTemplateFlag = true;
        }
      }

      // Collect all potential file paths to read
      const pathsToRead = [];
      const activeFilePath = activeNode.synthesis?.filePath;
      if (activeFilePath) {
        pathsToRead.push(activeFilePath);
      }

      (activeNode.dependencies || []).forEach(depId => {
        const depNode = graphNodes.find(n => n.id === depId);
        if (depNode && depNode.synthesis?.filePath) {
          pathsToRead.push(depNode.synthesis.filePath);
        }
      });

      // Include detected reference template paths
      detectedPaths.forEach(p => {
        pathsToRead.push(p);
      });

      // Filter out duplicate and empty paths
      const uniquePaths = Array.from(new Set(pathsToRead)).filter(p => p.trim().length > 0);

      // Await files read from workspace directly using our Promise API
      let readFilesMap = {};
      if (uniquePaths.length > 0) {
        readFilesMap = await readFiles(uniquePaths);
      }

      // Check if code was successfully read (file exists)
      const isFileExists = (content) => {
        return content && !content.startsWith('// File does not exist yet');
      };

      const activeNodeCode = activeFilePath && isFileExists(readFilesMap[activeFilePath])
        ? readFilesMap[activeFilePath]
        : null;

      // Extract read reference templates
      const importedTemplates = [];
      detectedPaths.forEach(p => {
        const code = readFilesMap[p];
        if (isFileExists(code)) {
          importedTemplates.push({ path: p, code });
        }
      });

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

        const depPath = depNode.synthesis?.filePath || '';
        const depCode = readFilesMap[depPath];
        const hasCode = isFileExists(depCode);
        const isCompleted = depNode.synthesis?.status === 'completed';

        if (language === 'en') {
          if (isCompleted && hasCode) {
            return `### 📦 Completed Dependency: ${depNode.name} (${depPath})
\`\`\`javascript
// Path: ${depPath}
\`\`\``;
          } else if (hasCode) {
            return t('promptDepSkeleton', { name: depNode.name, path: depPath });
          } else {
            return `### ⏳ Pending Dependency: ${depNode.name}
- Expected output (produce): ${depNode.produce}
- Intent: ${depNode.synthesis?.intentSignal || depNode.intent || 'Not defined yet'}`;
          }
        } else {
          if (isCompleted && hasCode) {
            return `### 📦 已完成的前置組件: ${depNode.name} (${depPath})
\`\`\`javascript
// Path: ${depPath}
\`\`\``;
          } else if (hasCode) {
            return t('promptDepSkeleton', { name: depNode.name, path: depPath });
          } else {
            return `### ⏳ 待辦的前置組件: ${depNode.name}
- 預期產出 (produce): ${depNode.produce}
- 核心意圖: ${depNode.synthesis?.intentSignal || depNode.intent || '尚未定義'}`;
          }
        }
      }).filter(text => text.length > 0).join('\n\n');

      const intentSignal = activeNode.synthesis?.intentSignal || '';
      const constraints = (activeNode.synthesis?.extractedConstraints || []).map(c => `- ${c}`).join('\n');

      const activeTemplatePrompt = activeNodeCode
        ? t('promptActiveNodeTemplate', { path: activeFilePath })
        : '';

      // Format imported external templates
      const importedTemplatesPrompt = importedTemplates.map(tmp => {
        return t('promptImportedTemplate', { path: tmp.path });
      }).join('\n');

      // Instructions for template preservation or generation
      let templatePreservationEn = '';
      if (activeNodeCode) {
        templatePreservationEn = 'This file already has an existing template/skeleton structure provided in the "Existing Code / Skeleton in Project" section above. **You must implement and complete the code strictly within that structure (filling in the placeholders/TODOs)** and preserve its existing interfaces.';
      } else {
        templatePreservationEn = 'No existing template/skeleton file exists in the project yet. **Please generate and output the complete code and module template from scratch**.';
      }
      
      if (generateExternalTemplateFlag) {
        templatePreservationEn += '\n* Note: An external file reference was mentioned in the notes but no path was provided. Please design and generate the structure and code for this external helper/template file as well.';
      }

      let templatePreservationZh = '';
      if (activeNodeCode) {
        templatePreservationZh = '此檔案在專案中已有名詞或基本骨架（如上方的「專案中已存在的舊代碼/骨架」所示），**請務必在既有結構內實作與填補 TODO**，保留已定義好的架構與外部接口。';
      } else {
        templatePreservationZh = '目前專案中尚未存在該檔案範本，**請從零開始為我生成完整的程式碼與模組結構**。';
      }

      if (generateExternalTemplateFlag) {
        templatePreservationZh += '\n* 備註：開發隨筆中提到了需要參考/使用外部檔案，但目前未提供。請協助為我規劃並生成該外部檔案（或範本骨架）的程式碼結構與模組設計。';
      }

      const imgNotice = activeNode.vibeImage
        ? t('imgPromptNotice')
        : '';

      // Generate final prompt text
      const promptText = language === 'en'
        ? `You are now a software implementation expert. Please implement this component for me based on the specified "Output Expectation" and "Synthesis Code Contract".

---

## 🟢 Component Info
- **Component Name**: ${activeNode.name}
- **ID**: ${activeNode.id}
- **Output Expectation (What does this produce?)**:
  > "${activeNode.produce}"
${activeTemplatePrompt}
${importedTemplatesPrompt}
${imgNotice}
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
This component is related to the following components. If a dependency is completed or has a skeleton file on disk, read its actual source code structure and integrate/invoke it accordingly. If it is pending with no template, follow its interface contract:
${dependenciesContext || 'No dependencies.'}

---

## 📝 Implementation Output Requirements
1. **Module Decoupling**: This component must be a highly cohesive, loosely coupled independent module, transferring data only through agreed interfaces and dependencies.
2. **Path Declaration**: You must explicitly annotate the target path at the very top of the code as a comment: \x60// Path: [recommended target file path]\x60.
3. **Template Preservation / Generation**: ${templatePreservationEn}
4. **Output Code Only**: Output the complete, copy-paste ready code content directly without wrapping it in conversational text.
`
        : `你現在是軟體實作專家。請依照指定的「產出預期」與「系統合約」，為我實作這個組件。

---

## 🟢 實作組件資訊
- **組件名稱**：${activeNode.name}
- **識別碼**：${activeNode.id}
- **產出預期 (What does this produce?)**：
  > "${activeNode.produce}"
${activeTemplatePrompt}
${importedTemplatesPrompt}
${imgNotice}
---

## 🧠 設計隨筆與開發備忘 (Vibe Notes)
${rawNotes ? `### 開發者原始備忘：\\n${rawNotes}\\n` : ''}
${intentSignal ? `### AI 精煉意圖 (Intent Signal)：\\n${intentSignal}\\n` : ''}
${constraints ? `### 關鍵技術約束：\\n${constraints}\\n` : ''}

---

## 🌐 全局專案約束 (Global Constraints)
${globalConstraintsContext || '無全局約束。'}

---

## 📖 業務名詞定義表 (Glossary)
在編寫程式碼時，**必須**使用以下定義的業務名詞與資料結構，嚴禁發明混淆的同義詞：
${glossaryContext || '無特別定義名詞。'}

---

## 🔗 前置依賴模組 (Dependencies)
本組件與以下組件有關聯。如果是已完成組件或已有結構骨架的組件，請閱讀其真實程式碼並相應地進行整合與呼叫；如果是尚未建立的組件，請遵循其接口契約：
${dependenciesContext || '無前置依賴組件。'}

---

## 📝 實作輸出要求
1. **模組解耦**：本組件必須是一個高內聚、低耦合的獨立模組，只透過約定的接口與依賴項進行數據傳遞。
2. **路徑聲明**：請在程式碼最上方以註解明確標註建議的路徑：\x60// Path: [建議的檔案路徑]\x60。
3. **結構與範本繼承 / 從零生成**：${templatePreservationZh}
4. **只輸出代碼**：直接輸出完整的程式碼內容，方便拷貝。
`;

      setCompiledPrompt(promptText);
    } catch (err) {
      await showAlert(t('compileFailedAlert') + err.message);
    } finally {
      setIsCompiling(false);
    }
  };

  const showNotification = (msg, bg = '#9333ea') => {
    const notification = document.createElement('div');
    notification.innerText = msg;
    notification.style.position = 'fixed';
    notification.style.bottom = '20px';
    notification.style.left = '50%';
    notification.style.transform = 'translateX(-50%)';
    notification.style.background = bg;
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

  const convertBase64ToPngBlob = (base64Str) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Canvas toBlob failed'));
          }
        }, 'image/png');
      };
      img.onerror = () => reject(new Error('Load image failed'));
      img.src = base64Str;
    });
  };

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(compiledPrompt);
      showNotification(t('copiedPromptAlert'), '#9333ea');
    } catch (err) {
      await showAlert(t('compileFailedAlert') + err.message);
    }
  };

  const handleCopyImage = async () => {
    if (!activeNode.vibeImage) return;
    try {
      const pngBlob = await convertBase64ToPngBlob(activeNode.vibeImage);
      await navigator.clipboard.write([
        new ClipboardItem({
          'image/png': pngBlob
        })
      ]);
      showNotification(t('copiedImageAlert'), '#10b981');
    } catch (err) {
      await showAlert(t('copyImageFailedAlert') + err.message);
    }
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
      await showAlert(t('applySuccessAlert') + resolvedPath);
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
          {activeNode.vibeImage && (
            <div className="compiled-image-preview" style={{ marginBottom: '14px', border: '1px solid var(--panel-border)', borderRadius: '8px', overflow: 'hidden', background: '#000', display: 'flex', justifyContent: 'center' }}>
              <img src={activeNode.vibeImage} alt="Vibe Mockup" style={{ width: '100%', height: 'auto', display: 'block', maxHeight: '150px', objectFit: 'contain' }} />
            </div>
          )}
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
            {activeNode.vibeImage && (
              <button className="btn" style={{ background: '#10b981', flex: 'none' }} onClick={handleCopyImage}>
                {t('btnCopyImage')}
              </button>
            )}
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
      <div className="apply-code-section" style={{ marginTop: '20px', borderTop: '1px solid var(--panel-border)', paddingTop: '20px' }}>
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
            style={{ minHeight: '100px', fontSize: '0.75rem', fontFamily: 'monospace' }}
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
