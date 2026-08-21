/*
  Alexa Skill Lambda handler — Vision Stick live dashboard on Echo Show
  ----------------------------------------------------------------------
  Key idea: Echo Show APL sessions don't get server push. Instead this
  handler renders the doc, then the APL document (via an onMount /
  SendEvent + Idle loop — add this command block to the APL doc's
  "onMount" if you want auto-refresh) pings the skill every few
  seconds. The skill re-fetches the latest reading from your Node
  backend and returns an APL "ExecuteCommands" directive with a
  "SetValue"/re-render to update the LiveMap.

  Simpler alternative used below: every time the skill is invoked
  (open, or a periodic "refresh" utterance / repeat SendEvent), it
  fetches the latest reading fresh and re-renders.
*/

const Alexa = require('ask-sdk-core');
const https = require('https'); // use http if your backend isn't behind TLS
const aplDocument = require('./apl_document.json');

const BACKEND_URL = 'https://YOUR_BACKEND_HOST/api/reading'; // must be HTTPS + public for Alexa cloud to reach it

function fetchReading() {
  return new Promise((resolve, reject) => {
    https.get(BACKEND_URL, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function buildAplDirective(handlerInput) {
  const reading = await fetchReading();

  return {
    type: 'Alexa.Presentation.APL.RenderDocument',
    token: 'visionStickDashboard',
    document: aplDocument,
    datasources: {
      dashboardData: {
        type: 'object',
        objectId: 'liveDashboard',
        properties: { ...reading }
      }
    }
  };
}

const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
  },
  async handle(handlerInput) {
    const directive = await buildAplDirective(handlerInput);
    return handlerInput.responseBuilder
      .speak('Here is your Vision Stick dashboard.')
      .addDirective(directive)
      // Ask the client to check back in — see note below on true auto-refresh
      .withShouldEndSession(false)
      .getResponse();
  }
};

// Fires when APL sends a SendEvent (e.g. from a looped onMount command,
// or a user tap) — re-fetch and re-render with fresh data.
const RefreshEventHandler = {
  canHandle(handlerInput) {
    const req = handlerInput.requestEnvelope.request;
    return req.type === 'Alexa.Presentation.APL.UserEvent';
  },
  async handle(handlerInput) {
    const reading = await fetchReading();
    return handlerInput.responseBuilder
      .addDirective({
        type: 'Alexa.Presentation.APL.ExecuteCommands',
        token: 'visionStickDashboard',
        commands: [
          {
            type: 'SetValue',
            componentId: 'root',
            property: 'dummy', // triggers no-op; real update below
            value: true
          },
          // Practical approach: re-send RenderDocument with fresh data
          // rather than patching individual components.
        ]
      })
      .addDirective(await buildAplDirective(handlerInput))
      .withShouldEndSession(false)
      .getResponse();
  }
};

exports.handler = Alexa.SkillBuilders.custom()
  .addRequestHandlers(LaunchRequestHandler, RefreshEventHandler)
  .lambda();

/*
  ---- TRUE AUTO-REFRESH ON THE SCREEN ----
  Alexa doesn't allow arbitrary server push to an idle APL screen.
  Two practical patterns:

  1. POLLING LOOP (works, ~5-10s cadence):
     Add this to the APL document's top-level Container:
       "onMount": [
         { "type": "SendEvent", "arguments": ["refresh"], "delay": 5000 }
       ]
     Combine with a Sequential/Idle command that repeats — this causes
     a SendEvent every N seconds, which invokes RefreshEventHandler
     above, which re-renders with fresh data. This is the standard
     "live dashboard" pattern on Echo Show today.

  2. PROACTIVE STATE / APL-only push (more advanced):
     Use the Alexa Presentation "proactive state" API to update
     LiveMap values without a full RenderDocument — requires the skill
     to hold a live APL session and push via the Alexa Gadgets/
     Presentation API. More setup, smoother updates; worth it once
     the polling version works end-to-end.
*/
