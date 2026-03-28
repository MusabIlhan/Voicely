import WebSocket from "ws";

const AUDIO_QUEUE_LEAD_SECONDS = 0.03;

type OutputMediaMessage =
  | { type: "hello"; botId: string }
  | { type: "clear" }
  | { type: "audio"; sampleRate: number; payload: string };

function serializeMessage(message: OutputMediaMessage): string {
  return JSON.stringify(message);
}

function renderOutputMediaHtml(botId: string): string {
  const escapedBotId = JSON.stringify(botId);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Voisli Live Output</title>
    <style>
      :root {
        color-scheme: dark;
        font-family: Georgia, "Times New Roman", serif;
        background: radial-gradient(circle at top, #2f3f33 0%, #111715 58%, #090b0a 100%);
        color: #f2efe4;
      }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
      }
      .card {
        width: min(88vw, 520px);
        padding: 32px 28px;
        border: 1px solid rgba(242, 239, 228, 0.16);
        border-radius: 24px;
        background: rgba(7, 9, 8, 0.68);
        box-shadow: 0 30px 60px rgba(0, 0, 0, 0.3);
        text-align: center;
      }
      .eyebrow {
        letter-spacing: 0.2em;
        text-transform: uppercase;
        font-size: 12px;
        opacity: 0.7;
        margin-bottom: 16px;
      }
      h1 {
        font-size: clamp(32px, 6vw, 56px);
        line-height: 0.95;
        margin: 0 0 16px;
      }
      p {
        margin: 0;
        font-size: 18px;
        line-height: 1.5;
        opacity: 0.86;
      }
      .status {
        margin-top: 18px;
        font-size: 14px;
        opacity: 0.72;
      }
    </style>
  </head>
  <body>
    <main class="card">
      <div class="eyebrow">Voisli Live</div>
      <h1>Yapper is listening.</h1>
      <p>Natural meeting responses are streamed from Gemini Live into this call in real time.</p>
      <div class="status" id="status">Connecting audio bridge...</div>
    </main>
    <script>
      (() => {
        const botId = ${escapedBotId};
        const statusEl = document.getElementById("status");
        const wsProtocol = location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = wsProtocol + "//" + location.host + "/output-media/ws?botId=" + encodeURIComponent(botId);
        const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
        const audioContext = new AudioContextCtor({ sampleRate: 24000 });
        let scheduledAt = 0;
        let reconnectTimer = null;
        const activeSources = new Set();

        function setStatus(text) {
          if (statusEl) statusEl.textContent = text;
        }

        async function ensureAudioContext() {
          if (audioContext.state !== "running") {
            try {
              await audioContext.resume();
            } catch (error) {
              console.error("[OutputMedia] Failed to resume AudioContext", error);
            }
          }
        }

        function base64ToBytes(base64) {
          const binary = atob(base64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i += 1) {
            bytes[i] = binary.charCodeAt(i);
          }
          return bytes;
        }

        function pcm16ToFloat32(bytes) {
          const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
          const samples = new Float32Array(bytes.byteLength / 2);
          for (let i = 0; i < samples.length; i += 1) {
            samples[i] = view.getInt16(i * 2, true) / 32768;
          }
          return samples;
        }

        function clearPlaybackQueue() {
          scheduledAt = audioContext.currentTime;
          activeSources.forEach((source) => {
            try {
              source.stop();
            } catch {}
          });
          activeSources.clear();
        }

        async function playPcmChunk(payload, sampleRate) {
          await ensureAudioContext();
          const bytes = base64ToBytes(payload);
          const samples = pcm16ToFloat32(bytes);
          const buffer = audioContext.createBuffer(1, samples.length, sampleRate);
          buffer.copyToChannel(samples, 0);

          const source = audioContext.createBufferSource();
          source.buffer = buffer;
          source.connect(audioContext.destination);
          const startAt = Math.max(audioContext.currentTime + ${AUDIO_QUEUE_LEAD_SECONDS}, scheduledAt);
          source.start(startAt);
          scheduledAt = startAt + buffer.duration;
          activeSources.add(source);
          source.onended = () => {
            activeSources.delete(source);
          };
        }

        function connect() {
          setStatus("Connecting audio bridge...");
          const ws = new WebSocket(wsUrl);

          ws.addEventListener("open", async () => {
            await ensureAudioContext();
            setStatus("Audio bridge connected");
          });

          ws.addEventListener("message", async (event) => {
            try {
              const message = JSON.parse(event.data);
              if (message.type === "hello") {
                setStatus("Ready for live speech");
                return;
              }
              if (message.type === "clear") {
                clearPlaybackQueue();
                return;
              }
              if (message.type === "audio") {
                setStatus("Streaming response audio");
                await playPcmChunk(message.payload, message.sampleRate || 24000);
              }
            } catch (error) {
              console.error("[OutputMedia] Failed to handle message", error);
            }
          });

          ws.addEventListener("close", () => {
            setStatus("Audio bridge disconnected, retrying...");
            clearPlaybackQueue();
            reconnectTimer = window.setTimeout(connect, 1000);
          });

          ws.addEventListener("error", (error) => {
            console.error("[OutputMedia] WebSocket error", error);
            ws.close();
          });
        }

        window.addEventListener("beforeunload", () => {
          if (reconnectTimer) {
            window.clearTimeout(reconnectTimer);
          }
        });

        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") {
            ensureAudioContext();
          }
        });

        connect();
      })();
    </script>
  </body>
</html>`;
}

export class OutputMediaHub {
  private clients = new Map<string, Set<WebSocket>>();
  private sessionTokens = new Map<string, string>();

  registerSessionToken(token: string, botId: string): void {
    this.sessionTokens.set(token, botId);
  }

  resolveBotId(tokenOrBotId: string): string | null {
    return this.sessionTokens.get(tokenOrBotId) ?? tokenOrBotId ?? null;
  }

  createSessionToken(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  addClient(botId: string, ws: WebSocket): void {
    const existing = this.clients.get(botId) ?? new Set<WebSocket>();
    existing.add(ws);
    this.clients.set(botId, existing);

    this.send(ws, { type: "hello", botId });

    ws.on("close", () => {
      this.removeClient(botId, ws);
    });

    ws.on("error", () => {
      this.removeClient(botId, ws);
    });
  }

  hasClients(botId: string): boolean {
    return this.clientCount(botId) > 0;
  }

  clientCount(botId: string): number {
    const clients = this.clients.get(botId);
    return clients ? clients.size : 0;
  }

  broadcastAudio(botId: string, audio: Buffer, sampleRate: number): void {
    this.broadcast(botId, {
      type: "audio",
      sampleRate,
      payload: audio.toString("base64"),
    });
  }

  clear(botId: string): void {
    this.broadcast(botId, { type: "clear" });
  }

  closeBot(botId: string): void {
    const clients = this.clients.get(botId);
    if (!clients) {
      return;
    }

    for (const ws of clients) {
      try {
        ws.close(1000, "bot_closed");
      } catch {
        // Ignore close errors
      }
    }

    this.clients.delete(botId);
    for (const [token, mappedBotId] of this.sessionTokens.entries()) {
      if (mappedBotId === botId) {
        this.sessionTokens.delete(token);
      }
    }
  }

  renderPage(botId: string): string {
    return renderOutputMediaHtml(botId);
  }

  private broadcast(botId: string, message: OutputMediaMessage): void {
    const clients = this.clients.get(botId);
    if (!clients || clients.size === 0) {
      return;
    }

    for (const ws of clients) {
      this.send(ws, message);
    }
  }

  private removeClient(botId: string, ws: WebSocket): void {
    const clients = this.clients.get(botId);
    if (!clients) {
      return;
    }

    clients.delete(ws);
    if (clients.size === 0) {
      this.clients.delete(botId);
    }
  }

  private send(ws: WebSocket, message: OutputMediaMessage): void {
    if (ws.readyState !== WebSocket.OPEN) {
      return;
    }
    ws.send(serializeMessage(message));
  }
}

export const outputMediaHub = new OutputMediaHub();
