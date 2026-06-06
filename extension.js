const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  console.log('VibeGraph extension is now active!');

  // Create VibeGraph Status Bar Button for quick launch
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'vibegraph.open';
  statusBarItem.text = '$(graph) VibeGraph';
  statusBarItem.tooltip = 'Open VibeGraph Map Dashboard';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // ── Bootstrap command ─────────────────────────────────────────
  const bootstrapDisposable = vscode.commands.registerCommand('vibegraph.bootstrap', async () => {
    const goal = await vscode.window.showInputBox({
      prompt: '請描述您的系統願景 / Describe your system vision',
      placeHolder: '例如：做一個多人連線井字遊戲',
      ignoreFocusOut: true
    });
    if (!goal) return;

    const lang = vscode.env.language;
    const isZh = lang.startsWith('zh');

    const prompt = isZh
      ? `請作為軟體架構規劃專家，分析我接下來要建造的系統想法。\n我希望在專案根目錄下建立一個 \`system-graph.json\` 檔案。這個檔案是我們協同開發的唯一契約。\n請為我規劃以下三個部分，並輸出為純 JSON 格式（不要包含任何 markdown 標記或 \`\`\`json 區塊，直接輸出 JSON 內容）：\n\n1. "glossary": { "名詞": "定義與資料結構模型說明" }，提取系統的核心業務實體名詞。\n2. "globalConstraints": [ "全域系統約束條件（如技術棧、排版風格）" ]。\n3. "nodes": [\n     {\n       "id": "唯一的英文識別碼（例如 auth-helper）",\n       "name": "中文組件名稱",\n       "produce": "以主動動詞說明它產出什麼成果（例如 stores sessions locally）",\n       "vibeNotes": "該組件的補充說明備忘",\n       "dependencies": [ "依賴的其他 node id 陣列" ],\n       "synthesis": {\n         "filePath": "建議的實體檔案存放路徑（例如 src/utils/auth.js）",\n         "status": "todo",\n         "intentSignal": "精煉後的乾淨核心實作目的",\n         "extractedConstraints": [ "從說明中提煉出的具體技術規範（如不能用第三方庫）" ]\n       },\n       "trace": { "stale": false, "lastImplementedPrompt": "" }\n     }\n   ]\n\nJSON 必須嚴格符合此 schema，缺少任何欄位都會導致匯入失敗。\n\n我的系統功能願景是：\n${goal}`
      : `Please act as a software architecture expert, analyzing my system vision described below.\nI want to create a \`system-graph.json\` file in my project root directory. This file is our contract for co-development.\nPlease plan three sections and output in raw JSON format (no markdown code blocks, just raw JSON text):\n\n1. "glossary": { "Term": "definition and data structure model description" }, extracting key business entities.\n2. "globalConstraints": [ "global system constraints (e.g. tech stack, layout style)" ].\n3. "nodes": [\n     {\n       "id": "unique-english-id (e.g., auth-helper)",\n       "name": "Component Name",\n       "produce": "What does this produce? starting with active verb (e.g. stores sessions locally)",\n       "vibeNotes": "Supplementary developer memos for this node",\n       "dependencies": [ "array of dependent node ids" ],\n       "synthesis": {\n         "filePath": "recommended file path (e.g., src/utils/auth.js)",\n         "status": "todo",\n         "intentSignal": "distilled clean core implementation goal",\n         "extractedConstraints": [ "distilled technical constraints from notes (e.g., no external packages)" ],\n         "userOverridden": false\n       },\n       "trace": { "stale": false, "lastImplementedPrompt": "" }\n     }\n   ]\n\nThe JSON must strictly follow this schema. Any missing fields will cause import errors.\n\nMy system vision is:\n${goal}`;

    await vscode.env.clipboard.writeText(prompt);
    vscode.window.showInformationMessage(
      isZh ? '✅ Bootstrap Prompt 已複製到剪貼簿！請貼到 AI 聊天視窗。' : '✅ Bootstrap Prompt copied! Paste it into your AI chat.'
    );
  });
  context.subscriptions.push(bootstrapDisposable);

  let disposable = vscode.commands.registerCommand('vibegraph.open', () => {
    // Create and show Webview Panel
    const panel = vscode.window.createWebviewPanel(
      'vibeGraph',
      'VibeGraph Dashboard',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.file(path.join(context.extensionPath, 'webview', 'dist'))
        ]
      }
    );

    panel.webview.html = getWebviewContent(panel.webview, context);

    const workspaceFolders = vscode.workspace.workspaceFolders;
    let watcher;
    if (workspaceFolders && workspaceFolders.length > 0) {
      const workspaceRoot = workspaceFolders[0].uri.fsPath;
      const graphPath = path.join(workspaceRoot, 'system-graph.json');
      
      // Initialize file system watcher for real-time file detection
      watcher = vscode.workspace.createFileSystemWatcher('**/*');
      
      const handleFileChange = (uri, eventType) => {
        // If system-graph.json is modified on disk, notify the webview immediately
        if (uri.fsPath === graphPath) {
          if (fs.existsSync(graphPath)) {
            try {
              const raw = fs.readFileSync(graphPath, 'utf8');
              const graphData = JSON.parse(raw);
              panel.webview.postMessage({
                type: 'graphFileChanged',
                graph: graphData
              });
            } catch (err) {
              panel.webview.postMessage({
                type: 'graphFileError',
                error: err.message
              });
            }
          }
          return;
        }

        const relPath = path.relative(workspaceRoot, uri.fsPath).replace(/\\/g, '/');
        panel.webview.postMessage({
          type: 'fileSystemEvent',
          event: eventType,
          filePath: relPath
        });
      };

      watcher.onDidCreate((uri) => handleFileChange(uri, 'create'));
      watcher.onDidDelete((uri) => handleFileChange(uri, 'delete'));
      watcher.onDidChange((uri) => handleFileChange(uri, 'change'));
    }

    panel.onDidDispose(() => {
      if (watcher) watcher.dispose();
    });

    // Handle messages from Webview
    panel.webview.onDidReceiveMessage(
      async (message) => {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
          vscode.window.showErrorMessage('VibeGraph: Please open a workspace folder first.');
          return;
        }
        const workspaceRoot = workspaceFolders[0].uri.fsPath;
        const graphPath = path.join(workspaceRoot, 'system-graph.json');

        switch (message.command) {
          case 'ready':
            // Read system-graph.json if it exists
            let graphData = null;
            if (fs.existsSync(graphPath)) {
              try {
                const raw = fs.readFileSync(graphPath, 'utf8');
                graphData = JSON.parse(raw);
              } catch (err) {
                vscode.window.showErrorMessage('VibeGraph: Error parsing system-graph.json: ' + err.message);
              }
            }

            // Sync node statuses based on physical file presence
            if (graphData && Array.isArray(graphData.nodes)) {
              let graphChanged = false;
              graphData.nodes = graphData.nodes.map(node => {
                const filePath = node.synthesis?.filePath;
                if (filePath) {
                  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(workspaceRoot, filePath);
                  const fileExists = fs.existsSync(fullPath) && fs.statSync(fullPath).isFile();
                  const expectedStatus = fileExists ? 'completed' : 'todo';
                  if (node.synthesis?.status !== expectedStatus) {
                    graphChanged = true;
                    return {
                      ...node,
                      synthesis: {
                        ...(node.synthesis || {}),
                        status: expectedStatus
                      }
                    };
                  }
                }
                return node;
              });
              if (graphChanged) {
                try {
                  fs.writeFileSync(graphPath, JSON.stringify(graphData, null, 2), 'utf8');
                } catch (e) {
                  console.error('Failed to sync system-graph.json', e);
                }
              }
            }

            // Send init data
            panel.webview.postMessage({
              type: 'init',
              workspaceRoot: workspaceRoot,
              graph: graphData,
              language: vscode.env.language
            });
            break;

          case 'saveGraph':
            // Save graph data to system-graph.json
            try {
              fs.writeFileSync(graphPath, JSON.stringify(message.data, null, 2), 'utf8');
              vscode.window.setStatusBarMessage('VibeGraph: system-graph.json saved successfully.', 3000);
            } catch (err) {
              vscode.window.showErrorMessage('VibeGraph: Error saving system-graph.json: ' + err.message);
            }
            break;

          case 'readFiles':
            // Read contents of requested files
            const fileContents = {};
            for (const relPath of message.files) {
              const fullPath = path.isAbsolute(relPath) ? relPath : path.join(workspaceRoot, relPath);
              if (fs.existsSync(fullPath)) {
                try {
                  fileContents[relPath] = fs.readFileSync(fullPath, 'utf8');
                } catch (err) {
                  fileContents[relPath] = `// Error reading file: ${err.message}`;
                }
              } else {
                fileContents[relPath] = `// File does not exist yet at path: ${relPath}`;
              }
            }
            panel.webview.postMessage({
              type: 'filesRead',
              requestId: message.requestId,
              files: fileContents
            });
            break;

          case 'writeFile':
            // Write code content to target file
            try {
              const targetPath = path.isAbsolute(message.filePath)
                ? message.filePath
                : path.join(workspaceRoot, message.filePath);

              // Ensure directory exists
              const dir = path.dirname(targetPath);
              if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
              }

              fs.writeFileSync(targetPath, message.codeContent, 'utf8');
              vscode.window.showInformationMessage(`VibeGraph: Applied code successfully to ${path.basename(targetPath)}`);

              // Notify webview of success
              panel.webview.postMessage({
                type: 'fileWritten',
                requestId: message.requestId,
                success: true,
                filePath: message.filePath
              });
            } catch (err) {
              vscode.window.showErrorMessage('VibeGraph: Error writing file: ' + err.message);
              panel.webview.postMessage({
                type: 'fileWritten',
                requestId: message.requestId,
                success: false,
                error: err.message
              });
            }
            break;

          case 'openFile':
            // Open target file in editor
            try {
              const targetPath = path.isAbsolute(message.filePath)
                ? message.filePath
                : path.join(workspaceRoot, message.filePath);

              if (fs.existsSync(targetPath)) {
                const doc = await vscode.workspace.openTextDocument(targetPath);
                await vscode.window.showTextDocument(doc);
              } else {
                vscode.window.showWarningMessage(`VibeGraph: File does not exist yet: ${message.filePath}`);
              }
            } catch (err) {
              vscode.window.showErrorMessage('VibeGraph: Error opening file: ' + err.message);
            }
            break;
        }
      },
      undefined,
      context.subscriptions
    );
  });

  context.subscriptions.push(disposable);
}

/**
 * Generates Webview HTML, scanning Vite assets folder dynamically.
 * @param {vscode.Webview} webview
 * @param {vscode.ExtensionContext} context
 */
function getWebviewContent(webview, context) {
  const distDir = path.join(context.extensionPath, 'webview', 'dist');
  const assetsDir = path.join(distDir, 'assets');

  let jsFile = '';
  let cssFile = '';

  if (fs.existsSync(assetsDir)) {
    const files = fs.readdirSync(assetsDir);
    const mainJs = files.find(f => f.endsWith('.js'));
    const mainCss = files.find(f => f.endsWith('.css'));
    if (mainJs) jsFile = mainJs;
    if (mainCss) cssFile = mainCss;
  }

  if (!jsFile) {
    // Fallback if not compiled yet
    return `<!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: sans-serif; padding: 20px; color: #ccc; background: #1e1e1e; }
          </style>
        </head>
        <body>
          <h2>VibeGraph Webview Build Missing</h2>
          <p>Please compile the webview assets by running <code>npm run webview-build</code> in the extension directory first.</p>
        </body>
      </html>`;
  }

  const jsUri = webview.asWebviewUri(vscode.Uri.file(path.join(assetsDir, jsFile)));
  const cssUri = webview.asWebviewUri(vscode.Uri.file(path.join(assetsDir, cssFile)));

  return `<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>VibeGraph</title>
        <link rel="stylesheet" href="${cssUri}" />
      </head>
      <body>
        <div id="root"></div>
        <script type="module" src="${jsUri}"></script>
      </body>
    </html>`;
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
};
