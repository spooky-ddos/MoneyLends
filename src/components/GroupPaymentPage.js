import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Button, TextField, FormControlLabel, Checkbox, List, ListItem, ListItemButton,
  ListItemIcon, ListItemText, Typography, Box, IconButton, Select, MenuItem, Chip,
  Divider, Alert, ListSubheader, Paper,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions
} from '@mui/material';
import { db, auth } from '../firebase';
import { collection, getDocs, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useSnackbar } from '../contexts/SnackbarContext';
import {
  CameraAlt as CameraAltIcon,
  ArrowBack as ArrowBackIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Search as SearchIcon
} from '@mui/icons-material';

// Maksymalna liczba automatycznych ponowień oraz rosnące odstępy (2s, 4s, 8s, 16s, 32s).
const RETRY_DELAYS = [2000, 4000, 8000, 16000, 32000];

const SCAN_MESSAGES = [
  'Trwa analiza paragonu...',
  'Odczytuję pozycje...',
  'Rozpoznaję ceny...',
  'Porządkuję dane...'
];

// Pomocnik: czekanie z możliwością przerwania przez AbortSignal.
const delay = (ms, signal) => new Promise((resolve, reject) => {
  if (signal?.aborted) {
    reject(new DOMException('Aborted', 'AbortError'));
    return;
  }
  const timeoutId = setTimeout(resolve, ms);
  signal?.addEventListener('abort', () => {
    clearTimeout(timeoutId);
    reject(new DOMException('Aborted', 'AbortError'));
  }, { once: true });
});

const readFileAsDataURL = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(new Error('Nie udało się odczytać pliku obrazu.'));
  reader.readAsDataURL(file);
});


// --- Animowany wskaźnik skanowania paragonu ---
const ReceiptScanLoader = ({ phase, retryNumber, retryTotal, onCancel }) => {
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    if (phase === 'retrying') return undefined;
    const intervalId = setInterval(() => {
      setMsgIndex(prev => (prev + 1) % SCAN_MESSAGES.length);
    }, 2500);
    return () => clearInterval(intervalId);
  }, [phase]);

  const statusText = phase === 'retrying'
    ? `Serwery są obciążone, ponawiam próbę ${retryNumber}/${retryTotal}...`
    : SCAN_MESSAGES[msgIndex];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 5, px: 2 }}>
      <Box sx={{ position: 'relative', width: 200, height: 160, mb: 3 }}>
        {/* Makieta paragonu */}
        <Paper elevation={2} sx={{ position: 'absolute', inset: 0, p: 2, display: 'flex', flexDirection: 'column', gap: 1.2, overflow: 'hidden' }}>
          {[90, 70, 80, 55, 75, 60, 85, 50].map((w, i) => (
            <Box key={i} sx={{ height: 8, width: `${w}%`, borderRadius: 4, bgcolor: 'rgba(0, 0, 0, 0.08)' }} />
          ))}
        </Paper>

        {/* Linia skanująca */}
        <Box
          component={motion.div}
          animate={{ y: [0, 150, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          sx={{
            position: 'absolute',
            left: 4,
            right: 4,
            height: 3,
            borderRadius: 2,
            bgcolor: 'primary.main',
            opacity: 0.5,
            boxShadow: '0 0 8px rgba(37, 99, 235, 0.7)'
          }}
        />

        {/* Latająca, skanująca lupa */}
        <Box
          component={motion.div}
          animate={{
            x: [8, 130, 30, 140, 8],
            y: [8, 30, 70, 105, 8],
            rotate: [0, 8, -6, 10, 0]
          }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          sx={{ position: 'absolute', color: 'primary.main', filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.25))' }}
        >
          <SearchIcon sx={{ fontSize: 48 }} />
        </Box>
      </Box>

      <Box
        component={motion.div}
        key={statusText}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Typography
          align="center"
          sx={{
            fontWeight: phase === 'retrying' ? 600 : 400,
            color: phase === 'retrying' ? 'warning.main' : 'text.primary'
          }}
        >
          {statusText}
        </Typography>
      </Box>

      <Button onClick={onCancel} variant="outlined" color="inherit" startIcon={<CancelIcon />} sx={{ mt: 3 }}>
        Anuluj
      </Button>
    </Box>
  );
};


// Ograniczenie szerokości rozwijanych list (długie nazwy grup nie rozpychają menu).
const SELECT_MENU_PROPS = {
  PaperProps: { sx: { maxWidth: { xs: '85vw', sm: 360 } } }
};
const MENU_ITEM_WRAP_SX = { whiteSpace: 'normal', wordBreak: 'break-word' };

// --- Komponent Widoku Analizy Paragonu ---
const ReceiptAnalysisView = ({ items: initialItems, people, summaries, currentUser, onCalculate, onBack }) => {
  const [editableItems, setEditableItems] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [subgroups, setSubgroups] = useState([]);
  const [newSubgroup, setNewSubgroup] = useState([]);
  const [subgroupName, setSubgroupName] = useState('');

  // Krok analizy: najpierw wybór uczestników, potem przypisywanie pozycji.
  const [analysisStep, setAnalysisStep] = useState('participants');
  const [participantSearch, setParticipantSearch] = useState('');

  const [editIndex, setEditIndex] = useState(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');

  // Potwierdzenie pominięcia nieprzypisanych pozycji.
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [unassignedCount, setUnassignedCount] = useState(0);
  const [highlightSkipped, setHighlightSkipped] = useState(false);

  // Indeks pozycji oczekującej na potwierdzenie usunięcia (custom dialog).
  const [deleteIndex, setDeleteIndex] = useState(null);

  // Podsumowania: wybrane podsumowania, ich opcjonalne mapowanie na osobę
  // oraz przełączniki ON/OFF dla każdej pozycji.
  const [selectedSummaryIds, setSelectedSummaryIds] = useState([]);
  const [summaryMappings, setSummaryMappings] = useState({});
  const [summaryToggles, setSummaryToggles] = useState({});

  const allParticipants = useMemo(() => [currentUser, ...people], [currentUser, people]);
  const allSummaries = useMemo(() => summaries || [], [summaries]);

  // Domyślnie zaznaczamy tylko bieżącego użytkownika.
  const [selectedParticipantIds, setSelectedParticipantIds] = useState([currentUser.id]);

  const activeParticipants = useMemo(
    () => allParticipants.filter(p => selectedParticipantIds.includes(p.id)),
    [allParticipants, selectedParticipantIds]
  );

  const selectedSummaries = useMemo(
    () => allSummaries.filter(s => selectedSummaryIds.includes(s.id)),
    [allSummaries, selectedSummaryIds]
  );

  useEffect(() => {
    setEditableItems(initialItems.map(item => ({ ...item })));
  }, [initialItems]);

  const receiptTotal = useMemo(() => {
    return editableItems.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
  }, [editableItems]);

  useEffect(() => {
    const initialAssignments = {};
    editableItems.forEach((_, index) => {
      initialAssignments[index] = assignments[index] || 'unassigned';
    });
    setAssignments(initialAssignments);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editableItems]);

  // Gdy zmieni się zestaw uczestników, usuwamy podgrupy zawierające osoby spoza wyboru.
  useEffect(() => {
    setSubgroups(prev => prev.filter(sg => sg.members.every(m => selectedParticipantIds.includes(m))));
  }, [selectedParticipantIds]);

  // Resetujemy przypisania wskazujące na usuniętych uczestników lub nieistniejące podgrupy.
  useEffect(() => {
    setAssignments(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(idx => {
        const value = next[idx];
        if (value === 'unassigned') return;
        const isValidPerson = selectedParticipantIds.includes(value);
        const isValidSubgroup = subgroups.some(sg => sg.id === value);
        if (!isValidPerson && !isValidSubgroup) {
          next[idx] = 'unassigned';
        }
      });
      return next;
    });
  }, [selectedParticipantIds, subgroups]);

  // Gdy uczestnik zostanie odznaczony, czyścimy mapowania podsumowań, które na niego wskazują.
  useEffect(() => {
    setSummaryMappings(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(sid => {
        if (next[sid] && !selectedParticipantIds.includes(next[sid])) {
          next[sid] = '';
        }
      });
      return next;
    });
  }, [selectedParticipantIds]);

  const toggleParticipant = (id) => {
    setSelectedParticipantIds(prev =>
      prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]
    );
  };

  const toggleSummarySelected = (id) => {
    setSelectedSummaryIds(prev => {
      if (prev.includes(id)) {
        setSummaryMappings(m => {
          const next = { ...m };
          delete next[id];
          return next;
        });
        return prev.filter(sid => sid !== id);
      }
      return [...prev, id];
    });
  };

  const setSummaryMapping = (summaryId, participantId) => {
    setSummaryMappings(prev => ({ ...prev, [summaryId]: participantId }));
  };

  // Domyślny stan przełącznika: podsumowanie zmapowane na osobę -> ON,
  // bez mapowania -> OFF. Jawne kliknięcie użytkownika nadpisuje domyślną wartość.
  const isSummaryActive = (index, summaryId) => {
    const explicit = summaryToggles[index]?.[summaryId];
    if (explicit !== undefined) return explicit;
    return !!summaryMappings[summaryId];
  };

  const toggleSummary = (itemIndex, summaryId) => {
    const current = isSummaryActive(itemIndex, summaryId);
    setSummaryToggles(prev => ({
      ...prev,
      [itemIndex]: {
        ...(prev[itemIndex] || {}),
        [summaryId]: !current
      }
    }));
  };

  // Czy pozycja jest "obsłużona": przypisana do osoby/podgrupy LUB do aktywnego podsumowania.
  const isItemUnassigned = (index) => {
    const assignment = assignments[index] || 'unassigned';
    if (assignment !== 'unassigned') return false;
    const hasActiveSummary = selectedSummaryIds.some(sid => isSummaryActive(index, sid));
    return !hasActiveSummary;
  };

  const handleCreateSubgroup = () => {
    if (newSubgroup.length > 1) {
      const autoName = newSubgroup.map(pId => allParticipants.find(p => p.id === pId)?.name || '...').join(' i ');
      const finalName = subgroupName.trim() || autoName;
      const newSubgroupObject = { id: `subgroup_${Date.now()}`, name: finalName, members: newSubgroup };
      setSubgroups([...subgroups, newSubgroupObject]);
      setNewSubgroup([]);
      setSubgroupName('');
    }
  };

  const handleAssignmentChange = (itemIndex, assigneeId) => {
    setAssignments(prev => ({ ...prev, [itemIndex]: assigneeId }));
  };

  const handleEditStart = (index) => {
    setEditIndex(index);
    if (index === -1) {
      setEditName('');
      setEditPrice('');
    } else {
      setEditName(editableItems[index].item);
      setEditPrice(editableItems[index].price.toString());
    }
  };

  const handleEditCancel = () => {
    setEditIndex(null);
    setEditName('');
    setEditPrice('');
  };

  const handleEditSave = () => {
    const price = parseFloat(editPrice);
    if (!editName.trim() || isNaN(price)) {
      alert('Nazwa produktu nie może być pusta, a cena musi być liczbą.');
      return;
    }

    if (editIndex === -1) {
      setEditableItems(prevItems => [...prevItems, { item: editName.trim(), price: price }]);
    } else {
      setEditableItems(prevItems =>
        prevItems.map((item, index) =>
          index === editIndex ? { ...item, item: editName.trim(), price: price } : item
        )
      );
    }
    handleEditCancel();
  };

  const performDeleteItem = (indexToDelete) => {
    setEditableItems(prevItems => prevItems.filter((_, index) => index !== indexToDelete));
    if (editIndex === indexToDelete) {
      handleEditCancel();
    } else if (editIndex !== null && editIndex > indexToDelete) {
      setEditIndex(prev => (prev !== null ? prev - 1 : null));
    }
    setAssignments(prevAssignments => {
      const newAssignments = {};
      let currentNewIndex = 0;
      for (let i = 0; i < editableItems.length; i++) {
        if (i !== indexToDelete) {
          newAssignments[currentNewIndex] = prevAssignments[i];
          currentNewIndex++;
        }
      }
      return newAssignments;
    });
    setSummaryToggles(prevToggles => {
      const newToggles = {};
      let currentNewIndex = 0;
      for (let i = 0; i < editableItems.length; i++) {
        if (i !== indexToDelete) {
          if (prevToggles[i]) newToggles[currentNewIndex] = prevToggles[i];
          currentNewIndex++;
        }
      }
      return newToggles;
    });
  };

  const handleConfirmDelete = () => {
    if (deleteIndex !== null) performDeleteItem(deleteIndex);
    setDeleteIndex(null);
  };

  const calculateDebts = () => {
    const finalDebts = {};
    allParticipants.forEach(p => finalDebts[p.id] = 0);
    selectedSummaryIds.forEach(sid => finalDebts[sid] = 0);

    editableItems.forEach((item, index) => {
      const itemPrice = Number(item.price);
      if (!itemPrice || isNaN(itemPrice)) return;

      const assigneeId = assignments[index] || 'unassigned';

      // 1) Normalny podział na osoby / podgrupy.
      if (assigneeId !== 'unassigned') {
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
      }

      // 2) Podsumowania - DUBLUJĄ wpis (nie zabierają nic z osób).
      selectedSummaryIds.forEach(sid => {
        if (!isSummaryActive(index, sid)) return;
        const mappedParticipantId = summaryMappings[sid];

        if (mappedParticipantId) {
          // Do podsumowania trafia tylko część należna zmapowanej osobie z tej pozycji.
          let share = 0;
          if (assigneeId === mappedParticipantId) {
            share = itemPrice;
          } else {
            const subgroup = subgroups.find(sg => sg.id === assigneeId);
            if (subgroup && subgroup.members.includes(mappedParticipantId) && subgroup.members.length > 0) {
              share = itemPrice / subgroup.members.length;
            }
          }
          if (share > 0) finalDebts[sid] += share;
        } else {
          // Bez mapowania - cała wartość pozycji trafia do podsumowania.
          finalDebts[sid] += itemPrice;
        }
      });
    });

    Object.keys(finalDebts).forEach(id => {
      finalDebts[id] = parseFloat(finalDebts[id].toFixed(2));
    });

    onCalculate(finalDebts);
  };

  // Poprawna polska odmiana (biernik): 1 pozycję, 2-4 pozycje, 5+ pozycji.
  const itemWordAccusative = (n) => {
    if (n === 1) return 'pozycję';
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return 'pozycje';
    return 'pozycji';
  };

  const handleProceed = () => {
    const count = editableItems.reduce(
      (sum, _, index) => sum + (isItemUnassigned(index) ? 1 : 0),
      0
    );
    if (count > 0) {
      setUnassignedCount(count);
      setConfirmOpen(true);
    } else {
      calculateDebts();
    }
  };

  const handleConfirmSkip = () => {
    setConfirmOpen(false);
    calculateDebts();
  };

  const handleRejectSkip = () => {
    setConfirmOpen(false);
    setHighlightSkipped(true);
  };

  // --- Krok 1: wybór uczestników paragonu ---
  if (analysisStep === 'participants') {
    const filteredParticipants = allParticipants.filter(p =>
      p.name.toLowerCase().includes(participantSearch.toLowerCase())
    );

    return (
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <IconButton onClick={onBack} aria-label="Wróć"><ArrowBackIcon /></IconButton>
          <Typography variant="h6" sx={{ ml: 1 }}>Kto bierze udział?</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Zaznacz tylko osoby, których dotyczy ten paragon. Dzięki temu w kolejnym kroku
          na liście do przypisania pojawią się wyłącznie one.
        </Typography>

        <TextField
          fullWidth
          size="small"
          label="Szukaj osoby..."
          value={participantSearch}
          onChange={(e) => setParticipantSearch(e.target.value)}
          sx={{ mb: 2 }}
        />

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
          {filteredParticipants.map(p => (
            <Chip
              key={p.id}
              label={p.name}
              onClick={() => toggleParticipant(p.id)}
              color={selectedParticipantIds.includes(p.id) ? 'primary' : 'default'}
              variant={selectedParticipantIds.includes(p.id) ? 'filled' : 'outlined'}
              clickable
            />
          ))}
          {filteredParticipants.length === 0 && (
            <Typography variant="body2" color="text.secondary">Brak osób pasujących do wyszukiwania.</Typography>
          )}
        </Box>

        {allSummaries.length > 0 && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle1" gutterBottom>Podsumowania (opcjonalnie)</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Wybierz podsumowania, do których chcesz <strong>dublować</strong> wybrane pozycje (nie odejmuje to nic od osób).
              Możesz przypisać podsumowanie do osoby — wtedy dublowana jest tylko jej część pozycji. Bez mapowania trafia tam cała wartość pozycji.
            </Typography>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
              {allSummaries.map(s => (
                <Chip
                  key={s.id}
                  label={s.name}
                  onClick={() => toggleSummarySelected(s.id)}
                  color={selectedSummaryIds.includes(s.id) ? 'secondary' : 'default'}
                  variant={selectedSummaryIds.includes(s.id) ? 'filled' : 'outlined'}
                  clickable
                />
              ))}
            </Box>

            {selectedSummaries.map(s => (
              <Box key={s.id} sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 500, minWidth: 80 }}>{s.name}</Typography>
                <Typography variant="body2" color="text.secondary">mapuj na:</Typography>
                <Select
                  size="small"
                  value={summaryMappings[s.id] || ''}
                  onChange={(e) => setSummaryMapping(s.id, e.target.value)}
                  displayEmpty
                  sx={{ minWidth: 160, maxWidth: { sm: 220 }, flexGrow: 1 }}
                  MenuProps={SELECT_MENU_PROPS}
                >
                  <MenuItem value=""><em>Bez mapowania</em></MenuItem>
                  {activeParticipants.map(p => (
                    <MenuItem key={p.id} value={p.id} sx={MENU_ITEM_WRAP_SX}>{p.name}</MenuItem>
                  ))}
                </Select>
              </Box>
            ))}
          </>
        )}

        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 2, mb: 2 }}>
          Wybrano osób: {selectedParticipantIds.length}
          {selectedSummaryIds.length > 0 ? ` · podsumowań: ${selectedSummaryIds.length}` : ''}
        </Typography>

        <Button
          onClick={() => setAnalysisStep('items')}
          variant="contained"
          color="primary"
          fullWidth
          disabled={selectedParticipantIds.length === 0}
        >
          Dalej
        </Button>
      </Box>
    );
  }

  // --- Krok 2: przypisywanie pozycji ---
  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <IconButton onClick={() => setAnalysisStep('participants')} aria-label="Wróć"><ArrowBackIcon /></IconButton>
        <Typography variant="h6" sx={{ ml: 1 }}>Przypisz pozycje z paragonu</Typography>
      </Box>

      <Typography variant="h6" color="text.secondary" gutterBottom>
        Wykryta/Obliczona suma: <strong>{receiptTotal.toFixed(2)} PLN</strong>
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
        Zweryfikuj, czy suma ({receiptTotal.toFixed(2)} PLN) zgadza się z sumą na paragonie. Edytuj listę lub dodaj brakujące pozycje. Niezgodność może wynikać z nieczytelności zdjęcia.
      </Typography>

      <Box sx={{ mb: 3, p: 2, border: '1px solid #ddd', borderRadius: 1 }}>
        <Typography variant="subtitle1" gutterBottom>Stwórz podgrupę</Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          {activeParticipants.map(p => (
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
        <TextField
          fullWidth
          size="small"
          label="Nazwa grupy (opcjonalnie)"
          value={subgroupName}
          onChange={(e) => setSubgroupName(e.target.value)}
          placeholder="np. Impreza, Mieszkanie..."
          sx={{ mb: 2 }}
        />
        <Button onClick={handleCreateSubgroup} disabled={newSubgroup.length < 2} variant="contained" size="small">Stwórz podgrupę</Button>
      </Box>

      <Typography variant="subtitle1" gutterBottom>Pozycje z paragonu:</Typography>
      <List sx={{ border: '1px solid #ddd', borderRadius: 1, mb: 2 }}>
        {editableItems.map((item, index) => {
          if (editIndex === index) {
            return (
              <ListItem
                key={index}
                divider
                sx={{
                  display: 'flex',
                  flexDirection: { xs: 'column', sm: 'row' },
                  alignItems: { xs: 'stretch', sm: 'center' },
                  p: 1.5,
                  gap: 1,
                  bgcolor: 'action.hover'
                }}
              >
                <TextField
                  label="Nazwa produktu"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  size="small"
                  autoFocus
                  sx={{ flexGrow: 1, minWidth: 0 }}
                />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, width: { xs: '100%', sm: 'auto' } }}>
                  <TextField
                    label="Cena (PLN)"
                    type="number"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    size="small"
                    inputProps={{ step: "0.01", lang: "pl-PL" }}
                    sx={{ flexGrow: 1, width: { sm: 130 } }}
                  />
                  <IconButton onClick={handleEditSave} color="primary" aria-label="Zapisz">
                    <SaveIcon />
                  </IconButton>
                  <IconButton onClick={handleEditCancel} aria-label="Anuluj">
                    <CancelIcon />
                  </IconButton>
                </Box>
              </ListItem>
            );
          }

          const skipped = highlightSkipped && isItemUnassigned(index);

          return (
            <ListItem
              key={index}
              divider
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
                p: 1.5,
                gap: 1,
                borderLeft: '3px solid',
                borderLeftColor: skipped ? 'warning.main' : 'transparent',
                bgcolor: skipped ? 'rgba(237, 108, 2, 0.06)' : 'transparent'
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: { xs: 'column', sm: 'row' },
                  alignItems: { xs: 'stretch', sm: 'center' },
                  gap: 1,
                  width: '100%'
                }}
              >
                <ListItemText
                  primary={item.item || "Brak nazwy"}
                  secondary={`${(Number(item.price) || 0).toFixed(2)} PLN${skipped ? ' · pominięta' : ''}`}
                  primaryTypographyProps={{
                    sx: {
                      textDecoration: skipped ? 'line-through' : 'none',
                      color: skipped ? 'text.secondary' : 'inherit'
                    }
                  }}
                  secondaryTypographyProps={{ sx: { color: skipped ? 'warning.main' : 'text.secondary' } }}
                  sx={{ flexGrow: 1, minWidth: 0, m: 0, mr: { sm: 1 }, wordBreak: 'break-word' }}
                />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, width: { xs: '100%', sm: 'auto' } }}>
                  <Select
                    value={assignments[index] || 'unassigned'}
                    onChange={(e) => handleAssignmentChange(index, e.target.value)}
                    size="small"
                    sx={{ flexGrow: 1, minWidth: { xs: 0, sm: 140 }, maxWidth: { sm: 200 } }}
                    displayEmpty
                    MenuProps={SELECT_MENU_PROPS}
                  >
                    <MenuItem value="unassigned"><em>Nieprzypisane</em></MenuItem>
                    <ListSubheader>Osoby</ListSubheader>
                    {activeParticipants.map(p => <MenuItem key={p.id} value={p.id} sx={MENU_ITEM_WRAP_SX}>{p.name}</MenuItem>)}
                    {subgroups.length > 0 && <ListSubheader>Podgrupy</ListSubheader>}
                    {subgroups.map(sg => <MenuItem key={sg.id} value={sg.id} sx={MENU_ITEM_WRAP_SX}>{sg.name}</MenuItem>)}
                  </Select>
                  <IconButton size="small" onClick={() => handleEditStart(index)} aria-label="Edytuj">
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" onClick={() => setDeleteIndex(index)} aria-label="Usuń">
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Box>

              {selectedSummaries.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.5 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>Dubluj do:</Typography>
                  {selectedSummaries.map(s => {
                    const active = isSummaryActive(index, s.id);
                    return (
                      <Chip
                        key={s.id}
                        size="small"
                        label={s.name}
                        onClick={() => toggleSummary(index, s.id)}
                        color={active ? 'secondary' : 'default'}
                        variant={active ? 'filled' : 'outlined'}
                        clickable
                        sx={{ maxWidth: 160 }}
                      />
                    );
                  })}
                </Box>
              )}
            </ListItem>
          );
        })}
        {editableItems.length === 0 && (
          <ListItem>
            <ListItemText primary="Brak pozycji do wyświetlenia. Dodaj nową." align="center" />
          </ListItem>
        )}
      </List>

      {editIndex === -1 && (
        <Paper sx={{ p: 2, mb: 2, border: '1px solid', borderColor: 'primary.main' }}>
          <Typography variant="subtitle2" gutterBottom>Dodaj nową pozycję</Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField
              label="Nazwa produktu"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              size="small"
              autoFocus
              sx={{ flexGrow: 1, minWidth: '150px' }}
            />
            <TextField
              label="Cena (PLN)"
              type="number"
              value={editPrice}
              onChange={(e) => setEditPrice(e.target.value)}
              size="small"
              inputProps={{ step: "0.01", lang: "pl-PL" }}
              sx={{ width: 130 }}
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

      {editIndex === null && (
        <Button
          startIcon={<AddIcon />}
          onClick={() => handleEditStart(-1)}
          variant="outlined"
          fullWidth
          sx={{ mb: 2 }}
        >
          Dodaj pozycję ręcznie
        </Button>
      )}

      <Button
        onClick={handleProceed}
        variant="contained"
        color="primary"
        fullWidth
        disabled={editableItems.length === 0}
        sx={{ mt: 2 }}
      >
        Przejdź do podsumowania
      </Button>

      <Dialog open={confirmOpen} onClose={handleRejectSkip} maxWidth="xs" fullWidth>
        <DialogTitle>Pominąć nieprzypisane pozycje?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Czy na pewno chcesz pominąć {unassignedCount} {itemWordAccusative(unassignedCount)}?
            Nieprzypisane pozycje nie zostaną uwzględnione w podziale.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleRejectSkip} color="inherit">Nie, wróć</Button>
          <Button onClick={handleConfirmSkip} variant="contained" color="primary">Tak, kontynuuj</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteIndex !== null} onClose={() => setDeleteIndex(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Usunąć pozycję?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Czy na pewno chcesz usunąć pozycję
            {deleteIndex !== null && editableItems[deleteIndex]
              ? ` „${editableItems[deleteIndex].item || 'Brak nazwy'}"`
              : ''}?
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteIndex(null)} color="inherit">Anuluj</Button>
          <Button onClick={handleConfirmDelete} variant="contained" color="error">Usuń</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};


// --- Komponent Widoku Podsumowania ---
const SummaryView = ({ debts, people, summaries, currentUser, onConfirm, onBack, defaultTitle, defaultDate }) => {
  const [title, setTitle] = useState(defaultTitle || "Wspólne zakupy");
  const [date, setDate] = useState(() => {
    if (defaultDate) {
      const parsed = new Date(defaultDate);
      if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
    }
    return new Date().toISOString().split('T')[0];
  });
  const allParticipants = useMemo(
    () => [currentUser, ...people, ...(summaries || [])],
    [currentUser, people, summaries]
  );
  const summaryIds = useMemo(() => new Set((summaries || []).map(s => s.id)), [summaries]);

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
      <List dense sx={{ mb: 2 }}>
        {Object.entries(debts).map(([personId, amount]) => {
          if (amount === 0 || isNaN(amount)) return null;
          const person = allParticipants.find(p => p.id === personId);
          const isSummaryEntry = summaryIds.has(personId);
          return (
            <ListItem key={personId} divider>
              <ListItemText
                primary={person?.name || 'Nieznany'}
                secondary={`${amount.toFixed(2)} PLN`}
              />
              {isSummaryEntry && (
                <Chip label="Podsumowanie" size="small" color="secondary" variant="outlined" />
              )}
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


// --- Główny Komponent (podstrona) ---
function GroupPaymentPage() {
  const navigate = useNavigate();
  const { showSnackbar } = useSnackbar();

  const [allPeople, setAllPeople] = useState([]);
  const [selectedPeople, setSelectedPeople] = useState([]);
  const [includeCreator, setIncludeCreator] = useState(true);
  const [payment, setPayment] = useState({ amount: '', description: '', date: new Date().toISOString().split('T')[0] });
  const [searchQuery, setSearchQuery] = useState('');

  const [summaries, setSummaries] = useState([]);
  const [view, setView] = useState('default');
  const [receiptItems, setReceiptItems] = useState([]);
  const [receiptMeta, setReceiptMeta] = useState({ store: null, date: null });
  const [calculatedDebts, setCalculatedDebts] = useState({});
  const [currentUser, setCurrentUser] = useState(null);
  const [analysisError, setAnalysisError] = useState(null);
  const [lastFailedFile, setLastFailedFile] = useState(null);

  // Stan wskaźnika ładowania / ponawiania.
  const [loadingPhase, setLoadingPhase] = useState('analyzing');
  const [retryNumber, setRetryNumber] = useState(0);

  const fileInputRef = useRef(null);
  const abortRef = useRef(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (auth.currentUser) {
      const { uid, displayName } = auth.currentUser;
      setCurrentUser({ id: uid, name: `${displayName || 'Ja'} (Ty)` });

      const fetchPeople = async () => {
        try {
          const peopleCollection = collection(db, 'users', uid, 'people');
          const peopleSnapshot = await getDocs(peopleCollection);
          const allDocs = peopleSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setAllPeople(allDocs.filter(p => !p.isSummary));
          setSummaries(allDocs.filter(p => p.isSummary));
        } catch (error) {
          console.error("Błąd podczas pobierania listy osób:", error);
        }
      };
      fetchPeople();
    }
  }, []);

  // Sprzątanie przy odmontowaniu - przerywamy ewentualną trwającą analizę.
  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      abortRef.current?.abort();
    };
  }, []);

  // Pojedyncza próba analizy. Rzuca błędem z flagą `retryable`.
  const analyzeOnce = async (imageBase64, signal) => {
    let response;
    try {
      response = await fetch('/api/analyzeReceipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64 }),
        signal
      });
    } catch (networkError) {
      if (networkError.name === 'AbortError') throw networkError;
      const err = new Error("Problem z połączeniem. Sprawdź internet i spróbuj ponownie.");
      err.retryable = true;
      throw err;
    }

    let result;
    try {
      result = await response.json();
    } catch (parseError) {
      const err = new Error("Otrzymano nieprawidłową odpowiedź z serwera.");
      err.retryable = response.status >= 500 || response.status === 422;
      throw err;
    }

    if (!response.ok) {
      const message = result?.message || result?.details || `Błąd serwera (${response.status}).`;
      const err = new Error(message);
      // 400 to błędy walidacji (np. obraz nie jest paragonem) - ponawianie nie pomoże.
      err.retryable = response.status !== 400;
      throw err;
    }

    if (result && result.error) {
      const err = new Error(result.error);
      err.retryable = false;
      throw err;
    }

    // Nowy format: obiekt { store, date, items }. Dla zgodności wstecznej
    // akceptujemy też samą tablicę pozycji.
    if (Array.isArray(result)) {
      return { store: null, date: null, items: result };
    }

    if (!result || !Array.isArray(result.items)) {
      const err = new Error("Otrzymano nieprawidłowy format danych z serwera.");
      err.retryable = true;
      throw err;
    }

    return result;
  };

  // Pełna analiza z automatycznym ponawianiem (do 5 razy, rosnący odstęp).
  const runAnalysis = async (file) => {
    setLastFailedFile(file);
    setAnalysisError(null);
    setRetryNumber(0);
    setLoadingPhase('analyzing');
    setView('loading');

    cancelledRef.current = false;
    const controller = new AbortController();
    abortRef.current = controller;

    let imageBase64;
    try {
      imageBase64 = await readFileAsDataURL(file);
    } catch (readError) {
      if (cancelledRef.current) return;
      setAnalysisError("Nie udało się odczytać pliku obrazu.");
      setView('default');
      return;
    }

    // i = 0 -> próba początkowa, i >= 1 -> kolejne ponowienia.
    for (let i = 0; i <= RETRY_DELAYS.length; i++) {
      if (cancelledRef.current) return;

      if (i > 0) {
        setLoadingPhase('retrying');
        setRetryNumber(i);
        try {
          await delay(RETRY_DELAYS[i - 1], controller.signal);
        } catch (abortError) {
          return; // przerwano w trakcie oczekiwania
        }
        if (cancelledRef.current) return;
      }

      try {
        const result = await analyzeOnce(imageBase64, controller.signal);
        if (cancelledRef.current) return;
        setReceiptItems(result.items);
        setReceiptMeta({ store: result.store ?? null, date: result.date ?? null });
        setLastFailedFile(null);
        setView('analysis');
        return;
      } catch (error) {
        if (cancelledRef.current || error.name === 'AbortError') return;

        const isLastAttempt = i === RETRY_DELAYS.length;
        if (error.retryable === false) {
          // Błąd, którego ponawianie nie naprawi (np. obraz nie jest paragonem)
          // — nie pokazujemy przycisku "Spróbuj ponownie".
          setAnalysisError(error.message || "Wystąpił nieoczekiwany błąd analizy.");
          setLastFailedFile(null);
          setView('default');
          return;
        }
        if (isLastAttempt) {
          setAnalysisError(error.message || "Wystąpił nieoczekiwany błąd analizy.");
          setView('default');
          return;
        }
        // W przeciwnym razie pętla przechodzi do kolejnego ponowienia.
      }
    }
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      runAnalysis(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleCancelAnalysis = () => {
    cancelledRef.current = true;
    abortRef.current?.abort();
    setAnalysisError(null);
    setLastFailedFile(null);
    setView('default');
  };

  const handleRetryAnalysis = () => {
    if (lastFailedFile) {
      runAnalysis(lastFailedFile);
    }
  };

  const handleGoToSummary = (debts) => {
    setCalculatedDebts(debts);
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

          batchUpdates.push(updateDoc(personRef, {
            transactions: arrayUnion({
              type: 'debt',
              amount: parseFloat(debts[personId].toFixed(2)),
              description: description || "Wspólne zakupy",
              date: date,
              timestamp: new Date()
            })
          }));
        }
      }
      await Promise.all(batchUpdates);
      showSnackbar?.("Płatność grupowa została zapisana.", "success");
      navigate('/');
    } catch (error) {
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
    <Box
      component={motion.div}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      sx={{
        maxWidth: '640px',
        width: { xs: '95%', sm: '100%' },
        margin: '2rem auto',
        padding: { xs: '0.5rem', sm: '2rem' }
      }}
    >
      <Paper elevation={3} sx={{ p: { xs: 2, sm: 3 }, backgroundColor: '#ffffff', color: 'rgb(30, 41, 59)' }}>

        {view === 'loading' && (
          <ReceiptScanLoader
            phase={loadingPhase}
            retryNumber={retryNumber}
            retryTotal={RETRY_DELAYS.length}
            onCancel={handleCancelAnalysis}
          />
        )}

        {view === 'analysis' && currentUser && (
          <ReceiptAnalysisView
            items={receiptItems}
            people={allPeople}
            summaries={summaries}
            currentUser={currentUser}
            onCalculate={handleGoToSummary}
            onBack={() => { setView('default'); setAnalysisError(null); setLastFailedFile(null); }}
          />
        )}

        {view === 'summary' && currentUser && (
          <SummaryView
            debts={calculatedDebts}
            people={allPeople}
            summaries={summaries}
            currentUser={currentUser}
            onConfirm={handleFinalizeDebts}
            onBack={() => setView('analysis')}
            defaultTitle={receiptMeta.store}
            defaultDate={receiptMeta.date}
          />
        )}

        {view === 'default' && (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
              <Button
                onClick={() => navigate('/')}
                variant="outlined"
                startIcon={<ArrowBackIcon />}
              >
                Powrót
              </Button>
              <Typography variant="h5">Płatność Grupowa</Typography>
            </Box>

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
            <TextField label="Całkowita kwota do podziału" type="number" value={payment.amount} onChange={(e) => setPayment({ ...payment, amount: e.target.value })} fullWidth margin="normal" inputProps={{ min: "0.01", step: "0.01" }} />
            <TextField label="Opis płatności (opcjonalnie)" value={payment.description} onChange={(e) => setPayment({ ...payment, description: e.target.value })} fullWidth margin="normal" />
            <TextField label="Data płatności" type="date" value={payment.date} onChange={(e) => setPayment({ ...payment, date: e.target.value })} fullWidth margin="normal" InputLabelProps={{ shrink: true }} />
            <FormControlLabel control={<Checkbox checked={includeCreator} onChange={(e) => setIncludeCreator(e.target.checked)} />} label="Uwzględnij mnie w podziale" />

            <Typography variant="subtitle1" sx={{ mt: 2, mb: 1 }}>Wybierz osoby do podziału:</Typography>
            <TextField fullWidth size="small" label="Szukaj osoby..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} sx={{ mb: 1 }} />
            {parseFloat(amountPerPerson) > 0 && <Typography align="right" variant="body2" color="text.secondary" sx={{ mb: 1 }}>Kwota na osobę: {amountPerPerson} PLN</Typography>}

            <List sx={{ border: '1px solid #ddd', borderRadius: 1 }}>
              {allPeople.length === 0 && (
                <ListItem>
                  <ListItemText primary="Brak osób do wybrania." />
                </ListItem>
              )}
              {allPeople.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())).map((person) => (
                <ListItemButton key={person.id} dense onClick={() => setSelectedPeople(prev => prev.includes(person.id) ? prev.filter(id => id !== person.id) : [...prev, person.id])}>
                  <ListItemIcon sx={{ minWidth: 'auto', mr: 1 }}>
                    <Checkbox edge="start" checked={selectedPeople.includes(person.id)} tabIndex={-1} disableRipple size="small" />
                  </ListItemIcon>
                  <ListItemText primary={person.name} />
                </ListItemButton>
              ))}
            </List>

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 3 }}>
              <Button onClick={() => navigate('/')}>Anuluj</Button>
              <Button
                onClick={handleManualSubmit}
                variant="contained"
                disabled={!(selectedPeople.length > 0 || includeCreator) || !payment.amount || parseFloat(payment.amount) <= 0}
              >
                Dodaj płatność ręczną
              </Button>
            </Box>
          </Box>
        )}
      </Paper>
    </Box>
  );
}


export default GroupPaymentPage;
