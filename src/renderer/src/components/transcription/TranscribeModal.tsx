import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  X,
  AlertCircle,
  CheckCircle2,
  Languages,
  Cpu,
  Info,
  Sliders,
  Layers,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { formatTimecode } from '../../utils/timecode';

const WORD_PRESETS = [
  { value: 1, label: '1 Word', subtitle: 'Punchy / Hormozi' },
  { value: 3, label: '3 Words', subtitle: 'Reels / Shorts (Default)' },
  { value: 5, label: '5 Words', subtitle: 'Balanced Phrases' },
  { value: 0, label: 'Full Sentence', subtitle: 'Whisper Natural' },
];

export const TranscribeModal: React.FC = () => {
  const {
    transcriptionModalOpen,
    setTranscriptionModalOpen,
    currentProject,
    availableModels,
    hasGroqApiKey,
    fetchTranscriptionModels,
    startTranscription,
    transcriptionError,
    clearTranscriptionError,
  } = useAppStore();

  const [selectedModel, setSelectedModel] = useState('whisper-large-v3-turbo');
  const [selectedLanguage, setSelectedLanguage] = useState('auto');
  const [temperature, setTemperature] = useState(0);
  const [wordsPerSegment, setWordsPerSegment] = useState<number>(3);
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    if (transcriptionModalOpen) {
      void fetchTranscriptionModels();
      clearTranscriptionError();
    }
  }, [transcriptionModalOpen, fetchTranscriptionModels, clearTranscriptionError]);

  if (!transcriptionModalOpen) return null;

  const media = currentProject.mediaAsset;
  const isElectron = typeof window !== 'undefined' && Boolean(window.electronAPI);

  const handleStart = async () => {
    setIsStarting(true);
    const success = await startTranscription({
      model: selectedModel,
      language: selectedLanguage,
      temperature,
      wordsPerSegment,
    });
    setIsStarting(false);
    if (success) {
      setTranscriptionModalOpen(false);
    }
  };

  // Preview text and explanation based on wordsPerSegment
  const getPreviewData = (count: number) => {
    switch (count) {
      case 0:
        return {
          preview: 'SUCCESS COMES FROM CONSISTENT EFFORT AND FOCUS',
          desc: 'Full sentence segments based on natural Whisper speech pauses.',
        };
      case 1:
        return {
          preview: 'CREATIVITY',
          desc: '1 word per card (Hormozi style). Maximum attention retention for viral clips.',
        };
      case 2:
        return {
          preview: 'STAY FOCUSED',
          desc: '2 words per card. Fast-paced high-energy cadence.',
        };
      case 3:
        return {
          preview: 'UNLEASH YOUR CREATIVITY',
          desc: '3 words per card. Optimal reading cadence for TikTok & Instagram Reels.',
        };
      case 4:
        return {
          preview: 'MASTER YOUR CRAFT NOW',
          desc: '4 words per card. Crisp, punchy and easy to scan.',
        };
      default:
        return {
          preview: 'SUCCESS COMES FROM CONSISTENT DAILY EFFORT',
          desc: `${count} words per caption block. Balanced phrase pacing.`,
        };
    }
  };

  const previewData = getPreviewData(wordsPerSegment);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg max-h-[92vh] rounded-xl border border-[#262f3f] bg-[#12161f] shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[#212836] bg-[#0d1017] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-neutral-100">Transcribe Audio to Captions</h3>
                <span
                  className={`rounded px-1.5 py-0.5 text-[9px] font-mono font-medium ${
                    isElectron
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                  }`}
                >
                  {isElectron ? 'Desktop Shell' : 'Web Browser'}
                </span>
              </div>
              <p className="text-[11px] text-neutral-400">Powered by Groq Cloud Whisper Speech-to-Text</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setTranscriptionModalOpen(false)}
            className="rounded-md p-1.5 text-neutral-400 hover:bg-[#1b2230] hover:text-neutral-200 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* Video Target Details */}
          {media && (
            <div className="flex items-center justify-between rounded-lg border border-[#212836] bg-[#0c0e14] p-3 text-[11px]">
              <div className="truncate max-w-[280px]">
                <span className="text-neutral-400">Media source: </span>
                <span className="font-medium text-neutral-200">{media.name}</span>
              </div>
              <div className="font-mono text-emerald-400 shrink-0">
                {formatTimecode(media.durationMs)}
              </div>
            </div>
          )}

          {/* Model Selection */}
          <div>
            <label className="flex items-center gap-1.5 text-neutral-300 font-medium mb-1.5">
              <Cpu className="h-3.5 w-3.5 text-emerald-400" />
              <span>Whisper Speech Model</span>
            </label>
            <div className="grid grid-cols-1 gap-2">
              {availableModels.map((m) => {
                const isSelected = selectedModel === m.id;
                return (
                  <div
                    key={m.id}
                    onClick={() => setSelectedModel(m.id)}
                    className={`flex cursor-pointer flex-col rounded-lg border p-2.5 transition-all ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-500/10'
                        : 'border-[#222a38] bg-[#10131b] hover:border-[#313c4f]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-neutral-200">{m.name}</span>
                      {m.isDefault && (
                        <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400">
                          DEFAULT
                        </span>
                      )}
                    </div>
                    <span className="mt-0.5 text-[10px] text-neutral-400">{m.description}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Language Selection */}
          <div>
            <label className="flex items-center gap-1.5 text-neutral-300 font-medium mb-1.5">
              <Languages className="h-3.5 w-3.5 text-emerald-400" />
              <span>Spoken Language</span>
            </label>
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="w-full rounded-lg border border-[#222a38] bg-[#0e1219] px-3 py-2 text-xs text-neutral-200 focus:border-emerald-500 focus:outline-none"
            >
              <option value="auto">Auto-detect Language</option>
              <option value="en">English (US / UK / Global)</option>
              <option value="hi">Hindi (हिंदी)</option>
              <option value="hinglish">Hinglish (Hindi + English Conversational Mix)</option>
            </select>
          </div>

          {/* Multilingual / Hinglish Notice */}
          <div className="flex items-start gap-2 rounded-lg border border-[#212938] bg-[#0f131a] p-2.5 text-[11px] text-neutral-400">
            <Info className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Whisper accurately transcribes English, Hindi, and natural code-switching. Mixed sentence accuracy may vary slightly based on speaker cadence and pronunciation.
            </p>
          </div>

          {/* Words Appearing At Once (Pacing / Chunking) */}
          <div className="space-y-2 rounded-lg border border-[#222a39] bg-[#0f131b] p-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-neutral-200 font-semibold text-xs">
                <Layers className="h-3.5 w-3.5 text-emerald-400" />
                <span>Words Appearing at Once</span>
              </label>
              <span className="rounded bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-300">
                {wordsPerSegment === 0
                  ? 'Full Sentence'
                  : `${wordsPerSegment} Word${wordsPerSegment > 1 ? 's' : ''} / card`}
              </span>
            </div>

            <p className="text-[11px] text-neutral-400">
              Control the number of spoken words displayed simultaneously on screen.
            </p>

            {/* Presets Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1">
              {WORD_PRESETS.map((p) => {
                const isActive = wordsPerSegment === p.value;
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setWordsPerSegment(p.value)}
                    className={`flex flex-col items-start rounded-lg border p-2 text-left transition-all ${
                      isActive
                        ? 'border-emerald-500 bg-emerald-500/15 text-white shadow-sm'
                        : 'border-[#242c3d] bg-[#141924] text-neutral-300 hover:border-[#38455e] hover:bg-[#181f2d]'
                    }`}
                  >
                    <span className="font-semibold text-[11px]">{p.label}</span>
                    <span className="text-[9px] text-neutral-400 leading-tight mt-0.5">
                      {p.subtitle}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Fine-Tuning Slider */}
            <div className="pt-2 space-y-1">
              <div className="flex items-center justify-between text-[11px] text-neutral-400">
                <span>Custom word count:</span>
                <span className="font-mono text-neutral-200 font-medium">
                  {wordsPerSegment === 0 ? '0 (Auto/Sentence)' : `${wordsPerSegment} words`}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="8"
                step="1"
                value={wordsPerSegment}
                onChange={(e) => setWordsPerSegment(parseInt(e.target.value, 10))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <div className="flex justify-between text-[9px] font-mono text-neutral-500 px-0.5">
                <span>0 (Auto)</span>
                <span>1 Word</span>
                <span>3 Words</span>
                <span>5 Words</span>
                <span>8 Words</span>
              </div>
            </div>

            {/* Cadence Live Preview Box */}
            <div className="mt-2 rounded-lg border border-[#1b2230] bg-[#090b10] p-2.5 text-center space-y-1">
              <div className="text-[9px] font-mono tracking-wider text-neutral-500 uppercase">
                Display Cadence Preview
              </div>
              <div className="inline-block rounded bg-black/80 px-3 py-1 text-xs font-bold tracking-wide text-amber-300 border border-neutral-800 shadow-inner">
                {previewData.preview}
              </div>
              <div className="text-[10px] text-neutral-400">{previewData.desc}</div>
            </div>
          </div>

          {/* Temperature Setting */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-neutral-300">
              <span className="flex items-center gap-1">
                <Sliders className="h-3 w-3 text-neutral-400" />
                <span>Sampling Temperature</span>
              </span>
              <span className="font-mono text-[11px] text-neutral-400">{temperature} (Verbatim)</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full accent-emerald-500"
            />
          </div>

          {/* Groq API Key Status */}
          <div className="flex items-center gap-2 rounded border border-[#1e2430] bg-[#0a0d12] px-3 py-2 text-[10px]">
            {hasGroqApiKey ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span className="text-neutral-300">
                  Groq API Key configured (.env.local). Ready for transcription.
                </span>
              </>
            ) : (
              <>
                <AlertCircle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                <span className="text-amber-200/80">
                  GROQ_API_KEY not configured. Set GROQ_API_KEY in .env.local for live transcription.
                </span>
              </>
            )}
          </div>

          {/* Error Message */}
          {transcriptionError && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
              <div className="flex-1">{transcriptionError}</div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[#212836] bg-[#0d1017] px-5 py-3">
          <button
            type="button"
            onClick={() => setTranscriptionModalOpen(false)}
            className="rounded-lg border border-[#273245] bg-[#141924] px-4 py-2 text-xs font-semibold text-neutral-300 hover:bg-[#1c2333] hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleStart}
            disabled={isStarting || !media}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-md hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>{isStarting ? 'Preparing Audio...' : 'Start Transcription'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
