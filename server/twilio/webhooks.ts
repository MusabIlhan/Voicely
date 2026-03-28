import { Router, Request, Response } from "express";
import twilio from "twilio";
import { config } from "../config";
import { recordCallStatus, type CallStatusEvent } from "./outbound";
import { voiceCoordinator } from "../voice/voiceCoordinator.js";

const router = Router();

const VoiceResponse = twilio.twiml.VoiceResponse;

function getWsUrl(path: string): string {
  return config.server.publicUrl
    ? `wss://${config.server.publicUrl.replace(/^https?:\/\//, "")}${path}`
    : `wss://${config.server.host}:${config.server.port}${path}`;
}

/**
 * POST /twiml/:sessionId
 * Returns TwiML XML that opens a bidirectional WebSocket media stream for the session.
 */
router.post("/twiml/:sessionId", (req: Request, res: Response) => {
  try {
    const response = new VoiceResponse();
    const sessionId = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;

    response.say("Connecting you now.");

    const connect = response.connect();
    connect.stream({ url: getWsUrl(`/media-stream/${encodeURIComponent(sessionId)}`) });

    res.type("text/xml");
    res.send(response.toString());
  } catch (err) {
    console.error(`[TwiML] Error generating inbound TwiML: ${err instanceof Error ? err.message : err}`);
    // Return a fallback TwiML that tells the caller about the error
    const fallback = new VoiceResponse();
    fallback.say("I'm sorry, we're experiencing technical difficulties. Please try again later.");
    res.type("text/xml");
    res.send(fallback.toString());
  }
});

/**
 * POST /call-status/:sessionId
 * Twilio sends status callbacks here for outbound calls and hangups.
 */
router.post("/call-status/:sessionId", async (req: Request, res: Response) => {
  try {
    const sessionId = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;
    const event: CallStatusEvent = {
      callSid: req.body.CallSid ?? "",
      callStatus: req.body.CallStatus ?? "",
      direction: req.body.Direction ?? "",
      to: req.body.To ?? "",
      from: req.body.From ?? "",
      timestamp: new Date().toISOString(),
    };

    recordCallStatus(event);
    if (event.callSid) {
      voiceCoordinator.updateTwilioCallReference(sessionId, event.callSid);
    }
    if (event.callStatus === "completed") {
      await voiceCoordinator.handleTwilioTerminalEvent(sessionId, "twilio_completed_callback");
    }
    res.sendStatus(204);
  } catch (err) {
    console.error(`[TwiML] Error processing call status: ${err instanceof Error ? err.message : err}`);
    res.sendStatus(204); // Still acknowledge to Twilio to prevent retries
  }
});

export default router;
