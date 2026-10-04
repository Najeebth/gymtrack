import { v4 as uuidv4 } from 'uuid';
import { addTrace, startStep, finishStep } from '../requestTracker.js';
import { bindTraceToCurrentContext } from '../asyncContext.js';

export function requestTracker(req, res, next) {
  const trace = {
    id: uuidv4(),
    method: req.method,
    url: req.originalUrl,
    startTime: new Date(),
    steps: [],
  };
  
  // expose id to later code
  req.traceId = trace.id;

  bindTraceToCurrentContext(trace);

  // expose the trace ID in the response headers so the client can subscribe
  res.setHeader('X-Trace-Id', trace.id);

  const middlewareStep = startStep(trace, 'middleware: requestTracker');

  // attach trace to response so we can push updates later
  res.trace = trace;

  // when the response finishes, close the final step
  res.on('finish', () => {
    finishStep(middlewareStep);
    
    // final step: response sent
    const respStep = startStep(trace, 'response: sent');
    finishStep(respStep);

    // keep trace in global store
    addTrace(trace);
    
    // Push update if SSE is active for this trace
    if (trace.push) {
        trace.push(trace);
    }
  });

  next();
}
