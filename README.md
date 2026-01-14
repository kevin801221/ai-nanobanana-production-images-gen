# 🚀 ProductScene AI - Pro 商用產品照生成器 (Advanced Edition)

ProductScene AI 是一款運用 Google **Gemini 2.5 Flash Image** 技術的旗艦級影像工具，專為電商、行銷與數位創作打造。它不僅能將商品從背景中完美擷取，更能透過進階參數與創意預設，精準生成各種高質感的商用攝影場景。

![ProductScene AI Showcase](https://raw.githubusercontent.com/google-gemini/generative-ai-js/main/docs/assets/gemini-logo.png)
*Professional Background Replacement Powered by Gemini AI*

## ✨ 核心進化功能

- **🌗 雙色模式切換 (Light/Dark Mode)**：提供沉浸式的深色模式與簡潔的淺色模式，並自動記錄您的偏好設定。
- **⚙️ 進階 AI 參數控制 (Advanced AI Tuning)**：
    - **Temperature**: 控制生成的隨機性，想要更穩定的商用照或更有創意的抽象風格由你決定。
    - **Top P & Top K**: 微調取樣策略，細膩控制 AI 生成背景時的視覺邏輯。
- **🎨 分類創意提示庫 (Categorized Prompt Library)**：內建 Minimalist (極簡)、Luxury (奢華)、Nature (自然)、Futuristic (未來)、Lifestyle (生活) 五大分類，一鍵獲取專業攝影提示詞。
- **🔄 裁切歷史回溯 (Undo/Redo)**：裁切工具現在支援無限次撤銷與重做，讓你輕鬆精準鎖定商品核心區域。
- **📦 高容量本地存儲 (IndexedDB Integration)**：改用 IndexedDB 儲存技術，支援儲存大量高解析度生成的 Base64 影像，再也不必擔心瀏覽器空間溢位。
- **🎯 變體批次生成 (Batch Variations)**：可自定義一次生成 3 至 5 個不同的場景變體，大幅提升創作效率。

## 📸 功能亮點

- **🎯 精準主體擷取**：AI 自動識別商品輪廓，維持原始色彩與細節。
- **🏞️ 智慧光影整合**：自動計算新場景的陰影與高光，讓產品與背景完美融合。
- **💖 收藏藝廊 (Saved Gallery)**：快速將心儀的生成結果收藏至專屬藝廊，支援隨時下載與回顧。
- **📸 跨裝置支援**：完美支援手機相機即時拍攝與電腦檔案上傳。

## 🛠️ 技術架構

- **Frontend**: React 19 + TypeScript
- **Styling**: Tailwind CSS (響應式 Dark Mode 支援)
- **AI Engine**: [Google Gemini 2.5 Flash Image](https://ai.google.dev/gemini-api/docs/models/gemini-v2#gemini-2.5-flash-image)
- **Database**: IndexedDB (透過自定義 StorageService 異步管理)
- **Components**: 
    - `Lucide React` (Icon 系統)
    - `React Easy Crop` (進階影像處理)

## 🚀 快速上手

1. **上傳/拍下商品**：點擊首頁上傳或啟動相機。
2. **精確裁切**：調整裁切框，利用 **Undo/Redo** 修正直到滿意。
3. **選擇風格**：點擊 Prompt 分類標籤，選擇預設或自定義場景描述。
4. **調整參數**：打開「Advanced Settings」微調 Temperature 獲取不同創意程度。
5. **生成變體**：點擊「Generate」，一次預覽多個版本。
6. **永久保存**：點擊愛心收藏至您的雲端（本地）藝廊。

---

> **開發者說明**：本專案嚴格遵循 Google GenAI SDK 最新規範，採用 `gemini-2.5-flash-image` 模型。API Key 透過環境變數管理，所有影像數據均以隱私為優先，儲存於使用者本地端。

---
由 **ProductScene AI** 團隊打造，為您的產品視覺注入無限創意。