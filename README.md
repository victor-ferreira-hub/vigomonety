# VIGO Money v4

Versão com landing page mais forte e divertida, inspirada na ideia de um assistente financeiro conversacional, mas com identidade própria.

## O que veio nessa versão

- Landing page nova com visual de fintech divertida.
- Demonstração visual do produto com chat, saldo e últimas transações.
- Seções de recursos, como funciona, segurança, planos, FAQ e CTA.
- Planos atualizados:
  - Básico: grátis
  - Standard: R$ 29,90/mês
  - Plus: R$ 59,90/mês
- Página de assinatura atualizada com os mesmos planos.
- Login com Google adicionado no front.
- Backend de exemplo atualizado para planos `standard` e `plus`.
- Estrutura para Mercado Pago e OpenAI sem expor chaves no navegador.

## Como testar no PC

Extraia o ZIP, abra a pasta no VS Code e rode:

```bash
python -m http.server 5500
```

Depois acesse:

```text
http://localhost:5500
```

Não abra o `index.html` direto clicando no arquivo. O Firebase precisa de servidor local.

## Firebase

No Firebase, confirme:

1. Authentication > Método de login
   - E-mail/senha ativado
   - Google ativado
2. Authentication > Configurações > Domínios autorizados
   - `localhost`
   - seu domínio real quando subir em produção
3. Firestore Database criado
4. Regras do arquivo `firestore.rules` aplicadas

## Pagamentos

Os botões da página `assinaturas.html` chamam:

```text
POST /api/create-checkout
```

Para funcionar de verdade, suba a pasta `server-example` em um backend Node.js e configure o `.env` com:

```env
PORT=3000
FRONTEND_URL=http://localhost:5500
MERCADO_PAGO_ACCESS_TOKEN=SEU_ACCESS_TOKEN
MERCADO_PAGO_NOTIFICATION_URL=https://seu-dominio.com/api/mercadopago-webhook
OPENAI_API_KEY=SUA_OPENAI_API_KEY
OPENAI_MODEL=gpt-4.1-mini
```

Instale e rode:

```bash
cd server-example
npm install
npm run dev
```

No front, se o backend estiver em outro endereço, defina no HTML antes do script ou em um arquivo de configuração:

```html
<script>
  window.VIGO_API_BASE_URL = 'https://seu-backend.com';
</script>
```

## OpenAI / Assistente IA

A chave da OpenAI nunca deve ficar em `js/assistente.js`, `index.html` ou qualquer arquivo público.

Fluxo correto:

1. Usuário pergunta no site.
2. Front envia pergunta + resumo financeiro para seu backend.
3. Backend usa `OPENAI_API_KEY` para chamar a OpenAI.
4. Backend devolve a resposta para o site.

## Observação importante

A landing page fala de IA e recursos avançados como proposta do produto. No MVP, não prometa conexão automática com bancos ainda. Integração bancária/Open Finance exige análise técnica, jurídica e parceiros autorizados.

## Correção v4.1 - Criar conta

Se o botão **Criar conta** não trocar a tela, rode o projeto por servidor local:

```bash
python -m http.server 5500
```

Acesse `http://localhost:5500/login.html`, não abra o arquivo direto pelo Windows.

No Firebase, confira:

1. Authentication > Método de login > **E-mail/senha ativado**.
2. Authentication > Método de login > **Google ativado**.
3. Authentication > Configurações > Domínios autorizados > precisa ter `localhost`.
4. Firestore Database > Regras > cole o conteúdo de `firestore.rules` e publique.

Agora, mesmo que o Firestore ainda não esteja com as regras publicadas, a conta é criada no Authentication e o site redireciona para o painel.
