const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'webview/src/components/PromptCompiler.jsx');
const resolvedPath = path.resolve(filePath);

console.log('Reading file:', resolvedPath);
let content = fs.readFileSync(resolvedPath, 'utf8');

// 1. Remove state variables
content = content.replace("  const [codeToApply, setCodeToApply] = useState('');\n  const [targetPath, setTargetPath] = useState('');\n", "");

// 2. Clean up the useEffect synchronizer
const useEffectOriginal = `  // Synchronize target file path when node changes
  useEffect(() => {
    if (activeNode) {
      setTargetPath(activeNode.synthesis?.filePath || '');
      setCompiledPrompt('');
      setCodeToApply('');
    }
  }, [activeNode]);`;

const useEffectNew = `  // Synchronize target file path when node changes
  useEffect(() => {
    if (activeNode) {
      setCompiledPrompt('');
    }
  }, [activeNode]);`;

content = content.replace(useEffectOriginal, useEffectNew);

// 3. Remove handleApplyCode function
const handleApplyCodeRegex = /\s*\/\/ Promise-based async file write apply[\s\S]*?async\s+\(\s*\)\s*=>\s*\{[\s\S]*?^\x20\x20\};/m;
content = content.replace(handleApplyCodeRegex, "");

// 4. Remove the Apply Code UI block in return JSX
const applyCodeUiRegex = /\{\/\* Apply Code Section \*\/\}[\s\S]*?<\/button>\s*<\/div>/;
content = content.replace(applyCodeUiRegex, "");

fs.writeFileSync(resolvedPath, content, 'utf8');
console.log('Successfully cleaned up PromptCompiler.jsx (Removed Apply Code panel)!');
