import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.MISTRAL_API_KEY;

console.log('==============================================');
console.log('🔍 TESTOVANIE MISTRAL AI API (ForenzDetectiv)');
console.log('==============================================');
console.log(`🔑 API Kľúč: ${apiKey ? apiKey.slice(0, 6) + '...' + apiKey.slice(-4) : 'CHÝBA!'}`);

if (!apiKey) {
  console.error('❌ MISTRAL_API_KEY nie je nastavený v .env!');
  process.exit(1);
}

async function testModelsList() {
  console.log('\n--- 1. Overenie dostupnosti modelov (GET /v1/models) ---');
  const start = Date.now();
  try {
    const res = await fetch('https://api.mistral.ai/v1/models', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const elapsed = Date.now() - start;
    if (!res.ok) {
      const err = await res.text();
      console.error(`❌ Chyba pri získavaní modelov (HTTP ${res.status}): ${err}`);
      return false;
    }

    const data = await res.json();
    console.log(`✅ Úspech (${elapsed} ms)! Dostupné modely (${data.data?.length || 0}):`);
    const keyModels = ['mistral-large-latest', 'pixtral-large-latest', 'mistral-embed', 'open-mistral-nemo', 'pixtral-12b-2409'];
    const available = data.data?.map((m) => m.id) || [];
    
    keyModels.forEach((m) => {
      const found = available.includes(m);
      console.log(`   ${found ? '🟢' : '⚪'} ${m}`);
    });
    return true;
  } catch (err) {
    console.error('❌ Výnimka pri volaní /v1/models:', err.message);
    return false;
  }
}

async function testMistralLargeChat() {
  console.log('\n--- 2. Test textovej analýzy & detekcie rozporov (mistral-large-latest) ---');
  const start = Date.now();
  try {
    const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'mistral-large-latest',
        messages: [
          {
            role: 'system',
            content: 'Si Sherlock Holmes, forenzný vyšetrovací AI asistent. Analyzuj rozpory.',
          },
          {
            role: 'user',
            content:
              'Svedok A tvrdí: "Bol som v kine v Bratislave o 20:00 dňa 15.1.2025." ' +
              'Záznam z mýtnej brány ukazuje: "Auto svedka A prešlo bránou v Košiciach o 20:15 dňa 15.1.2025." ' +
              'Identifikuj v 2 vetách rozpor v alibi a urči závažnosť (Kritická/Vysoká).',
          },
        ],
        temperature: 0.1,
      }),
    });

    const elapsed = Date.now() - start;
    if (!res.ok) {
      const err = await res.text();
      console.error(`❌ Chyba chatu (HTTP ${res.status}): ${err}`);
      return false;
    }

    const data = await res.json();
    console.log(`✅ Úspech (${elapsed} ms)!`);
    console.log('🤖 Odpoveď Sherlocka:');
    console.log(`   "${data.choices?.[0]?.message?.content?.trim()}"`);
    console.log(`📊 Spotreba tokenov: prompt=${data.usage?.prompt_tokens}, completion=${data.usage?.completion_tokens}, celkovo=${data.usage?.total_tokens}`);
    return true;
  } catch (err) {
    console.error('❌ Výnimka pri volaní mistral-large-latest:', err.message);
    return false;
  }
}

async function testEmbedding() {
  console.log('\n--- 3. Test RAG vektorového embeddingu (mistral-embed) ---');
  const start = Date.now();
  try {
    const res = await fetch('https://api.mistral.ai/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'mistral-embed',
        input: ['Forenzný dôkaz: Zápisnica o výsluchu svedka č. 45/2025'],
      }),
    });

    const elapsed = Date.now() - start;
    if (!res.ok) {
      const err = await res.text();
      console.error(`❌ Chyba embeddingu (HTTP ${res.status}): ${err}`);
      return false;
    }

    const data = await res.json();
    const vecLength = data.data?.[0]?.embedding?.length || 0;
    console.log(`✅ Úspech (${elapsed} ms)! Dĺžka vektora: ${vecLength} dimenzií (očakávaných: 1024)`);
    return true;
  } catch (err) {
    console.error('❌ Výnimka pri volaní mistral-embed:', err.message);
    return false;
  }
}

async function run() {
  const modelsOk = await testModelsList();
  const chatOk = await testMistralLargeChat();
  const embedOk = await testEmbedding();

  console.log('\n==============================================');
  if (modelsOk && chatOk && embedOk) {
    console.log('🎉 VŠETKY MISTRAL AI TESTY BOLI 100% ÚSPEŠNÉ!');
  } else {
    console.log('⚠️ Niektoré testy zlyhali. Skontrolujte chybové hlášky vyššie.');
  }
  console.log('==============================================\n');
}

run();
