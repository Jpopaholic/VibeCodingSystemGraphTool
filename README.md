# VibeGraph 🚀
> Vibe Coding 系統規劃與約束契約地圖 (Visual Constraint Map & Prompt Compiler for Vibe Coding)

VibeGraph 是一個為 **Vibe Coding** 量身打造的 VS Code 視覺化規劃插件。它採用「智能微推引導」與「三層架構解耦」，在背後默默協助開發者理清程式碼結構、對齊名詞定義，但**不強制鎖定您的開發流程、不施加工程化條款**，維持 Vibe Coding 的自由與直覺。

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

## 🌐 雙模式相容運作 (Dual-Mode Compatibility)

VibeGraph 支援雙模式無縫相容，會自動偵測當前執行環境（`VS Code` 或 `獨立 Web 瀏覽器`）並自動調整 UI 和功能：

1. **📦 VS Code 插件模式 (VS Code Extension Mode)**
   - **完全功能**：支援實體檔案路徑連結、實體檔案系統讀寫、即時檔案監聽同步（File Watcher）、程式碼一鍵套用與寫入。
   - **如何使用**：依照下方的沙盒偵錯或安裝教學，將 VSIX 套件安裝至編輯器中。

2. **🌐 獨立 Web App 模式 (Standalone Web App Mode)**
   - **安全鎖定**：自動停用本機實體檔案讀寫與編輯器聯動，並將對應的 UI 按鈕與路徑顯示進行安全防護鎖定，避免產生寫入錯誤。
   - **自動存檔**：地圖架構與變更會自動即時儲存至瀏覽器的 `localStorage` 中（鍵值為 `vibegraph_system_graph`），關閉網頁亦能保留架構。
   - **匯入與匯出**：左側「AI 協同工具箱」下提供 **「匯出系統架構 JSON 📤」** 與 **「匯入 / 貼上系統架構 JSON 📥」** 按鈕，方便下載與載入 `system-graph.json` 檔案。
   - **如何使用**：直接啟動 Web 模式開發伺服器，在瀏覽器中開啟即可。

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

## 🗺️ 使用方法

安裝插件後，依照以下流程開啟地圖並建立您的系統規劃。

### Step 0 — 開啟 VibeGraph 地圖

安裝完成後，有四種方式可以開啟地圖：

**方式 A：狀態列按鈕（最快）**
> 開啟任意資料夾後，在 VS Code 視窗**右下角狀態列**找到 **`📊 VibeGraph`** 按鈕，直接點擊即可開啟。

**方式 B：命令列（Command Palette）**
> 按下 `Ctrl+Shift+P`（macOS：`Cmd+Shift+P`）喚出命令列，輸入並選擇：
> ```
> VibeGraph: Open Graph Map
> ```

**方式 C：檔案總管右鍵選單**
> 在左側**檔案總管（Explorer）面板**中，對任意檔案或資料夾**按右鍵**，在彈出的選單中選擇 **「VibeGraph: Open Graph Map」** 即可開啟。
> 同一右鍵選單中也可選擇 **「VibeGraph: Bootstrap Project」** 來一鍵掃描專案並自動產生初始架構節點。

**方式 D：編輯器標題列按鈕**
> 開啟任意檔案時，在編輯器**右上角標題列**會出現 `$(graph)` 與 `$(sparkle)` 圖示按鈕，點擊即可快速開啟地圖或觸發 Bootstrap。

> [!NOTE]
> 若使用 Antigravity IDE 等簡化介面的衍生編輯器，找不到左側 Extensions 按鈕時，請直接使用**方式 B** 的命令列方式開啟。

---

### Step 1 — 讓 AI 幫你產生初始地圖（Bootstrap）

> 💡 這是大多數 Vibe Coder 的起點。不需要手動建立任何節點！

在已有程式碼的專案中：

1. 按下 `Ctrl+Shift+I`（macOS：`Cmd+Shift+I`），或透過右鍵選單選擇 **「VibeGraph: Bootstrap Project (產生初始架構)」**。
2. VibeGraph 會自動掃描您的專案目錄，辨識 UI 元件、Service、資料層，並在地圖上產生對應節點與初步的依賴連線。
3. 幾秒後地圖便會自動呈現您的專案架構。

> [!NOTE]
> 全新空專案也可以直接開啟地圖，先用 Bootstrap 生成一份空白架構框架，再開始 Vibe Coding。

---

### Step 2 — 檢視並確認 AI 建議

Bootstrap 完成後，地圖上的每個節點都帶有 AI 自動填入的內容，請快速確認：

- **節點名稱**：是否符合您對功能的理解？
- **產出預期 (Produce)**：AI 會用一句動詞句描述此節點的功能，例如 `"stores notes locally as JSON"`。若覺得描述不準確，直接點擊節點展開 **NodeEditor** 面板修改。
- **隨筆備忘 (Notes)**：可以隨手補充任何想法或 TODO。

> **✏️ 修改即鎖定**：手動編輯任何欄位後，節點會標記 `userOverridden: true`，後續 AI 重新掃描時**絕對不會覆蓋您的修改**。
> **🗑️ 反悔也沒關係**：點擊重置按鈕可隨時回到 AI 的原始建議。

---

### Step 3 — 讀懂微推光效，抓住開發優先序

地圖建立後，VibeGraph 會自動在背景分析，透過視覺光效給予非強制性建議：

| 光效 | 微推類型 | 該怎麼看 |
|---|---|---|
| 💜 **紫色呼吸霓虹** | 推進微推 | 此節點是其他功能的底層基礎，**建議優先實作** |
| 🟡 **黃色提示框** | 關係微推 | 此 UI 節點還沒有連接任何 Service，可能需要補上依賴 |
| 📝 **名詞提示** | 名詞微推 | 隨筆中出現和全局名詞定義表相似的詞，建議對齊命名 |

> 所有微推均為**建議性質**，可以完全忽略，不影響地圖正常運作。

---

### Step 4 — 善用 AI 協同工具箱進行增量式規劃 (AI Toolkit Actions)

當地圖建立完成或在後續開發中，您可以利用左側 **「Vibe 規劃中心」** 中的 **「AI 協同工具箱」**，複製對應的規劃 Prompt 來與 AI 協同合作：

* **🔄 掃描同步 Prompt (Sync & Scan)**：當專案實體檔案有新增、刪除或修改時，複製此 Prompt 貼給 AI，AI 會掃描程式碼結構並自動更新 `system-graph.json`。
* **➕ 新增功能 Prompt (Expand Graph)**：若想要在系統中加入全新功能，點擊按鈕並輸入描述，系統會打包當前完整架構契約（JSON）並生成 AI 擴充提示詞，協助 AI 規劃新節點與依賴。
* **✏️ 修改功能 Prompt (Edit Detail)**：若想針對某個既有組件的細節或產出進行微調，複製此 Prompt 可引導 AI 更新特定節點細節與技術約束。
* **🗑️ 移除功能 Prompt (Safe Delete)**：若想將某功能安全地在合約中移除，點擊此按鈕會指引 AI 將特定節點自列表刪除，並自動將依賴它的其餘組件相依連線清理乾淨，防止殘留懸空依賴。
* **🔄 重構架構 Prompt (Optimize)**：當系統節點過多或資料流複雜時，複製此 Prompt 引導 AI 進行架構最佳化（如節點合併、代碼解耦、更新目錄結構或技術棧）。

---

### Step 5 — 一鍵產出實作 Prompt，開始 Vibe Coding

當前置規劃與依賴線調整完畢後，點選您要開發的節點，點擊右側面板最下方的 **「一鍵生成實作 Prompt ⚡」** 按鈕。
**PromptCompiler** 會自動把該節點資訊、業務名詞、Vibe Notes 與其相依的已完成依賴程式碼（自動讀取實體檔案內容）整合成一份結構化提示詞。
複製後貼入您的 AI 對話框，AI 即可直接生成符合所有合約與上下文的精準程式碼！

---

> [!TIP]
> ### 🛠️ 手動新增與刪除節點 (增刪安全防護)
> 除了透過 AI 產出圖表，您也可以隨時在地圖上手動微調：
>
> 1. **➕ 手動新增節點**：
>    * 點擊畫布左下方的 **「➕ 新增組件節點」** 按鈕。
>    * 為了防止誤觸與干擾，系統會先彈出**自訂警告確認視窗**；點選確認後即可依序輸入「組件名稱」與「產出預期（produce）」來新增節點。
> 2. **🗑️ 手動刪除節點**：
>    * 點擊畫布上要刪除的節點，在右側設定面板的最底部，點擊紅色的 **「🗑️ 刪除節點」** 按鈕。
>    * 系統會跳出警告對話框提示此操作不可逆。確認後，系統會自動將該節點刪除，並**自動清除其他節點對該節點的依賴連線**。
>
> **依賴連線繪製**：
> 需要建立依賴連線時，將滑鼠懸停在節點頂部（輸入）或底部（輸出）的連接點上，拖曳連接線至目標節點即可建立關係；點選連線後按鍵盤 `Delete` 可移除。

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
1. 用 VS Code 開啟本專案資料夾。
2. 切換到左側「Run and Debug」面板 (`Ctrl+Shift+D`)，選擇 **「Launch Extension」**。
3. 按下 **`F5`** 鍵啟動偵錯。
4. 系統會自動彈出一個全新的 `[Extension Development Host]` VS Code 視窗。
5. 在此沙盒視窗中開啟一個空的資料夾，您可以在編輯器右下角狀態列直接看到 **`📊 VibeGraph`** 按鈕，點選即可開啟地圖！（亦可按 `Ctrl+Shift+P` 執行 `VibeGraph: Open Graph Map`），即可在裡面盡情演練！

### 3. 正式打包與安裝
如果您想在個人的 VS Code 或其衍生編輯器 (如 Antigravity IDE 等) 中正式使用此插件：
1. 專案已內建套用 `npx @vscode/vsce` 打包，無需全域安裝任何工具。
2. 在專案根目錄執行：
   ```bash
   npm run package
   ```
3. 這會生成一個安裝包檔案，例如 `vibegraph-0.0.1.vsix`。
4. **安裝方法 A：介面安裝**
   - **VS Code 與衍生 IDE**：開啟編輯器，進入左側「Extensions (擴充功能)」面板 (`Ctrl+Shift+X`)，點擊面板右上角的 `...` (更多動作) 按鈕，選擇 **「Install from VSIX... (從 VSIX 安裝...)」**，並選取生成的 `.vsix` 檔案。
     *(💡 提示：安裝成功後，您可以在編輯器右下角狀態列直接點選 **`📊 VibeGraph`** 按鈕開啟地圖！若部分衍生 IDE，例如本 Antigravity IDE，簡化了介面而找不到左側 Extensions 按鈕，您可直接在編輯器內按下 **`Ctrl+Shift+P`** 喚出命令列，輸入並點選 `Install from VSIX` 進行安裝！)*
5. **安裝方法 B：命令列安裝 (CLI)**
   - **VS Code**：在終端機中執行：
     ```bash
     code --install-extension vibegraph-0.0.1.vsix
     ```

### 4. 啟動獨立 Web App 模式
如果您想作為獨立的網頁應用程式在瀏覽器中執行：
1. 切換至 `webview` 目錄：
   ```bash
   cd webview
   ```
2. 啟動 Vite 開發伺服器：
   ```bash
   npm run dev
   ```
3. 在瀏覽器中開啟輸出的 Local 網址（預設為 `http://localhost:5173`）即可使用。

