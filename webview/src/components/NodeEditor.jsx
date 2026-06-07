import React, { useState, useEffect } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';

export default function NodeEditor({ activeNode, onDeleteNode }) {
  const { 
    isVsCode,
    nodes: graphNodes, 
    updateNode, 
    openFile,
    language,
    t,
    showConfirm,
    deleteNode
  } = useWorkspace();

  const [name, setName] = useState('');
  const [produce, setProduce] = useState('');
  const [vibeNotes, setVibeNotes] = useState('');
  const [filePath, setFilePath] = useState('');
  const [status, setStatus] = useState('todo');
  
  // Synthesis edits
  const [isEditingSynthesis, setIsEditingSynthesis] = useState(false);
  const [intentSignal, setIntentSignal] = useState('');
  const [extractedConstraints, setExtractedConstraints] = useState('');

  // Placeholders for produce
  const placeholders = [
    "stores notes locally...",
    "lets user edit markdown...",
    "helps user export notes to PDF...",
    "fetches auth session from server...",
    "renders clean nav header..."
  ];
  const [placeholderIdx, setPlaceholderIdx] = useState(0);

  // Rotate placeholder every 4 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIdx(prev => (prev + 1) % placeholders.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Update local states when activeNode changes
  useEffect(() => {
    if (activeNode) {
      setName(activeNode.name || '');
      setProduce(activeNode.produce || '');
      setVibeNotes(activeNode.vibeNotes || '');
      
      const synth = activeNode.synthesis || {};
      setFilePath(synth.filePath || '');
      setStatus(synth.status || 'todo');
      setIntentSignal(synth.intentSignal || '');
      setExtractedConstraints((synth.extractedConstraints || []).join('\n'));
      setIsEditingSynthesis(false);
    }
  }, [activeNode]);

  if (!activeNode) {
    return (
      <div className="side-panel right">
        <div className="panel-header">
          <div className="panel-title">{t('panelConfigTitle')}</div>
        </div>
        <div className="panel-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <p style={{ color: 'var(--text-dark)', fontSize: '0.85rem', fontStyle: 'italic', textAlign: 'center', whiteSpace: 'pre-line' }}>
            {t('noNodeSelected')}
          </p>
        </div>
      </div>
    );
  }

  // Handle saving Layer 1 & 2 values
  const handleSaveField = (key, value) => {
    const updatedNode = { ...activeNode };
    if (key === 'name' || key === 'produce' || key === 'vibeNotes' || key === 'vibeImage' || key === 'vibeImages') {
      updatedNode[key] = value;
    } else if (key === 'filePath' || key === 'status') {
      updatedNode.synthesis = {
        ...(updatedNode.synthesis || {}),
        [key]: value
      };
    }
    updateNode(updatedNode);
  };

  const handleImagesUpload = (files) => {
    const validFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (validFiles.length === 0) return;

    const existingImages = activeNode.vibeImages || (activeNode.vibeImage ? [activeNode.vibeImage] : []);
    if (existingImages.length + validFiles.length > 5) {
      alert(t('maxImagesLimitAlert'));
      return;
    }

    let processedCount = 0;
    const newImages = [];

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
          newImages.push(compressedBase64);
          processedCount++;

          if (processedCount === validFiles.length) {
            const finalImages = [...existingImages, ...newImages].slice(0, 5);
            const updatedNode = { 
              ...activeNode, 
              vibeImages: finalImages,
              vibeImage: finalImages[0] || ''
            };
            updateNode(updatedNode);
          }
        };
      };
      reader.readAsDataURL(file);
    });
  };

  const handleDeleteImage = (index) => {
    const existingImages = activeNode.vibeImages || (activeNode.vibeImage ? [activeNode.vibeImage] : []);
    const finalImages = existingImages.filter((_, i) => i !== index);
    const updatedNode = {
      ...activeNode,
      vibeImages: finalImages,
      vibeImage: finalImages[0] || ''
    };
    updateNode(updatedNode);
  };

  // Handle saving manual Synthesis overrides
  const handleSaveSynthesisOverride = () => {
    const constraintsArray = extractedConstraints
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    const updatedNode = {
      ...activeNode,
      synthesis: {
        ...(activeNode.synthesis || {}),
        filePath: filePath.trim(),
        intentSignal: intentSignal.trim(),
        extractedConstraints: constraintsArray,
        userOverridden: true // Mark User Sovereignty
      }
    };
    updateNode(updatedNode);
    setIsEditingSynthesis(false);
  };

  // Revert synthesis overrides to AI suggestion
  const handleResetToAISuggestions = async () => {
    if (await showConfirm(t('resetConfirm'))) {
      const updatedNode = {
        ...activeNode,
        synthesis: {
          ...(activeNode.synthesis || {}),
          userOverridden: false // Unmark override, allowing future AI scans to rewrite
        }
      };
      updateNode(updatedNode);
    }
  };

  // Handle dependency removal
  const handleRemoveDependency = (depId) => {
    const updatedNode = {
      ...activeNode,
      dependencies: (activeNode.dependencies || []).filter(id => id !== depId)
    };
    updateNode(updatedNode);
  };

  // Handle deleting this node
  const handleDeleteNode = async () => {
    const warningMsg = language === 'en'
      ? `Warning: Deleting the node "${activeNode.name}" will permanently remove it and all of its incoming/outgoing dependencies. This action cannot be undone. Are you sure you want to delete it?`
      : `警告：刪除節點「${activeNode.name}」將會永久移除該節點及其所有相依關係（連線）。此動作無法復原，您確定要刪除嗎？`;

    const proceed = await showConfirm(warningMsg);
    if (proceed) {
      deleteNode(activeNode.id);
      if (onDeleteNode) {
        onDeleteNode();
      }
    }
  };

  const isOverridden = activeNode.synthesis?.userOverridden;

  return (
    <div className="side-panel right">
      <div className="panel-header">
        <div className="panel-title">
          <span>⚙️ {language === 'en' ? 'Node' : '節點'}: {activeNode?.name || ''}</span>
        </div>
        <span className={`node-badge ${status}`}>{t(status === 'completed' ? 'statusCompleted' : 'statusTodo')}</span>
      </div>

      <div className="panel-content" style={{ paddingBottom: '0' }}>
        {/* Layer 1: name */}
        <div className="form-group">
          <label className="form-label">{t('labelNodeName')}</label>
          <input 
            type="text" 
            className="form-input" 
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => handleSaveField('name', name)}
          />
        </div>

        {/* Layer 1: produce with Soft Template Hint */}
        <div className="form-group">
          <label className="form-label">{t('labelNodeProduce')}</label>
          <input 
            type="text" 
            className="form-input" 
            placeholder={placeholders[placeholderIdx]}
            value={produce}
            onChange={(e) => setProduce(e.target.value)}
            onBlur={() => handleSaveField('produce', produce)}
          />
          <div className="sentence-hint">
            {t('produceHint')}
          </div>
        </div>

        {/* Layer 1: vibeNotes */}
        <div className="form-group">
          <label className="form-label">{t('labelVibeNotes')}</label>
          <textarea 
            className="form-input vibe-notes-box" 
            placeholder={t('vibeNotesPlaceholder')}
            value={vibeNotes}
            onChange={(e) => setVibeNotes(e.target.value)}
            onBlur={() => handleSaveField('vibeNotes', vibeNotes)}
          />
        </div>

        {/* Layer 1: vibeImage */}
        <div className="form-group">
          <label className="form-label">{t('labelVibeImage')}</label>
          {(() => {
            const currentImages = activeNode.vibeImages || (activeNode.vibeImage ? [activeNode.vibeImage] : []);
            return (
              <>
                {currentImages.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(65px, 1fr))', gap: '8px', marginBottom: '12px' }}>
                    {currentImages.map((img, idx) => (
                      <div key={idx} style={{ position: 'relative', border: '1px solid var(--panel-border)', borderRadius: '6px', height: '65px', overflow: 'hidden', background: '#09090d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <img 
                          src={img} 
                          alt={`Vibe Mockup ${idx + 1}`} 
                          style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                        />
                        <button 
                          className="btn" 
                          style={{ 
                            position: 'absolute', 
                            top: '2px', 
                            right: '2px', 
                            padding: 0,
                            width: '18px',
                            height: '18px',
                            fontSize: '10px', 
                            background: 'rgba(239, 68, 68, 0.85)', 
                            border: 'none',
                            color: '#fff',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: 'none',
                            cursor: 'pointer',
                            zIndex: 10
                          }}
                          onClick={() => handleDeleteImage(idx)}
                          title={t('btnDeleteImage')}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {currentImages.length < 5 ? (
                  <div 
                    className="image-dropzone"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      handleImagesUpload(e.dataTransfer.files);
                    }}
                    onPaste={(e) => {
                      handleImagesUpload(e.clipboardData.files);
                    }}
                    tabIndex={0}
                    style={{
                      border: '1px dashed var(--panel-border)',
                      borderRadius: '8px',
                      padding: '16px 10px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      background: 'rgba(0, 0, 0, 0.15)',
                      outline: 'none',
                      transition: 'var(--transition-smooth)'
                    }}
                    onClick={() => document.getElementById('vibe-image-input').click()}
                  >
                    <input 
                      id="vibe-image-input" 
                      type="file" 
                      accept="image/*" 
                      multiple
                      style={{ display: 'none' }} 
                      onChange={(e) => {
                        if (e.target.files) {
                          handleImagesUpload(e.target.files);
                        }
                      }}
                    />
                    <div style={{ fontSize: '1.2rem', marginBottom: '4px' }}>🖼️</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', lineHeight: '1.3' }}>
                      {t('vibeImagePlaceholder')} ({currentImages.length}/5)
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', padding: '10px', background: 'rgba(0,0,0,0.1)', borderRadius: '6px', border: '1px solid var(--panel-border)' }}>
                    {language === 'en' ? '✅ Max image limit (5) reached' : '✅ 已達到圖片上傳上限 (5張)'}
                  </div>
                )}
              </>
            );
          })()}
        </div>

        {/* Layer 1: Dependencies List */}
        <div className="form-group">
          <label className="form-label">{t('labelDeps')}</label>
          {(!activeNode.dependencies || activeNode.dependencies.length === 0) ? (
            <p style={{ fontSize: '0.75rem', color: 'var(--text-dark)', fontStyle: 'italic' }}>
              {t('noDeps')}
            </p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
              {activeNode.dependencies.map(depId => {
                const depNode = graphNodes.find(n => n.id === depId);
                return (
                  <div 
                    key={depId} 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '4px', 
                      background: 'rgba(255,255,255,0.04)', 
                      border: '1px solid var(--panel-border)', 
                      borderRadius: '4px',
                      padding: '4px 8px',
                      fontSize: '0.75rem' 
                    }}
                  >
                    <span>{depNode ? depNode.name : depId}</span>
                    <button 
                      onClick={() => handleRemoveDependency(depId)}
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 'bold' }}
                      title={language === 'en' ? 'Delete dependency' : '刪除依賴線'}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Layer 2: Synthesis Layer (Preprocessed Specs) */}
        <div className="synthesis-panel" style={{ marginBottom: '20px' }}>
          <div className="synthesis-header">
            <div className="synthesis-title">
              <span>{t('synthesisTitle')}</span>
            </div>
            {isOverridden && (
              <span className="override-badge" title={language === 'en' ? 'User overridden, AI scan will not overwrite it' : '使用者已覆寫，AI 掃描不會將其覆蓋'}>
                {t('overriddenBadge')}
              </span>
            )}
          </div>

          <div className="synthesis-body">
            {/* Status Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t('labelStatus')}</span>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button 
                  className={`control-btn ${status === 'todo' ? 'active' : ''}`}
                  style={{ 
                    padding: '4px 8px', 
                    fontSize: '0.75rem', 
                    background: status === 'todo' ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                    border: status === 'todo' ? '1px solid #3b82f6' : '1px solid transparent'
                  }}
                  onClick={() => { setStatus('todo'); handleSaveField('status', 'todo'); }}
                >
                  {t('statusTodo')}
                </button>
                <button 
                  className={`control-btn ${status === 'completed' ? 'active' : ''}`}
                  style={{ 
                    padding: '4px 8px', 
                    fontSize: '0.75rem', 
                    background: status === 'completed' ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                    border: status === 'completed' ? '1px solid #10b981' : '1px solid transparent'
                  }}
                  onClick={() => { setStatus('completed'); handleSaveField('status', 'completed'); }}
                >
                  {t('statusCompleted')}
                </button>
              </div>
            </div>

            {/* Editable Synthesis Form */}
            {isEditingSynthesis ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>{t('filePathLabel')}</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    style={{ fontSize: '0.8rem', padding: '6px 8px' }}
                    value={filePath}
                    onChange={(e) => setFilePath(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>{t('intentSignalLabel')}</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    style={{ fontSize: '0.8rem', padding: '6px 8px' }}
                    value={intentSignal}
                    onChange={(e) => setIntentSignal(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>{t('extractedConstraintsLabel')}</label>
                  <textarea 
                    className="form-input" 
                    style={{ fontSize: '0.8rem', padding: '6px 8px', minHeight: '80px', fontFamily: 'var(--font-sans)' }}
                    value={extractedConstraints}
                    onChange={(e) => setExtractedConstraints(e.target.value)}
                    placeholder={language === 'en' ? 'Enter one constraint per line...' : '每行輸入一條具體約束條件...'}
                  />
                </div>
                <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                  <button 
                    className="btn" 
                    style={{ flex: 1, padding: '8px', fontSize: '0.8rem' }}
                    onClick={handleSaveSynthesisOverride}
                  >
                    {t('saveOverrideBtn')}
                  </button>
                  <button 
                    className="btn" 
                    style={{ padding: '8px', fontSize: '0.8rem', background: '#374151' }}
                    onClick={() => setIsEditingSynthesis(false)}
                  >
                    {t('cancelBtn')}
                  </button>
                </div>
              </div>
            ) : (
              // Read-only Synthesis display
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-dark)', fontWeight: 'bold' }}>{t('labelFilePath')} </span>
                  {isVsCode ? (
                    <span 
                      style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)', color: 'var(--text-main)', cursor: 'pointer', textDecoration: 'underline' }}
                      onClick={() => {
                        if (filePath) {
                          openFile(filePath);
                        }
                      }}
                      title={language === 'en' ? 'Click to open this file in editor' : '點擊可在編輯器中開啟此檔案'}
                    >
                      {filePath || t('filePathEmpty')}
                    </span>
                  ) : (
                    <span 
                      style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}
                      title={t('webModeLockFilePath')}
                    >
                      {filePath || t('filePathEmpty')}
                    </span>
                  )}
                </div>
                
                {intentSignal && (
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-dark)', fontWeight: 'bold' }}>{t('labelIntentSignal')}</span>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-main)', marginTop: '2px' }}>{intentSignal}</p>
                  </div>
                )}

                {activeNode.synthesis?.extractedConstraints && activeNode.synthesis.extractedConstraints.length > 0 && (
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-dark)', fontWeight: 'bold' }}>{t('labelExtractedConstraints')}</span>
                    <ul className="constraints-bullet-list" style={{ marginTop: '4px' }}>
                      {activeNode.synthesis.extractedConstraints.map((c, idx) => (
                        <li key={idx} style={{ fontSize: '0.78rem', color: 'var(--text-main)' }}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                  <button 
                    className="control-btn"
                    style={{ flex: 1, display: 'flex', justifyContent: 'center', border: '1px solid rgba(234, 179, 8, 0.3)' }}
                    onClick={() => setIsEditingSynthesis(true)}
                  >
                    {t('btnEditSynthesis')}
                  </button>
                  {isOverridden && (
                    <button 
                      className="control-btn"
                      style={{ color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' }}
                      onClick={handleResetToAISuggestions}
                      title={language === 'en' ? 'Clear overrides, restore to AI auto-organize' : '清除覆寫，恢復為 AI 自動整理'}
                    >
                      {t('btnResetSynthesis')}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Delete Node Section */}
        <div style={{ marginTop: '24px', borderTop: '1px solid var(--panel-border)', paddingTop: '20px' }}>
          <button 
            className="btn" 
            style={{ 
              width: '100%', 
              background: 'rgba(239, 68, 68, 0.08)', 
              color: '#ef4444', 
              border: '1px solid rgba(239, 68, 68, 0.3)', 
              boxShadow: 'none',
              padding: '10px'
            }}
            onClick={handleDeleteNode}
          >
            🗑️ {t('deleteNodeBtn')}
          </button>
        </div>
      </div>
    </div>
  );
}
