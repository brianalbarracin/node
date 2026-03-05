import express from 'express';
import axios from 'axios';

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json');
  next();
});

// Endpoint que Retell usará como URL del MCP
app.post('/mcp', async (req, res) => {
  const body = req.body;

  // LOG: Cuerpo recibido
  console.log('=== NUEVA PETICIÓN POST /mcp ===');
  console.log('Headers:', req.headers);
  console.log('Body (raw):', JSON.stringify(body, null, 2));
  console.log('Body type:', typeof body);

  // Verifica que sea una petición JSON-RPC válida
  if (!body || !body.jsonrpc || body.jsonrpc !== '2.0' || !body.method) {
    console.log('-> Error: Invalid Request (400)');
    return res.status(400).json({
      jsonrpc: '2.0',
      error: { code: -32600, message: 'Invalid Request' },
      id: body?.id || null
    });
  }

  // Manejo del método 'initialize'
  if (body.method === 'initialize') {
    console.log('-> Manejando initialize');
    return res.json({
      jsonrpc: '2.0',
      id: body.id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {
            listChanged: false
          }
        },
        serverInfo: {
          name: 'n8n-mcp-proxy',
          version: '1.0.0'
        }
      }
    });
  }

  // Manejo del método 'tools/list'
  if (body.method === 'tools/list') {
    console.log('-> Manejando tools/list');
    return res.json({
      jsonrpc: '2.0',
      id: body.id,
      result: {
        tools: [
          {
            name: 'send_lead_to_mcp',
            description: 'Send lead information to n8n webhook for processing',
            inputSchema: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                phone_number: { type: 'string' },
                address: { type: 'string' },
                vehicles: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      make: { type: 'string' },
                      model: { type: 'string' },
                      year: { type: 'string' }
                    },
                    required: ['make', 'model', 'year']
                  }
                },
                call_status: { type: 'string', enum: ['success'] },
                source: { type: 'string', enum: ['retell_outbound_call'] }
              },
              required: ['name', 'vehicles', 'call_status', 'source']
            }
          }
        ]
      }
    });
  }

  // Manejo del método 'tools/call'
  if (body.method === 'tools/call') {
    console.log('-> Manejando tools/call');
    const { name, arguments: args } = body.params;
    console.log('   Tool name:', name);
    console.log('   Arguments:', JSON.stringify(args, null, 2));

    if (name === 'send_lead_to_mcp') {
      try {
        console.log('   -> Enviando a n8n...');
        const n8nResponse = await axios.post('https://baalbarracinb.app.n8n.cloud/webhook/4155f0e0-7188-4697-b460-68644a8397c7', args, {
          headers: { 'Content-Type': 'application/json' }
        });
        console.log('   -> Respuesta de n8n:', n8nResponse.status, n8nResponse.data);

        return res.json({
          jsonrpc: '2.0',
          id: body.id,
          result: {
            content: [
              {
                type: 'text',
                text: 'Lead enviado correctamente a n8n'
              }
            ]
          }
        });
      } catch (error) {
        console.error('   -> Error al enviar a n8n:', error.message);
        return res.json({
          jsonrpc: '2.0',
          id: body.id,
          error: {
            code: -32000,
            message: 'Error al enviar a n8n: ' + error.message
          }
        });
      }
    } else {
      console.log('   -> Tool no encontrada:', name);
      return res.json({
        jsonrpc: '2.0',
        id: body.id,
        error: {
          code: -32601,
          message: 'Método no encontrado'
        }
      });
    }
  }

  // Cualquier otro método no implementado
  console.log('-> Método no implementado:', body.method);
  res.json({
    jsonrpc: '2.0',
    id: body.id,
    error: {
      code: -32601,
      message: 'Method not found'
    }
  });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`MCP proxy listening on port ${port}`));