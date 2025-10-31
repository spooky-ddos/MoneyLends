import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
  FormControlLabel, Checkbox, List, ListItem, ListItemButton, ListItemIcon, ListItemText,
  Typography, Box, IconButton, CircularProgress, Select, MenuItem, Chip, Divider, Alert,
  ListSubheader, // Upewnij się, że ListSubheader jest importowany
  Paper // Dodajemy Paper do importów
} from '@mui/material';
import { db, auth } from '../firebase';
import { collection, getDocs, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import {
    CameraAlt as CameraAltIcon,
    ArrowBack as ArrowBackIcon,
    Add as AddIcon,         // Ikona dodawania
    Edit as EditIcon,       // Ikona edycji
    Delete as DeleteIcon,   // Ikona usuwania
    Save as SaveIcon,       // Ikona zapisu
    Cancel as CancelIcon    // Ikona anulowania
} from '@mui/icons-material';

// --- Komponent Widoku Analizy Paragonu ---
const ReceiptAnalysisView = ({ items: initialItems, people, currentUser, onCalculate, onBack }) => {
  // Stan przechowujący edytowalną listę pozycji paragonu
  const [editableItems, setEditableItems] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [subgroups, setSubgroups] = useState([]);
  const [newSubgroup, setNewSubgroup] = useState([]);

  // Stan do zarządzania edycją/dodawaniem pozycji
  const [editIndex, setEditIndex] = useState(null); // Index edytowanej pozycji lub -1 dla nowej
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');

  // Kopiujemy początkowe pozycje do stanu edytowalnego przy pierwszym renderowaniu
  useEffect(() => {
    setEditableItems(initialItems.map(item => ({...item}))); // Tworzymy głęboką kopię
  }, [initialItems]);


  const allParticipants = useMemo(() => [currentUser, ...people], [currentUser, people]);

  // Obliczamy sumę na podstawie edytowalnej listy
  const receiptTotal = useMemo(() => {
    return editableItems.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
  }, [editableItems]);

  // Inicjalizacja przypisań przy zmianie edytowalnych pozycji
  useEffect(() => {
    const initialAssignments = {};
    editableItems.forEach((_, index) => {
      // Zachowaj istniejące przypisanie jeśli istnieje, inaczej 'unassigned'
      initialAssignments[index] = assignments[index] || 'unassigned';
    });
    setAssignments(initialAssignments);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editableItems]); // Zależność od edytowalnej listy

  const handleCreateSubgroup = () => {
    if (newSubgroup.length > 1) {
      const subgroupName = newSubgroup.map(pId => allParticipants.find(p => p.id === pId)?.name || '...').join(' i ');
      const newSubgroupObject = { id: `subgroup_${Date.now()}`, name: subgroupName, members: newSubgroup };
      setSubgroups([...subgroups, newSubgroupObject]);
      setNewSubgroup([]);
    }
  };

  const handleAssignmentChange = (itemIndex, assigneeId) => {
    setAssignments(prev => ({ ...prev, [itemIndex]: assigneeId }));
  };

  // --- Funkcje do edycji/dodawania/usuwania pozycji ---

  // Rozpoczęcie edycji istniejącej pozycji lub dodawania nowej (-1)
  const handleEditStart = (index) => {
    setEditIndex(index);
    if (index === -1) { // Dodawanie nowej
      setEditName('');
      setEditPrice('');
    } else { // Edycja istniejącej
      setEditName(editableItems[index].item);
      setEditPrice(editableItems[index].price.toString());
    }
  };

  // Anulowanie edycji/dodawania
  const handleEditCancel = () => {
    setEditIndex(null);
    setEditName('');
    setEditPrice('');
  };

  // Zapisanie zmian (edycji lub nowej pozycji)
  const handleEditSave = () => {
    const price = parseFloat(editPrice);
    if (!editName.trim() || isNaN(price)) {
      alert('Nazwa produktu nie może być pusta, a cena musi być liczbą.');
      return;
    }

    if (editIndex === -1) { // Dodawanie nowej pozycji
      setEditableItems(prevItems => [...prevItems, { item: editName.trim(), price: price }]);
    } else { // Aktualizacja istniejącej pozycji
      setEditableItems(prevItems =>
        prevItems.map((item, index) =>
          index === editIndex ? { ...item, item: editName.trim(), price: price } : item
        )
      );
    }
    handleEditCancel(); // Zresetuj formularz edycji
  };

  // Usuwanie pozycji
  const handleDeleteItem = (indexToDelete) => {
    if (window.confirm(`Czy na pewno chcesz usunąć pozycję "${editableItems[indexToDelete].item}"?`)) {
      setEditableItems(prevItems => prevItems.filter((_, index) => index !== indexToDelete));
      // Resetuj edycję, jeśli usuwamy edytowany element
      if (editIndex === indexToDelete) {
        handleEditCancel();
      } else if (editIndex !== null && editIndex > indexToDelete) {
        // Jeśli usuwamy element przed edytowanym, zaktualizuj index edycji
        setEditIndex(prev => (prev !== null ? prev - 1 : null));
      }
      // Usuwamy przypisanie dla usuniętego elementu (przesuwamy pozostałe)
       setAssignments(prevAssignments => {
           const newAssignments = {};
           let currentNewIndex = 0;
           for (let i = 0; i < editableItems.length; i++) {
               if (i !== indexToDelete) {
                   newAssignments[currentNewIndex] = prevAssignments[i];
                   currentNewIndex++;
               }
           }
           // Dodaj obsługę ostatniego elementu
            if (indexToDelete === editableItems.length -1 && currentNewIndex < editableItems.length -1) {
                 // Jeśli usunięto ostatni, a są jeszcze jakieś przypisania
                 // Ta logika może wymagać dostosowania w zależności od tego, jak dokładnie chcesz zarządzać przypisaniami po usunięciu
             }
           return newAssignments;
       });
    }
  };

  // --- Koniec funkcji edycji ---

  const calculateDebts = () => {
    const finalDebts = {};
    allParticipants.forEach(p => finalDebts[p.id] = 0);

    // Używamy edytowalnej listy do obliczeń
    editableItems.forEach((item, index) => {
      const assigneeId = assignments[index];
      const itemPrice = Number(item.price);

      if (assigneeId === 'unassigned' || !itemPrice || isNaN(itemPrice)) return;

      const singlePerson = allParticipants.find(p => p.id === assigneeId);
      const subgroup = subgroups.find(sg => sg.id === assigneeId);

      if (singlePerson) {
        finalDebts[singlePerson.id] += itemPrice;
      } else if (subgroup && subgroup.members.length > 0) {
        const pricePerMember = itemPrice / subgroup.members.length;
        subgroup.members.forEach(memberId => {
          finalDebts[memberId] = (finalDebts[memberId] || 0) + pricePerMember;
        });
      }
    });

    Object.keys(finalDebts).forEach(id => {
        finalDebts[id] = parseFloat(finalDebts[id].toFixed(2));
    });

    // Przekazujemy TYLKO obliczone długi
    onCalculate(finalDebts); // Usunęliśmy editableItems z tego wywołania
  };


  return (
    <Box>
      {/* Nagłówek i suma */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <IconButton onClick={onBack} aria-label="Wróć"><ArrowBackIcon /></IconButton>
        <Typography variant="h6" sx={{ ml: 1 }}>Przypisz pozycje z paragonu</Typography>
      </Box>

      <Typography variant="h6" color="text.secondary" gutterBottom>
        Wykryta/Obliczona suma: <strong>{receiptTotal.toFixed(2)} PLN</strong>
      </Typography>
      {/* Komunikat weryfikacyjny - Punkt 3 */}
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
         Zweryfikuj, czy suma ({receiptTotal.toFixed(2)} PLN) zgadza się z sumą na paragonie. Edytuj listę lub dodaj brakujące pozycje. Niezgodność może wynikać z nieczytelności zdjęcia.
      </Typography>


      {/* Tworzenie podgrup (bez zmian) */}
      <Box sx={{ mb: 3, p: 2, border: '1px solid #ddd', borderRadius: 1 }}>
        <Typography variant="subtitle1" gutterBottom>Stwórz podgrupę</Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          {allParticipants.map(p => (
            <Chip
              key={p.id}
              label={p.name}
              onClick={() => setNewSubgroup(prev => prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id])}
              color={newSubgroup.includes(p.id) ? 'primary' : 'default'}
              variant="outlined"
              clickable
            />
          ))}
        </Box>
        <Button onClick={handleCreateSubgroup} disabled={newSubgroup.length < 2} variant="contained" size="small">Stwórz podgrupę</Button>
      </Box>

      {/* Lista pozycji z edycją - Punkt 1, 2, 4 */}
      <Typography variant="subtitle1" gutterBottom>Pozycje z paragonu:</Typography>
      <List sx={{ maxHeight: 250, overflow: 'auto', border: '1px solid #ddd', borderRadius: 1, mb: 2 }}>
        {editableItems.map((item, index) => (
          <ListItem
            key={index} // Używamy indexu jako klucza, bo lista jest modyfikowalna
            divider
            sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                p: 1,
                gap: 1 // Zmniejszony odstęp
            }}
          >
            {/* Tekst pozycji */}
            <ListItemText
                primary={item.item || "Brak nazwy"}
                secondary={`${(Number(item.price) || 0).toFixed(2)} PLN`}
                sx={{ flexGrow: 1, overflow: 'hidden', textOverflow: 'ellipsis', mr: 1 }}
            />
            {/* Select przypisania */}
            <Select
                value={assignments[index] || 'unassigned'}
                onChange={(e) => handleAssignmentChange(index, e.target.value)}
                size="small"
                sx={{ minWidth: 130, flexShrink: 0 }} // Zmniejszona szerokość minimalna
                displayEmpty
            >
              <MenuItem value="unassigned"><em>Nieprzypisane</em></MenuItem>
              <ListSubheader>Osoby</ListSubheader>
              {allParticipants.map(p => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
              {subgroups.length > 0 && <ListSubheader>Podgrupy</ListSubheader>}
              {subgroups.map(sg => <MenuItem key={sg.id} value={sg.id}>{sg.name}</MenuItem>)}
            </Select>
            {/* Przyciski edycji/usuwania */}
            <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                <IconButton size="small" onClick={() => handleEditStart(index)} aria-label="Edytuj">
                    <EditIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" onClick={() => handleDeleteItem(index)} aria-label="Usuń">
                    <DeleteIcon fontSize="small" />
                </IconButton>
            </Box>
          </ListItem>
        ))}
         {/* Informacja jeśli lista jest pusta */}
         {editableItems.length === 0 && (
             <ListItem>
                 <ListItemText primary="Brak pozycji do wyświetlenia. Dodaj nową." align="center" />
             </ListItem>
         )}
      </List>

        {/* Formularz edycji/dodawania - Punkt 4 */}
        {(editIndex !== null) && (
             <Paper sx={{ p: 2, mb: 2, border: '1px solid', borderColor: 'primary.main' }}>
                <Typography variant="subtitle2" gutterBottom>
                    {editIndex === -1 ? 'Dodaj nową pozycję' : `Edytuj: ${editableItems[editIndex]?.item}`}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                     <TextField
                        label="Nazwa produktu"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        size="small"
                        sx={{ flexGrow: 1, minWidth: '150px' }} // Elastyczna szerokość
                    />
                    <TextField
                        label="Cena (PLN)"
                        type="number"
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        size="small"
                        inputProps={{ step: "0.01", lang: "pl-PL" }}
                        sx={{ width: '100px' }} // Stała szerokość dla ceny
                    />
                    <IconButton onClick={handleEditSave} color="primary" aria-label="Zapisz">
                        <SaveIcon />
                    </IconButton>
                    <IconButton onClick={handleEditCancel} aria-label="Anuluj">
                        <CancelIcon />
                    </IconButton>
                </Box>
            </Paper>
        )}

        {/* Przycisk dodawania nowej pozycji (widoczny tylko gdy nie edytujemy) */}
        {editIndex === null && (
            <Button
                startIcon={<AddIcon />}
                onClick={() => handleEditStart(-1)} // -1 oznacza dodawanie nowej
                variant="outlined"
                fullWidth
                sx={{ mb: 2 }}
            >
                Dodaj pozycję ręcznie
            </Button>
        )}


      {/* Przycisk przejścia dalej */}
      <Button
          onClick={calculateDebts}
          variant="contained"
          color="primary"
          fullWidth
          disabled={editableItems.length === 0} // Wyłącz, jeśli nie ma pozycji
          sx={{ mt: 2 }}
       >
         Przejdź do podsumowania
      </Button>
    </Box>
  );
};


// --- Komponent Widoku Podsumowania ---
// Bez zmian - przyjmuje `debts`, `people`, `currentUser`, `onConfirm`, `onBack`
const SummaryView = ({ debts, people, currentUser, onConfirm, onBack }) => {
    const [title, setTitle] = useState("Wspólne zakupy");
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const allParticipants = useMemo(() => [currentUser, ...people], [currentUser, people]);

    const formatDateForInput = (isoDate) => {
        if (!isoDate) return '';
        try {
            return new Date(isoDate).toISOString().split('T')[0];
        } catch (e) {
            return new Date().toISOString().split('T')[0];
        }
    };

    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <IconButton onClick={onBack} aria-label="Wróć"><ArrowBackIcon /></IconButton>
                <Typography variant="h6" sx={{ ml: 1 }}>Podsumowanie</Typography>
            </Box>
            <TextField
                label="Tytuł płatności"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                fullWidth
                margin="normal"
            />
            <TextField
                label="Data"
                type="date"
                value={formatDateForInput(date)}
                onChange={(e) => setDate(e.target.value)}
                fullWidth
                margin="normal"
                InputLabelProps={{ shrink: true }}
            />
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle1" gutterBottom>Obciążenia:</Typography>
            <List dense sx={{ maxHeight: 200, overflow: 'auto', mb: 2 }}>
                {Object.entries(debts).map(([personId, amount]) => {
                    if (amount === 0 || isNaN(amount)) return null;
                    const person = allParticipants.find(p => p.id === personId);
                    return (
                        <ListItem key={personId} divider>
                            <ListItemText
                                primary={person?.name || 'Nieznany'}
                                secondary={`${amount.toFixed(2)} PLN`}
                            />
                        </ListItem>
                    )
                })}
                {Object.values(debts).every(amount => amount === 0 || isNaN(amount)) && (
                    <ListItem>
                        <ListItemText primary="Brak obciążeń do zapisania." />
                    </ListItem>
                )}
            </List>
            <Button
                onClick={() => onConfirm(debts, title, date)}
                variant="contained"
                color="success"
                fullWidth
                sx={{ mt: 2 }}
                disabled={Object.values(debts).every(amount => amount === 0 || isNaN(amount))}
            >
                Zatwierdź i zapisz
            </Button>
        </Box>
    )
}


// --- Główny Komponent ---
function GroupPayment({ open, onClose, onSuccess }) {
  const [allPeople, setAllPeople] = useState([]);
  const [selectedPeople, setSelectedPeople] = useState([]);
  const [includeCreator, setIncludeCreator] = useState(true);
  const [payment, setPayment] = useState({ amount: '', description: '', date: new Date().toISOString().split('T')[0] });
  const [searchQuery, setSearchQuery] = useState('');

  const [view, setView] = useState('default'); // 'default', 'loading', 'analysis', 'summary'
  const [receiptItems, setReceiptItems] = useState([]); // Przechowuje ORYGINALNE dane z API
  // const [finalItems, setFinalItems] = useState([]); // Usunięty stan
  const [calculatedDebts, setCalculatedDebts] = useState({});
  const [currentUser, setCurrentUser] = useState(null);
  const [analysisError, setAnalysisError] = useState(null);
  const fileInputRef = useRef(null);
  const [lastFailedFile, setLastFailedFile] = useState(null);

   useEffect(() => {
     if (auth.currentUser) {
       const { uid, displayName } = auth.currentUser;
       const userObj = { id: uid, name: `${displayName || 'Ja'} (Ty)` };
       setCurrentUser(userObj);

       const fetchPeople = async () => {
         if (!uid) return;
         try {
           const peopleCollection = collection(db, 'users', uid, 'people');
           const peopleSnapshot = await getDocs(peopleCollection);
           const peopleList = peopleSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(p => !p.isSummary);
           setAllPeople(peopleList);
         } catch (error) {
           console.error("Błąd podczas pobierania listy osób:", error);
         }
       };
       fetchPeople();
     } else {
       setCurrentUser(null);
       setAllPeople([]);
     }
   }, []);

   useEffect(() => {
     if (open) {
       setView('default');
       setAnalysisError(null);
       setReceiptItems([]);
       // setFinalItems([]); // Usunięte
       setCalculatedDebts({});
       setSelectedPeople([]);
       setPayment({ amount: '', description: '', date: new Date().toISOString().split('T')[0] });
       setIncludeCreator(true);
       setSearchQuery('');
       setLastFailedFile(null);

       if (auth.currentUser && !currentUser) {
          const { uid, displayName } = auth.currentUser;
          setCurrentUser({ id: uid, name: `${displayName || 'Ja'} (Ty)` });
       }

     }
   }, [open, currentUser]);

    const handleRetryAnalysis = () => {
        if (lastFailedFile) {
        setAnalysisError(null);
        setView('loading');
        handleFileChange({ target: { files: [lastFailedFile] } });
        }
    };

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setLastFailedFile(file);
    setAnalysisError(null);
    setView('loading');

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const imageBase64 = reader.result;
      try {
        const response = await fetch('/api/analyzeReceipt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageBase64 })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || result.details || `Błąd serwera (${response.status}): ${response.statusText}`);
        }
        if (!Array.isArray(result)) {
            if (result && result.error) {
                 throw new Error(result.error);
            } else {
                 throw new Error("Otrzymano nieprawidłowy format danych z serwera.");
            }
        }

        setReceiptItems(result);
        setView('analysis');
        setLastFailedFile(null);
      } catch (error) {
        console.error("Błąd w handleFileChange:", error);
        setAnalysisError(`${error.message || "Wystąpił nieoczekiwany błąd analizy."}`);
        setView('default');
      } finally {
         if (fileInputRef.current) {
             fileInputRef.current.value = "";
         }
      }
    };
     reader.onerror = (error) => {
         console.error("Błąd odczytu pliku:", error);
         setAnalysisError("Nie udało się odczytać pliku obrazu.");
         setView('default');
         setLastFailedFile(null);
         if (fileInputRef.current) {
             fileInputRef.current.value = "";
         }
     };
  };

  // Zmieniona funkcja - przyjmuje teraz tylko debts
  const handleGoToSummary = (debts) => { // Usunięto drugi parametr
    setCalculatedDebts(debts);
    // setFinalItems(finalEditableItems); // Usunięte
    setView('summary');
  };

  const handleFinalizeDebts = async (debts, description, dateString) => {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
         console.error("Nieprawidłowa data:", dateString);
         alert("Wystąpił błąd z datą płatności.");
         return;
      }
    try {
      const batchUpdates = [];
      for (const personId in debts) {
        if (currentUser && personId !== currentUser.id && debts[personId] > 0) {
            const personRef = doc(db, 'users', auth.currentUser.uid, 'people', personId);
            const personData = allPeople.find(p => p.id === personId);
            if(personData){
                batchUpdates.push(updateDoc(personRef, {
                    totalDebt: parseFloat(((personData.totalDebt || 0) + debts[personId]).toFixed(2)),
                    transactions: arrayUnion({
                        type: 'debt',
                        amount: parseFloat(debts[personId].toFixed(2)),
                        description: description || "Wspólne zakupy",
                        date: date,
                        timestamp: new Date()
                    })
                }));
            } else {
                 console.warn(`Nie znaleziono danych dla osoby ${personId}.`);
            }
        }
      }
      await Promise.all(batchUpdates);
      onSuccess?.();
      onClose();
    } catch(error) {
        console.error("Błąd zapisu podliczenia grupowego:", error);
        alert("Wystąpił błąd podczas zapisywania danych płatności grupowej.");
    }
  };

  const handleManualSubmit = async () => {
    const participants = includeCreator && currentUser ? [currentUser.id, ...selectedPeople] : selectedPeople;
    const totalPeopleInvolved = participants.length;
    const totalAmount = parseFloat(payment.amount);

    if (totalPeopleInvolved === 0 || isNaN(totalAmount) || totalAmount <= 0) {
      alert("Wybierz co najmniej jedną osobę i podaj poprawną kwotę większą od zera.");
      return;
    }
    const amountPerPerson = totalAmount / totalPeopleInvolved;
    const debts = {};
    participants.forEach(pId => {
        if (currentUser && pId !== currentUser.id) {
            debts[pId] = amountPerPerson;
        }
    });
    await handleFinalizeDebts(debts, payment.description || "Płatność grupowa", payment.date);
  };


  const amountPerPerson = useMemo(() => {
    const totalPeople = selectedPeople.length + (includeCreator ? 1 : 0);
    const amount = parseFloat(payment.amount);
    if (totalPeople > 0 && !isNaN(amount) && amount > 0) {
      return (amount / totalPeople).toFixed(2);
    }
    return '0.00';
  }, [selectedPeople, includeCreator, payment.amount]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {view === 'analysis' ? 'Analiza paragonu' : (view === 'summary' ? 'Podsumowanie' : 'Płatność Grupowa')}
      </DialogTitle>
      <DialogContent dividers>

        {view === 'loading' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 5 }}>
            <CircularProgress />
            <Typography sx={{ mt: 2 }}>Analizowanie paragonu...</Typography>
          </Box>
        )}

        {view === 'analysis' && currentUser && (
            <ReceiptAnalysisView
                items={receiptItems}
                people={allPeople}
                currentUser={currentUser}
                onCalculate={handleGoToSummary}
                onBack={() => { setView('default'); setAnalysisError(null); setLastFailedFile(null); }}
            />
        )}

        {view === 'summary' && currentUser && (
            <SummaryView
                debts={calculatedDebts}
                people={allPeople}
                currentUser={currentUser}
                onConfirm={handleFinalizeDebts}
                onBack={() => setView('analysis')}
            />
        )}

        {view === 'default' && (
             <Box>
                 {analysisError && (
                   <Alert
                     severity="error"
                     sx={{ mb: 2, display: 'flex', alignItems: 'center' }}
                     action={
                       lastFailedFile && (
                         <Button
                             color="inherit"
                             size="small"
                             onClick={handleRetryAnalysis}
                             variant="outlined"
                             sx={{ borderColor: 'currentColor', whiteSpace: 'nowrap' }}
                         >
                             SPRÓBUJ PONOWNIE
                         </Button>
                       )
                     }
                   >
                     <Box sx={{ flexGrow: 1, mr: 2 }}>{analysisError}</Box>
                   </Alert>
                 )}
                <Button fullWidth variant="outlined" startIcon={<CameraAltIcon />} onClick={() => fileInputRef.current?.click()} sx={{ mb: 2 }}>
                    Skanuj Paragon
                </Button>
                <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                 />
                <Divider sx={{ my: 2 }}>LUB WPROWADŹ RĘCZNIE</Divider>
                <TextField label="Całkowita kwota do podziału" type="number" value={payment.amount} onChange={(e) => setPayment({ ...payment, amount: e.target.value })} fullWidth margin="normal" inputProps={{ min: "0.01", step: "0.01" }}/>
                <TextField label="Opis płatności (opcjonalnie)" value={payment.description} onChange={(e) => setPayment({ ...payment, description: e.target.value })} fullWidth margin="normal"/>
                <TextField label="Data płatności" type="date" value={payment.date} onChange={(e) => setPayment({ ...payment, date: e.target.value })} fullWidth margin="normal" InputLabelProps={{ shrink: true }}/>
                <FormControlLabel control={<Checkbox checked={includeCreator} onChange={(e) => setIncludeCreator(e.target.checked)}/>} label="Uwzględnij mnie w podziale"/>

                <Typography variant="subtitle1" sx={{ mt: 2, mb: 1 }}>Wybierz osoby do podziału:</Typography>
                <TextField fullWidth size="small" label="Szukaj osoby..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} sx={{ mb: 1 }}/>
                {parseFloat(amountPerPerson) > 0 && <Typography align="right" variant="body2" color="text.secondary" sx={{ mb: 1 }}>Kwota na osobę: {amountPerPerson} PLN</Typography>}

                <List sx={{ maxHeight: 200, overflow: 'auto', border: '1px solid #ddd', borderRadius: 1 }}>
                    {allPeople.length === 0 && (
                        <ListItem>
                            <ListItemText primary="Brak osób do wybrania." />
                        </ListItem>
                    )}
                    {allPeople.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())).map((person) => (
                        <ListItemButton key={person.id} dense onClick={() => setSelectedPeople(prev => prev.includes(person.id) ? prev.filter(id => id !== person.id) : [...prev, person.id])}>
                            <ListItemIcon sx={{ minWidth: 'auto', mr: 1 }}>
                                <Checkbox edge="start" checked={selectedPeople.includes(person.id)} tabIndex={-1} disableRipple size="small"/>
                            </ListItemIcon>
                            <ListItemText primary={person.name} />
                        </ListItemButton>
                    ))}
                </List>
             </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Anuluj</Button>
        {view === 'default' && (
            <Button
                onClick={handleManualSubmit}
                variant="contained"
                disabled={!(selectedPeople.length > 0 || includeCreator) || !payment.amount || parseFloat(payment.amount) <= 0}
            >
                Dodaj płatność ręczną
            </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}


export default GroupPayment;