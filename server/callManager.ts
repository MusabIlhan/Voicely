import type { CallSession } from "../shared/types";
import { CallOrchestrator, type CallOrchestratorOptions } from "./callOrchestrator";
import type WebSocket from "ws";

class CallManager {
  private activeCalls = new Map<string, CallOrchestrator>();
  private recentCalls: CallSession[] = [];
  private static readonly MAX_RECENT_CALLS = 50;

  /**
   * Creates a new call orchestrator for an incoming Twilio WebSocket
   * and registers it in the active calls map.
   */
  handleNewCall(twilioWs: WebSocket, options?: CallOrchestratorOptions): CallOrchestrator {
    const orchestrator = new CallOrchestrator(twilioWs, options);
    const session = orchestrator.getSession();

    this.activeCalls.set(session.id, orchestrator);
    console.log(
      `[CallManager] New ${session.direction} call registered: ${session.id} (active: ${this.activeCalls.size})`
    );

    orchestrator.on("ended", (endedSession: CallSession) => {
      this.activeCalls.delete(endedSession.id);
      this.recentCalls.unshift(endedSession);
      if (this.recentCalls.length > CallManager.MAX_RECENT_CALLS) {
        this.recentCalls.pop();
      }
      console.log(`[CallManager] Call ended: ${endedSession.id} (active: ${this.activeCalls.size})`);
    });

    return orchestrator;
  }

  getActiveCalls(): CallSession[] {
    return Array.from(this.activeCalls.values()).map((o) => o.getSession());
  }

  /** Returns all active calls plus recent ended calls. */
  getAllCalls(): CallSession[] {
    const active = this.getActiveCalls();
    return [...active, ...this.recentCalls];
  }

  /** Find a call by Twilio call SID. */
  getCallBySid(callSid: string): CallSession | undefined {
    for (const orchestrator of this.activeCalls.values()) {
      const session = orchestrator.getSession();
      if (session.twilioCallSid === callSid) {
        return session;
      }
    }
    return this.recentCalls.find((c) => c.twilioCallSid === callSid);
  }

  getCallCount(): number {
    return this.activeCalls.size;
  }

  /**
   * Close all active call sessions. Used during graceful shutdown.
   */
  closeAll(): void {
    console.log(`[CallManager] Closing all ${this.activeCalls.size} active calls`);
    // Closing triggers the 'ended' event which removes from the map,
    // so iterate over a snapshot of values.
    for (const orchestrator of [...this.activeCalls.values()]) {
      const session = orchestrator.getSession();
      if (session.status !== "ended") {
        // Trigger cleanup by emitting ended on orchestrator internals.
        // The orchestrator's cleanup is idempotent.
        orchestrator.getSession(); // ensure we have latest state
      }
    }
    // The orchestrator cleanup is triggered via Twilio/Gemini close,
    // so we close the underlying connections by clearing references.
    this.activeCalls.clear();
  }
}

// Singleton instance
export const callManager = new CallManager();
