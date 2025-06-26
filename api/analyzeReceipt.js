const { GoogleGenerativeAI } = require("@google/generative-ai");

// Sprawdzenie, czy klucz API jest dostępny przy starcie funkcji
if (!process.env.GEMINI_API_KEY) {
  console.error("BŁĄD KRYTYCZNY: Brak klucza GEMINI_API_KEY w zmiennych środowiskowych.");
  throw new Error("Klucz GEMINI_API_KEY nie jest ustawiony w zmiennych środowiskowych.");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Funkcja pomocnicza do odczytu body z requestu
async function streamToString(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf-8");
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Only POST requests allowed' });
  }

  try {
    // Vercel automatycznie parsuje JSON dla funkcji serwerowych
    const { imageBase64 } = req.body;
    
    if (!imageBase64) {
      return res.status(400).json({ message: "No image data provided." });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

    const prompt = `
      Przeanalizuj obraz. Twoim zadaniem jest ocenić, czy jest to paragon sklepowy.

      1. Jeśli obraz NIE JEST paragonem, zwróć odpowiedź WYŁĄCZNIE w formacie JSON:
         {"error": "Przesłany obraz nie wygląda na paragon."}

      2. Jeśli obraz JEST paragonem, zidentyfikuj wszystkie pozycje zakupowe i ich ceny.
         Zwróć odpowiedź WYŁĄCZNIE w formacie JSON, jako tablica obiektów.
         Każdy obiekt w tablicy musi reprezentować jeden produkt i mieć dwa klucze:
         - "item" (string): pełna nazwa produktu.
         - "price" (number): cena produktu jako liczba.
      
      Całkowicie zignoruj sumy, rabaty, podatki, dane sklepu, NIP i inne niepotrzebne informacje. Skup się tylko na liście produktów.
      Przykład poprawnej odpowiedzi dla paragonu: [{"item": "Mleko 2%", "price": 3.49}, {"item": "Chleb", "price": 4.99}]
    `;

    const pureBase64 = imageBase64.split(",")[1];
    const imagePart = {
      inlineData: { data: pureBase64, mimeType: "image/jpeg" },
    };

    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const text = response.text();

    const cleanedText = text.replace(/```(json)?/g, "").trim();
    const parsedData = JSON.parse(cleanedText);

    // Sprawdzamy, czy AI zwróciło zdefiniowany przez nas błąd
    if (parsedData.error) {
      return res.status(400).json({ message: parsedData.error });
    }

    return res.status(200).json(parsedData);

  } catch (error) {
    console.error("Błąd w /api/analyzeReceipt:", error);
    return res.status(500).json({ 
        message: "Błąd serwera podczas analizy paragonu.", 
        details: error.message 
    });
  }
};