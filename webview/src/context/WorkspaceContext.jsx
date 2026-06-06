import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { locales } from './locales';

const WorkspaceContext = createContext(null);

// 1. Safe VS Code API acquisition with browser fallback mock
const vscode = (() => {
  if (typeof acquireVsCodeApi !== 'undefined') {
    return acquireVsCodeApi();
  } else {
    console.warn('VibeGraph: Running in browser preview mode. Operations will be mocked.');
    return {
      postMessage: (message) => {
        console.log('[Mock VSCode Host Receive]:', message);
        if (message.command === 'ready') {
          setTimeout(() => {
            window.postMessage({
              type: 'init',
              workspaceRoot: '/mock-workspace',
              graph: null // Start on welcome screen
            }, '*');
          }, 300);
        } else if (message.command === 'readFiles') {
          setTimeout(() => {
            const mockFiles = {};
            message.files.forEach(f => {
              mockFiles[f] = `// Mock code content for ${f}\nexport function mockFunc() { console.log("vibe"); }`;
            });
            window.postMessage({
              type: 'filesRead',
              requestId: message.requestId,
              files: mockFiles
            }, '*');
          }, 400);
        } else if (message.command === 'writeFile') {
          setTimeout(() => {
            window.postMessage({
              type: 'fileWritten',
              requestId: message.requestId,
              success: true,
              filePath: message.filePath
            }, '*');
          }, 400);
        }
      },
      setState: (state) => {},
      getState: () => null
    };
  }
})();

export function useWorkspace() {
  return useContext(WorkspaceContext);
}

export function WorkspaceProvider({ children }) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [workspaceRoot, setWorkspaceRoot] = useState('');
  const [nodes, setNodes] = useState([]);
  const [glossary, setGlossary] = useState({});
  const [globalConstraints, setGlobalConstraints] = useState([]);
  const [language, setLanguage] = useState('zh-TW'); // 'zh-TW' or 'en'

  const glossaryRef = useRef({});
  const constraintsRef = useRef([]);
  const nodesRef = useRef([]);
  const lastSavedGraphStrRef = useRef('');
  const [modalConfig, setModalConfig] = useState(null);

  useEffect(() => {
    glossaryRef.current = glossary;
  }, [glossary]);

  useEffect(() => {
    constraintsRef.current = globalConstraints;
  }, [globalConstraints]);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  // Store pending request promises using refs to handle asynchronous interops
  const pendingRequests = useRef({});


  // 2. Global message routing
  useEffect(() => {
    const handleMessage = (event) => {
      const message = event.data;

      // Handle async promise resolution for file reads/writes
      if (message.requestId && pendingRequests.current[message.requestId]) {
        const { resolve, reject } = pendingRequests.current[message.requestId];
        delete pendingRequests.current[message.requestId];

        if (message.type === 'filesRead') {
          resolve(message.files);
        } else if (message.type === 'fileWritten') {
          if (message.success) {
            resolve(message.filePath);
          } else {
            reject(new Error(message.error || 'Write file failed'));
          }
        }
        return;
      }

      // Handle server-pushed initialization
      switch (message.type) {
        case 'init':
          setWorkspaceRoot(message.workspaceRoot);
          if (message.graph) {
            const initGlossary = message.graph.glossary || {};
            let constraints = [];
            if (Array.isArray(message.graph.globalConstraints)) {
              constraints = message.graph.globalConstraints;
            } else if (message.graph.globalConstraints && typeof message.graph.globalConstraints === 'object') {
              constraints = Object.entries(message.graph.globalConstraints).map(([k, v]) => `${k}: ${v}`);
            }
            const initNodes = message.graph.nodes || [];

            setGlossary(initGlossary);
            setGlobalConstraints(constraints);
            setNodes(initNodes);

            lastSavedGraphStrRef.current = JSON.stringify({
              glossary: initGlossary,
              globalConstraints: constraints,
              nodes: initNodes
            });
          }
          if (message.language) {
            const editorLang = message.language.toLowerCase();
            if (editorLang.startsWith('en')) {
              setLanguage('en');
            } else {
              setLanguage('zh-TW');
            }
          }
          setIsInitialized(true);
          break;

        case 'graphFileChanged':
          if (message.graph) {
            const incomingConstraints = Array.isArray(message.graph.globalConstraints)
              ? message.graph.globalConstraints
              : (message.graph.globalConstraints && typeof message.graph.globalConstraints === 'object')
                ? Object.entries(message.graph.globalConstraints).map(([k, v]) => `${k}: ${v}`)
                : [];
            
            const incomingGraph = {
              glossary: message.graph.glossary || {},
              globalConstraints: incomingConstraints,
              nodes: message.graph.nodes || []
            };

            const incomingStr = JSON.stringify(incomingGraph);
            if (incomingStr === lastSavedGraphStrRef.current) {
              break;
            }

            // Differentiate external changes
            lastSavedGraphStrRef.current = incomingStr;

            const oldGraph = {
              nodes: nodesRef.current,
              glossary: glossaryRef.current,
              globalConstraints: constraintsRef.current
            };

            const diff = getGraphDiff(oldGraph, incomingGraph);

            setGlossary(incomingGraph.glossary);
            setGlobalConstraints(incomingConstraints);
            setNodes(incomingGraph.nodes);

            if (diff.hasChanges) {
              showDiffModal(diff, oldGraph, true);
            }
          } else {
            const oldGraph = {
              nodes: nodesRef.current,
              glossary: glossaryRef.current,
              globalConstraints: constraintsRef.current
            };
            const incomingGraph = { glossary: {}, globalConstraints: [], nodes: [] };
            const diff = getGraphDiff(oldGraph, incomingGraph);

            setGlossary({});
            setGlobalConstraints([]);
            setNodes([]);
            lastSavedGraphStrRef.current = '';

            if (diff.hasChanges) {
              showDiffModal(diff, oldGraph, true);
            }
          }
          break;


        case 'graphFileError':
          showAlert(t('importFailedAlert') + message.error);
          break;

        case 'fileSystemEvent': {
          const { event: fsEvent, filePath: eventPath } = message;
          const cleanEventPath = eventPath.replace(/\\/g, '/').toLowerCase();
          
          setNodes(prevNodes => {
            let changed = false;
            const updated = prevNodes.map(node => {
              const nodePath = node.synthesis?.filePath;
              if (nodePath) {
                const cleanNodePath = nodePath.replace(/\\/g, '/').toLowerCase();
                if (cleanNodePath === cleanEventPath || cleanEventPath.endsWith(cleanNodePath)) {
                  const newStatus = fsEvent === 'create' ? 'completed' : 'todo';
                  if (node.synthesis?.status !== newStatus) {
                    changed = true;
                    return {
                      ...node,
                      synthesis: {
                        ...(node.synthesis || {}),
                        status: newStatus
                      }
                    };
                  }
                }
              }
              return node;
            });

            if (changed) {
              setTimeout(() => {
                saveGraph(glossaryRef.current, constraintsRef.current, updated);
              }, 100);
            }
            return updated;
          });
          break;
        }
      }
    };

    window.addEventListener('message', handleMessage);
    vscode.postMessage({ command: 'ready' });

    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // 3. Centralized Save Graph
  const saveGraph = (updatedGlossary, updatedConstraints, updatedNodes) => {
    const graphData = {
      glossary: updatedGlossary,
      globalConstraints: updatedConstraints,
      nodes: updatedNodes
    };
    lastSavedGraphStrRef.current = JSON.stringify(graphData);
    vscode.postMessage({
      command: 'saveGraph',
      data: graphData
    });
  };

  const showDiffModal = (diff, oldGraph, isAutoDetect = false) => {
    return new Promise((resolve) => {
      setModalConfig({
        type: 'diff',
        diff,
        oldGraph,
        isAutoDetect,
        onConfirm: () => {
          setModalConfig(null);
          resolve(true);
        },
        onCancel: () => {
          // Revert!
          setGlossary(oldGraph.glossary || {});
          setGlobalConstraints(oldGraph.globalConstraints || []);
          setNodes(oldGraph.nodes || []);
          saveGraph(oldGraph.glossary || {}, oldGraph.globalConstraints || [], oldGraph.nodes || []);
          setModalConfig(null);
          resolve(false);
        }
      });
    });
  };


  const updateGlossary = (newGlossary) => {
    setGlossary(newGlossary);
    saveGraph(newGlossary, globalConstraints, nodes);
  };

  const updateGlobalConstraints = (newConstraints) => {
    setGlobalConstraints(newConstraints);
    saveGraph(glossary, newConstraints, nodes);
  };

  const addNode = (newNodeSpec) => {
    const newNode = {
      id: newNodeSpec.id,
      name: newNodeSpec.name,
      produce: newNodeSpec.produce,
      vibeNotes: '',
      dependencies: [],
      synthesis: {
        filePath: '',
        status: 'todo',
        intentSignal: '',
        extractedConstraints: []
      },
      trace: {
        lastImplementedPrompt: ''
      }
    };
    const updatedNodes = [...nodes, newNode];
    setNodes(updatedNodes);
    saveGraph(glossary, globalConstraints, updatedNodes);
    return newNode.id;
  };

  const updateNode = (updatedNode) => {
    const updatedNodes = nodes.map(n => n.id === updatedNode.id ? updatedNode : n);
    setNodes(updatedNodes);
    saveGraph(glossary, globalConstraints, updatedNodes);
  };

  const deleteNode = (nodeId) => {
    let updatedNodes = nodes.filter(n => n.id !== nodeId);
    // Cascade remove dependencies
    updatedNodes = updatedNodes.map(n => ({
      ...n,
      dependencies: (n.dependencies || []).filter(id => id !== nodeId)
    }));
    setNodes(updatedNodes);
    saveGraph(glossary, globalConstraints, updatedNodes);
  };

  const updateDependencies = (nodeId, newDeps) => {
    const updatedNodes = nodes.map(n => {
      if (n.id === nodeId) {
        return { ...n, dependencies: newDeps };
      }
      return n;
    });
    setNodes(updatedNodes);
    saveGraph(glossary, globalConstraints, updatedNodes);
  };

  // Promise-based file read interop (decoupled)
  const readFiles = (filePaths) => {
    return new Promise((resolve, reject) => {
      const requestId = `${Date.now()}-${Math.random()}`;
      pendingRequests.current[requestId] = { resolve, reject };
      vscode.postMessage({
        command: 'readFiles',
        requestId,
        files: filePaths
      });
    });
  };

  // Promise-based file write interop (decoupled)
  const writeFile = (filePath, codeContent) => {
    return new Promise((resolve, reject) => {
      const requestId = `${Date.now()}-${Math.random()}`;
      pendingRequests.current[requestId] = { resolve, reject };
      vscode.postMessage({
        command: 'writeFile',
        requestId,
        filePath,
        codeContent
      });
    });
  };

  // Open file in Editor
  const openFile = (filePath) => {
    vscode.postMessage({
      command: 'openFile',
      filePath
    });
  };

  // i18n translation helper
  const t = (key, interpolations = {}) => {
    const dict = locales[language] || locales['zh-TW'];
    let text = dict[key] || locales['zh-TW'][key] || key;
    Object.entries(interpolations).forEach(([k, v]) => {
      text = text.replace(new RegExp(`{${k}}`, 'g'), v);
    });
    return text;
  };

  const showPrompt = (message, defaultValue = '', multiline = false) => {
    return new Promise((resolve) => {
      setModalConfig({
        type: 'prompt',
        message,
        defaultValue,
        multiline,
        onConfirm: (val) => {
          setModalConfig(null);
          resolve(val);
        },
        onCancel: () => {
          setModalConfig(null);
          resolve(null);
        }
      });
    });
  };

  const importGraphJSON = async (jsonString) => {
    try {
      let cleaned = jsonString.trim();

      // Extract only the JSON object by finding the first '{' and last '}'
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        cleaned = cleaned.substring(firstBrace, lastBrace + 1);
      }

      const parsed = JSON.parse(cleaned);
      if (!parsed.nodes && !parsed.glossary && !parsed.globalConstraints) {
        throw new Error(t('invalidGraphJsonErr', { msg: 'Missing nodes, glossary or globalConstraints' }));
      }
      const updatedGlossary = parsed.glossary || {};
      let updatedConstraints = [];
      if (Array.isArray(parsed.globalConstraints)) {
        updatedConstraints = parsed.globalConstraints;
      } else if (parsed.globalConstraints && typeof parsed.globalConstraints === 'object') {
        updatedConstraints = Object.entries(parsed.globalConstraints).map(([k, v]) => `${k}: ${v}`);
      }
      const updatedNodes = Array.isArray(parsed.nodes) ? parsed.nodes : [];

      const oldGraph = {
        nodes: nodesRef.current,
        glossary: glossaryRef.current,
        globalConstraints: constraintsRef.current
      };

      const newGraph = {
        nodes: updatedNodes,
        glossary: updatedGlossary,
        globalConstraints: updatedConstraints
      };

      const diff = getGraphDiff(oldGraph, newGraph);

      // Apply directly
      setGlossary(updatedGlossary);
      setGlobalConstraints(updatedConstraints);
      setNodes(updatedNodes);
      saveGraph(updatedGlossary, updatedConstraints, updatedNodes);

      if (diff.hasChanges) {
        showDiffModal(diff, oldGraph, false);
      }
      return true;
    } catch (err) {
      await showAlert(t('importFailedAlert') + err.message);
      return false;
    }
  };


  const showConfirm = (message) => {
    return new Promise((resolve) => {
      setModalConfig({
        type: 'confirm',
        message,
        onConfirm: () => {
          setModalConfig(null);
          resolve(true);
        },
        onCancel: () => {
          setModalConfig(null);
          resolve(false);
        }
      });
    });
  };

  const showAlert = (message) => {
    return new Promise((resolve) => {
      setModalConfig({
        type: 'alert',
        message,
        onConfirm: () => {
          setModalConfig(null);
          resolve();
        }
      });
    });
  };

  return (
    <WorkspaceContext.Provider value={{
      isInitialized,
      workspaceRoot,
      nodes,
      glossary,
      globalConstraints,
      language,
      setLanguage,
      t,
      updateGlossary,
      updateGlobalConstraints,
      addNode,
      updateNode,
      deleteNode,
      updateDependencies,
      readFiles,
      writeFile,
      openFile,
      setGlossary,
      setGlobalConstraints,
      setNodes,
      saveGraph,
      showPrompt,
      showConfirm,
      showAlert,
      importGraphJSON
    }}>
      {children}
      {modalConfig && <CustomModal {...modalConfig} language={language} t={t} />}
    </WorkspaceContext.Provider>
  );
}


function CustomModal({ type, message, defaultValue, onConfirm, onCancel, language, multiline, diff, isAutoDetect, t }) {
  const [value, setValue] = useState(defaultValue || '');
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      if (!multiline) {
        inputRef.current.select();
      }
    }
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !multiline) {
      handleSubmit();
    } else if (e.key === 'Escape') {
      if (onCancel) onCancel();
    }
  };

  const handleSubmit = () => {
    if (type === 'prompt') {
      onConfirm(value);
    } else {
      onConfirm();
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={(multiline || type === 'diff') ? { maxWidth: '600px', width: '90%' } : {}}>
        <div className="modal-message" style={{ whiteSpace: 'pre-line' }}>
          {type === 'diff' 
            ? (isAutoDetect ? t('diffModalTitleExternal') : t('diffModalTitle')) 
            : message
          }
        </div>
        
        {type === 'prompt' && (
          multiline ? (
            <textarea 
              ref={inputRef}
              className="form-input" 
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={12}
              style={{ 
                width: '100%', 
                fontSize: '0.85rem', 
                minHeight: '220px', 
                resize: 'vertical',
                fontFamily: 'monospace',
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid var(--panel-border)',
                color: 'var(--text-main)',
                borderRadius: '6px',
                padding: '10px'
              }}
            />
          ) : (
            <input 
              ref={inputRef}
              type="text" 
              className="form-input" 
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              style={{ width: '100%', fontSize: '0.9rem' }}
            />
          )
        )}

        {type === 'diff' && diff && (
          <div className="diff-modal-container">
            {/* 1. Nodes */}
            {(diff.nodeChanges.added.length > 0 || diff.nodeChanges.deleted.length > 0 || diff.nodeChanges.modified.length > 0) && (
              <div className="diff-section">
                <div className="diff-section-title">{t('diffNodesTitle')}</div>
                <div className="diff-list">
                  {diff.nodeChanges.added.map(node => (
                    <div className="diff-item added" key={node.id}>
                      + [{node.id}] {node.name} {node.synthesis?.filePath ? `(${node.synthesis.filePath})` : ''}
                    </div>
                  ))}
                  {diff.nodeChanges.deleted.map(node => (
                    <div className="diff-item deleted" key={node.id}>
                      - [{node.id}] {node.name}
                    </div>
                  ))}
                  {diff.nodeChanges.modified.map(mod => (
                    <div className="diff-item modified" key={mod.id}>
                      ✎ [{mod.id}] {mod.name}
                      <div className="diff-modified-details">
                        {mod.changes.map((ch, idx) => {
                          const getFieldLabel = (field) => {
                            switch(field) {
                              case 'name': return t('diffNodeName');
                              case 'produce': return t('diffNodeProduce');
                              case 'vibeNotes': return t('diffNodeVibeNotes');
                              case 'dependencies': return t('diffNodeDeps');
                              case 'filePath': return t('diffNodeFilePath');
                              case 'status': return t('diffNodeStatus');
                              case 'intentSignal': return t('diffNodeIntent');
                              case 'extractedConstraints': return t('diffNodeExtConstraints');
                              default: return field;
                            }
                          };
                          return (
                            <div className="diff-change-line" key={idx}>
                              {getFieldLabel(ch.field)}:{' '}
                              <span className="old-val">{ch.old || '(empty)'}</span>
                              {' ➔ '}
                              <span className="new-val">{ch.new || '(empty)'}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 2. Glossary */}
            {(diff.glossaryChanges.added.length > 0 || diff.glossaryChanges.deleted.length > 0 || diff.glossaryChanges.modified.length > 0) && (
              <div className="diff-section">
                <div className="diff-section-title">{t('diffGlossaryTitle')}</div>
                <div className="diff-list">
                  {diff.glossaryChanges.added.map(item => (
                    <div className="diff-item added" key={item.key}>
                      + {item.key}: {item.value}
                    </div>
                  ))}
                  {diff.glossaryChanges.deleted.map(item => (
                    <div className="diff-item deleted" key={item.key}>
                      - {item.key}: {item.value}
                    </div>
                  ))}
                  {diff.glossaryChanges.modified.map(item => (
                    <div className="diff-item modified" key={item.key}>
                      ✎ {item.key}:
                      <div className="diff-modified-details">
                        <div className="diff-change-line">
                          <span className="old-val">{item.oldValue || '(empty)'}</span>
                          {' ➔ '}
                          <span className="new-val">{item.newValue || '(empty)'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. Global Constraints */}
            {(diff.constraintChanges.added.length > 0 || diff.constraintChanges.deleted.length > 0) && (
              <div className="diff-section">
                <div className="diff-section-title">{t('diffConstraintsTitle')}</div>
                <div className="diff-list">
                  {diff.constraintChanges.added.map((item, idx) => (
                    <div className="diff-item added" key={idx}>
                      + {item}
                    </div>
                  ))}
                  {diff.constraintChanges.deleted.map((item, idx) => (
                    <div className="diff-item deleted" key={idx}>
                      - {item}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        
        <div className="modal-actions">
          {onCancel && (
            <button 
              className="btn" 
              style={{ background: type === 'diff' ? '#ef4444' : '#374151', padding: '8px 16px', fontSize: '0.85rem', boxShadow: 'none' }}
              onClick={onCancel}
            >
              {type === 'diff' ? t('diffRevertBtn') : (language === 'en' ? 'Cancel' : '取消')}
            </button>
          )}
          <button 
            className="btn" 
            style={{ padding: '8px 20px', fontSize: '0.85rem' }}
            onClick={handleSubmit}
          >
            {type === 'diff' ? t('diffApplyBtn') : (language === 'en' ? 'Confirm' : '確定')}
          </button>
        </div>
      </div>
    </div>
  );
}

function getGraphDiff(oldGraph, newGraph) {
  const oldNodes = oldGraph.nodes || [];
  const newNodes = newGraph.nodes || [];
  const oldGlossary = oldGraph.glossary || {};
  const newGlossary = newGraph.glossary || {};
  
  const normalizeConstraints = (c) => {
    if (Array.isArray(c)) return c;
    if (c && typeof c === 'object') return Object.entries(c).map(([k, v]) => `${k}: ${v}`);
    return [];
  };
  const oldConstraints = normalizeConstraints(oldGraph.globalConstraints);
  const newConstraints = normalizeConstraints(newGraph.globalConstraints);

  const nodeChanges = { added: [], deleted: [], modified: [] };
  const glossaryChanges = { added: [], deleted: [], modified: [] };
  const constraintChanges = { added: [], deleted: [] };

  const oldNodesMap = new Map(oldNodes.map(n => [n.id, n]));
  const newNodesMap = new Map(newNodes.map(n => [n.id, n]));

  // Node added & modified
  for (const [id, node] of newNodesMap.entries()) {
    if (!oldNodesMap.has(id)) {
      nodeChanges.added.push(node);
    } else {
      const oldNode = oldNodesMap.get(id);
      const changes = [];
      
      if ((oldNode.name || '') !== (node.name || '')) {
        changes.push({ field: 'name', old: oldNode.name || '', new: node.name || '' });
      }
      if ((oldNode.produce || '') !== (node.produce || '')) {
        changes.push({ field: 'produce', old: oldNode.produce || '', new: node.produce || '' });
      }
      if ((oldNode.vibeNotes || '') !== (node.vibeNotes || '')) {
        changes.push({ field: 'vibeNotes', old: oldNode.vibeNotes || '', new: node.vibeNotes || '' });
      }
      
      const oldDeps = oldNode.dependencies || [];
      const newDeps = node.dependencies || [];
      if (JSON.stringify(oldDeps.slice().sort()) !== JSON.stringify(newDeps.slice().sort())) {
        changes.push({ field: 'dependencies', old: oldDeps.join(', '), new: newDeps.join(', ') });
      }

      const oldSynth = oldNode.synthesis || {};
      const newSynth = node.synthesis || {};
      if ((oldSynth.filePath || '') !== (newSynth.filePath || '')) {
        changes.push({ field: 'filePath', old: oldSynth.filePath || '', new: newSynth.filePath || '' });
      }
      if ((oldSynth.status || '') !== (newSynth.status || '')) {
        changes.push({ field: 'status', old: oldSynth.status || '', new: newSynth.status || '' });
      }
      if ((oldSynth.intentSignal || '') !== (newSynth.intentSignal || '')) {
        changes.push({ field: 'intentSignal', old: oldSynth.intentSignal || '', new: newSynth.intentSignal || '' });
      }
      
      const oldExt = oldSynth.extractedConstraints || [];
      const newExt = newSynth.extractedConstraints || [];
      if (JSON.stringify(oldExt.slice().sort()) !== JSON.stringify(newExt.slice().sort())) {
        changes.push({ field: 'extractedConstraints', old: oldExt.join(', '), new: newExt.join(', ') });
      }

      if (changes.length > 0) {
        nodeChanges.modified.push({
          id,
          name: node.name || oldNode.name || id,
          changes
        });
      }
    }
  }

  // Node deleted
  for (const [id, node] of oldNodesMap.entries()) {
    if (!newNodesMap.has(id)) {
      nodeChanges.deleted.push(node);
    }
  }

  // Glossary
  for (const [key, value] of Object.entries(newGlossary)) {
    if (!(key in oldGlossary)) {
      glossaryChanges.added.push({ key, value });
    } else if (oldGlossary[key] !== value) {
      glossaryChanges.modified.push({ key, oldValue: oldGlossary[key], newValue: value });
    }
  }
  for (const [key, value] of Object.entries(oldGlossary)) {
    if (!(key in newGlossary)) {
      glossaryChanges.deleted.push({ key, value });
    }
  }

  // Constraints
  for (const c of newConstraints) {
    if (!oldConstraints.includes(c)) {
      constraintChanges.added.push(c);
    }
  }
  for (const c of oldConstraints) {
    if (!newConstraints.includes(c)) {
      constraintChanges.deleted.push(c);
    }
  }

  const hasChanges = 
    nodeChanges.added.length > 0 ||
    nodeChanges.deleted.length > 0 ||
    nodeChanges.modified.length > 0 ||
    glossaryChanges.added.length > 0 ||
    glossaryChanges.deleted.length > 0 ||
    glossaryChanges.modified.length > 0 ||
    constraintChanges.added.length > 0 ||
    constraintChanges.deleted.length > 0;

  return {
    nodeChanges,
    glossaryChanges,
    constraintChanges,
    hasChanges
  };
}

