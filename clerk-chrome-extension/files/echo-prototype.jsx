import React, { useState, useEffect } from 'react';

const Echo = () => {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState(null);
  const [selectedResult, setSelectedResult] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  
  // Simulated search results based on the user's actual context
  const mockResults = [
    {
      id: 1,
      insight: "BLoC architecture keeps business logic separate from UI. The 'Logic Layer Problem' is the gap between product requirements and technical implementation context.",
      source: 'Claude',
      date: 'Nov 12, 2024',
      conversationTitle: 'Flutter architecture deep dive',
      relevance: 0.94,
      fullExchange: {
        user: "I keep running into this issue where my product specs don't translate cleanly into code. Like there's a missing layer.",
        assistant: "You're describing what I'd call the Logic Layer Problem—the gap between product requirements and technical implementation context. BLoC architecture addresses this by creating an explicit layer where business logic lives, separate from both UI and data. The bloc becomes the translation layer between 'what the product should do' and 'how the code does it.'"
      }
    },
    {
      id: 2,
      insight: "For video-transcript sync, chunk by semantic meaning not fixed time intervals. Align to sentence boundaries, then map timestamps to text spans.",
      source: 'GPT-4',
      date: 'Nov 8, 2024',
      conversationTitle: 'Building the workshop platform',
      relevance: 0.89,
      fullExchange: {
        user: "How should I approach syncing video playback with transcript highlights?",
        assistant: "Don't chunk by fixed time intervals—you'll cut mid-sentence and the UX feels broken. Instead, chunk by semantic meaning: sentence boundaries first, then map timestamp ranges to text spans. When user clicks text, seek to span.start. When video plays, highlight the span whose range contains currentTime."
      }
    },
    {
      id: 3,
      insight: "Context profiles should be goal-specific. 'Draft replies' needs different priming than 'code review'. Extract per-task, not universal.",
      source: 'Claude',
      date: 'Nov 15, 2024',
      conversationTitle: 'Portable AI context',
      relevance: 0.87,
      fullExchange: {
        user: "Should I try to create one master context profile or multiple?",
        assistant: "Goal-specific. A context profile optimized for 'draft replies' needs to capture your tone, relationship dynamics, and communication style. One for 'code review' needs your stack preferences, quality bar, and common patterns. Trying to collapse these into one universal profile dilutes both. Extract per-task."
      }
    }
  ];

  const handleSearch = () => {
    if (!query.trim()) return;
    setIsSearching(true);
    setResults(null);
    setSelectedResult(null);
    
    // Simulate search delay
    setTimeout(() => {
      setIsSearching(false);
      setResults(mockResults);
    }, 1200);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const SourceBadge = ({ source }) => {
    const colors = {
      'Claude': 'bg-orange-500/20 text-orange-300 border-orange-500/30',
      'GPT-4': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      'Gemini': 'bg-blue-500/20 text-blue-300 border-blue-500/30'
    };
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full border ${colors[source] || 'bg-gray-500/20 text-gray-300'}`}>
        {source}
      </span>
    );
  };

  const StatCard = ({ number, label }) => (
    <div className="text-center">
      <div className="text-2xl font-light text-white">{number}</div>
      <div className="text-xs text-zinc-500 mt-1">{label}</div>
    </div>
  );

  // Expanded result detail view
  if (selectedResult) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white p-8">
        <div className="max-w-2xl mx-auto">
          <button 
            onClick={() => setSelectedResult(null)}
            className="text-zinc-500 hover:text-white transition-colors mb-8 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to results
          </button>
          
          <div className="flex items-center gap-3 mb-6">
            <SourceBadge source={selectedResult.source} />
            <span className="text-zinc-500 text-sm">{selectedResult.date}</span>
          </div>
          
          <h1 className="text-xl font-medium mb-8 text-zinc-300">
            {selectedResult.conversationTitle}
          </h1>
          
          <div className="space-y-6">
            <div className="bg-zinc-900/50 rounded-2xl p-6 border border-zinc-800">
              <div className="text-xs text-zinc-500 uppercase tracking-wide mb-3">You asked</div>
              <p className="text-zinc-300 leading-relaxed">{selectedResult.fullExchange.user}</p>
            </div>
            
            <div className="bg-gradient-to-br from-zinc-900 to-zinc-900/50 rounded-2xl p-6 border border-zinc-700">
              <div className="text-xs text-zinc-500 uppercase tracking-wide mb-3">Insight</div>
              <p className="text-white leading-relaxed">{selectedResult.fullExchange.assistant}</p>
            </div>
          </div>
          
          <div className="mt-8 flex gap-3">
            <button className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors">
              Copy insight
            </button>
            <button className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors">
              Continue this thread
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Main content */}
      <div className="flex flex-col items-center justify-center min-h-screen p-8">
        <div className="w-full max-w-2xl">
          
          {/* Logo / Title - minimal */}
          <div className="text-center mb-12">
            <h1 className="text-3xl font-light tracking-tight mb-2">echo</h1>
            <p className="text-zinc-500 text-sm">ask your history anything</p>
          </div>
          
          {/* Search input */}
          <div className="relative mb-8">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="What did I figure out about..."
              className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-6 py-4 text-lg focus:outline-none focus:border-zinc-600 transition-colors placeholder:text-zinc-600"
              autoFocus
            />
            <button
              onClick={handleSearch}
              disabled={isSearching || !query.trim()}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-zinc-500 hover:text-white disabled:opacity-30 transition-colors"
            >
              {isSearching ? (
                <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              )}
            </button>
          </div>
          
          {/* Quick suggestions - only show when no results */}
          {!results && !isSearching && (
            <div className="flex flex-wrap gap-2 justify-center mb-12">
              {['architecture decisions', 'what I believe about AI', 'unshipped ideas'].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => {
                    setQuery(suggestion);
                  }}
                  className="px-4 py-2 bg-zinc-900/50 border border-zinc-800 rounded-full text-sm text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
          
          {/* Searching state */}
          {isSearching && (
            <div className="text-center py-12">
              <div className="text-zinc-500">Searching across 847 conversations...</div>
            </div>
          )}
          
          {/* Results */}
          {results && (
            <div className="space-y-4">
              <div className="text-xs text-zinc-500 uppercase tracking-wide mb-4">
                {results.length} relevant moments found
              </div>
              
              {results.map((result) => (
                <button
                  key={result.id}
                  onClick={() => setSelectedResult(result)}
                  className="w-full text-left bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 hover:border-zinc-600 hover:bg-zinc-900 transition-all group"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <SourceBadge source={result.source} />
                    <span className="text-zinc-600 text-sm">{result.date}</span>
                    <span className="text-zinc-700 text-sm ml-auto">{Math.round(result.relevance * 100)}% match</span>
                  </div>
                  <p className="text-zinc-200 leading-relaxed group-hover:text-white transition-colors">
                    {result.insight}
                  </p>
                  <div className="mt-3 text-zinc-600 text-sm">
                    from "{result.conversationTitle}"
                  </div>
                </button>
              ))}
            </div>
          )}
          
          {/* Stats footer - only when no results shown */}
          {!results && !isSearching && (
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2">
              <div className="flex gap-8 px-6 py-3 bg-zinc-900/80 backdrop-blur border border-zinc-800 rounded-full">
                <StatCard number="847" label="conversations" />
                <StatCard number="3" label="sources" />
                <StatCard number="12.4k" label="insights" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Echo;
