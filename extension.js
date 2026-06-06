const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  console.log('VibeGraph extension is now active!');

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
      
      // Initialize file system watcher for real-time file detection
      watcher = vscode.workspace.createFileSystemWatcher('**/*');
      
      const handleFileChange = (uri, eventType) => {
        const relPath = path.relative(workspaceRoot, uri.fsPath).replace(/\\/g, '/');
        panel.webview.postMessage({
          type: 'fileSystemEvent',
          event: eventType,
          filePath: relPath
        });
      };

      watcher.onDidCreate((uri) => handleFileChange(uri, 'create'));
      watcher.onDidDelete((uri) => handleFileChange(uri, 'delete'));
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
