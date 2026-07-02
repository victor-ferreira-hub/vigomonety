import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';

const app = express();
const port = Number(process.env.PORT || 3000);
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5500';

app.use(cors({ origin: frontendUrl }));
app.use(express.json({ limit: '1mb' }));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const plans = {
  standard: { title: 'VIGO Money Standard', unit_price: 29.90, quantity: 1 },
  plus: { title: 'VIGO Money Plus', unit_price: 59.90, quantity: 1 }
};

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, app: 'VIGO Money backend' });
});

app.post('/api/assistente-financeiro', async (req, res) => {
  try {
    const { question, summary, userId } = req.body || {};
    if (!question || !summary) {
      return res.status(400).json({ error: 'Pergunta e resumo financeiro são obrigatórios.' });
    }

    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
      input: [
        {
          role: 'system',
          content: `Você é o assistente financeiro do VIGO Money. Responda em português do Brasil, de forma simples, direta e educativa. Não prometa lucro, não indique produto financeiro específico, não substitua consultoria profissional e não peça dados sensíveis como senha, CPF completo ou cartão. Foque em orçamento, economia, organização, hábitos e metas.`
        },
        {
          role: 'user',
          content: `ID interno do usuário: ${userId || 'não informado'}\nResumo financeiro do mês: ${JSON.stringify(summary)}\nPergunta do usuário: ${question}`
        }
      ]
    });

    res.json({ answer: response.output_text });
  } catch (error) {
    console.error('Erro OpenAI:', error);
    res.status(500).json({ error: 'Erro ao gerar resposta do assistente.' });
  }
});

app.post('/api/create-checkout', async (req, res) => {
  try {
    const { plan, userId, email } = req.body || {};
    const selectedPlan = plans[plan];
    if (!selectedPlan) {
      return res.status(400).json({ error: 'Plano inválido.' });
    }
    if (!process.env.MERCADO_PAGO_ACCESS_TOKEN) {
      return res.status(500).json({ error: 'MERCADO_PAGO_ACCESS_TOKEN não configurado.' });
    }

    const preferencePayload = {
      items: [selectedPlan],
      payer: email ? { email } : undefined,
      metadata: { userId, plan },
      back_urls: {
        success: `${frontendUrl}/assinaturas.html?status=success&plan=${plan}`,
        failure: `${frontendUrl}/assinaturas.html?status=failure&plan=${plan}`,
        pending: `${frontendUrl}/assinaturas.html?status=pending&plan=${plan}`
      },
      notification_url: process.env.MERCADO_PAGO_NOTIFICATION_URL,
      statement_descriptor: 'VIGO MONEY'
    };

    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MERCADO_PAGO_ACCESS_TOKEN}`
      },
      body: JSON.stringify(preferencePayload)
    });

    const data = await mpResponse.json();
    if (!mpResponse.ok) {
      console.error('Erro Mercado Pago:', data);
      return res.status(500).json({ error: 'Erro ao criar checkout no Mercado Pago.', detail: data });
    }

    res.json({ checkoutUrl: data.init_point || data.sandbox_init_point, preferenceId: data.id });
  } catch (error) {
    console.error('Erro checkout:', error);
    res.status(500).json({ error: 'Erro ao criar checkout.' });
  }
});

app.post('/api/mercadopago-webhook', async (req, res) => {
  // Em produção, use esse webhook para consultar o pagamento no Mercado Pago,
  // confirmar se foi aprovado e então atualizar o plano do usuário no Firestore.
  console.log('Webhook Mercado Pago:', req.body);
  res.sendStatus(200);
});

app.listen(port, () => {
  console.log(`VIGO Money backend rodando em http://localhost:${port}`);
});
