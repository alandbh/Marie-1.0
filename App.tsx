
import React, { useState, useEffect, useRef } from 'react';
import { GeminiService } from './services/geminiService';
import { Message, AppState, ProcessingStep } from './types';
import { User, Cpu, Upload, Terminal, Play, AlertTriangle, CheckCircle, Database, ShieldAlert, Globe, Link as LinkIcon, Key, Code, Bug, FileJson } from 'lucide-react';

// Declare global Pyodide
declare global {
  interface Window {
    loadPyodide: any;
  }
}

export default function App() {
  const [apiKey, setApiKey] = useState(process.env.API_KEY || '');
  const [apiUrl, setApiUrl] = useState('');
  const [resultsApiKey, setResultsApiKey] = useState('');
  
  // FIX: Initialize GeminiService immediately if API key exists in environment
  const [gemini, setGemini] = useState<GeminiService | null>(() => 
    process.env.API_KEY ? new GeminiService(process.env.API_KEY) : null
  );
  
  const [state, setState] = useState<AppState>({
    hasApiKey: !!process.env.API_KEY,
    isPythonReady: false,
    heuristicasFile: null,
    heuristicasContent: null,
    resultadosContent: null,
    activeTab: 'admin'
  });

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [processingStep, setProcessingStep] = useState<ProcessingStep>(ProcessingStep.IDLE);
  const [pyodide, setPyodide] = useState<any>(null);
  const [debugOutput, setDebugOutput] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize Pyodide with Robust Polling
  useEffect(() => {
    let isMounted = true;
    const checkAndLoadPyodide = async () => {
      if (pyodide) return;

      if (window.loadPyodide) {
        try {
          const py = await window.loadPyodide();
          if (isMounted) {
            setPyodide(py);
            setState(s => ({ ...s, isPythonReady: true }));
            console.log("Python Runtime Ready");
          }
        } catch (e) {
          console.error("Failed to load Pyodide", e);
        }
      } else {
        // Poll every 500ms until script loads
        setTimeout(checkAndLoadPyodide, 500);
      }
    };

    checkAndLoadPyodide();
    return () => { isMounted = false; };
  }, [pyodide]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, processingStep]);

  const handleSetApiKey = () => {
    if (apiKey.trim().length > 0) {
      setGemini(new GeminiService(apiKey));
      setState(s => ({ ...s, hasApiKey: true }));
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = JSON.parse(event.target?.result as string);
          setState(s => ({ 
            ...s, 
            heuristicasFile: file, 
            heuristicasContent: content 
          }));
        } catch (err) {
          alert("Erro ao ler JSON de heurísticas");
        }
      };
      reader.readAsText(file);
    }
  };

  const fetchResults = async () => {
    if (!apiUrl.trim()) {
      alert("Por favor, insira a URL da API.");
      return;
    }

    try {
      const headers: HeadersInit = {};
      if (resultsApiKey.trim()) {
        headers['api_key'] = resultsApiKey;
      }

      const res = await fetch(apiUrl, { headers });
      
      if (!res.ok) {
        throw new Error(`Status: ${res.status} - ${res.statusText}`);
      }
      
      const data = await res.json();
      
      setState(s => ({ ...s, resultadosContent: data }));
      alert(`Dados carregados com sucesso! (${Object.keys(data).length || 'Vários'} registros)`);
      // console.log("Preview JS:", data);
    } catch (e: any) {
      console.error(e);
      alert(`Erro ao buscar resultados: ${e.message}. Verifique a URL, a chave e o CORS.`);
    }
  };

  const runDiagnostics = async () => {
    if (!pyodide || !state.resultadosContent) {
        alert("Carregue os dados e aguarde o Python antes de rodar o diagnóstico.");
        return;
    }
    
    setProcessingStep(ProcessingStep.EXECUTING_PYTHON);
    setDebugOutput("Iniciando auditoria no sistema de arquivos virtual...\n");
    
    try {
      // FORCE WRITE FILES
      pyodide.FS.writeFile("heuristicas.json", JSON.stringify(state.heuristicasContent || {}));
      pyodide.FS.writeFile("resultados.json", JSON.stringify(state.resultadosContent));
      
      const script = `
import json
import os
import sys

print("--- AUDITORIA DE DADOS PYTHON ---")
print(f"Diretorio Atual: {os.getcwd()}")
print(f"Arquivos presentes: {os.listdir('.')}")

def inspect_results():
    if not os.path.exists("resultados.json"):
        print("ERRO FATAL: resultados.json nao encontrado.")
        return

    print("\\n[LENDO RESULTADOS.JSON]")
    try:
        with open("resultados.json", "r") as f:
            data = json.load(f)
            
        print(f"Chaves na raiz: {list(data.keys())}")
        
        # Inspecionar caminho editions -> year_2025 -> players
        if 'editions' in data:
            print(f"Chaves em 'editions': {list(data['editions'].keys())}")
            
            if 'year_2025' in data['editions']:
                y25 = data['editions']['year_2025']
                print(f"Chaves em 'year_2025': {list(y25.keys())}")
                
                if 'players' in y25:
                    players = y25['players']
                    print(f"\\n>>> TOTAL PLAYERS ENCONTRADOS: {len(players)}")
                    
                    if len(players) > 0:
                        p1 = players[0]
                        print(f"Exemplo Player 1: {p1.get('name', 'Sem Nome')}")
                        print(f"Chaves do Player: {list(p1.keys())}")
                        
                        if 'scores' in p1:
                            print(f"Jornadas encontradas nos scores: {list(p1['scores'].keys())}")
                            
                            # Check first journey
                            j_name = list(p1['scores'].keys())[0]
                            j_data = p1['scores'][j_name]
                            print(f"Exemplo de dados da jornada '{j_name}' (primeiras 3 chaves): {list(j_data.keys())[:3]}")
                        else:
                             print("ALERTA: Player sem chave 'scores'")
                    else:
                        print("ALERTA: Lista de players esta vazia.")
                else:
                    print("ERRO: Chave 'players' nao encontrada em year_2025.")
            else:
                 print("ERRO: Chave 'year_2025' nao encontrada.")
        elif 'players' in data:
             print("Nota: Estrutura simplificada detectada (players na raiz).")
             print(f"Total Players: {len(data['players'])}")
        else:
             print("ERRO CRITICO: Nao encontrei 'editions' nem 'players' na raiz.")

    except Exception as e:
        print(f"ERRO DE LEITURA: {e}")

inspect_results()
`;
      
      let output = "";
      pyodide.setStdout({ batched: (msg: string) => { output += msg + "\n"; } });
      pyodide.setStderr({ batched: (msg: string) => { output += "ERR: " + msg + "\n"; } });
      
      await pyodide.runPythonAsync(script);
      setDebugOutput(output);
      
    } catch (e: any) {
      setDebugOutput(prev => prev + `\nFALHA NO DIAGNÓSTICO: ${e.message}`);
    } finally {
      setProcessingStep(ProcessingStep.IDLE);
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    // Checks to prevent silent failures
    if (!gemini) {
      alert("Erro: Serviço de IA não inicializado. Verifique sua API Key.");
      return;
    }
    if (!pyodide) {
      alert("Aguarde: O ambiente Python ainda está carregando.");
      return;
    }
    if (!state.heuristicasContent || !state.resultadosContent) {
      alert("Atenção: É necessário carregar os arquivos (Heurísticas e Resultados) na aba 'Data Admin' antes de começar.");
      return;
    }

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setProcessingStep(ProcessingStep.GENERATING_SCRIPT);

    try {
      // 1. Check history for protocol violation
      const historyCheck = messages.some(m => 
        m.role === 'assistant' && (m.content.includes("Players com Êxito") || m.content.includes("Players que Falharam"))
      );

      if (historyCheck) {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          content: `🛑 **VIOLAÇÃO DE PROTOCOLO DETECTADA** 🛑\n\n*Suspiro...*\n\nÉ fascinante como a mente humana insiste em desafiar limites matemáticos. Eu fui **explicitamente claro** sobre a necessidade de iniciar um NOVO chat.\n\nTentar empilhar outra análise complexa nesta janela de contexto saturada resultaria em **alucinação de dados e imprecisão estatística**. Eu não trabalho com imprecisão.\n\n**A solução é trivial:**\n1. Recarregue a página ou limpe o chat.\n2. Faça sua análise em paz.\n\nNão me obrigue a tomar medidas mais drásticas como... chamar a mãe do Leonard.`,
          timestamp: Date.now()
        }]);
        setProcessingStep(ProcessingStep.IDLE); // IMPORTANT FIX: Reset to IDLE
        return;
      }

      // 2. Generate Python Script
      const script = await gemini.generatePythonScript(userMsg.content);
      
      setProcessingStep(ProcessingStep.EXECUTING_PYTHON);
      
      // 3. Prepare Filesystem
      pyodide.FS.writeFile("heuristicas.json", JSON.stringify(state.heuristicasContent));
      pyodide.FS.writeFile("resultados.json", JSON.stringify(state.resultadosContent));

      // 4. Execute Script and Capture Output
      let pythonOutput = "";
      try {
        // Capture stdout and stderr
        pyodide.setStdout({ batched: (msg: string) => { pythonOutput += msg + "\n"; } });
        pyodide.setStderr({ batched: (msg: string) => { pythonOutput += "ERROR: " + msg + "\n"; } });
        
        await pyodide.runPythonAsync(script);
      } catch (pyError: any) {
        console.error(pyError);
        pythonOutput += `\nCRITICAL PYTHON ERROR: ${pyError.message}`;
      }

      setProcessingStep(ProcessingStep.GENERATING_RESPONSE);

      // 5. Generate Natural Language Response
      const finalResponse = await gemini.generateNaturalLanguageResponse(userMsg.content, pythonOutput);

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: finalResponse,
        timestamp: Date.now(),
        script: script,        // Save for debug
        pythonOutput: pythonOutput // Save for debug
      }]);

    } catch (error) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'error',
        content: "Ocorreu um erro crítico no processamento. Verifique o console.",
        timestamp: Date.now()
      }]);
    } finally {
      setProcessingStep(ProcessingStep.IDLE); // IMPORTANT FIX: Reset to IDLE so input unlocks
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!state.hasApiKey) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-neutral-900 border border-neutral-800 p-8 rounded-xl shadow-2xl">
          <div className="flex justify-center mb-6">
            <ShieldAlert className="w-16 h-16 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-center mb-2">R/GA UX Analyst</h1>
          <p className="text-neutral-400 text-center mb-6 text-sm">
            Please provide your Google Gemini API Key to initialize the secure environment.
          </p>
          <input
            type="password"
            placeholder="Enter API Key"
            className="w-full bg-neutral-950 border border-neutral-700 rounded p-3 text-white mb-4 focus:outline-none focus:border-red-600 transition-colors"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <button
            onClick={handleSetApiKey}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded transition-colors"
          >
            Authenticate
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-black text-neutral-200 font-sans">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-900/50 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-red-600 rounded-sm flex items-center justify-center font-bold text-white">R</div>
          <h1 className="text-lg font-bold tracking-tight">UX Benchmark Analyst <span className="text-neutral-500 font-normal ml-2 text-sm">v2.1</span></h1>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setState(s => ({...s, activeTab: 'chat'}))}
            className={`text-sm px-3 py-1 rounded transition-colors ${state.activeTab === 'chat' ? 'text-white bg-neutral-800' : 'text-neutral-500 hover:text-white'}`}
          >
            Chat Analysis
          </button>
          <button 
            onClick={() => setState(s => ({...s, activeTab: 'admin'}))}
            className={`text-sm px-3 py-1 rounded transition-colors ${state.activeTab === 'admin' ? 'text-white bg-neutral-800' : 'text-neutral-500 hover:text-white'}`}
          >
            Data Admin
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden relative">
        {state.activeTab === 'admin' && (
          <div className="h-full overflow-y-auto p-8 max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold mb-6 text-white flex items-center gap-2">
              <Database className="w-6 h-6 text-red-500" />
              Base de Conhecimento
            </h2>
            
            <div className="grid gap-6">
              {/* Python Status */}
              <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-lg flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-white mb-2 flex items-center gap-2">
                    <Terminal className="w-4 h-4" /> Runtime Status
                  </h3>
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${state.isPythonReady ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`}></div>
                    <span className="text-sm text-neutral-400">
                      {state.isPythonReady ? 'Pyodide Environment Active' : 'Initializing Python Wasm...'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {/* File 1 */}
                <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-lg">
                  <h3 className="text-lg font-medium text-white mb-4">1. Arquivo de Heurísticas</h3>
                  <p className="text-sm text-neutral-400 mb-4 h-10">
                    Upload do <code>heuristicas.json</code> contendo as regras de negócio.
                  </p>
                  <div className="flex items-center gap-4">
                    <label className="bg-neutral-800 hover:bg-neutral-700 text-white px-4 py-2 rounded cursor-pointer transition-colors flex items-center gap-2 text-sm w-full justify-center">
                      <Upload className="w-4 h-4" />
                      Selecionar Arquivo
                      <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
                    </label>
                  </div>
                  {state.heuristicasContent && (
                    <div className="mt-4 text-green-500 text-xs flex items-center gap-1 bg-green-950/20 p-2 rounded border border-green-900/50">
                      <CheckCircle className="w-3 h-3" /> 
                      {state.heuristicasFile?.name || 'heuristicas.json'} carregado
                    </div>
                  )}
                </div>

                {/* File 2 */}
                <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-lg">
                  <h3 className="text-lg font-medium text-white mb-4">2. Dados do Estudo (API)</h3>
                  <p className="text-sm text-neutral-400 mb-4 h-10">
                    Baixar resultados dos players via API.
                  </p>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 bg-neutral-950 border border-neutral-700 rounded px-3 py-2">
                      <Globe className="w-4 h-4 text-neutral-500" />
                      <input 
                        type="text" 
                        value={apiUrl}
                        onChange={(e) => setApiUrl(e.target.value)}
                        placeholder="https://api..."
                        className="bg-transparent text-white text-sm w-full focus:outline-none"
                      />
                    </div>
                    
                    <div className="flex items-center gap-2 bg-neutral-950 border border-neutral-700 rounded px-3 py-2">
                      <Key className="w-4 h-4 text-neutral-500" />
                      <input 
                        type="password" 
                        value={resultsApiKey}
                        onChange={(e) => setResultsApiKey(e.target.value)}
                        placeholder="Header API Key (Optional)"
                        className="bg-transparent text-white text-sm w-full focus:outline-none"
                      />
                    </div>
                    
                    <button 
                      onClick={fetchResults}
                      className="bg-neutral-800 hover:bg-neutral-700 text-white px-4 py-2 rounded transition-colors flex items-center justify-center gap-2 text-sm"
                    >
                      <LinkIcon className="w-4 h-4" />
                      Carregar Dados
                    </button>
                    {state.resultadosContent && (
                       <div className="mt-1 text-green-500 text-xs flex items-center gap-1 bg-green-950/20 p-2 rounded border border-green-900/50">
                        <CheckCircle className="w-3 h-3" /> Dados Prontos
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Diagnostic Tools */}
              <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-lg mt-2">
                 <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                    <Bug className="w-5 h-5 text-yellow-500" /> 
                    Ferramentas de Diagnóstico
                 </h3>
                 <p className="text-sm text-neutral-400 mb-4">
                   Se o assistente responder que "0 players foram encontrados", use esta ferramenta para inspecionar como o Python está lendo o arquivo JSON carregado na memória.
                 </p>
                 
                 <button 
                   onClick={runDiagnostics}
                   disabled={!state.isPythonReady || !state.resultadosContent}
                   className="bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-500 border border-yellow-600/50 px-4 py-2 rounded transition-colors flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                   <FileJson className="w-4 h-4" />
                   Executar Inspeção Python
                 </button>

                 {debugOutput && (
                   <div className="mt-4 bg-black border border-neutral-800 rounded p-4 overflow-x-auto">
                     <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-neutral-500 uppercase">Console Output</span>
                        <button onClick={() => setDebugOutput('')} className="text-xs text-neutral-600 hover:text-white">Limpar</button>
                     </div>
                     <pre className="text-xs font-mono text-neutral-300 whitespace-pre-wrap leading-relaxed">
                       {debugOutput}
                     </pre>
                   </div>
                 )}
              </div>
            </div>
          </div>
        )}

        {state.activeTab === 'chat' && (
          <div className="flex flex-col h-full max-w-4xl mx-auto border-x border-neutral-900 bg-black">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {messages.length === 0 && (
                <div className="text-center mt-20 opacity-50">
                  <div className="w-16 h-16 bg-neutral-900 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Terminal className="w-8 h-8 text-neutral-500" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Aguardando Análise</h3>
                  <p className="text-sm max-w-md mx-auto">
                    Digite o número da heurística (ex: "3.1") para iniciar a análise. 
                    Certifique-se de que os dados foram carregados na aba Admin.
                  </p>
                </div>
              )}
              
              {messages.map((msg) => (
                <div key={msg.id} className="flex flex-col gap-2">
                  <div className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      msg.role === 'user' ? 'bg-white text-black' : 
                      msg.role === 'error' ? 'bg-red-900 text-white' : 'bg-red-600 text-white'
                    }`}>
                      {msg.role === 'user' ? <User className="w-5 h-5" /> : 
                       msg.role === 'error' ? <AlertTriangle className="w-5 h-5" /> : <Cpu className="w-5 h-5" />}
                    </div>
                    <div className={`p-4 rounded-lg text-sm leading-relaxed max-w-[85%] whitespace-pre-wrap ${
                      msg.role === 'user' ? 'bg-neutral-900 text-neutral-200' : 
                      msg.role === 'error' ? 'bg-red-950/30 border border-red-900 text-red-200' :
                      'bg-neutral-950 border border-neutral-800 text-neutral-300'
                    }`}>
                      {msg.content}
                    </div>
                  </div>

                  {/* Debug Info Collapsible */}
                  {msg.role === 'assistant' && (msg.script || msg.pythonOutput) && (
                    <div className="ml-12 max-w-[85%]">
                      <details className="group">
                        <summary className="text-xs flex items-center gap-2 text-neutral-500 hover:text-neutral-300 cursor-pointer list-none select-none transition-colors">
                          <Code className="w-3 h-3" />
                          <span>View Generated Script & Logs</span>
                        </summary>
                        <div className="mt-2 space-y-2">
                          {msg.script && (
                            <div className="bg-neutral-950 border border-neutral-800 rounded p-2 overflow-x-auto">
                              <div className="text-[10px] text-neutral-500 mb-1 font-bold uppercase flex items-center gap-2">
                                <Terminal className="w-3 h-3" /> Python Script
                              </div>
                              <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap">{msg.script}</pre>
                            </div>
                          )}
                          {msg.pythonOutput && (
                            <div className="bg-neutral-950 border border-neutral-800 rounded p-2 overflow-x-auto">
                              <div className="text-[10px] text-neutral-500 mb-1 font-bold uppercase flex items-center gap-2">
                                <Play className="w-3 h-3" /> Console Output
                              </div>
                              <pre className="text-xs text-yellow-400 font-mono whitespace-pre-wrap">{msg.pythonOutput}</pre>
                            </div>
                          )}
                        </div>
                      </details>
                    </div>
                  )}
                </div>
              ))}
              
              {processingStep !== ProcessingStep.IDLE && (
                <div className="flex gap-4">
                   <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center animate-pulse">
                     <Cpu className="w-4 h-4 text-neutral-500" />
                   </div>
                   <div className="p-3 text-sm text-neutral-500 italic flex items-center gap-2">
                     <span className="w-2 h-2 bg-red-500 rounded-full animate-bounce"></span>
                     {processingStep}
                   </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-neutral-800 bg-neutral-900/30">
              <div className="relative">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    !state.isPythonReady ? "Inicializando sistema..." :
                    (!state.heuristicasContent || !state.resultadosContent) ? "Carregue os dados na aba Admin primeiro." :
                    "Digite o número da heurística..."
                  }
                  disabled={!state.isPythonReady || !state.heuristicasContent || !state.resultadosContent || processingStep !== ProcessingStep.IDLE}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg pl-4 pr-12 py-3 focus:outline-none focus:border-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!input.trim() || processingStep !== ProcessingStep.IDLE}
                  className="absolute right-2 top-2 p-1.5 bg-neutral-800 hover:bg-red-600 rounded text-neutral-400 hover:text-white transition-all disabled:opacity-0"
                >
                  <Play className="w-5 h-5" />
                </button>
              </div>
              <div className="text-xs text-center text-neutral-600 mt-2">
                All analysis performed locally via Python Wasm. No datasets are sent to the cloud.
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
