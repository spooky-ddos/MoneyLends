const { GoogleGenerativeAI } = require("@google/generative-ai");
const admin = require('firebase-admin'); // [NOWE] Import Firebase Admin

// --- Walidacja kluczy środowiskowych ---
if (!process.env.GEMINI_API_KEY) {
  console.error("BŁĄD KRYTYCZNY: Brak klucza GEMINI_API_KEY.");
  throw new Error("Klucz GEMINI_API_KEY nie jest ustawiony.");
}

// [NOWE] Inicjalizacja Firebase Admin
let db;
try {
  // Sprawdzamy, czy aplikacja admina nie została już zainicjowana
  if (admin.apps.length === 0) {
    if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
      throw new Error("Brak klucza FIREBASE_SERVICE_ACCOUNT w zmiennych środowiskowych.");
    }
    // Parsujemy klucz z JSON-a przechowywanego w zmiennej środowiskowej
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log("Firebase Admin SDK zainicjowany pomyślnie."); // Log sukcesu inicjalizacji
  } else {
    // Jeśli aplikacja admina już istnieje, po prostu ją pobieramy
    admin.app(); // To wywołanie pobiera domyślną aplikację
    console.log("Firebase Admin SDK już był zainicjowany.");
  }
  db = admin.firestore(); // Inicjalizujemy Firestore
} catch (e) {
  console.error("KRYTYCZNY BŁĄD: Nie udało się zainicjować Firebase Admin.", e.message);
  // Jeśli Firebase nie działa, logowanie błędów nie będzie możliwe
  // Ale pozwalamy funkcji działać dalej (bez logowania do DB), db będzie undefined
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Funkcja pomocnicza do odczytu body z requestu - nie jest potrzebna, bo Vercel parsuje body
// async function streamToString(stream) {
//   const chunks = [];
//   for await (const chunk of stream) {
//     chunks.push(Buffer.from(chunk));
//   }
//   return Buffer.concat(chunks).toString("utf-8");
// }


module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Only POST requests allowed' });
  }

  try {
    const { imageBase64 } = req.body; // Vercel automatycznie parsuje JSON

    if (!imageBase64) {
      return res.status(400).json({ message: "No image data provided." });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
    const prompt = `
    Przeanalizuj obraz paragonu sklepowego. Twoim zadaniem jest precyzyjne zidentyfikowanie wszystkich pozycji zakupowych, ich cen oraz uwzględnienie ilości i rabatów.

    **ZASADY OGÓLNE ODPOWIEDZI:**
    - **Twoja odpowiedź MUSI być WYŁĄCZNIE stringiem JSON.**
    - **NIE dodawaj żadnego tekstu przed ani po JSONie.**
    - **NIE używaj znaczników markdown (np. \`\`\`json).**

    1.  Jeśli obraz NIE JEST paragonem, zwróć **WYŁĄCZNIE** poniższy JSON:
        {"error": "Przesłany obraz nie jest paragonem."}

    2.  Jeśli obraz JEST paragonem, przetwórz go zgodnie z poniższymi zasadami i zwróć **WYŁĄCZNIE** tablicę obiektów JSON. Każdy obiekt musi zawierać klucze "item" (string) i "price" (number).

    ZASADY PRZETWARZANIA PARAGONU:
    -   **Cena Końcowa:** Zawsze zwracaj ostateczną cenę za daną pozycję. Jeśli produkt występuje w wielu sztukach (np. "2 szt. x 3.50 PLN"), oblicz i zwróć sumaryczną wartość (w tym przypadku 7.00), a nie cenę jednostkową.
    -   **Nazwa Produktu:** Klucz "item" musi zawierać pełną nazwę produktu, włącznie z informacją o ilości, jeśli jest dostępna (np. "Jajka 2 szt. x 1.50").
    -   **Rabaty:**
        -   Jeśli na paragonie znajduje się rabat przypisany do konkretnej pozycji (np. "Rabat - Masło"), pomniejsz jej cenę o wartość rabatu.
        -   Jeśli rabat pojawia się w osobnej linii bez nazwy produktu (np. tylko "Rabat" lub "Zniżka"), załóż, że dotyczy on pozycji znajdującej się bezpośrednio nad nim. Zmniejsz cenę tej poprzedniej pozycji o wartość rabatu.
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

    **PAMIĘTAJ: Zwróć tylko i wyłącznie string JSON, bez żadnych dodatkowych opisów czy formatowania markdown.**
    `;

    // Usuwamy prefix 'data:image/jpeg;base64,' jeśli istnieje
    const pureBase64 = imageBase64.startsWith('data:') ? imageBase64.split(",")[1] : imageBase64;
    const imagePart = {
      inlineData: { data: pureBase64, mimeType: "image/jpeg" }, // Zakładamy JPEG, można by dodać detekcję MIME type
    };

    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;

    if (response.promptFeedback && response.promptFeedback.blockReason) {
      const blockReason = response.promptFeedback.blockReason;
      console.warn("Odpowiedź Gemini zablokowana:", blockReason);
      // Logujemy błąd do Firebase, jeśli db jest dostępne
      if (db) {
        try {
          await db.collection('gemini_error_logs').add({
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            errorType: 'GeminiBlock',
            blockReason: blockReason,
            context: 'analyzeReceipt',
            requestDetails: { // Opcjonalnie: dodaj więcej kontekstu
               imageSize: pureBase64.length // np. rozmiar obrazu
            }
          });
        } catch (logError) {
          console.error("Błąd zapisu logu (GeminiBlock) do Firebase.", logError);
        }
      }
      // Zwracamy błąd do klienta
      return res.status(400).json({
        message: `Analiza zablokowana przez AI. Powód: ${blockReason}`
      });
    }

    const text = response.text();
    // Usuwamy znaczniki ```json i ``` oraz białe znaki z początku/końca
    const cleanedText = text.replace(/```(json)?/g, "").trim();

    let parsedData;
    try {
      // Próbujemy sparsować odpowiedź jako JSON
      parsedData = JSON.parse(cleanedText);
    } catch (parseError) {
      // Błąd parsowania - AI nie zwróciło poprawnego JSONa
      console.error("Błąd parsowania JSON od Gemini.", parseError.message);
      console.error("Otrzymana surowa odpowiedź (fragment):", cleanedText.substring(0, 500)); // Logujemy dłuższy fragment

      // Logujemy błąd do Firebase, jeśli db jest dostępne
      if (db) {
        try {
          const logsRef = db.collection('gemini_error_logs');
          await logsRef.add({
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            errorType: 'GeminiParseError',
            rawResponse: cleanedText, // Zapisujemy całą surową odpowiedź!
            errorMessage: parseError.message,
            context: 'analyzeReceipt',
            requestDetails: { // Opcjonalnie: dodaj więcej kontekstu
               imageSize: pureBase64.length
            }
          });
        } catch (logError) {
          console.error("KRYTYCZNY BŁĄD: Nie udało się zapisać logu błędu do Firebase.", logError);
        }
      }

      // Zwracamy czytelny błąd do użytkownika (do aplikacji)
      return res.status(422).json({ // 422 Unprocessable Entity
        message: "Model AI zwrócił odpowiedź w nieoczekiwanym formacie. Może to być spowodowane nieczytelnym zdjęciem. Spróbuj ponownie.",
        details: `Odpowiedź AI (fragment): ${cleanedText.substring(0, 150)}...` // Dajemy fragment dla kontekstu
      });
    }

    // Sprawdzamy, czy AI zwróciło zdefiniowany przez nas błąd {"error": "..."}
    if (parsedData && typeof parsedData === 'object' && parsedData.error) {
      console.log("AI zwróciło zdefiniowany błąd:", parsedData.error);
       // Można opcjonalnie logować to do Firebase jako informację, a nie błąd krytyczny
       if (db) {
         try {
           await db.collection('gemini_error_logs').add({
             timestamp: admin.firestore.FieldValue.serverTimestamp(),
             errorType: 'AIValidationError', // Inny typ błędu
             errorMessage: parsedData.error,
             context: 'analyzeReceipt',
             requestDetails: { imageSize: pureBase64.length }
           });
         } catch (logError) {
           console.error("Błąd zapisu logu (AIValidationError) do Firebase.", logError);
         }
       }
      return res.status(400).json({ message: parsedData.error });
    }

    // Jeśli wszystko OK, zwracamy sparsowane dane
    return res.status(200).json(parsedData);

  } catch (error) {
    // Ogólny błąd serwera (np. błąd połączenia z API Gemini, błąd w kodzie funkcji)
    console.error("Krytyczny błąd w /api/analyzeReceipt:", error);

    // Logujemy błąd 500 do Firebase, jeśli db jest dostępne
    if (db) {
      try {
        await db.collection('gemini_error_logs').add({
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          errorType: 'ApiInternalError',
          errorMessage: error.message,
          errorStack: error.stack, // Zapisujemy stack trace
          context: 'analyzeReceipt'
        });
      } catch (logError) {
        console.error("Błąd zapisu logu (ApiInternalError) do Firebase.", logError);
      }
    }

    // Zwracamy generyczny błąd 500 do klienta
    return res.status(500).json({
        message: "Wystąpił wewnętrzny błąd serwera podczas analizy paragonu.",
        // W produkcji lepiej nie wysyłać error.message do klienta
        // details: error.message
        details: "Skontaktuj się z administratorem lub sprawdź logi serwera."
    });
  }
};