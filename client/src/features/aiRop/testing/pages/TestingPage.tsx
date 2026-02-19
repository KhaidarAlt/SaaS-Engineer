import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { SectionHeader } from "../../components/SectionHeader";
import { ScoreCard } from "../components/ScoreCard";
import { ReadinessStatusCard } from "../components/ReadinessStatusCard";
import { ModeSelector } from "../components/ModeSelector";
import { PhoneFrame } from "../components/PhoneFrame";
import { ChatBubble } from "../components/ChatBubble";
import { TypingIndicator } from "../components/TypingIndicator";
import { MicroEvaluationBar } from "../components/MicroEvaluationBar";
import { MessageActions } from "../components/MessageActions";
import SimulationPanel from "../components/SimulationPanel";
import StressTestPanel from "../components/StressTestPanel";
import FreeChatPanel from "../components/FreeChatPanel";
import {
  fetchScore,
  recomputeScore,
  fetchReadiness,
  startSession,
  sendMessage,
  sendFeedback,
  startSimulation,
  nextSimulationMessage,
  startStressTest,
  fetchStressRun,
  TESTING_KEYS,
} from "../api/testingApi";
import type { TestMode, TestingMessage, FeedbackAction, ScenarioResult } from "../types/testingTypes";

interface MicroEval {
  score: number;
  positives: string[];
  issues: string[];
  suggestions: string[];
}

function MessageEvalBlock({ msg, onFeedback }: { msg: TestingMessage; onFeedback: (id: string, action: FeedbackAction, text?: string) => void }) {
  const ev = msg.meta!.microEval as unknown as MicroEval;
  return (
    <div className="mt-2 space-y-1">
      <MicroEvaluationBar
        score={ev.score}
        positives={ev.positives}
        issues={ev.issues}
        suggestions={ev.suggestions}
      />
      <MessageActions
        messageId={msg.id}
        onFeedback={onFeedback}
        currentFeedback={msg.meta?.feedback as string | undefined}
      />
    </div>
  );
}

export default function TestingPage() {
  const [mode, setMode] = useState<TestMode>("FREE_CHAT");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<TestingMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState<string>("HAGGLER");
  const [simulationRunning, setSimulationRunning] = useState(false);
  const [simulationComplete, setSimulationComplete] = useState(false);
  const [simulationSummary, setSimulationSummary] = useState<Record<string, unknown> | undefined>();
  const [stressRunId, setStressRunId] = useState<string | null>(null);
  const [stressResults, setStressResults] = useState<ScenarioResult[]>([]);
  const [stressProgress, setStressProgress] = useState(0);
  const [stressRunning, setStressRunning] = useState(false);
  const [stressScore, setStressScore] = useState<number | null>(null);
  const [stressSummary, setStressSummary] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const { data: scoreData, isLoading: scoreLoading } = useQuery({
    queryKey: TESTING_KEYS.score,
    queryFn: fetchScore,
  });

  const { data: readinessData, isLoading: readinessLoading } = useQuery({
    queryKey: TESTING_KEYS.readiness(),
    queryFn: () => fetchReadiness(),
  });

  const recomputeMutation = useMutation({
    mutationFn: recomputeScore,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TESTING_KEYS.score });
    },
  });

  const feedbackMutation = useMutation({
    mutationFn: ({ messageId, action, editedText }: { messageId: string; action: FeedbackAction; editedText?: string }) =>
      sendFeedback(messageId, action, editedText),
  });

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const resetChat = useCallback(() => {
    setSessionId(null);
    setMessages([]);
    setInputText("");
    setIsTyping(false);
    setSimulationRunning(false);
    setSimulationComplete(false);
    setSimulationSummary(undefined);
  }, []);

  const handleModeChange = useCallback((newMode: TestMode) => {
    setMode(newMode);
    resetChat();
    setStressRunId(null);
    setStressResults([]);
    setStressProgress(0);
    setStressRunning(false);
    setStressScore(null);
    setStressSummary(null);
  }, [resetChat]);

  const ensureSession = useCallback(async (): Promise<string> => {
    if (sessionId) return sessionId;
    const result = await startSession(mode);
    setSessionId(result.sessionId);
    return result.sessionId;
  }, [sessionId, mode]);

  const handleSendMessage = useCallback(async (text?: string) => {
    const messageText = text || inputText.trim();
    if (!messageText) return;

    setInputText("");
    const sid = await ensureSession();

    const userMsg: TestingMessage = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: messageText,
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);

    try {
      const result = await sendMessage(sid, messageText);
      const assistantMsg: TestingMessage = {
        id: result.assistantMessage.id,
        role: "assistant",
        content: result.assistantMessage.content,
        meta: {
          microEval: result.microEval,
          ...(result.assistantMessage.meta || {}),
        },
        createdAt: result.assistantMessage.createdAt,
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch {
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: "system" as const,
        content: "Ошибка при получении ответа от AI. Попробуйте ещё раз.",
        createdAt: new Date().toISOString(),
      }]);
    } finally {
      setIsTyping(false);
    }
  }, [inputText, ensureSession]);

  const handleStartSimulation = useCallback(async (personaKey: string) => {
    setSelectedPersona(personaKey);
    resetChat();
    setSimulationRunning(true);
    setIsTyping(true);

    try {
      const result = await startSimulation(personaKey);
      setSessionId(result.sessionId);
      const mappedMessages: TestingMessage[] = result.messages.map((m: Record<string, unknown>) => ({
        id: m.id as string,
        role: m.role as "user" | "assistant",
        content: m.content as string,
        meta: m.meta as Record<string, unknown> | undefined,
        createdAt: m.createdAt as string,
      }));
      setMessages(mappedMessages);
    } catch {
      setMessages([{
        id: `error-${Date.now()}`,
        role: "system",
        content: "Ошибка запуска симуляции. Попробуйте ещё раз.",
        createdAt: new Date().toISOString(),
      }]);
      setSimulationRunning(false);
    } finally {
      setIsTyping(false);
    }
  }, [resetChat]);

  const handleNextSimMessage = useCallback(async () => {
    if (!sessionId) return;
    setIsTyping(true);

    try {
      const result = await nextSimulationMessage(sessionId);
      const newMsg: TestingMessage = {
        id: result.message.id as string,
        role: result.message.role as "user" | "assistant",
        content: result.message.content as string,
        meta: { isSimulated: true, ...(result.message.meta as Record<string, unknown> || {}) },
        createdAt: result.message.createdAt as string,
      };
      setMessages(prev => [...prev, newMsg]);

      if ((result as Record<string, unknown>).sessionComplete) {
        setSimulationComplete(true);
        setSimulationRunning(false);
      } else {
        const aiResult = await sendMessage(sessionId, newMsg.content);
        const aiMsg: TestingMessage = {
          id: aiResult.assistantMessage.id,
          role: "assistant",
          content: aiResult.assistantMessage.content,
          meta: { microEval: aiResult.microEval },
          createdAt: aiResult.assistantMessage.createdAt,
        };
        setMessages(prev => [...prev, aiMsg]);
      }
    } catch {
      // silent
    } finally {
      setIsTyping(false);
    }
  }, [sessionId]);

  const handleStartStressTest = useCallback(async () => {
    setStressRunning(true);
    setStressResults([]);
    setStressProgress(0);
    setStressScore(null);
    setStressSummary(null);

    try {
      const result = await startStressTest();
      setStressRunId(result.runId);

      const pollInterval = setInterval(async () => {
        try {
          const run = await fetchStressRun(result.runId);
          setStressProgress(run.progress);
          if (run.scenarios) {
            setStressResults(run.scenarios);
          }
          if (run.status === "completed" || run.status === "failed") {
            clearInterval(pollInterval);
            setStressRunning(false);
            setStressScore(run.overallScore);
            setStressSummary(run.summary);
            queryClient.invalidateQueries({ queryKey: TESTING_KEYS.score });
          }
        } catch {
          clearInterval(pollInterval);
          setStressRunning(false);
        }
      }, 2000);
    } catch {
      setStressRunning(false);
    }
  }, []);

  const handleFeedback = useCallback((messageId: string, action: FeedbackAction, editedText?: string) => {
    feedbackMutation.mutate({ messageId, action, editedText });
    setMessages(prev => prev.map(m =>
      m.id === messageId ? { ...m, meta: { ...m.meta, feedback: action } } : m
    ));
  }, [feedbackMutation]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  return (
    <div data-testid="page-testing" className="space-y-6">
      <SectionHeader
        title="Тестирование"
        subtitle="Проверьте и улучшите вашего AI-продавца"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ScoreCard
          score={scoreData?.scoreTotal ?? 0}
          breakdown={scoreData?.breakdown ? {
            completeness: { score: scoreData.breakdown.completeness.score, max: scoreData.breakdown.completeness.max },
            behavior: { score: scoreData.breakdown.behavior.score, max: scoreData.breakdown.behavior.max },
            operations: { score: scoreData.breakdown.operations.score, max: scoreData.breakdown.operations.max },
            testing: { score: scoreData.breakdown.testing.score, max: scoreData.breakdown.testing.max },
          } : { completeness: { score: 0, max: 30 }, behavior: { score: 0, max: 30 }, operations: { score: 0, max: 20 }, testing: { score: 0, max: 20 } }}
          isLoading={scoreLoading}
          onRecompute={() => recomputeMutation.mutate()}
          isRecomputing={recomputeMutation.isPending}
        />
        <ReadinessStatusCard
          status={readinessData?.status ?? "BLOCKED"}
          reasons={readinessData?.reasons ?? []}
          isLoading={readinessLoading}
        />
      </div>

      <ModeSelector value={mode} onChange={handleModeChange} />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 flex justify-center">
          <PhoneFrame>
            <div className="flex flex-col min-h-[400px]">
              <div className="flex-1 p-3 space-y-1">
                {messages.length === 0 && (
                  <div className="flex items-center justify-center h-full text-muted-foreground text-sm py-16" data-testid="chat-empty-state">
                    {mode === "FREE_CHAT" && "Напишите сообщение, чтобы начать тестирование"}
                    {mode === "SIMULATION" && "Выберите персону и запустите симуляцию"}
                    {mode === "STRESS_TEST" && "Запустите стресс-тест для автоматической проверки"}
                  </div>
                )}
                {messages.map((msg) => (
                  <ChatBubble
                    key={msg.id}
                    role={msg.role === "system" ? "assistant" : msg.role}
                    content={msg.content}
                    timestamp={new Date(msg.createdAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                    isSimulated={msg.meta?.isSimulated as boolean}
                  >
                    {msg.role === "assistant" && msg.meta?.microEval && (
                      <MessageEvalBlock
                        msg={msg}
                        onFeedback={handleFeedback}
                      />
                    )}
                  </ChatBubble>
                ))}
                <TypingIndicator visible={isTyping} />
                <div ref={chatEndRef} />
              </div>

              {mode !== "STRESS_TEST" && (
                <div className="p-2 border-t bg-background/80 flex items-center gap-2">
                  <Input
                    data-testid="input-chat-message"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Напишите сообщение..."
                    className="flex-1"
                    disabled={isTyping}
                  />
                  <Button
                    data-testid="button-send-message"
                    size="icon"
                    onClick={() => handleSendMessage()}
                    disabled={!inputText.trim() || isTyping}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </PhoneFrame>
        </div>

        <div className="lg:col-span-2">
          {mode === "FREE_CHAT" && (
            <FreeChatPanel onSendHint={(text) => handleSendMessage(text)} />
          )}
          {mode === "SIMULATION" && (
            <SimulationPanel
              onStartSimulation={handleStartSimulation}
              onNextMessage={handleNextSimMessage}
              isRunning={simulationRunning}
              sessionComplete={simulationComplete}
              sessionSummary={simulationSummary}
            />
          )}
          {mode === "STRESS_TEST" && (
            <StressTestPanel
              onRunStressTest={handleStartStressTest}
              isRunning={stressRunning}
              progress={stressProgress}
              results={stressResults}
              overallScore={stressScore}
              summary={stressSummary}
            />
          )}
        </div>
      </div>
    </div>
  );
}
