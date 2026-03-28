import { Router, type Request, type Response } from "express";
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

function sendSessionTwiml(req: Request, res: Response): void {
  try {
    const sessionId = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;
    if (!sessionId) {
      res.status(400).type("text/xml").send("<Response><Say>Missing session.</Say></Response>");
      return;
    }

    console.log(
      `[TwiML] Building session TwiML session=${sessionId} websocket url=${getWsUrl(`/media-stream/${encodeURIComponent(sessionId)}`)}`,
    );

    const response = new VoiceResponse();
    response.say("Connecting you now.");
    const connect = response.connect();
    connect.stream({ url: getWsUrl(`/media-stream/${encodeURIComponent(sessionId)}`) });

    res.type("text/xml");
    res.send(response.toString());
  } catch (err) {
    console.error(
      `[TwiML] Error generating inbound TwiML: ${err instanceof Error ? err.message : err}`,
    );
    const fallback = new VoiceResponse();
    fallback.say(
      "I'm sorry, we're experiencing technical difficulties. Please try again later.",
    );
    res.type("text/xml");
    res.send(fallback.toString());
  }
}

async function handleCallStatus(req: Request, res: Response): Promise<void> {
  try {
    const sessionId = Array.isArray(req.params.sessionId) ? req.params.sessionId[0] : req.params.sessionId;
    if (!sessionId) {
      res.sendStatus(204);
      return;
    }

    console.log(
      `[Twilio] Call status callback session=${sessionId} sid=${req.body.CallSid ?? "unknown"} status=${req.body.CallStatus ?? "unknown"} direction=${req.body.Direction ?? "unknown"}`,
    );

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
    console.error(
      `[TwiML] Error processing call status: ${err instanceof Error ? err.message : err}`,
    );
    res.sendStatus(204);
  }
}

router.route("/twiml/:sessionId").get(sendSessionTwiml).post(sendSessionTwiml);
router.route("/call-status/:sessionId").get(handleCallStatus).post(handleCallStatus);

export default router;
