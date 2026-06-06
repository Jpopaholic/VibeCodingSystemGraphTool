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
            setGlobalConstraints(message.graph.globalConstraints || []);
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
      saveGraph
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
}
