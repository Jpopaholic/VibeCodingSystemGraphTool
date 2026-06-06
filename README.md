# VibeGraph 🚀
> Vibe Coding 系統規劃與約束契約地圖 (Visual Constraint Map & Prompt Compiler for Vibe Coding)

VibeGraph 是一個為 **Vibe Coding** 量身打造的 VS Code / Cursor 視覺化規劃插件。它採用「智能微推引導」與「三層架構解耦」，在背後默默協助開發者理清程式碼結構、對齊名詞定義，但**不強制鎖定您的開發流程、不施加工程化條款**，維持 Vibe Coding 的自由與直覺。

---

## 🎨 核心設計特色

1. **🟢 🟡 🔴 三層架構分離 (Three-Layer Architecture)**：
   - **🟢 Layer 1: Graph Layer (使用者操作層)**：UI 主線，僅包含名稱、**產出預期 (produce)**、隨筆備忘及依賴。完全不顯示任何程式碼與路徑，防止 IDE 化。
   - **🟡 Synthesis Layer (系統合成層)**：AI 自動映射檔案路徑，由編譯器進行狀態追蹤，無需手動配置檔案綁定。
   - **🔴 Trace Layer (Debug 軌跡層)**：後台默默儲存開發 Prompt 歷史，作為重構時的上下文參考，不干擾主要視覺。

2. **💡 智能微推引導 (Soft Nudge System)**：
   - **推進微推 (Progression Nudge)**：分析依賴關係，為建議優先開發的底層節點提供紫色呼吸霓虹微光。
   - **關係微推 (Connection Nudge)**：自動偵測未與任何服務連線的 UI 節點，提示進行依賴關聯。
   - **名詞微推 (Glossary Nudge)**：撰寫隨筆時如果提到類似詞彙，提示對齊業務名詞定義表以保持命名一致。

3. **🎯 最小核心錨點與句型引導 (Minimal Anchor & Sentence Shape)**：
   - 每個節點以 **「What does this produce? (產出預期)」** 為中心設計。
   - UI 內建 **Soft Template UI Hint**（Placeholder 輪播與句型引導），引導使用者寫出如 `"stores notes locally"`、`"lets user do..."` 等主動動詞句型，維持地圖的功能連貫性。

4. **👑 使用者絕對主導權 (User Sovereignty)**：
   - AI 預處理為無阻塞且可逆的草稿提案。一旦使用者在 UI 中點擊「✏️ 修改」覆寫任何欄位，該節點會標記 `userOverridden: true`。後續 AI 專案掃描時**絕對禁止**覆蓋您的心智成果，也可點擊「🗑️ 重置」回 AI 建議。

---

## 📂 專案檔案結構

```
├── .vscode/
│   └── launch.json         # VS Code 沙盒偵錯啟動配置
├── webview/
│   ├── src/
│   │   ├── components/
│   │   │   ├── AIBox.jsx           # 全局名詞、全局約束與 AI 工具箱
│   │   │   ├── GraphCanvas.jsx     # 基於 React Flow & Dagre 的自動佈局畫布
│   │   │   ├── NodeEditor.jsx      # 節點設定、句型引導與 Synthesis 編輯
│   │   │   └── PromptCompiler.jsx  # 一鍵 Prompt 生成與實體代碼寫入/套用
│   │   ├── App.jsx                 # Webview 主控台與 Interop 通訊橋接
│   │   ├── index.css               # 發光太空深色主題與玻璃擬態 CSS
│   │   └── main.jsx                # React 渲染入口
│   └── vite.config.js      # 配置 relative base 以適應 webview 沙盒
├── extension.js            # VS Code 插件後端。處理檔案讀寫與 IPC 訊息
├── package.json            # 插件 Manifest 與建置指令
└── README.md               # 本 onboarding 說明文件
```

---

## 🛠️ 開發、偵錯與打包指引

### 1. 安裝與建置
在專案根目錄下，執行以下指令安裝依賴並建置 Webview 前端：
```bash
# 安裝前端依賴
npm run webview-install

# 編譯 Webview 前端靜態資源 (Vite React)
npm run webview-build
```

### 2. 沙盒偵錯 (沙盒演練)
1. 用 VS Code / Cursor 開啟本專案資料夾。
2. 切換到左側「Run and Debug」面板 (`Ctrl+Shift+D`)，選擇 **「Launch Extension」**。
3. 按下 **`F5`** 鍵啟動偵錯。
4. 系統會自動彈出一個全新的 `[Extension Development Host]` VS Code 視窗。
5. 在此沙盒視窗中開啟一個空的資料夾，按下 `Ctrl+Shift+P` 喚出命令列，執行 `VibeGraph: Open Graph Map`，即可在裡面盡情演練！

### 3. 正式打包與安裝
如果您想在個人的 Cursor / VS Code 中 formally 使用此插件：
1. 確保已安裝 `vsce` 打包工具 (`npm install -g @vscode/vsce`)。
2. 在專案根目錄執行：
   ```bash
   npm run package
   ```
3. 這會生成一個安裝包檔案，例如 `vibegraph-0.0.1.vsix`。
4. 打開您的 Cursor，進入「Extensions」面板，點擊右上角 `...` 選單選擇 **「Install from VSIX...」**，選取該檔案即可安裝完成！
