import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { locales } from './locales';

const WorkspaceContext = createContext(null);

// 1. Safe VS Code API acquisition with browser fallback mock
const isVsCode = typeof acquireVsCodeApi !== 'undefined';
const isIntelliJ = typeof window.cefQuery !== 'undefined';

const vscode = (() => {
  if (isVsCode) {
    return acquireVsCodeApi();
  } else if (isIntelliJ) {
    return {
      postMessage: (message) => {
        window.cefQuery({
          request: JSON.stringify(message),
          onSuccess: (response) => {
            console.log('[IntelliJ Host Response]:', response);
          },
          onFailure: (errCode, errMsg) => {
            console.error('[IntelliJ Host Error]:', errCode, errMsg);
          }
        });
      }
    };
  } else {
    console.warn('VibeGraph: Running in browser preview mode. Operations will be mocked.');
    return {
      postMessage: (message) => {
        console.log('[Mock VSCode Host Receive]:', message);
        if (message.command === 'ready') {
          let savedData = null;
          try {
            const raw = localStorage.getItem('vibegraph_system_graph');
            if (raw) {
              savedData = JSON.parse(raw);
            }
          } catch (e) {
            console.error('Failed to load saved graph from localStorage:', e);
          }
          setTimeout(() => {
            window.postMessage({
              type: 'init',
              workspaceRoot: 'Web Browser Mode',
              graph: savedData,
              language: navigator.language || 'zh-TW'
            }, '*');
          }, 300);
        } else if (message.command === 'saveGraph') {
          try {
            localStorage.setItem('vibegraph_system_graph', JSON.stringify(message.data, null, 2));
          } catch (e) {
            console.error('Failed to save graph to localStorage:', e);
          }
        } else if (message.command === 'readFiles') {
          setTimeout(() => {
            const mockFiles = {};
            message.files.forEach(f => {
              mockFiles[f] = `// [Web App Mode] File: ${f}\n// File reading is disabled in standalone web app.`;
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
              success: false,
              error: 'File writing is not supported in the standalone web app.'
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
            
            const incomingGlossary = message.graph.glossary || {};
            const incomingNodesRaw = message.graph.nodes || [];

            const glossaryChanged = isGlossaryChanged(glossaryRef.current, incomingGlossary);
            const constraintsChanged = isGlobalConstraintsChanged(constraintsRef.current, incomingConstraints);

            let finalNodes = incomingNodesRaw;
            if (glossaryChanged || constraintsChanged) {
              finalNodes = incomingNodesRaw.map(node => {
                if (node.synthesis?.status !== 'todo') {
                  return {
                    ...node,
                    synthesis: {
                      ...(node.synthesis || {}),
                      status: 'todo'
                    }
                  };
                }
                return node;
              });
            } else {
              finalNodes = getAdjustedNodesWithTodoPropagation(nodesRef.current, incomingNodesRaw);
            }

            const incomingGraph = {
              glossary: incomingGlossary,
              globalConstraints: incomingConstraints,
              nodes: finalNodes
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

            setGlossary(incomingGlossary);
            setGlobalConstraints(incomingConstraints);
            setNodes(finalNodes);

            const hasStatusAdjustments = JSON.stringify(incomingNodesRaw) !== JSON.stringify(finalNodes);
            if (hasStatusAdjustments) {
              saveGraph(incomingGlossary, incomingConstraints, finalNodes);
            }

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
                  const newStatus = (fsEvent === 'create' || fsEvent === 'change') ? 'completed' : 'todo';
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
    const changed = isGlossaryChanged(glossaryRef.current, newGlossary);
    let updatedNodes = nodes;
    if (changed) {
      updatedNodes = nodes.map(node => {
        if (node.synthesis?.status !== 'todo') {
          return {
            ...node,
            synthesis: {
              ...(node.synthesis || {}),
              status: 'todo'
            }
          };
        }
        return node;
      });
      setNodes(updatedNodes);
    }
    setGlossary(newGlossary);
    saveGraph(newGlossary, globalConstraints, updatedNodes);
  };

  const updateGlobalConstraints = (newConstraints) => {
    const changed = isGlobalConstraintsChanged(constraintsRef.current, newConstraints);
    let updatedNodes = nodes;
    if (changed) {
      updatedNodes = nodes.map(node => {
        if (node.synthesis?.status !== 'todo') {
          return {
            ...node,
            synthesis: {
              ...(node.synthesis || {}),
              status: 'todo'
            }
          };
        }
        return node;
      });
      setNodes(updatedNodes);
    }
    setGlobalConstraints(newConstraints);
    saveGraph(glossary, newConstraints, updatedNodes);
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
    const rawUpdatedNodes = nodes.map(n => n.id === updatedNode.id ? updatedNode : n);
    const updatedNodes = getAdjustedNodesWithTodoPropagation(nodesRef.current, rawUpdatedNodes);
    setNodes(updatedNodes);
    saveGraph(glossary, globalConstraints, updatedNodes);
  };

  const deleteNode = (nodeId) => {
    let rawUpdatedNodes = nodes.filter(n => n.id !== nodeId);
    // Cascade remove dependencies
    rawUpdatedNodes = rawUpdatedNodes.map(n => ({
      ...n,
      dependencies: (n.dependencies || []).filter(id => id !== nodeId)
    }));
    const updatedNodes = getAdjustedNodesWithTodoPropagation(nodesRef.current, rawUpdatedNodes);
    setNodes(updatedNodes);
    saveGraph(glossary, globalConstraints, updatedNodes);
  };

  const updateDependencies = (nodeId, newDeps) => {
    const rawUpdatedNodes = nodes.map(n => {
      if (n.id === nodeId) {
        return { ...n, dependencies: newDeps };
      }
      return n;
    });
    const updatedNodes = getAdjustedNodesWithTodoPropagation(nodesRef.current, rawUpdatedNodes);
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

  const showPrompt = (message, defaultValue = '', multiline = false, allowImages = false) => {
    return new Promise((resolve) => {
      setModalConfig({
        type: 'prompt',
        message,
        defaultValue,
        multiline,
        allowImages,
        onConfirm: (val, images = []) => {
          setModalConfig(null);
          if (allowImages) {
            resolve({ text: val, images });
          } else {
            resolve(val);
          }
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

      const glossaryChanged = isGlossaryChanged(glossaryRef.current, updatedGlossary);
      const constraintsChanged = isGlobalConstraintsChanged(constraintsRef.current, updatedConstraints);

      let finalNodes = updatedNodes;
      if (glossaryChanged || constraintsChanged) {
        finalNodes = updatedNodes.map(node => {
          if (node.synthesis?.status !== 'todo') {
            return {
              ...node,
              synthesis: {
                ...(node.synthesis || {}),
                status: 'todo'
              }
            };
          }
          return node;
        });
      } else {
        finalNodes = getAdjustedNodesWithTodoPropagation(nodesRef.current, updatedNodes);
      }

      const oldGraph = {
        nodes: nodesRef.current,
        glossary: glossaryRef.current,
        globalConstraints: constraintsRef.current
      };

      const newGraph = {
        nodes: finalNodes,
        glossary: updatedGlossary,
        globalConstraints: updatedConstraints
      };

      const diff = getGraphDiff(oldGraph, newGraph);

      // Apply directly
      setGlossary(updatedGlossary);
      setGlobalConstraints(updatedConstraints);
      setNodes(finalNodes);
      saveGraph(updatedGlossary, updatedConstraints, finalNodes);

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

  const exportGraphJSON = () => {
    const graphData = {
      glossary: glossaryRef.current,
      globalConstraints: constraintsRef.current,
      nodes: nodesRef.current
    };
    const jsonStr = JSON.stringify(graphData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'system-graph.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <WorkspaceContext.Provider value={{
      isVsCode: isVsCode || isIntelliJ,
      isIntelliJ,
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
      importGraphJSON,
      exportGraphJSON
    }}>
      {children}
      {modalConfig && <CustomModal {...modalConfig} language={language} t={t} />}
    </WorkspaceContext.Provider>
  );
}


function CustomModal({ type, message, defaultValue, onConfirm, onCancel, language, multiline, diff, isAutoDetect, t, allowImages }) {
  const [value, setValue] = useState(defaultValue || '');
  const [images, setImages] = useState([]);
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      if (!multiline) {
        inputRef.current.select();
      }
    }
  }, []);

  const compressAndAddImages = (files) => {
    const validFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (validFiles.length === 0) return;

    if (images.length + validFiles.length > 5) {
      alert(t('maxImagesLimitAlert'));
      return;
    }

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
          setImages(prev => {
            if (prev.length >= 5) return prev;
            return [...prev, compressedBase64];
          });
        };
      };
      reader.readAsDataURL(file);
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !multiline) {
      handleSubmit();
    } else if (e.key === 'Escape') {
      if (onCancel) onCancel();
    }
  };

  const handleSubmit = () => {
    if (type === 'prompt') {
      if (allowImages) {
        onConfirm(value, images);
      } else {
        onConfirm(value);
      }
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
          <>
            {multiline ? (
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
            )}

            {allowImages && (
              <div style={{ marginTop: '12px' }}>
                {images.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                    {images.map((img, idx) => (
                      <div key={idx} style={{ position: 'relative', border: '1px solid var(--panel-border)', borderRadius: '6px', width: '60px', height: '60px', overflow: 'hidden', background: '#000' }}>
                        <img src={img} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        <button 
                          onClick={() => setImages(prev => prev.filter((_, i) => i !== idx))}
                          style={{ position: 'absolute', top: '2px', right: '2px', background: 'rgba(239, 68, 68, 0.8)', border: 'none', color: '#fff', borderRadius: '50%', width: '16px', height: '16px', fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                <div 
                  className="image-dropzone"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    compressAndAddImages(e.dataTransfer.files);
                  }}
                  onPaste={(e) => {
                    compressAndAddImages(e.clipboardData.files);
                  }}
                  onClick={() => document.getElementById('modal-image-input').click()}
                  style={{
                    border: '1px dashed var(--panel-border)',
                    borderRadius: '8px',
                    padding: '12px 10px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    background: 'rgba(0, 0, 0, 0.15)',
                    outline: 'none',
                    marginBottom: '14px',
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)'
                  }}
                >
                  <input 
                    id="modal-image-input"
                    type="file"
                    accept="image/*"
                    multiple
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      if (e.target.files) {
                        compressAndAddImages(e.target.files);
                      }
                    }}
                  />
                  <span>🖼️ {t('vibeImagePlaceholder')} ({images.length}/5)</span>
                </div>
              </div>
            )}
          </>
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
                      + {typeof item === 'object' && item !== null ? `${item.text || ''} ${item.vibeImages && item.vibeImages.length > 0 ? `(🖼️ x${item.vibeImages.length})` : ''}` : item}
                    </div>
                  ))}
                  {diff.constraintChanges.deleted.map((item, idx) => (
                    <div className="diff-item deleted" key={idx}>
                      - {typeof item === 'object' && item !== null ? `${item.text || ''} ${item.vibeImages && item.vibeImages.length > 0 ? `(🖼️ x${item.vibeImages.length})` : ''}` : item}
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

function isGlossaryChanged(oldGlossary, newGlossary) {
  const oldKeys = Object.keys(oldGlossary || {}).sort();
  const newKeys = Object.keys(newGlossary || {}).sort();
  if (oldKeys.length !== newKeys.length) return true;
  for (let i = 0; i < oldKeys.length; i++) {
    if (oldKeys[i] !== newKeys[i]) return true;
    if (oldGlossary[oldKeys[i]] !== newGlossary[newKeys[i]]) return true;
  }
  return false;
}

function isGlobalConstraintsChanged(oldConstraints, newConstraints) {
  const oldSorted = [...(oldConstraints || [])].sort();
  const newSorted = [...(newConstraints || [])].sort();
  return JSON.stringify(oldSorted) !== JSON.stringify(newSorted);
}

function getAdjustedNodesWithTodoPropagation(oldNodes, newNodes) {
  const oldNodesMap = new Map((oldNodes || []).map(n => [n.id, n]));
  const directlyAffected = new Set();

  for (const node of newNodes) {
    const oldNode = oldNodesMap.get(node.id);
    if (!oldNode) {
      continue;
    }

    const oldDepsSorted = [...(oldNode.dependencies || [])].sort();
    const newDepsSorted = [...(node.dependencies || [])].sort();
    const depsChanged = JSON.stringify(oldDepsSorted) !== JSON.stringify(newDepsSorted);

    const oldConstraints = oldNode.synthesis?.extractedConstraints || [];
    const newConstraints = node.synthesis?.extractedConstraints || [];
    const constraintsChanged = oldConstraints.length !== newConstraints.length ||
      oldConstraints.some((c, idx) => c !== newConstraints[idx]);

    const specChanged =
      (node.name || '') !== (oldNode.name || '') ||
      (node.produce || '') !== (oldNode.produce || '') ||
      (node.vibeNotes || '') !== (oldNode.vibeNotes || '') ||
      (node.synthesis?.intentSignal || '') !== (oldNode.synthesis?.intentSignal || '') ||
      depsChanged ||
      constraintsChanged ||
      ((node.synthesis?.filePath || '') !== (oldNode.synthesis?.filePath || '') &&
       !(oldNode.synthesis?.status !== 'completed' && node.synthesis?.status === 'completed' && !oldNode.synthesis?.filePath));

    if (specChanged) {
      directlyAffected.add(node.id);
    }
  }

  if (directlyAffected.size === 0) {
    return newNodes;
  }

  const allAffected = new Set(directlyAffected);
  let addedNew = true;

  while (addedNew) {
    addedNew = false;
    for (const node of newNodes) {
      if (!allAffected.has(node.id)) {
        const hasAffectedDep = (node.dependencies || []).some(depId => allAffected.has(depId));
        if (hasAffectedDep) {
          allAffected.add(node.id);
          addedNew = true;
        }
      }
    }
  }

  return newNodes.map(node => {
    if (allAffected.has(node.id)) {
      if (node.synthesis?.status !== 'todo') {
        return {
          ...node,
          synthesis: {
            ...(node.synthesis || {}),
            status: 'todo'
          }
        };
      }
    }
    return node;
  });
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
    const exists = oldConstraints.some(oldC => JSON.stringify(oldC) === JSON.stringify(c));
    if (!exists) {
      constraintChanges.added.push(c);
    }
  }
  for (const c of oldConstraints) {
    const exists = newConstraints.some(newC => JSON.stringify(newC) === JSON.stringify(c));
    if (!exists) {
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

