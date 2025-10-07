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

    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

const prompt = `
    Przeanalizuj obraz paragonu sklepowego. Twoim zadaniem jest precyzyjne zidentyfikowanie wszystkich pozycji zakupowych, ich cen oraz uwzględnienie ilości i rabatów.

    1.  Jeśli obraz NIE JEST paragonem, zwróć odpowiedź WYŁĄCZNIE w formacie JSON:
        {"error": "Przesłany obraz nie jest paragonem."}

    2.  Jeśli obraz JEST paragonem, przetwórz go zgodnie z poniższymi zasadami i zwróć tablicę obiektów w formacie JSON. Każdy obiekt musi zawierać klucze "item" (string) i "price" (number).

    ZASADY PRZETWARZANIA PARAGONU:
    -   **Cena Końcowa:** Zawsze zwracaj ostateczną cenę za daną pozycję. Jeśli produkt występuje w wielu sztukach (np. "2 szt. x 3.50 PLN"), oblicz i zwróć sumaryczną wartość (w tym przypadku 7.00), a nie cenę jednostkową.
    -   **Nazwa Produktu:** Klucz "item" musi zawierać pełną nazwę produktu, włącznie z informacją o ilości, jeśli jest dostępna (np. "Jajka 2 szt. x 1.50").
    -   **Rabaty:**
        -   Jeśli na paragonie znajduje się rabat przypisany do konkretnej pozycji (np. "Rabat - Masło"), pomniejsz jej cenę o wartość rabatu.
        -   **Jeśli rabat pojawia się w osobnej linii bez nazwy produktu (np. tylko "Rabat" lub "Zniżka"), załóż, że dotyczy on pozycji znajdującej się bezpośrednio nad nim. Zmniejsz cenę tej poprzedniej pozycji o wartość rabatu.**
        -   Jeśli rabat jest ogólny (np. na całe zakupy) i nie da się go jednoznacznie przypisać, dodaj go jako osobną pozycję z ujemną wartością, np. {"item": "Rabat ogólny", "price": -5.00}.
    -   **Ignorowane Pozycje:** Całkowicie ignoruj sumy częściowe, sumy całkowite, podatki (VAT), dane sprzedawcy, NIP i inne informacje niebędące produktami lub rabatami.

    PRZYKŁADY POPRAWNYCH ODPOWIEDZI JSON:

    Przykład 1: Proste pozycje
    [
        {"item": "Mleko 2%", "price": 3.49},
        {"item": "Chleb wiejski", "price": 4.99}
    ]

    Przykład 2: Wielosztuki i rabat ogólny
    [
        {"item": "Baton czekoladowy 2 szt. x 2.50", "price": 5.00},
        {"item": "Woda gazowana 1.5l", "price": 1.99},
        {"item": "Rabat za zakupy", "price": -2.00}
    ]

    Przykład 3: Rabat do poprzedniej pozycji
    // Paragon: "Masło extra 8.00; Rabat -1.50"
    [
        {"item": "Masło extra", "price": 6.50}
    ]
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
