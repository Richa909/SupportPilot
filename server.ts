/**
 * server.ts - Full-Stack Express Server with Gemini API & Python Policy Engine
 * Bridges React frontend with SQLite database and authoritative Python backend.
 */

import express, { Request, Response } from 'express';
import { execFile } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const isDev = process.env.NODE_ENV !== 'production';

app.use(express.json());

// Initialize Gemini SDK on server-side
const geminiApiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;
if (geminiApiKey && geminiApiKey !== 'MY_GEMINI_API_KEY') {
  ai = new GoogleGenAI({
    apiKey: geminiApiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Helper to run python bridge commands
function runPythonBridge(action: string, payload: any = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    const bridgePath = path.join(__dirname, 'python_app', 'bridge.py');
    const payloadStr = JSON.stringify(payload);
    execFile(
      'python3',
      [bridgePath, action, payloadStr],
      { timeout: 10000, maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          console.error(`Python bridge error [${action}]:`, stderr || error.message);
          return reject(new Error(stderr || error.message));
        }
        try {
          const parsed = JSON.parse(stdout.trim());
          resolve(parsed);
        } catch (e) {
          console.error(`Failed to parse Python output [${action}]:`, stdout);
          reject(new Error(`Invalid JSON from Python bridge: ${stdout}`));
        }
      }
    );
  });
}

// Optional Gemini API intent classification with strict timeout
async function classifyIntentWithGemini(userText: string): Promise<any | null> {
  if (!ai) return null;
  try {
    const prompt = `You are an intent-classification and parameter-extraction engine for an online retailer support agent.
Customer inquiry: "${userText}"

Identify:
1. intent: one of ["order_status", "refund_request", "return_request", "damaged_item", "wrong_item", "greeting", "general_inquiry"]
2. order_id: string like "ORD-IND-1001", "ORD-IND-1002" if present in the text, otherwise null
3. issue_summary: short description
4. requires_followup: boolean (true if order ID is needed but missing)

Respond ONLY with valid JSON matching:
{"intent": string, "order_id": string|null, "issue_summary": string, "requires_followup": boolean}`;

    // 2.5s timeout for Gemini
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500));
    const geminiPromise = ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    }).then((res) => {
      const text = res.text?.trim() || '{}';
      return JSON.parse(text);
    }).catch((err) => {
      console.warn('Gemini API call failed, falling back to deterministic mode:', err.message);
      return null;
    });

    return await Promise.race([geminiPromise, timeoutPromise]);
  } catch (err: any) {
    console.warn('Gemini intent extraction error:', err.message);
    return null;
  }
}

// -------------------------------------------------------------
// API Endpoints
// -------------------------------------------------------------

// 1. Get entire store data & metrics from SQLite
app.get('/api/data', async (req: Request, res: Response) => {
  try {
    const data = await runPythonBridge('get_data');
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Customer chat agent endpoint
app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const { message, engineMode } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message text is required' });
    }

    let geminiExtraction: any = null;
    if (engineMode === 'gemini') {
      geminiExtraction = await classifyIntentWithGemini(message);
    }

    // Call Python agent to evaluate policies and execute whitelisted tools
    const agentResult = await runPythonBridge('run_agent_turn', {
      message,
      force_mode: engineMode === 'demo' || !geminiExtraction ? 'demo' : 'gemini',
      api_key: geminiApiKey,
    });

    // If Gemini provided structured intent, annotate engine
    if (geminiExtraction && agentResult) {
      agentResult.mode = 'Gemini API (gemini-3.8-flash)';
    }

    // Return agent response and fresh database state
    const freshData = await runPythonBridge('get_data');

    res.json({
      agentResponse: agentResult,
      storeData: freshData,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Supervisor decision endpoint (Approve, Decline, Request Info)
app.post('/api/supervisor/decision', async (req: Request, res: Response) => {
  try {
    const { case_id, decision, notes } = req.body;
    if (!case_id || !decision) {
      return res.status(400).json({ error: 'Case ID and decision are required.' });
    }

    const result = await runPythonBridge('supervisor_handle_case', {
      case_id,
      decision,
      notes: notes || '',
    });

    const freshData = await runPythonBridge('get_data');
    res.json({
      result,
      storeData: freshData,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Reopen or update an 'Info Requested' case
app.post('/api/supervisor/reopen', async (req: Request, res: Response) => {
  try {
    const { case_id, new_status, notes } = req.body;
    const result = await runPythonBridge('reopen_case', {
      case_id,
      new_status: new_status || 'Awaiting Review',
      notes: notes || '',
    });
    const freshData = await runPythonBridge('get_data');
    res.json({
      result,
      storeData: freshData,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Update seller policy config in SQLite
app.post('/api/config', async (req: Request, res: Response) => {
  try {
    const { key, value } = req.body;
    if (!key) {
      return res.status(400).json({ error: 'Config key is required' });
    }
    const result = await runPythonBridge('update_config', { key, value });
    const freshData = await runPythonBridge('get_data');
    res.json({
      result,
      storeData: freshData,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 6. Confirm customer query resolution
app.post('/api/resolve', async (req: Request, res: Response) => {
  try {
    const { message_id, order_id } = req.body;
    const result = await runPythonBridge('resolve_query', { message_id, order_id });
    const freshData = await runPythonBridge('get_data');
    res.json({
      result,
      storeData: freshData,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 7. Reset sample data in SQLite
app.post('/api/reset', async (req: Request, res: Response) => {
  try {
    const result = await runPythonBridge('reset_data');
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// Vite Middlewares in Dev / Static Assets in Prod
// -------------------------------------------------------------
async function setupViteOrStatic() {
  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req: Request, res: Response) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`RetailAI server listening on http://0.0.0.0:${PORT} (mode: ${isDev ? 'development' : 'production'})`);
  });
}

setupViteOrStatic().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
