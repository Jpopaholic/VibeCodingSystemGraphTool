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
  const [modalConfig, setModalConfig] = useState(null);

  useEffect(() => {
    glossaryRef.current = glossary;
  }, [glossary]);

  useEffect(() => {
    constraintsRef.current = globalConstraints;
  }, [globalConstraints]);

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
            setGlossary(message.graph.glossary || {});
            let constraints = [];
            if (Array.isArray(message.graph.globalConstraints)) {
              constraints = message.graph.globalConstraints;
            } else if (message.graph.globalConstraints && typeof message.graph.globalConstraints === 'object') {
              constraints = Object.entries(message.graph.globalConstraints).map(([k, v]) => `${k}: ${v}`);
            }
            setGlobalConstraints(constraints);
            setNodes(message.graph.nodes || []);
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
            setGlossary(message.graph.glossary || {});
            let constraints = [];
            if (Array.isArray(message.graph.globalConstraints)) {
              constraints = message.graph.globalConstraints;
            } else if (message.graph.globalConstraints && typeof message.graph.globalConstraints === 'object') {
              constraints = Object.entries(message.graph.globalConstraints).map(([k, v]) => `${k}: ${v}`);
            }
            setGlobalConstraints(constraints);
            setNodes(message.graph.nodes || []);
          } else {
            setGlossary({});
            setGlobalConstraints([]);
            setNodes([]);
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
    vscode.postMessage({
      command: 'saveGraph',
      data: {
        glossary: updatedGlossary,
        globalConstraints: updatedConstraints,
        nodes: updatedNodes
      }
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
      const parsed = JSON.parse(jsonString);
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

      setGlossary(updatedGlossary);
      setGlobalConstraints(updatedConstraints);
      setNodes(updatedNodes);
      saveGraph(updatedGlossary, updatedConstraints, updatedNodes);
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
      {modalConfig && <CustomModal {...modalConfig} language={language} />}
    </WorkspaceContext.Provider>
  );
}

function CustomModal({ type, message, defaultValue, onConfirm, onCancel, language, multiline }) {
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
      <div className="modal-card" style={multiline ? { maxWidth: '600px', width: '90%' } : {}}>
        <div className="modal-message" style={{ whiteSpace: 'pre-line' }}>{message}</div>
        
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
        
        <div className="modal-actions">
          {onCancel && (
            <button 
              className="btn" 
              style={{ background: '#374151', padding: '8px 16px', fontSize: '0.85rem', boxShadow: 'none' }}
              onClick={onCancel}
            >
              {language === 'en' ? 'Cancel' : '取消'}
            </button>
          )}
          <button 
            className="btn" 
            style={{ padding: '8px 20px', fontSize: '0.85rem' }}
            onClick={handleSubmit}
          >
            {language === 'en' ? 'Confirm' : '確定'}
          </button>
        </div>
      </div>
    </div>
  );
}
