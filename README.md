# VibeGraph 🚀
> Vibe Coding 系統規劃與約束契約地圖 (Visual Constraint Map & Prompt Compiler for Vibe Coding)

VibeGraph 是一個為 AI 輔助開發量身打造的視覺化架構層。它採用「智能微推引導」與「三層架構解耦」，在背後默默協助開發者釐清程式碼結構、對齊名詞定義，但**不強制鎖定您的開發流程、不施加工程化條款**，維持 Vibe Coding 的自由與直覺。

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

## 🌐 多模式相容運作 (Multi-Mode Compatibility)

VibeGraph 支援多模式無縫相容，會自動偵測當前執行環境（`VS Code`、`Android Studio / IntelliJ` 或 `獨立 Web 瀏覽器`）並自動調整 UI 和功能：

1. **📦 VS Code 插件模式 (VS Code Extension Mode)**
   - **完全功能**：支援實體檔案路徑連結、實體檔案系統讀寫、即時檔案監聽同步（File Watcher）、程式碼一鍵套用與寫入。
   - **如何開啟**：安裝插件後，可透過右下角狀態列按鈕、命令列 `VibeGraph: Open Graph Map` 或在目錄按右鍵開啟。

2. **🤖 Android Studio / IntelliJ 插件模式 (Android Studio Extension Mode)**
   - **完全功能**：與 VS Code 插件相同，透過 JCEF 雙向通訊機制直接讀寫實體檔案系統、即時同步檔案狀態（File Watcher）、套用程式碼並開啟編輯器分頁。
   - **如何開啟**：安裝插件後，在右下角狀態列點擊 `📊 VibeGraph` 即可開啟/收合側邊欄，或在目錄按右鍵開啟。
   - **💡 Android Studio 的 JCEF 支援與降級防護**：
     > [!IMPORTANT]
     > * **問題背景**：Google 在客製化 Android Studio 的啟動虛擬機 (JBR) 時，預設沒有搭載 JCEF (Java Chromium Embedded Framework) 模組，常導致載入網頁插件時崩潰。
     > * **如何解決（IDE 內開啟）**：在 Android Studio 中按下雙擊 Shift（或 `Cmd+Shift+A`）喚出 **Find Action**，搜尋並點選 **「Choose Boot Java Runtime for the IDE...」**，並手動切換至一個名稱後綴標有 **`with JCEF`** 的 JBR Runtime，重新啟動 IDE。
     > * **外部瀏覽器降級防護**：若您不想更換 IDE 虛擬機，VibeGraph 內建了**高雅降級機制**。檢測到 JCEF 不可用時，會自動在側邊欄渲染 Swing 降級畫面，提供 **「在外部瀏覽器中開啟地圖 🌐」** 按鈕。點選後可直接在系統預設瀏覽器（Chrome/Safari）中運行 VibeGraph (使用獨立 Web App 模式，地圖可正常編輯且透過 localStorage 儲存)。

3. **🌐 獨立 Web App 模式 (Standalone Web App Mode)**
   - **安全鎖定**：自動停用本機實體檔案讀寫與編輯器聯動，並將對應的 UI 按鈕與路徑顯示進行安全防護鎖定，避免產生寫入錯誤。
   - **自動存檔**：地圖架構與變更會自動即時儲存至瀏覽器的 `localStorage` 中（鍵值為 `vibegraph_system_graph`），關閉網頁亦能保留架構。
   - **匯入與匯出**：左側「AI 協同工具箱」下提供 **「匯出系統架構 JSON 📤」** 與 **「匯入 / 貼上系統架構 JSON 📥」** 按鈕，方便下載與載入 `system-graph.json` 檔案。

---

## 📂 專案檔案結構

```
├── .vscode/
│   └── launch.json         # VS Code 沙盒偵錯啟動配置
├── bin/                    # 統一打包輸出目錄 (已設為 gitignore)
│   ├── vibegraph-*.vsix                 # VS Code 插件正式包
│   └── vibegraph-intellij-plugin-*.zip # IntelliJ 插件正式包
├── intellij-plugin/        # IntelliJ / Android Studio 插件專案
│   ├── src/main/kotlin/    # Kotlin 後端邏輯與 JBCef 橋接
│   └── build.gradle.kts    # Gradle 建置設定
├── webview/                # 前端 React 視覺化畫布
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
├── extension.js            # VS Code 插件後端，處理檔案讀寫與 IPC 訊息
├── package.json            # 插件 Manifest 與打包指令
└── README.md               # 本 Onboarding 說明文件
```

---

## 🗺️ 使用方法與協同流程 (Usage Guide)

安裝插件後，依照以下流程開啟地圖並建立您的系統規劃。

### Step 0 — 開啟 VibeGraph 地圖

#### 📦 VS Code 模式
* **狀態列按鈕（最快）**：在 VS Code 視窗**右下角狀態列**找到 **`📊 VibeGraph`** 按鈕，點擊開啟。
* **命令列（Command Palette）**：按 `Cmd+Shift+P` / `Ctrl+Shift+P`，輸入並選擇 `VibeGraph: Open Graph Map`。
* **右鍵選單**：在左側**檔案總管面板**中，對檔案或資料夾**按右鍵**選擇 **「VibeGraph: Open Graph Map」**。

#### 🤖 Android Studio / IntelliJ 模式
* **狀態列按鈕（最快）**：在編輯器**右下角狀態列**找到 **`📊 VibeGraph`**，點擊開啟/收合側邊欄。
* **右鍵選單**：在左側 **Project** 樹狀圖對任意目錄或檔案**按右鍵**，選單中選擇 **「VibeGraph: Open Graph Map」**。

#### 🌐 獨立 Web 模式
* 在瀏覽器中開啟 `http://localhost:5173` 即可直接使用。

---

### Step 1 — 建立 / 匯入系統規劃 (Bootstrap Project)

#### ⚡ 建立初始架構
如果您是新專案，可以直接在命令列執行 **`VibeGraph: Bootstrap Project (產生初始架構)`**（快捷鍵 `Cmd+Shift+I` / `Ctrl+Shift+I`），或者在目錄按右鍵選擇該選項。
* 系統會引導您輸入想要實作的專案目標（例如：`做一個結合 IndexedDB 存檔的 Markdown 編輯器，且能匯出 PDF`）。
* AI 會根據此目標自動生成一份符合本草案規範的初始節點與依賴地圖，並自動同步至專案根目錄下的 `system-graph.json` 檔案。

#### 📥 匯入既有規劃
若已有現成的 `system-graph.json`，開啟 VibeGraph 時將會自動載入畫布中。

---

### Step 2 — 填寫 Synthesis 層與微調節點細節

* **NodeEditor 編輯**：點選地圖上任何節點，右側會展開詳細的設定面板。您可微調組件名稱、說明與 **「產出預期 (produce)」** 等。
* **隨筆備忘 (Notes)**：可以隨手補充任何開發想法或 TODO。

> 💡 **✏️ 修改即鎖定 (User Sovereignty)**：手動編輯任何欄位後，節點會標記 `userOverridden: true`，後續 AI 重新掃描時**絕對不會覆蓋您的修改**。如果想回復，可點擊「🗑️ 重置」按鈕回到 AI 的原始建議。

---

### Step 3 — 讀懂微推光效，抓住開發優先序

地圖建立後，VibeGraph 會自動在背景分析，透過視覺光效給予建議：

| 光效 | 微推類型 | 該怎麼看 |
| :--- | :--- | :--- |
| 💜 **紫色呼吸霓虹** | 推進微推 | 此節點是其他功能的底層基礎，**建議優先實作** |
| 🟡 **黃色提示框** | 關係微推 | 此 UI 節點還沒有連接任何服務，可能需要補上依賴 |
| 📝 **名詞提示** | 名詞微推 | 隨筆中出現和全局名詞定義表相似的詞，建議對齊命名 |

> 所有微推均為**建議性質**，可以完全忽略，不影響地圖正常運作。

---

### Step 4 — 善用 AI 協同工具箱進行增量式規劃 (AI Toolkit Actions)

利用左側 **「Vibe 規劃中心」** 中的 **「AI 協同工具箱」**，複製對應的規劃 Prompt 來與 AI 協同合作：

* **🔄 掃描同步 Prompt (Sync & Scan)**：當專案實體檔案有新增、刪除或修改時，複製此 Prompt 貼給 AI，AI 會掃描程式碼結構並自動更新 `system-graph.json`。
* **➕ 新增功能 Prompt (Expand Graph)**：若想要在系統中加入全新功能，點擊按鈕並輸入描述，系統會打包當前完整架構契約（JSON）並生成 AI 擴充提示詞，協助 AI 規劃新節點與依賴。
* **✏️ 修改功能 Prompt (Edit Detail)**：若想針對某個既有組件的細節或產出進行微調，複製此 Prompt 可引導 AI 更新特定節點細節與技術約束。
* **🗑️ 移除功能 Prompt (Safe Delete)**：若想將某功能安全地在合約中移除，點擊此按鈕會指引 AI 將特定節點自列表刪除，並自動將依賴它的其餘組件相依連線清理乾淨，防止殘留懸空依賴。
* **🔄 重構架構 Prompt (Optimize)**：當系統節點過多或資料流複雜時，複製此 Prompt 引導 AI 進行架構最佳化（如節點合併、代碼解耦、更新目錄結構或技術棧）。

---

### Step 5 — 一鍵產出實作 Prompt，開始 Vibe Coding

當前置規劃與依賴線調整完畢後：
1. 點選您要開發的節點。
2. 點擊右側面板最下方的 **「一鍵生成實作 Prompt ⚡」** 按鈕。
3. **PromptCompiler** 會自動把該節點資訊、業務名詞、Vibe Notes 與其相依的已完成依賴程式碼（自動讀取實體檔案內容）整合成一份結構化提示詞。
4. 複製後貼入您的 AI 對話框，AI 即可直接生成符合所有合約與上下文的精準程式碼！

---

> [!TIP]
> ### 🛠️ 手動調整畫布節點與依賴
> 除了透過 AI 產出圖表，您也可以隨時在地圖上手動微調：
>
> 1. **➕ 手動新增節點**：
>    * 點擊畫布左下方的 **「➕ 新增組件節點」** 按鈕。
>    * 為了防止誤觸與干擾，系統會先彈出**自訂警告確認視窗**；點選確認後即可依序輸入「組件名稱」與「產出預期（produce）」來新增節點。
> 2. **🗑️ 手動刪除節點**：
>    * 點擊畫布上要刪除的節點，在右側設定面板的最底部，點擊紅色的 **「🗑️ 刪除節點」** 按鈕。
>    * 確認後，系統會自動將該節點刪除，並**自動清除其他節點對該節點的依賴連線**。
> 3. **依賴連線繪製**：
>    * 將滑鼠懸停在節點頂部（輸入）或底部（輸出）的連接點上，拖曳連接線至目標節點即可建立關係；點選連線後按鍵盤 `Delete` 可將其移除。

---

## 📦 插件正式打包與安裝指引 (Production Packaging & Installation)

在將插件安裝到您的 IDE 前，必須進行正式打包。專案已將輸出路徑統一規劃至根目錄的 `bin/` 目錄中。

> [!TIP]
> ### 🚀 快速開始：直接下載預建好的安裝包 (Quick Start)
> 如果您**不需要**修改原始碼或自訂打包，請直接前往 **[GitHub Releases 頁面](https://github.com/Jpopaholic/VibeCodingSystemGraphTool/releases)** 下載最新釋出的預建安裝包：
> * **VS Code** 擴充功能：下載 `vibegraph-*.vsix`。
> * **Android Studio / IntelliJ** 插件：下載 `vibegraph-intellij-plugin-*.zip`。
> 
> 下載完成後，即可跳過下方所有「安裝與建置」步驟，直接跳轉至下方參考 **[VS Code 安裝](#2-vs-code-插件打包與安裝)** 或 **[Android Studio 安裝](#3-android-studio--intellij-插件打包與安裝)** 方法進行導入。

> [!NOTE]
> **環境前置準備 (Prerequisites)**：
> * **自己打包或開發**：若您需要執行打包（如 `npm run package`）或進行原始碼開發，您的系統必須已安裝 **Node.js (建議 v18 以上) 與 npm**。
> * **僅需導入安裝**：若您只是要將已下載或已編譯好的成品（`.vsix` 或 `.zip`）安裝到您的 IDE 中，則**不需要**安裝 Node.js。

### 1. 前置建置 (建置 Webview)
在進行任何打包之前，請先確保前端依賴已安裝且 Webview 已正確建置：
```bash
# 安裝前端依賴
npm run webview-install

# 編譯 Webview 前端靜態資源
npm run webview-build
```

### 2. VS Code 插件打包與安裝
* **打包指令**：在專案根目錄下執行：
  ```bash
  npm run package
  ```
  這會自動建置前端，並使用內建的打包工具生成 `bin/vibegraph-*.vsix` 檔案。
* **安裝方法 A：編輯器介面安裝**：
  開啟 VS Code / Antigravity IDE，進入左側「Extensions (擴充功能)」面板 (`Ctrl+Shift+X`)，點擊面板右上角的 `...` 選擇 **「Install from VSIX... (從 VSIX 安裝...)」**，並選取 `bin/vibegraph-*.vsix`。
  *(💡 提示：若部分衍生 IDE 簡化了介面而找不到左側 Extensions 按鈕，您可直接按下 **`Ctrl+Shift+P`** 喚出命令列，輸入並點選 `Install from VSIX` 進行安裝！)*
* **安裝方法 B：命令列安裝 (CLI)**：
  在終端機中執行：
  ```bash
  code --install-extension bin/vibegraph-*.vsix
  ```

### 3. Android Studio / IntelliJ 插件打包與安裝
* **打包指令**：在專案根目錄下執行：
  ```bash
  npm run intellij-package
  ```
  *(該指令會自動建置 Webview、編譯 Kotlin 插件代碼，將生成的 `.zip` 安裝包複製到 `bin/` 目錄中，並自動清理打包產生的中間產物。)*
  這會生成例如 `bin/vibegraph-intellij-plugin-*.zip` 檔案。
* **安裝方法**：
  1. 開啟 Android Studio / IntelliJ IDEA。
  2. 進入 **Preferences / Settings -> Plugins**。
  3. 點擊右上角的 **⚙️ (齒輪圖示) -> Install Plugin from Disk...**。
  4. 選擇 `bin/vibegraph-intellij-plugin-*.zip` 檔案，安裝並重新啟動 IDE 即可！

---

## 🛠️ 本地開發與沙盒偵錯指引 (Local Development & Sandbox Debugging)

如果您是開發者，想對 VibeGraph 的原始碼進行修改或沙盒測試，請參考以下指引：

### 1. 前置建置
在開始偵錯前，請確保已執行過前端建置以確保資源最新：
```bash
npm run webview-build
```

### 2. VS Code 插件沙盒偵錯
1. 用 VS Code 開啟本專案資料夾。
2. 切換到左側「Run and Debug (執行與偵錯)」面板 (`Ctrl+Shift+D`)，選擇 **「Launch Extension」**。
3. 按下 **`F5`** 鍵啟動偵錯。
4. 系統會自動彈出一個全新的 `[Extension Development Host]` VS Code 沙盒視窗。
5. 在此沙盒視窗中開啟任意專案資料夾，點選右下角狀態列的 **`📊 VibeGraph`** 按鈕即可開始測試！

### 3. Android Studio / IntelliJ 插件沙盒偵錯
1. 確保本地已配置好 Java (JDK 17) 與 Gradle 環境。
2. 切換到專案根目錄，並執行以下指令啟動沙盒偵錯 IDE：
   ```bash
   cd intellij-plugin
   ./gradlew runIde
   ```
3. 系統會自動下載所需依賴並開啟一個全新的 IDE 測試實例，您可以在其中測試地圖功能。

### 4. 獨立 Web App 本地開發
1. 切換至 `webview` 目錄：
   ```bash
   cd webview
   ```
2. 啟動 Vite 開發伺服器：
   ```bash
   npm run dev
   ```
3. 在瀏覽器中開啟 `http://localhost:5173`。
4. *在此模式下，本機實體檔案系統讀寫將被安全鎖定，地圖規劃將儲存於瀏覽器 localStorage 中。*
