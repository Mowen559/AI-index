import re

file_path = 'D:/cloud/deepcloud/super agent/hub-web/src/components/CodebaseAnalysisPanel.tsx'
content = open(file_path, 'r', encoding='utf-8').read()

# Replace Tab Headers
content = re.sub(
    r'<div className="flex gap-2 border-b border-border-subtle mb-4 shrink-0 overflow-x-auto custom-scrollbar pb-1">.*?</div>',
    '''<div className="flex gap-4 border-b border-white/10 mb-4 shrink-0 px-2 pb-0">
        <button 
          onClick={() => setActiveTab('ai')}
          className={`pb-2 px-4 text-sm font-semibold transition-colors whitespace-nowrap ${activeTab === 'ai' ? 'text-accent-teal border-b-2 border-accent-teal' : 'text-text-muted hover:text-text-primary'}`}
        >
          信息
        </button>
        <button 
          onClick={() => setActiveTab('git')}
          className={`pb-2 px-4 text-sm font-semibold transition-colors whitespace-nowrap ${activeTab === 'git' ? 'text-accent-teal border-b-2 border-accent-teal' : 'text-text-muted hover:text-text-primary'}`}
        >
          文件
        </button>
      </div>''',
    content,
    flags=re.DOTALL
)

new_info_tab = '''        {/* INFO TAB CONTENT */}
        {activeTab === 'ai' && (
          <div className="space-y-6 pb-6 pr-2">
            {loading && (
              <div className="text-sm text-text-muted animate-pulse py-4 text-center">
                Querying Knowledge Graph...
              </div>
            )}

            {error && (
              <div className="text-sm text-red-400 p-3 bg-red-900/20 border border-red-900/50 rounded">
                {error}
              </div>
            )}

            {!loading && !error && data && (
              <div className="space-y-6">
                
                {/* Title */}
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-blue-400 border border-blue-500/30 bg-blue-500/10 px-1.5 py-0.5 rounded uppercase">FILE</span>
                    {data.llmMetadata?.complexity && (
                      <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded border ${
                        data.llmMetadata.complexity === 'complex' ? 'bg-[#c97070]/10 text-[#c97070] border-[#c97070]/30' :
                        data.llmMetadata.complexity === 'moderate' ? 'bg-accent-dim/10 text-accent-dim border-accent-dim/30' :
                        'bg-green-500/10 text-green-400 border-green-500/30'
                      }`}>
                        {data.llmMetadata.complexity}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-bold text-white font-serif tracking-wide">{selectedFile.split('/').pop()}</h2>
                  <button className="px-3 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-xs text-text-muted transition-colors">
                    聚焦
                  </button>
                </div>

                {/* Summary */}
                {data.llmMetadata?.summary && (
                  <p className="text-[13px] text-text-secondary leading-relaxed">
                    {data.llmMetadata.summary}
                  </p>
                )}

                {/* File Path Block */}
                <div className="bg-elevated border border-white/10 rounded-lg p-3 flex justify-between items-center">
                  <div className="overflow-hidden pr-2">
                    <div className="text-[10px] text-text-muted mb-1">文件</div>
                    <div className="text-[11px] text-text-secondary truncate" title={selectedFile}>{selectedFile}</div>
                  </div>
                  <button className="px-3 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-xs text-text-muted transition-colors whitespace-nowrap">
                    打开代码
                  </button>
                </div>

                {/* Tags */}
                {data.llmMetadata?.tags && data.llmMetadata.tags.length > 0 && (
                  <div>
                    <h4 className="text-[11px] font-bold text-accent-orange mb-2">标签</h4>
                    <div className="flex flex-wrap gap-2">
                      {data.llmMetadata.tags.map((tag: string, idx: number) => (
                        <span key={idx} className="text-[11px] px-2.5 py-1 bg-white/5 border border-white/10 rounded-full text-text-secondary">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Defined in this file */}
                {data.nodes && data.nodes.length > 0 && (
                  <div>
                    <h4 className="text-[11px] font-bold text-white mb-2 flex items-center gap-2">
                      在此文件中定义 ({data.nodes.length})
                    </h4>
                    <div className="space-y-2">
                      {data.nodes.slice(0, 10).map((node: any) => (
                        <div key={node.id} className="bg-elevated border border-white/10 rounded-lg p-2.5 flex flex-col gap-1.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className={`text-[9px] uppercase px-1.5 py-0.5 rounded border ${
                                node.kind === 'function' || node.kind === 'method' ? 'bg-green-500/10 text-green-400 border-green-500/30' :
                                node.kind === 'class' || node.kind === 'interface' ? 'bg-purple-500/10 text-purple-400 border-purple-500/30' :
                                'bg-blue-500/10 text-blue-400 border-blue-500/30'
                              }`}>
                                {node.kind}
                              </span>
                              <span className="text-sm font-semibold text-white">{node.name}</span>
                            </div>
                          </div>
                          {node.docstring && (
                            <div className="text-[11px] text-text-muted truncate">{node.docstring.split('\\n')[0]}</div>
                          )}
                        </div>
                      ))}
                      {data.nodes.length > 10 && (
                        <div className="text-[10px] text-text-muted text-center pt-1">+ {data.nodes.length - 10} more</div>
                      )}
                    </div>
                  </div>
                )}

                {/* Connections */}
                {(data.incomingEdges.length > 0 || data.outgoingEdges.length > 0) && (
                  <div>
                    <h4 className="text-[11px] font-bold text-white mb-2">
                      连接 ({data.incomingEdges.length + data.outgoingEdges.length})
                    </h4>
                    <div className="space-y-2">
                      {data.incomingEdges.slice(0, 5).map((edge: any, i: number) => (
                        <div key={'in'+i} className="bg-elevated border border-white/10 rounded-lg p-2.5 flex items-center gap-2 text-[11px]">
                          <span className="text-text-muted">←</span>
                          <span className="text-text-muted shrink-0">被导入</span>
                          <span className="font-semibold text-text-primary truncate">{edge.source_name || edge.source.split('/').pop()}</span>
                        </div>
                      ))}
                      {data.outgoingEdges.slice(0, 5).map((edge: any, i: number) => (
                        <div key={'out'+i} className="bg-elevated border border-white/10 rounded-lg p-2.5 flex items-center gap-2 text-[11px]">
                          <span className="text-text-muted">→</span>
                          <span className="text-text-muted shrink-0">导出到</span>
                          <span className="font-semibold text-text-primary truncate">{edge.target_name || edge.target.split('/').pop()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
'''

start_idx = content.find('{/* AST TAB CONTENT */}')
end_idx = content.find('{/* GIT HISTORY TAB CONTENT */}')

if start_idx != -1 and end_idx != -1:
    content = content[:start_idx] + new_info_tab + '\\n        ' + content[end_idx:]

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Patched successfully')
