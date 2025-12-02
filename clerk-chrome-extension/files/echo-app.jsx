import React, { useState, useEffect, useRef } from 'react';

// Mock data representing captured AI conversations
const mockConversations = [
  {
    id: 1,
    source: 'Claude',
    date: '2025-11-28',
    preview: 'Figured out the BLoC architecture pattern for the video sync feature...',
    fullContext: 'Use BLoC for state management. Logic layer sits between UI and data. Events flow down, states flow up. Keep business logic out of widgets.',
    tags: ['flutter', 'architecture', 'decision'],
    insight: 'BLoC separates concerns better than Provider for complex async flows'
  },
  {
    id: 2,
    source: 'GPT-4',
    date: '2025-11-25',
    preview: 'Workshop pricing strategy discussion - landed on three-session format...',
    fullContext: 'Three sessions at $X each. First session is assessment, second is implementation, third is refinement. Premium tier includes async support.',
    tags: ['business', 'pricing', 'workshops'],
    insight: 'Three-session structure creates natural commitment escalation'
  },
  {
    id: 3,
    source: 'Claude',
    date: '2025-11-20',
    preview: 'The logic layer problem - gap between product requirements and technical context...',
    fullContext: 'Product specs describe WHAT but not HOW in context. Developers need to translate intent into implementation. This translation is where AI can help most.',
    tags: ['vibecoding', 'concept', 'teaching'],
    insight: 'Logic layer problem is the core pain point vibecoding solves'
  },
  {
    id: 4,
    source: 'Claude',
    date: '2025-11-15',
    preview: 'Communication patterns - moving from hedging to direct messaging...',
    fullContext: 'Default to proactive over reactive. State intent clearly. Remove qualifiers. "Let\'s do Thursday" not "Would Thursday maybe work if you\'re free?"',
    tags: ['personal', 'communication'],
    insight: 'Directness is kindness - removes cognitive load from the other person'
  },
  {
    id: 5,
    source: 'Gemini',
    date: '2025-11-10',
    preview: 'Context profile structure for AI tools - what to include...',
    fullContext: 'Technical level, communication style, current projects, preferences, constraints. Update monthly. Keep under 500 tokens for efficiency.',
    tags: ['meta', 'productivity'],
    insight: 'Context profiles should be living documents, not static bios'
  }
];

const sourceColors = {
  'Claude': '#D97706',
  'GPT-4': '#10B981',
  'Gemini': '#6366F1'
};

export default function EchoApp() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showCommandBar, setShowCommandBar] = useState(true);
  const [extractedContext, setExtractedContext] = useState(null);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef(null);

  // Search logic
  useEffect(() => {
    if (query.trim() === '') {
      setResults([]);
      return;
    }
    
    const filtered = mockConversations.filter(conv => 
      conv.preview.toLowerCase().includes(query.toLowerCase()) ||
      conv.fullContext.toLowerCase().includes(query.toLowerCase()) ||
      conv.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase())) ||
      conv.insight.toLowerCase().includes(query.toLowerCase())
    );
    setResults(filtered);
    setSelectedIndex(0);
  }, [query]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setShowCommandBar(true);
        setTimeout(() => inputRef.current?.focus(), 0);
      }
      if (e.key === 'Escape') {
        if (extractedContext) {
          setExtractedContext(null);
        } else {
          setQuery('');
          setResults([]);
        }
      }
      if (e.key === 'ArrowDown' && results.length > 0) {
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, results.length - 1));
      }
      if (e.key === 'ArrowUp' && results.length > 0) {
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
      }
      if (e.key === 'Enter' && results.length > 0) {
        e.preventDefault();
        handleExtract(results[selectedIndex]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [results, selectedIndex, extractedContext]);

  const handleExtract = (conv) => {
    setExtractedContext({
      source: conv.source,
      date: conv.date,
      insight: conv.insight,
      context: conv.fullContext,
      tags: conv.tags
    });
  };

  const handleCopy = () => {
    const text = `## Context from ${extractedContext.source} (${extractedContext.date})

**Key insight:** ${extractedContext.insight}

**Full context:**
${extractedContext.context}

**Tags:** ${extractedContext.tags.join(', ')}`;
    
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStartFresh = () => {
    const text = `Continue from this context:

${extractedContext.insight}

${extractedContext.context}`;
    
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0A0A0B',
      color: '#FAFAFA',
      fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Subtle gradient background */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.03) 0%, transparent 50%)',
        pointerEvents: 'none'
      }} />

      {/* Header */}
      <header style={{
        padding: '24px 32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid rgba(255,255,255,0.06)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #D97706 0%, #F59E0B 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px'
          }}>
            ◐
          </div>
          <span style={{ 
            fontSize: '18px', 
            fontWeight: '600',
            letterSpacing: '-0.02em'
          }}>
            echo
          </span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ 
            fontSize: '13px', 
            color: 'rgba(255,255,255,0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <span style={{
              padding: '2px 6px',
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '4px',
              fontSize: '11px',
              fontFamily: 'monospace'
            }}>⌘K</span>
            to search
          </span>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: '#10B981',
            boxShadow: '0 0 8px rgba(16,185,129,0.5)'
          }} />
        </div>
      </header>

      {/* Main content */}
      <main style={{
        maxWidth: '720px',
        margin: '0 auto',
        padding: '80px 24px'
      }}>
        {/* Search input */}
        <div style={{
          position: 'relative',
          marginBottom: '48px'
        }}>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="What did you figure out?"
            autoFocus
            style={{
              width: '100%',
              padding: '20px 24px',
              fontSize: '18px',
              fontWeight: '400',
              backgroundColor: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '16px',
              color: '#FAFAFA',
              outline: 'none',
              transition: 'all 0.2s ease',
              boxShadow: query ? '0 0 0 1px rgba(217,119,6,0.3), 0 4px 24px rgba(0,0,0,0.3)' : 'none'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = 'rgba(217,119,6,0.5)';
              e.target.style.backgroundColor = 'rgba(255,255,255,0.06)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'rgba(255,255,255,0.08)';
              e.target.style.backgroundColor = 'rgba(255,255,255,0.04)';
            }}
          />
          
          {query && (
            <button
              onClick={() => { setQuery(''); setResults([]); }}
              style={{
                position: 'absolute',
                right: '16px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                borderRadius: '6px',
                padding: '4px 8px',
                color: 'rgba(255,255,255,0.5)',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              ESC
            </button>
          )}
        </div>

        {/* Results */}
        {results.length > 0 && !extractedContext && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            {results.map((conv, index) => (
              <div
                key={conv.id}
                onClick={() => handleExtract(conv)}
                style={{
                  padding: '20px 24px',
                  backgroundColor: selectedIndex === index 
                    ? 'rgba(217,119,6,0.1)' 
                    : 'rgba(255,255,255,0.02)',
                  border: selectedIndex === index 
                    ? '1px solid rgba(217,119,6,0.3)' 
                    : '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '8px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      fontSize: '12px',
                      fontWeight: '600',
                      color: sourceColors[conv.source],
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      {conv.source}
                    </span>
                    <span style={{
                      fontSize: '12px',
                      color: 'rgba(255,255,255,0.3)'
                    }}>
                      {conv.date}
                    </span>
                  </div>
                  <span style={{
                    fontSize: '11px',
                    color: 'rgba(255,255,255,0.3)',
                    fontFamily: 'monospace'
                  }}>
                    ↵ extract
                  </span>
                </div>
                
                <p style={{
                  fontSize: '15px',
                  color: 'rgba(255,255,255,0.9)',
                  lineHeight: '1.5',
                  margin: '0 0 12px 0'
                }}>
                  {conv.insight}
                </p>
                
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {conv.tags.map(tag => (
                    <span key={tag} style={{
                      fontSize: '11px',
                      padding: '3px 8px',
                      backgroundColor: 'rgba(255,255,255,0.06)',
                      borderRadius: '4px',
                      color: 'rgba(255,255,255,0.5)'
                    }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {query === '' && !extractedContext && (
          <div style={{
            textAlign: 'center',
            padding: '60px 0'
          }}>
            <p style={{
              fontSize: '15px',
              color: 'rgba(255,255,255,0.4)',
              lineHeight: '1.6',
              maxWidth: '400px',
              margin: '0 auto'
            }}>
              Search across all your AI conversations.<br />
              Find what you figured out. Extract it. Use it.
            </p>
            
            <div style={{
              marginTop: '40px',
              display: 'flex',
              justifyContent: 'center',
              gap: '12px',
              flexWrap: 'wrap'
            }}>
              {['architecture', 'pricing', 'decisions', 'insights'].map(suggestion => (
                <button
                  key={suggestion}
                  onClick={() => setQuery(suggestion)}
                  style={{
                    padding: '8px 16px',
                    fontSize: '13px',
                    backgroundColor: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '8px',
                    color: 'rgba(255,255,255,0.6)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.backgroundColor = 'rgba(255,255,255,0.08)';
                    e.target.style.borderColor = 'rgba(255,255,255,0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = 'rgba(255,255,255,0.04)';
                    e.target.style.borderColor = 'rgba(255,255,255,0.08)';
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Extracted context panel */}
        {extractedContext && (
          <div style={{
            animation: 'fadeIn 0.2s ease'
          }}>
            <style>{`
              @keyframes fadeIn {
                from { opacity: 0; transform: translateY(8px); }
                to { opacity: 1; transform: translateY(0); }
              }
            `}</style>
            
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '24px'
            }}>
              <button
                onClick={() => setExtractedContext(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 12px',
                  fontSize: '13px',
                  backgroundColor: 'transparent',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  color: 'rgba(255,255,255,0.6)',
                  cursor: 'pointer'
                }}
              >
                ← Back
              </button>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  fontSize: '12px',
                  fontWeight: '600',
                  color: sourceColors[extractedContext.source],
                  textTransform: 'uppercase'
                }}>
                  {extractedContext.source}
                </span>
                <span style={{
                  fontSize: '12px',
                  color: 'rgba(255,255,255,0.3)'
                }}>
                  {extractedContext.date}
                </span>
              </div>
            </div>

            <div style={{
              padding: '32px',
              backgroundColor: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '16px',
              marginBottom: '24px'
            }}>
              <div style={{
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: 'rgba(255,255,255,0.4)',
                marginBottom: '12px'
              }}>
                Key Insight
              </div>
              <p style={{
                fontSize: '20px',
                fontWeight: '500',
                color: '#FAFAFA',
                lineHeight: '1.4',
                margin: '0 0 24px 0'
              }}>
                {extractedContext.insight}
              </p>
              
              <div style={{
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: 'rgba(255,255,255,0.4)',
                marginBottom: '12px'
              }}>
                Full Context
              </div>
              <p style={{
                fontSize: '15px',
                color: 'rgba(255,255,255,0.7)',
                lineHeight: '1.6',
                margin: '0',
                whiteSpace: 'pre-wrap'
              }}>
                {extractedContext.context}
              </p>
            </div>

            {/* Actions */}
            <div style={{
              display: 'flex',
              gap: '12px'
            }}>
              <button
                onClick={handleStartFresh}
                style={{
                  flex: 1,
                  padding: '16px 24px',
                  fontSize: '15px',
                  fontWeight: '500',
                  background: 'linear-gradient(135deg, #D97706 0%, #F59E0B 100%)',
                  border: 'none',
                  borderRadius: '12px',
                  color: '#0A0A0B',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: '0 4px 16px rgba(217,119,6,0.3)'
                }}
              >
                {copied ? '✓ Copied' : 'Start fresh thread →'}
              </button>
              
              <button
                onClick={handleCopy}
                style={{
                  padding: '16px 24px',
                  fontSize: '15px',
                  fontWeight: '500',
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  color: 'rgba(255,255,255,0.8)',
                  cursor: 'pointer'
                }}
              >
                Copy all
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer - trust indicators */}
      <footer style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '16px 32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        backgroundColor: 'rgba(10,10,11,0.8)',
        backdropFilter: 'blur(12px)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}>
          <span style={{
            fontSize: '12px',
            color: 'rgba(255,255,255,0.4)'
          }}>
            5 conversations synced
          </span>
          <span style={{
            fontSize: '12px',
            color: 'rgba(255,255,255,0.2)'
          }}>•</span>
          <span style={{
            fontSize: '12px',
            color: 'rgba(255,255,255,0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <span style={{ color: '#10B981' }}>●</span> Your data stays yours
          </span>
        </div>
        
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}>
          <button style={{
            fontSize: '12px',
            color: 'rgba(255,255,255,0.4)',
            background: 'none',
            border: 'none',
            cursor: 'pointer'
          }}>
            Export all
          </button>
          <button style={{
            fontSize: '12px',
            color: '#EF4444',
            background: 'none',
            border: 'none',
            cursor: 'pointer'
          }}>
            Delete everything
          </button>
        </div>
      </footer>
    </div>
  );
}
