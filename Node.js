import express from 'express';
import axios from 'axios';

const app = express();
app.use(express.json());

// Endpoint que Retell usará como URL del MCP
app.post('/mcp', async (req, res) => {
  const body = req.body;

  // Verifica que sea una petición JSON-RPC válida
  if (!body.jsonrpc || body.jsonrpc !== '2.0' || !body.method) {
    return res.status(400).json({
      jsonrpc: '2.0',
      error: { code: -32600, message: 'Invalid Request' },
      id: body.id || null
    });
  }

  // Manejo del método 'initialize' (obligatorio para MCP)
  if (body.method === 'initialize') {
    // Responde con las capacidades del servidor-
    return res.json({
      jsonrpc: '2.0',
      id: body.id,
      result: {
        protocolVersion: '0.1.0',
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


  // Manejo del método 'tools/list' (Retell lo llama para conocer las herramientas disponibles)
  if (body.method === 'tools/list') {
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
              required: ['name', 'phone_number', 'address', 'vehicles', 'call_status', 'source']
            }
          }
        ]
      }
    });
  }

  // Manejo del método 'tools/call' (cuando Retell ejecuta la herramienta)
  if (body.method === 'tools/call') {
    const { name, arguments: args } = body.params;
    if (name === 'send_lead_to_mcp') {
      try {
        // Llama al webhook de n8n con los datos
        const n8nResponse = await axios.post('https://tu-n8n-webhook-url', args, {
          headers: { 'Content-Type': 'application/json' }
        });

        // Retorna éxito (el contenido de la respuesta de n8n se puede incluir si es necesario)
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
  res.json({
    jsonrpc: '2.0',
    id: body.id,
    error: {
      code: -32601,
      message: 'Method not found'
    }
  });
});

app.listen(3000, () => console.log('MCP proxy listening on port 3000'));