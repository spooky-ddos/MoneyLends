import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
  FormControlLabel, Checkbox, List, ListItem, ListItemButton, ListItemIcon, ListItemText,
  Typography, Box, IconButton, CircularProgress, Select, MenuItem, Chip, Divider, Alert
} from '@mui/material';
import { db, auth } from '../firebase';
import { collection, getDocs, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { CameraAlt as CameraAltIcon, ArrowBack as ArrowBackIcon } from '@mui/icons-material';

// --- Komponent Widoku Analizy Paragonu ---
const ReceiptAnalysisView = ({ items, people, currentUser, onCalculate, onBack }) => {
  const [assignments, setAssignments] = useState({});
  const [subgroups, setSubgroups] = useState([]);
  const [newSubgroup, setNewSubgroup] = useState([]);

  const allParticipants = useMemo(() => [currentUser, ...people], [currentUser, people]);

  const receiptTotal = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.price || 0), 0);
  }, [items]);

  useEffect(() => {
    const initialAssignments = {};
    items.forEach((_, index) => {
      initialAssignments[index] = 'unassigned';
    });
    setAssignments(initialAssignments);
  }, [items]);

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

  const calculateDebts = () => {
    const finalDebts = {};
    allParticipants.forEach(p => finalDebts[p.id] = 0);

    items.forEach((item, index) => {
      const assigneeId = assignments[index];
      if (assigneeId === 'unassigned' || !item.price || isNaN(item.price)) return;

      const singlePerson = allParticipants.find(p => p.id === assigneeId);
      const subgroup = subgroups.find(sg => sg.id === assigneeId);

      if (singlePerson) {
        finalDebts[singlePerson.id] += item.price;
      } else if (subgroup) {
        const pricePerMember = item.price / subgroup.members.length;
        subgroup.members.forEach(memberId => {
          finalDebts[memberId] += pricePerMember;
        });
      }
    });
    
    onCalculate(finalDebts);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <IconButton onClick={onBack}><ArrowBackIcon /></IconButton>
        <Typography variant="h6" sx={{ ml: 1 }}>Przypisz pozycje z paragonu</Typography>
      </Box>

      <Typography variant="h6" color="text.secondary" gutterBottom>
        Wykryta suma z paragonu: <strong>{receiptTotal.toFixed(2)} PLN</strong>
      </Typography>
      
      <Box sx={{ mb: 3, p: 2, border: '1px solid #ddd', borderRadius: 1 }}>
        <Typography variant="subtitle1" gutterBottom>Stwórz podgrupę</Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          {allParticipants.map(p => (
            <Chip key={p.id} label={p.name} onClick={() => setNewSubgroup(prev => prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id])} color={newSubgroup.includes(p.id) ? 'primary' : 'default'} variant="outlined"/>
          ))}
        </Box>
        <Button onClick={handleCreateSubgroup} disabled={newSubgroup.length < 2} variant="contained" size="small">Stwórz podgrupę</Button>
      </Box>

      <List sx={{ maxHeight: 300, overflow: 'auto' }}>
        {items.map((item, index) => (
          <ListItem key={index} divider sx={{ display: 'flex', justifyContent: 'space-between', p: 1 }}>
            <ListItemText primary={item.item || "Nieznany produkt"} secondary={`${(item.price || 0).toFixed(2)} PLN`} />
            <Select value={assignments[index] || 'unassigned'} onChange={(e) => handleAssignmentChange(index, e.target.value)} size="small" sx={{ minWidth: 150 }}>
              <MenuItem value="unassigned"><em>Nieprzypisane</em></MenuItem>
              <MenuItem disabled>Osoby</MenuItem>
              {allParticipants.map(p => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
              {subgroups.length > 0 && <MenuItem disabled>Podgrupy</MenuItem>}
              {subgroups.map(sg => <MenuItem key={sg.id} value={sg.id}>{sg.name}</MenuItem>)}
            </Select>
          </ListItem>
        ))}
      </List>
      <Button onClick={calculateDebts} variant="contained" color="primary" fullWidth sx={{ mt: 2 }}>Przejdź do podsumowania</Button>
    </Box>
  );
};

// --- Komponent Widoku Podsumowania ---
const SummaryView = ({ debts, people, currentUser, onConfirm, onBack }) => {
    const [title, setTitle] = useState("Wspólne zakupy");
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const allParticipants = useMemo(() => [currentUser, ...people], [currentUser, people]);

    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <IconButton onClick={onBack}><ArrowBackIcon /></IconButton>
                <Typography variant="h6" sx={{ ml: 1 }}>Podsumowanie</Typography>
            </Box>
            <TextField label="Tytuł płatności" value={title} onChange={(e) => setTitle(e.target.value)} fullWidth margin="normal" />
            <TextField label="Data" type="date" value={date} onChange={(e) => setDate(e.target.value)} fullWidth margin="normal" InputLabelProps={{ shrink: true }} />
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle1" gutterBottom>Obciążenia:</Typography>
            <List dense>
                {Object.entries(debts).map(([personId, amount]) => {
                    if (amount === 0) return null;
                    const person = allParticipants.find(p => p.id === personId);
                    return (
                        <ListItem key={personId}>
                            <ListItemText primary={person?.name || 'Nieznany'} secondary={`${amount.toFixed(2)} PLN`} />
                        </ListItem>
                    )
                })}
            </List>
            <Button onClick={() => onConfirm(debts, title, date)} variant="contained" color="success" fullWidth sx={{ mt: 2 }}>Zatwierdź i zapisz</Button>
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
  
  const [view, setView] = useState('default'); 
  const [receiptItems, setReceiptItems] = useState([]);
  const [calculatedDebts, setCalculatedDebts] = useState({});
  const [currentUser, setCurrentUser] = useState(null);
  const [analysisError, setAnalysisError] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (open) {
      if(auth.currentUser){
        const { uid, displayName } = auth.currentUser;
        setCurrentUser({ id: uid, name: `${displayName || 'Ja'} (Ty)`});

        const fetchPeople = async () => {
          if (!uid) return;
          const peopleCollection = collection(db, 'users', uid, 'people');
          const peopleSnapshot = await getDocs(peopleCollection);
          const peopleList = peopleSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(p => !p.isSummary);
          setAllPeople(peopleList);
        };
        fetchPeople();
      }
      setView('default');
      setAnalysisError(null);
    }
  }, [open]);

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

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
            throw new Error(result.message || result.details || `Błąd serwera: ${response.statusText}`);
        }
        
        setReceiptItems(result);
        setView('analysis');
      } catch (error) {
        setAnalysisError(`Błąd analizy: ${error.message}`);
        setView('default');
      }
    };
  };
  
  // TA FUNKCJA BYŁA BRAKUJĄCA
  const handleGoToSummary = (debts) => {
    setCalculatedDebts(debts);
    setView('summary');
  };

  const handleFinalizeDebts = async (debts, description, date) => {
    try {
      for (const personId in debts) {
        if (currentUser && personId !== currentUser.id && debts[personId] > 0) {
            const personRef = doc(db, 'users', auth.currentUser.uid, 'people', personId);
            const personData = allPeople.find(p => p.id === personId);
            if(personData){
                await updateDoc(personRef, {
                    totalDebt: (personData.totalDebt || 0) + debts[personId],
                    transactions: arrayUnion({
                        type: 'debt',
                        amount: debts[personId],
                        description: description,
                        date: new Date(date),
                        timestamp: new Date()
                    })
                });
            }
        }
      }
      onSuccess?.();
      onClose();
    } catch(error) {
        console.error("Błąd zapisu podliczenia", error);
        alert("Wystąpił błąd podczas zapisywania danych.");
    }
  };
  
  const handleManualSubmit = () => {
    const totalPeopleInvolved = selectedPeople.length + (includeCreator ? 1 : 0);
    if (totalPeopleInvolved === 0 || !payment.amount) {
        alert("Wybierz osoby i podaj kwotę.");
        return;
    }
    const amountPerPerson = parseFloat(payment.amount) / totalPeopleInvolved;
    const debts = {};
    selectedPeople.forEach(pId => debts[pId] = amountPerPerson);
    handleFinalizeDebts(debts, payment.description || "Płatność grupowa", payment.date);
  };

  const amountPerPerson = useMemo(() => {
    const totalPeople = selectedPeople.length + (includeCreator ? 1 : 0);
    const amount = parseFloat(payment.amount);
    if (totalPeople > 0 && amount > 0) {
      return (amount / totalPeople).toFixed(2);
    }
    return 0;
  }, [selectedPeople, includeCreator, payment.amount]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {view === 'analysis' ? 'Analiza paragonu' : (view === 'summary' ? 'Podsumowanie' : 'Płatność Grupowa')}
      </DialogTitle>
      <DialogContent>
        {view === 'loading' && <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress /></Box>}
        
        {view === 'analysis' && currentUser && (
            <ReceiptAnalysisView 
                items={receiptItems}
                people={allPeople}
                currentUser={currentUser}
                onCalculate={handleGoToSummary}
                onBack={() => setView('default')}
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
                {analysisError && <Alert severity="error" sx={{ mb: 2 }}>{analysisError}</Alert>}
                <Button fullWidth variant="outlined" startIcon={<CameraAltIcon />} onClick={() => fileInputRef.current.click()} sx={{ mb: 2 }}>
                    Skanuj Paragon
                </Button>
                <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} />
                <Divider sx={{ my: 2 }}>LUB WPROWADŹ RĘCZNIE</Divider>
                <TextField label="Całkowita kwota do podziału" type="number" value={payment.amount} onChange={(e) => setPayment({ ...payment, amount: e.target.value })} fullWidth margin="normal"/>
                <TextField label="Opis płatności" value={payment.description} onChange={(e) => setPayment({ ...payment, description: e.target.value })} fullWidth margin="normal"/>
                <TextField label="Data płatności" type="date" value={payment.date} onChange={(e) => setPayment({ ...payment, date: e.target.value })} fullWidth margin="normal" InputLabelProps={{ shrink: true }}/>
                <FormControlLabel control={<Checkbox checked={includeCreator} onChange={(e) => setIncludeCreator(e.target.checked)}/>} label="Uwzględnij mnie w podziale"/>
                
                <Typography variant="subtitle1" sx={{ mt: 2, mb: 1 }}>Wybierz osoby do podziału:</Typography>
                <TextField fullWidth size="small" label="Szukaj osoby" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} sx={{ mb: 2 }}/>
                {amountPerPerson > 0 && <Typography align="right" variant="body2" color="text.secondary">Kwota na osobę: {amountPerPerson} PLN</Typography>}
                
                <List sx={{ maxHeight: 200, overflow: 'auto', border: '1px solid #ddd', borderRadius: 1 }}>
                    {allPeople.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())).map((person) => (
                        <ListItemButton key={person.id} dense onClick={() => setSelectedPeople(prev => prev.includes(person.id) ? prev.filter(id => id !== person.id) : [...prev, person.id])}>
                            <ListItemIcon><Checkbox edge="start" checked={selectedPeople.includes(person.id)} tabIndex={-1} disableRipple/></ListItemIcon>
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
            <Button onClick={handleManualSubmit} variant="contained">Dodaj płatność ręczną</Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

export default GroupPayment;